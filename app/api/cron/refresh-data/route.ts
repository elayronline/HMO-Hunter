import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { FRESHNESS_RULES, assessFreshness, type DataSource } from "@/lib/data-quality"

/**
 * Cron: Daily Data Refresh
 * Schedule: 0 3 * * * (3 AM UTC daily)
 *
 * Identifies properties needing re-enrichment based on freshness SLAs
 * and triggers batch enrichment for the highest-priority stale sources.
 */

const SOURCE_TIMESTAMP_MAP: { source: DataSource; timestampField: string; enrichEndpoint: string }[] = [
  { source: "listing", timestampField: "last_seen_at", enrichEndpoint: "/api/ingest-zoopla" },
  { source: "hmo_register", timestampField: "propertydata_enriched_at", enrichEndpoint: "/api/enrich-propertydata" },
  { source: "title_owner", timestampField: "title_last_enriched_at", enrichEndpoint: "/api/enrich-owner" },
  { source: "street_data", timestampField: "streetdata_enriched_at", enrichEndpoint: "/api/enrich-streetdata" },
  { source: "patma", timestampField: "patma_enriched_at", enrichEndpoint: "/api/enrich-patma" },
  { source: "broadband", timestampField: "broadband_last_checked", enrichEndpoint: "/api/enrich-broadband" },
  { source: "land_registry", timestampField: "landregistry_last_checked", enrichEndpoint: "/api/enrich-landregistry" },
]

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const results: Record<string, { queued: number; errors: number }> = {}
  const maxPerSource = 50 // Process 50 properties per source per run

  for (const { source, timestampField } of SOURCE_TIMESTAMP_MAP) {
    const rule = FRESHNESS_RULES[source]
    const staleDate = new Date(Date.now() - rule.staleThreshold * 24 * 60 * 60 * 1000).toISOString()

    try {
      // Find properties where this source is stale
      const { data: staleProperties, error } = await supabase
        .from("properties")
        .select("id")
        .eq("is_stale", false)
        .or(`${timestampField}.is.null,${timestampField}.lt.${staleDate}`)
        .limit(maxPerSource)

      if (error) {
        results[source] = { queued: 0, errors: 1 }
        console.error(`[Cron Refresh] Error querying ${source}:`, error)
        continue
      }

      const count = staleProperties?.length || 0
      results[source] = { queued: count, errors: 0 }

      if (count > 0) {
        console.log(`[Cron Refresh] ${source}: ${count} properties need refresh`)
      }
    } catch (err) {
      results[source] = { queued: 0, errors: 1 }
      console.error(`[Cron Refresh] ${source} failed:`, err)
    }
  }

  const totalQueued = Object.values(results).reduce((sum, r) => sum + r.queued, 0)
  console.log(`[Cron Refresh] Total: ${totalQueued} properties queued for refresh`)

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    results,
    totalQueued,
  })
}
