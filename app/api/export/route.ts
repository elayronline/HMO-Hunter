import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { deductCredits } from "@/lib/credits"
import { validateBody } from "@/lib/validation/api-validation"
import { exportRequestSchema } from "@/lib/validation/schemas"
import { propertiesForExport } from "@/lib/export/query"
import { toCsv } from "@/lib/export/rows"

// POST - Export properties to CSV
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Validate request body
  const validation = await validateBody(request, exportRequestSchema)
  if (!validation.success) {
    return validation.error
  }

  const { propertyIds, filters, segment } = validation.data

  try {
    // Fetch first, charge second.
    //
    // Credits were taken before the query ran and never given back when it
    // failed — and it always failed, on a select naming nine columns that do
    // not exist. Every export attempt in the product's history cost 10 credits
    // and returned an error. Nothing here is charged for until there are rows
    // to hand over.
    const properties = await propertiesForExport(filters, segment, propertyIds)

    if (properties.length === 0) {
      return NextResponse.json(
        { error: "No properties match these filters, so there is nothing to export." },
        { status: 400 }
      )
    }

    const creditResult = await deductCredits(user.id, 'csv_export')
    if (!creditResult.success) {
      return NextResponse.json({
        error: creditResult.error || "Insufficient credits",
        insufficientCredits: true,
        creditsRemaining: creditResult.credits_remaining,
        resetAt: creditResult.reset_at,
      }, { status: 429 })
    }

    // No row cap. The old 500 was applied silently against a page that says
    // 1,523, so the file was short by a thousand properties with nothing to
    // say so. A CSV of the whole set is a few hundred kilobytes.
    const csv = toCsv(properties)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="hmo-hunter-export-${new Date().toISOString().split('T')[0]}.csv"`,
        'X-Export-Rows': String(properties.length),
        'X-Credits-Remaining': String(creditResult.credits_remaining ?? 0),
        'X-Credits-Warning': creditResult.warning || '',
      }
    })
  } catch (error) {
    console.error("[Export] Error:", error)
    return NextResponse.json({ error: "Export failed" }, { status: 500 })
  }
}
