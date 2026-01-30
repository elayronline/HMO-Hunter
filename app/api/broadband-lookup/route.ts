import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import fs from "fs"
import path from "path"
import readline from "readline"

// In-memory cache for CSV data (loaded on first request)
let broadbandCache: Map<string, BroadbandData> | null = null
let cacheLoading = false

interface BroadbandData {
  postcode: string
  sfbb_available: number
  ufbb_available: number
  gigabit_available: number
  below_uso: number
}

/**
 * GET /api/broadband-lookup?postcode=N76PA
 * Look up broadband availability for a postcode
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const postcode = searchParams.get("postcode")?.toUpperCase().replace(/\s+/g, "")

  if (!postcode) {
    return NextResponse.json({ error: "Postcode required" }, { status: 400 })
  }

  try {
    // Try Supabase first (faster if data imported)
    const { data: dbData, error } = await supabaseAdmin
      .from("broadband_coverage")
      .select("*")
      .eq("postcode", postcode)
      .single()

    if (dbData && !error) {
      return NextResponse.json({
        success: true,
        source: "database",
        data: {
          postcode: dbData.postcode,
          superfast_available: dbData.sfbb_available >= 80,
          ultrafast_available: dbData.ufbb_available >= 80,
          gigabit_available: dbData.gigabit_available >= 50,
          sfbb_percentage: dbData.sfbb_available,
          ufbb_percentage: dbData.ufbb_available,
          gigabit_percentage: dbData.gigabit_available,
          below_uso_percentage: dbData.below_uso,
          broadband_rating: getBroadbandRating(dbData.gigabit_available, dbData.ufbb_available, dbData.sfbb_available),
        },
      })
    }

    // Fallback to CSV file
    const csvData = await lookupFromCSV(postcode)

    if (csvData) {
      return NextResponse.json({
        success: true,
        source: "csv",
        data: {
          postcode: csvData.postcode,
          superfast_available: csvData.sfbb_available >= 80,
          ultrafast_available: csvData.ufbb_available >= 80,
          gigabit_available: csvData.gigabit_available >= 50,
          sfbb_percentage: csvData.sfbb_available,
          ufbb_percentage: csvData.ufbb_available,
          gigabit_percentage: csvData.gigabit_available,
          below_uso_percentage: csvData.below_uso,
          broadband_rating: getBroadbandRating(csvData.gigabit_available, csvData.ufbb_available, csvData.sfbb_available),
        },
      })
    }

    return NextResponse.json({
      success: false,
      error: "Postcode not found in broadband data",
    }, { status: 404 })

  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

function getBroadbandRating(gigabit: number, ufbb: number, sfbb: number): string {
  if (gigabit >= 80) return "Excellent"
  if (ufbb >= 80) return "Very Good"
  if (sfbb >= 80) return "Good"
  if (sfbb >= 50) return "Fair"
  return "Poor"
}

async function lookupFromCSV(postcode: string): Promise<BroadbandData | null> {
  // Load cache if not already loaded
  if (!broadbandCache && !cacheLoading) {
    await loadCSVCache()
  }

  // Wait for cache if loading
  while (cacheLoading) {
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return broadbandCache?.get(postcode) || null
}

async function loadCSVCache(): Promise<void> {
  cacheLoading = true
  broadbandCache = new Map()

  const csvPath = path.join(process.cwd(), "data/ofcom/broadband_simple.csv")

  if (!fs.existsSync(csvPath)) {
    console.log("Broadband CSV not found, cache will be empty")
    cacheLoading = false
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
          postcode,
          sfbb_available: parseFloat(sfbb) || 0,
          ufbb_available: parseFloat(ufbb) || 0,
          gigabit_available: parseFloat(gigabit) || 0,
          below_uso: parseFloat(uso) || 0,
        })
      }
    }

    console.log(`Loaded ${broadbandCache.size} postcodes into broadband cache`)
  } catch (error) {
    console.error("Error loading broadband CSV:", error)
  }

  cacheLoading = false
}

/**
 * POST /api/broadband-lookup
 * Bulk lookup for multiple postcodes
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const postcodes: string[] = body.postcodes || []

    if (!postcodes.length) {
      return NextResponse.json({ error: "Postcodes array required" }, { status: 400 })
    }

    const results: Record<string, any> = {}

    for (const pc of postcodes.slice(0, 100)) { // Limit to 100
      const normalized = pc.toUpperCase().replace(/\s+/g, "")
      const data = await lookupFromCSV(normalized)

      if (data) {
        results[pc] = {
          superfast_available: data.sfbb_available >= 80,
          ultrafast_available: data.ufbb_available >= 80,
          gigabit_available: data.gigabit_available >= 50,
          sfbb_percentage: data.sfbb_available,
          ufbb_percentage: data.ufbb_available,
          gigabit_percentage: data.gigabit_available,
          broadband_rating: getBroadbandRating(data.gigabit_available, data.ufbb_available, data.sfbb_available),
        }
      } else {
        results[pc] = null
      }
    }

    return NextResponse.json({
      success: true,
      count: Object.keys(results).filter(k => results[k]).length,
      results,
    })

  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
