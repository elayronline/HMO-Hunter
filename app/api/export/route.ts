import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { lockReason, userCan } from "@/lib/entitlements"
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
    // Check entitlement first, then fetch.
    //
    // Export is a Pro capability rather than something priced per use, so the
    // answer does not depend on the result set and there is no reason to run
    // the query before refusing. The old code took 10 credits AFTER a query
    // that always failed, so every export in the product's history cost
    // credits and returned an error.
    if (!(await userCan(user.id, "export"))) {
      return NextResponse.json(
        { error: lockReason("free", "export"), upgradeRequired: true },
        { status: 403 },
      )
    }

    const properties = await propertiesForExport(filters, segment, propertyIds)

    if (properties.length === 0) {
      return NextResponse.json(
        { error: "No properties match these filters, so there is nothing to export." },
        { status: 400 }
      )
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
      }
    })
  } catch (error) {
    console.error("[Export] Error:", error)
    return NextResponse.json({ error: "Export failed" }, { status: 500 })
  }
}
