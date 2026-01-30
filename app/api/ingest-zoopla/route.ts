import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { ZooplaAdapter } from "@/lib/ingestion/adapters/zoopla"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const zoopla = new ZooplaAdapter()

/**
 * Ingest properties directly from Zoopla
 * These will have proper external_id format (zoopla-{listing_id}) for 100% accurate images
 *
 * Usage:
 *   POST /api/ingest-zoopla
 *   Body: { postcode?: string, area?: string, listingType?: "rent" | "sale", limit?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { postcode, area, listingType = "rent", limit = 20 } = body

    if (!postcode && !area) {
      return NextResponse.json(
        { error: "Either postcode or area is required" },
        { status: 400 }
      )
    }

    console.log(`[IngestZoopla] Fetching ${listingType} properties for ${postcode || area}...`)

    // Fetch from Zoopla
    const listings = await zoopla.fetch({
      postcode,
      area,
      listingType,
      pageSize: Math.min(limit, 100),
      radius: 1,
    })

    if (listings.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No listings found",
        created: 0,
        updated: 0,
        total: 0,
      })
    }

    console.log(`[IngestZoopla] Found ${listings.length} listings from Zoopla`)

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const now = new Date().toISOString()

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
      properties: [] as any[],
    }

    for (const listing of listings) {
      try {
        // Check for existing property by external_id
        const { data: existing } = await supabase
          .from("properties")
          .select("id, external_id, images")
          .eq("external_id", listing.external_id)
          .maybeSingle()

        // Determine HMO potential based on bedrooms (3+ bedrooms = potential HMO)
        const isPotentialHmo = listing.bedrooms >= 3
        // Classify HMO opportunity type
        const hmoClassification = isPotentialHmo
          ? (listing.bedrooms >= 5 ? "ready_to_go" : "value_add")
          : null

        const propertyData = {
          title: listing.title,
          address: listing.address,
          postcode: listing.postcode,
          city: listing.city,
          latitude: listing.latitude,
          longitude: listing.longitude,
          price_pcm: listing.price_pcm,
          purchase_price: listing.purchase_price,
          listing_type: listing.listing_type,
          property_type: listing.property_type,
          bedrooms: listing.bedrooms,
          bathrooms: listing.bathrooms,
          description: listing.description,
          images: listing.images, // Zoopla images with high-res
          floor_plans: listing.floor_plans,
          primary_image: listing.images?.[0],
          is_furnished: listing.is_furnished,
          is_student_friendly: listing.is_student_friendly,
          is_pet_friendly: listing.is_pet_friendly,
          source_name: "Zoopla",
          source_url: listing.source_url,
          external_id: listing.external_id, // zoopla-{listing_id}
          media_source_url: "zoopla_direct",
          hmo_status: isPotentialHmo ? "Potential HMO" : "Standard",
          is_potential_hmo: isPotentialHmo,
          hmo_classification: hmoClassification,
          last_synced: now,
          last_seen_at: now,
          is_stale: false,
          // Agent contact info from Zoopla
          agent_name: listing.agent_name || null,
          agent_phone: listing.agent_phone || null,
          agent_email: listing.agent_email || null,
          agent_address: listing.agent_address || null,
          agent_logo: listing.agent_logo || null,
          agent_profile_url: listing.agent_profile_url || null,
        }

        if (existing) {
          // Update existing - preserve images if they exist
          const { error } = await supabase
            .from("properties")
            .update({
              ...propertyData,
              images: listing.images?.length > 0 ? listing.images : existing.images,
            })
            .eq("id", existing.id)

          if (error) {
            results.errors.push(`${listing.external_id}: ${error.message}`)
          } else {
            results.updated++
            results.properties.push({
              id: existing.id,
              address: listing.address,
              images: listing.images?.length || 0,
              external_id: listing.external_id,
            })
          }
        } else {
          // Insert new
          const { data: newProperty, error } = await supabase
            .from("properties")
            .insert(propertyData)
            .select("id")
            .single()

          if (error) {
            results.errors.push(`${listing.external_id}: ${error.message}`)
          } else {
            results.created++
            results.properties.push({
              id: newProperty?.id,
              address: listing.address,
              images: listing.images?.length || 0,
              external_id: listing.external_id,
            })
          }
        }
      } catch (err) {
        results.errors.push(
          `${listing.external_id}: ${err instanceof Error ? err.message : "Unknown error"}`
        )
      }
    }

    console.log(
      `[IngestZoopla] Complete: ${results.created} created, ${results.updated} updated, ${results.errors.length} errors`
    )

    return NextResponse.json({
      success: true,
      message: `Ingested ${results.created + results.updated} Zoopla properties`,
      created: results.created,
      updated: results.updated,
      total: listings.length,
      errors: results.errors,
      properties: results.properties.slice(0, 10), // Show first 10
    })
  } catch (error) {
    console.error("[IngestZoopla] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to check available areas
 */
export async function GET() {
  return NextResponse.json({
    message: "Use POST to ingest Zoopla properties",
    usage: {
      byPostcode: 'POST with { "postcode": "E8 1DY", "listingType": "rent" }',
      byArea: 'POST with { "area": "Hackney", "listingType": "rent" }',
      options: {
        postcode: "UK postcode (e.g., E8 1DY)",
        area: "Area name (e.g., Hackney, Manchester)",
        listingType: "rent | sale (default: rent)",
        limit: "Max properties to ingest (default: 20, max: 100)",
      },
    },
    examples: [
      { postcode: "E8 1DY", listingType: "rent" },
      { area: "Hackney", listingType: "rent", limit: 50 },
      { area: "Manchester", listingType: "sale" },
    ],
  })
}
