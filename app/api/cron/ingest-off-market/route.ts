import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { fetchGazetteProbateNotices } from "@/lib/ingestion/adapters/gazette-probate"
import { fetchUnclaimedEstates } from "@/lib/ingestion/adapters/unclaimed-estates"
import { fetchLandRegistryRepossessions } from "@/lib/ingestion/adapters/land-registry-repos"

/**
 * Cron: Off-Market Lead Ingestion
 * Schedule: 0 5 * * * (5 AM UTC daily)
 *
 * Pulls fresh leads from Gazette probate, Unclaimed Estates CSV,
 * and Land Registry monthly repossession data.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const results: Record<string, { ingested: number; errors: number }> = {}

  // 1. Gazette Probate (1 page to stay within rate limits)
  try {
    const notices = await fetchGazetteProbateNotices(1)
    let ingested = 0
    for (const notice of notices) {
      const { error } = await supabase
        .from("off_market_leads")
        .upsert({
          source: "gazette_probate",
          gazette_notice_id: notice.notice_id,
          deceased_name: notice.deceased_name,
          date_of_death: notice.date_of_death,
          property_address: notice.last_address,
          postcode: notice.postcode,
          city: notice.city,
          solicitor_name: notice.solicitor_name,
          solicitor_address: notice.solicitor_address,
          solicitor_reference: notice.solicitor_reference,
          claim_expiry_date: notice.claim_expiry_date,
          opportunity_score: 85,
          updated_at: new Date().toISOString(),
        }, { onConflict: "gazette_notice_id" })
      if (!error) ingested++
    }
    results.gazette_probate = { ingested, errors: notices.length - ingested }
  } catch (err) {
    results.gazette_probate = { ingested: 0, errors: 1 }
    console.error("[Cron OffMarket] Gazette error:", err)
  }

  // 2. Unclaimed Estates (full CSV, batched)
  try {
    const estates = await fetchUnclaimedEstates()
    let ingested = 0
    for (let i = 0; i < estates.length; i += 200) {
      const batch = estates.slice(i, i + 200).map(e => ({
        source: "unclaimed_estate" as const,
        bv_reference: e.bv_reference,
        deceased_name: e.full_name,
        date_of_death: e.date_of_death,
        place_of_death: e.place_of_death,
        postcode: e.postcode,
        city: e.city,
        opportunity_score: 70,
        updated_at: new Date().toISOString(),
      }))
      const { error } = await supabase.from("off_market_leads").upsert(batch, { onConflict: "bv_reference" })
      if (!error) ingested += batch.length
    }
    results.unclaimed_estate = { ingested, errors: estates.length - ingested }
  } catch (err) {
    results.unclaimed_estate = { ingested: 0, errors: 1 }
    console.error("[Cron OffMarket] Unclaimed estates error:", err)
  }

  // 3. Land Registry Repos (monthly CSV)
  try {
    const repos = await fetchLandRegistryRepossessions()
    let ingested = 0
    for (let i = 0; i < repos.length; i += 200) {
      const batch = repos.slice(i, i + 200).map(r => ({
        source: "land_registry_repo" as const,
        transaction_id: r.transaction_id,
        property_address: r.full_address,
        postcode: r.postcode,
        city: r.town_city,
        sale_price: r.price,
        sale_date: r.date_of_transfer,
        property_type: r.property_type,
        tenure: r.duration,
        ppd_category: r.ppd_category,
        opportunity_score: 75,
        updated_at: new Date().toISOString(),
      }))
      const { error } = await supabase.from("off_market_leads").upsert(batch, { onConflict: "transaction_id" })
      if (!error) ingested += batch.length
    }
    results.land_registry_repo = { ingested, errors: repos.length - ingested }
  } catch (err) {
    results.land_registry_repo = { ingested: 0, errors: 1 }
    console.error("[Cron OffMarket] LR repos error:", err)
  }

  const total = Object.values(results).reduce((s, r) => s + r.ingested, 0)
  console.log(`[Cron OffMarket] Total ingested: ${total}`)

  return NextResponse.json({ success: true, timestamp: new Date().toISOString(), results, total })
}
