import { EnrichmentAdapter, type PropertyListing } from "@/lib/types/ingestion"
import { apiConfig } from "@/lib/config/api-config"
import type { Director } from "@/lib/types/database"

/**
 * Companies House Enrichment Adapter
 * Phase 2 - Corporate Landlord Details
 *
 * Uses the official Companies House API to fetch company information
 * for corporate property owners
 *
 * API docs: https://developer.company-information.service.gov.uk/
 */
export class CompaniesHouseAdapter extends EnrichmentAdapter {
  name = "Companies House"
  type = "enrichment_api" as const

  private apiKey: string
  private baseUrl: string

  constructor(apiKey?: string, baseUrl?: string) {
    super()
    this.apiKey = apiKey || apiConfig.companiesHouse.apiKey || ""
    this.baseUrl = baseUrl || apiConfig.companiesHouse.baseUrl
  }

  async enrich(property: PropertyListing): Promise<Partial<PropertyListing>> {
    // Only enrich if we have a company number
    if (!property.company_number) {
      return {}
    }

    if (!this.apiKey) {
      console.warn("[CompaniesHouse] API key not configured")
      return {}
    }

    try {
      // Fetch company profile
      const companyData = await this.fetchCompanyProfile(property.company_number)
      if (!companyData) {
        return {}
      }

      // Fetch company officers (directors)
      const officers = await this.fetchOfficers(property.company_number)

      const enrichment: Partial<PropertyListing> = {
        company_name: companyData.company_name,
        company_number: companyData.company_number,
        company_status: this.normalizeStatus(companyData.company_status),
        company_incorporation_date: companyData.date_of_creation,
        directors: officers,
        owner_enrichment_source: "companies_house",
      }

      // Update owner address if we have a registered office
      if (companyData.registered_office_address) {
        enrichment.owner_address = this.formatAddress(companyData.registered_office_address)
      }

      console.log(`[CompaniesHouse] Enriched company ${property.company_number}: ${enrichment.company_name}`)
      return enrichment
    } catch (error) {
      console.error(`[CompaniesHouse] Enrichment error for ${property.company_number}:`, error)
      return {}
    }
  }

  private async fetchCompanyProfile(companyNumber: string): Promise<any | null> {
    try {
      const response = await fetch(`${this.baseUrl}/company/${companyNumber}`, {
        headers: {
          "Authorization": `Basic ${Buffer.from(this.apiKey + ":").toString("base64")}`,
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`[CompaniesHouse] Company not found: ${companyNumber}`)
        } else {
          console.error(`[CompaniesHouse] API error: ${response.status}`)
        }
        return null
      }

      return await response.json()
    } catch (error) {
      console.error(`[CompaniesHouse] Error fetching company ${companyNumber}:`, error)
      return null
    }
  }

  private async fetchOfficers(companyNumber: string): Promise<Director[]> {
    try {
      const response = await fetch(`${this.baseUrl}/company/${companyNumber}/officers`, {
        headers: {
          "Authorization": `Basic ${Buffer.from(this.apiKey + ":").toString("base64")}`,
        },
      })

      if (!response.ok) {
        return []
      }

      const data = await response.json()

      if (!data.items || !Array.isArray(data.items)) {
        return []
      }

      // Filter to active directors only and format
      return data.items
        .filter((officer: any) => !officer.resigned_on)
        .map((officer: any) => ({
          name: officer.name,
          role: officer.officer_role || "Director",
          appointed_on: officer.appointed_on,
          resigned_on: officer.resigned_on,
        }))
        .slice(0, 10) // Limit to 10 directors
    } catch (error) {
      console.error(`[CompaniesHouse] Error fetching officers for ${companyNumber}:`, error)
      return []
    }
  }

  private normalizeStatus(status: string | undefined): string {
    if (!status) return "unknown"

    const statusMap: Record<string, string> = {
      "active": "active",
      "dissolved": "dissolved",
      "liquidation": "liquidation",
      "receivership": "receivership",
      "administration": "administration",
      "voluntary-arrangement": "voluntary-arrangement",
      "converted-closed": "converted-closed",
      "insolvency-proceedings": "insolvency",
      "registered": "active",
      "removed": "dissolved",
    }

    return statusMap[status.toLowerCase()] || status.toLowerCase()
  }

  private formatAddress(address: any): string {
    if (!address) return ""
    if (typeof address === "string") return address

    const parts = [
      address.premises,
      address.address_line_1,
      address.address_line_2,
      address.locality,
      address.region,
      address.postal_code,
      address.country,
    ].filter(Boolean)

    return parts.join(", ")
  }
}
