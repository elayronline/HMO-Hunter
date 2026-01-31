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

        // Extract data from insights using correct paths
        const hmoLicence = insights.propertyData?.hmoLicence
        const valuation = insights.streetData?.valuation
        const propertyDetails = insights.streetData?.propertyDetails
        const bedroomCount = hmoLicence?.numberOfBedrooms || 4

        // Prepare property data for upsert
        const address = p.address || `Property at ${p.postcode}`
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
          // PropertyData HMO licence fields
          hmo_status: hmoLicence ? "Licensed" : "Potential HMO",
          licensed_hmo: !!hmoLicence,
          bedrooms: bedroomCount,
          bathrooms: 1,
          property_type: propertyDetails?.propertyType || "House",
          // StreetData valuation fields
          purchase_price: valuation?.estimatedValue || null,
          estimated_rent_per_room: valuation?.estimatedRentalValue
            ? Math.round(valuation.estimatedRentalValue / bedroomCount)
            : null,
          // Location data (default to central London if not available)
          latitude: 51.5074,
          longitude: -0.1278,
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

        // Extract data from insights
        const hmoLicence = insights.propertyData?.hmoLicence
        const valuation = insights.streetData?.valuation

        // Store/update in Supabase
        const addr = p.address || `Property at ${p.postcode}`
        const { error } = await supabaseAdmin.from("properties").upsert({
          postcode: p.postcode,
          address: addr,
          title: `Property - ${addr}`,
          external_id: p.uprn || `LIVE-${p.postcode.replace(/\s/g, "")}`,
          source_name: "Live API",
          source_type: "partner_api",
          last_synced: new Date().toISOString(),
          is_stale: false,
          hmo_status: hmoLicence ? "Licensed" : "Potential HMO",
          bedrooms: hmoLicence?.numberOfBedrooms || 4,
          purchase_price: valuation?.estimatedValue || null,
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

    // Extract data from insights using correct paths
    const hmoLicence = insights.propertyData?.hmoLicence
    const valuation = insights.streetData?.valuation
    const propertyDetails = insights.streetData?.propertyDetails
    const bedroomCount = hmoLicence?.numberOfBedrooms || 4

    const addr = `Property at ${postcode}`
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
      hmo_status: hmoLicence ? "Licensed" : "Potential HMO",
      licensed_hmo: !!hmoLicence,
      bedrooms: bedroomCount,
      bathrooms: 1,
      property_type: propertyDetails?.propertyType || "House",
      purchase_price: valuation?.estimatedValue || null,
      estimated_rent_per_room: valuation?.estimatedRentalValue
        ? Math.round(valuation.estimatedRentalValue / bedroomCount)
        : null,
      latitude: 51.5074,
      longitude: -0.1278,
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
