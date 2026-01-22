import { EnrichmentAdapter, type PropertyListing } from "@/lib/types/ingestion"

/**
 * PaTMa Property Data API Enrichment Adapter
 * Phase 2 - Valuation & Analytics Enrichment
 *
 * Enriches properties with:
 * - Valuation estimates
 * - Area population data
 * - Investment metrics (rental yield)
 */
export class PaTMaEnrichment extends EnrichmentAdapter {
  name = "PaTMa Property Data"
  type = "enrichment_api" as const

  private apiKey: string
  private baseUrl = "https://api.patma.co.uk/v1"

  constructor(apiKey?: string) {
    super()
    this.apiKey = apiKey || process.env.PATMA_API_KEY || ""
  }

  async enrich(property: PropertyListing): Promise<Partial<PropertyListing>> {
    if (!this.apiKey) {
      console.warn("[PaTMa] API key not configured")
      return {}
    }

    try {
      // Fetch valuation and analytics from PaTMa API
      const response = await fetch(
        `${this.baseUrl}/valuation?postcode=${encodeURIComponent(property.postcode)}&property_type=${property.property_type}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        },
      )

      if (!response.ok) {
        console.warn(`[PaTMa] API error: ${response.statusText}`)
        return {}
      }

      const data = await response.json()

      const estimatedValue = data.valuation?.estimated_value
      const areaAvgRent = data.rental_data?.average_pcm
      const rentalYield = estimatedValue && areaAvgRent ? ((areaAvgRent * 12) / estimatedValue) * 100 : undefined

      return {
        estimated_value: estimatedValue,
        area_avg_rent: areaAvgRent,
        rental_yield: rentalYield ? Math.round(rentalYield * 10) / 10 : undefined,
        area_population: data.area_stats?.population,
        price_pcm: property.price_pcm || areaAvgRent, // Use area average if no specific price
      }
    } catch (error) {
      console.error("[PaTMa] Enrichment error:", error)
      return {}
    }
  }
}
