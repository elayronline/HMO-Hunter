import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { apiConfig } from "@/lib/config/api-config"

const SEARCHLAND_BASE_URL = "https://api.searchland.co.uk/v1"

/**
 * POST /api/enrich-owner
 *
 * Tests and enriches property owner data from Searchland Titles API
 *
 * Body: {
 *   propertyId?: string,  // Enrich a specific property
 *   limit?: number,       // Limit properties to enrich (default 5)
 *   testOnly?: boolean    // Just test API connection without saving
 * }
 */
export async function POST(request: Request) {
  const log: string[] = []
  const results: any[] = []

  try {
    const body = await request.json().catch(() => ({}))
    const { propertyId, limit = 5, testOnly = false } = body

    log.push("[1/4] Checking API configuration...")

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

    log.push("[2/4] Fetching properties to enrich...")

    // Build query for properties - only select columns that exist
    let query = supabaseAdmin
      .from("properties")
      .select("id, address, postcode, city, latitude, longitude")
      .eq("is_stale", false)

    if (propertyId) {
      query = supabaseAdmin
        .from("properties")
        .select("id, address, postcode, city, latitude, longitude")
        .eq("id", propertyId)
    }

    const { data: properties, error: fetchError } = await query.limit(limit)

    if (fetchError) {
      log.push("Database error: " + fetchError.message)
      return NextResponse.json({ success: false, error: fetchError.message, log }, { status: 500 })
    }

    if (!properties || properties.length === 0) {
      log.push("No properties found to enrich")
      return NextResponse.json({
        success: true,
        message: "No properties found to enrich",
        log,
        results: [],
      })
    }

    log.push(`Found ${properties.length} properties to enrich`)

    log.push("[3/4] Testing Searchland Titles API...")

    // Test with the first property
    const testProperty = properties[0]

    if (!testProperty.latitude || !testProperty.longitude) {
      log.push(`Property ${testProperty.address} has no coordinates - cannot search titles`)
      return NextResponse.json({
        success: false,
        error: "Property has no coordinates",
        log,
      }, { status: 400 })
    }

    // Step 1: Search for titles near the property
    const titlesResponse = await searchTitles(
      testProperty.longitude,
      testProperty.latitude
    )

    results.push({
      property: testProperty.address,
      postcode: testProperty.postcode,
      coordinates: { lat: testProperty.latitude, lng: testProperty.longitude },
      titleSearchResult: titlesResponse,
    })

    if (titlesResponse.error) {
      log.push("Searchland titles/search error: " + titlesResponse.error)
    } else if (titlesResponse.data && titlesResponse.data.length > 0) {
      log.push(`Found ${titlesResponse.data.length} titles near property`)

      // Step 2: Get full details for the first title
      const titleNumber = titlesResponse.data[0].title_no
      log.push(`Fetching details for title: ${titleNumber}`)

      const titleDetails = await getTitleDetails(titleNumber)
      results.push({ titleDetails })

      if (titleDetails.error) {
        log.push("Error getting title details: " + titleDetails.error)
      } else if (titleDetails.data) {
        const ownerData = extractOwnerData(titleDetails.data)
        log.push(`Owner found: ${ownerData.owner_name || titleDetails.data.ownership_category || "Unknown"}`)
        log.push(`Owner type: ${ownerData.owner_type}`)
        if (ownerData.company_number) {
          log.push(`Company number: ${ownerData.company_number}`)
        }
        if (ownerData.epc_rating) {
          log.push(`EPC rating: ${ownerData.epc_rating}`)
        }

        results.push({ ownerData })

        // Save to database if not test only
        if (!testOnly) {
          log.push("[4/4] Saving owner data to database...")

          // Check if owner columns exist
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
            .eq("id", testProperty.id)

          if (updateError) {
            if (updateError.message.includes("does not exist")) {
              log.push("Database columns don't exist - run migration first")
              log.push("See /api/test-apis for migration SQL")
            } else {
              log.push("Failed to save: " + updateError.message)
            }
          } else {
            log.push("Owner data saved successfully for " + testProperty.address)
          }
        }
      }
    } else {
      log.push("No titles found near property location")
    }

    // Summary
    const summary = {
      searchlandConfigured: true,
      searchlandApiKey: apiConfig.searchland.apiKey?.substring(0, 8) + "...",
      companiesHouseConfigured: companiesHouseEnabled,
      propertiesChecked: 1,
      titlesFound: titlesResponse.data?.length || 0,
      ownerDataFound: results.some(r => r.ownerData?.owner_name),
      testOnly,
    }

    return NextResponse.json({
      success: true,
      message: testOnly ? "API test completed" : "Owner enrichment completed",
      log,
      results,
      summary,
      correctEndpoints: {
        titlesSearch: "POST https://api.searchland.co.uk/v1/titles/search",
        titlesGet: "GET https://api.searchland.co.uk/v1/titles/get?titleNumber=X",
        hmoSearch: "GET https://api.searchland.co.uk/v1/hmo/search?lng=X&lat=Y",
      },
    })

  } catch (error) {
    log.push("Error: " + String(error))
    return NextResponse.json({ success: false, error: String(error), log }, { status: 500 })
  }
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
