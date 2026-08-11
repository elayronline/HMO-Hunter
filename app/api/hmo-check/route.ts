import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { buildHmoCheckReport } from "@/lib/report/hmo-check"
import { curatedBySlug, assessCurated } from "@/lib/article4/curated"
import { toSlug } from "@/lib/article4/registry"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Look an address up and report on it.
 *
 * Matching is deliberately loose — people type "12 Wilmslow Rd M14" rather than
 * the canonical address — but a wrong match is worse than no match, because the
 * report would then be accurate about the wrong building. So candidates are
 * returned when the match is not clear rather than the best guess being served
 * as though it were certain.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const query = (url.searchParams.get("address") ?? "").trim()

  if (query.length < 3) {
    return NextResponse.json({ error: "Enter an address or postcode" }, { status: 400 })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Postcode-looking input searches the postcode; anything else the address.
    const looksLikePostcode = /^[a-z]{1,2}\d[a-z\d]?\s*\d?[a-z]{0,2}$/i.test(query)
    let builder = supabase
      .from("properties")
      .select("*")
      .or("listing_type.eq.purchase,licensed_hmo.eq.true,licence_status.eq.expired")
      .limit(10)

    builder = looksLikePostcode
      ? builder.ilike("postcode", `${query.replace(/\s+/g, "")}%`)
      : builder.ilike("address", `%${query}%`)

    const { data: matches, error } = await builder

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!matches?.length) {
      return NextResponse.json(
        {
          error: "No property found for that address",
          hint: "We hold licensed HMOs and properties for sale. An address we do not hold is not a statement about the property.",
        },
        { status: 404 }
      )
    }

    // More than one plausible match: let the user choose rather than guess.
    if (matches.length > 1 && !url.searchParams.get("id")) {
      return NextResponse.json({
        candidates: matches.map((m: Record<string, unknown>) => ({
          id: m.id,
          address: m.address,
          postcode: m.postcode,
          city: m.city,
        })),
      })
    }

    const chosenId = url.searchParams.get("id")
    const property = chosenId
      ? matches.find((m: Record<string, unknown>) => m.id === chosenId) ?? matches[0]
      : matches[0]

    // The curated overlay is what turns "no record" into the council's own
    // words, for the 60 councils we have verified by hand.
    const councilSlug = property.article_4_council ? toSlug(property.article_4_council) : null
    const curated = councilSlug ? curatedBySlug(councilSlug) : null
    const curatedState = curated ? assessCurated(curated) : null
    const liveDirection = curatedState?.states.find((s) => s.state === "in_force")?.direction

    const report = buildHmoCheckReport({
      ...property,
      article_4_status: curatedState?.inForce ? "in_force" : property.article_4_status,
      councilVerifiedQuote: liveDirection?.quote ?? null,
      councilVerifiedUrl: liveDirection?.sourceUrl ?? null,
      hmoArticle4InForce: curatedState?.inForce ?? property.article_4_status === "in_force",
      councilPositionKnown: Boolean(curated) || property.article_4_status === "none_found",
    })

    return NextResponse.json({ report }, { headers: { "Cache-Control": "private, max-age=300" } })
  } catch (error) {
    console.error("[HmoCheck] Error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
