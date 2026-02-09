import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * POST /api/fix-listing-types
 *
 * One-time migration to fix properties where source_url contains "/to-rent/"
 * but listing_type is incorrectly set to "purchase". Moves the purchase_price
 * value to price_pcm and sets listing_type to "rent".
 *
 * Also detects rent listings where annual rent was stored as monthly
 * (price_pcm suspiciously high per bedroom outside central London).
 *
 * Requires CRON_SECRET for authorization.
 */

// Central London postcodes where high per-bedroom rents are normal
const CENTRAL_LONDON_PATTERN = /^(W[1-9]|W1[0-4]|WC[12]|SW[1-9]|SW1[0-2]|SE1|EC[1-4]|NW[1-9]|N1|E1)\b/i

export async function POST(request: Request) {
  // Auth check
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = supabaseAdmin
  const results = {
    totalMisclassified: 0,
    fixedMisclassified: 0,
    totalSuspiciousRent: 0,
    fixedAnnualToMonthly: 0,
    errors: [] as string[],
  }

  // Track IDs fixed in first pass to avoid double-processing
  const fixedIds = new Set<string>()

  try {
    // --- Pass 1: Fix purchase listings with rental source URLs ---
    const { data: misclassified, error: fetchError } = await supabase
      .from("properties")
      .select("id, address, postcode, listing_type, purchase_price, price_pcm, source_url")
      .eq("listing_type", "purchase")
      .ilike("source_url", "%/to-rent/%")

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    results.totalMisclassified = misclassified?.length || 0

    if (misclassified && misclassified.length > 0) {
      for (const property of misclassified) {
        try {
          // Prefer existing price_pcm (if set) over purchase_price
          const correctPricePcm = property.price_pcm ?? property.purchase_price

          const { error: updateError } = await supabase
            .from("properties")
            .update({
              listing_type: "rent",
              price_pcm: correctPricePcm,
              purchase_price: null,
            })
            .eq("id", property.id)

          if (updateError) {
            results.errors.push(`${property.id} (${property.address}): ${updateError.message}`)
          } else {
            results.fixedMisclassified++
            fixedIds.add(property.id)
          }
        } catch (err) {
          results.errors.push(`${property.id}: ${err instanceof Error ? err.message : "Unknown error"}`)
        }
      }
    }

    // --- Pass 2: Fix rent listings with annual rent stored as monthly ---
    const { data: suspiciousRent, error: suspiciousError } = await supabase
      .from("properties")
      .select("id, address, postcode, bedrooms, price_pcm")
      .eq("listing_type", "rent")
      .gt("price_pcm", 0)
      .gt("bedrooms", 0)

    if (suspiciousError) {
      results.errors.push(`Suspicious rent query failed: ${suspiciousError.message}`)
    } else if (suspiciousRent) {
      const suspiciousRecords = suspiciousRent.filter(p => {
        // Skip properties already fixed in pass 1
        if (fixedIds.has(p.id)) return false
        if (!p.bedrooms || !p.price_pcm) return false
        const perBedroom = p.price_pcm / p.bedrooms
        // £2,500/bedroom/month is extremely high outside central London
        return perBedroom > 2500 && !p.postcode?.match(CENTRAL_LONDON_PATTERN)
      })

      results.totalSuspiciousRent = suspiciousRecords.length

      for (const property of suspiciousRecords) {
        // Check if dividing by 12 gives a reasonable per-bedroom price
        const monthlyEstimate = property.price_pcm / 12
        const perBedroomMonthly = monthlyEstimate / property.bedrooms
        if (perBedroomMonthly >= 200 && perBedroomMonthly <= 1500) {
          // Likely annual rent stored as monthly — fix it
          const { error: fixError } = await supabase
            .from("properties")
            .update({ price_pcm: Math.round(monthlyEstimate) })
            .eq("id", property.id)

          if (!fixError) {
            results.fixedAnnualToMonthly++
          } else {
            results.errors.push(`${property.id} (annual->monthly): ${fixError.message}`)
          }
        }
      }
    }

    const totalFixed = results.fixedMisclassified + results.fixedAnnualToMonthly
    return NextResponse.json({
      message: `Fixed ${totalFixed} listings (${results.fixedMisclassified} misclassified, ${results.fixedAnnualToMonthly} annual-as-monthly)`,
      ...results,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
