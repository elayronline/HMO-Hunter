/**
 * GOV.UK Notify Integration
 *
 * Free letter sending for public sector (councils, housing associations).
 * Used exclusively for the council_ta ICP.
 *
 * Setup: Set GOVUK_NOTIFY_API_KEY in .env.local
 * Get key from: https://www.notifications.service.gov.uk
 * Docs: https://docs.notifications.service.gov.uk/node.html
 */

const NOTIFY_BASE_URL = "https://api.notifications.service.gov.uk"

export interface GovNotifyLetterRequest {
  templateId: string
  personalisation: Record<string, string>
  reference?: string
}

export interface GovNotifyResponse {
  success: boolean
  data?: {
    id: string
    reference: string
    status: string
  }
  error?: string
}

function getApiKey(): string | null {
  return process.env.GOVUK_NOTIFY_API_KEY || null
}

export function isGovNotifyConfigured(): boolean {
  return !!process.env.GOVUK_NOTIFY_API_KEY
}

/**
 * Send a letter via GOV.UK Notify (free for public sector)
 */
export async function sendGovNotifyLetter(
  request: GovNotifyLetterRequest
): Promise<GovNotifyResponse> {
  const apiKey = getApiKey()
  if (!apiKey) {
    return { success: false, error: "GOV.UK Notify API key not configured" }
  }

  try {
    const response = await fetch(`${NOTIFY_BASE_URL}/v2/notifications/letter`, {
      method: "POST",
      headers: {
        "Authorization": `ApiKey-v1 ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template_id: request.templateId,
        personalisation: request.personalisation,
        reference: request.reference,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.errors?.[0]?.message || `GOV.UK Notify error: ${response.status}`,
      }
    }

    return {
      success: true,
      data: {
        id: data.id,
        reference: data.reference || "",
        status: data.status || "accepted",
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "GOV.UK Notify request failed",
    }
  }
}
