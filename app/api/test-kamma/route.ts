import { NextResponse } from "next/server"
import { apiConfig } from "@/lib/config/api-config"
import { KammaEnrichmentAdapter, checkPropertyWithKamma } from "@/lib/ingestion/enrichment/kamma"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * GET /api/test-kamma
 *
 * Check Kamma API status and configuration
 */
export async function GET() {
  const isConfigured = !!apiConfig.kamma?.apiKey

  return NextResponse.json({
    message: "Kamma API Integration",
    status: isConfigured ? "configured" : "not_configured",
    baseUrl: apiConfig.kamma?.baseUrl || "https://kamma.api.kammadata.com",
    endpoints: apiConfig.kamma?.endpoints || {},
    usage: {
      testProperty: "POST with { address: '123 High Street', postcode: 'SW1A 1AA' }",
      testUprn: "POST with { uprn: '12345678901' }",
      enrichProperties: "POST with { enrichCount: 10 } to enrich database properties",
    },
    documentation: "https://kamma.api.kammadata.com/docs/",
  })
}

/**
 * POST /api/test-kamma
 *
 * Test Kamma API with a specific property or enrich database properties
 */
export async function POST(request: Request) {
  const log: string[] = []

  try {
    const body = await request.json()
    const { address, postcode, uprn, enrichCount } = body

    if (!apiConfig.kamma?.apiKey) {
      return NextResponse.json({
        success: false,
        error: "Kamma API key not configured. Add KAMMA_API_KEY to .env.local",
        log,
      }, { status: 400 })
    }

    // Mode 1: Enrich existing database properties
    if (enrichCount) {
      log.push(`Enriching up to ${enrichCount} properties with Kamma data...`)

      const { data: properties, error: fetchError } = await supabaseAdmin
        .from("properties")
        .select("id, address, postcode, uprn, licence_status, article_4_area")
        .eq("is_stale", false)
        .or("licence_status.is.null,article_4_area.is.null")
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
          message: "No properties need Kamma enrichment",
          log,
        })
      }

      log.push(`Found ${properties.length} properties to enrich`)

      const adapter = new KammaEnrichmentAdapter()
      let enriched = 0
      let failed = 0

      for (const property of properties) {
        try {
          const enrichedData = await adapter.enrich({
            address: property.address,
            postcode: property.postcode,
            uprn: property.uprn,
          } as any)

          if (Object.keys(enrichedData).length > 0) {
            const { error: updateError } = await supabaseAdmin
              .from("properties")
              .update(enrichedData)
              .eq("id", property.id)

            if (updateError) {
              log.push(`  ✗ ${property.address}: Update error - ${updateError.message}`)
              failed++
            } else {
              log.push(`  ✓ ${property.address}: Enriched with ${Object.keys(enrichedData).length} fields`)
              enriched++
            }
          } else {
            log.push(`  - ${property.address}: No data returned`)
          }

          // Rate limiting - 1 second between requests
          await new Promise(resolve => setTimeout(resolve, 1000))

        } catch (error) {
          log.push(`  ✗ ${property.address}: ${error instanceof Error ? error.message : "Unknown error"}`)
          failed++
        }
      }

      log.push("")
      log.push(`Summary: ${enriched} enriched, ${failed} failed`)

      return NextResponse.json({
        success: true,
        message: `Enriched ${enriched} properties`,
        log,
        summary: { enriched, failed, total: properties.length },
      })
    }

    // Mode 2: Test single property lookup
    if (!uprn && (!address || !postcode)) {
      return NextResponse.json({
        success: false,
        error: "Provide either 'uprn' or both 'address' and 'postcode'",
        log,
      }, { status: 400 })
    }

    // Format identifier according to Kamma API spec
    let propertyIdentifier: string
    if (uprn) {
      propertyIdentifier = `geoplace:uprn:${uprn}`
    } else {
      // kamma:address:address+parts+postcode
      const fullAddress = `${address} ${postcode}`
      propertyIdentifier = `kamma:address:${fullAddress.replace(/\s+/g, "+").toLowerCase()}`
    }

    log.push(`Testing Kamma API with: ${propertyIdentifier}`)

    const results = await checkPropertyWithKamma(propertyIdentifier)

    log.push("")
    log.push("API Responses:")
    log.push(`  - Licensing Check: ${results.licensing ? "Data received" : "No data"}`)
    log.push(`  - Determination Check: ${results.determination ? "Data received" : "No data"}`)
    log.push(`  - EPC Check: ${results.epc ? "Data received" : "No data"}`)

    // Parse into property fields
    const adapter = new KammaEnrichmentAdapter()
    const enrichedData = await adapter.enrich({
      address: address || "",
      postcode: postcode || "",
      uprn: uprn,
    } as any)

    return NextResponse.json({
      success: true,
      message: "Kamma API test complete",
      propertyIdentifier,
      rawResponses: {
        licensing: results.licensing,
        determination: results.determination,
        epc: results.epc,
      },
      parsedFields: enrichedData,
      log,
    })

  } catch (error) {
    log.push(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      log,
    }, { status: 500 })
  }
}
