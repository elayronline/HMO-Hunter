import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { requireAdmin } from "@/lib/admin-auth"
import { rightmoveIngestSchema } from "@/lib/validation/schemas"
import { RightmoveSourceAdapter } from "@/lib/ingestion/adapters/rightmove-source"

export const maxDuration = 300

/**
 * POST /api/ingest-rightmove — purchase stock only.
 *
 * Guarded from the first commit. This route writes through the service-role key
 * and spends money on a metered API, so an unauthenticated version would be a
 * billing denial-of-service as well as a data one. See tests/api-route-auth.
 */
export async function POST(request: Request) {
  const denied = requireAdmin(request)
  if (denied) return denied

  const parsed = rightmoveIngestSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const adapter = new RightmoveSourceAdapter()
  if (!adapter.isConfigured()) {
    return NextResponse.json(
      {
        error: "Rightmove is not configured",
        detail: "APIFY_API_TOKEN is not set, so no request was made. This is not a statement about the market.",
      },
      { status: 503 }
    )
  }

  try {
    const listings = await adapter.fetch({
      location: parsed.data.area,
      postcode: parsed.data.postcode,
      maxPrice: parsed.data.maxPrice,
      minPrice: parsed.data.minPrice,
      minBedrooms: parsed.data.minBedrooms,
      maxBedrooms: parsed.data.maxBedrooms,
      radiusMiles: parsed.data.radiusMiles,
      maxItems: parsed.data.limit,
    })

    if (listings.length === 0) {
      return NextResponse.json({ success: true, ingested: 0, note: "The bounded search returned no listings." })
    }

    const rows = listings.map((l) => ({
      ...l,
      /*
       * "Potential HMO" is the honest value for what this route ingests, and
       * the constraint on the column allows only three.
       *
       * "Unlicensed HMO" would assert the property IS an HMO operating without
       * a licence, which is a false claim about a family house. "Potential HMO"
       * says it could become one, which is what a 4+ bedroom house under a
       * stated ceiling in a target HMO market is.
       *
       * The objection recorded against this value was that it once tagged a
       * £39.5m Mayfair penthouse — applied with no viability test at all. Here
       * the bounds ARE the viability test: rightmoveIngestSchema requires a
       * price ceiling and a bedroom floor before a run can be expressed.
       */
      hmo_status: "Potential HMO",
      /*
       * Set together, because they are one fact recorded in two columns and the
       * read path only consults the boolean.
       *
       * app/actions/properties.ts filters the served set with
       *   .or("licensed_hmo.eq.true,is_potential_hmo.eq.true,licence_status.eq.expired")
       * so a row with hmo_status "Potential HMO" and is_potential_hmo false is
       * in the table and on no screen. That is exactly what happened: 1,185
       * rows ingested and none of them rendered, because the string column has
       * a check constraint that rejects a bad write loudly while the boolean
       * silently defaults to false.
       *
       * Across the rest of the estate the two never disagree — 827 rows pair
       * "Potential HMO" with true. Writing one without the other is the same
       * shape as the is_premium/credits double-gate migration 018 removed and
       * the licensed_hmo/licence_status split PR #26 fixed: two columns holding
       * one idea, which drift the moment a writer remembers only one.
       */
      is_potential_hmo: true,
      source_name: "Rightmove",
      last_seen_at: new Date().toISOString(),
      last_ingested_at: new Date().toISOString(),
      is_stale: false,
    }))

    const { data, error } = await supabaseAdmin
      .from("properties")
      .upsert(rows, { onConflict: "external_id" })
      .select("id, external_id, address, city, purchase_price, bedrooms")

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, ingested: data?.length ?? 0, properties: data })
  } catch (err) {
    console.error("[IngestRightmove] error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const denied = requireAdmin(request)
  if (denied) return denied
  return NextResponse.json({
    configured: new RightmoveSourceAdapter().isConfigured(),
    source: "Rightmove for-sale (via Apify memo23/rightmove-scraper)",
    policy:
      "Purchase stock only. searchMode is the literal 'propertySale' with no code path to rentals, and maxPrice and minBedrooms are required rather than defaulted.",
  })
}
