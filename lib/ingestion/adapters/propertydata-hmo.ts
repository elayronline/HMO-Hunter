import { SourceAdapter, type PropertyListing } from "@/lib/types/ingestion"

/**
 * PropertyData API Adapter (National HMO Register)
 * Phase 1 - Core HMO Data Source
 *
 * Uses the /national-hmo-register endpoint to fetch licensed HMO properties
 * API docs: https://propertydata.co.uk/api
 */
export class PropertyDataHMOAdapter extends SourceAdapter {
  name = "PropertyData HMO"
  type = "council_register" as const
  phase = 1 as const

  private apiKey: string
  private baseUrl: string

  constructor(apiKey?: string, baseUrl?: string) {
    super()
    this.apiKey = apiKey || process.env.PROPERTYDATA_API_KEY || ""
    this.baseUrl = baseUrl || process.env.PROPERTYDATA_BASE_URL || "https://api.propertydata.co.uk"
  }

  async fetch(postcode?: string): Promise<PropertyListing[]> {
    if (!this.apiKey) {
      console.warn("[PropertyData] API key not configured")
      return []
    }

    // Default to full London postcodes if no specific postcode provided
    // PropertyData requires FULL valid UK postcodes
    // Using verified HMO-dense postcodes from council registers
    const postcodes = postcode ? [this.normalizePostcode(postcode)] : [
      "N7 6PA",   // Holloway - verified HMO area
      "E2 9PL",   // Bethnal Green - verified
      "SE5 8TR",  // Camberwell - verified
      "NW5 2HB",  // Kentish Town - verified
      "E8 1EJ",   // Hackney - verified
    ]
    const allListings: PropertyListing[] = []

    for (const pc of postcodes) {
      try {
        // PropertyData API uses GET with key as query parameter
        const params = new URLSearchParams({
          key: this.apiKey,
          postcode: pc,
        })

        const response = await fetch(`${this.baseUrl}/national-hmo-register?${params}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        })

        if (!response.ok) {
          const errorBody = await response.text()
          console.error(`[PropertyData] API error for ${pc}: ${response.status} - ${errorBody}`)
          continue
        }

        const data = await response.json()

        if (data.status === "error") {
          console.error(`[PropertyData] API returned error for ${pc}: ${data.message}`)
          continue
        }

        // Debug: Log the actual response structure
        console.log(`[PropertyData] Response structure for ${pc}:`, JSON.stringify(data, null, 2).slice(0, 500))

        // Process HMO register entries - handle various response structures
        // The API may return: { data: [...] }, { hmo_licences: [...] }, or { result: {...} }
        let records: any[] = []
        
        if (Array.isArray(data.data)) {
          records = data.data
        } else if (Array.isArray(data.hmo_licences)) {
          records = data.hmo_licences
        } else if (Array.isArray(data.results)) {
          records = data.results
        } else if (data.result && typeof data.result === 'object') {
          // Single result object
          records = [data.result]
        } else if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
          // Single data object
          records = [data.data]
        } else {
          console.warn(`[PropertyData] Unexpected response structure for ${pc}:`, Object.keys(data))
          continue
        }

        if (records.length === 0) {
          console.log(`[PropertyData] No HMO records found for postcode ${pc}`)
          continue
        }

        for (const record of records) {
          const coords = await this.geocode(record.address || record.property_address, record.postcode)

          allListings.push({
            title: `Licensed HMO - ${record.address || record.property_address}`,
            address: record.address || record.property_address,
            postcode: this.normalizePostcode(record.postcode || pc),
            city: record.local_authority || "London",
            latitude: coords?.lat || record.latitude || 51.5074,
            longitude: coords?.lng || record.longitude || -0.1278,
            price_pcm: undefined,
            listing_type: "rent",
            property_type: "HMO",
            bedrooms: record.bedrooms || record.number_of_bedrooms || 5,
            bathrooms: Math.ceil((record.bedrooms || record.number_of_bedrooms || 5) / 2.5),
            description: `Licensed HMO property registered with ${record.local_authority || "local council"}. Reference: ${record.licence_number || record.licence_reference || "N/A"}.`,
            external_id: record.licence_number || record.licence_reference || `PD-${pc}-${Date.now()}`,
            source_url: `https://propertydata.co.uk`,
            licence_id: record.licence_number || record.licence_reference,
            licence_start_date: record.licence_start || record.licence_issue_date,
            licence_end_date: record.licence_end || record.licence_expiry_date,
            licence_status: record.status || record.licence_status || "active",
            max_occupants: record.max_occupants || record.maximum_occupancy,
            uprn: record.uprn,
            is_student_friendly: true,
            is_pet_friendly: false,
          })
        }

        console.log(`[PropertyData] Fetched ${records.length} HMOs for postcode ${pc}`)
      } catch (error) {
        console.error(`[PropertyData] Fetch error for ${pc}:`, error)
        // Continue with other postcodes instead of throwing
        continue
      }
    }

    console.log(`[PropertyData] Total fetched: ${allListings.length} licensed HMOs`)
    return allListings
  }
}
