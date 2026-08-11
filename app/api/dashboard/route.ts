import { NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { datedChanges, splitByExpiry, coverageGaps, type AttentionBoard } from "@/lib/dashboard/attention"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/** Only what the platform serves — the same rule as everywhere else. */
const SERVED = "listing_type.eq.purchase,licensed_hmo.eq.true,licence_status.eq.expired"

/**
 * Count served properties matching one extra condition.
 *
 * The condition is described rather than passed as a builder callback: the
 * PostgREST builder types do not survive being handed around, and the casts
 * needed to make them do so hid more than they helped.
 */
async function countWhere(
  supabase: SupabaseClient,
  column: string,
  match: { eq: string } | { isNull: true }
): Promise<number> {
  let query = supabase.from("properties").select("id", { count: "exact", head: true }).or(SERVED)
  query = "eq" in match ? query.eq(column, match.eq) : query.is(column, null)
  const { count } = await query
  return count ?? 0
}

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    const horizon = new Date(now.getTime() + 240 * 86_400_000).toISOString().slice(0, 10)

    // Licences within the horizon, and those already gone. Named rows rather
    // than counts: thirteen addresses are actionable, "13" is not.
    const { data: upcoming } = await supabase
      .from("properties")
      .select("id,address,postcode,article_4_council,hmo_licence_expiry")
      .or(SERVED)
      .gte("hmo_licence_expiry", today)
      .lte("hmo_licence_expiry", horizon)
      .order("hmo_licence_expiry", { ascending: true })
      .limit(25)

    const { data: past } = await supabase
      .from("properties")
      .select("id,address,postcode,article_4_council,hmo_licence_expiry")
      .or(SERVED)
      .lt("hmo_licence_expiry", today)
      .order("hmo_licence_expiry", { ascending: false })
      .limit(25)

    const { expiringSoon } = splitByExpiry((upcoming ?? []) as never, now)
    const { expired } = splitByExpiry((past ?? []) as never, now)

    const { count: totalCount } = await supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .or(SERVED)
    const total = totalCount ?? 0

    const [article4Unknown, noEpc, noFloorPlan, noOwner] = await Promise.all([
      countWhere(supabase, "article_4_status", { eq: "unknown" }),
      countWhere(supabase, "epc_rating", { isNull: true }),
      countWhere(supabase, "floor_plans", { isNull: true }),
      countWhere(supabase, "owner_name", { isNull: true }),
    ])

    const board: AttentionBoard = {
      datedChanges: datedChanges(now),
      expiringSoon,
      expired,
      coverage: coverageGaps({ total, article4Unknown, noEpc, noFloorPlan, noOwner }),
      generatedAt: now.toISOString(),
    }

    return NextResponse.json({ board, servedTotal: total })
  } catch (error) {
    console.error("[Dashboard] Error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
