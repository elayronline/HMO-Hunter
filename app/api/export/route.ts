import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { deductCredits } from "@/lib/credits"
import { validateBody } from "@/lib/validation/api-validation"
import { exportRequestSchema } from "@/lib/validation/schemas"

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

  const { propertyIds, filters } = validation.data

  try {

    // Deduct 10 credits for CSV export
    const creditResult = await deductCredits(user.id, 'csv_export')
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
      .from('properties')
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
        hmo_licence_start,
        hmo_licence_end,
        hmo_max_occupants,
        epc_rating,
        epc_floor_area,
        owner_name,
        owner_company_name,
        owner_company_number,
        licence_holder_name,
        licence_holder_company,
        deal_score,
        gross_yield,
        source_url,
        created_at,
        updated_at
      `)

    // If specific IDs provided, use those
    if (propertyIds && propertyIds.length > 0) {
      query = query.in('id', propertyIds)
    } else if (filters) {
      // Apply filters
      if (filters.listingType) {
        query = query.eq('listing_type', filters.listingType)
      }
      if (filters.city && filters.city !== 'All Cities') {
        query = query.eq('city', filters.city)
      }
      if (filters.minPrice) {
        if (filters.listingType === 'rent') {
          query = query.gte('price_pcm', filters.minPrice)
        } else {
          query = query.gte('purchase_price', filters.minPrice)
        }
      }
      if (filters.maxPrice) {
        if (filters.listingType === 'rent') {
          query = query.lte('price_pcm', filters.maxPrice)
        } else {
          query = query.lte('purchase_price', filters.maxPrice)
        }
      }
      if (filters.licensedHmoOnly) {
        query = query.eq('hmo_status', 'licensed')
      }
    }

    // Limit to 500 rows max
    query = query.limit(500)

    const { data: properties, error } = await query

    if (error) {
      console.error("[Export] Error fetching properties:", error)
      return NextResponse.json({ error: "Failed to fetch properties" }, { status: 500 })
    }

    if (!properties || properties.length === 0) {
      return NextResponse.json({ error: "No properties to export" }, { status: 400 })
    }

    // Convert to CSV
    const headers = [
      'Address',
      'Postcode',
      'City',
      'Type',
      'Price',
      'Bedrooms',
      'Bathrooms',
      'Property Type',
      'HMO Status',
      'Licence Number',
      'Licence Start',
      'Licence End',
      'Max Occupants',
      'EPC Rating',
      'Floor Area (sqm)',
      'Owner Name',
      'Owner Company',
      'Company Number',
      'Licence Holder',
      'Deal Score',
      'Gross Yield (%)',
      'Source URL'
    ]

    const rows = properties.map(p => [
      escapeCsvValue(p.address),
      escapeCsvValue(p.postcode),
      escapeCsvValue(p.city),
      p.listing_type === 'purchase' ? 'For Sale' : 'To Rent',
      p.listing_type === 'purchase' ? p.purchase_price : p.price_pcm,
      p.bedrooms,
      p.bathrooms,
      escapeCsvValue(p.property_type),
      escapeCsvValue(p.hmo_status),
      escapeCsvValue(p.hmo_licence_number),
      p.hmo_licence_start ? new Date(p.hmo_licence_start).toLocaleDateString() : '',
      p.hmo_licence_end ? new Date(p.hmo_licence_end).toLocaleDateString() : '',
      p.hmo_max_occupants,
      p.epc_rating,
      p.epc_floor_area,
      escapeCsvValue(p.owner_name),
      escapeCsvValue(p.owner_company_name),
      p.owner_company_number,
      escapeCsvValue(p.licence_holder_name),
      p.deal_score,
      p.gross_yield ? p.gross_yield.toFixed(2) : '',
      escapeCsvValue(p.source_url)
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    // Return CSV with proper headers
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="hmo-hunter-export-${new Date().toISOString().split('T')[0]}.csv"`,
        'X-Credits-Remaining': String(creditResult.credits_remaining ?? 0),
        'X-Credits-Warning': creditResult.warning || '',
      }
    })
  } catch (error) {
    console.error("[Export] Error:", error)
    return NextResponse.json({ error: "Export failed" }, { status: 500 })
  }
}

function escapeCsvValue(value: string | null | undefined): string {
  if (!value) return ''
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  const escaped = String(value).replace(/"/g, '""')
  if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
    return `"${escaped}"`
  }
  return escaped
}
