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

/**
 * A stable identifier for a Land Registry sale.
 *
 * The Price Paid data has a natural key: an address sold on a date for a price.
 * Using it means the same transaction resolves to the same record however many
 * times it is fetched.
 */
function landRegistryTransactionId(row: any, fallbackPostcode: string): string {
  const parts = [
    row.postcode?.value || fallbackPostcode,
    row.paon?.value,
    row.saon?.value,
    row.date?.value,
    row.amount?.value,
  ]
  return `LR-${parts
    .map((p) => String(p ?? "").trim())
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`
}

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
      // Derived from the sale itself, never from the clock or a random draw. A
      // transaction identifier that changes on every fetch cannot dedupe, so
      // the same sale would be recorded again on each run — the defect that put
      // 31 duplicate copies of licensed HMOs in the database.
      transactionId: landRegistryTransactionId(row, cleanPostcode),
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
      // Same rule as the SPARQL path above: derived from the sale, never the
      // clock. This fallback was worse than its sibling — Date.now() alone gave
      // every transaction in a single response the same identifier, so a batch
      // collapsed to one row on upsert.
      transactionId:
        item.transactionId ||
        landRegistryTransactionId(
          {
            postcode: { value: item.propertyAddress?.postcode },
            paon: { value: item.propertyAddress?.paon },
            saon: { value: item.propertyAddress?.saon },
            date: { value: item.transactionDate },
            amount: { value: item.pricePaid },
          },
          postcode
        ),
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
