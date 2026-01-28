import { NextResponse } from "next/server"
import { KammaEnrichmentAdapter, type KammaLicensingData } from "@/lib/ingestion/enrichment/kamma"
import { apiConfig } from "@/lib/config/api-config"

/**
 * POST /api/kamma-check
 *
 * Fetches HMO licensing requirements from Kamma V3 API
 * Returns licensing schemes, Article 4 status, and compliance complexity
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { postcode, uprn, address } = body

    if (!postcode) {
      return NextResponse.json({
        success: false,
        error: "Postcode is required",
      }, { status: 400 })
    }

    // Check if Kamma is configured
    if (!apiConfig.kamma?.enabled) {
      return NextResponse.json({
        success: false,
        error: "Kamma API not configured",
        data: null,
      })
    }

    // Create adapter and fetch data
    const adapter = new KammaEnrichmentAdapter()

    // Build request body
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
          postcode: postcode,
        }
      }
    }

    if (uprn) {
      requestBody.property.address.uprn = parseInt(uprn, 10)
    } else if (address) {
      requestBody.property.address.address = address
    }

    // Make API request
    const url = `${apiConfig.kamma.baseUrl}/v3/determinations/check`

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-SSO-API-Key": apiConfig.kamma.apiKey || "",
        "X-SSO-Service-Key": apiConfig.kamma.serviceKey || "",
        "X-SSO-Group-ID": apiConfig.kamma.groupId || "",
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    const data = await response.json()

    if (!response.ok || data.status?.code !== 200) {
      console.error("[Kamma] API error:", data.status || data)
      return NextResponse.json({
        success: false,
        error: data.status?.message || "Kamma API error",
        details: data.status?.errors || null,
      })
    }

    // Parse for UI display
    const licensingData = KammaEnrichmentAdapter.parseForUI(data)

    return NextResponse.json({
      success: true,
      data: licensingData,
      raw: data, // Include raw response for debugging
    })

  } catch (error) {
    console.error("[Kamma] Check error:", error)
    return NextResponse.json({
      success: false,
      error: String(error),
    }, { status: 500 })
  }
}

/**
 * GET /api/kamma-check
 *
 * Returns API status and usage info
 */
export async function GET() {
  const isConfigured = apiConfig.kamma?.enabled

  return NextResponse.json({
    message: "POST to check HMO licensing requirements for a property",
    configured: isConfigured,
    usage: {
      method: "POST",
      body: {
        postcode: "Required - UK postcode (e.g., 'E2 9LY')",
        uprn: "Optional - Unique Property Reference Number (more accurate)",
        address: "Optional - Full address string (fallback if no UPRN)",
      },
    },
    response: {
      schemes: "Array of licensing schemes (mandatory, additional, selective)",
      adviceText: "Human-readable licensing guidance",
      article4: "Boolean - whether Article 4 direction applies",
      complexityLevel: "low | medium | high",
      requiresMandatory: "Boolean - mandatory licensing applies",
      requiresAdditional: "Boolean - additional licensing applies",
      requiresSelective: "Boolean - selective licensing applies",
    },
    example: {
      request: {
        postcode: "E2 9LY",
        uprn: "6040406",
      },
      response: {
        success: true,
        data: {
          schemes: [
            {
              type: "mandatory",
              occupants: 5,
              households: 2,
              date_start: "2006-04-01",
              date_end: null,
              link: "https://council.gov.uk/licensing",
            }
          ],
          complexityLevel: "medium",
          article4: false,
        }
      }
    }
  })
}
