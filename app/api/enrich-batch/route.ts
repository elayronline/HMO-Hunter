import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { apiConfig } from "@/lib/config/api-config"

const SEARCHLAND_BASE_URL = "https://api.searchland.co.uk/v1"

/**
 * POST /api/enrich-batch
 *
 * Batch enriches property owner data from Searchland Titles API
 *
 * Body: {
 *   limit?: number,  // Number of properties to enrich (default 10, max 50)
 * }
 */
export async function POST(request: Request) {
  const log: string[] = []
  const enriched: string[] = []
  const failed: string[] = []

  try {
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(body.limit || 10, 50) // Cap at 50 to avoid API abuse

    log.push(`Starting batch enrichment for up to ${limit} properties...`)

    if (!apiConfig.searchland.enabled || !apiConfig.searchland.apiKey) {
      return NextResponse.json({
        success: false,
        error: "Searchland API not configured",
        log,
      }, { status: 400 })
    }

    // Fetch properties without owner data
    const { data: properties, error: fetchError } = await supabaseAdmin
      .from("properties")
      .select("id, address, postcode, city, latitude, longitude")
      .eq("is_stale", false)
      .is("owner_name", null)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .limit(limit)

    if (fetchError) {
      return NextResponse.json({ success: false, error: fetchError.message, log }, { status: 500 })
    }

    if (!properties || properties.length === 0) {
      log.push("No properties found that need enrichment")
      return NextResponse.json({
        success: true,
        message: "All properties already have owner data",
        log,
        enriched: [],
        failed: [],
      })
    }

    log.push(`Found ${properties.length} properties to enrich`)

    // Process each property
    for (const property of properties) {
      try {
        log.push(`Processing: ${property.address}...`)

        // Search for titles near the property
        const titlesResponse = await searchTitles(property.longitude, property.latitude)

        if (!titlesResponse.data || titlesResponse.data.length === 0) {
          log.push(`  No titles found for ${property.address}`)
          failed.push(property.address)
          continue
        }

        // Get full title details
        const titleNumber = titlesResponse.data[0].title_no
        const titleDetails = await getTitleDetails(titleNumber)

        if (!titleDetails.data) {
          log.push(`  Could not get title details for ${property.address}`)
          failed.push(property.address)
          continue
        }

        // Extract owner data
        const ownerData = extractOwnerData(titleDetails.data)

        // Save to database
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
          log.push(`  Failed to save ${property.address}: ${updateError.message}`)
          failed.push(property.address)
        } else {
          log.push(`  Enriched: ${ownerData.owner_name || ownerData.ownership_category} (${ownerData.owner_type})`)
          enriched.push(property.address)
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200))

      } catch (error) {
        log.push(`  Error processing ${property.address}: ${error}`)
        failed.push(property.address)
      }
    }

    log.push("")
    log.push(`Completed: ${enriched.length} enriched, ${failed.length} failed`)

    return NextResponse.json({
      success: true,
      message: `Enriched ${enriched.length} properties`,
      log,
      enriched,
      failed,
      summary: {
        total: properties.length,
        enriched: enriched.length,
        failed: failed.length,
      },
    })

  } catch (error) {
    log.push("Error: " + String(error))
    return NextResponse.json({ success: false, error: String(error), log }, { status: 500 })
  }
}

async function searchTitles(lng: number, lat: number) {
  try {
    const offset = 0.0005
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
      body: JSON.stringify({ geometry, page: 1, perPage: 5 }),
    })

    if (!response.ok) return { data: null }

    const result = await response.json()
    return { data: result.data || [] }
  } catch {
    return { data: null }
  }
}

async function getTitleDetails(titleNumber: string) {
  try {
    const response = await fetch(
      `${SEARCHLAND_BASE_URL}/titles/get?titleNumber=${encodeURIComponent(titleNumber)}`,
      { headers: { "Authorization": `Bearer ${apiConfig.searchland.apiKey}` } }
    )

    if (!response.ok) return { data: null }

    const result = await response.json()
    return { data: result.data || null }
  } catch {
    return { data: null }
  }
}

function extractOwnerData(title: any) {
  const proprietor = title.proprietor?.[0] || {}

  let ownerType: string = "unknown"
  const ownershipCategory = title.ownership_category?.toLowerCase() || ""
  const proprietorCategory = proprietor.proprietorship_category?.toLowerCase() || ""

  if (ownershipCategory.includes("company") || ownershipCategory.includes("corporate") || proprietorCategory.includes("company") || proprietorCategory.includes("limited")) {
    ownerType = "company"
  } else if (ownershipCategory.includes("housing association")) {
    ownerType = "company"
  } else if (ownershipCategory.includes("government") || ownershipCategory.includes("council")) {
    ownerType = "government"
  } else if (ownershipCategory.includes("private")) {
    ownerType = "individual"
  } else if (proprietor.company_registration_no) {
    ownerType = "company"
  }

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
    ownership_category: title.ownership_category,
  }
}

export async function GET() {
  return NextResponse.json({
    message: "POST to batch enrich property owner data",
    usage: { limit: "Number of properties to enrich (default 10, max 50)" },
  })
}
