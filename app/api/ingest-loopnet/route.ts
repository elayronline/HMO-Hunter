import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { requireAdmin } from "@/lib/admin-auth"
import { loopnetIngestSchema } from "@/lib/validation/schemas"
import { LoopNetAdapter } from "@/lib/ingestion/adapters/loopnet"

export const maxDuration = 300

/**
 * POST /api/ingest-loopnet
 *
 * Ingests UK commercial stock that has a Class MA route to residential.
 *
 * Guarded from the first commit rather than retrofitted: the audit of
 * 2026-09-02 found 26 routes with no authentication, eleven of which wrote
 * through the service-role key, because lib/admin-auth.ts had been applied to
 * the /api/enrich-* prefix and nothing outside it. This route writes AND spends
 * money on a metered third-party API, so an open version of it would be a
 * billing denial-of-service as well as a data one.
 */
export async function POST(request: Request) {
  const denied = requireAdmin(request)
  if (denied) return denied

  const parsed = loopnetIngestSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const adapter = new LoopNetAdapter()

  // Ask before reporting. An unconfigured adapter resolves empty, which is
  // indistinguishable from "no Class E stock is for sale in the UK" — the same
  // shape of lie that had an unconfigured Zoopla ingest reporting "No listings
  // found" for Nottingham.
  if (!adapter.isConfigured()) {
    return NextResponse.json(
      {
        error: "LoopNet is not configured",
        detail:
          "APIFY_API_TOKEN is not set, so no request was made. This is not a statement about the market.",
      },
      { status: 503 }
    )
  }

  try {
    const listings = await adapter.fetch(parsed.data)

    if (listings.length === 0) {
      return NextResponse.json({
        success: true,
        ingested: 0,
        note: "The search returned no listings with a Class MA route. Industrial, warehousing, storage and land are filtered out at the adapter because Class MA runs from Use Class E only.",
      })
    }

    const rows = listings.map((l) => ({
      ...l,
      source_name: "LoopNet",
      last_seen_at: new Date().toISOString(),
      last_ingested_at: new Date().toISOString(),
      is_stale: false,
    }))

    const { data, error } = await supabaseAdmin
      .from("properties")
      .upsert(rows, { onConflict: "external_id" })
      .select("id, external_id, address, property_type, purchase_price")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      ingested: data?.length ?? 0,
      searchUrl: parsed.data.searchUrl,
      properties: data,
    })
  } catch (err) {
    console.error("[IngestLoopNet] error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const denied = requireAdmin(request)
  if (denied) return denied

  const adapter = new LoopNetAdapter()
  return NextResponse.json({
    configured: adapter.isConfigured(),
    source: "LoopNet UK (via Apify memo23/loopnet-scraper-ppe)",
    filter:
      "Use Class E only — Class MA (Schedule 2, Part 3) runs from Class E, so industrial, warehousing, storage and land are excluded as having no permitted development route.",
    note: "Floor area is recorded but is not a planning gate: SI 2024/141 removed the 1,500 sqm Class MA ceiling on 5 March 2024.",
  })
}
