import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"

/**
 * Stripe Webhook Handler
 *
 * Listens for checkout.session.completed events
 * and credits the user's account.
 *
 * Setup: stripe listen --forward-to localhost:3000/api/payments/webhook
 */
export async function POST(request: NextRequest) {
  if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 })
  }

  const body = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }

  try {
    const { default: Stripe } = await import("stripe")
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-04-30.basil" as any })

    const event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any
      const userId = session.metadata?.user_id
      const credits = parseInt(session.metadata?.credits || "0", 10)

      if (userId && credits > 0) {
        const supabase = createServiceRoleClient()

        // Get current credits
        const { data: currentCredits } = await supabase
          .from("user_credits")
          .select("daily_credits, credits_used")
          .eq("user_id", userId)
          .single()

        if (currentCredits) {
          // Add purchased credits to daily allowance (one-time top-up)
          const newCreditsUsed = Math.max(0, currentCredits.credits_used - credits)

          await supabase
            .from("user_credits")
            .update({ credits_used: newCreditsUsed, updated_at: new Date().toISOString() })
            .eq("user_id", userId)

          // Log the adjustment
          await supabase
            .from("credit_adjustments")
            .insert({
              user_id: userId,
              admin_id: userId, // Self-purchase
              adjustment_type: "top_up",
              amount: credits,
              reason: `Stripe purchase: ${session.metadata?.package_id}`,
              previous_credits: currentCredits.credits_used,
              new_credits: newCreditsUsed,
            })

          console.log(`[Payments] Credited ${credits} to user ${userId}`)
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error("[Payments] Webhook error:", err)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 400 })
  }
}
