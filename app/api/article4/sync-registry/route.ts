import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { buildCouncilRegistry, type CouncilRecord } from "@/lib/article4/registry"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/** Empty string is not a date. Postgres would reject it; null is the truth. */
function asDate(value: string | null | undefined): string | null {
  return value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null
}

function toCouncilRow(c: CouncilRecord) {
  return {
    slug: c.slug,
    name: c.name,
    gss_code: c.gssCode || null,
    match_key: c.matchKey,
    organisation_entity: c.organisationEntity,
    coverage_level: c.coverageLevel,
    publishes_hmo_article4: c.publishesHmoArticle4,
    area_count: c.areaCount,
    area_count_with_geometry: c.areaCountWithGeometry,
    direction_count: c.directionCount,
    // A commercial conversion needs Class MA as well as the HMO right, so the
    // registry carries both and the two are never conflated.
    has_class_ma_article4: c.hasClassMaArticle4InForce,
    class_ma_direction_count: c.classMaDirectionCount,
    earliest_commencement: asDate(c.earliestCommencement),
    latest_commencement: asDate(c.latestCommencement),
    document_urls: c.documentUrls,
    source: c.source,
    retrieved_at: c.retrievedAt,
    updated_at: new Date().toISOString(),
  }
}

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data, error } = await supabase
      .from("article4_councils")
      .select("coverage_level")

    if (error) {
      return NextResponse.json(
        { error: error.message, hint: "Has add_article4_council_registry.sql been applied?" },
        { status: 500 }
      )
    }

    const byLevel = (data ?? []).reduce<Record<string, number>>((acc, row: any) => {
      acc[row.coverage_level] = (acc[row.coverage_level] ?? 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      message: "POST to rebuild the council registry from planning.data.gov.uk",
      councils: data?.length ?? 0,
      byCoverageLevel: byLevel,
      note: "Only coverage_level=boundaries permits a verified negative on a property.",
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const registry = await buildCouncilRegistry()

    // buildCouncilRegistry fails closed and returns [] if the district list is
    // unreachable. Upserting that would empty the covered set and start turning
    // real negatives into unknowns across the whole estate.
    if (registry.length === 0) {
      return NextResponse.json(
        { error: "Registry build returned no councils; refusing to write" },
        { status: 503 }
      )
    }

    const { error: councilError } = await supabase
      .from("article4_councils")
      .upsert(registry.map(toCouncilRow), { onConflict: "slug" })

    if (councilError) {
      return NextResponse.json(
        { error: councilError.message, hint: "Has add_article4_council_registry.sql been applied?" },
        { status: 500 }
      )
    }

    const directionRows = registry.flatMap((c) =>
      c.directions.map((d) => ({
        entity: d.entity,
        council_slug: c.slug,
        name: d.name,
        reference: d.reference || null,
        commenced_on: asDate(d.commencedOn),
        ended_on: asDate(d.endedOn),
        document_url: d.documentUrl,
        description: d.description,
        source: c.source,
        retrieved_at: c.retrievedAt,
      }))
    )

    let directionsWritten = 0
    if (directionRows.length > 0) {
      const { error: directionError } = await supabase
        .from("article4_directions")
        .upsert(directionRows, { onConflict: "entity" })

      if (directionError) {
        return NextResponse.json(
          { error: directionError.message, councilsWritten: registry.length },
          { status: 500 }
        )
      }
      directionsWritten = directionRows.length
    }

    const counts = registry.reduce<Record<string, number>>((acc, c) => {
      acc[c.coverageLevel] = (acc[c.coverageLevel] ?? 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      councilsWritten: registry.length,
      directionsWritten,
      byCoverageLevel: counts,
      documentUrls: registry.reduce((sum, c) => sum + c.documentUrls.length, 0),
    })
  } catch (error) {
    console.error("[Article4SyncRegistry] Error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
