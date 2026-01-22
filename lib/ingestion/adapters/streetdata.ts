import type { EnrichmentAdapter, PropertyListing } from "@/lib/types/ingestion"

interface StreetDataConfig {
  apiKey?: string
  baseUrl?: string
}

export class StreetDataAdapter implements EnrichmentAdapter {
  name = "Street Data"
  type = "enrichment_api" as const
  private apiKey: string
  private baseUrl: string

  constructor(config?: StreetDataConfig) {
    this.apiKey = config?.apiKey || process.env.STREETDATA_API_KEY || ""
    this.baseUrl = config?.baseUrl || process.env.STREETDATA_BASE_URL || "https://api.street.co.uk"
  }

  async enrich(property: PropertyListing): Promise<Partial<PropertyListing>> {
    // Street Data API - Property Valuations and Analytics
    // This enriches existing property data with valuation information

    if (!this.apiKey) {
      console.warn("[Street Data] API key not configured, skipping enrichment")
      return {}
    }

    try {
      // Build the API URL for property lookup by postcode
      // Using correct StreetData endpoint: /properties/areas/postcodes
      // IMPORTANT: StreetData requires postcode WITHOUT spaces
      const postcodeNoSpaces = property.postcode.replace(/\s+/g, "")
      const params = new URLSearchParams({
        postcode: postcodeNoSpaces,
        tier: "core",
      })

      const response = await fetch(`${this.baseUrl}/properties/areas/postcodes?${params}`, {
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const errorBody = await response.text()
        console.error(`[Street Data] API error: ${response.status} - ${errorBody}`)
        return {}
      }

      const data = await response.json()

      if (data.status === "error") {
        console.error(`[Street Data] API returned error: ${data.message}`)
        return {}
      }

      // Extract valuation and rental data from Street Data response
      return {
        estimated_value: data.average_price || data.estimate || data.price,
        rental_yield: data.rental_yield || data.yield,
        area_avg_rent: data.average_rent || data.rental_estimate,
        year_built: data.year_built,
        property_age: data.property_age,
      }
    } catch (error) {
      console.error("[Street Data] Enrichment error:", error)
      return {}
    }
  }
}
