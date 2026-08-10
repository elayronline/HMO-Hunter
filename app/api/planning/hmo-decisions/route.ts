import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import {
  computeApprovalStats,
  groupByCouncil,
  boundingBox,
  distanceKm,
  MIN_DECISIONS_FOR_RATE,
  type DecisionRow,
} from "@/lib/planning/decision-stats"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const SELECT =
  "id, reference, council_name, council_slug, description, app_state, app_type, decided_date, address, postcode, longitude, latitude, kind, adds_supply, occupants, council_url, planit_url, source"

const DISCLAIMER =
  "Planning decisions are sourced from council portals via PlanIt and may lag the authority's own record. Confirm against the council's planning register before relying on them."

/**
 * Recent HMO planning decisions.
 *
 *   ?council=<slug>              approval rate and recent decisions for a council
 *   ?lat=&lng=&radiusKm=         decisions near a property
 *   (no params)                  national summary with per-council breakdown
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const council = url.searchParams.get("council")
    const lat = parseFloat(url.searchParams.get("lat") ?? "")
    const lng = parseFloat(url.searchParams.get("lng") ?? "")
    const radiusKm = Math.min(parseFloat(url.searchParams.get("radiusKm") ?? "2") || 2, 25)
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 200)

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // --- near a property -----------------------------------------------------
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const box = boundingBox(lat, lng, radiusKm)

      const { data, error } = await supabase
        .from("hmo_planning_decisions")
        .select(SELECT)
        .gte("latitude", box.minLat)
        .lte("latitude", box.maxLat)
        .gte("longitude", box.minLng)
        .lte("longitude", box.maxLng)
        .order("decided_date", { ascending: false, nullsFirst: false })
        .limit(500)

      if (error) return dbError(error)

      // The box over-selects at the corners; filter to a true radius.
      const withDistance = (data ?? [])
        .filter((r: any) => r.latitude != null && r.longitude != null)
        .map((r: any) => ({ ...r, distanceKm: distanceKm(lat, lng, r.latitude, r.longitude) }))
        .filter((r) => r.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm)

      const stats = computeApprovalStats(withDistance as DecisionRow[])

      return NextResponse.json({
        scope: { lat, lng, radiusKm },
        stats,
        approvals: withDistance.filter((r: any) => /^permitted$/i.test(r.app_state ?? "")).slice(0, limit),
        decisions: withDistance.slice(0, limit),
        caveats: caveatsFor(stats),
        disclaimer: DISCLAIMER,
      })
    }

    // --- one council ---------------------------------------------------------
    if (council) {
      const { data, error } = await supabase
        .from("hmo_planning_decisions")
        .select(SELECT)
        .eq("council_slug", council)
        .order("decided_date", { ascending: false, nullsFirst: false })
        .limit(1000)

      if (error) return dbError(error)

      const rows = (data ?? []) as DecisionRow[]
      const stats = computeApprovalStats(rows)

      return NextResponse.json({
        council,
        stats,
        recentDecisions: (data ?? []).slice(0, limit),
        caveats: caveatsFor(stats),
        disclaimer: DISCLAIMER,
      })
    }

    // --- national ------------------------------------------------------------
    const { data, error } = await supabase
      .from("hmo_planning_decisions")
      .select(SELECT)
      .order("decided_date", { ascending: false, nullsFirst: false })
      .limit(5000)

    if (error) return dbError(error)

    const rows = (data ?? []) as DecisionRow[]
    const stats = computeApprovalStats(rows)

    return NextResponse.json({
      scope: "national",
      stats,
      byCouncil: groupByCouncil(rows).filter((c) => !c.lowConfidence),
      councilsWithThinData: groupByCouncil(rows).filter((c) => c.lowConfidence).length,
      caveats: caveatsFor(stats),
      disclaimer: DISCLAIMER,
    })
  } catch (error) {
    console.error("[HmoDecisions] Error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

function caveatsFor(stats: ReturnType<typeof computeApprovalStats>): string[] {
  const caveats: string[] = []

  if (stats.approvalRate === null) {
    caveats.push(
      "No decided applications in scope, so no approval rate can be given. This is not evidence that applications are refused."
    )
  } else if (stats.lowConfidence) {
    caveats.push(
      `Based on only ${stats.decided} decided application${stats.decided === 1 ? "" : "s"} — below the ${MIN_DECISIONS_FOR_RATE} needed for a meaningful rate. Treat as indicative.`
    )
  }

  if (stats.pending > 0) {
    caveats.push(`${stats.pending} application${stats.pending === 1 ? "" : "s"} still undecided and excluded from the rate.`)
  }

  return caveats
}

function dbError(error: { message: string }) {
  return NextResponse.json(
    { error: error.message, hint: "Has add_hmo_planning_decisions.sql been applied and ingested?" },
    { status: 500 }
  )
}
