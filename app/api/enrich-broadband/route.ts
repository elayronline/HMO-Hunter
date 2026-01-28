import { NextResponse } from "next/server"
import { apiConfig } from "@/lib/config/api-config"
import { OfcomBroadbandAdapter, checkBroadbandByPostcode } from "@/lib/ingestion/enrichment/ofcom-broadband"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/enrich-broadband
 *
 * Check Ofcom API status and configuration
 */
export async function GET() {
  const isConfigured = !!apiConfig.ofcom?.apiKey

  return NextResponse.json({
    message: "Ofcom Broadband API Integration",
    status: isConfigured ? "configured" : "not_configured",
    baseUrl: apiConfig.ofcom?.baseUrl || "https://api-proxy.ofcom.org.uk/broadband/coverage",
    signupUrl: "https://api.ofcom.org.uk",
    usage: {
      testPostcode: "POST with { postcode: 'SW1A1AA' }",
      enrichProperty: "POST with { propertyId: 'uuid' }",
      enrichBatch: "POST with { enrichCount: 10 }",
    },
    fields: {
      broadband_basic_down: "Basic broadband download speed (Mbps)",
      broadband_superfast_down: "Superfast broadband download speed (Mbps) - 30Mbps+",
      broadband_ultrafast_down: "Ultrafast/Fiber download speed (Mbps) - 100Mbps+",
      has_fiber: "Whether full fiber (FTTP) is available",
      has_superfast: "Whether superfast broadband is available",
    },
  })
}

/**
 * POST /api/enrich-broadband
 *
 * Test broadband lookup or enrich properties
 */
export async function POST(request: Request) {
  const log: string[] = []

  try {
    const body = await request.json()
    const { postcode, propertyId, enrichCount } = body

    if (!apiConfig.ofcom?.apiKey) {
      return NextResponse.json({
        success: false,
        error: "Ofcom API key not configured. Add OFCOM_API_KEY to .env.local",
        signupUrl: "https://api.ofcom.org.uk",
        log,
      }, { status: 400 })
    }

    // Mode 1: Test single postcode lookup
    if (postcode) {
      log.push(`Looking up broadband availability for: ${postcode}`)

      const data = await checkBroadbandByPostcode(postcode)

      if (!data || !data.Availability || data.Availability.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No broadband data found for this postcode",
          postcode,
          log,
        })
      }

      log.push(`Found ${data.Availability.length} addresses in postcode`)

      // Parse results
      const results = data.Availability.map(a => ({
        uprn: a.UPRN,
        address: a.AddressShortDescription,
        basicDown: a.MaxBbPredictedDown,
        superfastDown: a.MaxSfbbPredictedDown,
        ultrafastDown: a.MaxUfbbPredictedDown,
        maxDown: a.MaxPredictedDown,
        hasFiber: a.MaxUfbbPredictedDown > 0,
        hasSuperfast: a.MaxSfbbPredictedDown > 0,
        status: OfcomBroadbandAdapter.getBroadbandStatus({
          has_fiber: a.MaxUfbbPredictedDown > 0,
          has_superfast: a.MaxSfbbPredictedDown > 0,
          broadband_max_down: a.MaxPredictedDown,
        }),
      }))

      return NextResponse.json({
        success: true,
        message: `Found ${results.length} addresses`,
        postcode: data.PostCode,
        results,
        log,
      })
    }

    // Mode 2: Enrich single property by ID
    if (propertyId) {
      const supabase = await createClient()

      const { data: property, error: fetchError } = await supabase
        .from("properties")
        .select("id, address, postcode, uprn, has_fiber, broadband_max_down")
        .eq("id", propertyId)
        .single()

      if (fetchError || !property) {
        return NextResponse.json({
          success: false,
          error: fetchError?.message || "Property not found",
          log,
        }, { status: 404 })
      }

      log.push(`Enriching property: ${property.address}`)

      const adapter = new OfcomBroadbandAdapter()
      const enrichedData = await adapter.enrich({
        address: property.address,
        postcode: property.postcode,
        uprn: property.uprn,
      } as any)

      if (Object.keys(enrichedData).length === 0) {
        return NextResponse.json({
          success: true,
          message: "No broadband data available for this property",
          property: { id: property.id, address: property.address },
          log,
        })
      }

      // Update the property
      const { error: updateError } = await supabase
        .from("properties")
        .update(enrichedData)
        .eq("id", propertyId)

      if (updateError) {
        return NextResponse.json({
          success: false,
          error: updateError.message,
          log,
        }, { status: 500 })
      }

      log.push(`Updated with ${Object.keys(enrichedData).length} fields`)

      return NextResponse.json({
        success: true,
        message: "Property enriched with broadband data",
        property: { id: property.id, address: property.address },
        enrichedData,
        status: OfcomBroadbandAdapter.getBroadbandStatus(enrichedData as any),
        log,
      })
    }

    // Mode 3: Batch enrich properties
    if (enrichCount) {
      const supabase = await createClient()

      log.push(`Enriching up to ${enrichCount} properties with broadband data...`)

      // Find properties without broadband data
      const { data: properties, error: fetchError } = await supabase
        .from("properties")
        .select("id, address, postcode, uprn")
        .eq("is_stale", false)
        .is("has_fiber", null)
        .not("postcode", "is", null)
        .limit(enrichCount)

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
          message: "No properties need broadband enrichment",
          log,
        })
      }

      log.push(`Found ${properties.length} properties to enrich`)

      const adapter = new OfcomBroadbandAdapter()
      let enriched = 0
      let failed = 0
      let noData = 0

      for (const property of properties) {
        try {
          const enrichedData = await adapter.enrich({
            address: property.address,
            postcode: property.postcode,
            uprn: property.uprn,
          } as any)

          if (Object.keys(enrichedData).length > 0) {
            const { error: updateError } = await supabase
              .from("properties")
              .update(enrichedData)
              .eq("id", property.id)

            if (updateError) {
              log.push(`  ✗ ${property.address}: Update error - ${updateError.message}`)
              failed++
            } else {
              const status = OfcomBroadbandAdapter.getBroadbandStatus(enrichedData as any)
              log.push(`  ✓ ${property.address}: ${status.label} (${enrichedData.broadband_max_down || 0}Mbps)`)
              enriched++
            }
          } else {
            log.push(`  - ${property.address}: No data`)
            noData++
          }

          // Rate limiting - respect Ofcom's limits
          await new Promise(resolve => setTimeout(resolve, 100))

        } catch (error) {
          log.push(`  ✗ ${property.address}: ${error instanceof Error ? error.message : "Unknown error"}`)
          failed++
        }
      }

      log.push("")
      log.push(`Summary: ${enriched} enriched, ${noData} no data, ${failed} failed`)

      return NextResponse.json({
        success: true,
        message: `Enriched ${enriched} properties with broadband data`,
        log,
        summary: { enriched, noData, failed, total: properties.length },
      })
    }

    return NextResponse.json({
      success: false,
      error: "Provide 'postcode', 'propertyId', or 'enrichCount'",
      log,
    }, { status: 400 })

  } catch (error) {
    log.push(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      log,
    }, { status: 500 })
  }
}
