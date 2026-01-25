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
  type = "hmo_register" as const
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

    // Default to HMO-dense postcodes across multiple UK cities
    // PropertyData requires FULL valid UK postcodes
    const postcodes = postcode ? [this.normalizePostcode(postcode)] : [
      // London
      "N7 6PA",   // Holloway
      "E2 9PL",   // Bethnal Green
      "SE5 8TR",  // Camberwell
      "NW5 2HB",  // Kentish Town
      "E8 1EJ",   // Hackney
      "SW9 8PS",  // Brixton
      "N4 2HA",   // Finsbury Park
      "E17 4PP",  // Walthamstow
      // Manchester
      "M14 5SX",  // Fallowfield - major student HMO area
      "M13 9PL",  // Rusholme
      "M20 2WS",  // Withington
      "M19 2QP",  // Levenshulme
      // Birmingham
      "B29 6BD",  // Selly Oak - major HMO area
      "B16 8UU",  // Edgbaston
      "B30 2AA",  // Bournville
      // Leeds
      "LS6 3HN",  // Headingley - major HMO area
      "LS2 9JT",  // City centre
      "LS4 2PR",  // Burley
      // Liverpool
      "L15 0EE",  // Wavertree
      "L7 8XZ",   // Edge Hill
      // Newcastle
      "NE2 1XE",  // Jesmond
      "NE6 5LR",  // Heaton
      // Nottingham
      "NG7 1QN",  // Lenton
      "NG9 2JJ",  // Beeston
      // Sheffield
      "S10 2TN",  // Broomhill
      "S11 8TP",  // Ecclesall
      // Bristol
      "BS6 5BZ",  // Redland
      "BS7 8NB",  // Horfield
    ]
    const allListings: PropertyListing[] = []

    // Helper to add delay between API calls (rate limit: max 8 calls per 10 seconds)
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    for (const pc of postcodes) {
      // Add delay to avoid rate limiting (1.5 seconds between calls = ~6.6 calls per 10 seconds)
      await delay(1500)
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

        // Process HMO register entries - PropertyData returns { data: { hmos: [...] } }
        let records: any[] = []

        if (data.data?.hmos && Array.isArray(data.data.hmos)) {
          records = data.data.hmos
        } else if (Array.isArray(data.data)) {
          records = data.data
        } else if (Array.isArray(data.hmo_licences)) {
          records = data.hmo_licences
        } else if (Array.isArray(data.results)) {
          records = data.results
        } else {
          console.warn(`[PropertyData] Unexpected response structure for ${pc}:`, Object.keys(data))
          continue
        }

        if (records.length === 0) {
          console.log(`[PropertyData] No HMO records found for postcode ${pc}`)
          continue
        }

        for (const record of records) {
          // Clean up address - remove leading commas and extra spaces
          let rawAddress = record.address || record.property_address || ""
          let cleanAddress = rawAddress.replace(/^,+/, "").replace(/,+/g, ", ").replace(/\s+/g, " ").trim()

          if (!cleanAddress || cleanAddress.length < 5) {
            console.warn(`[PropertyData] Skipping property with invalid address: ${rawAddress}`)
            continue
          }

          // Extract postcode from address if present (usually at the end)
          const postcodeMatch = cleanAddress.match(/([A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2})$/i)
          const extractedPostcode = postcodeMatch ? postcodeMatch[1] : pc

          const coords = await this.geocode(cleanAddress, extractedPostcode)

          // Skip properties without valid coordinates
          const lat = coords?.lat || record.latitude
          const lng = coords?.lng || record.longitude

          if (!lat || !lng) {
            console.warn(`[PropertyData] Skipping property without coordinates: ${cleanAddress}`)
            continue
          }

          const propertyPostcode = this.normalizePostcode(extractedPostcode)
          const council = record.council?.replace(/ LPA$/, "") || ""
          const bedrooms = parseInt(record.occupancy) || record.bedrooms || 5

          allListings.push({
            title: `Licensed HMO - ${cleanAddress}`,
            address: cleanAddress,
            postcode: propertyPostcode,
            city: this.getCityFromPostcode(propertyPostcode),
            latitude: lat,
            longitude: lng,
            price_pcm: undefined,
            listing_type: "rent",
            property_type: "HMO",
            bedrooms: bedrooms,
            bathrooms: Math.ceil(bedrooms / 2.5),
            description: `Licensed HMO property registered with ${council || "local council"}. Reference: ${record.reference || "N/A"}. Licence expires: ${record.licence_expiry || "N/A"}.`,
            external_id: record.reference || `PD-${propertyPostcode.replace(/\s/g, "")}-${Date.now()}`,
            source_url: `https://propertydata.co.uk`,
            licence_id: record.reference,
            licence_end_date: record.licence_expiry,
            licence_status: "active",
            max_occupants: parseInt(record.occupancy) || undefined,
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
