/**
 * Non-domestic EPC register — commercial buildings, with their floor area.
 *
 * The register is the only free, national, redistributable source that answers
 * the two questions a conversion turns on: what the building is currently used
 * for, and how big it is. Both come from the certificate rather than from a
 * listing, so they describe the building rather than what an agent wrote about
 * it.
 *
 * Endpoint and auth were confirmed against the live service in August 2026. The
 * old host, epc.opendatacommunities.org, now 301s at the CDN on every path
 * including /api/v1 and its own documentation, so anything written against that
 * base will fail silently-looking failures — a redirect to an HTML landing page
 * rather than an error.
 *
 *   base  https://api.get-energy-performance-data.communities.gov.uk
 *   auth  Authorization: Bearer <EPC_API_KEY>
 *   rate  6000 requests per 5 minutes, per originating IP
 *
 * Two calls are needed per building. Search returns 14 summary fields and does
 * not include floor area or property type; the certificate endpoint returns 36,
 * including both. That is the reason for the fetch-then-hydrate shape here.
 */

import type { PropertyListing } from "@/lib/types/ingestion"

const BASE = "https://api.get-energy-performance-data.communities.gov.uk"

interface EpcSearchResult {
  certificateNumber: string
  addressLine1?: string
  addressLine2?: string
  addressLine3?: string
  postcode: string
  postTown?: string
  council?: string
  uprn?: string
  currentEnergyEfficiencyBand?: string
  registrationDate?: string
}

interface EpcCertificate {
  postcode?: string
  post_town?: string
  uprn?: string
  property_type?: string
  asset_rating?: number
  current_energy_efficiency_band?: string
  valid_until?: string
  address_line_1?: string
  address_line_2?: string
  address_line_3?: string
  technical_information?: { floor_area?: number }
}

export interface NonDomesticEpc {
  certificateNumber: string
  address: string
  postcode: string
  town: string | null
  council: string | null
  uprn: string | null
  /** The register's own wording, e.g. "B1 Offices and Workshop businesses". */
  propertyTypeText: string | null
  /** Square metres, from the certificate's technical information. */
  floorAreaSqm: number | null
  epcBand: string | null
  validUntil: string | null
}

export class NonDomesticEpcAdapter {
  readonly name = "epc-non-domestic"
  readonly phase = 1 as const
  private apiKey = process.env.EPC_API_KEY ?? ""

  private async get<T>(path: string): Promise<T | null> {
    if (!this.apiKey) {
      console.warn("[NonDomesticEPC] EPC_API_KEY not configured")
      return null
    }
    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(30_000),
      })
      // A 301 here means the old host is being called. Treat it as a failure
      // rather than following it, or the caller parses a GOV.UK landing page.
      if (res.status === 301 || !res.ok) {
        console.warn(`[NonDomesticEPC] ${res.status} for ${path}`)
        return null
      }
      return (await res.json()) as T
    } catch (error) {
      console.warn("[NonDomesticEPC] request failed:", error)
      return null
    }
  }

  /** Certificates registered against a postcode. Summary fields only. */
  async search(postcode: string, pageSize = 100): Promise<EpcSearchResult[]> {
    const q = new URLSearchParams({ postcode, pageSize: String(pageSize) })
    const body = await this.get<{ data?: { results?: EpcSearchResult[] } | EpcSearchResult[] }>(
      `/api/non-domestic/search?${q}`
    )
    if (!body?.data) return []
    return Array.isArray(body.data) ? body.data : (body.data.results ?? [])
  }

  /** The full certificate, which is where floor area and property type live. */
  async certificate(certificateNumber: string): Promise<EpcCertificate | null> {
    const body = await this.get<{ data?: EpcCertificate }>(
      `/api/certificate?certificate_number=${encodeURIComponent(certificateNumber)}`
    )
    return body?.data ?? null
  }

  /**
   * Every non-domestic certificate for a postcode, hydrated with floor area.
   *
   * Sequential on purpose. The rate limit is generous but shared across an
   * originating IP, and a postcode rarely holds enough certificates for
   * parallelism to matter.
   */
  async fetchByPostcode(postcode: string): Promise<NonDomesticEpc[]> {
    const results = await this.search(postcode)
    const out: NonDomesticEpc[] = []

    for (const row of results) {
      const cert = await this.certificate(row.certificateNumber)
      const address = [row.addressLine1, row.addressLine2, row.addressLine3]
        .filter(Boolean)
        .join(", ")

      out.push({
        certificateNumber: row.certificateNumber,
        address: address || cert?.address_line_1 || "",
        postcode: row.postcode ?? cert?.postcode ?? postcode,
        town: row.postTown ?? cert?.post_town ?? null,
        council: row.council ?? null,
        uprn: row.uprn ?? cert?.uprn ?? null,
        propertyTypeText: cert?.property_type ?? null,
        floorAreaSqm: cert?.technical_information?.floor_area ?? null,
        epcBand: row.currentEnergyEfficiencyBand ?? cert?.current_energy_efficiency_band ?? null,
        validUntil: cert?.valid_until ?? null,
      })
    }

    return out
  }
}

/**
 * The register describes buildings in the pre-2020 use classes — A1, A2, B1, D1
 * — because certificates outlive the legislation that named them. Class MA only
 * runs from Class E, so the mapping decides whether a conversion route exists at
 * all, and getting it wrong invents a route that was never available.
 *
 * The 2020 amendment folded most of A1, A2, A3, B1 and D1(a) into Class E. It
 * did not fold in everything: pubs and takeaways became sui generis, and much of
 * D1 and D2 became F1 and F2, which have no Class MA route. A community centre
 * is not a shop, and the register calls both "non-domestic".
 */
export function useClassFromEpcPropertyType(text: string | null | undefined): {
  isClassE: boolean
  note: string
} {
  const t = (text ?? "").toLowerCase()
  if (!t) return { isClassE: false, note: "The certificate records no property type." }

  // Sui generis since 2020 — never Class E, so never a Class MA route.
  if (/\bpub\b|public house|drinking establishment|hot food|takeaway|cinema|petrol/.test(t)) {
    return {
      isClassE: false,
      note: `"${text}" became sui generis in 2020, which has no Class MA route. A full application is required.`,
    }
  }

  // F1 and F2: learning, worship, community halls, indoor sport.
  if (/d1 |d2 |non-residential institution|assembly|leisure|community|place of worship|school|surgery|clinic/.test(t)) {
    return {
      isClassE: false,
      note: `"${text}" is likely Class F rather than Class E, which has no Class MA route. Confirm the current use before assuming a conversion is permitted.`,
    }
  }

  // A1/A2/A3 retail and B1 business folded into Class E in 2020.
  if (/a1 |a2 |a3 |b1 |retail|shop|office|financial|professional services|restaurant|caf/.test(t)) {
    return {
      isClassE: true,
      note: `"${text}" falls within Class E, so a Class MA route may exist subject to the council's Article 4 position and two years of prior use.`,
    }
  }

  return {
    isClassE: false,
    note: `"${text}" does not map cleanly onto a current use class. Confirm it before assuming any permitted development route.`,
  }
}
