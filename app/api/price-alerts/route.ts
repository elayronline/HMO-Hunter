import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkResourceCap, deductCredits, updateResourceCount } from "@/lib/credits"
import { validateBody } from "@/lib/validation/api-validation"
import { priceAlertCreateSchema, priceAlertUpdateSchema } from "@/lib/validation/schemas"

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

  // Validate request body
  const validation = await validateBody(request, priceAlertCreateSchema)
  if (!validation.success) {
    return validation.error
  }

  const {
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
  } = validation.data

  try {

    // Check resource cap (10 active price alerts max)
    const capCheck = await checkResourceCap(user.id, 'price_alerts')
    if (!capCheck.success) {
      return NextResponse.json({
        error: capCheck.error || "You've reached your price alerts limit (10)",
        limitReached: true,
        current: capCheck.current,
        limit: capCheck.limit,
      }, { status: 429 })
    }

    // Deduct 5 credits for creating a price alert
    const creditResult = await deductCredits(user.id, 'create_price_alert')
    if (!creditResult.success) {
      return NextResponse.json({
        error: creditResult.error || "Insufficient credits",
        insufficientCredits: true,
        creditsRemaining: creditResult.credits_remaining,
        resetAt: creditResult.reset_at,
      }, { status: 429 })
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

    // Update resource count
    await updateResourceCount(user.id, 'price_alerts', 1)

    return NextResponse.json({
      ...alert,
      creditsRemaining: creditResult.credits_remaining,
      warning: creditResult.warning,
    }, { status: 201 })
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

  // Decrement resource count
  await updateResourceCount(user.id, 'price_alerts', -1)

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
