"use server"

/**
 * HM Land Registry Price Paid Data Adapter
 * Free, public UK government data source
 * https://landregistry.data.gov.uk
 * 
 * Provides: Real transaction prices, property types, addresses
 * Updated: Monthly
 * Coverage: England & Wales from 1995
 */

export interface LandRegistryTransaction {
  transactionId: string
  price: number
  dateOfTransfer: string
  postcode: string
  propertyType: "D" | "S" | "T" | "F" | "O" // Detached, Semi, Terraced, Flat, Other
  newBuild: boolean
  tenure: "F" | "L" // Freehold, Leasehold
  paon: string // Primary Addressable Object Name (house number/name)
  saon: string // Secondary Addressable Object Name (flat number)
  street: string
  locality: string
  town: string
  district: string
  county: string
  recordStatus: "A" | "B" | "C" | "D" // Addition, Change, Delete, etc.
}

export interface LandRegistryResult {
  source: "Land Registry"
  transactions: LandRegistryTransaction[]
  averagePrice?: number
  priceRange?: { min: number; max: number }
  lastSaleDate?: string
  lastSalePrice?: number
  error?: string
}

const PROPERTY_TYPE_MAP: Record<string, string> = {
  D: "Detached",
  S: "Semi-Detached",
  T: "Terraced",
  F: "Flat/Maisonette",
  O: "Other",
}

const TENURE_MAP: Record<string, string> = {
  F: "Freehold",
  L: "Leasehold",
}

// SPARQL endpoint for Land Registry linked data
const LAND_REGISTRY_SPARQL = "http://landregistry.data.gov.uk/landregistry/query"

export async function fetchLandRegistryData(postcode: string): Promise<LandRegistryResult> {
  try {
    // Clean and format postcode
    const cleanPostcode = postcode.trim().toUpperCase().replace(/\s+/g, " ")
    
    // SPARQL query to get price paid data for a postcode
    const sparqlQuery = `
      PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/>
      PREFIX lrcommon: <http://landregistry.data.gov.uk/def/common/>
      
      SELECT ?paon ?saon ?street ?town ?county ?postcode ?amount ?date ?propertyType ?newBuild ?estateType
      WHERE {
        ?transx lrppi:pricePaid ?amount ;
                lrppi:transactionDate ?date ;
                lrppi:propertyAddress ?addr .
        
        ?addr lrcommon:postcode "${cleanPostcode}" .
        
        OPTIONAL { ?addr lrcommon:paon ?paon }
        OPTIONAL { ?addr lrcommon:saon ?saon }
        OPTIONAL { ?addr lrcommon:street ?street }
        OPTIONAL { ?addr lrcommon:town ?town }
        OPTIONAL { ?addr lrcommon:county ?county }
        OPTIONAL { ?addr lrcommon:postcode ?postcode }
        OPTIONAL { ?transx lrppi:propertyType ?propertyTypeURI }
        OPTIONAL { ?transx lrppi:newBuild ?newBuild }
        OPTIONAL { ?transx lrppi:estateType ?estateTypeURI }
        
        BIND(STRAFTER(STR(?propertyTypeURI), "http://landregistry.data.gov.uk/def/common/") AS ?propertyType)
        BIND(STRAFTER(STR(?estateTypeURI), "http://landregistry.data.gov.uk/def/common/") AS ?estateType)
      }
      ORDER BY DESC(?date)
      LIMIT 20
    `

    const response = await fetch(LAND_REGISTRY_SPARQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/sparql-results+json",
      },
      body: `query=${encodeURIComponent(sparqlQuery)}`,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Land Registry] SPARQL error:", response.status, errorText)
      return { source: "Land Registry", transactions: [], error: `API error: ${response.status}` }
    }

    const data = await response.json()
    
    if (!data.results?.bindings || data.results.bindings.length === 0) {
      return { source: "Land Registry", transactions: [], error: "No transactions found" }
    }

    const transactions: LandRegistryTransaction[] = data.results.bindings.map((row: any) => ({
      transactionId: `LR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      price: parseFloat(row.amount?.value || 0),
      dateOfTransfer: row.date?.value || "",
      postcode: row.postcode?.value || cleanPostcode,
      propertyType: (row.propertyType?.value?.[0] || "O") as "D" | "S" | "T" | "F" | "O",
      newBuild: row.newBuild?.value === "true",
      tenure: (row.estateType?.value?.[0] || "F") as "F" | "L",
      paon: row.paon?.value || "",
      saon: row.saon?.value || "",
      street: row.street?.value || "",
      locality: "",
      town: row.town?.value || "",
      district: "",
      county: row.county?.value || "",
      recordStatus: "A" as const,
    }))

    // Calculate statistics
    const prices = transactions.map((t) => t.price).filter((p) => p > 0)
    const averagePrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : undefined
    const priceRange = prices.length > 0 ? { min: Math.min(...prices), max: Math.max(...prices) } : undefined
    const lastTransaction = transactions[0]

    return {
      source: "Land Registry",
      transactions,
      averagePrice,
      priceRange,
      lastSaleDate: lastTransaction?.dateOfTransfer,
      lastSalePrice: lastTransaction?.price,
    }
  } catch (error) {
    console.error("[Land Registry] Fetch error:", error)
    return {
      source: "Land Registry",
      transactions: [],
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// Alternative: Use the simpler JSON API for recent transactions
export async function fetchRecentTransactions(postcode: string): Promise<LandRegistryResult> {
  try {
    const cleanPostcode = postcode.trim().toUpperCase().replace(/\s+/g, "+")
    
    // Use the PPD Report API endpoint
    const url = `http://landregistry.data.gov.uk/data/ppi/transaction-record.json?_page=0&_pageSize=20&propertyAddress.postcode=${cleanPostcode}`
    
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      // Fall back to SPARQL method
      return fetchLandRegistryData(postcode)
    }

    const data = await response.json()
    
    if (!data.result?.items || data.result.items.length === 0) {
      // Fall back to SPARQL method
      return fetchLandRegistryData(postcode)
    }

    const transactions: LandRegistryTransaction[] = data.result.items.map((item: any) => ({
      transactionId: item.transactionId || `LR-${Date.now()}`,
      price: item.pricePaid || 0,
      dateOfTransfer: item.transactionDate || "",
      postcode: item.propertyAddress?.postcode || postcode,
      propertyType: getPropertyTypeCode(item.propertyType),
      newBuild: item.newBuild === true,
      tenure: item.estateType?.includes("freehold") ? "F" : "L",
      paon: item.propertyAddress?.paon || "",
      saon: item.propertyAddress?.saon || "",
      street: item.propertyAddress?.street || "",
      locality: item.propertyAddress?.locality || "",
      town: item.propertyAddress?.town || "",
      district: item.propertyAddress?.district || "",
      county: item.propertyAddress?.county || "",
      recordStatus: "A" as const,
    }))

    const prices = transactions.map((t) => t.price).filter((p) => p > 0)
    
    return {
      source: "Land Registry",
      transactions,
      averagePrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : undefined,
      priceRange: prices.length > 0 ? { min: Math.min(...prices), max: Math.max(...prices) } : undefined,
      lastSaleDate: transactions[0]?.dateOfTransfer,
      lastSalePrice: transactions[0]?.price,
    }
  } catch (error) {
    // Fall back to SPARQL method
    return fetchLandRegistryData(postcode)
  }
}

function getPropertyTypeCode(type: string | undefined): "D" | "S" | "T" | "F" | "O" {
  if (!type) return "O"
  const lower = type.toLowerCase()
  if (lower.includes("detached") && !lower.includes("semi")) return "D"
  if (lower.includes("semi")) return "S"
  if (lower.includes("terrace")) return "T"
  if (lower.includes("flat") || lower.includes("maisonette")) return "F"
  return "O"
}

export async function formatPropertyType(code: string): Promise<string> {
  return PROPERTY_TYPE_MAP[code] || "Other"
}

export async function formatTenure(code: string): Promise<string> {
  return TENURE_MAP[code] || "Unknown"
}
