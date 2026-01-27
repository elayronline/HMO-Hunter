"use server"

import { supabaseAdmin } from "@/lib/supabase-admin"
import { getFullPropertyInsights } from "@/lib/services/property-insights"

// Define the type for properties in your DB
type PropertyInput = { postcode: string; external_id: string }

// Fetch all properties from Supabase that need ingestion
async function getPropertiesToIngest(batchSize: number): Promise<PropertyInput[]> {
  const { data, error } = await supabaseAdmin
    .from("properties")
    .select("postcode, external_id")
    .or("is_stale.eq.true,is_stale.is.null")
    .limit(batchSize) // Process in batches

  if (error) {
    console.error("[NativeIngestion] Failed to fetch properties:", error)
    return []
  }

  return data || []
}

// Native ingestion function - pulls live data from all connected APIs
// With throttling to respect API rate limits
export async function runNativeIngestion(batchSize: number = 50, delayMs: number = 500) {
  console.log("[NativeIngestion] Starting native ingestion...")
  
  const properties = await getPropertiesToIngest(batchSize)
  
  if (properties.length === 0) {
    console.log("[NativeIngestion] No properties to ingest")
    return { 
      totalProcessed: 0, 
      successful: 0, 
      failed: 0, 
      results: [] 
    }
  }

  console.log(`[NativeIngestion] Processing ${properties.length} properties with ${delayMs}ms throttle...`)

  const results: any[] = []
  
  // Process sequentially with throttling to avoid API rate limits
  for (const p of properties) {
    try {
      // Pull live data from all connected APIs (PropertyData, StreetData, PaTMa)
      const insights = await getFullPropertyInsights({ postcode: p.postcode })

      // Extract relevant fields from insights to update the property
      const updateData: Record<string, any> = {
        last_synced: new Date().toISOString(),
        is_stale: false,
        source_type: "partner_api", // Valid constraint value
      }

      // Add PropertyData fields if available
      if (insights.propertyData?.hmoLicence) {
        const licence = insights.propertyData.hmoLicence
        updateData.hmo_status = licence.status === "active" ? "Licensed HMO" : "Unlicensed HMO"
        if (licence.numberOfBedrooms) updateData.bedrooms = licence.numberOfBedrooms
        if (licence.maxOccupancy) updateData.max_tenants = licence.maxOccupancy
      }

      // Add StreetData fields if available
      if (insights.streetData) {
        if (insights.streetData.estimatedValue) {
          updateData.purchase_price = insights.streetData.estimatedValue
        }
        if (insights.streetData.rentalYield) {
          updateData.gross_yield = insights.streetData.rentalYield
        }
      }

      // Upsert results into Supabase
      const { error } = await supabaseAdmin
        .from("properties")
        .update(updateData)
        .eq("external_id", p.external_id)

      if (error) {
        throw new Error(error.message)
      }

      results.push({ 
        property: p, 
        status: "success" as const, 
        insights,
        dataCompleteness: insights.summary.dataCompleteness 
      })
    } catch (err) {
      console.error("[NativeIngestion] Failed for property:", p, err)
      results.push({ 
        property: p, 
        status: "failed" as const, 
        error: err instanceof Error ? err.message : "Unknown error" 
      })
    }

    // Throttle to avoid API rate limits
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  const successful = results.filter((r) => r.status === "success").length
  const failed = results.filter((r) => r.status === "failed").length

  console.log(`[NativeIngestion] Complete. Success: ${successful}, Failed: ${failed}`)

  return {
    totalProcessed: results.length,
    successful,
    failed,
    results,
    timestamp: new Date().toISOString(),
  }
}

// Ingest a specific property by postcode
export async function ingestSinglePropertyNative(postcode: string) {
  try {
    const insights = await getFullPropertyInsights({ postcode })
    
    return {
      status: "success",
      postcode,
      insights,
      dataCompleteness: insights.summary.dataCompleteness,
    }
  } catch (err) {
    return {
      status: "failed",
      postcode,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}
