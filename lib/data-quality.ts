/**
 * Data Quality & Freshness Model
 *
 * HMO Hunter's USP is accurate, refreshed, and up-to-date data.
 * This module defines the rules engine that enforces data quality
 * guarantees across every property and data source.
 *
 * Three pillars:
 * 1. FRESHNESS — how recently each data source was verified
 * 2. COMPLETENESS — how many enrichment fields are populated
 * 3. CONFIDENCE — cross-source validation and data reliability
 */

// ============================================================
// 1. FRESHNESS RULES — Per-source SLA definitions
// ============================================================

export type DataSource =
  | "listing"          // Zoopla/Rightmove listing data
  | "hmo_register"     // PropertyData HMO register
  | "title_owner"      // Searchland title/ownership
  | "epc"              // EPC register
  | "planning"         // Planning/Article 4
  | "companies_house"  // Corporate landlord data
  | "street_data"      // StreetData property attributes
  | "patma"            // PaTMa transaction history
  | "broadband"        // OFCOM broadband coverage
  | "land_registry"    // Land Registry price paid
  | "kamma"            // Kamma HMO compliance
  | "zoopla_images"    // Zoopla property images

export type FreshnessStatus = "live" | "fresh" | "aging" | "stale" | "expired"

export interface FreshnessRule {
  source: DataSource
  label: string
  // Thresholds in days
  liveThreshold: number      // "Verified today" — data refreshed within this window
  freshThreshold: number     // "Fresh" — acceptable, no action needed
  agingThreshold: number     // "Aging" — should refresh soon
  staleThreshold: number     // "Stale" — data unreliable, warn user
  // After staleThreshold: "Expired" — do not show to user without warning
  refreshPriority: 1 | 2 | 3  // 1=critical, 2=important, 3=nice-to-have
  volatility: "high" | "medium" | "low"  // How fast this data changes
}

export const FRESHNESS_RULES: Record<DataSource, FreshnessRule> = {
  listing: {
    source: "listing",
    label: "Property Listing",
    liveThreshold: 1,
    freshThreshold: 3,
    agingThreshold: 7,
    staleThreshold: 14,
    refreshPriority: 1,
    volatility: "high",  // Listings change daily
  },
  hmo_register: {
    source: "hmo_register",
    label: "HMO Register",
    liveThreshold: 7,
    freshThreshold: 30,
    agingThreshold: 60,
    staleThreshold: 90,
    refreshPriority: 1,
    volatility: "medium",  // Council registers update monthly
  },
  title_owner: {
    source: "title_owner",
    label: "Title/Ownership",
    liveThreshold: 30,
    freshThreshold: 90,
    agingThreshold: 180,
    staleThreshold: 365,
    refreshPriority: 2,
    volatility: "low",  // Ownership rarely changes
  },
  epc: {
    source: "epc",
    label: "EPC Rating",
    liveThreshold: 30,
    freshThreshold: 180,
    agingThreshold: 365,
    staleThreshold: 730,
    refreshPriority: 3,
    volatility: "low",  // EPCs valid for 10 years
  },
  planning: {
    source: "planning",
    label: "Planning/Article 4",
    liveThreshold: 7,
    freshThreshold: 30,
    agingThreshold: 90,
    staleThreshold: 180,
    refreshPriority: 2,
    volatility: "medium",
  },
  companies_house: {
    source: "companies_house",
    label: "Companies House",
    liveThreshold: 30,
    freshThreshold: 90,
    agingThreshold: 180,
    staleThreshold: 365,
    refreshPriority: 3,
    volatility: "low",
  },
  street_data: {
    source: "street_data",
    label: "Property Attributes",
    liveThreshold: 30,
    freshThreshold: 90,
    agingThreshold: 180,
    staleThreshold: 365,
    refreshPriority: 3,
    volatility: "low",  // Year built, council tax band don't change
  },
  patma: {
    source: "patma",
    label: "Price History",
    liveThreshold: 7,
    freshThreshold: 30,
    agingThreshold: 60,
    staleThreshold: 90,
    refreshPriority: 2,
    volatility: "medium",
  },
  broadband: {
    source: "broadband",
    label: "Broadband Coverage",
    liveThreshold: 30,
    freshThreshold: 90,
    agingThreshold: 180,
    staleThreshold: 365,
    refreshPriority: 3,
    volatility: "low",
  },
  land_registry: {
    source: "land_registry",
    label: "Land Registry",
    liveThreshold: 30,
    freshThreshold: 90,
    agingThreshold: 180,
    staleThreshold: 365,
    refreshPriority: 2,
    volatility: "low",
  },
  kamma: {
    source: "kamma",
    label: "HMO Compliance",
    liveThreshold: 7,
    freshThreshold: 30,
    agingThreshold: 60,
    staleThreshold: 90,
    refreshPriority: 1,
    volatility: "medium",
  },
  zoopla_images: {
    source: "zoopla_images",
    label: "Property Images",
    liveThreshold: 7,
    freshThreshold: 30,
    agingThreshold: 90,
    staleThreshold: 180,
    refreshPriority: 3,
    volatility: "medium",
  },
}

// ============================================================
// 2. FRESHNESS ASSESSMENT
// ============================================================

export function assessFreshness(
  enrichedAt: string | null,
  rule: FreshnessRule
): { status: FreshnessStatus; daysSince: number; label: string; actionRequired: boolean } {
  if (!enrichedAt) {
    return { status: "expired", daysSince: Infinity, label: "Never enriched", actionRequired: true }
  }

  const daysSince = Math.floor(
    (Date.now() - new Date(enrichedAt).getTime()) / (1000 * 60 * 60 * 24)
  )

  if (daysSince <= rule.liveThreshold) {
    return { status: "live", daysSince, label: "Verified", actionRequired: false }
  }
  if (daysSince <= rule.freshThreshold) {
    return { status: "fresh", daysSince, label: "Fresh", actionRequired: false }
  }
  if (daysSince <= rule.agingThreshold) {
    return { status: "aging", daysSince, label: "Aging", actionRequired: false }
  }
  if (daysSince <= rule.staleThreshold) {
    return { status: "stale", daysSince, label: "Stale", actionRequired: true }
  }

  return { status: "expired", daysSince, label: "Expired", actionRequired: true }
}

// ============================================================
// 3. COMPLETENESS SCORING — per-property data quality
// ============================================================

// Fields grouped by importance for completeness scoring
export const COMPLETENESS_FIELDS = {
  critical: [
    { field: "address", weight: 10 },
    { field: "postcode", weight: 10 },
    { field: "city", weight: 5 },
    { field: "bedrooms", weight: 8 },
    { field: "listing_type", weight: 5 },
  ],
  important: [
    { field: "purchase_price", weight: 7, condition: "listing_type === 'purchase'" },
    { field: "price_pcm", weight: 7, condition: "listing_type === 'rent'" },
    { field: "hmo_status", weight: 8 },
    { field: "licence_status", weight: 7 },
    { field: "epc_rating", weight: 6 },
    { field: "owner_name", weight: 7 },
    { field: "deal_score", weight: 5 },
  ],
  enrichment: [
    { field: "owner_contact_email", weight: 5 },
    { field: "owner_contact_phone", weight: 5 },
    { field: "licence_holder_name", weight: 4 },
    { field: "company_name", weight: 3 },
    { field: "article_4_area", weight: 4 },
    { field: "gross_internal_area_sqm", weight: 3 },
    { field: "estimated_yield_percentage", weight: 4 },
    { field: "primary_image", weight: 3 },
    { field: "broadband_max_down", weight: 2 },
    { field: "year_built", weight: 2 },
  ],
} as const

export type CompletenessGroup = keyof typeof COMPLETENESS_FIELDS

export interface CompletenessResult {
  score: number              // 0-100
  grade: "A" | "B" | "C" | "D" | "F"
  filledFields: number
  totalFields: number
  missingCritical: string[]
  missingImportant: string[]
  breakdown: Record<CompletenessGroup, { score: number; filled: number; total: number }>
}

export function calculateCompleteness(property: Record<string, unknown>): CompletenessResult {
  let totalWeight = 0
  let earnedWeight = 0
  let filledFields = 0
  let totalFields = 0
  const missingCritical: string[] = []
  const missingImportant: string[] = []
  const breakdown: Record<string, { score: number; filled: number; total: number }> = {}

  for (const [group, fields] of Object.entries(COMPLETENESS_FIELDS)) {
    let groupWeight = 0
    let groupEarned = 0
    let groupFilled = 0

    for (const { field, weight } of fields) {
      totalWeight += weight
      groupWeight += weight
      totalFields++

      const value = property[field]
      const hasValue = value !== null && value !== undefined && value !== "" && value !== false

      if (hasValue) {
        earnedWeight += weight
        groupEarned += weight
        filledFields++
        groupFilled++
      } else {
        if (group === "critical") missingCritical.push(field)
        if (group === "important") missingImportant.push(field)
      }
    }

    breakdown[group] = {
      score: groupWeight > 0 ? Math.round((groupEarned / groupWeight) * 100) : 0,
      filled: groupFilled,
      total: fields.length,
    }
  }

  const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F"

  return { score, grade, filledFields, totalFields, missingCritical, missingImportant, breakdown }
}

// ============================================================
// 4. DATA QUALITY SCORE — combines freshness + completeness
// ============================================================

export interface SourceFreshness {
  source: DataSource
  enrichedAt: string | null
  status: FreshnessStatus
  daysSince: number
}

export interface DataQualityScore {
  overall: number           // 0-100
  grade: "A" | "B" | "C" | "D" | "F"
  freshness: {
    score: number           // 0-100
    sources: SourceFreshness[]
    staleCount: number
    liveCount: number
  }
  completeness: CompletenessResult
  confidence: {
    score: number           // 0-100
    crossValidated: number  // Number of fields verified by 2+ sources
    flags: string[]         // Warnings
  }
  actionRequired: string[]  // What needs refreshing
}

// Map property fields to their enrichment timestamps
const SOURCE_TIMESTAMP_MAP: { source: DataSource; timestampField: string }[] = [
  { source: "listing", timestampField: "last_seen_at" },
  { source: "hmo_register", timestampField: "propertydata_enriched_at" },
  { source: "title_owner", timestampField: "title_last_enriched_at" },
  { source: "epc", timestampField: "title_last_enriched_at" },  // EPC comes via Searchland
  { source: "street_data", timestampField: "streetdata_enriched_at" },
  { source: "patma", timestampField: "patma_enriched_at" },
  { source: "broadband", timestampField: "broadband_last_checked" },
  { source: "land_registry", timestampField: "landregistry_last_checked" },
  { source: "zoopla_images", timestampField: "zoopla_enriched_at" },
]

export function calculateDataQuality(property: Record<string, unknown>): DataQualityScore {
  // 1. Freshness assessment per source
  const sources: SourceFreshness[] = SOURCE_TIMESTAMP_MAP.map(({ source, timestampField }) => {
    const enrichedAt = property[timestampField] as string | null
    const rule = FRESHNESS_RULES[source]
    const assessment = assessFreshness(enrichedAt, rule)
    return {
      source,
      enrichedAt,
      status: assessment.status,
      daysSince: assessment.daysSince,
    }
  })

  const liveCount = sources.filter(s => s.status === "live" || s.status === "fresh").length
  const staleCount = sources.filter(s => s.status === "stale" || s.status === "expired").length
  const freshnessScore = Math.round((liveCount / Math.max(sources.length, 1)) * 100)

  // 2. Completeness assessment
  const completeness = calculateCompleteness(property)

  // 3. Confidence assessment (cross-validation)
  const flags: string[] = []
  let crossValidated = 0

  // Check price consistency
  const purchasePrice = property.purchase_price as number | null
  const lastSalePrice = property.last_sale_price as number | null
  if (purchasePrice && lastSalePrice) {
    crossValidated++
    const diff = Math.abs(purchasePrice - lastSalePrice) / lastSalePrice
    if (diff > 0.5) {
      flags.push("Price discrepancy >50% between listing and Land Registry")
    }
  }

  // Check owner data consistency
  const ownerName = property.owner_name as string | null
  const registeredOwner = property.registered_owner as string | null
  if (ownerName && registeredOwner) {
    crossValidated++
    if (ownerName.toLowerCase() !== registeredOwner.toLowerCase()) {
      flags.push("Owner name differs between title and HMO register")
    }
  }

  // Check EPC data exists and matches
  if (property.epc_rating) crossValidated++
  if (property.hmo_status && property.licence_status) crossValidated++
  if (property.bedrooms && property.lettable_rooms) crossValidated++

  const confidenceScore = Math.min(100, Math.round(
    (crossValidated / 5) * 60 + // Cross-validation weight: 60%
    (flags.length === 0 ? 40 : Math.max(0, 40 - flags.length * 15)) // Penalty for flags
  ))

  // 4. Actions required
  const actionRequired: string[] = []
  for (const s of sources) {
    if (s.status === "stale" || s.status === "expired") {
      const rule = FRESHNESS_RULES[s.source]
      if (rule.refreshPriority <= 2) {
        actionRequired.push(`Refresh ${rule.label} (${s.daysSince === Infinity ? "never enriched" : `${s.daysSince}d old`})`)
      }
    }
  }

  if (completeness.missingCritical.length > 0) {
    actionRequired.push(`Missing critical fields: ${completeness.missingCritical.join(", ")}`)
  }

  // 5. Overall score: weighted average
  const overall = Math.round(
    freshnessScore * 0.40 +    // 40% freshness
    completeness.score * 0.35 + // 35% completeness
    confidenceScore * 0.25      // 25% confidence
  )

  const grade = overall >= 90 ? "A" : overall >= 75 ? "B" : overall >= 60 ? "C" : overall >= 40 ? "D" : "F"

  return {
    overall,
    grade,
    freshness: { score: freshnessScore, sources, staleCount, liveCount },
    completeness,
    confidence: { score: confidenceScore, crossValidated, flags },
    actionRequired,
  }
}

// ============================================================
// 5. REFRESH PRIORITY QUEUE — what to enrich next
// ============================================================

export interface RefreshCandidate {
  propertyId: string
  source: DataSource
  priority: number         // Lower = more urgent
  daysSinceRefresh: number
  reason: string
}

export function buildRefreshQueue(
  properties: Array<{ id: string } & Record<string, unknown>>,
  maxItems: number = 100
): RefreshCandidate[] {
  const candidates: RefreshCandidate[] = []

  for (const property of properties) {
    for (const { source, timestampField } of SOURCE_TIMESTAMP_MAP) {
      const enrichedAt = property[timestampField] as string | null
      const rule = FRESHNESS_RULES[source]
      const assessment = assessFreshness(enrichedAt, rule)

      if (assessment.actionRequired) {
        candidates.push({
          propertyId: property.id,
          source,
          priority: rule.refreshPriority * 10 + (assessment.status === "expired" ? 0 : 5),
          daysSinceRefresh: assessment.daysSince === Infinity ? 9999 : assessment.daysSince,
          reason: `${rule.label}: ${assessment.label} (${assessment.daysSince === Infinity ? "never" : assessment.daysSince + "d"})`,
        })
      }
    }
  }

  // Sort by priority (lower first), then by days since refresh (higher first)
  candidates.sort((a, b) => a.priority - b.priority || b.daysSinceRefresh - a.daysSinceRefresh)

  return candidates.slice(0, maxItems)
}

// ============================================================
// 6. USER-FACING QUALITY LABEL
// ============================================================

export function getQualityLabel(score: number): {
  label: string
  description: string
  color: string
  bgColor: string
  borderColor: string
} {
  if (score >= 90) return {
    label: "Verified",
    description: "All data sources recently confirmed",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-300",
  }
  if (score >= 75) return {
    label: "Reliable",
    description: "Most data sources are up to date",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-300",
  }
  if (score >= 60) return {
    label: "Fair",
    description: "Some data sources need refreshing",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-300",
  }
  if (score >= 40) return {
    label: "Outdated",
    description: "Multiple data sources are stale",
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-300",
  }
  return {
    label: "Unverified",
    description: "Data needs significant refreshing",
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-300",
  }
}
