import { NextResponse } from "next/server"
import { runIngestion } from "@/app/actions/ingestion"

export const maxDuration = 300 // 5 minutes timeout

export async function POST(request: Request) {
  try {
    // Check for optional source filter in request body
    let sourceName: string | undefined
    try {
      const body = await request.json()
      sourceName = body.source
    } catch {
      // No body or invalid JSON, run all sources
    }

    console.log("[API] Starting ingestion...", sourceName ? `Source: ${sourceName}` : "All sources")

    const results = await runIngestion(sourceName)

    const summary = {
      success: true,
      message: `Ingestion complete`,
      results,
      totals: {
        sources: results.length,
        created: results.reduce((sum, r) => sum + r.created, 0),
        updated: results.reduce((sum, r) => sum + r.updated, 0),
        skipped: results.reduce((sum, r) => sum + r.skipped, 0),
        errors: results.reduce((sum, r) => sum + r.errors.length, 0),
      },
    }

    console.log("[API] Ingestion complete:", summary.totals)
    return NextResponse.json(summary)
  } catch (error) {
    console.error("[API] Ingestion error:", error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
        results: [],
        totals: { sources: 0, created: 0, updated: 0, skipped: 0, errors: 1 },
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Use POST to run ingestion from all configured APIs",
    sources: [
      { name: "PropertyData HMO", type: "hmo_register", phase: 1 },
      { name: "Searchland", type: "hmo_register", phase: 1 },
      { name: "StreetData", type: "enrichment", phase: 2 },
      { name: "PaTMa", type: "enrichment", phase: 2 },
      { name: "Searchland Ownership", type: "enrichment", phase: 3 },
      { name: "Searchland EPC", type: "enrichment", phase: 3 },
      { name: "Searchland Planning", type: "enrichment", phase: 3 },
      { name: "Companies House", type: "enrichment", phase: 3 },
    ],
    usage: {
      runAll: "POST /api/run-ingestion",
      runSpecific: "POST /api/run-ingestion with body { source: 'PropertyData HMO' }",
    },
  })
}
