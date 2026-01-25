/**
 * HMO Hunter Data Intelligence Service
 *
 * Orchestrates data aggregation, enrichment, and opportunity discovery
 * across multiple UK PropTech APIs and official registers.
 */

import {
  AI_SYSTEM_PROMPT,
  DATA_SOURCE_PRIORITIES,
  CHAINABLE_IDENTIFIERS,
  COMPLIANCE_CONFIG,
  INTELLIGENCE_CAPABILITIES,
  OUTPUT_FORMAT,
} from "@/lib/config/ai-intelligence"

export interface DataProvenance {
  source: string
  sourceType: "official" | "commercial" | "public"
  retrievedAt: string
  reliability: "authoritative" | "high" | "medium" | "low"
  apiEndpoint?: string
}

export interface EnrichedProperty {
  id: string
  data: Record<string, any>
  provenance: DataProvenance[]
  confidenceScore: number
  enrichmentChain: string[]
  complianceRisks: ComplianceRisk[]
  opportunities: Opportunity[]
}

export interface ComplianceRisk {
  type: string
  severity: "high" | "medium" | "low"
  description: string
  recommendation: string
}

export interface Opportunity {
  type: string
  priority: "high" | "medium" | "low"
  description: string
  actionable: boolean
  expiryDate?: string
}

export class DataIntelligenceService {
  private auditLog: AuditEntry[] = []

  /**
   * Get the system prompt for AI-powered analysis
   */
  getSystemPrompt(): string {
    return AI_SYSTEM_PROMPT
  }

  /**
   * Get available data sources by priority tier
   */
  getDataSources() {
    return DATA_SOURCE_PRIORITIES
  }

  /**
   * Get chainable identifiers for cross-API enrichment
   */
  getChainableIdentifiers() {
    return CHAINABLE_IDENTIFIERS
  }

  /**
   * Analyze a property for compliance risks
   */
  analyzeComplianceRisks(property: Record<string, any>): ComplianceRisk[] {
    const risks: ComplianceRisk[] = []

    // Check licence expiry
    if (property.licence_end_date) {
      const expiryDate = new Date(property.licence_end_date)
      const sixMonthsFromNow = new Date()
      sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6)

      if (expiryDate < sixMonthsFromNow) {
        risks.push({
          type: "licence_expiry",
          severity: expiryDate < new Date() ? "high" : "medium",
          description: `HMO licence ${expiryDate < new Date() ? "has expired" : "expires soon"} on ${expiryDate.toLocaleDateString()}`,
          recommendation: "Contact property owner about licence renewal or acquisition opportunity",
        })
      }
    }

    // Check EPC rating
    if (property.epc_rating && ["F", "G"].includes(property.epc_rating)) {
      risks.push({
        type: "epc_compliance",
        severity: "high",
        description: `EPC rating ${property.epc_rating} does not meet minimum rental standards`,
        recommendation: "Property requires energy efficiency improvements before letting",
      })
    }

    // Check Article 4 area
    if (property.article_4_area) {
      risks.push({
        type: "article_4_restriction",
        severity: "medium",
        description: "Property is in an Article 4 direction area - planning permission required for HMO conversion",
        recommendation: "Check local planning authority requirements before conversion",
      })
    }

    // Check mandatory licensing threshold
    if (property.bedrooms && property.bedrooms >= 5) {
      if (!property.licence_id) {
        risks.push({
          type: "mandatory_licensing",
          severity: "high",
          description: "Property with 5+ bedrooms requires mandatory HMO licence",
          recommendation: "Verify licensing status with local authority",
        })
      }
    }

    return risks
  }

  /**
   * Identify opportunities for a property
   */
  identifyOpportunities(property: Record<string, any>): Opportunity[] {
    const opportunities: Opportunity[] = []

    // Licence expiry opportunity
    if (property.licence_end_date) {
      const expiryDate = new Date(property.licence_end_date)
      const threeMonthsFromNow = new Date()
      threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3)

      if (expiryDate < threeMonthsFromNow && expiryDate > new Date()) {
        opportunities.push({
          type: "licence_expiry_acquisition",
          priority: "high",
          description: "Licence expiring soon - owner may be willing to sell",
          actionable: true,
          expiryDate: expiryDate.toISOString(),
        })
      }
    }

    // Potential HMO conversion
    if (property.is_potential_hmo || property.hmo_classification === "ready_to_go") {
      opportunities.push({
        type: "hmo_conversion",
        priority: "high",
        description: "Property identified as suitable for HMO conversion",
        actionable: true,
      })
    }

    // Value-add opportunity
    if (property.has_value_add_potential) {
      opportunities.push({
        type: "value_add",
        priority: "medium",
        description: "Property has potential for value improvement",
        actionable: true,
      })
    }

    // High yield opportunity
    if (property.yield_band === "high" || (property.estimated_yield_percentage && property.estimated_yield_percentage > 8)) {
      opportunities.push({
        type: "high_yield",
        priority: "high",
        description: `Property offers above-average yield potential`,
        actionable: true,
      })
    }

    return opportunities
  }

  /**
   * Plan enrichment chain based on available identifiers
   */
  planEnrichmentChain(property: Record<string, any>): string[] {
    const chain: string[] = []
    const available = new Set<string>()

    // Check what identifiers we have
    if (property.postcode) available.add("postcode")
    if (property.uprn) available.add("UPRN")
    if (property.title_number) available.add("title_number")
    if (property.company_number) available.add("company_number")
    if (property.licence_id) available.add("licence_number")

    // Determine enrichment path
    if (available.has("postcode") && !available.has("UPRN")) {
      chain.push("geocode_to_uprn")
    }

    if (available.has("UPRN") || available.has("postcode")) {
      if (!property.epc_rating) chain.push("fetch_epc")
      if (!property.owner_name) chain.push("fetch_ownership")
      if (!property.article_4_area) chain.push("check_planning_constraints")
    }

    if (available.has("company_number")) {
      if (!property.directors) chain.push("fetch_company_details")
    }

    if (property.owner_type === "company" && property.company_name && !property.company_number) {
      chain.push("lookup_company_number")
    }

    return chain
  }

  /**
   * Add entry to audit log
   */
  logAuditEntry(entry: Omit<AuditEntry, "timestamp">) {
    if (COMPLIANCE_CONFIG.auditTrail.enabled) {
      this.auditLog.push({
        ...entry,
        timestamp: new Date().toISOString(),
      })
    }
  }

  /**
   * Get audit log
   */
  getAuditLog(): AuditEntry[] {
    return this.auditLog
  }

  /**
   * Get required data attributions
   */
  getAttributions(): Record<string, string> {
    return COMPLIANCE_CONFIG.attributions
  }

  /**
   * Format output according to production requirements
   */
  formatOutput<T>(data: T, provenance: DataProvenance[]): FormattedOutput<T> {
    return {
      data,
      provenance,
      timestamp: new Date().toISOString(),
      format: OUTPUT_FORMAT.format,
      confidenceScore: this.calculateConfidenceScore(provenance),
    }
  }

  private calculateConfidenceScore(provenance: DataProvenance[]): number {
    if (provenance.length === 0) return 0

    const reliabilityScores: Record<string, number> = {
      authoritative: 1.0,
      high: 0.85,
      medium: 0.7,
      low: 0.5,
    }

    const totalScore = provenance.reduce((sum, p) => sum + reliabilityScores[p.reliability], 0)
    return Math.round((totalScore / provenance.length) * 100) / 100
  }
}

interface AuditEntry {
  timestamp: string
  action: string
  dataSource: string
  identifiers: Record<string, string>
  success: boolean
  errorMessage?: string
}

interface FormattedOutput<T> {
  data: T
  provenance: DataProvenance[]
  timestamp: string
  format: string
  confidenceScore: number
}

// Export singleton instance
export const dataIntelligence = new DataIntelligenceService()
