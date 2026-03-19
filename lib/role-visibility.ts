import type { UserType } from "@/components/role-selection-modal"

export interface RoleVisibility {
  showDealScore: boolean
  showDealVerdict: boolean
  showYieldMetrics: boolean
  showR2RMetrics: boolean
  showLhaComparison: boolean
  showTaSuitability: boolean
  showYieldCalculator: boolean
  showOwnership: boolean
  showHmoClassification: boolean
  // Pipeline & outreach features
  showPipeline: boolean
  showD2VOutreach: boolean
  showViewingTracker: boolean
  showOffMarketSourcing: boolean
  defaultViewingType: "site_visit" | "inspection" | "portfolio_check" | "client_viewing"
}

const FALLBACK_VISIBILITY: RoleVisibility = {
  showDealScore: true,
  showDealVerdict: true,
  showYieldMetrics: true,
  showR2RMetrics: true,
  showLhaComparison: true,
  showTaSuitability: true,
  showYieldCalculator: true,
  showOwnership: true,
  showHmoClassification: true,
  showPipeline: true,
  showD2VOutreach: true,
  showViewingTracker: true,
  showOffMarketSourcing: true,
  defaultViewingType: "site_visit",
}

export const ROLE_VISIBILITY: Record<UserType, RoleVisibility> = {
  investor: {
    showDealScore: true,
    showDealVerdict: true,
    showYieldMetrics: true,
    showR2RMetrics: false,
    showLhaComparison: false,
    showTaSuitability: false,
    showYieldCalculator: true,
    showOwnership: true,
    showHmoClassification: true,
    showPipeline: true,
    showD2VOutreach: true,
    showViewingTracker: true,
    showOffMarketSourcing: true,
    defaultViewingType: "site_visit",
  },
  council_ta: {
    showDealScore: false,
    showDealVerdict: false,
    showYieldMetrics: false,
    showR2RMetrics: true,
    showLhaComparison: true,
    showTaSuitability: true,
    showYieldCalculator: false,
    showOwnership: false,
    showHmoClassification: false,
    showPipeline: true,
    showD2VOutreach: false,     // Council officers don't do D2V
    showViewingTracker: true,
    showOffMarketSourcing: false,
    defaultViewingType: "inspection",
  },
  operator: {
    showDealScore: false,
    showDealVerdict: false,
    showYieldMetrics: false,
    showR2RMetrics: false,
    showLhaComparison: false,
    showTaSuitability: false,
    showYieldCalculator: false,
    showOwnership: true,
    showHmoClassification: false,
    showPipeline: true,
    showD2VOutreach: false,     // Operators manage existing portfolio
    showViewingTracker: true,
    showOffMarketSourcing: false,
    defaultViewingType: "portfolio_check",
  },
  agent: {
    showDealScore: true,
    showDealVerdict: true,
    showYieldMetrics: true,
    showR2RMetrics: false,
    showLhaComparison: false,
    showTaSuitability: false,
    showYieldCalculator: true,
    showOwnership: true,
    showHmoClassification: true,
    showPipeline: true,
    showD2VOutreach: true,
    showViewingTracker: true,
    showOffMarketSourcing: true,
    defaultViewingType: "client_viewing",
  },
}

/**
 * Returns the feature visibility config for a given user role.
 * Falls back to all-visible for null/undefined/unknown roles.
 */
export function getVisibilityForRole(role: UserType | null | undefined): RoleVisibility {
  if (!role || !(role in ROLE_VISIBILITY)) {
    return FALLBACK_VISIBILITY
  }
  return ROLE_VISIBILITY[role]
}
