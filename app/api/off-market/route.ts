import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const SELECT_COLUMNS = `
  id, address, postcode, city, bedrooms,
  purchase_price, price_pcm, owner_name,
  owner_contact_email, owner_contact_phone,
  licence_holder_name, licence_holder_email,
  hmo_licence_expiry, licence_status, epc_rating,
  deal_score, hmo_classification, article_4_area,
  days_on_market, is_stale, is_potential_hmo, licensed_hmo
`

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const city = searchParams.get("city")
  const opportunityType = searchParams.get("type")
  const minScore = parseInt(searchParams.get("min_score") || "0", 10)
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200)

  // Try the materialised view first (created by migration), fall back to inline query
  let data: Record<string, unknown>[] | null = null
  let useView = false

  const { data: viewData, error: viewError } = await supabase
    .from("off_market_opportunities")
    .select("*")
    .limit(limit)

  if (!viewError && viewData) {
    useView = true
    data = viewData as Record<string, unknown>[]

    // Apply filters on view results
    if (city) {
      data = data.filter(p =>
        (p.city as string || "").toLowerCase().includes(city.toLowerCase())
      )
    }
    if (opportunityType) {
      data = data.filter(p => p.opportunity_type === opportunityType)
    }
    if (minScore > 0) {
      data = data.filter(p => (p.opportunity_score as number) >= minScore)
    }

    data.sort((a, b) => (b.opportunity_score as number) - (a.opportunity_score as number))
    data = data.slice(0, limit)
  }

  // Fallback: query properties table directly if view doesn't exist
  if (!useView) {
    let query = supabase
      .from("properties")
      .select(SELECT_COLUMNS)
      .limit(limit)

    if (opportunityType === "expired_licence") {
      query = query.eq("licence_status", "expired")
    } else if (opportunityType === "unlicensed_potential") {
      query = query.eq("is_potential_hmo", true).eq("licensed_hmo", false)
    } else if (opportunityType === "long_on_market") {
      query = query.gt("days_on_market", 180)
    } else {
      query = query.or(
        "licence_status.eq.expired," +
        "days_on_market.gt.180," +
        "is_stale.eq.true," +
        "and(is_potential_hmo.eq.true,licensed_hmo.eq.false)"
      )
    }

    if (city) {
      query = query.ilike("city", `%${city}%`)
    }

    const { data: fallbackData, error: fallbackError } = await query
      .order("deal_score", { ascending: false, nullsFirst: false })

    if (fallbackError) {
      console.error("[OffMarket] Error fetching:", fallbackError)
      return NextResponse.json({ error: "Failed to fetch opportunities" }, { status: 500 })
    }

    // Classify inline
    data = (fallbackData || []).map(p => {
      let oppType = "other"
      let oppScore = 50

      if (p.licence_status === "expired") {
        oppType = "expired_licence"
        oppScore = 90
      } else if (p.hmo_licence_expiry && new Date(p.hmo_licence_expiry) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)) {
        oppType = "expiring_licence"
        oppScore = 80
      } else if (p.is_potential_hmo && !p.licensed_hmo) {
        oppType = "unlicensed_potential"
        oppScore = 70
      } else if (p.days_on_market && p.days_on_market > 180) {
        oppType = "long_on_market"
        oppScore = 60
      } else if (p.is_stale) {
        oppType = "stale_listing"
        oppScore = 55
      }

      return { ...p, opportunity_type: oppType, opportunity_score: oppScore }
    }).filter(p => (p.opportunity_score as number) >= minScore)
      .sort((a, b) => (b.opportunity_score as number) - (a.opportunity_score as number))
  }

  const opportunities = data || []

  return NextResponse.json({
    opportunities,
    total: opportunities.length,
    summary: {
      expired_licence: opportunities.filter(o => o.opportunity_type === "expired_licence").length,
      expiring_licence: opportunities.filter(o => o.opportunity_type === "expiring_licence").length,
      unlicensed_potential: opportunities.filter(o => o.opportunity_type === "unlicensed_potential").length,
      long_on_market: opportunities.filter(o => o.opportunity_type === "long_on_market").length,
      stale_listing: opportunities.filter(o => o.opportunity_type === "stale_listing").length,
    },
  })
}
