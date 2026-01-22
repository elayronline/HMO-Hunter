"use server"

import { getFullPropertyInsights, type FullPropertyInsights } from "@/lib/services/property-insights"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface PropertyInput {
  postcode: string
  uprn?: string
  address?: string
}

export interface FetchResult {
  property: PropertyInput
  insights?: FullPropertyInsights
  error?: { message: string }
  status: "success" | "failed"
}

export async function fetchAndStoreProperties(properties: PropertyInput[]): Promise<FetchResult[]> {
  const results = await Promise.all(
    properties.map(async (p): Promise<FetchResult> => {
      try {
        const insights = await getFullPropertyInsights(p)

        // Store/update in Supabase
        const { error } = await supabaseAdmin.from("properties").upsert({
          postcode: p.postcode,
          address: p.address || insights.propertyData?.address || `Property at ${p.postcode}`,
          external_id: p.uprn || `LIVE-${p.postcode.replace(/\s/g, "")}`,
          source_name: "Live API",
          source_type: "partner_api",
          last_synced: new Date().toISOString(),
          is_stale: false,
          hmo_status: insights.propertyData?.hmoLicenseStatus || null,
          bedrooms: insights.propertyData?.bedrooms || null,
          purchase_price: insights.streetData?.estimatedValue || null,
        }, { onConflict: "external_id" })

        if (error) throw new Error(error.message)

        return { property: p, insights, status: "success" }
      } catch (err) {
        console.error("[DashboardInsights] Failed to fetch:", p, err)
        return { 
          property: p, 
          error: { message: err instanceof Error ? err.message : "Unknown error" }, 
          status: "failed" 
        }
      }
    })
  )

  return results
}

export async function fetchSingleProperty(postcode: string, uprn?: string): Promise<FetchResult> {
  return (await fetchAndStoreProperties([{ postcode, uprn }]))[0]
}
