"use server"

import { supabaseAdmin } from "@/lib/supabase-admin"
import { getFullPropertyInsights } from "@/lib/services/property-insights"

type PropertyInput = {
  postcode: string
  uprn?: string
  address?: string
}

// Test properties for live API ingestion
const testProperties: PropertyInput[] = [
  { postcode: "SW1A 1AA", uprn: "100021064470", address: "10 Downing Street, London" },
  { postcode: "E1 6AN", uprn: "100012345678", address: "Whitechapel Road, London" },
  { postcode: "N1 9GU", uprn: "100098765432", address: "Upper Street, Islington" },
  { postcode: "SE1 2AA", uprn: "100045612345", address: "Borough High Street, London" },
  { postcode: "W1A 1AA", uprn: "100065432109", address: "Oxford Street, London" },
]

export type IngestResult = {
  property: PropertyInput
  insights?: any
  status: "success" | "failed"
  error?: string
}

export async function ingestLiveProperties(): Promise<{
  totalProcessed: number
  successful: number
  failed: number
  results: IngestResult[]
}> {
  console.log("[v0] Starting live ingestion from PropertyData, StreetData, and PaTMa APIs...")

  const results = await Promise.all(
    testProperties.map(async (p): Promise<IngestResult> => {
      try {
        // Fetch insights from all three APIs
        const insights = await getFullPropertyInsights(p)

        // Prepare property data for upsert
        const address = p.address || insights.propertyData?.address || `Property at ${p.postcode}`
        const propertyData = {
          postcode: p.postcode,
          address,
          title: `Property - ${address}`,
          external_id: p.uprn || `LIVE-${p.postcode.replace(/\s/g, "")}`,
          source_name: "Live API Aggregation",
          source_type: "partner_api",
          last_synced: new Date().toISOString(),
          last_ingested_at: new Date().toISOString(),
          is_stale: false,
          // PropertyData fields
          hmo_status: insights.propertyData?.hmoLicenseStatus || "Potential HMO",
          licensed_hmo: insights.propertyData?.hmoLicenseStatus === "Licensed",
          bedrooms: insights.propertyData?.bedrooms || 4,
          bathrooms: insights.propertyData?.bathrooms || 1,
          property_type: insights.propertyData?.propertyType || "House",
          // StreetData valuation fields
          purchase_price: insights.streetData?.estimatedValue || null,
          estimated_rent_per_room: insights.streetData?.rentalEstimate
            ? Math.round(insights.streetData.rentalEstimate / (insights.propertyData?.bedrooms || 4))
            : null,
          // Location data (default to central London if not available)
          latitude: insights.propertyData?.latitude || 51.5074,
          longitude: insights.propertyData?.longitude || -0.1278,
          city: "London",
          country: "United Kingdom",
        }

        // Upsert to Supabase using external_id as unique key
        const { error } = await supabaseAdmin
          .from("properties")
          .upsert(propertyData, { onConflict: "external_id" })

        if (error) {
          throw new Error(`Supabase upsert error: ${error.message}`)
        }

        console.log(`[v0] Successfully ingested: ${p.postcode}`)

        return {
          property: p,
          insights,
          status: "success",
        }
      } catch (err) {
        console.error("[v0] Failed to fetch property:", p, err)
        return {
          property: p,
          status: "failed",
          error: err instanceof Error ? err.message : "Unknown error",
        }
      }
    })
  )

  const successful = results.filter((r) => r.status === "success").length
  const failed = results.filter((r) => r.status === "failed").length

  console.log(`[v0] Live ingestion complete. Success: ${successful}, Failed: ${failed}`)

  return {
    totalProcessed: results.length,
    successful,
    failed,
    results,
  }
}

// Fetch and store properties from custom list
export async function fetchAndStoreProperties(properties: PropertyInput[]): Promise<IngestResult[]> {
  const results = await Promise.all(
    properties.map(async (p): Promise<IngestResult> => {
      try {
        const insights = await getFullPropertyInsights(p)

        // Store/update in Supabase
        const addr = p.address || insights.propertyData?.address || `Property at ${p.postcode}`
        const { error } = await supabaseAdmin.from("properties").upsert({
          postcode: p.postcode,
          address: addr,
          title: `Property - ${addr}`,
          external_id: p.uprn || `LIVE-${p.postcode.replace(/\s/g, "")}`,
          source_name: "Live API",
          source_type: "partner_api",
          last_synced: new Date().toISOString(),
          is_stale: false,
          hmo_status: insights.propertyData?.hmoLicenseStatus || "Potential HMO",
          bedrooms: insights.propertyData?.bedrooms || 4,
          purchase_price: insights.streetData?.estimatedValue || null,
        }, { onConflict: "external_id" })

        if (error) throw new Error(error.message)

        return { property: p, insights, status: "success" }
      } catch (err) {
        console.error("[v0] Failed to fetch:", p, err)
        return { property: p, error: err instanceof Error ? err.message : "Unknown error", status: "failed" }
      }
    })
  )

  return results
}

// Ingest a single property by postcode
export async function ingestSingleProperty(postcode: string, uprn?: string): Promise<IngestResult> {
  console.log(`[v0] Ingesting single property: ${postcode}`)

  try {
    const insights = await getFullPropertyInsights({ postcode, uprn })

    const addr = insights.propertyData?.address || `Property at ${postcode}`
    const propertyData = {
      postcode,
      address: addr,
      title: `Property - ${addr}`,
      external_id: uprn || `LIVE-${postcode.replace(/\s/g, "")}`,
      source_name: "Live API Aggregation",
      source_type: "partner_api",
      last_synced: new Date().toISOString(),
      last_ingested_at: new Date().toISOString(),
      is_stale: false,
      hmo_status: insights.propertyData?.hmoLicenseStatus || "Potential HMO",
      licensed_hmo: insights.propertyData?.hmoLicenseStatus === "Licensed",
      bedrooms: insights.propertyData?.bedrooms || 4,
      bathrooms: insights.propertyData?.bathrooms || 1,
      property_type: insights.propertyData?.propertyType || "House",
      purchase_price: insights.streetData?.estimatedValue || null,
      estimated_rent_per_room: insights.streetData?.rentalEstimate
        ? Math.round(insights.streetData.rentalEstimate / (insights.propertyData?.bedrooms || 4))
        : null,
      latitude: insights.propertyData?.latitude || 51.5074,
      longitude: insights.propertyData?.longitude || -0.1278,
      city: "London",
      country: "United Kingdom",
    }

    const { error } = await supabaseAdmin
      .from("properties")
      .upsert(propertyData, { onConflict: "external_id" })

    if (error) {
      throw new Error(`Supabase upsert error: ${error.message}`)
    }

    return {
      property: { postcode, uprn },
      insights,
      status: "success",
    }
  } catch (err) {
    return {
      property: { postcode, uprn },
      status: "failed",
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}
