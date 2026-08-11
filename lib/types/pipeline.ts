import type { Property } from "./database"

// ============================================================
// DEAL PIPELINE TYPES
// ============================================================

export type PipelineStageConfig = {
  id: string
  stage_key: string
  stage_label: string
  stage_order: number
  color: string
  is_terminal: boolean
}

export type StageHistoryEntry = {
  stage: string
  entered_at: string
  exited_at?: string
}

export type PipelineDeal = {
  id: string
  user_id: string
  property_id: string
  stage: string
  label: string | null
  notes: string | null
  priority: 0 | 1 | 2 | 3
  assigned_to: string | null
  expected_value: number | null
  stage_entered_at: string
  stage_history: StageHistoryEntry[]
  created_at: string
  updated_at: string
  archived_at: string | null
  // Joined
  property?: Property
}

export type PipelineLabel = {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

export type PipelineSummary = {
  total_deals: number
  by_stage: Record<string, number>
  total_value: number
  avg_days_in_pipeline: number
}

// ============================================================
// D2V OUTREACH TYPES
// ============================================================

export type D2VChannel = "letter" | "email"

export type D2VTemplate = {
  id: string
  user_id: string
  name: string
  subject: string | null
  body: string
  channel: D2VChannel
  placeholders: string[]
  is_default: boolean
  created_at: string
  updated_at: string
}

export type D2VCampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "failed"

export type D2VCampaign = {
  id: string
  user_id: string
  name: string
  template_id: string | null
  channel: D2VChannel
  status: D2VCampaignStatus
  total_recipients: number
  sent_count: number
  failed_count: number
  opened_count: number
  responded_count: number
  scheduled_at: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
  // Joined
  template?: D2VTemplate
  recipients?: D2VRecipient[]
}

export type D2VRecipientStatus = "pending" | "sent" | "delivered" | "opened" | "responded" | "failed" | "bounced"

export type D2VRecipient = {
  id: string
  campaign_id: string
  property_id: string
  recipient_name: string | null
  recipient_email: string | null
  recipient_address: string | null
  status: D2VRecipientStatus
  sent_at: string | null
  opened_at: string | null
  responded_at: string | null
  error_message: string | null
  merge_data: Record<string, string>
  created_at: string
  // Joined
  property?: Property
}

// D2V merge field placeholders
export const D2V_PLACEHOLDERS = [
  "{{owner_name}}",
  "{{property_address}}",
  "{{property_postcode}}",
  "{{property_city}}",
  "{{bedrooms}}",
  "{{epc_rating}}",
  "{{licence_status}}",
  "{{licence_expiry}}",
  "{{your_name}}",
  "{{your_company}}",
  "{{your_phone}}",
  "{{your_email}}",
  "{{date}}",
] as const

// ============================================================
// VIEWING TRACKER TYPES
// ============================================================

export type ViewingType = "site_visit" | "inspection" | "portfolio_check" | "client_viewing"

export type ViewingStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show"

export type PropertyViewing = {
  id: string
  user_id: string
  property_id: string
  pipeline_deal_id: string | null
  viewing_type: ViewingType
  scheduled_at: string
  duration_minutes: number
  status: ViewingStatus
  rating: number | null
  notes: string | null
  attendees: string[]
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  checklist: Record<string, boolean>
  photos: string[]
  completed_at: string | null
  created_at: string
  updated_at: string
  // Joined
  property?: Property
  pipeline_deal?: PipelineDeal
}

// ICP-specific viewing checklists
/**
 * What to check on a viewing.
 *
 * Was four lists keyed by user role. The roles are gone — the platform serves
 * one job, sourcing and verifying a property to buy — so this is the sourcing
 * checklist, which is what all but one of the old lists were anyway. The
 * compliance list from the operator profile is kept in
 * lib/types/compliance-checklist.ts for whenever there is a post-purchase view.
 */
export const VIEWING_CHECKLIST: { key: string; label: string }[] = [
  { key: "exterior_condition", label: "Exterior condition assessed" },
  { key: "room_sizes", label: "Room sizes measured" },
  { key: "bathroom_count", label: "Bathroom count verified" },
  { key: "hmo_layout", label: "HMO conversion layout viable" },
  { key: "fire_safety", label: "Fire escape routes checked" },
  { key: "parking", label: "Parking availability confirmed" },
  { key: "local_area", label: "Local area/amenities checked" },
  { key: "structural_issues", label: "No structural issues" },
]

// ============================================================
// OFF-MARKET OPPORTUNITY TYPES
// ============================================================

export type OffMarketOpportunityType =
  | "expired_licence"
  | "expiring_licence"
  | "long_on_market"
  | "stale_listing"
  | "unlicensed_potential"
  | "other"

export type OffMarketOpportunity = {
  id: string
  address: string
  postcode: string
  city: string
  bedrooms: number
  purchase_price: number | null
  price_pcm: number | null
  owner_name: string | null
  owner_contact_email: string | null
  owner_contact_phone: string | null
  licence_holder_name: string | null
  licence_holder_email: string | null
  hmo_licence_expiry: string | null
  licence_status: string | null
  epc_rating: string | null
  deal_score: number | null
  hmo_classification: string | null
  article_4_area: boolean
  opportunity_type: OffMarketOpportunityType
  opportunity_score: number
}
