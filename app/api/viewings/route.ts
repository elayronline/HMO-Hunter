import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { deductCredits } from "@/lib/credits"
import { validateBody } from "@/lib/validation/api-validation"
import { viewingCreateSchema, viewingUpdateSchema } from "@/lib/validation/schemas"
import { sendEmail } from "@/lib/email/resend"
import { viewingConfirmationEmail } from "@/lib/email/templates"
import type { ViewingType } from "@/lib/types/pipeline"
import type { UserType } from "@/components/role-selection-modal"

// Map viewing_type to the correct pipeline stage per ICP
const VIEWING_STAGE_MAP: Record<UserType, Record<ViewingType, string>> = {
  investor: {
    site_visit: "viewing",
    inspection: "viewing",
    portfolio_check: "viewing",
    client_viewing: "viewing",
  },
  council_ta: {
    site_visit: "inspection",
    inspection: "inspection",
    portfolio_check: "inspection",
    client_viewing: "inspection",
  },
  operator: {
    site_visit: "compliance_check",
    inspection: "compliance_check",
    portfolio_check: "compliance_check",
    client_viewing: "compliance_check",
  },
  agent: {
    site_visit: "client_viewing",
    inspection: "client_viewing",
    portfolio_check: "client_viewing",
    client_viewing: "client_viewing",
  },
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const status = searchParams.get("status")
  const upcoming = searchParams.get("upcoming") === "true"
  const propertyId = searchParams.get("property_id")

  let query = supabase
    .from("property_viewings")
    .select(`
      *,
      property:properties (
        id, address, postcode, city, bedrooms, bathrooms,
        purchase_price, price_pcm, listing_type, hmo_status,
        epc_rating, deal_score, primary_image, owner_name,
        agent_name, agent_phone
      ),
      pipeline_deal:pipeline_deals (id, stage, label, priority)
    `)
    .eq("user_id", user.id)

  if (status) {
    query = query.eq("status", status)
  }

  if (propertyId) {
    query = query.eq("property_id", propertyId)
  }

  if (upcoming) {
    query = query
      .in("status", ["scheduled", "confirmed"])
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
  } else {
    query = query.order("scheduled_at", { ascending: false })
  }

  const { data: viewings, error } = await query

  if (error) {
    console.error("[Viewings] Error fetching:", error)
    return NextResponse.json({ error: "Failed to fetch viewings" }, { status: 500 })
  }

  return NextResponse.json(viewings)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const validation = await validateBody(request, viewingCreateSchema)
  if (!validation.success) {
    return validation.error
  }

  const {
    property_id, pipeline_deal_id, viewing_type,
    scheduled_at, duration_minutes, notes,
    attendees, contact_name, contact_phone, contact_email,
  } = validation.data

  // Deduct credit
  const creditResult = await deductCredits(user.id, "schedule_viewing")
  if (!creditResult.success) {
    return NextResponse.json({
      error: creditResult.error || "Insufficient credits",
      insufficientCredits: true,
      creditsRemaining: creditResult.credits_remaining,
    }, { status: 429 })
  }

  const { data: viewing, error } = await supabase
    .from("property_viewings")
    .insert({
      user_id: user.id,
      property_id,
      pipeline_deal_id,
      viewing_type,
      scheduled_at,
      duration_minutes,
      notes,
      attendees: attendees || [],
      contact_name,
      contact_phone,
      contact_email,
    })
    .select(`
      *,
      property:properties (
        id, address, postcode, city, bedrooms, purchase_price,
        price_pcm, hmo_status, primary_image
      )
    `)
    .single()

  if (error) {
    console.error("[Viewings] Error creating:", error)
    return NextResponse.json({ error: "Failed to schedule viewing" }, { status: 500 })
  }

  // If linked to pipeline, auto-advance stage based on ICP
  if (pipeline_deal_id) {
    const userType = (user.user_metadata?.user_type as UserType) || "investor"
    const stageMap = VIEWING_STAGE_MAP[userType] || VIEWING_STAGE_MAP.investor
    const targetStage = stageMap[viewing_type as ViewingType]

    // Stages that already represent a viewing — don't re-advance
    const viewingStages = Object.values(stageMap)
    const { data: deal } = await supabase
      .from("pipeline_deals")
      .select("stage, stage_history")
      .eq("id", pipeline_deal_id)
      .eq("user_id", user.id)
      .single()

    if (deal && !viewingStages.includes(deal.stage)) {
      const history = (deal.stage_history as Array<{ stage: string; entered_at: string; exited_at?: string }>) || []
      const now = new Date().toISOString()
      if (history.length > 0) {
        history[history.length - 1].exited_at = now
      }
      history.push({ stage: targetStage, entered_at: now })

      await supabase
        .from("pipeline_deals")
        .update({
          stage: targetStage,
          stage_entered_at: now,
          stage_history: history,
          updated_at: now,
        })
        .eq("id", pipeline_deal_id)
    }
  }

  // Send viewing confirmation email
  const property = viewing.property as { address?: string; postcode?: string } | null
  if (property?.address && user.email) {
    const emailData = viewingConfirmationEmail({
      userName: user.user_metadata?.full_name || user.email.split("@")[0],
      propertyAddress: property.address,
      propertyPostcode: property.postcode || "",
      scheduledAt: scheduled_at,
      viewingType: viewing_type,
      contactName: contact_name,
      contactPhone: contact_phone,
      propertyUrl: `https://hmohunter.co.uk/property/${property_id}`,
    })

    // Fire and forget — don't block the response
    sendEmail({
      to: user.email,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
    }).catch(err => console.error("[Viewings] Email send failed:", err))
  }

  return NextResponse.json({
    ...viewing,
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

  const validation = await validateBody(request, viewingUpdateSchema)
  if (!validation.success) {
    return validation.error
  }

  const { id, ...updates } = validation.data

  const { data: viewing, error } = await supabase
    .from("property_viewings")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select(`
      *,
      property:properties (
        id, address, postcode, city, bedrooms, purchase_price,
        price_pcm, hmo_status, primary_image
      )
    `)
    .single()

  if (error) {
    console.error("[Viewings] Error updating:", error)
    return NextResponse.json({ error: "Failed to update viewing" }, { status: 500 })
  }

  return NextResponse.json(viewing)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const viewingId = request.nextUrl.searchParams.get("id")
  if (!viewingId) {
    return NextResponse.json({ error: "Viewing ID required" }, { status: 400 })
  }

  const { error } = await supabase
    .from("property_viewings")
    .delete()
    .eq("id", viewingId)
    .eq("user_id", user.id)

  if (error) {
    console.error("[Viewings] Error deleting:", error)
    return NextResponse.json({ error: "Failed to delete viewing" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
