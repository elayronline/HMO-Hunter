import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { buildHmoCheckReport, needsPlanningApplication, type PlanningDecision } from "@/lib/report/hmo-check"
import { assessConversion } from "@/lib/properties/conversion"
import { assessUseClass } from "@/lib/properties/use-class"
import { curatedBySlug, assessCurated } from "@/lib/article4/curated"
import { toSlug } from "@/lib/article4/registry"
import { requireAuth } from "@/lib/api-auth"

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
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response
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

    // Precedent is fetched only where an application would actually be needed.
    // The gate is evaluated before the query so a permitted-development case
    // costs no round trip and shows no hurdle that is not there.
    const hmoInForce = curatedState?.inForce ?? property.article_4_status === "in_force"
    const positionKnown = Boolean(curated) || property.article_4_status === "none_found"
    const provisionalConversion = assessConversion({
      useClass: assessUseClass(property).useClass,
      hmoArticle4InForce: hmoInForce,
      classMaArticle4InForce: false,
      councilPositionKnown: positionKnown,
      hasFloorPlan: Boolean(property.floor_plans?.length),
      bedrooms: property.bedrooms,
    })

    let recentDecisions: PlanningDecision[] = []
    let councilApprovalRate: number | null = null
    let councilDecisionCount: number | null = null

    if (councilSlug && needsPlanningApplication(provisionalConversion)) {
      const { data: decisions } = await supabase
        .from("hmo_planning_decisions")
        .select("reference,address,description,app_state,decided_date,adds_supply")
        .eq("council_slug", councilSlug)
        // Applications that would add HMO supply are the comparable ones. A
        // condition discharge on an existing HMO tells a buyer nothing.
        .eq("adds_supply", true)
        .not("decided_date", "is", null)
        .order("decided_date", { ascending: false })
        .limit(50)

      const rows = decisions ?? []
      recentDecisions = rows.slice(0, 5).map((d: Record<string, unknown>) => ({
        reference: String(d.reference ?? ""),
        address: (d.address as string) ?? null,
        description: String(d.description ?? ""),
        outcome: String(d.app_state ?? "Unknown"),
        decidedDate: (d.decided_date as string) ?? null,
        addsSupply: Boolean(d.adds_supply),
      }))

      const decided = rows.filter((d: Record<string, unknown>) =>
        ["Permitted", "Rejected"].includes(String(d.app_state))
      )
      if (decided.length > 0) {
        councilDecisionCount = decided.length
        councilApprovalRate =
          decided.filter((d: Record<string, unknown>) => d.app_state === "Permitted").length /
          decided.length
      }
    }

    const report = buildHmoCheckReport({
      ...property,
      article_4_status: curatedState?.inForce ? "in_force" : property.article_4_status,
      councilVerifiedQuote: liveDirection?.quote ?? null,
      councilVerifiedUrl: liveDirection?.sourceUrl ?? null,
      hmoArticle4InForce: hmoInForce,
      councilPositionKnown: positionKnown,
      recentDecisions,
      councilApprovalRate,
      councilDecisionCount,
    })

    return NextResponse.json({ report }, { headers: { "Cache-Control": "private, max-age=300" } })
  } catch (error) {
    console.error("[HmoCheck] Error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
