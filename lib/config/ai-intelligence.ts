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
