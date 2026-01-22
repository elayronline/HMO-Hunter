import type { EnrichmentAdapter, PropertyListing } from "@/lib/types/ingestion"

interface PaTMaConfig {
  apiKey?: string
  baseUrl?: string
}

export class PaTMaAdapter implements EnrichmentAdapter {
  name = "PaTMa"
  type = "enrichment_api" as const
  private apiKey: string
  private baseUrl: string

  constructor(config?: PaTMaConfig) {
    this.apiKey = config?.apiKey || process.env.PATMA_API_KEY || ""
    this.baseUrl = config?.baseUrl || process.env.PATMA_BASE_URL || "https://app.patma.co.uk/api"
  }

  async enrich(property: PropertyListing): Promise<Partial<PropertyListing>> {
    // PaTMa API - Property and Tenancy Management Analytics
    // Provides market analytics and insights
    // Get your API key from: https://app.patma.co.uk/profile/api_keys/create

    if (!this.apiKey) {
      console.warn("[PaTMa] API key not configured, skipping analytics")
      return {}
    }

    try {
      // Build the API URL for property analytics
      // PaTMa requires postcode without spaces
      const postcodeNoSpaces = property.postcode.replace(/\s+/g, "")
      const params = new URLSearchParams({
        postcode: postcodeNoSpaces,
      })

      const response = await fetch(`${this.baseUrl}/prospector/v1/rental-prices/?${params}`, {
        headers: {
          Authorization: `Token ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const errorBody = await response.text()
        console.error(`[PaTMa] API error: ${response.status} - ${errorBody}`)
        return {}
      }

      const data = await response.json()

      if (data.status === "error" || data.error) {
        console.error(`[PaTMa] API returned error: ${data.message || data.error}`)
        return {}
      }

      // Extract analytics data from PaTMa response
      return {
        rental_yield: data.rental_yield || data.yield,
        area_population: data.area_population || data.population,
        area_avg_rent: data.area_average_rent || data.average_rent,
        estimated_value: data.estimated_value || data.property_value,
      }
    } catch (error) {
      console.error("[PaTMa] Enrichment error:", error)
      return {}
    }
  }
}
