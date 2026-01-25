/**
 * HMO Hunter Data Intelligence Service
 *
 * Orchestrates data aggregation, enrichment, and opportunity discovery
 * across multiple UK PropTech APIs and official registers.
 *
 * Builds structured property intelligence objects for:
 * - Active HMOs
 * - Potential HMOs (conversion or licence-expiry opportunities)
 */

import {
  AI_SYSTEM_PROMPT,
  DATA_SOURCE_PRIORITIES,
  CHAINABLE_IDENTIFIERS,
  COMPLIANCE_CONFIG,
  INTELLIGENCE_CAPABILITIES,
  OUTPUT_FORMAT,
  PROPERTY_RESOLUTION,
  TITLE_OWNER_CONFIG,
  LICENCE_DATA_CONFIG,
  LICENCE_INTELLIGENCE,
  PROVENANCE_REQUIREMENTS,
  UNIFIED_PROPERTY_SCHEMA,
  DATA_CONSTRAINTS,
} from "@/lib/config/ai-intelligence"

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface FieldProvenance {
  source_name: string
  source_type: "official" | "commercial" | "enriched"
  confidence_score: "high" | "medium" | "low"
  last_updated: string
  verification_required?: boolean
}

export interface DataProvenance {
  source: string
  sourceType: "official" | "commercial" | "public" | "enriched"
  retrievedAt: string
  reliability: "authoritative" | "high" | "medium" | "low"
  apiEndpoint?: string
}

export type OwnerClassification = "Individual" | "Landlord" | "Agency" | "Company"

export type LicenceType = "mandatory_hmo" | "additional_hmo" | "selective"

export type LicenceStatus = "Active" | "Expiring" | "Expired"

export type AlertLevel = "critical" | "warning" | "info"

export interface TitleOwnerDetails {
  owner_name: string | null
  owner_classification: OwnerClassification | null
  contact_phone: string | null
  contact_email: string | null
  website: string | null
  provenance: FieldProvenance
}

export interface LicenceOwnerDetails {
  licence_holder_name: string | null
  licence_holder_contact: string | null
  provenance: FieldProvenance
}

export interface LicenceMetadata {
  licence_type: LicenceType | null
  issuing_local_authority: string | null
  licence_start_date: string | null
  licence_end_date: string | null
  licence_status: LicenceStatus
  licence_number: string | null
  provenance: FieldProvenance
}

export interface TriggerState {
  type: string
  alert_level: AlertLevel
  triggered: boolean
  description: string
  action_required?: string
}

export interface MissingData {
  field: string
  recommended_apis: string[]
  priority: "high" | "medium" | "low"
}

export interface UnifiedPropertyObject {
  // Property Identifiers
  property_identifiers: {
    id: string
    uprn: string | null
    title_number: string | null
    address: string
    postcode: string
    local_authority_code: string | null
  }

  // Title Owner Details
  title_owner: TitleOwnerDetails

  // Licence Owner & Metadata
  licence_owner: LicenceOwnerDetails
  licence_metadata: LicenceMetadata

  // API Sources Used
  api_sources_used: DataProvenance[]

  // Missing Data & Recommendations
  missing_data: MissingData[]

  // Trigger States
  trigger_states: TriggerState[]

  // Metadata
  created_at: string
  last_updated: string
  overall_confidence_score: number
}

export interface ComplianceRisk {
  type: string
  severity: "high" | "medium" | "low"
  description: string
  recommendation: string
  risk_status?: string
}

export interface Opportunity {
  type: string
  priority: "high" | "medium" | "low"
  description: string
  actionable: boolean
  expiryDate?: string
  triggers?: string[]
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

  // ===========================================================================
  // PROPERTY RESOLUTION LOGIC
  // ===========================================================================

  /**
   * Resolve property using preferred identifiers
   * Priority: UPRN > Address + LA Code > Postcode + Address
   */
  resolveProperty(property: Record<string, any>): {
    resolved: boolean
    method: string
    canonicalId: string | null
  } {
    // Priority 1: UPRN (preferred)
    if (property.uprn) {
      return {
        resolved: true,
        method: "UPRN",
        canonicalId: property.uprn,
      }
    }

    // Priority 2: Full address + Local Authority code
    if (property.address && property.local_authority_code) {
      const canonicalId = `${property.local_authority_code}:${this.normalizeAddress(property.address)}`
      return {
        resolved: true,
        method: "address_la_code",
        canonicalId,
      }
    }

    // Priority 3: Postcode + partial address (last resort)
    if (property.postcode && property.address) {
      const canonicalId = `${property.postcode}:${this.normalizeAddress(property.address)}`
      return {
        resolved: true,
        method: "postcode_address",
        canonicalId,
      }
    }

    return {
      resolved: false,
      method: "none",
      canonicalId: null,
    }
  }

  private normalizeAddress(address: string): string {
    return address
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 50)
  }

  // ===========================================================================
  // OWNER CLASSIFICATION
  // ===========================================================================

  /**
   * Classify owner type based on available data
   */
  classifyOwner(property: Record<string, any>): OwnerClassification {
    // Check for company indicators
    if (property.company_number || property.company_name) {
      return "Company"
    }

    // Check for agency indicators
    if (property.owner_type === "agency" ||
        property.owner_name?.toLowerCase().includes("lettings") ||
        property.owner_name?.toLowerCase().includes("estate agent") ||
        property.owner_name?.toLowerCase().includes("property management")) {
      return "Agency"
    }

    // Check for professional landlord indicators
    if (property.owner_type === "landlord" ||
        property.portfolio_size > 1 ||
        property.is_professional_landlord) {
      return "Landlord"
    }

    // Default to individual
    return "Individual"
  }

  // ===========================================================================
  // LICENCE INTELLIGENCE LOGIC
  // ===========================================================================

  /**
   * Calculate licence status with alert levels
   */
  calculateLicenceStatus(licenceEndDate: string | null): {
    status: LicenceStatus
    alert_level: AlertLevel | null
    days_until_expiry: number | null
    triggers: string[]
  } {
    if (!licenceEndDate) {
      return {
        status: "Expired",
        alert_level: null,
        days_until_expiry: null,
        triggers: [],
      }
    }

    const endDate = new Date(licenceEndDate)
    const now = new Date()
    const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    // Expired
    if (daysUntilExpiry < 0) {
      return {
        status: "Expired",
        alert_level: "critical",
        days_until_expiry: daysUntilExpiry,
        triggers: ["licence_expired", "compliance_risk"],
      }
    }

    // Critical: ≤ 3 months (90 days)
    if (daysUntilExpiry <= 90) {
      return {
        status: "Expiring",
        alert_level: "critical",
        days_until_expiry: daysUntilExpiry,
        triggers: ["licence_expiring", "renewal_opportunity", "agent_landlord_lead"],
      }
    }

    // Warning: 3-6 months (91-180 days)
    if (daysUntilExpiry <= 180) {
      return {
        status: "Expiring",
        alert_level: "warning",
        days_until_expiry: daysUntilExpiry,
        triggers: ["licence_expiring", "renewal_opportunity"],
      }
    }

    // Active
    return {
      status: "Active",
      alert_level: null,
      days_until_expiry: daysUntilExpiry,
      triggers: [],
    }
  }

  /**
   * Validate licence type against property indicators
   */
  validateLicenceType(property: Record<string, any>): {
    valid: boolean
    issues: string[]
    recommended_type: LicenceType | null
  } {
    const issues: string[] = []
    let recommendedType: LicenceType | null = null

    const occupants = property.max_occupants || property.bedrooms || 0
    const households = property.households || (occupants > 1 ? 2 : 1)

    // Check for mandatory HMO requirements
    if (occupants >= 5 && households >= 2) {
      recommendedType = "mandatory_hmo"

      if (property.licence_type && property.licence_type !== "mandatory_hmo") {
        issues.push("Property requires mandatory HMO licence but has different licence type")
      }
    }

    // Check for potential under-licensing
    if (property.licence_type === "additional_hmo" && occupants >= 5) {
      issues.push("Property may require mandatory licence upgrade (5+ occupants)")
    }

    return {
      valid: issues.length === 0,
      issues,
      recommended_type: recommendedType,
    }
  }

  /**
   * Detect unlicensed or high-risk properties
   */
  detectUnlicensedRisk(property: Record<string, any>): {
    risk_status: string | null
    risk_indicators: string[]
    severity: "high" | "medium" | "low" | null
  } {
    const indicators: string[] = []

    // Check for HMO use indicators
    if (property.bedrooms >= 3) indicators.push("multiple_bedrooms")
    if (property.hmo_status?.includes("HMO")) indicators.push("hmo_classification")
    if (property.is_potential_hmo) indicators.push("potential_hmo_flagged")
    if (property.max_occupants >= 3) indicators.push("multiple_occupants")

    // If HMO indicators present but no licence
    if (indicators.length >= 2) {
      const licenceStatus = this.calculateLicenceStatus(property.licence_end_date)

      if (!property.licence_id || licenceStatus.status === "Expired") {
        return {
          risk_status: "unlicensed_or_high_risk",
          risk_indicators: indicators,
          severity: "high",
        }
      }
    }

    return {
      risk_status: null,
      risk_indicators: indicators,
      severity: null,
    }
  }

  // ===========================================================================
  // COMPLIANCE RISK ANALYSIS
  // ===========================================================================

  /**
   * Analyze a property for compliance risks
   */
  analyzeComplianceRisks(property: Record<string, any>): ComplianceRisk[] {
    const risks: ComplianceRisk[] = []

    // Check licence status
    const licenceStatus = this.calculateLicenceStatus(property.licence_end_date)

    if (licenceStatus.alert_level === "critical") {
      risks.push({
        type: "licence_expiry",
        severity: "high",
        description: licenceStatus.status === "Expired"
          ? `HMO licence has expired`
          : `HMO licence expires in ${licenceStatus.days_until_expiry} days`,
        recommendation: "Contact property owner about licence renewal or acquisition opportunity",
        risk_status: licenceStatus.status === "Expired" ? "unlicensed_or_high_risk" : undefined,
      })
    } else if (licenceStatus.alert_level === "warning") {
      risks.push({
        type: "licence_expiry",
        severity: "medium",
        description: `HMO licence expires in ${licenceStatus.days_until_expiry} days`,
        recommendation: "Monitor for renewal opportunity",
      })
    }

    // Validate licence type
    const licenceValidation = this.validateLicenceType(property)
    if (!licenceValidation.valid) {
      licenceValidation.issues.forEach(issue => {
        risks.push({
          type: "licence_type_mismatch",
          severity: "medium",
          description: issue,
          recommendation: "Review licence type with local authority",
        })
      })
    }

    // Check for unlicensed risk
    const unlicensedRisk = this.detectUnlicensedRisk(property)
    if (unlicensedRisk.risk_status) {
      risks.push({
        type: "unlicensed_hmo",
        severity: unlicensedRisk.severity || "high",
        description: "Property shows HMO indicators but may be unlicensed",
        recommendation: "Verify licensing status - potential enforcement risk or acquisition opportunity",
        risk_status: unlicensedRisk.risk_status,
      })
    }

    // Check EPC rating
    if (property.epc_rating && ["F", "G"].includes(property.epc_rating)) {
      risks.push({
        type: "epc_compliance",
        severity: "high",
        description: `EPC rating ${property.epc_rating} does not meet minimum rental standards (E or above required)`,
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

    // Licence expiry opportunity with trigger states
    const licenceStatus = this.calculateLicenceStatus(property.licence_end_date)

    if (licenceStatus.triggers.includes("renewal_opportunity")) {
      opportunities.push({
        type: "licence_expiry_acquisition",
        priority: licenceStatus.alert_level === "critical" ? "high" : "medium",
        description: licenceStatus.days_until_expiry !== null
          ? `Licence expires in ${licenceStatus.days_until_expiry} days - owner may be willing to sell`
          : "Licence expired - potential acquisition opportunity",
        actionable: true,
        expiryDate: property.licence_end_date,
        triggers: licenceStatus.triggers,
      })
    }

    if (licenceStatus.triggers.includes("agent_landlord_lead")) {
      opportunities.push({
        type: "agent_landlord_lead",
        priority: "high",
        description: "High-value lead for landlord services - licence renewal support needed",
        actionable: true,
        triggers: ["agent_landlord_lead"],
      })
    }

    // Potential HMO conversion
    if (property.is_potential_hmo || property.hmo_classification === "ready_to_go") {
      opportunities.push({
        type: "hmo_conversion",
        priority: "high",
        description: "Property identified as suitable for HMO conversion",
        actionable: true,
        triggers: ["conversion_opportunity"],
      })
    }

    // Value-add opportunity
    if (property.has_value_add_potential || property.hmo_classification === "value_add") {
      opportunities.push({
        type: "value_add",
        priority: "medium",
        description: "Property has potential for value improvement through refurbishment or reconfiguration",
        actionable: true,
        triggers: ["value_add_potential"],
      })
    }

    // High yield opportunity
    if (property.yield_band === "high" || (property.estimated_yield_percentage && property.estimated_yield_percentage > 8)) {
      opportunities.push({
        type: "high_yield",
        priority: "high",
        description: `Property offers above-average yield potential (${property.estimated_yield_percentage ? property.estimated_yield_percentage.toFixed(1) + "%" : "high band"})`,
        actionable: true,
        triggers: ["high_yield"],
      })
    }

    // Unlicensed HMO opportunity
    const unlicensedRisk = this.detectUnlicensedRisk(property)
    if (unlicensedRisk.risk_status === "unlicensed_or_high_risk") {
      opportunities.push({
        type: "unlicensed_hmo_acquisition",
        priority: "high",
        description: "Property may be operating as unlicensed HMO - potential distressed seller",
        actionable: true,
        triggers: ["unlicensed_opportunity", "compliance_pressure"],
      })
    }

    return opportunities
  }

  // ===========================================================================
  // UNIFIED PROPERTY OBJECT GENERATION
  // ===========================================================================

  /**
   * Build a unified property intelligence object
   */
  buildUnifiedPropertyObject(property: Record<string, any>): UnifiedPropertyObject {
    const now = new Date().toISOString()
    const licenceStatus = this.calculateLicenceStatus(property.licence_end_date)
    const ownerClassification = this.classifyOwner(property)
    const resolution = this.resolveProperty(property)
    const missingData = this.identifyMissingData(property)
    const triggerStates = this.calculateTriggerStates(property)

    // Build provenance for owner data
    const ownerProvenance: FieldProvenance = {
      source_name: property.owner_enrichment_source || "Unknown",
      source_type: property.owner_enrichment_source ? "enriched" : "official",
      confidence_score: property.owner_enrichment_source ? "medium" : "high",
      last_updated: property.title_last_enriched_at || now,
      verification_required: property.owner_enrichment_source !== undefined,
    }

    // Build provenance for licence data
    const licenceProvenance: FieldProvenance = {
      source_name: property.source_name || "Local Authority Register",
      source_type: "official",
      confidence_score: "high",
      last_updated: property.last_synced || now,
    }

    // Calculate overall confidence
    const provenanceScores = [ownerProvenance, licenceProvenance]
    const overallConfidence = this.calculateOverallConfidence(provenanceScores)

    return {
      property_identifiers: {
        id: property.id,
        uprn: property.uprn || null,
        title_number: property.title_number || null,
        address: property.address,
        postcode: property.postcode,
        local_authority_code: property.local_authority_code || null,
      },

      title_owner: {
        owner_name: property.owner_name || null,
        owner_classification: ownerClassification,
        contact_phone: property.owner_contact_phone || null,
        contact_email: property.owner_contact_email || null,
        website: property.website || null,
        provenance: ownerProvenance,
      },

      licence_owner: {
        licence_holder_name: property.licence_holder_name || property.owner_name || null,
        licence_holder_contact: property.licence_holder_contact || null,
        provenance: licenceProvenance,
      },

      licence_metadata: {
        licence_type: property.licence_type || null,
        issuing_local_authority: property.local_authority || null,
        licence_start_date: property.licence_start_date || null,
        licence_end_date: property.licence_end_date || null,
        licence_status: licenceStatus.status,
        licence_number: property.licence_id || null,
        provenance: licenceProvenance,
      },

      api_sources_used: this.getApiSourcesUsed(property),

      missing_data: missingData,

      trigger_states: triggerStates,

      created_at: property.created_at || now,
      last_updated: now,
      overall_confidence_score: overallConfidence,
    }
  }

  /**
   * Identify missing data fields and recommend APIs
   */
  identifyMissingData(property: Record<string, any>): MissingData[] {
    const missing: MissingData[] = []

    if (!property.uprn) {
      missing.push({
        field: "uprn",
        recommended_apis: ["Ordnance Survey AddressBase", "EPC Register lookup"],
        priority: "high",
      })
    }

    if (!property.owner_name) {
      missing.push({
        field: "owner_name",
        recommended_apis: ["HM Land Registry", "Searchland Title API"],
        priority: "high",
      })
    }

    if (!property.owner_contact_email && !property.owner_contact_phone) {
      missing.push({
        field: "owner_contact_details",
        recommended_apis: ["Companies House", "Clearbit", "Apollo"],
        priority: "medium",
      })
    }

    if (!property.epc_rating) {
      missing.push({
        field: "epc_rating",
        recommended_apis: ["EPC Register API", "Searchland EPC API"],
        priority: "medium",
      })
    }

    if (!property.licence_id && property.hmo_status?.includes("HMO")) {
      missing.push({
        field: "licence_details",
        recommended_apis: ["PropertyData HMO Register", "Local Authority API"],
        priority: "high",
      })
    }

    if (property.owner_type === "Company" && !property.directors) {
      missing.push({
        field: "company_directors",
        recommended_apis: ["Companies House API"],
        priority: "medium",
      })
    }

    return missing
  }

  /**
   * Calculate trigger states for alerts and UI
   */
  calculateTriggerStates(property: Record<string, any>): TriggerState[] {
    const triggers: TriggerState[] = []
    const licenceStatus = this.calculateLicenceStatus(property.licence_end_date)

    // Licence expiry triggers
    if (licenceStatus.alert_level === "critical") {
      triggers.push({
        type: "licence_expiring",
        alert_level: "critical",
        triggered: true,
        description: `Licence expires in ${licenceStatus.days_until_expiry} days`,
        action_required: "Contact owner for renewal support or acquisition",
      })
    } else if (licenceStatus.alert_level === "warning") {
      triggers.push({
        type: "licence_expiring",
        alert_level: "warning",
        triggered: true,
        description: `Licence expires in ${licenceStatus.days_until_expiry} days`,
        action_required: "Monitor for opportunity",
      })
    }

    // Unlicensed risk trigger
    const unlicensedRisk = this.detectUnlicensedRisk(property)
    if (unlicensedRisk.risk_status) {
      triggers.push({
        type: "unlicensed_risk",
        alert_level: "critical",
        triggered: true,
        description: "Property may be operating without proper HMO licence",
        action_required: "Verify licence status - potential enforcement or acquisition opportunity",
      })
    }

    // Licence type mismatch trigger
    const validation = this.validateLicenceType(property)
    if (!validation.valid) {
      triggers.push({
        type: "licence_mismatch",
        alert_level: "warning",
        triggered: true,
        description: validation.issues.join("; "),
        action_required: "Review licence requirements with local authority",
      })
    }

    // EPC compliance trigger
    if (property.epc_rating && ["F", "G"].includes(property.epc_rating)) {
      triggers.push({
        type: "epc_non_compliant",
        alert_level: "critical",
        triggered: true,
        description: `EPC rating ${property.epc_rating} below minimum standard`,
        action_required: "Property cannot be legally let without improvements",
      })
    }

    return triggers
  }

  private getApiSourcesUsed(property: Record<string, any>): DataProvenance[] {
    const sources: DataProvenance[] = []

    if (property.source_name) {
      sources.push({
        source: property.source_name,
        sourceType: "commercial",
        retrievedAt: property.last_synced || new Date().toISOString(),
        reliability: "high",
      })
    }

    if (property.owner_enrichment_source) {
      sources.push({
        source: property.owner_enrichment_source,
        sourceType: "enriched",
        retrievedAt: property.title_last_enriched_at || new Date().toISOString(),
        reliability: "medium",
      })
    }

    return sources
  }

  private calculateOverallConfidence(provenances: FieldProvenance[]): number {
    const scoreMap = { high: 1.0, medium: 0.7, low: 0.4 }
    const total = provenances.reduce((sum, p) => sum + scoreMap[p.confidence_score], 0)
    return Math.round((total / provenances.length) * 100) / 100
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
