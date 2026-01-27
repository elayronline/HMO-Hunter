import { EnrichmentAdapter, type PropertyListing } from "@/lib/types/ingestion"
import { apiConfig } from "@/lib/config/api-config"

/**
 * Kamma API Response Types
 */
interface KammaLicence {
  licence_number?: string
  licence_type?: string
  start_date?: string
  end_date?: string
  status?: string
  max_occupants?: number
  max_households?: number
  licence_holder?: string
  managing_agent?: string
  council?: string
}

interface KammaLicensingCheckResponse {
  property_id?: string
  uprn?: string
  address?: string
  is_hmo?: boolean
  has_licence?: boolean
  current_licences?: KammaLicence[]
  historic_licences?: KammaLicence[]
  requires_licence?: boolean
  licensing_schemes?: string[]
}

interface KammaDeterminationCheckResponse {
  property_id?: string
  uprn?: string
  address?: string
  schemes?: {
    scheme_type?: string
    scheme_name?: string
    council?: string
    start_date?: string
    end_date?: string
    status?: string
  }[]
  consultations?: {
    name?: string
    council?: string
    consultation_end_date?: string
    status?: string
  }[]
  article_4_directions?: {
    name?: string
    council?: string
    applies?: boolean
  }[]
}

interface KammaEpcCheckResponse {
  property_id?: string
  uprn?: string
  address?: string
  current_epc?: {
    rating?: string
    score?: number
    certificate_url?: string
    expiry_date?: string
    lodgement_date?: string
  }
}

/**
 * Kamma API Enrichment Adapter
 *
 * Provides HMO licensing compliance data including:
 * - Current and historic HMO licences
 * - Licensing scheme determination
 * - Article 4 direction information
 * - EPC data
 *
 * API Docs: https://kamma.api.kammadata.com/docs/
 */
export class KammaEnrichmentAdapter extends EnrichmentAdapter {
  name = "Kamma"
  type = "enrichment_api" as const

  private apiKey: string
  private groupId: string
  private baseUrl: string

  constructor(apiKey?: string, baseUrl?: string, groupId?: string) {
    super()
    this.apiKey = apiKey || apiConfig.kamma?.apiKey || ""
    this.groupId = groupId || apiConfig.kamma?.groupId || ""
    this.baseUrl = baseUrl || apiConfig.kamma?.baseUrl || "https://kamma.api.kammadata.com"
  }

  /**
   * Get headers for Kamma API requests
   * Uses X-SSO-API-Key and X-SSO-Service-Key headers
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "X-SSO-API-Key": this.apiKey,
      "Content-Type": "application/json",
      "Accept": "application/json",
    }

    // Group ID may be used as the service key
    if (this.groupId) {
      headers["X-SSO-Service-Key"] = this.groupId
    }

    return headers
  }

  /**
   * Enrich a property with Kamma licensing data
   */
  async enrich(property: PropertyListing): Promise<Partial<PropertyListing>> {
    if (!this.apiKey) {
      console.warn("[Kamma] API key not configured")
      return {}
    }

    const enrichedData: Partial<PropertyListing> = {}

    // Build property identifier - prefer UPRN, fallback to address
    let propertyIdentifier: string
    if (property.uprn) {
      propertyIdentifier = this.formatUprnIdentifier(property.uprn)
    } else if (property.address && property.postcode) {
      propertyIdentifier = this.formatAddressIdentifier(property.address, property.postcode)
    } else {
      console.warn(`[Kamma] No property identifier available for ${property.address}`)
      return {}
    }

    if (!propertyIdentifier) {
      console.warn(`[Kamma] No property identifier available for ${property.address}`)
      return {}
    }

    console.log(`[Kamma] Using identifier: ${propertyIdentifier}`)

    try {
      // Fetch licensing check data
      const licensingData = await this.fetchLicensingCheck(propertyIdentifier)
      if (licensingData) {
        Object.assign(enrichedData, this.parseLicensingData(licensingData))
      }

      // Fetch determination check data (licensing schemes, Article 4)
      const determinationData = await this.fetchDeterminationCheck(propertyIdentifier)
      if (determinationData) {
        Object.assign(enrichedData, this.parseDeterminationData(determinationData))
      }

      // Fetch EPC data if not already present
      if (!property.epc_rating) {
        const epcData = await this.fetchEpcCheck(propertyIdentifier)
        if (epcData) {
          Object.assign(enrichedData, this.parseEpcData(epcData))
        }
      }

      // Set enrichment tracking
      if (Object.keys(enrichedData).length > 0) {
        enrichedData.owner_enrichment_source = "kamma"
      }

      console.log(`[Kamma] Enriched ${property.address} with ${Object.keys(enrichedData).length} fields`)
      return enrichedData

    } catch (error) {
      console.error(`[Kamma] Enrichment error for ${property.address}:`, error)
      return {}
    }
  }

  /**
   * Fetch licensing check from Kamma API
   */
  private async fetchLicensingCheck(propertyIdentifier: string): Promise<KammaLicensingCheckResponse | null> {
    try {
      const url = `${this.baseUrl}/api/properties/licensing-check/${encodeURIComponent(propertyIdentifier)}`
      console.log(`[Kamma] Fetching licensing check: ${url}`)

      const response = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(),
      })

      console.log(`[Kamma] Licensing check response status: ${response.status}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[Kamma] Licensing check API error ${response.status}: ${errorText}`)
        if (response.status === 404) {
          return null
        }
        return null
      }

      const data = await response.json()
      console.log(`[Kamma] Licensing check response:`, JSON.stringify(data).slice(0, 500))
      return data
    } catch (error) {
      console.error(`[Kamma] Licensing check fetch error:`, error)
      return null
    }
  }

  /**
   * Fetch determination check from Kamma API
   */
  private async fetchDeterminationCheck(propertyIdentifier: string): Promise<KammaDeterminationCheckResponse | null> {
    try {
      const url = `${this.baseUrl}/api/properties/determination-check/${encodeURIComponent(propertyIdentifier)}`

      const response = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(),
      })

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`[Kamma] No determination data found for ${propertyIdentifier}`)
          return null
        }
        const errorText = await response.text()
        console.error(`[Kamma] Determination check API error ${response.status}: ${errorText}`)
        return null
      }

      return await response.json()
    } catch (error) {
      console.error(`[Kamma] Determination check fetch error:`, error)
      return null
    }
  }

  /**
   * Fetch EPC check from Kamma API
   */
  private async fetchEpcCheck(propertyIdentifier: string): Promise<KammaEpcCheckResponse | null> {
    try {
      const url = `${this.baseUrl}/api/properties/epc-check/${encodeURIComponent(propertyIdentifier)}`

      const response = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(),
      })

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`[Kamma] No EPC data found for ${propertyIdentifier}`)
          return null
        }
        const errorText = await response.text()
        console.error(`[Kamma] EPC check API error ${response.status}: ${errorText}`)
        return null
      }

      return await response.json()
    } catch (error) {
      console.error(`[Kamma] EPC check fetch error:`, error)
      return null
    }
  }

  /**
   * Parse licensing check response into PropertyListing fields
   */
  private parseLicensingData(data: KammaLicensingCheckResponse): Partial<PropertyListing> {
    const result: Partial<PropertyListing> = {}

    // Store UPRN if returned
    if (data.uprn) {
      result.uprn = data.uprn
    }

    // Parse current licence information
    if (data.current_licences && data.current_licences.length > 0) {
      const currentLicence = data.current_licences[0]

      result.licence_id = currentLicence.licence_number
      result.licence_start_date = currentLicence.start_date
      result.licence_end_date = currentLicence.end_date
      result.max_occupants = currentLicence.max_occupants

      // Determine licence status
      if (currentLicence.status) {
        const status = currentLicence.status.toLowerCase()
        if (status === "active" || status === "valid" || status === "current") {
          result.licence_status = "active"
        } else if (status === "expired") {
          result.licence_status = "expired"
        } else if (status === "pending" || status === "applied") {
          result.licence_status = "pending"
        } else {
          result.licence_status = "none"
        }
      }

      // Set owner info if available
      if (currentLicence.licence_holder) {
        result.owner_name = currentLicence.licence_holder
      }
    } else if (data.has_licence === false) {
      result.licence_status = "none"
    }

    return result
  }

  /**
   * Parse determination check response into PropertyListing fields
   */
  private parseDeterminationData(data: KammaDeterminationCheckResponse): Partial<PropertyListing> {
    const result: Partial<PropertyListing> = {}

    // Check for Article 4 directions
    if (data.article_4_directions && data.article_4_directions.length > 0) {
      const hasArticle4 = data.article_4_directions.some(a4 => a4.applies === true)
      result.article_4_area = hasArticle4
    }

    // Parse active licensing schemes as planning constraints
    if (data.schemes && data.schemes.length > 0) {
      const activeSchemes = data.schemes.filter(s =>
        s.status?.toLowerCase() === "active" || s.status?.toLowerCase() === "live"
      )

      if (activeSchemes.length > 0) {
        result.planning_constraints = activeSchemes.map(scheme => ({
          type: scheme.scheme_type || "licensing_scheme",
          description: scheme.scheme_name || "Unknown scheme",
          authority: scheme.council || "Unknown",
          date_identified: scheme.start_date,
        }))
      }
    }

    return result
  }

  /**
   * Parse EPC check response into PropertyListing fields
   */
  private parseEpcData(data: KammaEpcCheckResponse): Partial<PropertyListing> {
    const result: Partial<PropertyListing> = {}

    if (data.current_epc) {
      const epc = data.current_epc

      // Parse EPC rating
      if (epc.rating) {
        const rating = epc.rating.toUpperCase() as "A" | "B" | "C" | "D" | "E" | "F" | "G"
        if (["A", "B", "C", "D", "E", "F", "G"].includes(rating)) {
          result.epc_rating = rating
        }
      }

      // EPC score
      if (epc.score) {
        result.epc_rating_numeric = epc.score
      }

      // Certificate URL
      if (epc.certificate_url) {
        result.epc_certificate_url = epc.certificate_url
      }

      // Expiry date
      if (epc.expiry_date) {
        result.epc_expiry_date = epc.expiry_date
      }
    }

    return result
  }

  /**
   * Format address as identifier for Kamma API
   * Kamma expects format: kamma:address:address+parts+postcode
   */
  private formatAddressIdentifier(address: string, postcode: string): string {
    if (!address || !postcode) return ""

    // Clean and combine address with postcode
    const cleanAddress = address.trim().replace(/,\s*$/, "")
    const cleanPostcode = postcode.trim().toUpperCase()
    const fullAddress = `${cleanAddress} ${cleanPostcode}`

    // Convert to Kamma format: replace spaces with + and prefix with kamma:address:
    const encodedAddress = fullAddress.replace(/\s+/g, "+").toLowerCase()

    return `kamma:address:${encodedAddress}`
  }

  /**
   * Format UPRN as identifier for Kamma API
   * Kamma expects format: geoplace:uprn:UPRN_NUMBER
   */
  private formatUprnIdentifier(uprn: string): string {
    if (!uprn) return ""
    return `geoplace:uprn:${uprn}`
  }
}

/**
 * Standalone function to check a single property via Kamma
 */
export async function checkPropertyWithKamma(
  propertyIdentifier: string,
  apiKey?: string
): Promise<{
  licensing: KammaLicensingCheckResponse | null
  determination: KammaDeterminationCheckResponse | null
  epc: KammaEpcCheckResponse | null
}> {
  const adapter = new KammaEnrichmentAdapter(apiKey)

  // Access private methods via type casting for standalone use
  const adapterAny = adapter as any

  const [licensing, determination, epc] = await Promise.all([
    adapterAny.fetchLicensingCheck(propertyIdentifier),
    adapterAny.fetchDeterminationCheck(propertyIdentifier),
    adapterAny.fetchEpcCheck(propertyIdentifier),
  ])

  return { licensing, determination, epc }
}
