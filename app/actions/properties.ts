"use server"

import { createClient } from "@/lib/supabase/server"
import type { Property, PropertyFilters } from "@/lib/types/database"
import { validateFilters, isValidISODate } from "@/lib/validation/filters"
import { boundingBox, cityCatchment, withinCatchment } from "@/lib/properties/location"

const CACHE_DURATION = 60000 // 1 minute cache (reduced for debugging)
let propertiesCache: { data: Property[]; timestamp: number; filters: string } | null = null

// Helper to safely execute Supabase query with rate limit handling
async function safeSupabaseQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any }> {
  try {
    return await queryFn()
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err)
    // Convert JSON parse errors from rate limiting into a proper error object
    if (errMessage.includes("Unexpected token") || errMessage.includes("Too Many")) {
      return { data: null, error: { message: "Rate limit exceeded", code: "429" } }
    }
    return { data: null, error: { message: errMessage, code: "UNKNOWN" } }
  }
}

/**
 * The columns the list and map actually read.
 *
 * getProperties() selected "*" — all 184 columns — and returns the result to the
 * browser through a Server Action, which Next serialises into the RSC payload.
 * At 902 served rows that was roughly 9 MB and survived. Correcting
 * is_potential_hmo took the served set to 2,089 and the payload to 21.4 MB, and
 * the page stopped rendering: the action still returned 200, the client just
 * never got usable data. The ceiling was always there; the row count found it.
 *
 * Measured over the live served set:
 *
 *     description   6.11 MB   28.6%      <- panel only
 *     images        4.68 MB   21.9%      <- superseded by primary_image
 *     other 182     ~10.6 MB             <- mostly JSON key overhead:
 *                                           184 keys x 2,089 rows
 *
 * So the win is as much about dropping KEYS as values. This projection is 48
 * columns and measures 2.85 MB — an 87% reduction, and the query time falls
 * from 4.2s to 1.3s.
 *
 * WHAT IS DELIBERATELY ABSENT
 *
 * `description`, `images` and `floor_plans` are read only by the selected-
 * property panel, which now refetches the whole row by id on selection. A list
 * of 2,089 properties should not carry the detail of all of them so that one
 * can be opened.
 *
 * `primary_image` replaces `images` for the card. PropertyImage takes the first
 * non-stock URL from the array; measured across all 2,094 rows, primary_image
 * already equals that value on every row that has one — 1,927 matches, zero
 * differences — so the card renders identically from a 0.22 MB column instead
 * of a 4.68 MB one.
 *
 * ADDING A FIELD TO A CARD MEANS ADDING IT HERE. That is the cost of a
 * projection, and it is the right trade: the alternative is a page that works
 * until the row count grows.
 */
const LIST_COLUMNS = [
  // identity and position
  "id", "external_id", "title", "address", "postcode", "city", "latitude", "longitude",
  // listing basics shown on the card
  "listing_type", "property_type", "purchase_price", "price_pcm", "bedrooms", "bathrooms",
  "primary_image", "image_url", "source_name", "source_url", "created_at",
  // categorise() / inSegment() / sourcingCategory() — see CategorisableProperty
  "hmo_status", "is_potential_hmo", "licensed_hmo", "licence_status", "licence_checked_at",
  "hmo_licence_expiry", "hmo_licence_reference", "max_occupants",
  // Article4Position, and the labels the card prints beside it
  "article_4_status", "article_4_area", "article_4_area_name", "article_4_council",
  // figures the card and the segment counts read
  "epc_rating", "gross_internal_area_sqm", "floor_area_band", "lettable_rooms",
  "estimated_rent_per_room", "estimated_gross_monthly_rent", "estimated_yield_percentage",
  "deal_score", "broadband_max_down", "has_fiber", "is_furnished", "is_ex_local_authority",
  // owner presence drives a count on the map page; the values themselves are
  // gated by entitlement further down
  "owner_name", "company_name", "company_number", "contact_data_opted_out",
  // filtered on
  "is_stale",
].join(",")

export async function getProperties(filters?: Partial<PropertyFilters>): Promise<Property[]> {
  // Validate and sanitize all filter inputs
  const validatedFilters = filters ? validateFilters(filters) : {}
  const filterKey = JSON.stringify(validatedFilters)
  const now = Date.now()

  // Check if licence expiry filter is active (all 3 fields must be set)
  const licenceExpiryFilterActive = !!(
    validatedFilters.licenceExpiryStartMonth &&
    validatedFilters.licenceExpiryEndMonth &&
    validatedFilters.licenceExpiryYear
  )

  // Debug: log licence expiry filter
  if (licenceExpiryFilterActive) {
    console.log("[PropertiesAction] Licence Expiry Filter ACTIVE:", {
      startMonth: validatedFilters.licenceExpiryStartMonth,
      endMonth: validatedFilters.licenceExpiryEndMonth,
      year: validatedFilters.licenceExpiryYear,
    })
  }

  // Always return cached data if available and not too old
  if (propertiesCache && propertiesCache.filters === filterKey && now - propertiesCache.timestamp < CACHE_DURATION) {
    return propertiesCache.data
  }

  try {
    const supabase = await createClient()

    let query = supabase.from("properties").select(LIST_COLUMNS).order("created_at", { ascending: false })

    query = query.or("is_stale.eq.false,is_stale.is.null")

    // HMO Hunter: Only show Licensed HMOs, Potential HMOs, or Expired Licence HMOs - filter out standard listings
    query = query.or("licensed_hmo.eq.true,is_potential_hmo.eq.true,licence_status.eq.expired")

    // The platform sources properties to buy. That is anything for sale, plus
    // any HMO worth approaching an owner about — but never a rental listing
    // with nothing tying it to an HMO asset.
    //
    // Licence evidence is the dividing line, not tenure. A licensed HMO that
    // happens to be advertised to let is still an existing HMO with an owner
    // and a licence; a two-bed flat to let is not. Filtering on
    // listing_type alone would have dropped 227 register records that were
    // never rentals, and with them most of the licence-expiry dataset.
    //
    // Kept in step with isServed() in lib/properties/category.ts, which is the
    // same rule expressed for a single row.
    query = query.or("listing_type.eq.purchase,licensed_hmo.eq.true,licence_status.eq.expired")

    // Price therefore always means purchase price. There is no rent branch left
    // to pick, so the licence-expiry carve-out is the only condition.
    //
    // A property with no price is not a property outside the price range. Most
    // of the licensed HMO stock is off market — nobody is asking anything for
    // it — so a plain gte/lte silently dropped 457 licensed HMOs the moment the
    // fabricated prices were cleared out from under them, leaving the map
    // showing 738 of 1,525. Those records are the off-market opportunities this
    // product exists to surface, so an unpriced row passes a price filter
    // rather than failing it, and the user narrows by price only among the
    // properties that actually have one.
    // The `&& !licenceExpiryFilterActive` guard here dates from 2026-08-11 and
    // was made redundant on 2026-08-15, when unpriced rows started passing the
    // price filter rather than failing it. Until it was removed, setting a price
    // range and then filtering by licence expiry left the slider visibly set and
    // silently ignored.
    //
    // Both ends are now absent when unset, so neither needs a special case. The
    // max used to carry one — `maxPrice < PRICE_SLIDER_MAX`, because the
    // slider's top stop meant "no limit" and reading it literally excluded 330
    // properties — while the min never got the matching case. `if (minPrice)`
    // was true at the slider's own resting value of 50,000, so every query ever
    // sent carried `purchase_price >= 50000`. Nothing in the table sits below
    // that today, which is the only reason it was never seen; sub-50k northern
    // terraces are exactly the stock this product is for, and they would have
    // been invisible at rest on the day they were ingested.
    if (validatedFilters.minPrice !== undefined) {
      query = query.or(`purchase_price.gte.${validatedFilters.minPrice},purchase_price.is.null`)
    }
    if (validatedFilters.maxPrice !== undefined) {
      query = query.or(`purchase_price.lte.${validatedFilters.maxPrice},purchase_price.is.null`)
    }

    // The three kinds of sourcing job, expressed as SQL. Kept in step with
    // sourcingCategory() in lib/properties/category.ts, which is the same rule
    // for a single row — the pair is tested against each other rather than
    // trusted to stay aligned by hand.
    //
    // HMO use means a licence on the record, live or expired: an expired licence
    // still proves the building was in HMO use, which is the fact a change-of-use
    // question turns on.
    const HMO_USE = "licensed_hmo.eq.true,licence_status.eq.expired"
    const categories = validatedFilters.sourcingCategories
    if (categories && categories.length > 0 && categories.length < 3) {
      const clauses: string[] = []
      if (categories.includes("existing_off_market")) {
        clauses.push(`and(listing_type.neq.purchase,or(${HMO_USE}))`)
      }
      if (categories.includes("for_sale_hmo")) {
        clauses.push(`and(listing_type.eq.purchase,or(${HMO_USE}))`)
      }
      if (categories.includes("change_of_use")) {
        // NOT (col = true) evaluates to NULL for a NULL column, so PostgREST
        // would drop every row that has never been assessed — which is most of
        // the change-of-use stock. The null case has to be named explicitly.
        clauses.push(
          `and(or(licensed_hmo.is.null,licensed_hmo.eq.false),or(licence_status.is.null,licence_status.neq.expired))`
        )
      }
      query = query.or(clauses.join(","))
    }

    // Apply filters
    // propertyTypes was accepted and applied here, and nothing in the product
    // ever set it — there is no control for it anywhere. A filter no caller can
    // reach is not a feature, it is a branch that has to be kept working.
    // Location is geographic, not a string match on the `city` column. That
    // column is free text from whichever adapter wrote the row, and the sources
    // disagree about granularity: `.eq("city", "Reading")` returned 0 while 74
    // Berkshire rows sat there, and `.eq("city", "Manchester")` returned 36
    // while omitting 55 more filed as Greater Manchester. 639 of 1,160 served
    // properties — 55% — were unreachable from the dropdown entirely. See
    // lib/properties/location.ts for the measurements and the reasoning.
    //
    // The box is the coarse cut, because PostgREST can express a rectangle and
    // not a circle; withinCatchment trims the corners after the rows arrive.
    // Every matching row is walked below, not just the first page, so filtering
    // afterwards cannot silently truncate the result.
    const catchment = validatedFilters.postcodePrefix
      ? null
      : cityCatchment(validatedFilters.city)
    if (catchment) {
      const box = boundingBox(catchment)
      query = query
        .gte("latitude", box.minLat)
        .lte("latitude", box.maxLat)
        .gte("longitude", box.minLng)
        .lte("longitude", box.maxLng)
    }
    // Filter by postcode prefix (e.g., "M14", "E1 6")
    if (validatedFilters.postcodePrefix) {
      // Use ilike for case-insensitive prefix matching
      query = query.ilike("postcode", `${validatedFilters.postcodePrefix}%`)
    }

    // Phase 3 - EPC Rating Filter
    if (validatedFilters.minEpcRating) {
      const epcOrder = ["A", "B", "C", "D", "E", "F", "G"]
      const minIndex = epcOrder.indexOf(validatedFilters.minEpcRating)
      if (minIndex >= 0) {
        const validRatings = epcOrder.slice(0, minIndex + 1)
        query = query.in("epc_rating", validRatings)
      }
    }

    // Phase 3 - Article 4 Filter
    //
    // This used to match `article_4_area.eq.false,article_4_area.is.null`, which
    // swept in every property whose council simply isn't covered by the national
    // feed and presented Manchester, Leeds and Sheffield stock as Article-4-free.
    //
    // Two distinct intents are now separable, because conflating them is what
    // produced the false negative:
    //   exclude         - "don't show me known-restricted stock". Unknowns stay
    //                     in, and the cards badge them as unverified.
    //   confirmed_clear - "only show me what's verified as outside one". Today
    //                     that means the councils that publish to the feed.
    if (validatedFilters.article4Filter === "exclude") {
      query = query.neq("article_4_status", "in_force")
    } else if (validatedFilters.article4Filter === "confirmed_clear") {
      query = query.eq("article_4_status", "none_found")
    } else if (validatedFilters.article4Filter === "only") {
      query = query.eq("article_4_status", "in_force")
    }
    // "include" means no filter - show all properties

    // Phase 5 - Broadband Filter
    if (validatedFilters.hasFiber === true) {
      query = query.eq("has_fiber", true)
    }
    if (validatedFilters.minBroadbandSpeed && validatedFilters.minBroadbandSpeed > 0) {
      query = query.gte("broadband_max_down", validatedFilters.minBroadbandSpeed)
    }

    // Phase 6 - Bedroom/Bathroom filters
    if (validatedFilters.minBedrooms && validatedFilters.minBedrooms > 0) {
      query = query.gte("bedrooms", validatedFilters.minBedrooms)
    }
    if (validatedFilters.minBathrooms && validatedFilters.minBathrooms > 0) {
      query = query.gte("bathrooms", validatedFilters.minBathrooms)
    }
    // Phase 6 - Furnished/Parking filters
    if (validatedFilters.isFurnished === true) {
      query = query.eq("is_furnished", true)
    }
    // hasParking is gone. has_parking is false on all 2,958 rows and is written
    // by nothing in this codebase, so the switch could only ever return an empty
    // map — which is exactly what it did.

    // Licence Type Filter
    //
    // "Expired" is a date that has passed, not a stored status. The status
    // column carries the council's own word and is only set on revocation, so
    // filtering on it alone returned 15 properties while 98 cards on the page
    // were badged expired. Kept in step with categorise() in
    // lib/properties/category.ts, which decides the badge from the same date.
    const today = new Date().toISOString().slice(0, 10)
    const DERIVED_EXPIRED = `licence_status.eq.expired,and(licensed_hmo.eq.true,hmo_licence_expiry.lt.${today})`
    if (validatedFilters.licenceTypeFilter && validatedFilters.licenceTypeFilter !== "all") {
      if (validatedFilters.licenceTypeFilter === "any_licensed") {
        // A licence that has run out is not a licence the reader can rely on,
        // so "Any Licensed HMO" excludes it — the option below is for those.
        query = query
          .eq("licensed_hmo", true)
          .neq("licence_status", "expired")
          .or(`hmo_licence_expiry.is.null,hmo_licence_expiry.gte.${today}`)
      } else if (validatedFilters.licenceTypeFilter === "expired_licence") {
        query = query.or(DERIVED_EXPIRED)
      } else if (validatedFilters.licenceTypeFilter === "unlicensed") {
        // Show only properties without licences
        query = query.or("licensed_hmo.eq.false,licensed_hmo.is.null")
      }
      // A branch for specific licence-type codes stood here. It queried
      // property_licences, which does not exist in the schema — PostgREST
      // answers PGRST205 — and the undefined result fell through to
      // `return []`. So "Mandatory HMO Licence", the commonest licence in the
      // country, emptied the page, silently, and so did the other five. The
      // options are gone from the UI; nothing stores licence type per property
      // to filter on yet.
    }

    // These used to sit inside `if (showPotentialHMOs)`, whose else-branch
    // restricted the whole result to licensed stock — the same thing the
    // change_of_use sourcing category already does, and better. The switch is
    // gone; see the note in app/map/page.tsx.
    //
    // The classification and yield-band filters went with it. Classification
    // was keyed off deal_score, removed from the product in 5396d0f, and read
    // a missing EPC as a D. yield_band bands estimated_yield_percentage, which
    // comes off the city-average room rent.

    // Floor area, matched against the measurement rather than the stored band.
    // floor_area_band is computed at ingestion from `floor_area ||
    // estimateFloorArea(bedrooms, type)`, so on the rows with no measurement it
    // is a guess from bedroom count — 60 to 100 m² plus 15 per bedroom. A
    // property whose size nobody recorded is not a property of a known size,
    // so it does not match a size filter.
    if (validatedFilters.floorAreaBand) {
      const bounds = {
        under_90: { lt: 90 },
        "90_120": { gte: 90, lte: 120 },
        "120_plus": { gt: 120 },
      }[validatedFilters.floorAreaBand]
      query = query.not("gross_internal_area_sqm", "is", null)
      if ("lt" in bounds && bounds.lt !== undefined) query = query.lt("gross_internal_area_sqm", bounds.lt)
      if ("gte" in bounds && bounds.gte !== undefined) query = query.gte("gross_internal_area_sqm", bounds.gte)
      if ("lte" in bounds && bounds.lte !== undefined) query = query.lte("gross_internal_area_sqm", bounds.lte)
      if ("gt" in bounds && bounds.gt !== undefined) query = query.gt("gross_internal_area_sqm", bounds.gt)
    }

    // EPC band. The label said "Compliant (C/D)" over a query matching A–D;
    // the label now says A to D.
    if (validatedFilters.epcBand === "good") {
      query = query.in("epc_rating", ["A", "B", "C", "D"])
    } else if (validatedFilters.epcBand === "needs_upgrade") {
      query = query.in("epc_rating", ["E", "F", "G"])
    }

    // Ex-Local Authority filter
    if (validatedFilters.isExLocalAuthority) {
      query = query.eq("is_ex_local_authority", true)
    }

    // Owner Data Filter - show only properties with title owner information
    if (validatedFilters.hasOwnerData) {
      // Show properties that have either owner_name OR company_name populated
      query = query.or("owner_name.not.is.null,company_name.not.is.null")
    }

    // Licence Expiry Date Filter (Premium Feature) - Month Range
    // Filter properties by licence end date within a month range for a specific year
    if (validatedFilters.licenceExpiryStartMonth && validatedFilters.licenceExpiryEndMonth && validatedFilters.licenceExpiryYear) {
      const year = validatedFilters.licenceExpiryYear
      const startMonth = validatedFilters.licenceExpiryStartMonth
      const endMonth = validatedFilters.licenceExpiryEndMonth

      // Start of range: first day of start month
      const startDate = `${year}-${startMonth.toString().padStart(2, '0')}-01`

      // End of range: last day of end month
      const lastDay = new Date(year, endMonth, 0).getDate()
      const endDate = `${year}-${endMonth.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`

      // hmo_licence_expiry, not licence_end_date. This filter is the reason
      // someone pays for the tier — "whose licence lapses in this window" — and
      // it was reading the seeded column, whose 252 rows hold six distinct
      // dates. Picking a month returned whichever cities the seed happened to
      // stamp with it, not the licences actually running out.
      query = query.gte("hmo_licence_expiry", startDate)
      query = query.lte("hmo_licence_expiry", endDate)
      query = query.not("hmo_licence_expiry", "is", null)
    }

    // PostgREST caps a response at 1,000 rows. Nothing in this file asked for a
    // limit, so the cap arrived silently: the map drew 1,000 markers, said
    // "Showing 1000 properties", and gave no sign that 525 more existed. A
    // truncation the reader cannot see is worse than a slower query, so the
    // pages are walked until one comes back short.
    const PAGE = 1000
    const { data, error } = await safeSupabaseQuery(async () => {
      const all: unknown[] = []
      for (let from = 0; ; from += PAGE) {
        const page = await query.range(from, from + PAGE - 1)
        if (page.error) return page
        const rows = page.data ?? []
        all.push(...rows)
        if (rows.length < PAGE) break
      }
      return { data: all, error: null }
    })

    if (error) {
      const errorMessage = error.message || String(error)

      // Handle rate limiting - return cached data if available
      if (
        errorMessage.includes("429") ||
        errorMessage.includes("Too Many") ||
        errorMessage.includes("rate limit") ||
        errorMessage.includes("Rate limit") ||
        errorMessage.includes("Unexpected token")
      ) {
        if (propertiesCache) {
          return propertiesCache.data
        }
        return []
      }
      
      // For other errors, also try cache first
      if (propertiesCache) {
        return propertiesCache.data
      }
      return []
    }

    // GDPR: Filter out contact data for opted-out owners
    const processedData = (data || []).map((property: any) => {
      if (property.contact_data_opted_out) {
        return {
          ...property,
          owner_contact_email: null,
          owner_contact_phone: null,
        }
      }
      return property
    }) as Property[]

    // The circle, after the box. Corners of a 15 km box reach 21 km, which is
    // far enough to pull a neighbouring town into a city's results.
    const located = catchment
      ? processedData.filter((property) => withinCatchment(property, catchment))
      : processedData

    propertiesCache = {
      data: located,
      timestamp: now,
      filters: filterKey,
    }

    // Debug: Log coordinate distribution
    if (located.length > 0) {
      const lats = located.map((p: any) => p.latitude).filter((v: any) => v != null)
      const lngs = located.map((p: any) => p.longitude).filter((v: any) => v != null)
      const nullCoords = located.filter((p: any) => p.latitude == null || p.longitude == null).length
      console.log("[PropertiesAction] Returned:", {
        total: located.length,
        withCoords: lats.length,
        nullCoords,
        lat: lats.length > 0 ? { min: Math.min(...lats), max: Math.max(...lats) } : "none",
        lng: lngs.length > 0 ? { min: Math.min(...lngs), max: Math.max(...lngs) } : "none",
      })
    }

    return located
  } catch {
    // On any error, return cached data or empty array
    if (propertiesCache) {
      return propertiesCache.data
    }
    return []
  }
}

export async function getPropertyById(id: string): Promise<Property | null> {
  const supabase = await createClient()

  const { data, error } = await supabase.from("properties").select("*").eq("id", id).single()

  if (error) {
    console.error("[v0] Error fetching property:", error)
    return null
  }

  // GDPR: Filter out contact data for opted-out owners
  if (data?.contact_data_opted_out) {
    return {
      ...data,
      owner_contact_email: null,
      owner_contact_phone: null,
    } as Property
  }

  return data as Property
}
