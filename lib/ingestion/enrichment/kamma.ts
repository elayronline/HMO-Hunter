import { EnrichmentAdapter, type PropertyListing } from "@/lib/types/ingestion"
import { apiConfig } from "@/lib/config/api-config"

/**
 * Kamma API V3 Response Types - Exported for UI components
 */
export interface KammaV3Scheme {
  scheme_id: string
  type: "mandatory" | "additional" | "selective"
  occupants?: number
  households?: number
  consultation: boolean
  is_advised: boolean
  required: string
  date_start: string | null
  date_end: string | null
  link?: string
}

export interface KammaV3Planning {
  article4?: {
    applies: boolean
    name?: string
    date_start?: string
    date_end?: string
  }[]
}

export interface KammaV3AdviceText {
  scheme: {
    current: string
    mandatory: string
    additional: string
    selective: string
    future: string
  }
  planning: {
    current: string
    article4: string
    future: string
  }
}

export interface KammaV3DeterminationResponse {
  advice_text: KammaV3AdviceText
  current_schemes: KammaV3Scheme[] | null
  future_schemes: KammaV3Scheme[] | null
  planning: KammaV3Planning | null
  status: {
    code: number
    message: string
  }
}

/**
 * Parsed Kamma data for UI display
 */
export interface KammaLicensingData {
  schemes: KammaV3Scheme[]
  adviceText: {
    current: string
    mandatory: string
    additional: string
    selective: string
  }
  article4: boolean
  complexityLevel: "low" | "medium" | "high"
  requiresMandatory: boolean
  requiresAdditional: boolean
  requiresSelective: boolean
  // Derived fields for UI
  licensingRequired: boolean
  planningRequired: boolean
  riskLevel: string
  recommendations: string[]
}

/**
 * Kamma API V3 Enrichment Adapter
 *
 * Provides HMO licensing compliance data including:
 * - Licensing scheme determination (mandatory, additional, selective)
 * - Article 4 direction information
 * - Scheme requirements and occupancy thresholds
 *
 * API Docs: https://apiv3-sandbox.kammadata.com/v3/docs
 */
export class KammaEnrichmentAdapter extends EnrichmentAdapter {
  name = "Kamma"
  type = "enrichment_api" as const

  private apiKey: string
  private serviceKey: string
  private groupId: string
  private baseUrl: string

  constructor(apiKey?: string, baseUrl?: string, serviceKey?: string, groupId?: string) {
    super()
    this.apiKey = apiKey || apiConfig.kamma?.apiKey || ""
    this.serviceKey = serviceKey || apiConfig.kamma?.serviceKey || ""
    this.groupId = groupId || apiConfig.kamma?.groupId || ""
    this.baseUrl = baseUrl || apiConfig.kamma?.baseUrl || "https://apiv3-sandbox.kammadata.com"
  }

  /**
   * Get headers for Kamma API V3 requests
   * Required headers: X-SSO-API-Key, X-SSO-Service-Key, X-SSO-Group-ID
   */
  private getHeaders(): Record<string, string> {
    return {
      "X-SSO-API-Key": this.apiKey,
      "X-SSO-Service-Key": this.serviceKey,
      "X-SSO-Group-ID": this.groupId,
      "Content-Type": "application/json",
      "Accept": "application/json",
    }
  }

  /**
   * Enrich a property with Kamma licensing data
   */
  async enrich(property: PropertyListing): Promise<Partial<PropertyListing>> {
    if (!this.apiKey || !this.serviceKey || !this.groupId) {
      console.warn("[Kamma] API credentials not fully configured")
      return {}
    }

    if (!property.postcode) {
      console.warn(`[Kamma] No postcode available for ${property.address}`)
      return {}
    }

    const enrichedData: Partial<PropertyListing> = {}

    try {
      // Fetch determination check data (licensing schemes, Article 4)
      const determinationData = await this.fetchDeterminationCheck(property)
      if (determinationData) {
        Object.assign(enrichedData, this.parseDeterminationData(determinationData))
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
   * Fetch determination check from Kamma API V3
   */
  private async fetchDeterminationCheck(property: PropertyListing): Promise<KammaV3DeterminationResponse | null> {
    try {
      const url = `${this.baseUrl}/v3/determinations/check`

      // Build request body - prefer UPRN, fallback to address
      const requestBody: {
        property: {
          address: {
            postcode: string
            uprn?: number
            address?: string
          }
        }
      } = {
        property: {
          address: {
            postcode: property.postcode!,
          }
        }
      }

      if (property.uprn) {
        requestBody.property.address.uprn = parseInt(property.uprn, 10)
      } else if (property.address) {
        requestBody.property.address.address = property.address
      }

      console.log(`[Kamma] POST ${url}`, JSON.stringify(requestBody))

      const response = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (!response.ok || data.status?.code !== 200) {
        console.error(`[Kamma] Determination check error:`, JSON.stringify(data.status || data))
        return null
      }

      console.log(`[Kamma] Determination check success for ${property.address}`)
      return data
    } catch (error) {
      console.error(`[Kamma] Determination check fetch error:`, error)
      return null
    }
  }

  /**
   * Parse V3 determination check response into PropertyListing fields
   */
  private parseDeterminationData(data: KammaV3DeterminationResponse): Partial<PropertyListing> {
    const result: Partial<PropertyListing> = {}

    // Check for Article 4 directions from planning data
    let hasArticle4 = false
    if (data.planning?.article4 && data.planning.article4.length > 0) {
      hasArticle4 = data.planning.article4.some(a4 => a4.applies === true)
    } else if (data.advice_text?.planning?.article4) {
      // Fallback: check advice text for Article 4 mention
      hasArticle4 = !data.advice_text.planning.article4.toLowerCase().includes("no active article 4")
    }
    result.article_4_area = hasArticle4

    // Parse current licensing schemes
    const schemes = data.current_schemes || []
    const hasMandatory = schemes.some(s => s.type === "mandatory")
    const hasAdditional = schemes.some(s => s.type === "additional")
    const hasSelective = schemes.some(s => s.type === "selective")

    // Calculate compliance complexity
    let complexity: "low" | "medium" | "high" = "low"
    if (hasArticle4 && schemes.length >= 2) {
      complexity = "high"
    } else if (hasMandatory && (hasAdditional || hasSelective)) {
      complexity = "high"
    } else if (hasMandatory || hasArticle4) {
      complexity = "medium"
    } else if (hasAdditional || hasSelective) {
      complexity = "medium"
    }
    // Cast to allow custom Kamma fields
    const extendedResult = result as Partial<PropertyListing> & {
      compliance_complexity?: string
      requires_mandatory_licensing?: boolean
    }
    extendedResult.compliance_complexity = complexity

    // Store schemes as planning constraints with full metadata
    if (schemes.length > 0) {
      result.planning_constraints = schemes.map(scheme => ({
        type: `kamma_${scheme.type}`,
        description: `${scheme.type.charAt(0).toUpperCase() + scheme.type.slice(1)} HMO Licensing`,
        reference: scheme.scheme_id,
      }))

      if (hasMandatory) {
        extendedResult.requires_mandatory_licensing = true
      }
    }

    return result
  }

  /**
   * Parse full Kamma data for UI display
   * @param data - The Kamma V3 API response
   * @param bedrooms - Optional bedroom count to determine mandatory licensing requirement
   */
  static parseForUI(data: KammaV3DeterminationResponse, bedrooms?: number): KammaLicensingData {
    const schemes = data.current_schemes || []

    // Check for Article 4
    let hasArticle4 = false
    if (data.planning?.article4 && data.planning.article4.length > 0) {
      hasArticle4 = data.planning.article4.some(a4 => a4.applies === true)
    } else if (data.advice_text?.planning?.article4) {
      hasArticle4 = !data.advice_text.planning.article4.toLowerCase().includes("no active article 4")
    }

    // Determine scheme requirements from API
    const hasMandatoryScheme = schemes.some(s => s.type === "mandatory")
    const hasAdditional = schemes.some(s => s.type === "additional")
    const hasSelective = schemes.some(s => s.type === "selective")

    // IMPORTANT: Mandatory HMO licensing is NATIONAL LAW for 5+ occupants from 2+ households
    // If property has 5+ bedrooms, mandatory licensing is almost always required
    // regardless of whether the council has registered a scheme in Kamma's database
    const requiresMandatoryByBedrooms = bedrooms !== undefined && bedrooms >= 5
    const hasMandatory = hasMandatoryScheme || requiresMandatoryByBedrooms

    // Calculate complexity
    let complexity: "low" | "medium" | "high" = "low"
    if (hasArticle4 && (hasMandatory || hasAdditional || hasSelective)) {
      complexity = "high"
    } else if (hasMandatory && (hasAdditional || hasSelective)) {
      complexity = "high"
    } else if (hasMandatory || hasArticle4) {
      complexity = "medium"
    } else if (hasAdditional || hasSelective) {
      complexity = "medium"
    }

    // Determine if any licensing is required
    const licensingRequired = hasMandatory || hasAdditional || hasSelective

    // Calculate risk level
    let riskLevel = "low"
    if (complexity === "high" || (hasArticle4 && licensingRequired)) {
      riskLevel = "high"
    } else if (complexity === "medium") {
      riskLevel = "medium"
    }

    // Build recommendations
    const recommendations: string[] = []
    if (hasMandatory) {
      recommendations.push("Apply for mandatory HMO licence from your local council")
    }
    if (hasAdditional) {
      recommendations.push("Check if additional licensing applies to your property size")
    }
    if (hasSelective) {
      recommendations.push("Apply for selective licence - required for all rentals in this area")
    }
    if (hasArticle4) {
      recommendations.push("Apply for planning permission before converting to HMO use")
    }
    if (!licensingRequired && !hasArticle4) {
      recommendations.push("No special requirements - standard landlord obligations apply")
    }

    return {
      schemes,
      adviceText: {
        current: data.advice_text?.scheme?.current || "",
        mandatory: data.advice_text?.scheme?.mandatory || "",
        additional: data.advice_text?.scheme?.additional || "",
        selective: data.advice_text?.scheme?.selective || "",
      },
      article4: hasArticle4,
      complexityLevel: complexity,
      requiresMandatory: hasMandatory,
      requiresAdditional: hasAdditional,
      requiresSelective: hasSelective,
      // Derived fields for UI
      licensingRequired,
      planningRequired: hasArticle4,
      riskLevel,
      recommendations,
    }
  }
}

/**
 * Standalone function to check a single property via Kamma V3
 */
export async function checkPropertyWithKamma(
  postcode: string,
  uprn?: string,
  address?: string
): Promise<KammaV3DeterminationResponse | null> {
  const adapter = new KammaEnrichmentAdapter()

  const mockProperty = {
    id: "test",
    address: address || "",
    postcode: postcode,
    uprn: uprn,
  } as unknown as PropertyListing

  const adapterAny = adapter as any
  return adapterAny.fetchDeterminationCheck(mockProperty)
}
