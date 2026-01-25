import { SourceAdapter, type PropertyListing } from "@/lib/types/ingestion"
import { apiConfig } from "@/lib/config/api-config"

/**
 * Searchland API Adapter (HMO Licence Source)
 * Phase 1 - Alternative HMO Data Source
 *
 * Uses Searchland's property data endpoints to fetch HMO information
 */
export class SearchlandAdapter extends SourceAdapter {
  name = "Searchland"
  type = "hmo_register" as const
  phase = 1 as const

  private apiKey: string
  private baseUrl: string

  constructor(apiKey?: string, baseUrl?: string) {
    super()
    this.apiKey = apiKey || apiConfig.searchland.apiKey || ""
    this.baseUrl = baseUrl || apiConfig.searchland.baseUrl
  }

  async fetch(postcode?: string): Promise<PropertyListing[]> {
    if (!this.apiKey) {
      console.warn("[Searchland] API key not configured")
      return []
    }

    const postcodes = postcode
      ? [this.normalizePostcode(postcode)]
      : [
          "N7 6PA",
          "E2 9PL",
          "SE5 8TR",
          "NW5 2HB",
          "E8 1EJ",
        ]

    const allListings: PropertyListing[] = []

    for (const pc of postcodes) {
      try {
        const response = await fetch(`${this.baseUrl}/hmo-licences`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            postcode: pc,
            radius: 500,
          }),
        })

        if (!response.ok) {
          const errorBody = await response.text()
          console.error(`[Searchland] API error for ${pc}: ${response.status} - ${errorBody}`)
          continue
        }

        const data = await response.json()

        if (!data.results || !Array.isArray(data.results)) {
          console.warn(`[Searchland] No results found for postcode ${pc}`)
          continue
        }

        for (const record of data.results) {
          const coords = await this.geocode(record.address, record.postcode)

          allListings.push({
            title: `Licensed HMO - ${record.address}`,
            address: record.address,
            postcode: this.normalizePostcode(record.postcode || pc),
            city: record.local_authority || "London",
            latitude: coords?.lat || record.latitude || 51.5074,
            longitude: coords?.lng || record.longitude || -0.1278,
            listing_type: "rent",
            property_type: "HMO",
            bedrooms: record.bedrooms || 5,
            bathrooms: Math.ceil((record.bedrooms || 5) / 2.5),
            description: `Licensed HMO property. Licence: ${record.licence_number || "N/A"}.`,
            external_id: record.licence_number || `SL-${pc}-${Date.now()}`,
            source_url: "https://searchland.co.uk",
            licence_id: record.licence_number,
            licence_start_date: record.licence_start_date,
            licence_end_date: record.licence_end_date,
            licence_status: record.status || "active",
            max_occupants: record.max_occupants,
            uprn: record.uprn,
            is_student_friendly: true,
            is_pet_friendly: false,
          })
        }

        console.log(`[Searchland] Fetched ${data.results.length} HMOs for postcode ${pc}`)
      } catch (error) {
        console.error(`[Searchland] Fetch error for ${pc}:`, error)
        continue
      }
    }

    console.log(`[Searchland] Total fetched: ${allListings.length} licensed HMOs`)
    return allListings
  }
}
