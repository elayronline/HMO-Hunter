import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { deductCredits } from "@/lib/credits"
import { validateBody } from "@/lib/validation/api-validation"
import { pipelineDealCreateSchema, pipelineDealUpdateSchema } from "@/lib/validation/schemas"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const stage = searchParams.get("stage")
  const includeArchived = searchParams.get("include_archived") === "true"

  let query = supabase
    .from("pipeline_deals")
    .select(`
      *,
      property:properties (
        id, address, postcode, city, bedrooms, bathrooms,
        purchase_price, price_pcm, listing_type, hmo_status,
        epc_rating, deal_score, primary_image, owner_name,
        licence_status, hmo_licence_expiry, hmo_classification
      )
    `)
    .eq("user_id", user.id)

  if (stage) {
    query = query.eq("stage", stage)
  }

  if (!includeArchived) {
    query = query.is("archived_at", null)
  }

  const { data: deals, error } = await query.order("updated_at", { ascending: false })

  if (error) {
    console.error("[Pipeline] Error fetching deals:", error)
    return NextResponse.json({ error: "Failed to fetch pipeline deals" }, { status: 500 })
  }

  return NextResponse.json(deals)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const validation = await validateBody(request, pipelineDealCreateSchema)
  if (!validation.success) {
    return validation.error
  }

  const { property_id, stage, label, notes, priority, expected_value } = validation.data

  // Deduct credit
  const creditResult = await deductCredits(user.id, "add_to_pipeline")
  if (!creditResult.success) {
    return NextResponse.json({
      error: creditResult.error || "Insufficient credits",
      insufficientCredits: true,
      creditsRemaining: creditResult.credits_remaining,
    }, { status: 429 })
  }

  const stageHistory = [{ stage: stage || "identified", entered_at: new Date().toISOString() }]

  const { data: deal, error } = await supabase
    .from("pipeline_deals")
    .insert({
      user_id: user.id,
      property_id,
      stage: stage || "identified",
      label,
      notes,
      priority,
      expected_value,
      stage_history: stageHistory,
    })
    .select(`
      *,
      property:properties (
        id, address, postcode, city, bedrooms, purchase_price, price_pcm,
        listing_type, hmo_status, epc_rating, deal_score, primary_image
      )
    `)
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Property is already in your pipeline" }, { status: 409 })
    }
    console.error("[Pipeline] Error creating deal:", error)
    return NextResponse.json({ error: "Failed to add to pipeline" }, { status: 500 })
  }

  return NextResponse.json({
    ...deal,
    creditsRemaining: creditResult.credits_remaining,
    warning: creditResult.warning,
  }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const validation = await validateBody(request, pipelineDealUpdateSchema)
  if (!validation.success) {
    return validation.error
  }

  const { id, stage, ...otherUpdates } = validation.data

  // If stage is changing, update stage history
  const updates: Record<string, unknown> = {
    ...otherUpdates,
    updated_at: new Date().toISOString(),
  }

  if (stage) {
    // Get current deal to update stage history
    const { data: currentDeal } = await supabase
      .from("pipeline_deals")
      .select("stage, stage_history")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (currentDeal && currentDeal.stage !== stage) {
      const history = (currentDeal.stage_history as Array<{ stage: string; entered_at: string; exited_at?: string }>) || []
      const now = new Date().toISOString()

      // Close current stage
      if (history.length > 0) {
        history[history.length - 1].exited_at = now
      }

      // Open new stage
      history.push({ stage, entered_at: now })

      updates.stage = stage
      updates.stage_entered_at = now
      updates.stage_history = history
    }
  }

  const { data: deal, error } = await supabase
    .from("pipeline_deals")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select(`
      *,
      property:properties (
        id, address, postcode, city, bedrooms, purchase_price, price_pcm,
        listing_type, hmo_status, epc_rating, deal_score, primary_image
      )
    `)
    .single()

  if (error) {
    console.error("[Pipeline] Error updating deal:", error)
    return NextResponse.json({ error: "Failed to update deal" }, { status: 500 })
  }

  return NextResponse.json(deal)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const dealId = request.nextUrl.searchParams.get("id")
  if (!dealId) {
    return NextResponse.json({ error: "Deal ID required" }, { status: 400 })
  }

  const { error } = await supabase
    .from("pipeline_deals")
    .delete()
    .eq("id", dealId)
    .eq("user_id", user.id)

  if (error) {
    console.error("[Pipeline] Error deleting deal:", error)
    return NextResponse.json({ error: "Failed to delete deal" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
