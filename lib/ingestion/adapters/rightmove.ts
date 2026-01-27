import type { EnrichmentAdapter, PropertyListing } from "@/lib/types/ingestion"

/**
 * Apify Rightmove Scraper Adapter
 *
 * Uses Apify's Rightmove scraper to fetch live rental listings
 * and match them to HMO properties for direct booking links.
 *
 * Pricing: $0.95 per 1000 results (~£0.75)
 * Docs: https://apify.com/memo23/rightmove-scraper
 */

interface RightmoveListingResult {
  id: string
  url: string
  title: string
  price: number
  priceQualifier?: string
  address: string
  propertyType: string
  bedrooms: number
  bathrooms?: number
  images: string[]
  floorplanImages?: string[]
  floorplans?: string[]
  agent?: {
    name: string
    phone?: string
    address?: string
  }
  epcRating?: string
  description?: string
  latitude?: number
  longitude?: number
  addedOn?: string
  letAvailableDate?: string
  furnished?: string
  letType?: string
}

interface ApifyRunResponse {
  data: {
    id: string
    status: string
    defaultDatasetId: string
  }
}

interface ApifyConfig {
  apiToken?: string
  actorId?: string
}

export class RightmoveAdapter implements EnrichmentAdapter {
  name = "Rightmove"
  type = "enrichment_api" as const

  private apiToken: string
  private actorId: string
  private baseUrl = "https://api.apify.com/v2"

  // Cache for listings by postcode to avoid redundant API calls
  private listingsCache: Map<string, { listings: RightmoveListingResult[], timestamp: number }> = new Map()
  private cacheTTL = 30 * 60 * 1000 // 30 minutes

  constructor(config?: ApifyConfig) {
    this.apiToken = config?.apiToken || process.env.APIFY_API_TOKEN || ""
    // memo23/rightmove-scraper actor ID
    this.actorId = config?.actorId || "memo23~rightmove-scraper"
  }

  /**
   * Enrich a property with Rightmove listing data
   * Matches by address similarity and returns direct listing URL + photos
   */
  async enrich(property: PropertyListing): Promise<Partial<PropertyListing>> {
    if (!this.apiToken) {
      console.warn("[Rightmove] APIFY_API_TOKEN not configured, skipping enrichment")
      return {}
    }

    try {
      // Get listings for the property's postcode
      const listings = await this.getListingsForPostcode(property.postcode)

      if (listings.length === 0) {
        console.log(`[Rightmove] No listings found for postcode ${property.postcode}`)
        return {}
      }

      // Find the best matching listing
      const match = this.findBestMatch(property, listings)

      if (!match) {
        console.log(`[Rightmove] No matching listing found for ${property.address}`)
        return {}
      }

      console.log(`[Rightmove] Matched "${property.address}" to listing ${match.id}`)

      // Extract floor plans from various possible fields
      const floorPlans = match.floorplanImages || match.floorplans || []

      return {
        source_url: match.url,
        images: match.images,
        floor_plans: floorPlans.length > 0 ? floorPlans : undefined,
        price_pcm: match.price,
        description: match.description || property.description,
      }
    } catch (error) {
      console.error("[Rightmove] Enrichment error:", error)
      return {}
    }
  }

  /**
   * Get rental listings for a postcode (with caching)
   */
  async getListingsForPostcode(postcode: string): Promise<RightmoveListingResult[]> {
    const normalizedPostcode = this.normalizePostcode(postcode)

    // Check cache first
    const cached = this.listingsCache.get(normalizedPostcode)
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      console.log(`[Rightmove] Using cached listings for ${normalizedPostcode}`)
      return cached.listings
    }

    // Fetch fresh listings from Apify
    const listings = await this.fetchListings(normalizedPostcode)

    // Update cache
    this.listingsCache.set(normalizedPostcode, {
      listings,
      timestamp: Date.now()
    })

    return listings
  }

  /**
   * Fetch listings from Apify Rightmove scraper
   */
  private async fetchListings(postcode: string): Promise<RightmoveListingResult[]> {
    try {
      // Build the Rightmove search URL for rentals in this postcode
      const searchUrl = `https://www.rightmove.co.uk/property-to-rent/find.html?searchType=RENT&locationIdentifier=POSTCODE^${encodeURIComponent(postcode.replace(/\s+/g, ""))}&radius=0.25&propertyTypes=&includeLetAgreed=false&mustHave=&dontShow=&furnishTypes=&keywords=`

      // Start the Apify actor run
      const runResponse = await fetch(
        `${this.baseUrl}/acts/${this.actorId}/runs?token=${this.apiToken}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            listUrls: [searchUrl],
            maxItems: 50, // Limit results to control costs
            proxy: {
              useApifyProxy: true,
              apifyProxyCountry: "GB"
            }
          }),
        }
      )

      if (!runResponse.ok) {
        const errorText = await runResponse.text()
        console.error(`[Rightmove] Apify run failed: ${runResponse.status} - ${errorText}`)
        return []
      }

      const runData: ApifyRunResponse = await runResponse.json()
      const runId = runData.data.id

      // Wait for the run to complete (poll status)
      const results = await this.waitForResults(runId, runData.data.defaultDatasetId)

      console.log(`[Rightmove] Fetched ${results.length} listings for ${postcode}`)
      return results
    } catch (error) {
      console.error("[Rightmove] Fetch error:", error)
      return []
    }
  }

  /**
   * Wait for Apify run to complete and get results
   */
  private async waitForResults(runId: string, datasetId: string): Promise<RightmoveListingResult[]> {
    const maxWaitTime = 60000 // 60 seconds max
    const pollInterval = 2000 // Poll every 2 seconds
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      // Check run status
      const statusResponse = await fetch(
        `${this.baseUrl}/acts/${this.actorId}/runs/${runId}?token=${this.apiToken}`
      )

      if (!statusResponse.ok) {
        console.error("[Rightmove] Failed to check run status")
        return []
      }

      const statusData = await statusResponse.json()
      const status = statusData.data.status

      if (status === "SUCCEEDED") {
        // Fetch results from dataset
        const datasetResponse = await fetch(
          `${this.baseUrl}/datasets/${datasetId}/items?token=${this.apiToken}&format=json`
        )

        if (!datasetResponse.ok) {
          console.error("[Rightmove] Failed to fetch dataset")
          return []
        }

        return await datasetResponse.json()
      }

      if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
        console.error(`[Rightmove] Run ${status}`)
        return []
      }

      // Still running, wait and poll again
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    console.error("[Rightmove] Timeout waiting for results")
    return []
  }

  /**
   * Find the best matching listing for a property using address similarity
   */
  private findBestMatch(
    property: PropertyListing,
    listings: RightmoveListingResult[]
  ): RightmoveListingResult | null {
    const propertyAddress = this.normalizeAddress(property.address)

    let bestMatch: RightmoveListingResult | null = null
    let bestScore = 0
    const minScore = 0.6 // Minimum similarity threshold

    for (const listing of listings) {
      const listingAddress = this.normalizeAddress(listing.address)
      const score = this.calculateSimilarity(propertyAddress, listingAddress)

      // Also check bedroom count if available
      const bedroomMatch = listing.bedrooms === property.bedrooms
      const adjustedScore = bedroomMatch ? score * 1.1 : score // Boost score if bedrooms match

      if (adjustedScore > bestScore && adjustedScore >= minScore) {
        bestScore = adjustedScore
        bestMatch = listing
      }
    }

    if (bestMatch) {
      console.log(`[Rightmove] Best match score: ${bestScore.toFixed(2)} for "${property.address}"`)
    }

    return bestMatch
  }

  /**
   * Calculate similarity between two addresses using Levenshtein distance
   */
  private calculateSimilarity(addr1: string, addr2: string): number {
    const s1 = addr1.toLowerCase()
    const s2 = addr2.toLowerCase()

    // Check for exact match
    if (s1 === s2) return 1

    // Check if one contains the other
    if (s1.includes(s2) || s2.includes(s1)) return 0.9

    // Use Levenshtein distance for fuzzy matching
    const distance = this.levenshteinDistance(s1, s2)
    const maxLength = Math.max(s1.length, s2.length)

    return 1 - (distance / maxLength)
  }

  /**
   * Levenshtein distance algorithm for string similarity
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length
    const n = s2.length
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))

    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1]
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
        }
      }
    }

    return dp[m][n]
  }

  /**
   * Normalize address for comparison
   */
  private normalizeAddress(address: string): string {
    return address
      .toLowerCase()
      .replace(/[,\.]/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\b(flat|apartment|apt|unit|floor|room)\b/gi, "")
      .replace(/\b(road|rd|street|st|avenue|ave|lane|ln|drive|dr|close|cl|court|ct|place|pl|way|gardens|gdn|terrace|ter)\b/gi, "")
      .trim()
  }

  /**
   * Normalize postcode format
   */
  private normalizePostcode(postcode: string): string {
    return postcode.toUpperCase().replace(/\s+/g, " ").trim()
  }
}

/**
 * Standalone function to get Rightmove listing URL for a property
 * Use this for quick lookups without full enrichment
 */
export async function getRightmoveListingUrl(
  address: string,
  postcode: string,
  bedrooms?: number
): Promise<{ url: string; images: string[]; floorPlans: string[]; price?: number } | null> {
  const adapter = new RightmoveAdapter()

  const mockProperty: PropertyListing = {
    title: "",
    address,
    postcode,
    city: "",
    latitude: 0,
    longitude: 0,
    listing_type: "rent",
    property_type: "HMO",
    bedrooms: bedrooms || 0,
    bathrooms: 0,
    external_id: "",
    source_url: "",
  }

  const enriched = await adapter.enrich(mockProperty)

  if (enriched.source_url) {
    return {
      url: enriched.source_url,
      images: enriched.images || [],
      floorPlans: enriched.floor_plans || [],
      price: enriched.price_pcm,
    }
  }

  return null
}

/**
 * Generate a Rightmove search URL for a postcode (fallback when no exact match)
 * Uses the simpler /find.html endpoint which is less likely to be blocked
 */
export function getRightmoveSearchUrl(postcode: string, address?: string): string {
  // Use the cleaner search URL format that Rightmove expects from normal users
  const cleanPostcode = postcode.replace(/\s+/g, "-").toUpperCase()
  return `https://www.rightmove.co.uk/property-to-rent/find.html?locationIdentifier=POSTCODE%5E${encodeURIComponent(postcode.replace(/\s+/g, ""))}&propertyTypes=&includeLetAgreed=false&mustHave=&dontShow=&furnishTypes=&keywords=`
}
