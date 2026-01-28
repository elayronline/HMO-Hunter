import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

interface EPCCertificate {
  "lmk-key": string
  address1: string
  address2?: string
  address3?: string
  postcode: string
  "building-reference-number"?: string
  "current-energy-rating": string
  "potential-energy-rating": string
  "current-energy-efficiency": number
  "potential-energy-efficiency": number
  "property-type": string
  "built-form": string
  "inspection-date": string
  "lodgement-date": string
  "lodgement-datetime": string
  "total-floor-area": number
  "floor-level"?: string
  "floor-height"?: number
  "number-habitable-rooms"?: number
  "number-heated-rooms"?: number
  "main-heating-controls"?: string
  "low-energy-lighting"?: number
  "uprn"?: string
  "local-authority"?: string
  "constituency"?: string
}

interface EPCSearchResponse {
  "column-names": string[]
  rows: EPCCertificate[]
}

/**
 * Search EPC certificates by postcode
 */
async function searchEPCByPostcode(postcode: string, apiKey: string, email: string): Promise<EPCCertificate[]> {
  try {
    // Create Basic Auth header
    const credentials = Buffer.from(`${email}:${apiKey}`).toString("base64")

    const response = await fetch(
      `https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${encodeURIComponent(postcode)}&size=100`,
      {
        headers: {
          "Accept": "application/json",
          "Authorization": `Basic ${credentials}`,
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[EPC] API error: ${response.status} - ${errorText}`)
      return []
    }

    const data: EPCSearchResponse = await response.json()
    return data.rows || []
  } catch (error) {
    console.error("[EPC] Search error:", error)
    return []
  }
}

/**
 * Get EPC certificate by LMK key
 */
async function getEPCCertificate(lmkKey: string, apiKey: string, email: string): Promise<EPCCertificate | null> {
  try {
    const credentials = Buffer.from(`${email}:${apiKey}`).toString("base64")

    const response = await fetch(
      `https://epc.opendatacommunities.org/api/v1/domestic/certificate/${lmkKey}`,
      {
        headers: {
          "Accept": "application/json",
          "Authorization": `Basic ${credentials}`,
        },
      }
    )

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data.rows?.[0] || null
  } catch (error) {
    console.error("[EPC] Certificate fetch error:", error)
    return null
  }
}

/**
 * Convert EPC rating letter to numeric value
 */
function epcRatingToNumeric(rating: string): number {
  const ratings: Record<string, number> = {
    "A": 92, "B": 81, "C": 69, "D": 55, "E": 39, "F": 21, "G": 1
  }
  return ratings[rating?.toUpperCase()] || 0
}

/**
 * Generate EPC certificate URL for viewing floor plan
 * Uses postcode search URL since lmk-key format differs from gov.uk certificate IDs
 */
function getEPCCertificateUrl(postcode: string, address: string): string {
  const encodedPostcode = encodeURIComponent(postcode.trim())
  return `https://find-energy-certificate.service.gov.uk/find-a-certificate/search-by-postcode?postcode=${encodedPostcode}`
}

/**
 * Match property address to EPC certificate
 */
function findMatchingCertificate(
  address: string,
  certificates: EPCCertificate[]
): EPCCertificate | null {
  if (!certificates.length) return null

  // Normalize address for comparison
  const normalizeAddress = (addr: string) =>
    addr.toLowerCase()
      .replace(/[,.']/g, "")
      .replace(/\s+/g, " ")
      .trim()

  const normalizedPropertyAddress = normalizeAddress(address)

  // Try to find exact or close match
  for (const cert of certificates) {
    const certAddress = normalizeAddress(
      [cert.address1, cert.address2, cert.address3].filter(Boolean).join(" ")
    )

    // Check if addresses match closely
    if (certAddress.includes(normalizedPropertyAddress) ||
        normalizedPropertyAddress.includes(certAddress) ||
        certAddress === normalizedPropertyAddress) {
      return cert
    }

    // Check if house number matches
    const propertyNumber = normalizedPropertyAddress.match(/^(\d+[a-z]?)/)?.[1]
    const certNumber = certAddress.match(/^(\d+[a-z]?)/)?.[1]

    if (propertyNumber && certNumber && propertyNumber === certNumber) {
      return cert
    }
  }

  // If no match found, return the most recent certificate
  return certificates.sort((a, b) =>
    new Date(b["lodgement-date"]).getTime() - new Date(a["lodgement-date"]).getTime()
  )[0]
}

/**
 * POST /api/enrich-epc
 *
 * Enriches properties with EPC data including floor area and certificate links
 */
export async function POST(request: Request) {
  const log: string[] = []
  const updated: string[] = []
  const failed: string[] = []

  try {
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(body.limit || 20, 100)
    const city = body.city
    const propertyId = body.propertyId

    const apiKey = process.env.EPC_API_KEY
    const email = process.env.EPC_API_EMAIL

    if (!apiKey || !email) {
      return NextResponse.json({
        success: false,
        error: "EPC API credentials not configured",
        setupRequired: true,
        instructions: [
          "1. Register at https://epc.opendatacommunities.org/login",
          "2. Accept the terms and get your API key",
          "3. Add to .env.local:",
          "   EPC_API_KEY=your_api_key",
          "   EPC_API_EMAIL=your_registered_email",
        ],
        log,
      }, { status: 400 })
    }

    log.push("Starting EPC data enrichment...")

    // Fetch properties needing EPC data
    let query = supabaseAdmin
      .from("properties")
      .select("id, address, postcode, city, epc_rating, epc_certificate_url, gross_internal_area_sqm")
      .eq("is_stale", false)

    if (propertyId) {
      query = query.eq("id", propertyId)
    } else {
      if (city) {
        query = query.eq("city", city)
      }
      // Get properties without EPC data
      query = query.is("epc_certificate_url", null)
      query = query.limit(limit)
    }

    const { data: properties, error: fetchError } = await query

    if (fetchError) {
      return NextResponse.json({
        success: false,
        error: fetchError.message,
        log,
      }, { status: 500 })
    }

    if (!properties || properties.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No properties found needing EPC data",
        log,
        updated: [],
        failed: [],
      })
    }

    log.push(`Found ${properties.length} properties to enrich`)

    // Group by postcode for efficiency
    const postcodeGroups = new Map<string, typeof properties>()
    for (const property of properties) {
      const pc = property.postcode?.toUpperCase().replace(/\s+/g, " ").trim()
      if (pc) {
        if (!postcodeGroups.has(pc)) {
          postcodeGroups.set(pc, [])
        }
        postcodeGroups.get(pc)!.push(property)
      }
    }

    log.push(`Grouped into ${postcodeGroups.size} postcodes`)

    // Process each postcode
    for (const [postcode, props] of postcodeGroups) {
      try {
        log.push(`Searching EPC for postcode: ${postcode}`)

        const certificates = await searchEPCByPostcode(postcode, apiKey, email)

        if (certificates.length === 0) {
          log.push(`  No EPC certificates found for ${postcode}`)
          props.forEach(p => failed.push(p.address))
          continue
        }

        log.push(`  Found ${certificates.length} EPC certificates`)

        // Match each property to a certificate
        for (const property of props) {
          const matchedCert = findMatchingCertificate(property.address, certificates)

          if (matchedCert) {
            const epcRating = matchedCert["current-energy-rating"]?.toUpperCase() as "A" | "B" | "C" | "D" | "E" | "F" | "G"
            const floorArea = matchedCert["total-floor-area"]

            // Determine floor area band
            let floorAreaBand: "under_90" | "90_120" | "120_plus" | null = null
            if (floorArea) {
              if (floorArea < 90) {
                floorAreaBand = "under_90"
              } else if (floorArea <= 120) {
                floorAreaBand = "90_120"
              } else {
                floorAreaBand = "120_plus"
              }
            }

            // Update property
            const { error: updateError } = await supabaseAdmin
              .from("properties")
              .update({
                epc_rating: epcRating,
                epc_rating_numeric: epcRatingToNumeric(epcRating),
                epc_certificate_url: getEPCCertificateUrl(property.postcode, property.address),
                epc_expiry_date: matchedCert["lodgement-date"]
                  ? new Date(new Date(matchedCert["lodgement-date"]).getTime() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
                  : null,
                // Update floor area if not already set
                ...((!property.gross_internal_area_sqm && floorArea) && {
                  gross_internal_area_sqm: Math.round(floorArea),
                  floor_area_band: floorAreaBand,
                }),
                room_count: matchedCert["number-habitable-rooms"] || null,
              })
              .eq("id", property.id)

            if (updateError) {
              log.push(`  Failed to update ${property.address}: ${updateError.message}`)
              failed.push(property.address)
            } else {
              log.push(`  Updated: ${property.address} (EPC ${epcRating}, ${floorArea}sqm)`)
              updated.push(property.address)
            }
          } else {
            log.push(`  No matching certificate for: ${property.address}`)
            failed.push(property.address)
          }
        }

        // Rate limit - 1 request per second as per API guidelines
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error) {
        log.push(`  Error processing ${postcode}: ${error}`)
        props.forEach(p => failed.push(p.address))
      }
    }

    log.push("")
    log.push(`Completed: ${updated.length} enriched, ${failed.length} failed`)

    return NextResponse.json({
      success: true,
      message: `Enriched ${updated.length} properties with EPC data`,
      log,
      updated,
      failed,
      summary: {
        processed: properties.length,
        enriched: updated.length,
        failed: failed.length,
      },
    })

  } catch (error) {
    log.push("Error: " + String(error))
    return NextResponse.json({
      success: false,
      error: String(error),
      log,
    }, { status: 500 })
  }
}

/**
 * GET /api/enrich-epc
 */
export async function GET() {
  const apiKey = process.env.EPC_API_KEY
  const email = process.env.EPC_API_EMAIL
  const hasCredentials = !!apiKey && !!email

  // Check how many properties need EPC data
  const { data: properties } = await supabaseAdmin
    .from("properties")
    .select("id, epc_certificate_url")
    .eq("is_stale", false)
    .limit(500)

  const withEPC = properties?.filter(p => p.epc_certificate_url).length || 0
  const totalProperties = properties?.length || 0
  const needsEPC = totalProperties - withEPC

  return NextResponse.json({
    message: "POST to enrich properties with EPC data from the official UK register",
    description: "Fetches EPC rating, floor area, and certificate URL (for viewing floor plan)",
    configuration: {
      epcApiCredentials: hasCredentials ? "Configured" : "NOT CONFIGURED",
    },
    stats: {
      totalProperties,
      withEPC,
      needsEPC,
    },
    usage: {
      method: "POST",
      body: {
        limit: "Number of properties to process (default 20, max 100)",
        city: "Filter by city name",
        propertyId: "Enrich a specific property by ID",
      },
    },
    dataProvided: {
      epc_rating: "Energy rating A-G",
      epc_rating_numeric: "Numeric score 1-100",
      epc_certificate_url: "Link to view certificate (includes floor plan)",
      epc_expiry_date: "Certificate expiry date",
      gross_internal_area_sqm: "Floor area from EPC",
      room_count: "Number of habitable rooms",
    },
    floorPlanNote: "The EPC certificate URL links to the official certificate page where users can view and print the floor plan diagram",
    setupInstructions: !hasCredentials ? [
      "1. Register at https://epc.opendatacommunities.org/login",
      "2. Accept the Open Government Licence terms",
      "3. Your API key will be shown in your account footer",
      "4. Add to .env.local:",
      "   EPC_API_KEY=your_api_key",
      "   EPC_API_EMAIL=your_registered_email",
    ] : null,
  })
}
