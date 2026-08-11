import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { buildCouncilAssessment } from "@/lib/article4/assessment"
import { forRedistribution } from "@/lib/article4/provenance"
import { forceStateOn, type CouncilRecord, type CoverageLevel } from "@/lib/article4/registry"
import { applyCuratedOverlay, curatedBySlug, assessCurated } from "@/lib/article4/curated"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Rehydrate a registry row into the shape the assessment composer expects.
 *
 * Force state is recomputed here rather than read from the row on purpose: it is
 * a function of today's date, so a stored value silently becomes wrong the
 * morning a direction commences. The stored dates are the fact; force is derived
 * from them on every read.
 */
function toCouncilRecord(row: any, directions: any[], now: Date = new Date()): CouncilRecord {
  const mapped = directions.map((d) => ({
    entity: d.entity,
    name: d.name ?? "",
    reference: d.reference ?? "",
    commencedOn: d.commenced_on ?? null,
    endedOn: d.ended_on ?? null,
    forceState: forceStateOn(d.commenced_on ?? null, d.ended_on ?? null, now),
    documentUrl: d.document_url ?? null,
    description: d.description ?? null,
  }))

  const pending = mapped.filter((d) => d.forceState === "made_not_in_force")

  // With no direction records there are no dates to test, so fall back to what
  // the council publishes. Fail-closed: an unverifiable restriction is treated
  // as live, never as absent.
  const inForce =
    mapped.length > 0
      ? mapped.some((d) => d.forceState === "in_force")
      : Boolean(row.publishes_hmo_article4)

  return {
    slug: row.slug,
    name: row.name,
    gssCode: row.gss_code ?? "",
    matchKey: row.match_key,
    organisationEntity: row.organisation_entity ?? null,
    publishesHmoArticle4: Boolean(row.publishes_hmo_article4),
    hasHmoArticle4InForce: inForce,
    directionsNotYetInForce: pending.length,
    nextCommencementDate:
      pending.map((d) => d.commencedOn).filter(Boolean).sort()[0] ?? null,
    directionsExpired: mapped.filter((d) => d.forceState === "expired").length,
    coverageLevel: (row.coverage_level ?? "none") as CoverageLevel,
    areaCount: row.area_count ?? 0,
    areaCountWithGeometry: row.area_count_with_geometry ?? 0,
    directionCount: row.direction_count ?? 0,
    earliestCommencement: row.earliest_commencement ?? null,
    latestCommencement: row.latest_commencement ?? null,
    documentUrls: row.document_urls ?? [],
    directions: mapped,
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

    // Curated knowledge is folded in before the assessment is composed, so a
    // council the national feed has never heard of still reports its Article 4.
    // Additive only: this cannot turn a feed positive into a negative.
    const record = applyCuratedOverlay(toCouncilRecord(row, directions ?? []))
    const assessment = buildCouncilAssessment(record)

    // Serve the council's own words alongside the verdict. A user challenged on
    // this should be able to read the sentence it rests on, not just be told.
    const curated = curatedBySlug(slug)
    const withCitations = curated
      ? {
          ...assessment,
          councilVerified: {
            verifiedBy: curated.verifiedBy,
            verifiedAt: curated.verifiedAt,
            directions: assessCurated(curated).states.map(({ direction, state }) => ({
              name: direction.name,
              extent: direction.extent,
              commencedOn: direction.commencedOn,
              forceState: state,
              sourceUrl: direction.sourceUrl,
              quote: direction.quote,
            })),
          },
        }
      : assessment

    const payload = internal ? withCitations : forRedistribution(withCitations)

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "X-Data-Source": record.source ?? "planning.data.gov.uk",
      },
    })
  } catch (error) {
    console.error("[Article4Council] Error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
