import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { FRESHNESS_RULES } from "@/lib/data-quality"

/**
 * Cron: Stale Property Detection
 * Schedule: 0 4 * * * (4 AM UTC daily)
 *
 * Marks properties as stale when their primary listing data
 * exceeds the configured freshness SLA threshold.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const listingRule = FRESHNESS_RULES.listing
  const staleDate = new Date(Date.now() - listingRule.staleThreshold * 24 * 60 * 60 * 1000).toISOString()

  // Mark properties as stale if listing data is beyond threshold
  const { data, error } = await supabase
    .from("properties")
    .update({
      is_stale: true,
      stale_marked_at: new Date().toISOString(),
    })
    .eq("is_stale", false)
    .lt("last_seen_at", staleDate)
    .select("id")

  if (error) {
    console.error("[Cron DetectStale] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const markedStale = data?.length || 0
  console.log(`[Cron DetectStale] Marked ${markedStale} properties as stale`)

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    marked_stale: markedStale,
    threshold_days: listingRule.staleThreshold,
  })
}
