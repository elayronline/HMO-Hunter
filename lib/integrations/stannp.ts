/**
 * Stannp Direct Mail API Integration
 *
 * Sends physical letters via Stannp's REST API.
 * UK-based, ~£0.54 per letter, property marketing focused.
 *
 * Setup: Set STANNP_API_KEY in .env.local
 * Get key from: https://dash.stannp.com/api/v1
 * Docs: https://www.stannp.com/uk/direct-mail-api/letters
 */

const STANNP_BASE_URL = "https://dash.stannp.com/api/v1"

export interface StannpLetterRequest {
  recipient: {
    title?: string
    firstname: string
    lastname: string
    address1: string
    address2?: string
    city: string
    postcode: string
    country?: string
  }
  template?: string  // Stannp template ID (if using their templates)
  body?: string      // Raw HTML body (if not using template)
  pages?: number
}

export interface StannpLetterResponse {
  success: boolean
  data?: {
    id: string
    status: string
    cost: string
    pdf: string
  }
  error?: string
}

function getApiKey(): string | null {
  return process.env.STANNP_API_KEY || null
}

export function isStannpConfigured(): boolean {
  return !!process.env.STANNP_API_KEY
}

/**
 * Send a physical letter via Stannp
 */
export async function sendLetter(request: StannpLetterRequest): Promise<StannpLetterResponse> {
  const apiKey = getApiKey()
  if (!apiKey) {
    return { success: false, error: "Stannp API key not configured. Set STANNP_API_KEY in environment." }
  }

  try {
    const formData = new URLSearchParams()
    formData.append("test", process.env.NODE_ENV === "production" ? "false" : "true")
    formData.append("recipient[title]", request.recipient.title || "")
    formData.append("recipient[firstname]", request.recipient.firstname)
    formData.append("recipient[lastname]", request.recipient.lastname)
    formData.append("recipient[address1]", request.recipient.address1)
    if (request.recipient.address2) formData.append("recipient[address2]", request.recipient.address2)
    formData.append("recipient[city]", request.recipient.city)
    formData.append("recipient[postcode]", request.recipient.postcode)
    formData.append("recipient[country]", request.recipient.country || "GB")

    if (request.template) {
      formData.append("template", request.template)
    }

    if (request.body) {
      // Wrap in basic letter HTML
      const letterHtml = `
        <html><body style="font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.6; padding: 40px;">
          ${request.body.split("\n").map(line => `<p style="margin: 0 0 8px 0;">${line}</p>`).join("")}
        </body></html>
      `
      formData.append("body", letterHtml)
    }

    const response = await fetch(`${STANNP_BASE_URL}/letters/create`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || `Stannp API error: ${response.status}`,
      }
    }

    return {
      success: true,
      data: {
        id: data.data?.id || "",
        status: data.data?.status || "queued",
        cost: data.data?.cost || "0.54",
        pdf: data.data?.pdf || "",
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Stannp request failed",
    }
  }
}

/**
 * Check Stannp account balance
 */
export async function getStannpBalance(): Promise<{ balance: string } | null> {
  const apiKey = getApiKey()
  if (!apiKey) return null

  try {
    const response = await fetch(`${STANNP_BASE_URL}/accounts/balance`, {
      headers: {
        "Authorization": `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
      },
    })
    const data = await response.json()
    return { balance: data.data?.balance || "0" }
  } catch {
    return null
  }
}
