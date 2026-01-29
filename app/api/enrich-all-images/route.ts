import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Batch endpoint to enrich all properties that don't have images
 *
 * Usage:
 *   POST /api/enrich-all-images
 *   Body: { limit?: number, offset?: number }
 *
 * This will:
 * 1. Find properties without real images
 * 2. For each, call the enrich-property-images API
 * 3. Return summary of enriched properties
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const limit = body.limit || 50
    const offset = body.offset || 0

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Find properties that need image enrichment
    // Properties with null images, empty images, or only stock/streetview images
    const { data: properties, error } = await supabase
      .from("properties")
      .select("id, address, postcode, external_id, images")
      .or("images.is.null,images.eq.{}")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error("[EnrichAll] Failed to fetch properties:", error)
      return NextResponse.json({ error: "Failed to fetch properties" }, { status: 500 })
    }

    console.log(`[EnrichAll] Found ${properties?.length || 0} properties to enrich (offset: ${offset}, limit: ${limit})`)

    if (!properties || properties.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No properties need enrichment",
        enriched: 0,
        failed: 0,
        total: 0
      })
    }

    const results = {
      enriched: 0,
      failed: 0,
      skipped: 0,
      details: [] as any[]
    }

    // Process each property
    const baseUrl = request.nextUrl.origin

    for (const property of properties) {
      try {
        // Check if already has real images
        const realImages = (property.images || []).filter((img: string) =>
          img &&
          !img.includes("placeholder") &&
          !img.includes("stock") &&
          !img.includes("unsplash") &&
          !img.includes("maps.googleapis.com")
        )

        if (realImages.length >= 3) {
          results.skipped++
          continue
        }

        // Call the enrichment API
        const response = await fetch(`${baseUrl}/api/enrich-property-images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ propertyId: property.id })
        })

        const result = await response.json()

        if (result.success && result.images?.length > 0) {
          results.enriched++
          results.details.push({
            id: property.id,
            address: property.address,
            images: result.images.length,
            source: result.source
          })
        } else {
          results.failed++
        }

        // Rate limiting - wait between requests
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (err) {
        console.error(`[EnrichAll] Error enriching property ${property.id}:`, err)
        results.failed++
      }
    }

    console.log(`[EnrichAll] Complete: ${results.enriched} enriched, ${results.failed} failed, ${results.skipped} skipped`)

    return NextResponse.json({
      success: true,
      enriched: results.enriched,
      failed: results.failed,
      skipped: results.skipped,
      total: properties.length,
      details: results.details
    })

  } catch (error) {
    console.error("[EnrichAll] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * GET endpoint to check how many properties need enrichment
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Count properties by image status
    const { count: totalCount } = await supabase
      .from("properties")
      .select("*", { count: "exact", head: true })

    const { count: noImagesCount } = await supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .or("images.is.null,images.eq.{}")

    const { count: zooplaCount } = await supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .like("external_id", "zoopla-%")

    return NextResponse.json({
      total: totalCount || 0,
      needsEnrichment: noImagesCount || 0,
      zooplaSourced: zooplaCount || 0,
      estimatedEnrichable: Math.min(noImagesCount || 0, zooplaCount || 0)
    })

  } catch (error) {
    console.error("[EnrichAll] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
