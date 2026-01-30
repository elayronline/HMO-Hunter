import { EnrichmentAdapter, type PropertyListing } from "@/lib/types/ingestion"
import { apiConfig } from "@/lib/config/api-config"

/**
 * Searchland Ownership Enrichment Adapter
 * Phase 2 - Owner/Title Information
 *
 * Uses Searchland's Titles API to fetch property ownership details
 * from Land Registry data
 *
 * Correct endpoints (from docs.searchland.co.uk):
 * - GET /titles/get?titleNumber={string} - Get full title details
 * - GET /titles/search?lng={number}&lat={number} - Search by coordinates
 * - POST /titles/search - Search with geometry polygon
 */
export class SearchlandOwnershipAdapter extends EnrichmentAdapter {
  name = "Searchland Ownership"
  type = "enrichment_api" as const

  private apiKey: string
  private baseUrl: string

  constructor(apiKey?: string, baseUrl?: string) {
    super()
    this.apiKey = apiKey || apiConfig.searchland.apiKey || ""
    this.baseUrl = baseUrl || "https://api.searchland.co.uk/v1"
  }

  async enrich(property: PropertyListing): Promise<Partial<PropertyListing>> {
    if (!this.apiKey) {
      console.warn("[SearchlandOwnership] API key not configured")
      return {}
    }

    try {
      // Step 1: Search for titles near the property location
      const titles = await this.searchTitlesByLocation(
        property.longitude,
        property.latitude,
        property.postcode
      )

      if (!titles || titles.length === 0) {
        console.log(`[SearchlandOwnership] No titles found for ${property.address}`)
        return {}
      }

      // Step 2: Get full title details for the first matching title
      const titleNumber = titles[0].title_no
      const titleDetails = await this.getTitleDetails(titleNumber)

      if (!titleDetails) {
        console.log(`[SearchlandOwnership] Could not get details for title ${titleNumber}`)
        return {}
      }

      // Step 3: Extract owner information
      const enrichment = this.extractOwnerData(titleDetails)

      console.log(`[SearchlandOwnership] Enriched ${property.address} with owner: ${enrichment.owner_name || titles[0].ownership_category}`)
      return enrichment

    } catch (error) {
      console.error(`[SearchlandOwnership] Enrichment error for ${property.address}:`, error)
      return {}
    }
  }

  /**
   * Search for titles by coordinates using POST /titles/search
   */
  private async searchTitlesByLocation(
    lng: number | null | undefined,
    lat: number | null | undefined,
    postcode?: string
  ): Promise<any[] | null> {
    if (!lng || !lat) {
      console.warn("[SearchlandOwnership] No coordinates provided")
      return null
    }

    try {
      // Create a small polygon around the point (roughly 50m radius)
      const offset = 0.0005 // ~50 meters
      const geometry = {
        type: "Polygon",
        coordinates: [[
          [lng - offset, lat - offset],
          [lng + offset, lat - offset],
          [lng + offset, lat + offset],
          [lng - offset, lat + offset],
          [lng - offset, lat - offset],
        ]],
      }

      const response = await fetch(`${this.baseUrl}/titles/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          geometry,
          page: 1,
          perPage: 10,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.warn(`[SearchlandOwnership] Search error: ${response.status} - ${errorText}`)
        return null
      }

      const data = await response.json()
      return data.data || []

    } catch (error) {
      console.error("[SearchlandOwnership] Search error:", error)
      return null
    }
  }

  /**
   * Get full title details using GET /titles/get
   */
  private async getTitleDetails(titleNumber: string): Promise<any | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/titles/get?titleNumber=${encodeURIComponent(titleNumber)}`,
        {
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
          },
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.warn(`[SearchlandOwnership] Get title error: ${response.status} - ${errorText}`)
        return null
      }

      const result = await response.json()
      return result.data || null

    } catch (error) {
      console.error("[SearchlandOwnership] Get title error:", error)
      return null
    }
  }

  /**
   * Extract owner data from title details
   */
  private extractOwnerData(title: any): Partial<PropertyListing> {
    const proprietor = title.proprietor?.[0] || {}

    // Determine owner type
    let ownerType: "individual" | "company" | "trust" | "government" | "unknown" = "unknown"
    const ownershipCategory = title.ownership_category?.toLowerCase() || ""
    const proprietorCategory = proprietor.proprietorship_category?.toLowerCase() || ""

    if (ownershipCategory.includes("company") || ownershipCategory.includes("corporate") || proprietorCategory.includes("company") || proprietorCategory.includes("limited")) {
      ownerType = "company"
    } else if (ownershipCategory.includes("housing association")) {
      ownerType = "company" // Housing associations are typically companies
    } else if (ownershipCategory.includes("government") || ownershipCategory.includes("council") || ownershipCategory.includes("local authority")) {
      ownerType = "government"
    } else if (ownershipCategory.includes("private")) {
      ownerType = "individual"
    } else if (proprietor.company_registration_no) {
      ownerType = "company" // Has company number, so it's a company
    }

    const enrichment: Partial<PropertyListing> = {
      // Owner information
      owner_name: proprietor.name || null,
      owner_address: this.formatAddress(proprietor.address),
      owner_type: ownerType,

      // Company information (if corporate owner)
      company_name: (ownerType === "company" || proprietor.company_registration_no) ? proprietor.name : null,
      company_number: proprietor.company_registration_no || null,

      // Title information
      title_number: title.title_no,
      title_last_enriched_at: new Date().toISOString(),
      owner_enrichment_source: "searchland",

      // EPC data (if available)
      epc_rating: title.current_rating || null,
      epc_rating_numeric: title.current_energy_efficiency || null,

      // Planning constraints
      article_4_area: title.sqmt_of_title_is_planning_consideration?.sqmt_is_not_article_4 === 0,
      planning_constraints: this.parseConstraints(title.constraints),
    }

    return enrichment
  }

  private formatAddress(address: any): string | null {
    if (!address) return null
    if (typeof address === "string") return address
    if (Array.isArray(address)) return address.filter(Boolean).join(", ")
    return null
  }

  private parseConstraints(constraints: any): Array<{ type: string; description: string; reference?: string }> | null {
    if (!constraints) return null
    if (!Array.isArray(constraints)) return null

    return constraints.map((c: any) => ({
      type: c.type || c.constraint_type || "unknown",
      description: c.description || c.name || "",
      reference: c.reference || c.id || undefined,
    }))
  }

  /**
   * Search for HMO licences near a location
   */
  async searchHmoLicences(lng: number, lat: number, perPage: number = 20): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/hmo/search?lng=${lng}&lat=${lat}&page=1&perPage=${perPage}`,
        {
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
          },
        }
      )

      if (!response.ok) {
        console.warn(`[SearchlandOwnership] HMO search error: ${response.status}`)
        return []
      }

      const data = await response.json()
      return data.data || []

    } catch (error) {
      console.error("[SearchlandOwnership] HMO search error:", error)
      return []
    }
  }
}
