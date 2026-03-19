import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/api-auth"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { fetchGazetteProbateNotices } from "@/lib/ingestion/adapters/gazette-probate"
import { fetchUnclaimedEstates } from "@/lib/ingestion/adapters/unclaimed-estates"
import { fetchLandRegistryRepossessions } from "@/lib/ingestion/adapters/land-registry-repos"

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.authenticated) return auth.response

  const body = await request.json().catch(() => ({}))
  const source = (body as { source?: string }).source || "all"

  const supabase = createServiceRoleClient()
  const results: Record<string, { ingested: number; errors: number }> = {}

  // 1. Gazette Probate Notices
  if (source === "all" || source === "gazette_probate") {
    try {
      const notices = await fetchGazetteProbateNotices(2)
      let ingested = 0
      let errors = 0

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

        if (error) {
          errors++
          console.error("[Ingest] Gazette error:", error.message)
        } else {
          ingested++
        }
      }

      results.gazette_probate = { ingested, errors }
    } catch (err) {
      console.error("[Ingest] Gazette failed:", err)
      results.gazette_probate = { ingested: 0, errors: 1 }
    }
  }

  // 2. Unclaimed Estates
  if (source === "all" || source === "unclaimed_estate") {
    try {
      const estates = await fetchUnclaimedEstates()
      let ingested = 0
      let errors = 0

      // Process in batches of 100
      for (let i = 0; i < estates.length; i += 100) {
        const batch = estates.slice(i, i + 100).map(e => ({
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

        const { error } = await supabase
          .from("off_market_leads")
          .upsert(batch, { onConflict: "bv_reference" })

        if (error) {
          errors += batch.length
          console.error("[Ingest] Unclaimed estates batch error:", error.message)
        } else {
          ingested += batch.length
        }
      }

      results.unclaimed_estate = { ingested, errors }
    } catch (err) {
      console.error("[Ingest] Unclaimed estates failed:", err)
      results.unclaimed_estate = { ingested: 0, errors: 1 }
    }
  }

  // 3. Land Registry Repossessions
  if (source === "all" || source === "land_registry_repo") {
    try {
      const repos = await fetchLandRegistryRepossessions()
      let ingested = 0
      let errors = 0

      for (let i = 0; i < repos.length; i += 100) {
        const batch = repos.slice(i, i + 100).map(r => ({
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

        const { error } = await supabase
          .from("off_market_leads")
          .upsert(batch, { onConflict: "transaction_id" })

        if (error) {
          errors += batch.length
          console.error("[Ingest] LR repos batch error:", error.message)
        } else {
          ingested += batch.length
        }
      }

      results.land_registry_repo = { ingested, errors }
    } catch (err) {
      console.error("[Ingest] LR repos failed:", err)
      results.land_registry_repo = { ingested: 0, errors: 1 }
    }
  }

  return NextResponse.json({ success: true, results })
}
