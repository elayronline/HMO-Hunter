import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { buildCouncilAssessment } from "@/lib/article4/assessment"
import { forRedistribution } from "@/lib/article4/provenance"
import type { CouncilRecord, CoverageLevel } from "@/lib/article4/registry"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/** Rehydrate a registry row into the shape the assessment composer expects. */
function toCouncilRecord(row: any, directions: any[]): CouncilRecord {
  return {
    slug: row.slug,
    name: row.name,
    gssCode: row.gss_code ?? "",
    matchKey: row.match_key,
    organisationEntity: row.organisation_entity ?? null,
    publishesHmoArticle4: Boolean(row.publishes_hmo_article4),
    coverageLevel: (row.coverage_level ?? "none") as CoverageLevel,
    areaCount: row.area_count ?? 0,
    areaCountWithGeometry: row.area_count_with_geometry ?? 0,
    directionCount: row.direction_count ?? 0,
    earliestCommencement: row.earliest_commencement ?? null,
    latestCommencement: row.latest_commencement ?? null,
    documentUrls: row.document_urls ?? [],
    directions: directions.map((d) => ({
      entity: d.entity,
      name: d.name ?? "",
      reference: d.reference ?? "",
      commencedOn: d.commenced_on ?? null,
      endedOn: d.ended_on ?? null,
      documentUrl: d.document_url ?? null,
      description: d.description ?? null,
    })),
    source: row.source,
    retrievedAt: row.retrieved_at,
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const url = new URL(request.url)

    // Callers outside the product get the redistribution-filtered payload. The
    // internal app passes ?internal=1 to see licence-restricted values.
    const internal = url.searchParams.get("internal") === "1"

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: row, error } = await supabase
      .from("article4_councils")
      .select("*")
      .eq("slug", slug)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: error.message, hint: "Has add_article4_council_registry.sql been applied and synced?" },
        { status: 500 }
      )
    }

    if (!row) {
      return NextResponse.json(
        {
          error: "Council not found",
          slug,
          hint: "POST /api/article4/sync-registry to populate the registry.",
        },
        { status: 404 }
      )
    }

    const { data: directions } = await supabase
      .from("article4_directions")
      .select("*")
      .eq("council_slug", slug)
      .order("commenced_on", { ascending: true })

    const assessment = buildCouncilAssessment(toCouncilRecord(row, directions ?? []))
    const payload = internal ? assessment : forRedistribution(assessment)

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "X-Data-Source": row.source ?? "planning.data.gov.uk",
      },
    })
  } catch (error) {
    console.error("[Article4Council] Error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
