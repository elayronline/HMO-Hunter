import { EnrichmentAdapter, type PropertyListing } from "@/lib/types/ingestion"
import { apiConfig } from "@/lib/config/api-config"

/**
 * Searchland Ownership Enrichment Adapter
 * Phase 2 - Owner/Title Information
 *
 * Uses Searchland's Title API to fetch property ownership details
 * from Land Registry data
 */
export class SearchlandOwnershipAdapter extends EnrichmentAdapter {
  name = "Searchland Ownership"
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
      console.warn("[SearchlandOwnership] API key not configured")
      return {}
    }

    try {
      const response = await fetch(`${this.baseUrl}/title`, {
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
        console.warn(`[SearchlandOwnership] API error for ${property.address}: ${response.status}`)
        return {}
      }

      const data = await response.json()

      if (!data.title) {
        console.log(`[SearchlandOwnership] No title data found for ${property.address}`)
        return {}
      }

      const title = data.title
      const owner = title.proprietor || title.owner || {}

      // Determine owner type based on the data
      let ownerType: "individual" | "company" | "trust" | "government" | "unknown" = "unknown"
      if (owner.company_number || owner.type === "company") {
        ownerType = "company"
      } else if (owner.type === "trust") {
        ownerType = "trust"
      } else if (owner.type === "government" || owner.name?.toLowerCase().includes("council")) {
        ownerType = "government"
      } else if (owner.name && !owner.company_number) {
        ownerType = "individual"
      }

      const enrichment: Partial<PropertyListing> = {
        title_number: title.title_number,
        owner_name: owner.name || owner.company_name,
        owner_address: this.formatAddress(owner.address),
        owner_type: ownerType,
        owner_contact_email: owner.email,
        owner_contact_phone: owner.phone,
        title_last_enriched_at: new Date().toISOString(),
        owner_enrichment_source: "searchland",
      }

      // If it's a company, also capture company details
      if (ownerType === "company" && owner.company_number) {
        enrichment.company_name = owner.company_name || owner.name
        enrichment.company_number = owner.company_number
      }

      console.log(`[SearchlandOwnership] Enriched ${property.address} with owner: ${enrichment.owner_name}`)
      return enrichment
    } catch (error) {
      console.error(`[SearchlandOwnership] Enrichment error for ${property.address}:`, error)
      return {}
    }
  }

  private formatAddress(address: any): string {
    if (!address) return ""
    if (typeof address === "string") return address

    const parts = [
      address.line1,
      address.line2,
      address.line3,
      address.city,
      address.county,
      address.postcode,
    ].filter(Boolean)

    return parts.join(", ")
  }
}
