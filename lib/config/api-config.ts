/**
 * API Configuration for HMO Hunter
 * Manages legitimate data source connections
 * Active APIs: PropertyData, StreetData, PaTMa, Apify (Rightmove), Searchland, Companies House
 */

export const apiConfig = {
  // Phase 1: Core HMO Data
  propertyData: {
    apiKey: process.env.PROPERTYDATA_API_KEY,
    baseUrl: process.env.PROPERTYDATA_BASE_URL || "https://api.propertydata.co.uk",
    enabled: !!process.env.PROPERTYDATA_API_KEY,
    rateLimit: {
      requestsPerMinute: 30,
      requestsPerDay: 5000,
    },
  },

  // Phase 2: Property Enrichment
  streetData: {
    apiKey: process.env.STREETDATA_API_KEY,
    baseUrl: process.env.STREETDATA_BASE_URL || "https://api.street.co.uk",
    enabled: !!process.env.STREETDATA_API_KEY,
    rateLimit: {
      requestsPerMinute: 120,
      requestsPerDay: 50000,
    },
  },

  patma: {
    apiKey: process.env.PATMA_API_KEY,
    baseUrl: process.env.PATMA_API_URL || "https://api.patma.co.uk/v1",
    enabled: !!process.env.PATMA_API_KEY,
    rateLimit: {
      requestsPerMinute: 100,
      requestsPerDay: 100000,
    },
  },

  // Phase 3: Listing Matcher (Direct URLs + Photos)
  apify: {
    apiToken: process.env.APIFY_API_TOKEN,
    baseUrl: "https://api.apify.com/v2",
    enabled: !!process.env.APIFY_API_TOKEN,
    actorId: "memo23~rightmove-scraper",
    rateLimit: {
      // Apify has generous limits, mainly cost-based
      requestsPerMinute: 60,
      requestsPerDay: 10000,
    },
    pricing: {
      costPer1000Results: 0.95, // USD
    },
  },

  // Phase 3: Searchland API (Title, EPC, Planning)
  searchland: {
    apiKey: process.env.SEARCHLAND_API_KEY,
    baseUrl: process.env.SEARCHLAND_BASE_URL || "https://api.searchland.co.uk/v1",
    enabled: !!process.env.SEARCHLAND_API_KEY,
    rateLimit: {
      requestsPerMinute: 60,
      requestsPerDay: 10000,
    },
    endpoints: {
      title: "/title",
      epc: "/epc",
      planning: "/planning",
    },
  },

  // Phase 3: Companies House API (Corporate landlord details)
  companiesHouse: {
    apiKey: process.env.COMPANIES_HOUSE_API_KEY,
    baseUrl: "https://api.company-information.service.gov.uk",
    enabled: !!process.env.COMPANIES_HOUSE_API_KEY,
    rateLimit: {
      requestsPerMinute: 600, // Companies House has generous limits
      requestsPerDay: 50000,
    },
    endpoints: {
      company: "/company",
      officers: "/company/{company_number}/officers",
    },
  },

  // Kamma API v3 (HMO Licensing Compliance)
  // Docs: https://apiv3-sandbox.kammadata.com/v3/docs
  kamma: {
    apiKey: process.env.KAMMA_API_KEY,
    serviceKey: process.env.KAMMA_SERVICE_KEY,
    groupId: process.env.KAMMA_GROUP_ID,
    baseUrl: process.env.KAMMA_BASE_URL || "https://apiv3-sandbox.kammadata.com",
    enabled: !!process.env.KAMMA_API_KEY && !!process.env.KAMMA_SERVICE_KEY && !!process.env.KAMMA_GROUP_ID,
    rateLimit: {
      requestsPerMinute: 60,
      requestsPerDay: 10000,
    },
    endpoints: {
      determinationCheck: "/v3/determinations/check",
      properties: "/v3/properties",
      licences: "/v3/licences",
    },
  },

  // Ofcom Broadband Coverage API (Free)
  ofcom: {
    apiKey: process.env.OFCOM_API_KEY,
    baseUrl: "https://api-proxy.ofcom.org.uk/broadband/coverage",
    enabled: !!process.env.OFCOM_API_KEY,
    rateLimit: {
      requestsPerMinute: 60,
      requestsPerDay: 10000,
    },
  },

  // Google Maps (Optional - Street View fallback)
  googleMaps: {
    apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    enabled: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  },

  // Development Mode
  useMockData: process.env.USE_MOCK_DATA === "true",
  mockPropertyCount: Number.parseInt(process.env.MOCK_PROPERTY_COUNT || "50", 10),
}

/**
 * Validate API configuration
 */
export function validateApiConfig(): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Check if Phase 1 API is configured
  const hasPhase1Api = apiConfig.propertyData.enabled

  if (!hasPhase1Api && !apiConfig.useMockData) {
    errors.push(
      "PropertyData API not configured. Please add PROPERTYDATA_API_KEY, or enable USE_MOCK_DATA for development.",
    )
  }

  // Warnings for missing Phase 2 APIs
  if (!apiConfig.streetData.enabled) {
    warnings.push("Street Data API not configured. Property valuations will be unavailable.")
  }

  if (!apiConfig.patma.enabled) {
    warnings.push("PaTMa API not configured. Transaction history will be unavailable.")
  }

  // Warnings for missing Phase 3 APIs (Listing Matcher)
  if (!apiConfig.apify.enabled) {
    warnings.push("Apify not configured. Direct listing URLs will fallback to search links. Add APIFY_API_TOKEN for direct Rightmove links.")
  }

  // Warnings for missing Phase 3 APIs (Owner/EPC/Planning)
  if (!apiConfig.searchland.enabled) {
    warnings.push("Searchland API not configured. Owner/EPC/Planning data will be unavailable. Add SEARCHLAND_API_KEY for enrichment.")
  }

  if (!apiConfig.companiesHouse.enabled) {
    warnings.push("Companies House API not configured. Corporate landlord details will be unavailable. Add COMPANIES_HOUSE_API_KEY for company lookups.")
  }

  if (!apiConfig.kamma.enabled) {
    warnings.push("Kamma API not configured. HMO licensing compliance data will be unavailable. Add KAMMA_API_KEY for licensing checks.")
  }

  if (!apiConfig.ofcom.enabled) {
    warnings.push("Ofcom API not configured. Broadband/fiber availability data will be unavailable. Add OFCOM_API_KEY for connectivity info.")
  }

  if (!apiConfig.googleMaps.enabled) {
    warnings.push("Google Maps API not configured. Property images will use placeholders. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for Street View images.")
  }

  // Check for mock data in production
  if (process.env.NODE_ENV === "production" && apiConfig.useMockData) {
    warnings.push("Mock data mode is enabled in production. This should only be used for demo purposes.")
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Get API status for admin dashboard
 */
export function getApiStatus() {
  return {
    phase1: {
      propertyData: {
        enabled: apiConfig.propertyData.enabled,
        name: "PropertyData HMO Register",
        status: apiConfig.propertyData.enabled ? "connected" : "not_configured",
      },
    },
    phase2: {
      streetData: {
        enabled: apiConfig.streetData.enabled,
        name: "Street Data API",
        status: apiConfig.streetData.enabled ? "connected" : "not_configured",
      },
      patma: {
        enabled: apiConfig.patma.enabled,
        name: "PaTMa API",
        status: apiConfig.patma.enabled ? "connected" : "not_configured",
      },
    },
    phase3: {
      apify: {
        enabled: apiConfig.apify.enabled,
        name: "Apify Rightmove (Listing Matcher)",
        status: apiConfig.apify.enabled ? "connected" : "not_configured",
        description: "Direct listing URLs + photos from Rightmove",
      },
      searchland: {
        enabled: apiConfig.searchland.enabled,
        name: "Searchland API",
        status: apiConfig.searchland.enabled ? "connected" : "not_configured",
        description: "Title/owner, EPC, and planning data",
      },
      companiesHouse: {
        enabled: apiConfig.companiesHouse.enabled,
        name: "Companies House API",
        status: apiConfig.companiesHouse.enabled ? "connected" : "not_configured",
        description: "Corporate landlord company details and directors",
      },
      googleMaps: {
        enabled: apiConfig.googleMaps.enabled,
        name: "Google Street View",
        status: apiConfig.googleMaps.enabled ? "connected" : "not_configured",
        description: "Fallback property images",
      },
      kamma: {
        enabled: apiConfig.kamma.enabled,
        name: "Kamma API",
        status: apiConfig.kamma.enabled ? "connected" : "not_configured",
        description: "HMO licensing compliance and determination checks",
      },
      ofcom: {
        enabled: apiConfig.ofcom.enabled,
        name: "Ofcom Broadband API",
        status: apiConfig.ofcom.enabled ? "connected" : "not_configured",
        description: "Broadband and fiber availability data",
      },
    },
    mockMode: apiConfig.useMockData,
  }
}
