import { SourceAdapter, type PropertyListing } from "@/lib/types/ingestion"
import { apiConfig } from "@/lib/config/api-config"

/**
 * Searchland HMO API Response
 * Based on actual API response from GET /hmo/search
 */
interface SearchlandHMORecord {
  id: string
  council: string
  hmo_address: string
  lat: number
  lng: number
  geom: [number, number] // [lng, lat]
  licence_expiry: string // "24/02/2027"
  licence_expiry_parsed: string // "2027-02-24T00:00:00"
  licence_start: string // "2022-02-24"
  licence_type: string // "Mandatory" | "Additional" | "Selective"
  lpa_code: string
  max_occupancy: string // "6" (string in API)
  number_of_rooms_providing_sleeping_accommodation: string // "5"
  number_of_rooms_providing_living_accommodation: string // "0"
  number_of_storeys: string // "2"
  reference: string // Licence reference number
  property_type: string // "SHARED HOUSE"
  address_id: string
  building_id: string
}

/**
 * Target councils/areas to fetch HMOs from
 * Maps council names (as they appear in API) to city names for our database
 */
const TARGET_COUNCILS: Record<string, string> = {
  // London Boroughs
  "Westminster": "London",
  "Camden": "London",
  "Islington": "London",
  "Hackney": "London",
  "Tower Hamlets": "London",
  "Southwark": "London",
  "Lambeth": "London",
  "Lewisham": "London",
  "Greenwich": "London",
  "Brent": "London",
  "Ealing": "London",
  "Hammersmith and Fulham": "London",
  "Haringey": "London",
  "Newham": "London",
  "Waltham Forest": "London",
  "Barnet": "London",
  "Enfield": "London",
  "Croydon": "London",
  // Major Cities
  "Manchester": "Manchester",
  "Birmingham": "Birmingham",
  "Leeds": "Leeds",
  "Liverpool": "Liverpool",
  "Sheffield": "Sheffield",
  "Bristol, City of": "Bristol",
  "Bristol": "Bristol",
  "Newcastle upon Tyne": "Newcastle",
  "Nottingham": "Nottingham",
  "Leicester": "Leicester",
  "Coventry": "Coventry",
  "Bradford": "Bradford",
  // University Cities
  "Oxford": "Oxford",
  "Cambridge": "Cambridge",
  "Southampton": "Southampton",
  "Portsmouth": "Portsmouth",
  "Brighton and Hove": "Brighton",
  "Reading": "Reading",
  "Cardiff": "Cardiff",
  "Edinburgh, City of": "Edinburgh",
  "Glasgow City": "Glasgow",
}

/**
 * Searchland API Adapter (HMO Licence Source)
 * Phase 1 - Alternative HMO Data Source
 *
 * Uses Searchland's /hmo/search endpoint to fetch licensed HMO data
 * API Docs: https://docs.searchland.co.uk
 *
 * Note: The API's location filtering doesn't work - it returns all UK HMOs
 * paginated. We paginate through and filter by council name client-side.
 */
export class SearchlandAdapter extends SourceAdapter {
  name = "Searchland"
  type = "hmo_register" as const
  phase = 1 as const

  private apiKey: string
  private baseUrl: string

  // Configuration
  private maxPages = 150 // Max pages to fetch (150 * 20 = 3000 records, 150 * 20 = 3000 credits)
  private perPage = 20 // Records per page
  private minPerCity = 20 // Minimum HMOs to collect per target city

  constructor(apiKey?: string, baseUrl?: string) {
    super()
    this.apiKey = apiKey || apiConfig.searchland.apiKey || ""
    this.baseUrl = baseUrl || apiConfig.searchland.baseUrl
  }

  /**
   * Fetch HMOs from Searchland API
   * @param targetCouncil - Optional: fetch only from specific council
   * @param maxRecords - Optional: maximum records to fetch (default: 500)
   */
  async fetch(targetCouncil?: string, maxRecords: number = 500): Promise<PropertyListing[]> {
    if (!this.apiKey) {
      console.warn("[Searchland] API key not configured")
      return []
    }

    const allListings: PropertyListing[] = []
    const seenIds = new Set<string>()
    const councilCounts: Record<string, number> = {}
    let totalCredits = 0
    let page = 1

    console.log(`[Searchland] Starting HMO fetch (max ${maxRecords} records, max ${this.maxPages} pages)`)
    if (targetCouncil) {
      console.log(`[Searchland] Filtering for council: ${targetCouncil}`)
    }

    while (page <= this.maxPages && allListings.length < maxRecords) {
      try {
        const url = `${this.baseUrl}/hmo/search?lat=52.0&lng=-1.0&radius=999999&page=${page}&perPage=${this.perPage}`
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
          },
        })

        if (!response.ok) {
          const errorBody = await response.text()
          console.error(`[Searchland] API error page ${page}: ${response.status} - ${errorBody}`)
          break
        }

        const data = await response.json()
        totalCredits += data.cost || 0

        if (!data.data || data.data.length === 0) {
          console.log(`[Searchland] No more data at page ${page}`)
          break
        }

        for (const record of data.data as SearchlandHMORecord[]) {
          // Deduplicate
          if (seenIds.has(record.id)) continue
          seenIds.add(record.id)

          // Filter by target council if specified
          if (targetCouncil && record.council !== targetCouncil) continue

          // Filter to only include target councils (skip unknown areas)
          const city = TARGET_COUNCILS[record.council]
          if (!city && !targetCouncil) continue

          // Track council counts
          councilCounts[record.council] = (councilCounts[record.council] || 0) + 1

          const listing = this.recordToListing(record, city || record.council)
          if (listing) {
            allListings.push(listing)
          }

          if (allListings.length >= maxRecords) break
        }

        // Progress logging every 10 pages
        if (page % 10 === 0) {
          console.log(`[Searchland] Page ${page}: ${allListings.length} HMOs collected, ${totalCredits} credits used`)
        }

        page++
      } catch (error) {
        console.error(`[Searchland] Fetch error page ${page}:`, error)
        break
      }
    }

    // Summary
    console.log(`[Searchland] Completed: ${allListings.length} HMOs from ${Object.keys(councilCounts).length} councils`)
    console.log(`[Searchland] Total credits used: ${totalCredits}`)
    console.log(`[Searchland] Council breakdown:`, councilCounts)

    return allListings
  }

  /**
   * Fetch HMOs for specific cities only
   */
  async fetchForCities(cities: string[], maxPerCity: number = 50): Promise<PropertyListing[]> {
    if (!this.apiKey) {
      console.warn("[Searchland] API key not configured")
      return []
    }

    // Get council names for target cities
    const targetCouncils = new Set<string>()
    for (const [council, city] of Object.entries(TARGET_COUNCILS)) {
      if (cities.includes(city)) {
        targetCouncils.add(council)
      }
    }

    const allListings: PropertyListing[] = []
    const seenIds = new Set<string>()
    const cityCounts: Record<string, number> = {}
    let totalCredits = 0
    let page = 1

    console.log(`[Searchland] Fetching HMOs for cities: ${cities.join(", ")}`)
    console.log(`[Searchland] Target councils: ${[...targetCouncils].join(", ")}`)

    while (page <= this.maxPages) {
      // Check if we have enough for all cities
      const allCitiesSatisfied = cities.every(city => (cityCounts[city] || 0) >= maxPerCity)
      if (allCitiesSatisfied) {
        console.log(`[Searchland] Collected ${maxPerCity}+ HMOs for all target cities`)
        break
      }

      try {
        const url = `${this.baseUrl}/hmo/search?lat=52.0&lng=-1.0&radius=999999&page=${page}&perPage=${this.perPage}`
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
          },
        })

        if (!response.ok) break

        const data = await response.json()
        totalCredits += data.cost || 0

        if (!data.data || data.data.length === 0) break

        for (const record of data.data as SearchlandHMORecord[]) {
          if (seenIds.has(record.id)) continue
          seenIds.add(record.id)

          // Only include target councils
          if (!targetCouncils.has(record.council)) continue

          const city = TARGET_COUNCILS[record.council]
          if (!city) continue

          // Skip if we already have enough for this city
          if ((cityCounts[city] || 0) >= maxPerCity) continue

          const listing = this.recordToListing(record, city)
          if (listing) {
            allListings.push(listing)
            cityCounts[city] = (cityCounts[city] || 0) + 1
          }
        }

        page++
      } catch (error) {
        console.error(`[Searchland] Fetch error:`, error)
        break
      }
    }

    console.log(`[Searchland] Completed: ${allListings.length} HMOs, ${totalCredits} credits`)
    console.log(`[Searchland] Per city:`, cityCounts)

    return allListings
  }

  /**
   * Convert API record to PropertyListing
   */
  private recordToListing(record: SearchlandHMORecord, city: string): PropertyListing | null {
    const { address, postcode } = this.parseHMOAddress(record.hmo_address)

    if (!record.lat || !record.lng) return null

    const maxOccupancy = parseInt(record.max_occupancy, 10) || null
    const sleepingRooms = parseInt(record.number_of_rooms_providing_sleeping_accommodation, 10) || 0
    const storeys = parseInt(record.number_of_storeys, 10) || null
    const licenceStatus = this.determineLicenceStatus(record.licence_expiry_parsed)

    return {
      title: `Licensed HMO - ${address}`,
      address,
      postcode: postcode || "",
      city,
      latitude: record.lat,
      longitude: record.lng,
      listing_type: "rent",
      property_type: "HMO",
      bedrooms: sleepingRooms || 5,
      bathrooms: Math.ceil((sleepingRooms || 5) / 2.5),
      description: this.buildDescription(record, sleepingRooms, storeys),
      external_id: record.reference || `SL-${record.id}`,
      source_url: "https://searchland.co.uk",
      licence_id: record.reference,
      licence_start_date: record.licence_start,
      licence_end_date: record.licence_expiry_parsed?.split("T")[0] ?? undefined,
      licence_status: licenceStatus,
      max_occupants: maxOccupancy ?? undefined,
      is_student_friendly: true,
      is_pet_friendly: false,
    }
  }

  /**
   * Parse Searchland HMO address format: "STREET, NUMBER,POSTCODE"
   */
  private parseHMOAddress(hmoAddress: string): { address: string; postcode: string | null } {
    if (!hmoAddress) return { address: "", postcode: null }

    // Split by comma and clean up
    const parts = hmoAddress.split(",").map(p => p.trim())

    if (parts.length >= 2) {
      // Last part is usually the postcode
      const lastPart = parts[parts.length - 1]
      const postcodeMatch = lastPart.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})$/i)

      if (postcodeMatch) {
        const postcode = this.normalizePostcode(postcodeMatch[1])
        const addressParts = parts.slice(0, -1)
        // Reorder: "STREET, NUMBER" -> "NUMBER STREET"
        if (addressParts.length === 2) {
          return {
            address: `${addressParts[1]} ${addressParts[0]}`,
            postcode,
          }
        }
        return { address: addressParts.join(", "), postcode }
      }
    }

    return { address: hmoAddress, postcode: null }
  }

  /**
   * Determine licence status from expiry date
   */
  private determineLicenceStatus(expiryDateStr: string | null): "active" | "expired" | "pending" | "none" {
    if (!expiryDateStr) return "none"

    try {
      const expiryDate = new Date(expiryDateStr)
      const now = new Date()
      return expiryDate > now ? "active" : "expired"
    } catch {
      return "none"
    }
  }

  /**
   * Build description from API data
   */
  private buildDescription(record: SearchlandHMORecord, sleepingRooms: number, storeys: number | null): string {
    const parts = [
      `Licensed ${record.licence_type || "HMO"} property`,
      `Licence: ${record.reference}`,
      `${sleepingRooms} sleeping rooms`,
    ]

    if (storeys) parts.push(`${storeys} storeys`)
    if (record.max_occupancy) parts.push(`Max occupancy: ${record.max_occupancy}`)

    return parts.join(". ") + "."
  }

  /**
   * Get list of available target councils
   */
  static getTargetCouncils(): Record<string, string> {
    return { ...TARGET_COUNCILS }
  }

  /**
   * Get cities we can fetch HMOs for
   */
  static getAvailableCities(): string[] {
    return [...new Set(Object.values(TARGET_COUNCILS))]
  }
}
