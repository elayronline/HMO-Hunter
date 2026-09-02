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
/**
 * An export is the page you were looking at, as a file.
 *
 * This used to accept eight filter fields out of the twenty the map applies,
 * which is why the export could not have matched the screen even in principle:
 * a request narrowed to Article 4 areas, an EPC floor and the expired segment
 * arrived here as a city and a price range. The whole filter set is accepted
 * now and handed to the same getProperties() the map calls.
 */
export const exportRequestSchema = z.object({
  propertyIds: z.array(z.string().uuid()).max(500).optional(),
  segment: z.enum(["all", "licensed", "expired", "conversion", "restricted"]).optional(),
  filters: z
    .object({
      minPrice: z.number().int().nonnegative().optional(),
      maxPrice: z.number().int().nonnegative().optional(),
      sourcingCategories: z
        .array(z.enum(["existing_off_market", "for_sale_hmo", "change_of_use"]))
        .optional(),
      city: z.string().optional(),
      postcodePrefix: z.string().max(8).optional(),
      minEpcRating: z.enum(["A", "B", "C", "D", "E"]).nullable().optional(),
      article4Filter: z.enum(["include", "exclude", "confirmed_clear", "only"]).optional(),
      licenceTypeFilter: z.string().max(50).optional(),
      floorAreaBand: z.enum(["under_90", "90_120", "120_plus"]).nullable().optional(),
      epcBand: z.enum(["good", "needs_upgrade"]).nullable().optional(),
      hasFiber: z.boolean().optional(),
      minBroadbandSpeed: z.number().int().nonnegative().optional(),
      hasOwnerData: z.boolean().optional(),
      licenceExpiryStartMonth: z.number().int().min(1).max(12).optional(),
      licenceExpiryEndMonth: z.number().int().min(1).max(12).optional(),
      licenceExpiryYear: z.number().int().min(2020).max(2040).optional(),
      minBedrooms: z.number().int().min(1).max(20).optional(),
      minBathrooms: z.number().int().min(1).max(10).optional(),
      isFurnished: z.boolean().optional(),
    })
    .optional(),
})

// Contact tracking schemas
/**
 * Zoopla ingestion.
 *
 * The bounds are the point of this schema. The route used to accept only
 * { postcode, area, listingType, limit } and pass exactly that to an adapter
 * that supports minPrice/maxPrice/minBedrooms/maxBedrooms — so every sale run
 * asked Zoopla for "everything for sale in this area" and stored the first N.
 *
 * That produced 1,053 of the 1,068 purchase rows in one run on 2026-01-29:
 * median asking price £1.5m, 34.2% over £2m, 15 under £500k, and 186 flats at a
 * £4.45m median. A leasehold Mayfair flat is not an HMO conversion candidate,
 * and 344 of the over-£2m rows are still tagged "Potential HMO".
 *
 * A sale run must therefore state its ceiling and its bedroom floor. They are
 * required rather than defaulted because a default is a sourcing policy hidden
 * in code, and hiding this one is what caused the problem.
 */
export const zooplaIngestSchema = z
  .object({
    postcode: z.string().min(2).max(10).optional(),
    area: z.string().min(2).max(60).optional(),
    listingType: z.enum(["rent", "sale"]).default("rent"),
    limit: z.number().int().positive().max(100).default(20),
    minPrice: z.number().int().nonnegative().optional(),
    maxPrice: z.number().int().positive().optional(),
    minBedrooms: z.number().int().min(0).max(60).optional(),
    maxBedrooms: z.number().int().min(0).max(60).optional(),
  })
  .refine((v) => Boolean(v.postcode || v.area), {
    message: "Either postcode or area is required",
    path: ["area"],
  })
  .refine((v) => v.listingType !== "sale" || v.maxPrice !== undefined, {
    message:
      "maxPrice is required for a sale run. An unbounded sale query returns the top of the market, not HMO stock.",
    path: ["maxPrice"],
  })
  .refine((v) => v.listingType !== "sale" || v.minBedrooms !== undefined, {
    message:
      "minBedrooms is required for a sale run. An HMO needs at least 3 bedrooms.",
    path: ["minBedrooms"],
  })
  .refine((v) => v.minPrice === undefined || v.maxPrice === undefined || v.minPrice <= v.maxPrice, {
    message: "minPrice cannot exceed maxPrice",
    path: ["minPrice"],
  })
  .refine(
    (v) => v.minBedrooms === undefined || v.maxBedrooms === undefined || v.minBedrooms <= v.maxBedrooms,
    { message: "minBedrooms cannot exceed maxBedrooms", path: ["minBedrooms"] },
  )

/**
 * Rightmove (Apify) ingest — purchase stock only.
 *
 * HMO Hunter sources properties to BUY. A rental listing is a competitor's
 * finished product, not sourcing inventory.
 *
 * So there is deliberately **no `listingType` field here** — not one defaulting
 * to "purchase", none at all — and the object is `.strict()`, so a caller that
 * passes `listingType: "rent"` gets a validation error rather than having it
 * quietly ignored. `zooplaIngestSchema` defaults that field to "rent" and it is
 * how 1,632 rental rows arrived; a default is a sourcing policy hidden in code.
 * The only way to make the policy hold is to leave the caller no way to express
 * the other thing.
 *
 * `maxPrice` and `minBedrooms` are required, not defaulted, for the same reason
 * they are on a Zoopla sale run: an unbounded query returns the top of the
 * market rather than HMO stock. `minBedrooms` floors at 3 because a property
 * with fewer is not an HMO conversion candidate.
 */
export const rightmoveIngestSchema = z
  .object({
    postcode: z.string().min(2).max(10).optional(),
    area: z.string().min(2).max(60).optional(),
    limit: z.number().int().positive().max(100).default(20),
    minPrice: z.number().int().nonnegative().optional(),
    maxPrice: z.number().int().positive(),
    minBedrooms: z.number().int().min(3).max(60),
    maxBedrooms: z.number().int().min(0).max(60).optional(),
    radiusMiles: z.number().min(0).max(5).default(0.25),
  })
  .strict()
  .refine((v) => Boolean(v.postcode || v.area), {
    message: "Either postcode or area is required",
    path: ["area"],
  })
  .refine((v) => v.minPrice === undefined || v.minPrice <= v.maxPrice, {
    message: "minPrice cannot exceed maxPrice",
    path: ["minPrice"],
  })
  .refine((v) => v.maxBedrooms === undefined || v.minBedrooms <= v.maxBedrooms, {
    message: "minBedrooms cannot exceed maxBedrooms",
    path: ["minBedrooms"],
  })

/**
 * LoopNet commercial ingest — Class E conversion stock only.
 *
 * Two things are deliberately absent, for the same reason `listingType` is
 * absent from rightmoveIngestSchema: a caller must not be able to ask for them.
 *
 * There is no `searchType`. LoopNet offers for-sale, for-lease and auctions; a
 * lease is not sourcing inventory, and the adapter's start URL is a for-sale
 * search. There is no way to express the others here.
 *
 * There is no passthrough for actor options. `includeListingDetails` bills at
 * $0.05 per property — a hundred of them is the whole monthly free tier in one
 * run — and `agent-record` at $0.0035. The adapter builds its actor payload from
 * a literal with those hardcoded false, so a request cannot reach them, and
 * `.strict()` here means an attempt is an error rather than a silently dropped
 * key.
 *
 * `maxItems` is capped at 100 because the free plan is: the actor returns at
 * most 100 rows for a non-paying account, and asking for more spends the run
 * without returning them.
 */
export const loopnetIngestSchema = z
  .object({
    /**
     * A loopnet.co.uk search URL. Free-text search resolves through a
     * token-gated geocoder that failed on probe, and the actor's own log names
     * startUrls as the token-free path — so a URL is the input, not a place.
     */
    searchUrl: z
      .string()
      .url()
      .refine((u) => /^https:\/\/(www\.)?loopnet\.co\.uk\//.test(u), {
        message:
          "Must be a loopnet.co.uk search URL. loopnet.com is the US site: its listings are priced in dollars and are not UK conversion stock.",
      })
      .default("https://www.loopnet.co.uk/search/commercial-real-estate/united-kingdom/for-sale/"),
    maxItems: z.number().int().positive().max(100).default(50),
  })
  .strict()

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
  article4Filter: z.enum(["include", "exclude", "confirmed_clear", "only"]).optional(),
  licenceTypeFilter: z.string().optional(),
  floorAreaBand: z.enum(["under_90", "90_120", "120_plus"]).optional(),
  epcBand: z.enum(["good", "needs_upgrade"]).optional(),
  hasFiber: z.coerce.boolean().optional(),
  minBroadbandSpeed: z.coerce.number().int().positive().optional(),
  hasOwnerData: z.coerce.boolean().optional(),
  // Phase 6 - TA Sourcing filters
  minBedrooms: z.coerce.number().int().min(1).max(20).optional(),
  minBathrooms: z.coerce.number().int().min(1).max(10).optional(),
  isFurnished: z.coerce.boolean().optional(),
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
export type ZooplaIngest = z.infer<typeof zooplaIngestSchema>
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
export type RightmoveIngest = z.infer<typeof rightmoveIngestSchema>
export type LoopnetIngest = z.infer<typeof loopnetIngestSchema>
