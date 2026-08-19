import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { lockReason, userCan } from "@/lib/entitlements"
import { validateBody } from "@/lib/validation/api-validation"
import { exportRequestSchema } from "@/lib/validation/schemas"
import { propertiesForExport } from "@/lib/export/query"
import {
  categorise,
  licenceExpiry,
  LICENCE_LABELS,
  type CategorisableProperty,
} from "@/lib/properties/category"
import { jsPDF } from "jspdf"

/**
 * A PDF has to fit on pages, so unlike the CSV it is capped. The cap is
 * printed on the document — the old one dropped everything past row 100 in
 * silence, which reads as "these are all of them".
 */
const MAX_ROWS = 100

// POST - Export properties to PDF
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

  try {
    const { propertyIds, filters, segment } = validation.data

    // Export is a Pro capability, so the answer does not depend on the result
    // set — refuse before running the query rather than after.
    // See lib/export/query.ts for why this route no longer builds its own.
    if (!(await userCan(user.id, "export"))) {
      return NextResponse.json(
        { error: lockReason("free", "export"), upgradeRequired: true },
        { status: 403 },
      )
    }

    const matched = await propertiesForExport(filters, segment, propertyIds)

    if (matched.length === 0) {
      return NextResponse.json(
        { error: "No properties match these filters, so there is nothing to export." },
        { status: 400 }
      )
    }


    const properties = matched.slice(0, MAX_ROWS)
    const omitted = matched.length - properties.length

    // Generate PDF
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    })

    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 15
    let yPosition = margin

    // Helper function to add a new page if needed
    const checkPageBreak = (requiredSpace: number) => {
      if (yPosition + requiredSpace > pageHeight - margin) {
        pdf.addPage()
        yPosition = margin
        return true
      }
      return false
    }

    // Title
    pdf.setFontSize(20)
    pdf.setTextColor(13, 148, 136) // Teal color
    pdf.text("HMO Hunter - Property Export", margin, yPosition)
    yPosition += 8

    // Subtitle with date, and the count actually printed versus the count matched.
    pdf.setFontSize(10)
    pdf.setTextColor(100, 116, 139) // Slate color
    const countLine =
      omitted > 0
        ? `${properties.length} of ${matched.length} properties — this PDF is limited to ${MAX_ROWS} rows, so ${omitted} are not shown. Export as CSV for the full set.`
        : `${properties.length} properties`
    pdf.text(`Generated on ${new Date().toLocaleDateString("en-GB")} | ${countLine}`, margin, yPosition)
    yPosition += 12

    // Table headers. Yield and Score are gone with the features that produced
    // them; gross_yield was never a column on the table at all. What replaces
    // them is the licence state and its expiry, which are published facts.
    const columns = [
      { header: "Address", width: 58 },
      { header: "Postcode", width: 22 },
      { header: "City", width: 24 },
      { header: "Asking price", width: 26 },
      { header: "Beds", width: 13 },
      { header: "Type", width: 26 },
      { header: "Licence", width: 40 },
      { header: "Expires", width: 24 },
      { header: "EPC", width: 12 },
      { header: "Article 4", width: 22 },
    ]

    // Draw table header
    pdf.setFillColor(241, 245, 249) // Slate-100
    pdf.rect(margin, yPosition - 5, pageWidth - margin * 2, 8, "F")

    pdf.setFontSize(8)
    pdf.setTextColor(71, 85, 105) // Slate-600
    pdf.setFont("helvetica", "bold")

    let xPosition = margin
    columns.forEach(col => {
      pdf.text(col.header, xPosition + 2, yPosition)
      xPosition += col.width
    })
    yPosition += 6

    // Draw table rows
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(15, 23, 42) // Slate-900

    properties.forEach((property, index) => {
      checkPageBreak(10)

      // Alternate row background
      if (index % 2 === 0) {
        pdf.setFillColor(248, 250, 252) // Slate-50
        pdf.rect(margin, yPosition - 4, pageWidth - margin * 2, 7, "F")
      }

      xPosition = margin

      // Asking price only. This used to fall back to price_pcm for anything not
      // for sale, printing our own city-average rent estimate in a column
      // headed "Price" as though a vendor were asking it.
      const price = property.purchase_price
        ? formatPrice(property.purchase_price)
        : "Off market"

      const category = categorise(property as CategorisableProperty)
      const expiry = licenceExpiry(property)

      const rowData = [
        truncateText(property.address || "", 34),
        property.postcode || "",
        truncateText(property.city || "", 13),
        price,
        property.bedrooms?.toString() || "-",
        truncateText(property.property_type || "", 14),
        // hmo_status was compared against "licensed", a value it never holds —
        // the column stores "Licensed HMO" — so this column read "No" on every
        // row, including 494 licensed ones.
        truncateText(LICENCE_LABELS[category.licence], 22),
        expiry ? new Date(expiry).toLocaleDateString("en-GB") : "-",
        property.epc_rating || "-",
        articleFourLabel(property.article_4_status),
      ]

      rowData.forEach((value, colIndex) => {
        pdf.text(value, xPosition + 2, yPosition)
        xPosition += columns[colIndex].width
      })

      yPosition += 6
    })

    // Footer
    yPosition += 10
    checkPageBreak(20)
    pdf.setFontSize(8)
    pdf.setTextColor(148, 163, 184) // Slate-400
    pdf.text("HMO Hunter - Property Intelligence Platform | hmohunter.co.uk", margin, yPosition)

    // Get PDF as buffer
    const pdfBuffer = Buffer.from(pdf.output("arraybuffer"))

    // Return PDF with proper headers
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="hmo-hunter-export-${new Date().toISOString().split("T")[0]}.pdf"`,
        "X-Export-Rows": String(properties.length),
        "X-Export-Rows-Omitted": String(omitted),
      }
    })
  } catch (error) {
    console.error("[Export PDF] Error:", error)
    return NextResponse.json({ error: "PDF export failed" }, { status: 500 })
  }
}

function formatPrice(price: number | null | undefined): string {
  if (!price) return "-"
  if (price >= 1000000) return `£${(price / 1000000).toFixed(2)}M`
  if (price >= 1000) return `£${(price / 1000).toFixed(0)}k`
  return `£${price}`
}

/** "unknown" is most of the stock and is a real answer, not a blank. */
function articleFourLabel(status: string | null | undefined): string {
  switch (status) {
    case "in_force":
      return "In force"
    case "none_found":
      return "None found"
    default:
      return "Unverified"
  }
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 2) + ".."
}
