/**
 * HMO Licence Types System
 * Configurable and extendable licence type definitions
 */

// Licence status values
export type LicenceStatus = "active" | "expired" | "pending" | "unknown"

// Expiry warning levels
export type ExpiryWarning = "valid" | "expiring_soon" | "expired" | null

// Data source for licence information
export type LicenceSource = "council_api" | "manual" | "searchland" | "scraped" | "unknown"

// Licence type definition (from database)
export type LicenceType = {
  id: string
  code: string
  name: string
  description: string | null
  applies_to: string[] | null
  min_occupants: number | null
  is_active: boolean
  display_order: number
  created_at: string
}

// Individual property licence record
export type PropertyLicence = {
  id: string
  property_id: string
  licence_type_id: string | null
  licence_type_code: string
  licence_number: string | null
  start_date: string | null
  end_date: string | null
  status: LicenceStatus
  source: LicenceSource
  source_url: string | null
  max_occupants: number | null
  max_households: number | null
  conditions: string[] | null
  raw_data: Record<string, any> | null
  verified_at: string | null
  created_at: string
  updated_at: string
  // Joined fields from view
  licence_type_name?: string
  licence_type_description?: string
  display_order?: number
  expiry_warning?: ExpiryWarning
}

// User preferences for licence display/filtering
export type UserLicencePreferences = {
  id: string
  user_id: string
  enabled_licence_types: string[]
  show_expired: boolean
  show_unknown: boolean
  highlight_expiring_days: number
  created_at: string
  updated_at: string
}

// Default licence types (matches database seed)
export const DEFAULT_LICENCE_TYPES: Omit<LicenceType, "id" | "created_at">[] = [
  {
    code: "mandatory_hmo",
    name: "Mandatory HMO Licence",
    description: "Required for properties with 5+ occupants from 2+ households sharing facilities",
    applies_to: ["england", "wales"],
    min_occupants: 5,
    is_active: true,
    display_order: 1,
  },
  {
    code: "additional_hmo",
    name: "Additional HMO Licence",
    description: "Council-specific scheme for smaller HMOs (typically 3-4 occupants)",
    applies_to: ["england", "wales"],
    min_occupants: 3,
    is_active: true,
    display_order: 2,
  },
  {
    code: "selective_licence",
    name: "Selective Licence",
    description: "Required in designated areas for all private rented properties",
    applies_to: ["england", "wales"],
    min_occupants: 1,
    is_active: true,
    display_order: 3,
  },
  {
    code: "article_4",
    name: "Article 4 Direction",
    description: "Planning restriction requiring permission to convert to HMO",
    applies_to: ["england", "wales"],
    min_occupants: null,
    is_active: true,
    display_order: 4,
  },
  {
    code: "scottish_hmo",
    name: "Scottish HMO Licence",
    description: "Required for all HMOs in Scotland (3+ unrelated occupants)",
    applies_to: ["scotland"],
    min_occupants: 3,
    is_active: true,
    display_order: 5,
  },
  {
    code: "ni_hmo",
    name: "Northern Ireland HMO Licence",
    description: "Required for HMOs in Northern Ireland",
    applies_to: ["northern_ireland"],
    min_occupants: 3,
    is_active: true,
    display_order: 6,
  },
]

// Helper to get status color
export function getLicenceStatusColor(status: LicenceStatus): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800 border-green-300"
    case "expired":
      return "bg-red-100 text-red-800 border-red-300"
    case "pending":
      return "bg-amber-100 text-amber-800 border-amber-300"
    case "unknown":
    default:
      return "bg-gray-100 text-gray-600 border-gray-300"
  }
}

// Helper to get expiry warning color
export function getExpiryWarningColor(warning: ExpiryWarning): string {
  switch (warning) {
    case "expired":
      return "text-red-600"
    case "expiring_soon":
      return "text-amber-600"
    case "valid":
      return "text-green-600"
    default:
      return "text-gray-500"
  }
}

// Helper to format licence status for display
export function formatLicenceStatus(status: LicenceStatus): string {
  switch (status) {
    case "active":
      return "Active"
    case "expired":
      return "Expired"
    case "pending":
      return "Pending"
    case "unknown":
    default:
      return "Unknown"
  }
}

// Helper to calculate days until expiry
export function getDaysUntilExpiry(endDate: string | null): number | null {
  if (!endDate) return null
  const end = new Date(endDate)
  const now = new Date()
  const diffTime = end.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

// Helper to get expiry warning level
export function getExpiryWarningLevel(endDate: string | null, thresholdDays: number = 90): ExpiryWarning {
  if (!endDate) return null
  const days = getDaysUntilExpiry(endDate)
  if (days === null) return null
  if (days < 0) return "expired"
  if (days <= thresholdDays) return "expiring_soon"
  return "valid"
}

// Licence type code to icon mapping
export const LICENCE_TYPE_ICONS: Record<string, string> = {
  mandatory_hmo: "Shield",
  additional_hmo: "ShieldPlus",
  selective_licence: "FileCheck",
  article_4: "AlertTriangle",
  scottish_hmo: "Shield",
  ni_hmo: "Shield",
}
