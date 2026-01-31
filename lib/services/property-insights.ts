"use server"

/**
 * Property Insights Service
 * Aggregates data from multiple API sources to provide comprehensive property insights
 * 
 * Data Sources:
 * - HM Land Registry (FREE) - Real transaction prices, historical sales
 * - PropertyData - HMO licence register
 * - StreetData - Property valuations
 * - PaTMa - Market analytics
 */

import { fetchRecentTransactions, type LandRegistryResult } from "@/lib/ingestion/adapters/land-registry"

interface PropertyQuery {
  postcode: string
  uprn?: string
  address?: string
}

interface PropertyDataInsights {
  source: "PropertyData"
  hmoLicence?: {
    reference: string
    status: string
    issueDate?: string
    expiryDate?: string
    maxOccupancy?: number
    numberOfBedrooms?: number
    localAuthority?: string
  }
  error?: string
}

interface StreetDataInsights {
  source: "StreetData"
  valuation?: {
    estimatedValue: number
    estimatedRentalValue: number
    confidence: string
    lastUpdated: string
  }
  propertyDetails?: {
    propertyType: string
    tenure: string
    floorArea?: number
    yearBuilt?: number
  }
  error?: string
}

interface PaTMaInsights {
  source: "PaTMa"
  marketAnalytics?: {
    averageRent: number
    yieldEstimate: number
    demandScore: number
    competitionLevel: string
    trendDirection: "up" | "down" | "stable"
  }
  hmoViability?: {
    score: number
    recommendation: string
    potentialRooms: number
    estimatedHMORent: number
  }
  error?: string
}

export interface FullPropertyInsights {
  query: PropertyQuery
  timestamp: string
  landRegistry: LandRegistryResult
  propertyData: PropertyDataInsights
  streetData: StreetDataInsights
  patma: PaTMaInsights
  summary: {
    isLicensedHMO: boolean
    estimatedValue?: number
    lastSalePrice?: number
    lastSaleDate?: string
    estimatedMonthlyRent?: number
    hmoViabilityScore?: number
    dataCompleteness: number
    propertyType?: string
  }
}

// Fetch HMO licence data from PropertyData API
async function fetchPropertyDataInsights(query: PropertyQuery): Promise<PropertyDataInsights> {
  const apiKey = process.env.PROPERTYDATA_API_KEY
  const baseUrl = process.env.PROPERTYDATA_BASE_URL || "https://api.propertydata.co.uk"

  if (!apiKey) {
    return { source: "PropertyData", error: "API key not configured" }
  }

  try {
    const params = new URLSearchParams({
      key: apiKey,
      postcode: query.postcode,
    })

    const response = await fetch(`${baseUrl}/national-hmo-register?${params}`, {
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { source: "PropertyData", error: `API error ${response.status}: ${errorText}` }
    }

    const data = await response.json()

    if (data.status === "error") {
      return { source: "PropertyData", error: data.message || "Unknown error" }
    }

    // Find matching HMO licence - API returns data in 'data' array
    const licences = data.data || data.hmo_licences || []
    const licence = licences[0]

    if (!licence) {
      return { source: "PropertyData", hmoLicence: undefined }
    }

    return {
      source: "PropertyData",
      hmoLicence: {
        reference: licence.licence_number || licence.licence_reference,
        status: licence.status || licence.licence_status || "active",
        issueDate: licence.licence_start || licence.licence_issue_date,
        expiryDate: licence.licence_end || licence.licence_expiry_date,
        maxOccupancy: licence.max_occupants || licence.maximum_occupancy,
        numberOfBedrooms: licence.bedrooms || licence.number_of_bedrooms,
        localAuthority: licence.local_authority,
      },
    }
  } catch (error) {
    return {
      source: "PropertyData",
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// Fetch property valuation from Street Data API
async function fetchStreetDataInsights(query: PropertyQuery): Promise<StreetDataInsights> {
  const apiKey = process.env.STREETDATA_API_KEY
  const baseUrl = process.env.STREETDATA_BASE_URL || "https://api.street.co.uk"

  if (!apiKey) {
    return { source: "StreetData", error: "API key not configured" }
  }

  try {
    // IMPORTANT: StreetData requires postcode WITHOUT spaces
    const postcodeNoSpaces = query.postcode.replace(/\s+/g, "")
    const params = new URLSearchParams({
      postcode: postcodeNoSpaces,
      tier: "core",
    })

    // Using correct StreetData endpoint: /properties/areas/postcodes
    const response = await fetch(`${baseUrl}/properties/areas/postcodes?${params}`, {
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { source: "StreetData", error: `API error ${response.status}: ${errorText}` }
    }

    const data = await response.json()

    return {
      source: "StreetData",
      valuation: data.valuation
        ? {
            estimatedValue: data.valuation.estimated_value,
            estimatedRentalValue: data.valuation.estimated_rental_value,
            confidence: data.valuation.confidence || "medium",
            lastUpdated: data.valuation.last_updated || new Date().toISOString(),
          }
        : undefined,
      propertyDetails: data.property
        ? {
            propertyType: data.property.property_type,
            tenure: data.property.tenure,
            floorArea: data.property.floor_area,
            yearBuilt: data.property.year_built,
          }
        : undefined,
    }
  } catch (error) {
    return {
      source: "StreetData",
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// Fetch market analytics from PaTMa API
async function fetchPaTMaInsights(query: PropertyQuery): Promise<PaTMaInsights> {
  const apiKey = process.env.PATMA_API_KEY
  const baseUrl = process.env.PATMA_BASE_URL || "https://app.patma.co.uk/api"

  if (!apiKey) {
    return { source: "PaTMa", error: "API key not configured" }
  }

  try {
    // PaTMa requires postcode without spaces
    const postcodeNoSpaces = query.postcode.replace(/\s+/g, "")
    const params = new URLSearchParams({
      postcode: postcodeNoSpaces,
    })

    const response = await fetch(`${baseUrl}/prospector/v1/rental-prices/?${params}`, {
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { source: "PaTMa", error: `API error ${response.status}: ${errorText}` }
    }

    const data = await response.json()

    return {
      source: "PaTMa",
      marketAnalytics: data.market
        ? {
            averageRent: data.market.average_rent,
            yieldEstimate: data.market.yield_estimate,
            demandScore: data.market.demand_score,
            competitionLevel: data.market.competition_level || "medium",
            trendDirection: data.market.trend_direction || "stable",
          }
        : undefined,
      hmoViability: data.hmo_viability
        ? {
            score: data.hmo_viability.score,
            recommendation: data.hmo_viability.recommendation,
            potentialRooms: data.hmo_viability.potential_rooms,
            estimatedHMORent: data.hmo_viability.estimated_hmo_rent,
          }
        : undefined,
    }
  } catch (error) {
    return {
      source: "PaTMa",
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// Main function to get comprehensive property insights
export async function getFullPropertyInsights(query: PropertyQuery): Promise<FullPropertyInsights> {
  console.log(`[PropertyInsights] Fetching insights for ${query.postcode}${query.uprn ? ` (UPRN: ${query.uprn})` : ""}`)

  // Fetch from all sources in parallel
  // Land Registry is FREE and provides real transaction data
  const [landRegistry, propertyData, streetData, patma] = await Promise.all([
    fetchRecentTransactions(query.postcode),
    fetchPropertyDataInsights(query),
    fetchStreetDataInsights(query),
    fetchPaTMaInsights(query),
  ])

  // Calculate data completeness
  let dataPoints = 0
  let availablePoints = 0

  // Land Registry (FREE public data)
  if (!landRegistry.error) {
    dataPoints += 2
    if (landRegistry.transactions.length > 0) availablePoints += 2
  }
  if (!propertyData.error) {
    dataPoints += 3
    if (propertyData.hmoLicence) availablePoints += 3
  }
  if (!streetData.error) {
    dataPoints += 2
    if (streetData.valuation) availablePoints += 1
    if (streetData.propertyDetails) availablePoints += 1
  }
  if (!patma.error) {
    dataPoints += 2
    if (patma.marketAnalytics) availablePoints += 1
    if (patma.hmoViability) availablePoints += 1
  }

  const dataCompleteness = dataPoints > 0 ? Math.round((availablePoints / dataPoints) * 100) : 0

  // Determine property type from available data
  const propertyType = landRegistry.transactions[0]?.propertyType || 
    streetData.propertyDetails?.propertyType

  return {
    query,
    timestamp: new Date().toISOString(),
    landRegistry,
    propertyData,
    streetData,
    patma,
    summary: {
      isLicensedHMO: !!propertyData.hmoLicence,
      estimatedValue: streetData.valuation?.estimatedValue || landRegistry.averagePrice,
      lastSalePrice: landRegistry.lastSalePrice,
      lastSaleDate: landRegistry.lastSaleDate,
      estimatedMonthlyRent:
        streetData.valuation?.estimatedRentalValue || patma.marketAnalytics?.averageRent,
      hmoViabilityScore: patma.hmoViability?.score,
      dataCompleteness,
      propertyType,
    },
  }
}

// Quick lookup for HMO licence status only
export async function checkHMOLicenceStatus(postcode: string): Promise<{
  isLicensed: boolean
  licenceReference?: string
  expiryDate?: string
  error?: string
}> {
  const insights = await fetchPropertyDataInsights({ postcode })

  if (insights.error) {
    return { isLicensed: false, error: insights.error }
  }

  return {
    isLicensed: !!insights.hmoLicence,
    licenceReference: insights.hmoLicence?.reference,
    expiryDate: insights.hmoLicence?.expiryDate,
  }
}
