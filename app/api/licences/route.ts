import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * GET /api/licences
 * Fetch licences for a property or list all licence types
 *
 * Query params:
 * - property_id: UUID of property to fetch licences for
 * - types_only: If true, only return licence type definitions
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const propertyId = searchParams.get("property_id")
  const typesOnly = searchParams.get("types_only") === "true"

  try {
    // Return just the licence type definitions
    if (typesOnly) {
      const { data: types, error } = await supabaseAdmin
        .from("licence_types")
        .select("*")
        .eq("is_active", true)
        .order("display_order")

      if (error) throw error

      return NextResponse.json({ types })
    }

    // Return licences for a specific property
    if (propertyId) {
      const { data: licences, error } = await supabaseAdmin
        .from("property_licences")
        .select(`
          *,
          licence_types (
            name,
            description,
            display_order
          )
        `)
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false })

      if (error) throw error

      // Flatten the joined data
      const formattedLicences = licences?.map((l) => ({
        ...l,
        licence_type_name: l.licence_types?.name,
        licence_type_description: l.licence_types?.description,
        display_order: l.licence_types?.display_order,
        licence_types: undefined,
      }))

      return NextResponse.json({ licences: formattedLicences || [] })
    }

    // Return summary of all licences
    const { data: summary, error } = await supabaseAdmin
      .from("property_licences")
      .select("licence_type_code, status")

    if (error) throw error

    // Count by type and status
    const counts: Record<string, { total: number; active: number; expired: number }> = {}
    summary?.forEach((l) => {
      if (!counts[l.licence_type_code]) {
        counts[l.licence_type_code] = { total: 0, active: 0, expired: 0 }
      }
      counts[l.licence_type_code].total++
      if (l.status === "active") counts[l.licence_type_code].active++
      if (l.status === "expired") counts[l.licence_type_code].expired++
    })

    return NextResponse.json({ counts })

  } catch (error) {
    console.error("Error fetching licences:", error)
    return NextResponse.json(
      { error: "Failed to fetch licences" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/licences
 * Add or update a licence for a property
 *
 * Body: {
 *   property_id: string
 *   licence_type_code: string
 *   licence_number?: string
 *   start_date?: string
 *   end_date?: string
 *   source?: string
 *   source_url?: string
 *   max_occupants?: number
 *   max_households?: number
 *   conditions?: string[]
 *   raw_data?: object
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      property_id,
      licence_type_code,
      licence_number,
      start_date,
      end_date,
      source = "manual",
      source_url,
      max_occupants,
      max_households,
      conditions,
      raw_data,
    } = body

    // Validate required fields
    if (!property_id || !licence_type_code) {
      return NextResponse.json(
        { error: "property_id and licence_type_code are required" },
        { status: 400 }
      )
    }

    // Get the licence type ID
    const { data: licenceType } = await supabaseAdmin
      .from("licence_types")
      .select("id")
      .eq("code", licence_type_code)
      .single()

    // Calculate status based on dates
    let status = "unknown"
    if (start_date && end_date) {
      const now = new Date()
      const startDt = new Date(start_date)
      const endDt = new Date(end_date)
      if (endDt < now) status = "expired"
      else if (startDt > now) status = "pending"
      else status = "active"
    } else if (end_date) {
      const endDt = new Date(end_date)
      status = endDt < new Date() ? "expired" : "active"
    }

    // Upsert the licence
    const { data: licence, error } = await supabaseAdmin
      .from("property_licences")
      .upsert(
        {
          property_id,
          licence_type_id: licenceType?.id || null,
          licence_type_code,
          licence_number: licence_number || null,
          start_date: start_date || null,
          end_date: end_date || null,
          status,
          source,
          source_url: source_url || null,
          max_occupants: max_occupants || null,
          max_households: max_households || null,
          conditions: conditions || null,
          raw_data: raw_data || null,
          verified_at: new Date().toISOString(),
        },
        {
          onConflict: "property_id,licence_type_code,licence_number",
        }
      )
      .select()
      .single()

    if (error) throw error

    // Also update the legacy licensed_hmo field on the property
    if (status === "active") {
      await supabaseAdmin
        .from("properties")
        .update({ licensed_hmo: true })
        .eq("id", property_id)
    }

    return NextResponse.json({
      success: true,
      licence,
      message: "Licence saved successfully",
    })

  } catch (error) {
    console.error("Error saving licence:", error)
    return NextResponse.json(
      { error: "Failed to save licence" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/licences
 * Remove a licence
 *
 * Query params:
 * - id: UUID of the licence to delete
 */
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const licenceId = searchParams.get("id")

  if (!licenceId) {
    return NextResponse.json(
      { error: "Licence ID is required" },
      { status: 400 }
    )
  }

  try {
    const { error } = await supabaseAdmin
      .from("property_licences")
      .delete()
      .eq("id", licenceId)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: "Licence deleted successfully",
    })

  } catch (error) {
    console.error("Error deleting licence:", error)
    return NextResponse.json(
      { error: "Failed to delete licence" },
      { status: 500 }
    )
  }
}
