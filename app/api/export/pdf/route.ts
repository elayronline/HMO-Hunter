import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { deductCredits } from "@/lib/credits"
import { jsPDF } from "jspdf"

// POST - Export properties to PDF
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { propertyIds, filters } = body

    // Deduct 10 credits for PDF export
    const creditResult = await deductCredits(user.id, "csv_export") // Same cost as CSV
    if (!creditResult.success) {
      return NextResponse.json({
        error: creditResult.error || "Insufficient credits",
        insufficientCredits: true,
        creditsRemaining: creditResult.credits_remaining,
        resetAt: creditResult.reset_at,
      }, { status: 429 })
    }

    // Build query based on filters or specific IDs
    let query = supabase
      .from("properties")
      .select(`
        id,
        address,
        postcode,
        city,
        listing_type,
        purchase_price,
        price_pcm,
        bedrooms,
        bathrooms,
        property_type,
        hmo_status,
        hmo_licence_number,
        hmo_licence_end,
        hmo_max_occupants,
        epc_rating,
        epc_floor_area,
        deal_score,
        gross_yield
      `)

    // If specific IDs provided, use those
    if (propertyIds && propertyIds.length > 0) {
      query = query.in("id", propertyIds)
    } else if (filters) {
      // Apply filters
      if (filters.listingType) {
        query = query.eq("listing_type", filters.listingType)
      }
      if (filters.city && filters.city !== "All Cities") {
        query = query.eq("city", filters.city)
      }
      if (filters.minPrice) {
        if (filters.listingType === "rent") {
          query = query.gte("price_pcm", filters.minPrice)
        } else {
          query = query.gte("purchase_price", filters.minPrice)
        }
      }
      if (filters.maxPrice) {
        if (filters.listingType === "rent") {
          query = query.lte("price_pcm", filters.maxPrice)
        } else {
          query = query.lte("purchase_price", filters.maxPrice)
        }
      }
    }

    // Limit to 100 rows for PDF (more results would create very large PDFs)
    query = query.limit(100)

    const { data: properties, error } = await query

    if (error) {
      console.error("[Export PDF] Error fetching properties:", error)
      return NextResponse.json({ error: "Failed to fetch properties" }, { status: 500 })
    }

    if (!properties || properties.length === 0) {
      return NextResponse.json({ error: "No properties to export" }, { status: 400 })
    }

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

    // Subtitle with date
    pdf.setFontSize(10)
    pdf.setTextColor(100, 116, 139) // Slate color
    pdf.text(`Generated on ${new Date().toLocaleDateString("en-GB")} | ${properties.length} properties`, margin, yPosition)
    yPosition += 12

    // Table headers
    const columns = [
      { header: "Address", width: 60 },
      { header: "Postcode", width: 25 },
      { header: "City", width: 25 },
      { header: "Price", width: 25 },
      { header: "Beds", width: 15 },
      { header: "Type", width: 30 },
      { header: "HMO", width: 20 },
      { header: "EPC", width: 15 },
      { header: "Yield", width: 20 },
      { header: "Score", width: 15 },
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
      const price = property.listing_type === "purchase"
        ? formatPrice(property.purchase_price)
        : `${formatPrice(property.price_pcm)}/mo`

      const rowData = [
        truncateText(property.address || "", 35),
        property.postcode || "",
        property.city || "",
        price,
        property.bedrooms?.toString() || "-",
        truncateText(property.property_type || "", 15),
        property.hmo_status === "licensed" ? "Yes" : "No",
        property.epc_rating || "-",
        property.gross_yield ? `${property.gross_yield.toFixed(1)}%` : "-",
        property.deal_score?.toString() || "-",
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
        "X-Credits-Remaining": String(creditResult.credits_remaining ?? 0),
        "X-Credits-Warning": creditResult.warning || "",
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

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 2) + ".."
}
