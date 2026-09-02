import { NextResponse } from "next/server"
import { apiConfig } from "@/lib/config/api-config"
import { requireAdmin } from "@/lib/admin-auth"

/**
 * POST /api/enrich-all
 * Run all enrichment APIs sequentially on properties
 */
/**
 * Both of these orchestrators reach their sub-tasks by HTTP-fetching this
 * application's own enrichment routes, and sent only Content-Type. Those routes
 * are guarded by lib/admin-auth.ts, so every sub-call received 401 — or 503
 * where ADMIN_API_KEY is unset — and the orchestrator reported zero enriched
 * with no error a reader could act on.
 *
 * That broke when admin-auth was introduced to close the publicly-writable
 * enrich endpoints; the guard was correct and these callers were never updated.
 * /api/enrich-article4 failed the same way for the same reason and was found
 * only by running an enrichment.
 *
 * The key is taken from the request rather than from the environment on
 * purpose: this route has already validated the caller's header, so forwarding
 * it keeps a sub-call exactly as authorised as the request that asked for it.
 * Reading process.env here would let the orchestrator act with more authority
 * than its caller had.
 *
 * The deeper fix is not to make an HTTP round-trip to yourself at all — it
 * costs a hop, drops types (await response.json() is any), and has to carry
 * credentials it should not need. Each enrich route would have to expose its
 * work as a function first, which is a larger change than this one.
 */
function adminHeaders(request: Request): Record<string, string> {
  const key = request.headers.get("x-admin-key")
  return {
    "Content-Type": "application/json",
    ...(key ? { "x-admin-key": key } : {}),
  }
}

export async function POST(request: Request) {
  const denied = requireAdmin(request)
  if (denied) return denied

  const results: Record<string, any> = {}
  const log: string[] = []

  try {
    const body = await request.json().catch(() => ({}))
    const limit = body.limit || 20
    const propertyId = body.propertyId

    const baseUrl = request.headers.get("host") || "localhost:3000"
    const protocol = baseUrl.includes("localhost") ? "http" : "https"

    log.push("Starting full enrichment pipeline...")

    // Run enrichments in order of priority/speed
    const enrichments = [
      { name: "StreetData", endpoint: "enrich-streetdata", enabled: apiConfig.streetData.enabled },
      { name: "PaTMa", endpoint: "enrich-patma", enabled: apiConfig.patma.enabled },
      { name: "PropertyData", endpoint: "enrich-propertydata", enabled: apiConfig.propertyData.enabled },
      { name: "Zoopla", endpoint: "enrich-zoopla", enabled: apiConfig.zoopla.enabled },
    ]

    for (const enrichment of enrichments) {
      if (!enrichment.enabled) {
        log.push(`Skipping ${enrichment.name} (not configured)`)
        results[enrichment.name] = { skipped: true, reason: "API not configured" }
        continue
      }

      log.push(`Running ${enrichment.name} enrichment...`)

      try {
        const response = await fetch(`${protocol}://${baseUrl}/api/${enrichment.endpoint}`, {
          method: "POST",
          headers: adminHeaders(request),
          body: JSON.stringify({ limit, propertyId }),
        })

        const data = await response.json()
        results[enrichment.name] = {
          success: data.success,
          processed: data.summary?.processed || 0,
          enriched: data.summary?.enriched || 0,
          failed: data.summary?.failed || 0,
        }

        log.push(`  ${enrichment.name}: ${data.summary?.enriched || 0} enriched, ${data.summary?.failed || 0} failed`)

      } catch (error) {
        log.push(`  ${enrichment.name} error: ${error}`)
        results[enrichment.name] = { success: false, error: String(error) }
      }
    }

    // Calculate totals
    const totals = {
      apisRun: Object.values(results).filter((r: any) => !r.skipped).length,
      apisSkipped: Object.values(results).filter((r: any) => r.skipped).length,
      totalEnriched: Object.values(results).reduce((sum: number, r: any) => sum + (r.enriched || 0), 0),
      totalFailed: Object.values(results).reduce((sum: number, r: any) => sum + (r.failed || 0), 0),
    }

    return NextResponse.json({
      success: true,
      message: `Enrichment pipeline complete. ${totals.totalEnriched} properties enriched across ${totals.apisRun} APIs.`,
      totals,
      results,
      log,
    })

  } catch (error) {
    return NextResponse.json({ success: false, error: String(error), log }, { status: 500 })
  }
}

export async function GET() {
  const configuredApis = [
    { name: "StreetData", enabled: apiConfig.streetData.enabled },
    { name: "PaTMa", enabled: apiConfig.patma.enabled },
    { name: "PropertyData", enabled: apiConfig.propertyData.enabled },
    { name: "Zoopla", enabled: apiConfig.zoopla.enabled },
  ]

  return NextResponse.json({
    message: "POST to run all enrichment APIs on properties",
    configuredApis,
    enrichmentOrder: [
      "1. StreetData - Property details (year built, tenure, area)",
      "2. PaTMa - Price analytics (asking/sold prices)",
      "3. PropertyData - HMO licence data",
      "4. Zoopla - Listing data and area stats",
    ],
    usage: {
      method: "POST",
      body: {
        limit: "Number of properties per API (default 20, max 100)",
        propertyId: "Specific property ID to enrich with all APIs",
      },
    },
  })
}
