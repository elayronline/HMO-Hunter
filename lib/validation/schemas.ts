import { z } from "zod"

// Common schemas
export const uuidSchema = z.string().uuid("Invalid ID format")

export const emailSchema = z.string().email("Invalid email format")

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// Price Alert schemas
export const priceAlertCreateSchema = z.object({
  alert_type: z.enum(["price_drop", "new_listing", "price_threshold", "area_watch"], {
    errorMap: () => ({ message: "Invalid alert type" }),
  }),
  property_id: z.string().uuid().optional(),
  search_criteria: z.record(z.unknown()).optional(),
  target_price: z.number().int().positive().optional(),
  price_direction: z.enum(["above", "below"]).optional(),
  postcode: z.string().max(10).optional(),
  area: z.string().max(100).optional(),
  radius_miles: z.number().positive().max(50).optional(),
  notify_email: z.boolean().default(true),
  notify_push: z.boolean().default(false),
  frequency: z.enum(["instant", "daily", "weekly"]).default("instant"),
}).refine(
  (data) => {
    // price_drop alerts require property_id
    if (data.alert_type === "price_drop" && !data.property_id) {
      return false
    }
    return true
  },
  { message: "Property ID required for price drop alerts", path: ["property_id"] }
)

export const priceAlertUpdateSchema = z.object({
  id: z.string().uuid("Invalid alert ID"),
  is_active: z.boolean().optional(),
  notify_email: z.boolean().optional(),
  notify_push: z.boolean().optional(),
  frequency: z.enum(["instant", "daily", "weekly"]).optional(),
  target_price: z.number().int().positive().optional(),
  price_direction: z.enum(["above", "below"]).optional(),
})

// Saved Search schemas
export const savedSearchCreateSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters")
    .trim(),
  filters: z.record(z.unknown(), {
    errorMap: () => ({ message: "Filters must be an object" }),
  }),
})

export const savedSearchUpdateSchema = z.object({
  id: z.string().uuid("Invalid search ID"),
})

// Export schemas
export const exportRequestSchema = z.object({
  propertyIds: z.array(z.string().uuid()).max(500).optional(),
  filters: z
    .object({
      listingType: z.enum(["rent", "purchase"]).optional(),
      city: z.string().optional(),
      minPrice: z.number().int().nonnegative().optional(),
      maxPrice: z.number().int().positive().optional(),
      minBedrooms: z.number().int().min(1).max(20).optional(),
      minBathrooms: z.number().int().min(1).max(10).optional(),
      isFurnished: z.boolean().optional(),
      hasParking: z.boolean().optional(),
    })
    .optional(),
})

// Contact tracking schemas
export const trackContactSchema = z.object({
  propertyId: z.string().uuid("Invalid property ID"),
  action: z.enum(["view", "call", "email", "copy"], {
    errorMap: () => ({ message: "Invalid action type" }),
  }),
  contactType: z.string().min(1).max(50),
  contactName: z.string().max(200).optional(),
})

// Property view tracking
export const trackPropertyViewSchema = z.object({
  propertyId: z.string().uuid("Invalid property ID"),
})

// Admin schemas
export const adminUpdateUserSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  role: z.enum(["admin", "standard_pro"], {
    errorMap: () => ({ message: "Role must be 'admin' or 'standard_pro'" }),
  }),
})

// GDPR schemas
export const gdprDataRequestSchema = z.object({
  email: z.string().email("Invalid email format"),
  request_type: z.enum(["access", "deletion", "opt_out"], {
    errorMap: () => ({ message: "Invalid request type" }),
  }),
  details: z.string().max(1000).optional(),
})

export const gdprLogAccessSchema = z.object({
  propertyId: z.string().uuid("Invalid property ID"),
  ownerName: z.string().max(200).optional(),
  dataAccessed: z.array(z.string()).min(1),
  accessType: z.enum(["view", "export", "copy", "call", "email"]),
})

// Property filters schema (for search)
export const propertyFiltersSchema = z.object({
  listingType: z.enum(["rent", "purchase"]).optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().positive().optional(),
  propertyTypes: z.array(z.string()).optional(),
  city: z.string().optional(),
  postcodePrefix: z.string().max(10).optional(),
  minEpcRating: z.enum(["A", "B", "C", "D", "E"]).optional(),
  article4Filter: z.enum(["include", "exclude", "only"]).optional(),
  licenceTypeFilter: z.string().optional(),
  showPotentialHMOs: z.coerce.boolean().optional(),
  hmoClassification: z.enum(["ready_to_go", "value_add"]).optional(),
  minDealScore: z.coerce.number().int().min(0).max(100).optional(),
  floorAreaBand: z.enum(["under_90", "90_120", "120_plus"]).optional(),
  yieldBand: z.enum(["low", "medium", "high"]).optional(),
  epcBand: z.enum(["good", "needs_upgrade"]).optional(),
  hasFiber: z.coerce.boolean().optional(),
  minBroadbandSpeed: z.coerce.number().int().positive().optional(),
  hasOwnerData: z.coerce.boolean().optional(),
  // Phase 6 - TA Sourcing filters
  minBedrooms: z.coerce.number().int().min(1).max(20).optional(),
  minBathrooms: z.coerce.number().int().min(1).max(10).optional(),
  isFurnished: z.coerce.boolean().optional(),
  hasParking: z.coerce.boolean().optional(),
  taSuitability: z.enum(["suitable", "partial"]).optional(),
})

// Pipeline schemas
export const pipelineDealCreateSchema = z.object({
  property_id: z.string().uuid("Invalid property ID"),
  stage: z.string().min(1).max(50).default("identified"),
  label: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
  priority: z.number().int().min(0).max(3).default(0),
  expected_value: z.number().positive().optional(),
})

export const pipelineDealUpdateSchema = z.object({
  id: z.string().uuid("Invalid deal ID"),
  stage: z.string().min(1).max(50).optional(),
  label: z.string().max(50).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  priority: z.number().int().min(0).max(3).optional(),
  expected_value: z.number().positive().nullable().optional(),
  archived_at: z.string().datetime().nullable().optional(),
})

export const pipelineLabelCreateSchema = z.object({
  name: z.string().min(1).max(30).trim(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color").default("#3b82f6"),
})

// D2V schemas
export const d2vTemplateCreateSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  subject: z.string().max(200).optional(),
  body: z.string().min(10).max(5000),
  channel: z.enum(["letter", "email"]),
})

export const d2vCampaignCreateSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  template_id: z.string().uuid().optional(),
  channel: z.enum(["letter", "email"]),
  property_ids: z.array(z.string().uuid()).min(1).max(100),
})

export const d2vCampaignSendSchema = z.object({
  campaign_id: z.string().uuid("Invalid campaign ID"),
})

// Viewing schemas
export const viewingCreateSchema = z.object({
  property_id: z.string().uuid("Invalid property ID"),
  pipeline_deal_id: z.string().uuid().optional(),
  viewing_type: z.enum(["site_visit", "inspection", "portfolio_check", "client_viewing"]),
  scheduled_at: z.string().datetime("Invalid date format"),
  duration_minutes: z.number().int().min(15).max(240).default(30),
  notes: z.string().max(1000).optional(),
  attendees: z.array(z.string().max(100)).max(10).optional(),
  contact_name: z.string().max(200).optional(),
  contact_phone: z.string().max(20).optional(),
  contact_email: z.string().email().optional(),
})

export const viewingUpdateSchema = z.object({
  id: z.string().uuid("Invalid viewing ID"),
  status: z.enum(["scheduled", "confirmed", "completed", "cancelled", "no_show"]).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  notes: z.string().max(1000).nullable().optional(),
  checklist: z.record(z.boolean()).optional(),
  completed_at: z.string().datetime().nullable().optional(),
  scheduled_at: z.string().datetime().optional(),
})

// Type exports
export type PriceAlertCreate = z.infer<typeof priceAlertCreateSchema>
export type PriceAlertUpdate = z.infer<typeof priceAlertUpdateSchema>
export type SavedSearchCreate = z.infer<typeof savedSearchCreateSchema>
export type ExportRequest = z.infer<typeof exportRequestSchema>
export type TrackContact = z.infer<typeof trackContactSchema>
export type TrackPropertyView = z.infer<typeof trackPropertyViewSchema>
export type AdminUpdateUser = z.infer<typeof adminUpdateUserSchema>
export type GdprDataRequest = z.infer<typeof gdprDataRequestSchema>
export type GdprLogAccess = z.infer<typeof gdprLogAccessSchema>
export type PropertyFilters = z.infer<typeof propertyFiltersSchema>
export type PipelineDealCreate = z.infer<typeof pipelineDealCreateSchema>
export type PipelineDealUpdate = z.infer<typeof pipelineDealUpdateSchema>
export type D2VTemplateCreate = z.infer<typeof d2vTemplateCreateSchema>
export type D2VCampaignCreate = z.infer<typeof d2vCampaignCreateSchema>
export type ViewingCreate = z.infer<typeof viewingCreateSchema>
export type ViewingUpdate = z.infer<typeof viewingUpdateSchema>
