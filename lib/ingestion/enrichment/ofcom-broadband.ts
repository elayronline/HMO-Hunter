import { EnrichmentAdapter, type PropertyListing } from "@/lib/types/ingestion"
import { apiConfig } from "@/lib/config/api-config"

/**
 * Ofcom Broadband API Response Types
 */
interface OfcomAvailability {
  UPRN: number
  AddressShortDescription: string
  PostCode: string
  MaxBbPredictedDown: number
  MaxBbPredictedUp: number
  MaxSfbbPredictedDown: number
  MaxSfbbPredictedUp: number
  MaxUfbbPredictedDown: number
  MaxUfbbPredictedUp: number
  MaxPredictedDown: number
  MaxPredictedUp: number
}

interface OfcomResponse {
  PostCode: string
  Availability: OfcomAvailability[]
}

/**
 * Ofcom Broadband Coverage Enrichment Adapter
 *
 * Provides broadband and fiber availability data for UK properties.
 * Uses the free Ofcom Connected Nations Broadband API.
 *
 * API Docs: https://api.ofcom.org.uk
 *
 * Speed Categories:
 * - Basic Broadband (Bb): Standard ADSL
 * - Superfast Broadband (Sfbb): 30Mbps+ (typically FTTC)
 * - Ultrafast Broadband (Ufbb): 100Mbps+ (typically FTTP/Full Fiber)
 *
 * Note: A value of -1 means the service is not available
 */
export class OfcomBroadbandAdapter extends EnrichmentAdapter {
  name = "Ofcom Broadband"
  type = "enrichment_api" as const

  private apiKey: string
  private baseUrl: string

  constructor(apiKey?: string, baseUrl?: string) {
    super()
    this.apiKey = apiKey || apiConfig.ofcom?.apiKey || ""
    this.baseUrl = baseUrl || apiConfig.ofcom?.baseUrl || "https://api-proxy.ofcom.org.uk/broadband/coverage"
  }

  /**
   * Enrich a property with broadband availability data
   */
  async enrich(property: PropertyListing): Promise<Partial<PropertyListing>> {
    if (!this.apiKey) {
      console.warn("[OfcomBroadband] API key not configured")
      return {}
    }

    if (!property.postcode) {
      console.warn(`[OfcomBroadband] No postcode for property: ${property.address}`)
      return {}
    }

    try {
      // Format postcode: uppercase, no spaces
      const formattedPostcode = property.postcode.toUpperCase().replace(/\s+/g, "")

      const response = await fetch(`${this.baseUrl}/${formattedPostcode}`, {
        method: "GET",
        headers: {
          "Ocp-Apim-Subscription-Key": this.apiKey,
          "Accept": "application/json",
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`[OfcomBroadband] No data found for postcode: ${property.postcode}`)
          return {}
        }
        console.warn(`[OfcomBroadband] API error for ${property.postcode}: ${response.status}`)
        return {}
      }

      const data: OfcomResponse = await response.json()

      if (!data.Availability || data.Availability.length === 0) {
        console.log(`[OfcomBroadband] No availability data for ${property.postcode}`)
        return {}
      }

      // Find the best match for this property
      // If we have a UPRN, try to match it; otherwise use the first/best result
      let bestMatch: OfcomAvailability | null = null

      if (property.uprn) {
        const uprnNum = parseInt(property.uprn, 10)
        bestMatch = data.Availability.find(a => a.UPRN === uprnNum) || null
      }

      // If no UPRN match, try to match by address
      if (!bestMatch && property.address) {
        const addressLower = property.address.toLowerCase()
        bestMatch = data.Availability.find(a => {
          const descLower = a.AddressShortDescription?.toLowerCase() || ""
          // Check if the address contains key parts of the description
          return addressLower.includes(descLower) || descLower.includes(addressLower.split(",")[0])
        }) || null
      }

      // Fallback to first result (typically there's one per address in postcode)
      if (!bestMatch) {
        bestMatch = data.Availability[0]
      }

      // Parse the broadband data
      // -1 means not available
      const enrichment: Partial<PropertyListing> = {
        broadband_basic_down: this.parseSpeed(bestMatch.MaxBbPredictedDown),
        broadband_basic_up: this.parseSpeed(bestMatch.MaxBbPredictedUp),
        broadband_superfast_down: this.parseSpeed(bestMatch.MaxSfbbPredictedDown),
        broadband_superfast_up: this.parseSpeed(bestMatch.MaxSfbbPredictedUp),
        broadband_ultrafast_down: this.parseSpeed(bestMatch.MaxUfbbPredictedDown),
        broadband_ultrafast_up: this.parseSpeed(bestMatch.MaxUfbbPredictedUp),
        broadband_max_down: this.parseSpeed(bestMatch.MaxPredictedDown),
        broadband_max_up: this.parseSpeed(bestMatch.MaxPredictedUp),
        has_fiber: bestMatch.MaxUfbbPredictedDown > 0,
        has_superfast: bestMatch.MaxSfbbPredictedDown > 0,
        broadband_last_checked: new Date().toISOString(),
      }

      // Update UPRN if we got a match and property doesn't have one
      if (!property.uprn && bestMatch.UPRN) {
        enrichment.uprn = bestMatch.UPRN.toString()
      }

      console.log(`[OfcomBroadband] Enriched ${property.address}: Fiber=${enrichment.has_fiber}, Max=${enrichment.broadband_max_down}Mbps`)
      return enrichment

    } catch (error) {
      console.error(`[OfcomBroadband] Enrichment error for ${property.address}:`, error)
      return {}
    }
  }

  /**
   * Parse speed value - returns undefined for unavailable (-1) or invalid values
   */
  private parseSpeed(speed: number | undefined): number | undefined {
    if (speed === undefined || speed === null || speed === -1) {
      return undefined
    }
    return Math.round(speed)
  }

  /**
   * Get human-readable broadband status
   */
  static getBroadbandStatus(property: {
    has_fiber?: boolean | null
    has_superfast?: boolean | null
    broadband_max_down?: number | null
  }): {
    label: string
    tier: "ultrafast" | "superfast" | "basic" | "none" | "unknown"
    color: string
    speed?: number
  } {
    if (property.has_fiber === null && property.has_superfast === null) {
      return { label: "Unknown", tier: "unknown", color: "gray" }
    }

    if (property.has_fiber) {
      return {
        label: "Full Fiber",
        tier: "ultrafast",
        color: "green",
        speed: property.broadband_max_down || undefined,
      }
    }

    if (property.has_superfast) {
      return {
        label: "Superfast",
        tier: "superfast",
        color: "blue",
        speed: property.broadband_max_down || undefined,
      }
    }

    if (property.broadband_max_down && property.broadband_max_down > 0) {
      return {
        label: "Basic",
        tier: "basic",
        color: "yellow",
        speed: property.broadband_max_down,
      }
    }

    return { label: "No Broadband", tier: "none", color: "red" }
  }
}

/**
 * Standalone function to check broadband for a postcode
 */
export async function checkBroadbandByPostcode(
  postcode: string,
  apiKey?: string
): Promise<OfcomResponse | null> {
  const key = apiKey || apiConfig.ofcom?.apiKey
  if (!key) {
    throw new Error("Ofcom API key not configured")
  }

  const formattedPostcode = postcode.toUpperCase().replace(/\s+/g, "")
  const baseUrl = apiConfig.ofcom?.baseUrl || "https://api-proxy.ofcom.org.uk/broadband/coverage"

  const response = await fetch(`${baseUrl}/${formattedPostcode}`, {
    method: "GET",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Accept": "application/json",
    },
  })

  if (!response.ok) {
    if (response.status === 404) {
      return null
    }
    throw new Error(`Ofcom API error: ${response.status}`)
  }

  return response.json()
}
