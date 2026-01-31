import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { apiConfig } from "@/lib/config/api-config"

const STREETDATA_BASE_URL = "https://api.data.street.co.uk/street-data-api/v2"

/**
 * POST /api/enrich-streetdata
 * Enrich properties with StreetData property details (bedrooms, year built, floor area)
 */
export async function POST(request: Request) {
  const log: string[] = []
  const updated: string[] = []
  const failed: string[] = []

  try {
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(body.limit || 20, 100)
    const propertyId = body.propertyId
    const retryFailed = body.retryFailed || false // Retry properties that failed matching

    if (!apiConfig.streetData.enabled) {
      return NextResponse.json({
        success: false,
        error: "StreetData API not configured. Add STREETDATA_API_KEY to .env.local",
      }, { status: 400 })
    }

    log.push("Starting StreetData enrichment...")

    // Fetch properties needing enrichment
    let query = supabaseAdmin
      .from("properties")
      .select("id, address, postcode, city, bedrooms, bathrooms")
      .eq("is_stale", false)
      .not("postcode", "is", null)

    if (propertyId) {
      query = query.eq("id", propertyId)
    } else if (retryFailed) {
      // Retry properties that were checked but failed to match (have enriched_at but no property_id)
      query = query
        .not("streetdata_enriched_at", "is", null)
        .is("streetdata_property_id", null)
        .limit(limit)
      log.push("Retrying previously failed properties...")
    } else {
      query = query.is("streetdata_enriched_at", null).limit(limit)
    }

    const { data: properties, error: fetchError } = await query

    if (fetchError) {
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
    }

    if (!properties?.length) {
      return NextResponse.json({
        success: true,
        message: "No properties found needing StreetData enrichment",
        log,
      })
    }

    log.push(`Found ${properties.length} properties to enrich`)

    // Group by postcode for efficiency
    const postcodeGroups = new Map<string, typeof properties>()
    for (const property of properties) {
      const pc = property.postcode?.toUpperCase().replace(/\s+/g, "")
      if (pc) {
        if (!postcodeGroups.has(pc)) {
          postcodeGroups.set(pc, [])
        }
        postcodeGroups.get(pc)!.push(property)
      }
    }

    log.push(`Grouped into ${postcodeGroups.size} postcodes`)

    for (const [postcode, props] of postcodeGroups) {
      try {
        log.push(`Fetching StreetData for postcode: ${postcode}`)

        const response = await fetch(
          `${STREETDATA_BASE_URL}/properties/areas/postcodes?postcode=${postcode}&tier=core`,
          {
            headers: {
              "x-api-key": apiConfig.streetData.apiKey || "",
              "Content-Type": "application/json",
            },
          }
        )

        if (!response.ok) {
          log.push(`  API error: ${response.status}`)
          props.forEach(p => failed.push(p.address))
          continue
        }

        const data = await response.json()
        const streetDataProps = data.data || []
        const propArray = Array.isArray(streetDataProps) ? streetDataProps : [streetDataProps]

        log.push(`  Found ${propArray.length} properties from StreetData`)

        // Match and update each property
        for (const property of props) {
          const matched = findMatchingStreetDataProperty(property, propArray)

          if (matched) {
            const attrs = matched.attributes || {}

            const updateData: any = {
              streetdata_property_id: matched.id,
              streetdata_enriched_at: new Date().toISOString(),
            }

            // Extract property details
            if (attrs.year_built?.value) {
              updateData.year_built = String(attrs.year_built.value)
            }
            if (attrs.construction_age_band?.value) {
              updateData.construction_age_band = attrs.construction_age_band.value
            }
            if (attrs.tenure?.value) {
              updateData.tenure = attrs.tenure.value
            }
            if (attrs.council_tax?.band?.value) {
              updateData.council_tax_band = attrs.council_tax.band.value
            }
            if (attrs.internal_area_square_metres?.value) {
              updateData.internal_area_sqm = attrs.internal_area_square_metres.value
            }
            if (attrs.is_bungalow?.value !== undefined) {
              updateData.is_bungalow = attrs.is_bungalow.value
            }
            if (attrs.outdoor_space?.has_garden?.value !== undefined) {
              updateData.has_outdoor_space = attrs.outdoor_space.has_garden.value
            }

            // Update bedrooms/bathrooms if not set
            if (!property.bedrooms && attrs.number_of_bedrooms?.value) {
              updateData.bedrooms = attrs.number_of_bedrooms.value
            }
            if (!property.bathrooms && attrs.number_of_bathrooms?.value) {
              updateData.bathrooms = attrs.number_of_bathrooms.value
            }

            const { error: updateError } = await supabaseAdmin
              .from("properties")
              .update(updateData)
              .eq("id", property.id)

            if (updateError) {
              log.push(`  Failed to update ${property.address}: ${updateError.message}`)
              failed.push(property.address)
            } else {
              log.push(`  Updated: ${property.address} (${updateData.year_built || "no year"}, ${updateData.bedrooms || property.bedrooms} beds)`)
              updated.push(property.address)
            }
          } else {
            // Mark as checked even if no match
            await supabaseAdmin
              .from("properties")
              .update({ streetdata_enriched_at: new Date().toISOString() })
              .eq("id", property.id)

            log.push(`  No match for: ${property.address}`)
            failed.push(property.address)
          }
        }

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (error) {
        log.push(`  Error: ${error}`)
        props.forEach(p => failed.push(p.address))
      }
    }

    return NextResponse.json({
      success: true,
      message: `Enriched ${updated.length} properties with StreetData`,
      summary: { processed: properties.length, enriched: updated.length, failed: failed.length },
      log,
      updated,
      failed,
    })

  } catch (error) {
    return NextResponse.json({ success: false, error: String(error), log }, { status: 500 })
  }
}

function findMatchingStreetDataProperty(property: any, streetDataProps: any[]): any {
  const normalizeAddress = (addr: string) => {
    return addr
      ?.toLowerCase()
      .replace(/[,.']/g, "")
      .replace(/\s+/g, " ")
      .replace(/\bflat\b/g, "")
      .replace(/\bapartment\b/g, "")
      .replace(/\bunit\b/g, "")
      .replace(/\broom\b/g, "")
      .trim()
  }

  const propAddress = normalizeAddress(property.address || "")
  if (!propAddress) return null

  // Extract building number (including flat numbers like "2" from "Flat 2")
  const extractNumbers = (addr: string): string[] => {
    const matches = addr.match(/\b(\d+[a-z]?)\b/g) || []
    return matches
  }

  const propNumbers = extractNumbers(propAddress)

  for (const sdProp of streetDataProps) {
    const attrs = sdProp.attributes || {}

    // Try multiple address formats from StreetData
    const sdAddresses = [
      attrs.address?.street_group_format?.address_lines,
      attrs.address?.single_line_format?.address,
      attrs.address?.paf_format?.address_lines,
    ].filter(Boolean).map(normalizeAddress)

    for (const sdAddress of sdAddresses) {
      if (!sdAddress) continue

      // Exact match
      if (sdAddress === propAddress) return sdProp

      // Contains match
      if (sdAddress.includes(propAddress) || propAddress.includes(sdAddress)) {
        return sdProp
      }

      const sdNumbers = extractNumbers(sdAddress)
      const sdParts = sdAddress.split(" ")
      const propParts = propAddress.split(" ")

      // Match by building number + street name
      const hasMatchingNumber = propNumbers.some(n => sdNumbers.includes(n))

      if (hasMatchingNumber) {
        // Check for common street words
        const commonWords = propParts.filter((w: string) =>
          w.length > 2 && sdParts.includes(w) && !/^\d+[a-z]?$/.test(w)
        )

        if (commonWords.length >= 1) {
          return sdProp
        }
      }

      // Fuzzy match - check if most significant words match
      const significantPropWords = propParts.filter((w: string) => w.length > 3 && !/^\d+[a-z]?$/.test(w))
      const significantSdWords = sdParts.filter((w: string) => w.length > 3 && !/^\d+[a-z]?$/.test(w))

      const matchingWords = significantPropWords.filter((w: string) => significantSdWords.includes(w))

      if (matchingWords.length >= 2 && hasMatchingNumber) {
        return sdProp
      }
    }
  }

  return null
}

export async function GET() {
  const hasKey = apiConfig.streetData.enabled

  return NextResponse.json({
    message: "POST to enrich properties with StreetData property details",
    configured: hasKey,
    dataProvided: [
      "year_built - Construction year or age band",
      "tenure - Freehold/Leasehold",
      "council_tax_band - Tax band A-H",
      "internal_area_sqm - Floor area",
      "bedrooms/bathrooms - Room counts",
      "is_bungalow - Property type flag",
      "has_outdoor_space - Garden availability",
    ],
    usage: {
      method: "POST",
      body: {
        limit: "Number of properties (default 20, max 100)",
        propertyId: "Specific property ID to enrich",
        retryFailed: "Set to true to retry properties that previously failed matching",
      },
    },
  })
}
