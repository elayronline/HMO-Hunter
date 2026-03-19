/**
 * D2V Scenario-Based Letter Templates
 *
 * Pre-built, data-driven templates that use HMO Hunter's property intelligence
 * to create highly personalised outreach that generic tools can't match.
 *
 * Each template is designed for a specific owner situation:
 * - Expired licence → "Your licence has expired, we can help"
 * - Expiring soon → "Before your licence expires..."
 * - Long on market → "I noticed your property hasn't sold"
 * - Probate → Sensitive approach to executors
 * - Unlicensed potential → "Your property could be worth more as an HMO"
 * - General purchase → Standard D2V letter
 */

import type { Property } from "@/lib/types/database"

// ============================================================
// SCENARIO DETECTION — auto-select the right template
// ============================================================

export type LetterScenario =
  | "expired_licence"
  | "expiring_licence"
  | "long_on_market"
  | "probate_estate"
  | "unlicensed_potential"
  | "general_purchase"
  | "rent_to_rent"
  | "portfolio_acquisition"

export interface ScenarioConfig {
  id: LetterScenario
  label: string
  description: string
  color: string
  letterTemplate: string
  emailTemplate: string
  subject: string
  followUpDays: number[]  // Days after initial send to follow up
}

/**
 * Auto-detect the best scenario for a property based on its data
 */
export function detectScenario(property: Property): LetterScenario {
  if (property.licence_status === "expired") return "expired_licence"
  if (property.hmo_licence_expiry) {
    const expiryDate = new Date(property.hmo_licence_expiry)
    const daysUntilExpiry = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (daysUntilExpiry <= 90 && daysUntilExpiry > 0) return "expiring_licence"
  }
  if (property.days_on_market && property.days_on_market > 180) return "long_on_market"
  if (property.is_potential_hmo && !property.licensed_hmo) return "unlicensed_potential"
  if (property.listing_type === "rent") return "rent_to_rent"
  return "general_purchase"
}

// ============================================================
// SMART MERGE FIELDS — property intelligence data
// ============================================================

export function buildSmartMergeData(property: Property): Record<string, string> {
  const ownerName = property.owner_name || property.licence_holder_name || "Property Owner"

  // Street average price (if available)
  const streetAvgPrice = property.postcode_avg_price
    ? `£${property.postcode_avg_price.toLocaleString("en-GB")}`
    : ""

  // Days on market
  const daysOnMarket = property.days_on_market ? String(property.days_on_market) : ""

  // Licence info
  const licenceExpiry = property.hmo_licence_expiry
    ? new Date(property.hmo_licence_expiry).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : ""
  const daysUntilExpiry = property.hmo_licence_expiry
    ? String(Math.max(0, Math.floor((new Date(property.hmo_licence_expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))))
    : ""

  // Estimated value
  const estimatedValue = property.estimated_value
    ? `£${property.estimated_value.toLocaleString("en-GB")}`
    : property.purchase_price
    ? `£${property.purchase_price.toLocaleString("en-GB")}`
    : ""

  // Yield
  const estimatedYield = property.estimated_yield_percentage
    ? `${property.estimated_yield_percentage.toFixed(1)}%`
    : ""

  // Unique reference for response tracking
  const refCode = `HMO-${property.postcode?.replace(/\s/g, "")}-${Date.now().toString(36).slice(-4).toUpperCase()}`

  return {
    owner_name: ownerName,
    property_address: property.address || "",
    property_postcode: property.postcode || "",
    property_city: property.city || "",
    bedrooms: String(property.bedrooms || ""),
    bathrooms: String(property.bathrooms || ""),
    epc_rating: property.epc_rating || "Unknown",
    licence_status: property.licence_status || "Unknown",
    licence_expiry: licenceExpiry,
    days_until_expiry: daysUntilExpiry,
    days_on_market: daysOnMarket,
    street_avg_price: streetAvgPrice,
    estimated_value: estimatedValue,
    estimated_yield: estimatedYield,
    property_type: property.property_type || "property",
    article_4_area: property.article_4_area ? "Yes (Article 4 Direction applies)" : "No",
    reference_code: refCode,
    date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    your_name: "[Your Name]",
    your_company: "[Your Company]",
    your_phone: "[Your Phone]",
    your_email: "[Your Email]",
    your_address: "[Your Address]",
    your_website: "[Your Website]",
  }
}

// ============================================================
// SCENARIO TEMPLATES
// ============================================================

export const SCENARIO_TEMPLATES: Record<LetterScenario, ScenarioConfig> = {
  expired_licence: {
    id: "expired_licence",
    label: "Expired HMO Licence",
    description: "Owner's HMO licence has expired — they may be looking to sell or need help relicensing",
    color: "bg-red-100 text-red-700",
    followUpDays: [14, 28],
    subject: "Regarding your property at {{property_address}}",
    emailTemplate: `Dear {{owner_name}},

I'm writing regarding your property at {{property_address}}, {{property_postcode}}.

I noticed that the HMO licence for this property expired on {{licence_expiry}}. Operating without a valid licence can result in significant penalties, and I understand this can be a stressful situation.

I'm an experienced HMO investor and would be happy to discuss two options:

1. If you're looking to sell — I can offer a quick, chain-free purchase at a fair price
2. If you'd like to keep the property — I can advise on the relicensing process

Either way, I'm happy to have a no-obligation conversation.

Please quote reference {{reference_code}} when you get in touch.

Best regards,
{{your_name}}
{{your_phone}}`,
    letterTemplate: `Dear {{owner_name}},

RE: {{property_address}}, {{property_postcode}}
Your Reference: {{reference_code}}

I am writing to you regarding your property at the above address.

Our records indicate that the HMO licence for this property expired on {{licence_expiry}}. I understand that managing licensing requirements can be time-consuming and costly, and I wanted to reach out to offer my assistance.

As an active HMO investor in {{property_city}}, I have two proposals for your consideration:

1. PURCHASE OFFER — If you are considering selling the property, I am in a position to make a competitive cash offer with no estate agent fees, no chain, and a completion timeline that works for you. Properties in the {{property_postcode}} area have recently achieved an average of {{street_avg_price}}.

2. MANAGEMENT PARTNERSHIP — If you wish to retain the property, I would welcome the opportunity to discuss a management arrangement that handles the relicensing process and ongoing compliance on your behalf.

I would be grateful for the opportunity to discuss these options at your convenience. Please do not hesitate to contact me by phone or email, quoting reference {{reference_code}}.

Yours sincerely,

{{your_name}}
{{your_company}}
{{your_phone}}
{{your_email}}`,
  },

  expiring_licence: {
    id: "expiring_licence",
    label: "Licence Expiring Soon",
    description: "Licence expires within 90 days — owner may want to sell before renewal costs",
    color: "bg-amber-100 text-amber-700",
    followUpDays: [14, 28],
    subject: "Your HMO licence at {{property_address}} — expiring soon",
    emailTemplate: `Dear {{owner_name}},

I hope this message finds you well. I'm writing about your property at {{property_address}}.

I understand your HMO licence is due to expire on {{licence_expiry}} ({{days_until_expiry}} days). The renewal process can be lengthy and expensive, and I wanted to reach out before the deadline.

If you've been considering your options, I'd love to have a conversation. I'm a cash buyer who can move quickly, or I'm happy to discuss other arrangements.

Reference: {{reference_code}}

Best regards,
{{your_name}}
{{your_phone}}`,
    letterTemplate: `Dear {{owner_name}},

RE: {{property_address}}, {{property_postcode}}
HMO Licence Expiry: {{licence_expiry}} ({{days_until_expiry}} days remaining)
Reference: {{reference_code}}

I am writing to you as the registered owner of the above property.

As you may be aware, your HMO licence is due to expire on {{licence_expiry}}. With {{days_until_expiry}} days remaining, you will soon need to decide whether to renew — a process that typically costs several thousand pounds and requires updated fire safety, gas, and electrical certifications.

If you have been considering selling rather than renewing, I would be pleased to discuss a straightforward purchase. I am a cash buyer with experience in the {{property_city}} HMO market, and I can offer:

• A competitive price — properties nearby have sold for an average of {{street_avg_price}}
• No estate agent fees
• Flexible completion — before or after your licence expiry date
• No chain

If you would prefer to keep the property, I also offer management services that handle the full renewal process.

Please contact me at your convenience, quoting reference {{reference_code}}.

Yours sincerely,

{{your_name}}
{{your_company}}
{{your_phone}}
{{your_email}}`,
  },

  long_on_market: {
    id: "long_on_market",
    label: "Long on Market",
    description: "Property listed 180+ days — owner may be frustrated with agents",
    color: "bg-blue-100 text-blue-700",
    followUpDays: [14, 28, 42],
    subject: "Regarding {{property_address}} — a different approach",
    emailTemplate: `Dear {{owner_name}},

I noticed your property at {{property_address}} has been on the market for some time now ({{days_on_market}} days).

I understand how frustrating the selling process can be, especially when a property sits without offers. I'd like to offer a different approach — a direct, private purchase with no agent fees and a guaranteed completion date.

I'm an active buyer in {{property_city}} and can move within 28 days.

Would you be open to a conversation? Reference: {{reference_code}}

Best regards,
{{your_name}}
{{your_phone}}`,
    letterTemplate: `Dear {{owner_name}},

RE: {{property_address}}, {{property_postcode}}
Reference: {{reference_code}}

I am writing to you regarding your property at the above address, which I understand has been on the market for approximately {{days_on_market}} days.

I appreciate that selling a property can be a lengthy and sometimes frustrating process. If your current marketing approach has not yet produced the result you were hoping for, I would like to offer an alternative.

I am a private purchaser — not an estate agent — and I can offer:

• A direct purchase with no agent commissions to pay
• Guaranteed completion within 28 days (or a timeline that suits you)
• Cash funds — no mortgage chain or delays
• A fair offer based on current market conditions

I am not looking to undervalue your property. I simply offer speed and certainty where the traditional market has not yet delivered.

If you would like to explore this option, please contact me quoting reference {{reference_code}}. There is absolutely no obligation.

Yours sincerely,

{{your_name}}
{{your_company}}
{{your_phone}}
{{your_email}}`,
  },

  probate_estate: {
    id: "probate_estate",
    label: "Probate / Deceased Estate",
    description: "Sensitive approach for executors managing a deceased person's property",
    color: "bg-purple-100 text-purple-700",
    followUpDays: [28, 56],  // Longer gaps — sensitivity
    subject: "Regarding the property at {{property_address}}",
    emailTemplate: `Dear Sir/Madam,

I am writing regarding the property at {{property_address}}, {{property_postcode}}.

I understand this may be a difficult time, and I want to be respectful of that. If you are managing the estate and considering the future of this property, I would welcome the opportunity to discuss a straightforward purchase.

I am an experienced buyer who can handle the process sensitively and efficiently, with minimal disruption.

Reference: {{reference_code}}

With kind regards,
{{your_name}}
{{your_phone}}`,
    letterTemplate: `Dear Sir/Madam,

RE: {{property_address}}, {{property_postcode}}
Reference: {{reference_code}}

I am writing to the executor or personal representative responsible for the above property.

I understand that managing a property as part of an estate can be a significant burden during what may already be a difficult period. If selling the property is something you are considering, I would like to offer my services as a private purchaser.

I have experience with estate purchases and can offer:

• A straightforward, hassle-free process
• Valuation at current market rates
• Flexible timelines to accommodate probate proceedings
• Cash funds — no chain, no delays
• Sensitivity and discretion throughout

If this is of interest, or if you would simply like to discuss your options, please do not hesitate to contact me quoting reference {{reference_code}}.

With kind regards,

{{your_name}}
{{your_company}}
{{your_phone}}
{{your_email}}`,
  },

  unlicensed_potential: {
    id: "unlicensed_potential",
    label: "Unlicensed HMO Potential",
    description: "Property has HMO conversion potential but isn't licensed — owner may not know its value",
    color: "bg-teal-100 text-teal-700",
    followUpDays: [14, 28],
    subject: "Your property at {{property_address}} — an opportunity",
    emailTemplate: `Dear {{owner_name}},

I'm writing about your {{bedrooms}}-bedroom property at {{property_address}}.

I'm an HMO specialist and I believe your property has significant potential as a licensed House in Multiple Occupation. Properties like yours in {{property_city}} can achieve yields of {{estimated_yield}} — substantially more than standard letting.

I'd love to discuss whether a purchase or joint venture would interest you.

Reference: {{reference_code}}

Best regards,
{{your_name}}
{{your_phone}}`,
    letterTemplate: `Dear {{owner_name}},

RE: {{property_address}}, {{property_postcode}}
Reference: {{reference_code}}

I am writing to you as the owner of the above {{bedrooms}}-bedroom property.

As an HMO specialist operating in {{property_city}}, I have identified your property as having excellent potential for conversion to a licensed House in Multiple Occupation. Based on my analysis:

• Estimated yield: {{estimated_yield}} gross
• Current EPC rating: {{epc_rating}}
• Bedrooms: {{bedrooms}}

Properties with these characteristics in the {{property_postcode}} area are in high demand from professional tenants, and similar properties achieve rents significantly above standard letting rates.

I would be interested in discussing a purchase, or alternatively a management partnership where I handle the conversion and licensing process while you retain ownership.

Please contact me at your convenience, quoting reference {{reference_code}}.

Yours sincerely,

{{your_name}}
{{your_company}}
{{your_phone}}
{{your_email}}`,
  },

  general_purchase: {
    id: "general_purchase",
    label: "General Purchase Enquiry",
    description: "Standard D2V letter for properties without a specific trigger",
    color: "bg-slate-100 text-slate-700",
    followUpDays: [14, 28],
    subject: "Property enquiry — {{property_address}}",
    emailTemplate: `Dear {{owner_name}},

I am writing regarding your property at {{property_address}}, {{property_postcode}}.

I am actively looking to purchase properties in the {{property_city}} area and would be very interested in discussing a potential purchase.

I can offer a quick, hassle-free sale with no agent fees and flexible timelines. I'm a cash buyer with no chain.

If you are considering selling, please contact me. Reference: {{reference_code}}

Best regards,
{{your_name}}
{{your_phone}}`,
    letterTemplate: `Dear {{owner_name}},

RE: {{property_address}}, {{property_postcode}}
Reference: {{reference_code}}

I am writing to you regarding your property at the above address.

I am a property investor actively seeking to purchase in the {{property_city}} area, and your property caught my attention. I would be very interested in discussing a potential purchase.

I can offer:

• No estate agent fees — saving you thousands
• A flexible completion timeline that works for you
• Cash buyer — no mortgage chain or delays
• A fair, market-rate offer

If you have been considering selling, or would simply like to understand what your property might be worth to a cash buyer, please do not hesitate to contact me.

Quoting reference {{reference_code}} will help me respond promptly.

Yours sincerely,

{{your_name}}
{{your_company}}
{{your_phone}}
{{your_email}}`,
  },

  rent_to_rent: {
    id: "rent_to_rent",
    label: "Rent-to-Rent Proposal",
    description: "Propose a guaranteed rent arrangement to the landlord",
    color: "bg-green-100 text-green-700",
    followUpDays: [14, 28],
    subject: "Guaranteed rent proposal — {{property_address}}",
    emailTemplate: `Dear {{owner_name}},

I manage HMO properties in {{property_city}} and I'd like to propose a guaranteed rent arrangement for your property at {{property_address}}.

I would take over the full management of the property, guarantee your rent monthly regardless of voids, handle all tenant issues, and maintain the property to a high standard.

Would you be open to a conversation? Reference: {{reference_code}}

Best regards,
{{your_name}}
{{your_phone}}`,
    letterTemplate: `Dear {{owner_name}},

RE: {{property_address}}, {{property_postcode}}
Guaranteed Rent Proposal
Reference: {{reference_code}}

I am an HMO property manager operating in {{property_city}}, and I am writing to propose a guaranteed rent arrangement for your property at the above address.

Under this arrangement, I would:

• Pay you a guaranteed monthly rent — regardless of occupancy
• Take full responsibility for tenant management and property maintenance
• Handle all licensing, compliance, and safety certifications
• Return the property in its original condition at the end of the agreement

This arrangement gives you complete peace of mind — a guaranteed income with zero management burden.

Based on properties in the {{property_postcode}} area, I would anticipate offering a guaranteed rent of approximately {{estimated_value}} per calendar month.

I would welcome the opportunity to discuss this proposal in more detail. Please contact me quoting reference {{reference_code}}.

Yours sincerely,

{{your_name}}
{{your_company}}
{{your_phone}}
{{your_email}}`,
  },

  portfolio_acquisition: {
    id: "portfolio_acquisition",
    label: "Portfolio Acquisition",
    description: "Approach corporate landlords to acquire multiple properties",
    color: "bg-indigo-100 text-indigo-700",
    followUpDays: [21, 42],
    subject: "Portfolio acquisition enquiry — {{property_city}}",
    emailTemplate: `Dear {{owner_name}},

I'm writing to {{company_name}} regarding your HMO portfolio in {{property_city}}.

I'm an active acquirer of HMO portfolios and I'd be interested in discussing a potential purchase of some or all of your properties. I can offer a discreet, off-market transaction with competitive pricing.

Reference: {{reference_code}}

Best regards,
{{your_name}}
{{your_phone}}`,
    letterTemplate: `Dear {{owner_name}},

RE: HMO Portfolio — {{property_city}}
Reference: {{reference_code}}

I am writing to enquire whether {{company_name}} would consider a sale of some or all of its HMO properties in the {{property_city}} area.

As an experienced HMO investor, I am actively seeking portfolio acquisitions and can offer:

• A discreet, off-market transaction
• Competitive pricing based on current yields and market conditions
• Flexible deal structure (full portfolio or selected properties)
• Quick due diligence and completion

I understand the value of your portfolio and I am prepared to move quickly on a deal that works for both parties.

Please contact me at your convenience to discuss, quoting reference {{reference_code}}.

Yours sincerely,

{{your_name}}
{{your_company}}
{{your_phone}}
{{your_email}}`,
  },
}

// ============================================================
// FOLLOW-UP SEQUENCE TEMPLATES
// ============================================================

export const FOLLOW_UP_TEMPLATES: Record<1 | 2 | 3, { subject: string; body: string }> = {
  1: {
    subject: "Following up — {{property_address}} (Ref: {{reference_code}})",
    body: `Dear {{owner_name}},

I wrote to you recently regarding your property at {{property_address}}, {{property_postcode}} (reference {{reference_code}}).

I appreciate you may be busy, but I wanted to follow up in case my letter didn't reach you or you haven't yet had a chance to consider the opportunity.

My offer remains open — I'm a genuine cash buyer looking to move quickly, and I believe we could reach an arrangement that works for both of us.

If you'd like to discuss, please don't hesitate to get in touch.

Best regards,
{{your_name}}
{{your_phone}}
{{your_email}}`,
  },
  2: {
    subject: "Final follow-up — {{property_address}} (Ref: {{reference_code}})",
    body: `Dear {{owner_name}},

This is my final follow-up regarding your property at {{property_address}} (reference {{reference_code}}).

I completely understand if selling isn't something you're considering right now. However, if your circumstances change in the future, please don't hesitate to get in touch — my interest is genuine and my offer will remain competitive.

I wish you all the best.

Kind regards,
{{your_name}}
{{your_phone}}
{{your_email}}`,
  },
  3: {
    subject: "Checking in — {{property_address}} (Ref: {{reference_code}})",
    body: `Dear {{owner_name}},

It's been a while since I last wrote to you about {{property_address}} (reference {{reference_code}}).

Market conditions in {{property_city}} have changed, and I wanted to check whether you might now be open to a conversation about the property.

No pressure at all — just a friendly check-in.

Best regards,
{{your_name}}
{{your_phone}}`,
  },
}

// ============================================================
// ADDRESS VALIDATION
// ============================================================

export interface AddressValidation {
  isValid: boolean
  confidence: "high" | "medium" | "low"
  issues: string[]
  formatted?: string
}

export function validatePostalAddress(address: string, postcode: string): AddressValidation {
  const issues: string[] = []

  // Check postcode format
  const postcodeRegex = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i
  if (!postcode || !postcodeRegex.test(postcode.trim())) {
    issues.push("Invalid or missing postcode")
  }

  // Check address has content
  if (!address || address.trim().length < 5) {
    issues.push("Address too short or missing")
  }

  // Check address has a number (most UK addresses do)
  if (address && !/\d/.test(address)) {
    issues.push("Address may be missing a house number")
  }

  // Check for common placeholder values
  const placeholders = ["unknown", "n/a", "tbc", "not available", "test"]
  if (placeholders.some(p => address?.toLowerCase().includes(p))) {
    issues.push("Address appears to contain placeholder text")
  }

  const confidence = issues.length === 0 ? "high" : issues.length === 1 ? "medium" : "low"
  const isValid = !issues.some(i => i.includes("missing postcode") || i.includes("too short"))

  return {
    isValid,
    confidence,
    issues,
    formatted: isValid ? `${address.trim()}, ${postcode.trim().toUpperCase()}` : undefined,
  }
}
