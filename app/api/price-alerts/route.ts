import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: alerts, error } = await supabase
    .from("price_alerts")
    .select(`
      *,
      properties (
        id,
        address,
        postcode,
        purchase_price,
        price_pcm,
        listing_type,
        bedrooms,
        primary_image
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[PriceAlerts] Error fetching alerts:", error)
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 })
  }

  return NextResponse.json(alerts)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()

    const {
      alert_type,
      property_id,
      search_criteria,
      target_price,
      price_direction,
      postcode,
      area,
      radius_miles,
      notify_email = true,
      notify_push = false,
      frequency = "instant",
    } = body

    // Validate alert type
    if (!["price_drop", "new_listing", "price_threshold", "area_watch"].includes(alert_type)) {
      return NextResponse.json({ error: "Invalid alert type" }, { status: 400 })
    }

    // For price_drop alerts, property_id is required
    if (alert_type === "price_drop" && !property_id) {
      return NextResponse.json({ error: "Property ID required for price drop alerts" }, { status: 400 })
    }

    const { data: alert, error } = await supabase
      .from("price_alerts")
      .insert({
        user_id: user.id,
        alert_type,
        property_id,
        search_criteria,
        target_price,
        price_direction,
        postcode,
        area,
        radius_miles,
        notify_email,
        notify_push,
        frequency,
      })
      .select()
      .single()

    if (error) {
      console.error("[PriceAlerts] Error creating alert:", error)
      return NextResponse.json({ error: "Failed to create alert" }, { status: 500 })
    }

    // If it's a price drop alert, also create a watched property entry
    if (alert_type === "price_drop" && property_id) {
      const { data: property } = await supabase
        .from("properties")
        .select("purchase_price, price_pcm")
        .eq("id", property_id)
        .single()

      if (property) {
        const currentPrice = property.purchase_price || property.price_pcm

        await supabase
          .from("watched_properties")
          .upsert({
            user_id: user.id,
            property_id,
            initial_price: currentPrice,
            current_price: currentPrice,
            lowest_price: currentPrice,
            highest_price: currentPrice,
            price_history: [{ price: currentPrice, date: new Date().toISOString() }],
          }, {
            onConflict: "user_id,property_id",
          })
      }
    }

    return NextResponse.json(alert, { status: 201 })
  } catch (error) {
    console.error("[PriceAlerts] Error:", error)
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const alertId = searchParams.get("id")

  if (!alertId) {
    return NextResponse.json({ error: "Alert ID required" }, { status: 400 })
  }

  const { error } = await supabase
    .from("price_alerts")
    .delete()
    .eq("id", alertId)
    .eq("user_id", user.id)

  if (error) {
    console.error("[PriceAlerts] Error deleting alert:", error)
    return NextResponse.json({ error: "Failed to delete alert" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: "Alert ID required" }, { status: 400 })
    }

    // Only allow updating specific fields
    const allowedFields = ["is_active", "notify_email", "notify_push", "frequency", "target_price", "price_direction"]
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key]) => allowedFields.includes(key))
    )

    const { data: alert, error } = await supabase
      .from("price_alerts")
      .update({ ...filteredUpdates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error) {
      console.error("[PriceAlerts] Error updating alert:", error)
      return NextResponse.json({ error: "Failed to update alert" }, { status: 500 })
    }

    return NextResponse.json(alert)
  } catch (error) {
    console.error("[PriceAlerts] Error:", error)
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
}
