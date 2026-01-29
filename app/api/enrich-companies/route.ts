import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { CompaniesHouseAdapter } from "@/lib/ingestion/enrichment/companies-house"
import { apiConfig } from "@/lib/config/api-config"

/**
 * POST /api/enrich-companies
 *
 * Enriches properties that have company_number but missing directors
 * by calling the Companies House API
 *
 * Body: {
 *   propertyId?: string,  // Enrich a specific property
 *   limit?: number,       // Limit properties to enrich (default 10)
 *   testOnly?: boolean    // Just test without saving
 * }
 */
export async function POST(request: Request) {
  const log: string[] = []
  const results: any[] = []

  try {
    const body = await request.json().catch(() => ({}))
    const { propertyId, limit = 10, testOnly = false } = body

    log.push("[1/4] Checking Companies House API configuration...")

    if (!apiConfig.companiesHouse.enabled || !apiConfig.companiesHouse.apiKey) {
      return NextResponse.json({
        success: false,
        error: "Companies House API not configured",
        recommendation: "Add COMPANIES_HOUSE_API_KEY to .env.local",
        log,
      }, { status: 400 })
    }

    log.push("Companies House API configured: " + apiConfig.companiesHouse.apiKey.substring(0, 8) + "...")

    log.push("[2/4] Finding properties with company_number but no directors...")

    // Find properties that have company_number but no directors
    let query = supabaseAdmin
      .from("properties")
      .select("id, address, postcode, city, company_name, company_number, directors, owner_name, owner_type")
      .or("is_stale.eq.false,is_stale.is.null")
      .not("company_number", "is", null)

    if (propertyId) {
      query = query.eq("id", propertyId)
    } else {
      // Only get properties where directors is null or empty array
      query = query.or("directors.is.null,directors.eq.[]")
    }

    const { data: properties, error: fetchError } = await query.limit(limit)

    if (fetchError) {
      log.push("Database error: " + fetchError.message)
      return NextResponse.json({ success: false, error: fetchError.message, log }, { status: 500 })
    }

    if (!properties || properties.length === 0) {
      log.push("No properties found that need Companies House enrichment")

      // Check how many properties have company_number total
      const { count: withCompanyNumber } = await supabaseAdmin
        .from("properties")
        .select("*", { count: "exact", head: true })
        .or("is_stale.eq.false,is_stale.is.null")
        .not("company_number", "is", null)

      const { count: withDirectors } = await supabaseAdmin
        .from("properties")
        .select("*", { count: "exact", head: true })
        .or("is_stale.eq.false,is_stale.is.null")
        .not("directors", "is", null)

      return NextResponse.json({
        success: true,
        message: "No properties need enrichment",
        stats: {
          propertiesWithCompanyNumber: withCompanyNumber,
          propertiesWithDirectors: withDirectors,
        },
        log,
        results: [],
      })
    }

    log.push(`Found ${properties.length} properties to enrich`)

    log.push("[3/4] Calling Companies House API...")

    const adapter = new CompaniesHouseAdapter()
    let enrichedCount = 0
    let errorCount = 0

    for (const property of properties) {
      try {
        log.push(`Processing: ${property.address} (${property.company_number})`)

        const enrichedData = await adapter.enrich({
          company_number: property.company_number,
        } as any)

        if (enrichedData && Object.keys(enrichedData).length > 0) {
          results.push({
            property: property.address,
            companyNumber: property.company_number,
            enrichedData: {
              company_name: enrichedData.company_name,
              company_status: enrichedData.company_status,
              directors: enrichedData.directors,
              directorsCount: enrichedData.directors?.length || 0,
              owner_address: enrichedData.owner_address,
            },
            saved: !testOnly,
          })

          if (!testOnly) {
            log.push("[4/4] Saving enriched data to database...")

            const { error: updateError } = await supabaseAdmin
              .from("properties")
              .update({
                company_name: enrichedData.company_name || property.company_name,
                company_status: enrichedData.company_status,
                company_incorporation_date: enrichedData.company_incorporation_date,
                directors: enrichedData.directors,
                owner_address: enrichedData.owner_address || property.owner_name,
                owner_enrichment_source: enrichedData.owner_enrichment_source,
              })
              .eq("id", property.id)

            if (updateError) {
              log.push(`Failed to save ${property.address}: ${updateError.message}`)
              errorCount++
            } else {
              log.push(`Saved directors for ${property.address}: ${enrichedData.directors?.length || 0} directors`)
              enrichedCount++
            }
          } else {
            enrichedCount++
          }
        } else {
          log.push(`No data returned for ${property.company_number}`)
          results.push({
            property: property.address,
            companyNumber: property.company_number,
            error: "No data returned from Companies House",
          })
          errorCount++
        }

        // Rate limiting - Companies House allows 600 requests per 5 minutes
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (error) {
        log.push(`Error enriching ${property.address}: ${error}`)
        results.push({
          property: property.address,
          companyNumber: property.company_number,
          error: String(error),
        })
        errorCount++
      }
    }

    const summary = {
      propertiesChecked: properties.length,
      enriched: enrichedCount,
      errors: errorCount,
      testOnly,
    }

    return NextResponse.json({
      success: true,
      message: testOnly ? "Companies House test completed" : "Companies House enrichment completed",
      log,
      results,
      summary,
    })

  } catch (error) {
    log.push("Error: " + String(error))
    return NextResponse.json({ success: false, error: String(error), log }, { status: 500 })
  }
}

/**
 * GET /api/enrich-companies
 * Returns status and documentation
 */
export async function GET() {
  // Check current stats
  const { count: totalProperties } = await supabaseAdmin
    .from("properties")
    .select("*", { count: "exact", head: true })
    .or("is_stale.eq.false,is_stale.is.null")

  const { count: withCompanyNumber } = await supabaseAdmin
    .from("properties")
    .select("*", { count: "exact", head: true })
    .or("is_stale.eq.false,is_stale.is.null")
    .not("company_number", "is", null)

  const { count: withDirectors } = await supabaseAdmin
    .from("properties")
    .select("*", { count: "exact", head: true })
    .or("is_stale.eq.false,is_stale.is.null")
    .not("directors", "is", null)

  const { count: needsEnrichment } = await supabaseAdmin
    .from("properties")
    .select("*", { count: "exact", head: true })
    .or("is_stale.eq.false,is_stale.is.null")
    .not("company_number", "is", null)
    .is("directors", null)

  return NextResponse.json({
    message: "POST to enrich properties with Companies House director data",
    description: "Finds properties with company_number but no directors and fetches from Companies House API",
    currentStats: {
      totalProperties,
      withCompanyNumber,
      withDirectors,
      needsEnrichment,
      enrichmentCoverage: withCompanyNumber ? `${((withDirectors || 0) / withCompanyNumber * 100).toFixed(1)}%` : "N/A",
    },
    apiStatus: {
      configured: apiConfig.companiesHouse.enabled && !!apiConfig.companiesHouse.apiKey,
      apiKeyPrefix: apiConfig.companiesHouse.apiKey?.substring(0, 8) || "not set",
    },
    usage: {
      testOne: "POST with { propertyId: 'uuid', testOnly: true }",
      enrichBatch: "POST with { limit: 10 }",
      enrichAll: "POST with { limit: 100 } (rate limited)",
    },
  })
}
