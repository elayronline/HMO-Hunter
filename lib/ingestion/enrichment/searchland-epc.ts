import { EnrichmentAdapter, type PropertyListing } from "@/lib/types/ingestion"
import { apiConfig } from "@/lib/config/api-config"

/**
 * Searchland EPC Enrichment Adapter
 * Phase 2 - Energy Performance Certificate Data
 *
 * Uses Searchland's EPC API to fetch energy ratings
 */
export class SearchlandEPCAdapter extends EnrichmentAdapter {
  name = "Searchland EPC"
  type = "enrichment_api" as const

  private apiKey: string
  private baseUrl: string

  constructor(apiKey?: string, baseUrl?: string) {
    super()
    this.apiKey = apiKey || apiConfig.searchland.apiKey || ""
    this.baseUrl = baseUrl || apiConfig.searchland.baseUrl
  }

  async enrich(property: PropertyListing): Promise<Partial<PropertyListing>> {
    if (!this.apiKey) {
      console.warn("[SearchlandEPC] API key not configured")
      return {}
    }

    try {
      const response = await fetch(`${this.baseUrl}/epc`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          address: property.address,
          postcode: property.postcode,
          uprn: property.uprn,
        }),
      })

      if (!response.ok) {
        console.warn(`[SearchlandEPC] API error for ${property.address}: ${response.status}`)
        return {}
      }

      const data = await response.json()

      if (!data.epc) {
        console.log(`[SearchlandEPC] No EPC data found for ${property.address}`)
        return {}
      }

      const epc = data.epc

      // Validate EPC rating
      const validRatings = ["A", "B", "C", "D", "E", "F", "G"] as const
      const rating = epc.rating?.toUpperCase()
      if (!validRatings.includes(rating)) {
        console.warn(`[SearchlandEPC] Invalid EPC rating "${epc.rating}" for ${property.address}`)
        return {}
      }

      const enrichment: Partial<PropertyListing> = {
        epc_rating: rating as typeof validRatings[number],
        epc_rating_numeric: this.parseNumericRating(epc.score || epc.numeric_rating),
        epc_certificate_url: epc.certificate_url || epc.url,
        epc_expiry_date: epc.expiry_date || this.calculateExpiryDate(epc.lodgement_date),
      }

      console.log(`[SearchlandEPC] Enriched ${property.address} with EPC rating: ${enrichment.epc_rating}`)
      return enrichment
    } catch (error) {
      console.error(`[SearchlandEPC] Enrichment error for ${property.address}:`, error)
      return {}
    }
  }

  private parseNumericRating(score: any): number | undefined {
    if (typeof score === "number") return Math.round(score)
    if (typeof score === "string") {
      const parsed = parseInt(score, 10)
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) return parsed
    }
    return undefined
  }

  private calculateExpiryDate(lodgementDate: string | undefined): string | undefined {
    if (!lodgementDate) return undefined
    try {
      const date = new Date(lodgementDate)
      date.setFullYear(date.getFullYear() + 10) // EPC valid for 10 years
      return date.toISOString().split("T")[0]
    } catch {
      return undefined
    }
  }
}
