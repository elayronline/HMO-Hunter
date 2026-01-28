import { EnrichmentAdapter, type PropertyListing } from "@/lib/types/ingestion"
import { apiConfig } from "@/lib/config/api-config"

/**
 * Kamma API V3 Response Types
 */
interface KammaV3Scheme {
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

interface KammaV3Planning {
  article4?: {
    applies: boolean
    name?: string
    date_start?: string
    date_end?: string
  }[]
}

interface KammaV3AdviceText {
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

interface KammaV3DeterminationResponse {
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
    if (data.planning?.article4 && data.planning.article4.length > 0) {
      const hasArticle4 = data.planning.article4.some(a4 => a4.applies === true)
      result.article_4_area = hasArticle4
    } else if (data.advice_text?.planning?.article4) {
      // Fallback: check advice text for Article 4 mention
      result.article_4_area = !data.advice_text.planning.article4.toLowerCase().includes("no active article 4")
    }

    // Parse current licensing schemes as planning constraints
    if (data.current_schemes && data.current_schemes.length > 0) {
      result.planning_constraints = data.current_schemes.map(scheme => ({
        type: scheme.type,
        description: `${scheme.type.charAt(0).toUpperCase() + scheme.type.slice(1)} HMO Licensing`,
        authority: "Local Authority",
        date_identified: scheme.date_start || undefined,
        metadata: {
          scheme_id: scheme.scheme_id,
          occupants_threshold: scheme.occupants,
          households_threshold: scheme.households,
          is_advised: scheme.is_advised,
          end_date: scheme.date_end,
          link: scheme.link,
        }
      }))

      // Determine if property requires mandatory licensing
      const hasMandatory = data.current_schemes.some(s => s.type === "mandatory" && s.is_advised)
      const hasAdditional = data.current_schemes.some(s => s.type === "additional" && s.is_advised)

      if (hasMandatory) {
        result.requires_mandatory_licensing = true
      }

      // Store licensing advice text for display
      if (data.advice_text?.scheme?.current) {
        result.compliance_complexity = data.advice_text.scheme.current
      }
    }

    return result
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

  const mockProperty: PropertyListing = {
    id: "test",
    address: address || "",
    postcode: postcode,
    uprn: uprn,
  } as PropertyListing

  const adapterAny = adapter as any
  return adapterAny.fetchDeterminationCheck(mockProperty)
}
