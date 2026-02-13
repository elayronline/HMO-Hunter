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
