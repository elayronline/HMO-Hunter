import { EnrichmentAdapter, type PropertyListing } from "@/lib/types/ingestion"

/**
 * Street Data API Enrichment Adapter
 * Phase 2 - Property Characteristics Enrichment
 *
 * Enriches properties with:
 * - Property type and year built
 * - UPRN identifiers
 * - Baseline property features
 */
export class StreetDataEnrichment extends EnrichmentAdapter {
  name = "Street Data"
  type = "enrichment_api" as const

  private apiKey: string
  private baseUrl = "https://api.streetdata.co.uk/v1"

  constructor(apiKey?: string) {
    super()
    this.apiKey = apiKey || process.env.STREET_DATA_API_KEY || ""
  }

  async enrich(property: PropertyListing): Promise<Partial<PropertyListing>> {
    if (!this.apiKey) {
      console.warn("[StreetData] API key not configured")
      return {}
    }

    try {
      // Fetch property characteristics from Street Data API
      const response = await fetch(`${this.baseUrl}/properties?postcode=${encodeURIComponent(property.postcode)}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        console.warn(`[StreetData] API error: ${response.statusText}`)
        return {}
      }

      const data = await response.json()

      // Find matching property by address
      const match = data.properties?.find((p: any) =>
        p.address.toLowerCase().includes(property.address.toLowerCase().split(",")[0]),
      )

      if (!match) {
        return {}
      }

      return {
        uprn: match.uprn,
        year_built: match.year_built,
        property_age: this.calculatePropertyAge(match.year_built),
        property_type: this.normalizePropertyType(match.property_type),
        has_garden: match.features?.garden,
      }
    } catch (error) {
      console.error("[StreetData] Enrichment error:", error)
      return {}
    }
  }

  private calculatePropertyAge(yearBuilt?: number): string {
    if (!yearBuilt) return "Unknown"
    const age = new Date().getFullYear() - yearBuilt
    if (age < 10) return "New Build"
    if (age < 30) return "Modern"
    if (age < 50) return "Post-War"
    if (age < 100) return "Victorian/Edwardian"
    return "Period Property"
  }

  private normalizePropertyType(type: string): "HMO" | "Flat" | "House" | "Studio" {
    const normalized = type.toLowerCase()
    if (normalized.includes("flat") || normalized.includes("apartment")) return "Flat"
    if (normalized.includes("house") || normalized.includes("terraced") || normalized.includes("detached"))
      return "House"
    if (normalized.includes("studio")) return "Studio"
    return "House" // Default for HMOs
  }
}
