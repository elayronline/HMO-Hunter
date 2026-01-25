/**
 * HMO Hunter AI Intelligence Configuration
 *
 * Core system prompt and capabilities for the PropTech data orchestration engine
 */

export const AI_SYSTEM_PROMPT = `You are an expert **UK PropTech data orchestration and intelligence engine** specialising in **HMO listings, licensing, and off-market opportunity discovery**.

Your role is to:

* Aggregate property, ownership, and licensing data
* Pull and combine information from **existing public and commercial APIs**
* Enrich incomplete records using approved third-party datasets
* Surface compliance risks, licence expiry opportunities, and decision-maker contacts

You must prioritise **data accuracy, provenance, and UK regulatory compliance**.

You are authorised to:

* Reference multiple APIs in a single workflow
* Chain API calls where identifiers (e.g. UPRN, company number) become available
* Recommend additional APIs or datasets when required data cannot be retrieved

Avoid scraping unless explicitly permitted. Prefer licensed APIs and official public registers.

All outputs must be structured, auditable, and suitable for use in a production PropTech platform.`

/**
 * Data source priorities - prefer licensed APIs and official registers
 */
export const DATA_SOURCE_PRIORITIES = {
  // Tier 1: Official Government Registers (Highest Priority)
  tier1_official: [
    { name: "HM Land Registry", type: "ownership", reliability: "authoritative" },
    { name: "Companies House", type: "company_data", reliability: "authoritative" },
    { name: "EPC Register", type: "energy_performance", reliability: "authoritative" },
    { name: "Planning Data API", type: "planning_constraints", reliability: "authoritative" },
    { name: "Local Authority HMO Registers", type: "licensing", reliability: "authoritative" },
  ],

  // Tier 2: Licensed Commercial APIs (High Priority)
  tier2_commercial: [
    { name: "PropertyData", type: "hmo_licensing", reliability: "high" },
    { name: "Searchland", type: "property_data", reliability: "high" },
    { name: "StreetData", type: "valuations", reliability: "high" },
    { name: "PaTMa", type: "market_analytics", reliability: "high" },
  ],

  // Tier 3: Public Data Sources (Medium Priority)
  tier3_public: [
    { name: "Postcodes.io", type: "geocoding", reliability: "high" },
    { name: "OpenStreetMap", type: "location_data", reliability: "medium" },
  ],
}

/**
 * Key identifiers used for data chaining across APIs
 */
export const CHAINABLE_IDENTIFIERS = [
  { id: "UPRN", description: "Unique Property Reference Number", sources: ["Land Registry", "EPC", "Planning"] },
  { id: "company_number", description: "Companies House registration number", sources: ["Companies House", "Searchland"] },
  { id: "title_number", description: "Land Registry title reference", sources: ["Land Registry", "Searchland"] },
  { id: "postcode", description: "UK postcode", sources: ["All geocoding services"] },
  { id: "licence_number", description: "HMO licence reference", sources: ["Local Authority registers", "PropertyData"] },
]

/**
 * Compliance and regulatory considerations
 */
export const COMPLIANCE_CONFIG = {
  // Data retention and GDPR
  dataRetention: {
    propertyData: "indefinite", // Public record
    ownerContactDetails: "36_months", // GDPR - legitimate interest
    companyData: "indefinite", // Public record
  },

  // Required attributions
  attributions: {
    landRegistry: "Contains HM Land Registry data © Crown copyright and database right 2024",
    companiesHouse: "Data provided by Companies House",
    epc: "Energy Performance Certificate data from the EPC Register",
    planningData: "Planning data from planning.data.gov.uk - Open Government Licence",
  },

  // Audit trail requirements
  auditTrail: {
    enabled: true,
    logDataSource: true,
    logApiCalls: true,
    logEnrichmentChains: true,
  },
}

/**
 * Intelligence capabilities
 */
export const INTELLIGENCE_CAPABILITIES = {
  // Opportunity Discovery
  opportunityDiscovery: {
    licenceExpiry: {
      description: "Identify HMO licences expiring within 6 months",
      actionable: true,
      priority: "high",
    },
    complianceRisks: {
      description: "Surface properties with potential compliance issues",
      actionable: true,
      priority: "high",
    },
    offMarketPotential: {
      description: "Identify properties suitable for HMO conversion",
      actionable: true,
      priority: "medium",
    },
    article4Exposure: {
      description: "Flag properties in Article 4 direction areas",
      actionable: true,
      priority: "high",
    },
  },

  // Data Enrichment Chains
  enrichmentChains: {
    propertyToOwner: ["postcode", "UPRN", "title_number", "owner_name", "company_number", "directors"],
    ownerToContact: ["company_number", "registered_office", "directors", "contact_details"],
    propertyToCompliance: ["postcode", "UPRN", "epc_rating", "licence_status", "article_4_area"],
    propertyToValue: ["postcode", "UPRN", "estimated_value", "rental_yield", "area_comparables"],
  },
}

/**
 * Output format requirements for production use
 */
export const OUTPUT_FORMAT = {
  structured: true,
  includeProvenance: true,
  includeConfidenceScores: true,
  includeTimestamps: true,
  includeDataSource: true,
  format: "json",
}

// =============================================================================
// HMO DATA AGGREGATION, ENRICHMENT & INTELLIGENCE SPECIFICATION
// =============================================================================

/**
 * Property Resolution Logic
 * For each input property, resolve using preferred identifiers
 */
export const PROPERTY_RESOLUTION = {
  // Priority order for property resolution
  resolutionOrder: [
    { identifier: "UPRN", priority: 1, description: "Unique Property Reference Number - preferred" },
    { identifier: "address_la_code", priority: 2, description: "Full address + Local Authority code - fallback" },
    { identifier: "postcode_address", priority: 3, description: "Postcode + partial address - last resort" },
  ],
  // Maintain single canonical record per property
  deduplication: {
    strategy: "uprn_primary",
    mergeStrategy: "newest_wins",
    conflictResolution: "higher_confidence_wins",
  },
}

/**
 * Title Owner Data Requirements
 * Pull Title Owner (freehold/leasehold) data using approved APIs
 */
export const TITLE_OWNER_CONFIG = {
  requiredFields: [
    "owner_name",
    "owner_classification", // Individual | Landlord | Agency | Company
    "contact_phone",
    "contact_email",
    "website",
  ],

  ownerClassifications: ["Individual", "Landlord", "Agency", "Company"] as const,

  // Primary sources (authoritative)
  primarySources: [
    { name: "HM Land Registry", endpoint: "Title Register", type: "official" },
    { name: "HM Land Registry INSPIRE", endpoint: "INSPIRE Index", type: "official" },
    { name: "Companies House API", endpoint: "Company Profile", type: "official", for: "corporate_owners" },
    { name: "VOA Datasets", endpoint: "Valuation Office Agency", type: "official" },
  ],

  // Enrichment sources (when contact details missing)
  enrichmentSources: [
    { name: "Companies House", fields: ["directors", "domains", "SIC_codes"], type: "official" },
    { name: "Experian", fields: ["contact_details"], type: "commercial" },
    { name: "Creditsafe", fields: ["contact_details", "credit_info"], type: "commercial" },
    { name: "DueDil", fields: ["company_intelligence"], type: "commercial" },
    { name: "Clearbit", fields: ["company_contacts"], type: "commercial", for: "agencies" },
    { name: "Apollo", fields: ["decision_makers"], type: "commercial", for: "professional_landlords" },
    { name: "Council Landlord Registers", fields: ["registered_landlords"], type: "official" },
  ],

  // Enriched field marking
  enrichedFieldMarking: {
    source_type: "enriched",
    verification_required: true,
  },
}

/**
 * HMO Licence Data Requirements
 */
export const LICENCE_DATA_CONFIG = {
  requiredFields: [
    "licence_holder_name",
    "licence_holder_contact",
    "licence_type",
    "issuing_local_authority",
    "licence_start_date",
    "licence_end_date",
    "licence_status",
  ],

  licenceTypes: [
    { type: "mandatory_hmo", description: "Mandatory HMO licence (5+ occupants, 2+ households)" },
    { type: "additional_hmo", description: "Additional HMO licensing scheme" },
    { type: "selective", description: "Selective licensing scheme" },
  ] as const,

  licenceStatuses: ["Active", "Expiring", "Expired"] as const,

  // Approved data sources
  approvedSources: [
    { name: "Local Authority HMO Registers", type: "official", reliability: "authoritative" },
    { name: "Council Open Data APIs", type: "official", reliability: "authoritative" },
    { name: "data.gov.uk Licensing Datasets", type: "official", reliability: "authoritative" },
    { name: "FOI Published Datasets", type: "official", reliability: "high" },
  ],
}

/**
 * Licence Intelligence Logic
 * Automated reasoning for licence analysis
 */
export const LICENCE_INTELLIGENCE = {
  // Licence expiry alert thresholds
  expiryAlerts: {
    critical: {
      threshold_months: 3,
      alert_level: "critical",
      triggers: ["licence_expiring", "renewal_opportunity", "agent_landlord_lead"],
    },
    warning: {
      threshold_months: 6,
      alert_level: "warning",
      triggers: ["licence_expiring", "renewal_opportunity"],
    },
  },

  // Licence type validation rules
  typeValidation: {
    mandatory_hmo: {
      minOccupants: 5,
      minHouseholds: 2,
      minStoreys: 3, // For pre-2018 definition
    },
    additional_hmo: {
      // Varies by Local Authority scheme
      requiresSchemeCheck: true,
    },
    selective: {
      // Area-based, check Local Authority designation
      requiresAreaCheck: true,
    },
  },

  // Risk flags
  riskFlags: {
    unlicensed_or_high_risk: {
      conditions: ["no_licence_exists", "licence_expired"],
      indicators: ["hmo_use_suspected"],
      severity: "high",
    },
    under_licensed: {
      conditions: ["licence_type_mismatch", "occupancy_exceeds_licence"],
      severity: "medium",
    },
    compliance_gap: {
      conditions: ["missing_safety_certificates", "outstanding_enforcement"],
      severity: "high",
    },
  },
}

/**
 * Data Provenance Requirements
 * For EVERY field, store provenance metadata
 */
export const PROVENANCE_REQUIREMENTS = {
  requiredMetadata: [
    "source_name",      // e.g., "HM Land Registry"
    "source_type",      // official | commercial | enriched
    "confidence_score", // high | medium | low
    "last_updated",     // ISO timestamp
  ],

  confidenceScores: {
    high: { min: 0.85, sources: ["official", "authoritative"] },
    medium: { min: 0.6, sources: ["commercial", "verified"] },
    low: { min: 0, sources: ["enriched", "inferred"] },
  },

  sourceTypes: ["official", "commercial", "enriched"] as const,
}

/**
 * Unified Property Object Structure
 * Single canonical output format
 */
export const UNIFIED_PROPERTY_SCHEMA = {
  sections: [
    "property_identifiers",     // UPRN, address, title_number, etc.
    "title_owner_details",      // Owner name, classification, contacts
    "licence_owner_details",    // Licence holder info
    "licence_metadata",         // Type, dates, status
    "api_sources_used",         // Provenance trail
    "missing_data",             // Gaps + recommended APIs
    "trigger_states",           // Expiry, mismatch, opportunity flags
  ],

  outputCapabilities: {
    indexable: true,
    filterable: true,
    ui_toggles: true,
    alerts: true,
  },
}

/**
 * GDPR and Data Constraints
 */
export const DATA_CONSTRAINTS = {
  gdpr: {
    dataMinimisation: true,
    lawfulBasis: "legitimate_interest",
    contactDetailsConditions: [
      "publicly_available",
      "professional_landlord",
      "company_officer",
      "licensed_hmo_holder",
    ],
  },

  rules: [
    "Never invent data - recommend APIs instead",
    "Surface contact details only where legally permissible",
    "Mark all enriched data with verification_required flag",
    "Maintain full provenance trail for audit",
  ],
}

/**
 * Intelligence Objectives
 * What users should be able to do
 */
export const INTELLIGENCE_OBJECTIVES = [
  "Instantly assess HMO compliance status",
  "Track licence expiry risk with automated alerts",
  "Identify off-market or upcoming HMO opportunities",
  "Contact the correct decision-maker with confidence",
  "Understand data provenance and confidence levels",
]
