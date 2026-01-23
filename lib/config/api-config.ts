/**
 * API Configuration for HMO Hunter
 * Manages legitimate data source connections
 * Active APIs: PropertyData, StreetData, PaTMa, Apify (Rightmove)
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
      googleMaps: {
        enabled: apiConfig.googleMaps.enabled,
        name: "Google Street View",
        status: apiConfig.googleMaps.enabled ? "connected" : "not_configured",
        description: "Fallback property images",
      },
    },
    mockMode: apiConfig.useMockData,
  }
}
