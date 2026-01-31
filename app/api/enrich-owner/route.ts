import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { apiConfig } from "@/lib/config/api-config"

const SEARCHLAND_BASE_URL = "https://api.searchland.co.uk/v1"

/**
 * POST /api/enrich-owner
 *
 * Batch enriches property owner data from Searchland Titles API
 *
 * Body: {
 *   propertyId?: string,  // Enrich a specific property
 *   limit?: number,       // Limit properties to enrich (default 10)
 *   testOnly?: boolean    // Just test API connection without saving
 *   skipAlreadyEnriched?: boolean // Skip properties with existing owner data (default true)
 * }
 */
export async function POST(request: Request) {
  const log: string[] = []
  const results: any[] = []

  try {
    const body = await request.json().catch(() => ({}))
    const { propertyId, limit = 10, testOnly = false, skipAlreadyEnriched = true } = body

    log.push("[1/5] Checking API configuration...")

    // Check Searchland API configuration
    if (!apiConfig.searchland.enabled || !apiConfig.searchland.apiKey) {
      return NextResponse.json({
        success: false,
        error: "Searchland API not configured",
        recommendation: "Add SEARCHLAND_API_KEY to .env.local",
        log,
      }, { status: 400 })
    }

    log.push("Searchland API configured")

    // Check Companies House API configuration
    const companiesHouseEnabled = apiConfig.companiesHouse.enabled && apiConfig.companiesHouse.apiKey
    log.push("Companies House API: " + (companiesHouseEnabled ? "configured" : "not configured"))

    log.push("[2/5] Fetching properties to enrich...")

    // Build query for properties that need enrichment
    let query = supabaseAdmin
      .from("properties")
      .select("id, address, postcode, city, latitude, longitude, owner_name, owner_type, title_last_enriched_at")
      .eq("is_stale", false)
      .not("latitude", "is", null)
      .not("longitude", "is", null)

    if (propertyId) {
      query = supabaseAdmin
        .from("properties")
        .select("id, address, postcode, city, latitude, longitude, owner_name, owner_type, title_last_enriched_at")
        .eq("id", propertyId)
    } else if (skipAlreadyEnriched) {
      // Only get properties that haven't been enriched for owner data
      query = query.is("title_last_enriched_at", null)
    }

    const { data: properties, error: fetchError } = await query.limit(limit)

    if (fetchError) {
      log.push("Database error: " + fetchError.message)
      return NextResponse.json({ success: false, error: fetchError.message, log }, { status: 500 })
    }

    if (!properties || properties.length === 0) {
      log.push("No properties found needing owner enrichment")
      return NextResponse.json({
        success: true,
        message: "No properties found needing owner enrichment",
        hint: "All properties may already have title_last_enriched_at set. Use skipAlreadyEnriched: false to re-enrich.",
        log,
        results: [],
      })
    }

    log.push(`Found ${properties.length} properties to enrich`)

    log.push("[3/5] Processing properties with Searchland Titles API...")

    let successCount = 0
    let failCount = 0
    let ownersFound = 0
    let companiesFound = 0

    // Process each property
    for (let i = 0; i < properties.length; i++) {
      const property = properties[i]
      const propertyLog: string[] = []

      propertyLog.push(`[${i + 1}/${properties.length}] ${property.address}`)

      if (!property.latitude || !property.longitude) {
        propertyLog.push("  ⚠ No coordinates - skipping")
        failCount++
        results.push({ property: property.address, status: "skipped", reason: "no coordinates" })
        continue
      }

      try {
        // Search for titles at this location with a small polygon
        const titlesResponse = await searchTitles(property.longitude, property.latitude)

        if (titlesResponse.error) {
          propertyLog.push(`  ⚠ Title search error: ${titlesResponse.error}`)
          failCount++
          results.push({ property: property.address, status: "error", error: titlesResponse.error })
          continue
        }

        if (!titlesResponse.data || titlesResponse.data.length === 0) {
          propertyLog.push("  ⚠ No titles found at location")
          // Still mark as checked so we don't retry
          await supabaseAdmin
            .from("properties")
            .update({ title_last_enriched_at: new Date().toISOString() })
            .eq("id", property.id)
          failCount++
          results.push({ property: property.address, status: "no_titles" })
          continue
        }

        // Find the best matching title (ideally matching postcode or closest)
        const bestTitle = findBestMatchingTitle(titlesResponse.data, property.postcode)
        propertyLog.push(`  Found ${titlesResponse.data.length} titles, using: ${bestTitle.title_no}`)

        // Get full title details
        const titleDetails = await getTitleDetails(bestTitle.title_no)

        if (titleDetails.error) {
          propertyLog.push(`  ⚠ Error getting title details: ${titleDetails.error}`)
          failCount++
          results.push({ property: property.address, status: "error", error: titleDetails.error })
          continue
        }

        const ownerData = extractOwnerData(titleDetails.data)

        if (ownerData.owner_name) {
          ownersFound++
          propertyLog.push(`  ✓ Owner: ${ownerData.owner_name}`)
        } else {
          propertyLog.push(`  ○ Owner type: ${ownerData.ownership_category || ownerData.owner_type}`)
        }

        if (ownerData.company_number) {
          companiesFound++
          propertyLog.push(`  ✓ Company: ${ownerData.company_number}`)
        }

        if (ownerData.epc_rating) {
          propertyLog.push(`  EPC: ${ownerData.epc_rating}`)
        }

        // Save to database if not test only
        if (!testOnly) {
          const { error: updateError } = await supabaseAdmin
            .from("properties")
            .update({
              owner_name: ownerData.owner_name,
              owner_address: ownerData.owner_address,
              owner_type: ownerData.owner_type,
              company_name: ownerData.company_name,
              company_number: ownerData.company_number,
              title_number: ownerData.title_number,
              epc_rating: ownerData.epc_rating,
              owner_enrichment_source: "searchland",
              title_last_enriched_at: new Date().toISOString(),
            })
            .eq("id", property.id)

          if (updateError) {
            propertyLog.push(`  ⚠ Save failed: ${updateError.message}`)
            failCount++
          } else {
            successCount++
            propertyLog.push("  ✓ Saved")
          }
        } else {
          successCount++
        }

        results.push({
          property: property.address,
          status: "success",
          titleNumber: ownerData.title_number,
          ownerName: ownerData.owner_name,
          ownerType: ownerData.owner_type,
          companyNumber: ownerData.company_number,
          epcRating: ownerData.epc_rating,
        })

        // Add property log to main log
        log.push(...propertyLog)

        // Rate limiting: wait 200ms between API calls to avoid overwhelming the API
        if (i < properties.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }

      } catch (error) {
        propertyLog.push(`  ⚠ Exception: ${error}`)
        failCount++
        results.push({ property: property.address, status: "error", error: String(error) })
        log.push(...propertyLog)
      }
    }

    log.push("[4/5] Enrichment complete")
    log.push(`  ✓ Success: ${successCount}`)
    log.push(`  ⚠ Failed/Skipped: ${failCount}`)
    log.push(`  Owners found: ${ownersFound}`)
    log.push(`  Companies found: ${companiesFound}`)

    // Summary
    const summary = {
      searchlandConfigured: true,
      propertiesProcessed: properties.length,
      successCount,
      failCount,
      ownersFound,
      companiesFound,
      testOnly,
    }

    return NextResponse.json({
      success: true,
      message: testOnly ? "API test completed" : "Owner enrichment completed",
      log,
      results,
      summary,
    })

  } catch (error) {
    log.push("Error: " + String(error))
    return NextResponse.json({ success: false, error: String(error), log }, { status: 500 })
  }
}

/**
 * Find the best matching title from search results
 */
function findBestMatchingTitle(titles: any[], targetPostcode: string | null) {
  if (!targetPostcode || titles.length === 1) {
    return titles[0]
  }

  // Try to find a title that matches the postcode prefix
  const postcodePrefix = targetPostcode.split(" ")[0].toUpperCase()

  // Prefer freehold titles over leasehold
  const freeholds = titles.filter(t => t.calculated_class_of_title === "freehold")
  const searchIn = freeholds.length > 0 ? freeholds : titles

  return searchIn[0]
}

/**
 * Search for titles using POST /titles/search with geometry
 */
async function searchTitles(lng: number, lat: number) {
  try {
    // Create a small polygon around the point
    const offset = 0.0005 // ~50 meters
    const geometry = {
      type: "Polygon",
      coordinates: [[
        [lng - offset, lat - offset],
        [lng + offset, lat - offset],
        [lng + offset, lat + offset],
        [lng - offset, lat + offset],
        [lng - offset, lat - offset],
      ]],
    }

    const response = await fetch(`${SEARCHLAND_BASE_URL}/titles/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiConfig.searchland.apiKey}`,
      },
      body: JSON.stringify({
        geometry,
        page: 1,
        perPage: 10,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { error: `${response.status}: ${errorText}`, data: null }
    }

    const result = await response.json()
    return {
      error: null,
      cost: result.cost,
      count: result.count,
      data: result.data || [],
    }
  } catch (error) {
    return { error: String(error), data: null }
  }
}

/**
 * Get full title details using GET /titles/get
 */
async function getTitleDetails(titleNumber: string) {
  try {
    const response = await fetch(
      `${SEARCHLAND_BASE_URL}/titles/get?titleNumber=${encodeURIComponent(titleNumber)}`,
      {
        headers: {
          "Authorization": `Bearer ${apiConfig.searchland.apiKey}`,
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      return { error: `${response.status}: ${errorText}`, data: null }
    }

    const result = await response.json()
    return {
      error: null,
      cost: result.cost,
      data: result.data || null,
    }
  } catch (error) {
    return { error: String(error), data: null }
  }
}

/**
 * Extract owner data from title details
 */
function extractOwnerData(title: any) {
  const proprietor = title.proprietor?.[0] || {}

  // Determine owner type
  let ownerType: string = "unknown"
  const ownershipCategory = title.ownership_category?.toLowerCase() || ""
  const proprietorCategory = proprietor.proprietorship_category?.toLowerCase() || ""

  if (ownershipCategory.includes("company") || ownershipCategory.includes("corporate") || proprietorCategory.includes("company") || proprietorCategory.includes("limited")) {
    ownerType = "company"
  } else if (ownershipCategory.includes("housing association")) {
    ownerType = "company"
  } else if (ownershipCategory.includes("government") || ownershipCategory.includes("council") || ownershipCategory.includes("local authority")) {
    ownerType = "government"
  } else if (ownershipCategory.includes("private")) {
    ownerType = "individual"
  } else if (proprietor.company_registration_no) {
    ownerType = "company" // Has company number, so it's a company
  }

  // Format address
  let ownerAddress = null
  if (proprietor.address) {
    if (typeof proprietor.address === "string") {
      ownerAddress = proprietor.address
    } else if (Array.isArray(proprietor.address)) {
      ownerAddress = proprietor.address.filter(Boolean).join(", ")
    }
  }

  return {
    owner_name: proprietor.name || null,
    owner_address: ownerAddress,
    owner_type: ownerType,
    company_name: (ownerType === "company" || proprietor.company_registration_no) ? proprietor.name : null,
    company_number: proprietor.company_registration_no || null,
    title_number: title.title_no,
    epc_rating: title.current_rating || null,
    epc_rating_numeric: title.current_energy_efficiency || null,
    article_4_area: title.sqmt_of_title_is_planning_consideration?.sqmt_is_not_article_4 === 0,
    ownership_category: title.ownership_category,
    date_proprietor_added: title.date_proprietor_added,
  }
}

/**
 * GET /api/enrich-owner
 * Returns API status and documentation
 */
export async function GET() {
  return NextResponse.json({
    message: "POST to test and enrich property owner data",
    description: "Uses Searchland Titles API for owner information",
    correctEndpoints: {
      titlesSearch: {
        method: "POST",
        url: "https://api.searchland.co.uk/v1/titles/search",
        body: "{ geometry: { type: 'Polygon', coordinates: [[[lng,lat],...]] }, page: 1, perPage: 10 }",
        returns: "title_no, ownership_category, calculated_class_of_title",
        cost: "0.5 credits per 10 results",
      },
      titlesGet: {
        method: "GET",
        url: "https://api.searchland.co.uk/v1/titles/get?titleNumber=X",
        returns: "Full owner details: proprietor name, address, company_registration_no, EPC, constraints",
        cost: "1 credit",
      },
      hmoSearch: {
        method: "GET",
        url: "https://api.searchland.co.uk/v1/hmo/search?lng=X&lat=Y",
        returns: "HMO licences: council, licence_expiry, licence_type, max_occupancy",
        cost: "20 credits",
      },
    },
    usage: {
      testApi: "POST with { testOnly: true }",
      enrichOne: "POST with { propertyId: 'uuid' }",
      enrichBatch: "POST with { limit: 10 }",
    },
    documentation: "https://docs.searchland.co.uk/",
  })
}
