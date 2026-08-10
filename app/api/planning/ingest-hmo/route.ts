import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { fetchHmoIngestSet, PLANIT_SOURCE } from "@/lib/planning/planit"
import { classifyHmoApplication } from "@/lib/planning/hmo-classifier"
import { normaliseCouncilName } from "@/lib/article4/coverage"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const maxDuration = 300

/** Default ingest window. The daily cron only needs to catch recent changes. */
const DEFAULT_LOOKBACK_DAYS = 90

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { count: total } = await supabase
      .from("hmo_planning_decisions")
      .select("*", { count: "exact", head: true })

    const { count: supply } = await supabase
      .from("hmo_planning_decisions")
      .select("*", { count: "exact", head: true })
      .eq("adds_supply", true)

    const { count: unclear } = await supabase
      .from("hmo_planning_decisions")
      .select("*", { count: "exact", head: true })
      .eq("kind", "unclear")

    return NextResponse.json({
      message: "POST to ingest HMO planning decisions from PlanIt",
      stats: { total, addsSupply: supply, unclear },
      usage: { method: "POST", body: { lookbackDays: DEFAULT_LOOKBACK_DAYS, limitPerTerm: 500 } },
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const lookbackDays = Math.min(Number(body.lookbackDays) || DEFAULT_LOOKBACK_DAYS, 3650)
    const limitPerTerm = Math.min(Number(body.limitPerTerm) || 500, 2000)

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Resolve PlanIt's free-text area names to council slugs. A name that does
    // not resolve is left NULL rather than guessed — a wrong council attribution
    // would corrupt the per-council approval rates this feature exists to produce.
    const { data: councils } = await supabase
      .from("article4_councils")
      .select("slug, match_key, name")

    const slugByKey = new Map<string, string>()
    for (const c of councils ?? []) {
      slugByKey.set(c.match_key, c.slug)
      slugByKey.set(normaliseCouncilName(c.name), c.slug)
    }

    const result = await fetchHmoIngestSet({
      startDate: isoDaysAgo(lookbackDays),
      limitPerTerm,
    })

    if (result.applications.length === 0) {
      return NextResponse.json(
        { error: "PlanIt returned no applications; refusing to write", truncated: result.truncated },
        { status: 503 }
      )
    }

    const retrievedAt = new Date().toISOString()
    const counts: Record<string, number> = {}
    let unresolvedCouncils = 0

    const rows = result.applications.map((app) => {
      const classification = classifyHmoApplication(app.description, app.appType)
      counts[classification.kind] = (counts[classification.kind] ?? 0) + 1

      const slug = app.councilName ? slugByKey.get(normaliseCouncilName(app.councilName)) ?? null : null
      if (!slug) unresolvedCouncils++

      return {
        id: app.name,
        reference: app.reference,
        council_name: app.councilName,
        council_slug: slug,
        description: app.description,
        app_state: app.appState,
        app_type: app.appType,
        received_date: app.receivedDate,
        decided_date: app.decidedDate,
        address: app.address,
        postcode: app.postcode,
        longitude: app.longitude,
        latitude: app.latitude,
        kind: classification.kind,
        adds_supply: classification.addsSupply,
        occupants: classification.occupants,
        matched_rule: classification.matchedRule,
        classifier_version: "rules-v1",
        council_url: app.councilUrl,
        planit_url: app.planitUrl,
        source: PLANIT_SOURCE,
        retrieved_at: retrievedAt,
        updated_at: retrievedAt,
      }
    })

    // Upsert in batches; PlanIt revises records as councils update their portals.
    let written = 0
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500)
      const { error } = await supabase
        .from("hmo_planning_decisions")
        .upsert(batch, { onConflict: "id" })

      if (error) {
        return NextResponse.json(
          {
            error: error.message,
            written,
            hint: "Has add_hmo_planning_decisions.sql been applied?",
          },
          { status: 500 }
        )
      }
      written += batch.length
    }

    return NextResponse.json({
      success: true,
      fetched: result.applications.length,
      written,
      byKind: counts,
      unresolvedCouncils,
      truncated: result.truncated,
      note: result.truncated
        ? "Result set was capped or a page failed — this is not the complete set for the window."
        : undefined,
    })
  } catch (error) {
    console.error("[IngestHmoPlanning] Error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
