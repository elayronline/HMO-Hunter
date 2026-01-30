import { NextResponse } from "next/server"
import { apiConfig } from "@/lib/config/api-config"
import { supabaseAdmin } from "@/lib/supabase-admin"
import fs from "fs"
import path from "path"
import readline from "readline"

// In-memory cache for OFCOM CSV data
let broadbandCache: Map<string, BroadbandData> | null = null
let cacheLoaded = false

interface BroadbandData {
  sfbb_available: number
  ufbb_available: number
  gigabit_available: number
  below_uso: number
}

/**
 * GET /api/enrich-broadband
 *
 * Check broadband data status
 */
export async function GET() {
  const csvPath = path.join(process.cwd(), "data/ofcom/broadband_simple.csv")
  const hasLocalData = fs.existsSync(csvPath)

  return NextResponse.json({
    message: "Broadband Enrichment - OFCOM Connected Nations 2024",
    source: hasLocalData ? "local_csv" : "not_available",
    postcodes: broadbandCache?.size || "not loaded",
    usage: {
      testPostcode: "POST with { postcode: 'SW1A1AA' }",
      enrichProperty: "POST with { propertyId: 'uuid' }",
      enrichBatch: "POST with { limit: 50 }",
    },
    fields: {
      broadband_max_down: "Estimated max download speed (Mbps)",
      broadband_max_up: "Estimated max upload speed (Mbps)",
      has_fiber: "Whether fiber is available",
      has_superfast: "Whether superfast (30Mbit+) is available",
      broadband_superfast_down: "% premises with superfast",
      broadband_ultrafast_down: "% premises with ultrafast",
    },
  })
}

/**
 * POST /api/enrich-broadband
 *
 * Enrich properties with OFCOM broadband coverage data (free, no API key needed)
 */
export async function POST(request: Request) {
  const log: string[] = []
  const updated: string[] = []
  const failed: string[] = []

  try {
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(body.limit || body.enrichCount || 50, 500)
    const propertyId = body.propertyId
    const postcode = body.postcode

    log.push("Starting broadband enrichment (OFCOM Connected Nations 2024)...")

    // Load CSV cache if not already loaded
    if (!cacheLoaded) {
      await loadCSVCache()
      log.push(`Loaded ${broadbandCache?.size || 0} postcodes into cache`)
    }

    // Mode 1: Single postcode lookup
    if (postcode) {
      const normalized = postcode.toUpperCase().replace(/\s+/g, "")
      const data = broadbandCache?.get(normalized)

      if (data) {
        return NextResponse.json({
          success: true,
          postcode: normalized,
          data: {
            superfast_available: data.sfbb_available >= 80,
            ultrafast_available: data.ufbb_available >= 80,
            gigabit_available: data.gigabit_available >= 50,
            sfbb_percentage: data.sfbb_available,
            ufbb_percentage: data.ufbb_available,
            gigabit_percentage: data.gigabit_available,
            below_uso_percentage: data.below_uso,
            rating: getBroadbandRating(data.gigabit_available, data.ufbb_available, data.sfbb_available),
          },
        })
      } else {
        return NextResponse.json({
          success: false,
          error: `No data for postcode: ${normalized}`,
        }, { status: 404 })
      }
    }

    // Fetch properties needing enrichment
    let query = supabaseAdmin
      .from("properties")
      .select("id, address, postcode")
      .eq("is_stale", false)
      .not("postcode", "is", null)

    if (propertyId) {
      query = query.eq("id", propertyId)
    } else {
      query = query.is("broadband_last_checked", null).limit(limit)
    }

    const { data: properties, error: fetchError } = await query

    if (fetchError) {
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
    }

    if (!properties?.length) {
      return NextResponse.json({
        success: true,
        message: "No properties found needing broadband enrichment",
        log,
      })
    }

    log.push(`Found ${properties.length} properties to enrich`)

    for (const property of properties) {
      const pc = property.postcode?.toUpperCase().replace(/\s+/g, "")

      if (!pc) {
        failed.push(property.address)
        continue
      }

      const data = broadbandCache?.get(pc)

      const updateData: any = {
        broadband_last_checked: new Date().toISOString(),
      }

      if (data) {
        // Determine max speeds based on availability percentages
        if (data.gigabit_available >= 50) {
          updateData.broadband_max_down = 1000
          updateData.broadband_max_up = 100
          updateData.has_fiber = true
          updateData.has_superfast = true
        } else if (data.ufbb_available >= 50) {
          updateData.broadband_max_down = 300
          updateData.broadband_max_up = 50
          updateData.has_fiber = true
          updateData.has_superfast = true
        } else if (data.sfbb_available >= 50) {
          updateData.broadband_max_down = 80
          updateData.broadband_max_up = 20
          updateData.has_fiber = data.ufbb_available > 0
          updateData.has_superfast = true
        } else {
          updateData.broadband_max_down = 24
          updateData.broadband_max_up = 3
          updateData.has_fiber = false
          updateData.has_superfast = false
        }

        updateData.broadband_superfast_down = data.sfbb_available
        updateData.broadband_ultrafast_down = data.ufbb_available

        log.push(`  ${property.address}: ${updateData.broadband_max_down}Mbps, fiber=${updateData.has_fiber}`)
        updated.push(property.address)
      } else {
        log.push(`  ${property.address}: No data for ${pc}`)
        failed.push(property.address)
      }

      await supabaseAdmin
        .from("properties")
        .update(updateData)
        .eq("id", property.id)
    }

    return NextResponse.json({
      success: true,
      message: `Enriched ${updated.length} properties with broadband data`,
      summary: { processed: properties.length, enriched: updated.length, failed: failed.length },
      log,
      updated,
      failed,
    })

  } catch (error) {
    return NextResponse.json({ success: false, error: String(error), log }, { status: 500 })
  }
}

function getBroadbandRating(gigabit: number, ufbb: number, sfbb: number): string {
  if (gigabit >= 80) return "Excellent"
  if (ufbb >= 80) return "Very Good"
  if (sfbb >= 80) return "Good"
  if (sfbb >= 50) return "Fair"
  return "Poor"
}

async function loadCSVCache(): Promise<void> {
  broadbandCache = new Map()

  const csvPath = path.join(process.cwd(), "data/ofcom/broadband_simple.csv")

  if (!fs.existsSync(csvPath)) {
    console.log("Broadband CSV not found at:", csvPath)
    cacheLoaded = true
    return
  }

  try {
    const fileStream = fs.createReadStream(csvPath)
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    })

    let isFirstLine = true
    for await (const line of rl) {
      if (isFirstLine) {
        isFirstLine = false
        continue
      }

      const [postcode, sfbb, ufbb, gigabit, uso] = line.split(",")
      if (postcode) {
        broadbandCache.set(postcode, {
          sfbb_available: parseFloat(sfbb) || 0,
          ufbb_available: parseFloat(ufbb) || 0,
          gigabit_available: parseFloat(gigabit) || 0,
          below_uso: parseFloat(uso) || 0,
        })
      }
    }

    console.log(`Broadband cache loaded: ${broadbandCache.size} postcodes`)
    cacheLoaded = true
  } catch (error) {
    console.error("Error loading broadband CSV:", error)
    cacheLoaded = true
  }
}
