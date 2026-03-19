import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Payment Integration Skeleton (Stripe)
 *
 * Prerequisites:
 * 1. npm install stripe
 * 2. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in .env.local
 * 3. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in .env.local
 *
 * This route handles:
 * - GET: Retrieve user's subscription status
 * - POST: Create checkout session for credit top-up
 */

// Credit top-up products
const CREDIT_PACKAGES = [
  { id: "credits_150", name: "150 Credits", credits: 150, price_pence: 999 },
  { id: "credits_500", name: "500 Credits", credits: 500, price_pence: 2499 },
  { id: "credits_1500", name: "1500 Credits", credits: 1500, price_pence: 4999 },
] as const

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Return available packages and user's current subscription
  const { data: credits } = await supabase
    .from("user_credits")
    .select("role, daily_credits, credits_used")
    .eq("user_id", user.id)
    .single()

  return NextResponse.json({
    packages: CREDIT_PACKAGES,
    currentPlan: credits?.role || "standard_pro",
    creditsRemaining: (credits?.daily_credits || 150) - (credits?.credits_used || 0),
    stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { package_id } = body as { package_id: string }

  const pkg = CREDIT_PACKAGES.find(p => p.id === package_id)
  if (!pkg) {
    return NextResponse.json({ error: "Invalid package" }, { status: 400 })
  }

  // Check if Stripe is configured
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({
      error: "Payment system not configured",
      message: "Set STRIPE_SECRET_KEY in environment variables to enable payments.",
    }, { status: 503 })
  }

  try {
    // Dynamic import to avoid build errors when stripe isn't installed
    const { default: Stripe } = await import("stripe")
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-04-30.basil" as any })

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "gbp",
          product_data: { name: pkg.name, description: `${pkg.credits} HMO Hunter credits` },
          unit_amount: pkg.price_pence,
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://hmohunter.co.uk"}/pipeline?payment=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://hmohunter.co.uk"}/pipeline?payment=cancelled`,
      metadata: {
        user_id: user.id,
        package_id: pkg.id,
        credits: String(pkg.credits),
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error("[Payments] Stripe error:", err)
    return NextResponse.json({ error: "Payment creation failed" }, { status: 500 })
  }
}
