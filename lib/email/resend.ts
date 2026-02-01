import { Resend } from "resend"

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY)

// Email sender configuration
const FROM_EMAIL = process.env.EMAIL_FROM || "HMO Hunter <notifications@hmohunter.co.uk>"

export interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
}

export interface SendEmailResult {
  success: boolean
  id?: string
  error?: string
}

/**
 * Send an email using Resend
 */
export async function sendEmail(options: EmailOptions): Promise<SendEmailResult> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn("[Email] RESEND_API_KEY not configured - email not sent")
      return { success: false, error: "Email service not configured" }
    }

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
    })

    if (error) {
      console.error("[Email] Send failed:", error)
      return { success: false, error: error.message }
    }

    console.log("[Email] Sent successfully:", data?.id)
    return { success: true, id: data?.id }
  } catch (err) {
    console.error("[Email] Error:", err)
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error"
    }
  }
}

/**
 * Send a batch of emails
 */
export async function sendBatchEmails(
  emails: EmailOptions[]
): Promise<SendEmailResult[]> {
  const results: SendEmailResult[] = []

  // Process in batches of 10 to avoid rate limits
  const batchSize = 10
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(sendEmail))
    results.push(...batchResults)

    // Small delay between batches
    if (i + batchSize < emails.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return results
}
