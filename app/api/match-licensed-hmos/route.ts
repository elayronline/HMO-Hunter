import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Normalize address for matching
function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/flat\s*\d+[a-z]?,?\s*/gi, "")
    .replace(/apartment\s*\d+[a-z]?,?\s*/gi, "")
    .replace(/unit\s*\d+[a-z]?,?\s*/gi, "")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { count: totalLicensed } = await supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("licensed_hmo", true)

    const { count: licensedRent } = await supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("licensed_hmo", true)
      .eq("listing_type", "rent")

    const { count: licensedPurchase } = await supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("licensed_hmo", true)
      .eq("listing_type", "purchase")

    const { data: licensedSamples } = await supabase
      .from("properties")
      .select("id, address, postcode, city, listing_type, licensed_hmo, licence_status")
      .eq("licensed_hmo", true)
      .limit(10)

    return NextResponse.json({
      licensedHmoCounts: { total: totalLicensed, rent: licensedRent, purchase: licensedPurchase },
      samples: licensedSamples,
      usage: "POST to cross-reference and mark purchase listings that match licensed HMO addresses",
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get all licensed HMOs with postcodes
    const { data: licensedHmos } = await supabase
      .from("properties")
      .select("id, address, postcode, city")
      .eq("licensed_hmo", true)
      .not("postcode", "is", null)

    if (!licensedHmos || licensedHmos.length === 0) {
      return NextResponse.json({ message: "No licensed HMOs found", matched: 0 })
    }

    // Create lookup by outcode (first part of postcode) for broader matching
    const licensedByOutcode: Record<string, { address: string; normalized: string; fullPostcode: string }[]> = {}
    for (const hmo of licensedHmos) {
      const pc = hmo.postcode?.trim()
      if (!pc) continue
      const outcode = pc.split(" ")[0] // Get first part (e.g., "SW9" from "SW9 8LE")
      if (!licensedByOutcode[outcode]) licensedByOutcode[outcode] = []
      licensedByOutcode[outcode].push({
        address: hmo.address,
        normalized: normalizeAddress(hmo.address),
        fullPostcode: pc,
      })
    }

    const outcodes = Object.keys(licensedByOutcode)
    console.log(`[MatchHMOs] Checking ${outcodes.length} outcodes with licensed HMOs`)

    // Get all purchase properties
    const { data: purchaseProperties } = await supabase
      .from("properties")
      .select("id, address, postcode, city, licensed_hmo")
      .eq("listing_type", "purchase")
      .eq("licensed_hmo", false)
      .not("postcode", "is", null)
      .limit(2000)

    if (!purchaseProperties || purchaseProperties.length === 0) {
      return NextResponse.json({
        message: "No unlicensed purchase properties found",
        licensedOutcodes: outcodes.length,
        matched: 0,
      })
    }

    // Match by outcode and normalized address
    let matched = 0
    let inSameArea = 0
    const matchedProperties: any[] = []

    for (const purchase of purchaseProperties) {
      const pc = purchase.postcode?.trim()
      if (!pc) continue

      const outcode = pc.split(" ")[0]
      if (!licensedByOutcode[outcode]) continue

      inSameArea++
      const normalizedPurchase = normalizeAddress(purchase.address)

      // Check for address match within same outcode area
      const isMatch = licensedByOutcode[outcode].some(licensed => {
        // Check if addresses are similar (contain common parts)
        const purchaseParts = normalizedPurchase.split(" ").filter(p => p.length > 2)
        const licensedParts = licensed.normalized.split(" ").filter(p => p.length > 2)

        // Check for significant overlap (street name, building number)
        const commonParts = purchaseParts.filter(p => licensedParts.includes(p))
        return commonParts.length >= 2 // At least 2 common significant words
      })

      if (isMatch) {
        // Update this purchase property as a licensed HMO
        const { error } = await supabase
          .from("properties")
          .update({
            licensed_hmo: true,
            licence_status: "active",
            hmo_status: "Licensed HMO",
          })
          .eq("id", purchase.id)

        if (!error) {
          matched++
          matchedProperties.push({
            id: purchase.id,
            address: purchase.address,
            postcode: purchase.postcode,
          })
        }
      }
    }

    return NextResponse.json({
      licensedOutcodes: outcodes.length,
      purchasePropertiesChecked: purchaseProperties.length,
      purchaseInLicensedAreas: inSameArea,
      matched,
      matchedProperties: matchedProperties.slice(0, 10),
      message: `Marked ${matched} purchase properties as licensed HMOs`,
    })
  } catch (error) {
    console.error("[MatchHMOs] Error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
