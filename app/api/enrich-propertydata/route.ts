import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { apiConfig } from "@/lib/config/api-config"

/**
 * POST /api/enrich-propertydata
 * Enrich properties with PropertyData HMO register information
 */
export async function POST(request: Request) {
  const log: string[] = []
  const updated: string[] = []
  const failed: string[] = []

  try {
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(body.limit || 20, 100)
    const propertyId = body.propertyId

    if (!apiConfig.propertyData.enabled) {
      return NextResponse.json({
        success: false,
        error: "PropertyData API not configured. Add PROPERTYDATA_API_KEY to .env.local",
      }, { status: 400 })
    }

    log.push("Starting PropertyData HMO enrichment...")

    // Fetch properties needing enrichment
    let query = supabaseAdmin
      .from("properties")
      .select("id, address, postcode, city")
      .eq("is_stale", false)
      .not("postcode", "is", null)

    if (propertyId) {
      query = query.eq("id", propertyId)
    } else {
      query = query.is("propertydata_enriched_at", null).limit(limit)
    }

    const { data: properties, error: fetchError } = await query

    if (fetchError) {
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
    }

    if (!properties?.length) {
      return NextResponse.json({
        success: true,
        message: "No properties found needing PropertyData enrichment",
        log,
      })
    }

    log.push(`Found ${properties.length} properties to enrich`)

    // Group by postcode for efficiency
    const postcodeGroups = new Map<string, typeof properties>()
    for (const property of properties) {
      const pc = property.postcode?.toUpperCase().trim()
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
        log.push(`Fetching HMO data for postcode: ${postcode}`)

        const params = new URLSearchParams({
          key: apiConfig.propertyData.apiKey || "",
          postcode: postcode,
        })

        const response = await fetch(
          `${apiConfig.propertyData.baseUrl}/national-hmo-register?${params}`
        )

        if (!response.ok) {
          log.push(`  API error: ${response.status}`)
          // Mark as checked even on error
          for (const prop of props) {
            await supabaseAdmin
              .from("properties")
              .update({ propertydata_enriched_at: new Date().toISOString() })
              .eq("id", prop.id)
            failed.push(prop.address)
          }
          continue
        }

        const data = await response.json()
        const hmos = data.data?.hmos || []

        log.push(`  Found ${hmos.length} HMOs in register`)

        // Match and update each property
        for (const property of props) {
          const matched = findMatchingHMO(property, hmos)

          const updateData: any = {
            propertydata_enriched_at: new Date().toISOString(),
          }

          if (matched) {
            updateData.hmo_licence_reference = matched.reference
            updateData.hmo_licence_type = matched.licence_type
            updateData.hmo_council = matched.council

            // Parse expiry date
            if (matched.licence_expiry) {
              // Handle formats like "10th February 2027" or "24/02/2027" or "2027-02-24"
              const expiryStr = matched.licence_expiry
              if (expiryStr.match(/\d{1,2}(st|nd|rd|th)\s+\w+\s+\d{4}/)) {
                // Format: "10th February 2027"
                const parsed = new Date(expiryStr.replace(/(\d+)(st|nd|rd|th)/, "$1"))
                if (!isNaN(parsed.getTime())) {
                  updateData.hmo_licence_expiry = parsed.toISOString().split("T")[0]
                }
              } else if (expiryStr.includes("/")) {
                const [day, month, year] = expiryStr.split("/")
                updateData.hmo_licence_expiry = `${year}-${month}-${day}`
              } else {
                updateData.hmo_licence_expiry = expiryStr
              }
            }

            if (matched.occupancy) {
              updateData.hmo_max_occupancy = parseInt(matched.occupancy)
            }
            if (matched.number_of_rooms_providing_sleeping_accommodation) {
              updateData.hmo_sleeping_rooms = parseInt(matched.number_of_rooms_providing_sleeping_accommodation)
            }
            if (matched.number_of_shared_bathrooms) {
              updateData.hmo_shared_bathrooms = parseInt(matched.number_of_shared_bathrooms)
            }

            // Update licence status
            updateData.licence_status = "active"
            updateData.licensed_hmo = true

            log.push(`  Matched HMO: ${property.address} -> ${matched.reference}`)
          } else {
            log.push(`  No HMO match for: ${property.address}`)
          }

          const { error: updateError } = await supabaseAdmin
            .from("properties")
            .update(updateData)
            .eq("id", property.id)

          if (updateError) {
            log.push(`  Update failed: ${updateError.message}`)
            failed.push(property.address)
          } else {
            updated.push(property.address)
          }
        }

        // Rate limit - PropertyData has strict limits
        await new Promise(resolve => setTimeout(resolve, 1500))

      } catch (error) {
        log.push(`  Error: ${error}`)
        props.forEach(p => failed.push(p.address))
      }
    }

    return NextResponse.json({
      success: true,
      message: `Enriched ${updated.length} properties with PropertyData HMO data`,
      summary: { processed: properties.length, enriched: updated.length, failed: failed.length },
      log,
      updated,
      failed,
    })

  } catch (error) {
    return NextResponse.json({ success: false, error: String(error), log }, { status: 500 })
  }
}

function findMatchingHMO(property: any, hmos: any[]): any {
  const propAddress = property.address?.toLowerCase().replace(/[,.']/g, "").replace(/\s+/g, " ").trim()

  for (const hmo of hmos) {
    const hmoAddress = hmo.address?.toLowerCase().replace(/[,.']/g, "").replace(/\s+/g, " ").trim()

    if (!hmoAddress) continue

    // Exact match
    if (hmoAddress === propAddress) return hmo

    // Contains match
    if (hmoAddress.includes(propAddress) || propAddress.includes(hmoAddress)) {
      return hmo
    }

    // Number + street match
    const propParts = propAddress.split(" ")
    const hmoParts = hmoAddress.split(" ")

    const propNumber = propParts.find((p: string) => /^\d+[a-z]?$/.test(p))
    const hmoNumber = hmoParts.find((p: string) => /^\d+[a-z]?$/.test(p))

    if (propNumber && hmoNumber && propNumber === hmoNumber) {
      const commonWords = propParts.filter((w: string) => w.length > 3 && hmoParts.includes(w))
      if (commonWords.length >= 2) {
        return hmo
      }
    }
  }

  return null
}

export async function GET() {
  const hasKey = apiConfig.propertyData.enabled

  return NextResponse.json({
    message: "POST to enrich properties with PropertyData HMO register data",
    configured: hasKey,
    dataProvided: [
      "hmo_licence_reference - Official licence number",
      "hmo_licence_type - Mandatory/Additional/Selective",
      "hmo_licence_expiry - Expiry date",
      "hmo_council - Local authority",
      "hmo_max_occupancy - Maximum occupants",
      "hmo_sleeping_rooms - Number of bedrooms",
      "hmo_shared_bathrooms - Shared bathroom count",
      "licensed_hmo - Boolean flag",
      "licence_status - active/expired/none",
    ],
    usage: {
      method: "POST",
      body: {
        limit: "Number of properties (default 20, max 100)",
        propertyId: "Specific property ID to enrich",
      },
    },
  })
}
