import { EnrichmentAdapter, type PropertyListing } from "@/lib/types/ingestion"

/**
 * EPC Enrichment Adapter
 * Phase 2 - Energy Performance Certificate Data
 *
 * Uses the official UK Government EPC API (Open Data Communities)
 * Register at: https://epc.opendatacommunities.org/login
 *
 * Note: Searchland does NOT provide EPC data - their /epc endpoint returns 404
 */
export class SearchlandEPCAdapter extends EnrichmentAdapter {
  name = "EPC API"
  type = "enrichment_api" as const

  private apiEmail: string
  private apiKey: string
  private baseUrl = "https://epc.opendatacommunities.org/api/v1"

  constructor() {
    super()
    this.apiEmail = process.env.EPC_API_EMAIL || ""
    this.apiKey = process.env.EPC_API_KEY || ""
  }

  async enrich(property: PropertyListing): Promise<Partial<PropertyListing>> {
    if (!this.apiKey || !this.apiEmail) {
      console.warn("[EPC] API credentials not configured (EPC_API_EMAIL, EPC_API_KEY)")
      return {}
    }

    try {
      // Build search query - try postcode first, then address
      const searchParams = new URLSearchParams({
        postcode: property.postcode,
        size: "1",
      })

      const response = await fetch(
        `${this.baseUrl}/domestic/search?${searchParams}`,
        {
          headers: {
            "Accept": "application/json",
            "Authorization": `Basic ${Buffer.from(`${this.apiEmail}:${this.apiKey}`).toString("base64")}`,
          },
        }
      )

      if (!response.ok) {
        if (response.status === 401) {
          console.warn("[EPC] Authentication failed - check EPC_API_EMAIL and EPC_API_KEY")
        } else {
          console.warn(`[EPC] API error for ${property.postcode}: ${response.status}`)
        }
        return {}
      }

      const data = await response.json()

      if (!data.rows || data.rows.length === 0) {
        console.log(`[EPC] No EPC data found for ${property.postcode}`)
        return {}
      }

      // Find best match by address
      const epc = this.findBestMatch(data.rows, property.address)

      if (!epc) {
        console.log(`[EPC] No matching EPC for ${property.address}`)
        return {}
      }

      // Validate and parse EPC rating
      const validRatings = ["A", "B", "C", "D", "E", "F", "G"] as const
      const rating = epc["current-energy-rating"]?.toUpperCase()

      if (!rating || !validRatings.includes(rating as any)) {
        console.warn(`[EPC] Invalid EPC rating "${rating}" for ${property.address}`)
        return {}
      }

      const enrichment: Partial<PropertyListing> = {
        epc_rating: rating as typeof validRatings[number],
        epc_rating_numeric: this.parseNumericRating(epc["current-energy-efficiency"]),
        epc_certificate_url: epc["certificate-hash"]
          ? `https://find-energy-certificate.service.gov.uk/energy-certificate/${epc["certificate-hash"]}`
          : undefined,
        epc_expiry_date: this.calculateExpiryDate(epc["lodgement-date"]),
        // Bonus: floor area from EPC
        floor_area_sqft: epc["total-floor-area"]
          ? Math.round(parseFloat(epc["total-floor-area"]) * 10.764)
          : undefined,
      }

      console.log(`[EPC] Enriched ${property.address} with rating: ${enrichment.epc_rating}`)
      return enrichment
    } catch (error) {
      console.error(`[EPC] Enrichment error for ${property.address}:`, error)
      return {}
    }
  }

  /**
   * Find best matching EPC record by address similarity
   */
  private findBestMatch(rows: any[], targetAddress: string): any | null {
    if (rows.length === 1) return rows[0]

    const normalizedTarget = this.normalizeAddress(targetAddress)

    let bestMatch = rows[0]
    let bestScore = 0

    for (const row of rows) {
      const rowAddress = this.normalizeAddress(row.address || "")
      const score = this.addressSimilarity(normalizedTarget, rowAddress)

      if (score > bestScore) {
        bestScore = score
        bestMatch = row
      }
    }

    // Only return if reasonable match (>30% similarity)
    return bestScore > 0.3 ? bestMatch : rows[0]
  }

  private normalizeAddress(address: string): string {
    return address
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .trim()
  }

  private addressSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.split(" "))
    const wordsB = new Set(b.split(" "))
    const intersection = [...wordsA].filter(w => wordsB.has(w))
    return intersection.length / Math.max(wordsA.size, wordsB.size)
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
