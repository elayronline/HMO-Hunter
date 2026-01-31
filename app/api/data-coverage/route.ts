import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * GET /api/data-coverage
 *
 * Returns statistics on data coverage for owner and licence holder fields
 * Helps determine if premium features have enough data to be valuable
 */
export async function GET() {
  try {
    // Get total property count
    const { count: totalCount, error: countError } = await supabaseAdmin
      .from("properties")
      .select("*", { count: "exact", head: true })

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 })
    }

    // Get properties with various data fields populated
    const { data: coverage, error: coverageError } = await supabaseAdmin
      .rpc("get_data_coverage")
      .single()

    // If RPC doesn't exist, fall back to manual queries
    if (coverageError) {
      // Manual coverage check
      const queries = await Promise.all([
        // Title Owner fields
        supabaseAdmin.from("properties").select("*", { count: "exact", head: true }).not("owner_name", "is", null),
        supabaseAdmin.from("properties").select("*", { count: "exact", head: true }).not("company_name", "is", null),
        supabaseAdmin.from("properties").select("*", { count: "exact", head: true }).not("company_number", "is", null),
        supabaseAdmin.from("properties").select("*", { count: "exact", head: true }).not("owner_contact_email", "is", null),
        supabaseAdmin.from("properties").select("*", { count: "exact", head: true }).not("owner_contact_phone", "is", null),

        // Licence Holder fields
        supabaseAdmin.from("properties").select("*", { count: "exact", head: true }).not("licence_holder_name", "is", null),
        supabaseAdmin.from("properties").select("*", { count: "exact", head: true }).not("licence_holder_email", "is", null),
        supabaseAdmin.from("properties").select("*", { count: "exact", head: true }).not("licence_holder_phone", "is", null),
        supabaseAdmin.from("properties").select("*", { count: "exact", head: true }).not("licence_holder_address", "is", null),

        // HMO Status
        supabaseAdmin.from("properties").select("*", { count: "exact", head: true }).eq("licensed_hmo", true),
        supabaseAdmin.from("properties").select("*", { count: "exact", head: true }).eq("is_potential_hmo", true),

        // Directors (from Companies House enrichment)
        supabaseAdmin.from("properties").select("*", { count: "exact", head: true }).not("directors", "is", null),
      ])

      const total = totalCount || 0
      const pct = (count: number) => total > 0 ? ((count / total) * 100).toFixed(1) + "%" : "0%"

      const results = {
        total_properties: total,

        title_owner: {
          owner_name: { count: queries[0].count || 0, percentage: pct(queries[0].count || 0) },
          company_name: { count: queries[1].count || 0, percentage: pct(queries[1].count || 0) },
          company_number: { count: queries[2].count || 0, percentage: pct(queries[2].count || 0) },
          owner_contact_email: { count: queries[3].count || 0, percentage: pct(queries[3].count || 0) },
          owner_contact_phone: { count: queries[4].count || 0, percentage: pct(queries[4].count || 0) },
        },

        licence_holder: {
          licence_holder_name: { count: queries[5].count || 0, percentage: pct(queries[5].count || 0) },
          licence_holder_email: { count: queries[6].count || 0, percentage: pct(queries[6].count || 0) },
          licence_holder_phone: { count: queries[7].count || 0, percentage: pct(queries[7].count || 0) },
          licence_holder_address: { count: queries[8].count || 0, percentage: pct(queries[8].count || 0) },
        },

        hmo_status: {
          licensed_hmo: { count: queries[9].count || 0, percentage: pct(queries[9].count || 0) },
          potential_hmo: { count: queries[10].count || 0, percentage: pct(queries[10].count || 0) },
        },

        enrichment: {
          has_directors: { count: queries[11].count || 0, percentage: pct(queries[11].count || 0) },
        },

        summary: {
          has_any_owner_data: queries[0].count || queries[1].count ? true : false,
          has_any_owner_contact: queries[3].count || queries[4].count ? true : false,
          has_any_licence_holder_data: queries[5].count ? true : false,
          has_any_licence_holder_contact: queries[6].count || queries[7].count ? true : false,
        },

        recommendations: generateRecommendations({
          total,
          ownerName: queries[0].count || 0,
          ownerEmail: queries[3].count || 0,
          ownerPhone: queries[4].count || 0,
          licenceHolderName: queries[5].count || 0,
          licenceHolderEmail: queries[6].count || 0,
          licenceHolderPhone: queries[7].count || 0,
          licensedHmo: queries[9].count || 0,
        }),
      }

      return NextResponse.json(results)
    }

    return NextResponse.json(coverage)
  } catch (error) {
    console.error("[DataCoverage] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch data coverage" },
      { status: 500 }
    )
  }
}

function generateRecommendations(data: {
  total: number
  ownerName: number
  ownerEmail: number
  ownerPhone: number
  licenceHolderName: number
  licenceHolderEmail: number
  licenceHolderPhone: number
  licensedHmo: number
}): string[] {
  const recommendations: string[] = []
  const { total, ownerName, ownerEmail, ownerPhone, licenceHolderName, licenceHolderEmail, licenceHolderPhone, licensedHmo } = data

  if (total === 0) {
    recommendations.push("No properties in database. Run property ingestion first.")
    return recommendations
  }

  const ownerNamePct = (ownerName / total) * 100
  const ownerContactPct = ((ownerEmail + ownerPhone) / total) * 100
  const licenceHolderPct = (licenceHolderName / total) * 100
  const licenceContactPct = ((licenceHolderEmail + licenceHolderPhone) / total) * 100

  // Owner data recommendations
  if (ownerNamePct < 10) {
    recommendations.push("Run /api/enrich-owner to populate title owner data from Land Registry via Searchland API")
  } else if (ownerNamePct < 50) {
    recommendations.push(`Owner names at ${ownerNamePct.toFixed(0)}% coverage - consider running more enrichment`)
  }

  if (ownerContactPct < 5) {
    recommendations.push("Owner contact details very low - this requires additional data sources or manual lookup")
  }

  // Licence holder recommendations
  if (licensedHmo > 0 && licenceHolderPct < 20) {
    recommendations.push("Run /api/scrape-council-hmo to get licence holder names from council HMO registers")
  }

  if (licenceContactPct < 5 && licensedHmo > 0) {
    recommendations.push("Licence holder contact details sparse - council registers sometimes include contact info")
  }

  // Companies House
  if (ownerNamePct > 10) {
    recommendations.push("Run /api/enrich-companies to get director details for corporate landlords")
  }

  // Premium feature readiness
  if (ownerContactPct > 10 || licenceContactPct > 10) {
    recommendations.push("✓ Sufficient contact data to offer as premium feature")
  } else {
    recommendations.push("⚠ Contact data coverage too low for compelling premium offering - enrich first")
  }

  return recommendations
}
