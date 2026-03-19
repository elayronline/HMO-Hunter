import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { deductCredits } from "@/lib/credits"
import { validateBody } from "@/lib/validation/api-validation"
import { d2vCampaignCreateSchema, d2vCampaignSendSchema } from "@/lib/validation/schemas"
import { sendLetter, isStannpConfigured } from "@/lib/integrations/stannp"

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: campaigns, error } = await supabase
    .from("d2v_campaigns")
    .select(`
      *,
      template:d2v_templates (id, name, channel)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[D2V Campaigns] Error fetching:", error)
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 })
  }

  return NextResponse.json(campaigns)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const validation = await validateBody(request, d2vCampaignCreateSchema)
  if (!validation.success) {
    return validation.error
  }

  const { name, template_id, channel, property_ids } = validation.data

  // Get template if specified
  let template = null
  if (template_id) {
    const { data } = await supabase
      .from("d2v_templates")
      .select("*")
      .eq("id", template_id)
      .eq("user_id", user.id)
      .single()
    template = data
  }

  // Get property data for recipients
  const { data: properties } = await supabase
    .from("properties")
    .select("id, address, postcode, city, owner_name, owner_contact_email, licence_holder_name, licence_holder_email, bedrooms, epc_rating, licence_status, hmo_licence_expiry")
    .in("id", property_ids)

  if (!properties || properties.length === 0) {
    return NextResponse.json({ error: "No valid properties found" }, { status: 400 })
  }

  // Create campaign
  const { data: campaign, error: campaignError } = await supabase
    .from("d2v_campaigns")
    .insert({
      user_id: user.id,
      name,
      template_id,
      channel,
      total_recipients: properties.length,
    })
    .select()
    .single()

  if (campaignError) {
    console.error("[D2V Campaigns] Error creating:", campaignError)
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 })
  }

  // Create recipients
  const recipients = properties.map(p => ({
    campaign_id: campaign.id,
    property_id: p.id,
    recipient_name: p.owner_name || p.licence_holder_name || "Property Owner",
    recipient_email: channel === "email" ? (p.owner_contact_email || p.licence_holder_email) : null,
    recipient_address: channel === "letter" ? `${p.address}, ${p.postcode}` : null,
    merge_data: {
      owner_name: p.owner_name || "Property Owner",
      property_address: p.address,
      property_postcode: p.postcode,
      property_city: p.city || "",
      bedrooms: String(p.bedrooms || ""),
      epc_rating: p.epc_rating || "Unknown",
      licence_status: p.licence_status || "Unknown",
      licence_expiry: p.hmo_licence_expiry || "",
      date: new Date().toLocaleDateString("en-GB"),
    },
  }))

  const { error: recipientError } = await supabase
    .from("d2v_recipients")
    .insert(recipients)

  if (recipientError) {
    console.error("[D2V Campaigns] Error creating recipients:", recipientError)
  }

  return NextResponse.json(campaign, { status: 201 })
}

// Send a campaign
export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const validation = await validateBody(request, d2vCampaignSendSchema)
  if (!validation.success) {
    return validation.error
  }

  const { campaign_id } = validation.data

  // Get campaign with template and recipients
  const { data: campaign } = await supabase
    .from("d2v_campaigns")
    .select("*, template:d2v_templates (*)")
    .eq("id", campaign_id)
    .eq("user_id", user.id)
    .single()

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
  }

  if (campaign.status !== "draft") {
    return NextResponse.json({ error: "Campaign has already been sent" }, { status: 400 })
  }

  // Get pending recipients
  const { data: recipients } = await supabase
    .from("d2v_recipients")
    .select("*")
    .eq("campaign_id", campaign_id)
    .eq("status", "pending")

  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ error: "No pending recipients" }, { status: 400 })
  }

  // Deduct credits per recipient
  const creditAction = campaign.channel === "email" ? "d2v_send_email" : "d2v_send_letter"
  const creditResult = await deductCredits(user.id, creditAction as "d2v_send_email" | "d2v_send_letter", recipients.length)
  if (!creditResult.success) {
    return NextResponse.json({
      error: creditResult.error || "Insufficient credits",
      insufficientCredits: true,
      creditsRequired: recipients.length * (campaign.channel === "email" ? 2 : 3),
      creditsRemaining: creditResult.credits_remaining,
    }, { status: 429 })
  }

  // Update campaign status
  await supabase
    .from("d2v_campaigns")
    .update({ status: "sending", updated_at: new Date().toISOString() })
    .eq("id", campaign_id)

  // Process campaign based on channel
  let sentCount = 0
  let failedCount = 0

  if (campaign.channel === "email") {
    // EMAIL: Merge templates and generate mailto: links for each recipient.
    // The user sends emails themselves — we just prepare the data and track it.
    for (const recipient of recipients) {
      if (!recipient.recipient_email) {
        failedCount++
        await supabase
          .from("d2v_recipients")
          .update({ status: "failed", error_message: "No email address" })
          .eq("id", recipient.id)
        continue
      }

      // Merge template with recipient data
      let emailBody = campaign.template?.body || ""
      let emailSubject = campaign.template?.subject || "Property Enquiry"
      const mergeData = recipient.merge_data as Record<string, string>

      for (const [key, value] of Object.entries(mergeData)) {
        emailBody = emailBody.replaceAll(`{{${key}}}`, value)
        emailSubject = emailSubject.replaceAll(`{{${key}}}`, value)
      }

      // Build mailto: link for the user to click
      const mailtoLink = `mailto:${encodeURIComponent(recipient.recipient_email)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`

      sentCount++
      await supabase
        .from("d2v_recipients")
        .update({
          status: "delivered",
          sent_at: new Date().toISOString(),
          merge_data: {
            ...mergeData,
            merged_subject: emailSubject,
            merged_body: emailBody,
            mailto_link: mailtoLink,
          },
        })
        .eq("id", recipient.id)
    }
  } else if (campaign.channel === "letter") {
    // LETTER: Send via Stannp postal API (real physical letters)
    for (const recipient of recipients) {
      if (!recipient.recipient_address) {
        failedCount++
        await supabase
          .from("d2v_recipients")
          .update({ status: "failed", error_message: "No postal address" })
          .eq("id", recipient.id)
        continue
      }

      // Merge template
      let letterBody = campaign.template?.body || ""
      const mergeData = recipient.merge_data as Record<string, string>
      for (const [key, value] of Object.entries(mergeData)) {
        letterBody = letterBody.replaceAll(`{{${key}}}`, value)
      }

      // Parse name into first/last
      const nameParts = (recipient.recipient_name || "Property Owner").split(" ")
      const firstName = nameParts[0] || "Property"
      const lastName = nameParts.slice(1).join(" ") || "Owner"

      // Parse address into components
      const addressParts = (recipient.recipient_address || "").split(",").map((s: string) => s.trim())
      const postcode = mergeData.property_postcode || addressParts[addressParts.length - 1] || ""
      const city = mergeData.property_city || addressParts[addressParts.length - 2] || ""
      const address1 = addressParts[0] || ""

      if (isStannpConfigured()) {
        // Send via Stannp (real postal delivery)
        const result = await sendLetter({
          recipient: {
            firstname: firstName,
            lastname: lastName,
            address1,
            city,
            postcode,
          },
          body: letterBody,
        })

        if (result.success) {
          sentCount++
          await supabase
            .from("d2v_recipients")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              merge_data: { ...mergeData, merged_letter_body: letterBody, stannp_id: result.data?.id, stannp_cost: result.data?.cost },
            })
            .eq("id", recipient.id)
        } else {
          failedCount++
          await supabase
            .from("d2v_recipients")
            .update({ status: "failed", error_message: result.error || "Stannp send failed" })
            .eq("id", recipient.id)
        }
      } else {
        // Stannp not configured — prepare letter for manual download/print
        sentCount++
        await supabase
          .from("d2v_recipients")
          .update({
            status: "delivered",
            sent_at: new Date().toISOString(),
            merge_data: { ...mergeData, merged_letter_body: letterBody },
          })
          .eq("id", recipient.id)
      }
    }
  }

  // Update campaign final status
  await supabase
    .from("d2v_campaigns")
    .update({
      status: failedCount === recipients.length ? "failed" : "sent",
      sent_count: sentCount,
      failed_count: failedCount,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaign_id)

  return NextResponse.json({
    success: true,
    sent_count: sentCount,
    failed_count: failedCount,
    creditsRemaining: creditResult.credits_remaining,
    warning: creditResult.warning,
  })
}
