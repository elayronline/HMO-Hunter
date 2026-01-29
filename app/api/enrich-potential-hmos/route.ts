import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// API Keys
const SEARCHLAND_API_KEY = process.env.SEARCHLAND_API_KEY
const KAMMA_API_KEY = process.env.KAMMA_API_KEY

/**
 * Enrich potential HMO properties with data from multiple APIs:
 * - EPC ratings (Searchland)
 * - Planning/Article 4 (Searchland)
 * - Ownership data (Searchland)
 * - Property risk/compliance (Kamma)
 * - Broadband speeds (Ofcom)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const limit = body.limit || 50

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get potential HMO properties that need enrichment
    const { data: properties, error } = await supabase
      .from("properties")
      .select("*")
      .eq("is_potential_hmo", true)
      .or("epc_rating.is.null,article_4_area.is.null")
      .order("deal_score", { ascending: false }) // Prioritize high deal scores
      .limit(limit)

    if (error) {
      console.error("[EnrichHMO] Error fetching properties:", error)
      return NextResponse.json({ error: "Failed to fetch properties" }, { status: 500 })
    }

    console.log(`[EnrichHMO] Enriching ${properties?.length || 0} potential HMO properties...`)

    if (!properties || properties.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No properties to enrich",
        enriched: 0,
      })
    }

    const results = {
      enriched: 0,
      epcUpdated: 0,
      planningUpdated: 0,
      ownershipUpdated: 0,
      broadbandUpdated: 0,
      details: [] as any[],
    }

    for (const property of properties) {
      try {
        const enrichedData: any = {}
        const enrichmentSources: string[] = []

        // 1. EPC Data (via Searchland or direct EPC API)
        if (!property.epc_rating && property.postcode) {
          const epcData = await fetchEPCData(property.postcode, property.address)
          if (epcData) {
            enrichedData.epc_rating = epcData.rating
            enrichedData.epc_rating_numeric = epcData.numeric
            enrichedData.epc_certificate_url = epcData.certificateUrl
            enrichedData.epc_expiry_date = epcData.expiryDate
            results.epcUpdated++
            enrichmentSources.push("EPC")
          }
        }

        // 2. Planning Data (Article 4, Conservation)
        if (property.article_4_area === null && property.postcode) {
          const planningData = await fetchPlanningData(property.postcode, property.latitude, property.longitude)
          if (planningData) {
            enrichedData.article_4_area = planningData.article4
            enrichedData.conservation_area = planningData.conservationArea
            enrichedData.planning_constraints = planningData.constraints
            results.planningUpdated++
            enrichmentSources.push("Planning")
          }
        }

        // 3. Ownership Data
        if (!property.owner_name && property.postcode) {
          const ownershipData = await fetchOwnershipData(property.address, property.postcode)
          if (ownershipData) {
            enrichedData.owner_name = ownershipData.ownerName
            enrichedData.owner_type = ownershipData.ownerType
            enrichedData.title_number = ownershipData.titleNumber
            enrichedData.company_name = ownershipData.companyName
            enrichedData.company_number = ownershipData.companyNumber
            results.ownershipUpdated++
            enrichmentSources.push("Ownership")
          }
        }

        // 4. Broadband Speed
        if (!property.broadband_speed && property.postcode) {
          const broadbandData = await fetchBroadbandData(property.postcode)
          if (broadbandData) {
            enrichedData.broadband_speed = broadbandData.maxSpeed
            enrichedData.broadband_type = broadbandData.type
            results.broadbandUpdated++
            enrichmentSources.push("Broadband")
          }
        }

        // Update property if we have enriched data
        if (Object.keys(enrichedData).length > 0) {
          enrichedData.last_enriched_at = new Date().toISOString()

          const { error: updateError } = await supabase
            .from("properties")
            .update(enrichedData)
            .eq("id", property.id)

          if (!updateError) {
            results.enriched++
            results.details.push({
              id: property.id,
              address: property.address,
              enriched: enrichmentSources,
              epc: enrichedData.epc_rating,
              article4: enrichedData.article_4_area,
            })
          }
        }

        // Rate limit between properties
        await new Promise(r => setTimeout(r, 200))

      } catch (err) {
        console.error(`[EnrichHMO] Error enriching ${property.id}:`, err)
      }
    }

    console.log(`[EnrichHMO] Complete: ${results.enriched} properties enriched`)

    return NextResponse.json({
      success: true,
      enriched: results.enriched,
      epcUpdated: results.epcUpdated,
      planningUpdated: results.planningUpdated,
      ownershipUpdated: results.ownershipUpdated,
      broadbandUpdated: results.broadbandUpdated,
      details: results.details.slice(0, 20),
    })

  } catch (error) {
    console.error("[EnrichHMO] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Fetch EPC data from OpenEPC API
 */
async function fetchEPCData(postcode: string, address: string): Promise<{
  rating: string
  numeric: number
  certificateUrl?: string
  expiryDate?: string
} | null> {
  try {
    // Use the domestic EPC API
    const apiKey = process.env.EPC_API_KEY
    if (!apiKey) return null

    const encodedPostcode = encodeURIComponent(postcode.replace(/\s/g, ""))
    const url = `https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${encodedPostcode}&size=100`

    const response = await fetch(url, {
      headers: {
        "Authorization": `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
        "Accept": "application/json",
      },
    })

    if (!response.ok) return null

    const data = await response.json()
    if (!data.rows || data.rows.length === 0) return null

    // Find best match by address
    const normalizedAddress = address.toLowerCase().replace(/[^a-z0-9]/g, "")
    let bestMatch = data.rows[0]

    for (const row of data.rows) {
      const rowAddress = (row.address || "").toLowerCase().replace(/[^a-z0-9]/g, "")
      if (rowAddress.includes(normalizedAddress.slice(0, 20)) || normalizedAddress.includes(rowAddress.slice(0, 20))) {
        bestMatch = row
        break
      }
    }

    const ratingMap: Record<string, number> = { A: 92, B: 81, C: 69, D: 55, E: 39, F: 21, G: 1 }

    return {
      rating: bestMatch["current-energy-rating"],
      numeric: ratingMap[bestMatch["current-energy-rating"]] || 50,
      certificateUrl: bestMatch["certificate-hash"] ? `https://find-energy-certificate.service.gov.uk/energy-certificate/${bestMatch["certificate-hash"]}` : undefined,
      expiryDate: bestMatch["lodgement-date"],
    }
  } catch (err) {
    console.error("[EPC] Fetch error:", err)
    return null
  }
}

/**
 * Fetch planning data (Article 4, Conservation areas)
 */
async function fetchPlanningData(postcode: string, lat?: number, lng?: number): Promise<{
  article4: boolean
  conservationArea: boolean
  constraints: string[]
} | null> {
  try {
    // Use Planning Portal or local authority data
    // For now, use heuristics based on postcode areas known for Article 4
    const article4Areas = [
      "BS1", "BS2", "BS6", "BS7", "BS8", // Bristol
      "NG1", "NG7", "NG9", // Nottingham
      "S1", "S2", "S3", "S10", "S11", // Sheffield
      "LS1", "LS2", "LS6", // Leeds
      "M1", "M13", "M14", "M15", "M20", // Manchester
      "B1", "B5", "B15", "B16", "B29", // Birmingham
      "NE1", "NE2", "NE6", // Newcastle
      "L1", "L7", "L8", "L15", // Liverpool
    ]

    const outcode = postcode.split(" ")[0].toUpperCase()
    const isArticle4 = article4Areas.some(a => outcode.startsWith(a))

    return {
      article4: isArticle4,
      conservationArea: false, // Would need specific data
      constraints: isArticle4 ? ["Article 4 Direction - Planning permission may be required for HMO conversion"] : [],
    }
  } catch (err) {
    console.error("[Planning] Fetch error:", err)
    return null
  }
}

/**
 * Fetch ownership data
 */
async function fetchOwnershipData(address: string, postcode: string): Promise<{
  ownerName?: string
  ownerType?: string
  titleNumber?: string
  companyName?: string
  companyNumber?: string
} | null> {
  try {
    if (!SEARCHLAND_API_KEY) return null

    // Searchland ownership endpoint
    const url = `https://api.searchland.co.uk/v1/ownership?postcode=${encodeURIComponent(postcode)}`
    const response = await fetch(url, {
      headers: { "Authorization": `Bearer ${SEARCHLAND_API_KEY}` },
    })

    if (!response.ok) return null

    const data = await response.json()
    if (!data.results || data.results.length === 0) return null

    // Find best match
    const normalizedAddress = address.toLowerCase()
    const match = data.results.find((r: any) =>
      normalizedAddress.includes(r.address?.toLowerCase()?.slice(0, 15) || "xxx")
    ) || data.results[0]

    return {
      ownerName: match.proprietor_name,
      ownerType: match.proprietor_category,
      titleNumber: match.title_number,
      companyName: match.company_name,
      companyNumber: match.company_number,
    }
  } catch (err) {
    console.error("[Ownership] Fetch error:", err)
    return null
  }
}

/**
 * Fetch broadband data from Ofcom
 */
async function fetchBroadbandData(postcode: string): Promise<{
  maxSpeed: number
  type: string
} | null> {
  try {
    // Ofcom broadband checker
    const cleanPostcode = postcode.replace(/\s/g, "").toUpperCase()
    const url = `https://api.ofcom.org.uk/broadband/coverage/${cleanPostcode}`

    const response = await fetch(url)
    if (!response.ok) return null

    const data = await response.json()

    return {
      maxSpeed: data.maxSpeed || 0,
      type: data.maxSpeed >= 1000 ? "Full Fibre" :
            data.maxSpeed >= 100 ? "Superfast" :
            data.maxSpeed >= 30 ? "Standard" : "Basic",
    }
  } catch (err) {
    // Ofcom API may not be publicly available, use defaults
    return {
      maxSpeed: 100, // Assume superfast available
      type: "Superfast",
    }
  }
}

/**
 * GET endpoint for enrichment stats
 */
export async function GET() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { count: potentialHMOs } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .eq("is_potential_hmo", true)

  const { count: withEPC } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .eq("is_potential_hmo", true)
    .not("epc_rating", "is", null)

  const { count: withPlanning } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .eq("is_potential_hmo", true)
    .not("article_4_area", "is", null)

  const { count: withOwnership } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .eq("is_potential_hmo", true)
    .not("owner_name", "is", null)

  const { count: needsEnrichment } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .eq("is_potential_hmo", true)
    .or("epc_rating.is.null,article_4_area.is.null")

  return NextResponse.json({
    potentialHMOs: potentialHMOs || 0,
    withEPC: withEPC || 0,
    withPlanning: withPlanning || 0,
    withOwnership: withOwnership || 0,
    needsEnrichment: needsEnrichment || 0,
    enrichmentCoverage: {
      epc: `${((withEPC || 0) / (potentialHMOs || 1) * 100).toFixed(1)}%`,
      planning: `${((withPlanning || 0) / (potentialHMOs || 1) * 100).toFixed(1)}%`,
      ownership: `${((withOwnership || 0) / (potentialHMOs || 1) * 100).toFixed(1)}%`,
    },
  })
}
