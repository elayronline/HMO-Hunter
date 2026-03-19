/**
 * The Gazette - Deceased Estates (Wills & Probate) Adapter
 *
 * Fetches probate notices from The Gazette RSS feed.
 * Each notice contains a deceased person's last address and solicitor details.
 * Rate limit: max 1 request per 10 seconds.
 *
 * Source: https://www.thegazette.co.uk/wills-and-probate
 */

export interface GazetteProbateNotice {
  notice_id: string
  deceased_name: string
  date_of_death: string | null
  last_address: string | null
  postcode: string | null
  city: string | null
  solicitor_name: string | null
  solicitor_address: string | null
  solicitor_reference: string | null
  claim_expiry_date: string | null
  published_date: string
}

const GAZETTE_FEED_URL = "https://www.thegazette.co.uk/wills-and-probate/data.feed"

// Extract postcode from an address string
function extractPostcode(text: string): string | null {
  const match = text.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i)
  return match ? match[0].toUpperCase() : null
}

// Extract city from an address - take the part before the postcode
function extractCity(address: string): string | null {
  const postcode = extractPostcode(address)
  if (!postcode) return null
  const parts = address.replace(postcode, "").split(",").map(p => p.trim()).filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : null
}

// Parse HTML content from a Gazette notice entry
function parseNoticeContent(html: string): Partial<GazetteProbateNotice> {
  const result: Partial<GazetteProbateNotice> = {}

  // Extract deceased name - usually in bold or first line
  const nameMatch = html.match(/(?:estate of|deceased[^.]*name[^:]*:?\s*)([A-Z][A-Za-z\s'-]+)/i)
  if (nameMatch) {
    result.deceased_name = nameMatch[1].trim()
  }

  // Extract address
  const addressMatch = html.match(/(?:late of|last known address|address[^:]*:)\s*([^.]+(?:\.[^.]+)?)/i)
  if (addressMatch) {
    result.last_address = addressMatch[1].trim()
    result.postcode = extractPostcode(result.last_address)
    result.city = extractCity(result.last_address)
  }

  // Extract date of death
  const dodMatch = html.match(/(?:died|date of death|death[^:]*:)\s*(\d{1,2}\s+\w+\s+\d{4})/i)
  if (dodMatch) {
    try {
      result.date_of_death = new Date(dodMatch[1]).toISOString().split("T")[0]
    } catch {
      // ignore parse failures
    }
  }

  // Extract claim expiry
  const expiryMatch = html.match(/(?:before|on or before|by)\s+(\d{1,2}\s+\w+\s+\d{4})/i)
  if (expiryMatch) {
    try {
      result.claim_expiry_date = new Date(expiryMatch[1]).toISOString().split("T")[0]
    } catch {
      // ignore
    }
  }

  // Extract solicitor
  const solicitorMatch = html.match(/(?:solicitors?|executor|representative)[^:]*:\s*([^,]+(?:,[^,]+)?)/i)
  if (solicitorMatch) {
    result.solicitor_name = solicitorMatch[1].trim()
  }

  return result
}

export async function fetchGazetteProbateNotices(
  pages: number = 1
): Promise<GazetteProbateNotice[]> {
  const notices: GazetteProbateNotice[] = []

  for (let page = 1; page <= pages; page++) {
    try {
      const url = `${GAZETTE_FEED_URL}?results-page=${page}`
      const response = await fetch(url, {
        headers: { "Accept": "application/atom+xml, application/xml, text/xml" },
      })

      if (!response.ok) {
        console.error(`[Gazette] Failed to fetch page ${page}: ${response.status}`)
        continue
      }

      const xml = await response.text()

      // Parse Atom feed entries
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
      let entryMatch

      while ((entryMatch = entryRegex.exec(xml)) !== null) {
        const entry = entryMatch[1]

        // Extract notice ID from link
        const idMatch = entry.match(/<id>([^<]+)<\/id>/)
        const titleMatch = entry.match(/<title[^>]*>([^<]+)<\/title>/)
        const contentMatch = entry.match(/<content[^>]*>([\s\S]*?)<\/content>/)
        const publishedMatch = entry.match(/<published>([^<]+)<\/published>/)

        if (!idMatch) continue

        const noticeId = idMatch[1].replace(/.*\//, "")
        const content = contentMatch ? contentMatch[1] : titleMatch?.[1] || ""
        const parsed = parseNoticeContent(content)

        // Only include notices that have an address (property-relevant)
        if (parsed.last_address || parsed.postcode) {
          notices.push({
            notice_id: noticeId,
            deceased_name: parsed.deceased_name || titleMatch?.[1]?.trim() || "Unknown",
            date_of_death: parsed.date_of_death || null,
            last_address: parsed.last_address || null,
            postcode: parsed.postcode || null,
            city: parsed.city || null,
            solicitor_name: parsed.solicitor_name || null,
            solicitor_address: parsed.solicitor_address || null,
            solicitor_reference: parsed.solicitor_reference || null,
            claim_expiry_date: parsed.claim_expiry_date || null,
            published_date: publishedMatch?.[1] || new Date().toISOString(),
          })
        }
      }

      // Rate limit: 1 request per 10 seconds
      if (page < pages) {
        await new Promise(resolve => setTimeout(resolve, 10000))
      }
    } catch (err) {
      console.error(`[Gazette] Error fetching page ${page}:`, err)
    }
  }

  return notices
}
