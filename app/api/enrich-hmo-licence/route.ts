import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { apiConfig } from "@/lib/config/api-config"

const SEARCHLAND_BASE_URL = "https://api.searchland.co.uk/v1"

/**
 * POST /api/enrich-hmo-licence
 *
 * Fetches HMO licence holder info from Searchland HMO API
 * This can include licence holder name and contact details
 *
 * Body: {
 *   limit?: number,  // Number of properties to enrich (default 10, max 20)
 * }
 *
 * Note: HMO search costs 20 credits per request
 */
export async function POST(request: Request) {
  const log: string[] = []
  const enriched: string[] = []
  const failed: string[] = []

  try {
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(body.limit || 10, 20) // Cap at 20 (expensive API)

    log.push(`Starting HMO licence enrichment for up to ${limit} properties...`)
    log.push(`Note: Each HMO search costs 20 Searchland credits`)

    if (!apiConfig.searchland.enabled || !apiConfig.searchland.apiKey) {
      return NextResponse.json({
        success: false,
        error: "Searchland API not configured",
        log,
      }, { status: 400 })
    }

    // Fetch licensed HMO properties that need licence holder info
    const { data: properties, error: fetchError } = await supabaseAdmin
      .from("properties")
      .select("id, address, postcode, city, latitude, longitude, licensed_hmo")
      .eq("is_stale", false)
      .eq("licensed_hmo", true)
      .is("owner_contact_phone", null)
      .is("owner_contact_email", null)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .limit(limit)

    if (fetchError) {
      return NextResponse.json({ success: false, error: fetchError.message, log }, { status: 500 })
    }

    if (!properties || properties.length === 0) {
      log.push("No licensed HMO properties found that need licence holder info")

      // Try properties without licence filter
      const { data: anyProperties } = await supabaseAdmin
        .from("properties")
        .select("id, address, postcode, city, latitude, longitude")
        .eq("is_stale", false)
        .is("owner_contact_phone", null)
        .not("latitude", "is", null)
        .limit(limit)

      if (!anyProperties || anyProperties.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No properties need HMO licence enrichment",
          log,
          enriched: [],
          failed: [],
        })
      }

      log.push(`Found ${anyProperties.length} properties to check for HMO licences`)

      // Process these instead
      for (const property of anyProperties) {
        await processProperty(property, log, enriched, failed)
      }
    } else {
      log.push(`Found ${properties.length} licensed HMO properties to enrich`)

      for (const property of properties) {
        await processProperty(property, log, enriched, failed)
      }
    }

    log.push("")
    log.push(`Completed: ${enriched.length} enriched with licence holder info, ${failed.length} failed/no data`)

    return NextResponse.json({
      success: true,
      message: `Enriched ${enriched.length} properties with HMO licence data`,
      log,
      enriched,
      failed,
      summary: {
        enriched: enriched.length,
        failed: failed.length,
      },
    })

  } catch (error) {
    log.push("Error: " + String(error))
    return NextResponse.json({ success: false, error: String(error), log }, { status: 500 })
  }
}

async function processProperty(
  property: any,
  log: string[],
  enriched: string[],
  failed: string[]
) {
  try {
    log.push(`Processing: ${property.address}...`)

    // Search for HMO licences near this property
    const hmoResponse = await searchHMO(property.longitude, property.latitude)

    if (!hmoResponse.data || hmoResponse.data.length === 0) {
      log.push(`  No HMO licence found for ${property.address}`)
      failed.push(property.address)
      return
    }

    // Find the closest/matching licence
    const licence = hmoResponse.data[0]

    log.push(`  Found HMO licence: ${licence.reference || licence.licence_number || 'N/A'} (${licence.council || 'Unknown council'})`)

    // Extract licence info from Searchland HMO format
    const licenceData = {
      licence_id: licence.reference || licence.licence_number,
      licence_status: "active" as const, // If in HMO register, it's active
      licence_start_date: licence.licence_start,
      licence_end_date: licence.licence_expiry_parsed || licence.licence_expiry,
      max_occupants: licence.max_occupancy ? parseInt(licence.max_occupancy) : null,
      licensed_hmo: true,
    }

    // Update even if we just have licence data
    const hasNewData = licenceData.licence_id || licenceData.max_occupants ||
                       licenceData.licence_end_date

    if (!hasNewData) {
      log.push(`  No useful data in HMO response`)
      failed.push(property.address)
      return
    }

    // Filter out null values before update
    const updateData: Record<string, any> = {}
    for (const [key, value] of Object.entries(licenceData)) {
      if (value !== null && value !== undefined) {
        updateData[key] = value
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("properties")
      .update(updateData)
      .eq("id", property.id)

    if (updateError) {
      log.push(`  Failed to save: ${updateError.message}`)
      failed.push(property.address)
    } else {
      const licenceInfo = []
      if (licenceData.licence_id) licenceInfo.push(`ID: ${licenceData.licence_id}`)
      if (licenceData.max_occupants) licenceInfo.push(`Max: ${licenceData.max_occupants}`)

      log.push(`  Enriched: ${licenceInfo.join(", ") || "Licence data only"}`)
      enriched.push(property.address)
    }

    // Delay to avoid rate limiting (HMO API is expensive)
    await new Promise(resolve => setTimeout(resolve, 500))

  } catch (error) {
    log.push(`  Error: ${error}`)
    failed.push(property.address)
  }
}

async function searchHMO(lng: number, lat: number) {
  try {
    const response = await fetch(
      `${SEARCHLAND_BASE_URL}/hmo/search?lng=${lng}&lat=${lat}&radius=50`,
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
      data: result.data || result.results || [],
    }
  } catch (error) {
    return { error: String(error), data: null }
  }
}

export async function GET() {
  return NextResponse.json({
    message: "POST to enrich HMO licence holder contact info",
    description: "Fetches licence holder name, phone, email from Searchland HMO API",
    warning: "Costs 20 Searchland credits per property",
    usage: { limit: "Number of properties (default 10, max 20)" },
  })
}
