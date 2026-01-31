import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { apiConfig } from "@/lib/config/api-config"

// HM Land Registry API endpoints
const PRICE_PAID_URL = "https://landregistry.data.gov.uk/data/ppi/transaction-record.json"
const TITLE_API_URL = "https://use-land-property-data.service.gov.uk/api/v1"

/**
 * GET /api/enrich-landregistry
 * Check Land Registry API status
 */
export async function GET() {
  const hasKey = apiConfig.landRegistry?.enabled

  return NextResponse.json({
    message: "HM Land Registry Enrichment API",
    configured: hasKey,
    dataSources: {
      pricePaid: {
        name: "Price Paid Data (Free)",
        description: "Historical transaction prices for properties",
        status: "available",
        cost: "Free",
      },
      titleSearch: {
        name: "Title Search (Paid)",
        description: "Ownership details, tenure, and title information",
        status: hasKey ? "available" : "api_key_required",
        cost: "£3 per search",
      },
    },
    usage: {
      method: "POST",
      body: {
        limit: "Number of properties (default 20, max 50)",
        propertyId: "Specific property ID to enrich",
        postcode: "Lookup price paid data for a postcode",
        useTitleSearch: "Set to true to use paid title search (£3/search)",
      },
    },
  })
}

/**
 * POST /api/enrich-landregistry
 * Enrich properties with Land Registry data
 */
export async function POST(request: Request) {
  const log: string[] = []
  const updated: string[] = []
  const failed: string[] = []

  try {
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(body.limit || 20, 50)
    const propertyId = body.propertyId
    const postcode = body.postcode
    const useTitleSearch = body.useTitleSearch || false

    log.push("Starting Land Registry enrichment...")

    // Mode 1: Single postcode lookup (Price Paid Data - FREE)
    if (postcode) {
      const normalizedPostcode = postcode.toUpperCase().replace(/\s+/g, " ")
      const pricePaidData = await fetchPricePaidData(normalizedPostcode)

      return NextResponse.json({
        success: true,
        postcode: normalizedPostcode,
        transactionCount: pricePaidData.length,
        transactions: pricePaidData.slice(0, 10), // Return first 10
        source: "HM Land Registry Price Paid Data",
      })
    }

    // Fetch properties needing enrichment
    let query = supabaseAdmin
      .from("properties")
      .select("id, address, postcode, city")
      .eq("is_stale", false)
      .not("postcode", "is", null)
      .is("landregistry_last_checked", null)

    if (propertyId) {
      query = supabaseAdmin
        .from("properties")
        .select("id, address, postcode, city")
        .eq("id", propertyId)
    } else {
      query = query.limit(limit)
    }

    const { data: properties, error: fetchError } = await query

    if (fetchError) {
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
    }

    if (!properties?.length) {
      return NextResponse.json({
        success: true,
        message: "No properties found needing Land Registry enrichment",
        log,
      })
    }

    log.push(`Found ${properties.length} properties to enrich`)

    for (const property of properties) {
      try {
        const pc = property.postcode?.toUpperCase().replace(/\s+/g, " ")
        if (!pc) {
          failed.push(property.address)
          continue
        }

        // Fetch Price Paid Data (FREE)
        const pricePaidData = await fetchPricePaidData(pc)

        // Try to find matching transaction for this property
        const matchedTransaction = findMatchingTransaction(property.address, pricePaidData)

        const updateData: any = {
          landregistry_last_checked: new Date().toISOString(),
        }

        if (matchedTransaction) {
          updateData.last_sale_price = matchedTransaction.pricePaid
          updateData.last_sale_date = matchedTransaction.transactionDate
          updateData.property_type_lr = matchedTransaction.propertyType
          updateData.tenure_lr = matchedTransaction.tenure === "F" ? "Freehold" : "Leasehold"
          updateData.new_build = matchedTransaction.newBuild === "Y"

          log.push(`  ${property.address}: £${matchedTransaction.pricePaid.toLocaleString()} (${matchedTransaction.transactionDate})`)
          updated.push(property.address)
        } else if (pricePaidData.length > 0) {
          // No exact match but we have postcode data - store average for reference
          const avgPrice = Math.round(
            pricePaidData.reduce((sum, t) => sum + t.pricePaid, 0) / pricePaidData.length
          )
          updateData.postcode_avg_price = avgPrice
          updateData.postcode_transactions = pricePaidData.length

          log.push(`  ${property.address}: No exact match, postcode avg £${avgPrice.toLocaleString()} (${pricePaidData.length} transactions)`)
          updated.push(property.address)
        } else {
          log.push(`  ${property.address}: No price paid data found`)
          failed.push(property.address)
        }

        // Optional: Title Search (PAID - £3 per search)
        if (useTitleSearch && apiConfig.landRegistry?.enabled) {
          const titleData = await fetchTitleData(property.address, pc)
          if (titleData) {
            updateData.title_number = titleData.titleNumber
            updateData.registered_owner = titleData.ownerName
            updateData.owner_address = titleData.ownerAddress
            log.push(`    + Title: ${titleData.titleNumber}, Owner: ${titleData.ownerName}`)
          }
        }

        await supabaseAdmin
          .from("properties")
          .update(updateData)
          .eq("id", property.id)

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 200))

      } catch (error) {
        log.push(`  Error for ${property.address}: ${error}`)
        failed.push(property.address)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Enriched ${updated.length} properties with Land Registry data`,
      summary: {
        processed: properties.length,
        enriched: updated.length,
        failed: failed.length,
        titleSearches: useTitleSearch ? updated.length : 0,
        estimatedCost: useTitleSearch ? `£${updated.length * 3}` : "£0 (Price Paid only)",
      },
      log,
      updated,
      failed,
    })

  } catch (error) {
    return NextResponse.json({ success: false, error: String(error), log }, { status: 500 })
  }
}

/**
 * Fetch Price Paid Data from Land Registry (FREE)
 */
async function fetchPricePaidData(postcode: string): Promise<PricePaidTransaction[]> {
  try {
    // Use SPARQL endpoint for Price Paid Data
    const sparqlQuery = `
      PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/>
      PREFIX lrcommon: <http://landregistry.data.gov.uk/def/common/>

      SELECT ?paon ?saon ?street ?town ?county ?postcode ?amount ?date ?propertyType ?newBuild ?tenure
      WHERE {
        ?transx lrppi:pricePaid ?amount ;
                lrppi:transactionDate ?date ;
                lrppi:propertyAddress ?addr .

        ?addr lrcommon:postcode "${postcode}" .

        OPTIONAL { ?addr lrcommon:paon ?paon }
        OPTIONAL { ?addr lrcommon:saon ?saon }
        OPTIONAL { ?addr lrcommon:street ?street }
        OPTIONAL { ?addr lrcommon:town ?town }
        OPTIONAL { ?addr lrcommon:county ?county }
        OPTIONAL { ?addr lrcommon:postcode ?postcode }
        OPTIONAL { ?transx lrppi:propertyType ?propertyType }
        OPTIONAL { ?transx lrppi:newBuild ?newBuild }
        OPTIONAL { ?transx lrppi:estateType ?tenure }
      }
      ORDER BY DESC(?date)
      LIMIT 50
    `

    const response = await fetch(
      `https://landregistry.data.gov.uk/landregistry/query?query=${encodeURIComponent(sparqlQuery)}`,
      {
        headers: {
          Accept: "application/sparql-results+json",
        },
      }
    )

    if (!response.ok) {
      console.log(`Price Paid API error: ${response.status}`)
      return []
    }

    const data = await response.json()
    const bindings = data.results?.bindings || []

    return bindings.map((b: any) => ({
      paon: b.paon?.value || "",
      saon: b.saon?.value || "",
      street: b.street?.value || "",
      town: b.town?.value || "",
      postcode: b.postcode?.value || postcode,
      pricePaid: parseInt(b.amount?.value) || 0,
      transactionDate: b.date?.value?.split("T")[0] || "",
      propertyType: parsePropertyType(b.propertyType?.value),
      newBuild: b.newBuild?.value === "true" ? "Y" : "N",
      tenure: parseTenure(b.tenure?.value),
    }))

  } catch (error) {
    console.error("Price Paid fetch error:", error)
    return []
  }
}

/**
 * Fetch Title Data from Land Registry Business Gateway (PAID - £3/search)
 */
async function fetchTitleData(address: string, postcode: string): Promise<TitleData | null> {
  if (!apiConfig.landRegistry?.apiKey) {
    return null
  }

  try {
    // Note: This is a simplified implementation
    // The actual Business Gateway API requires OAuth2 and has specific endpoints
    const response = await fetch(
      `${TITLE_API_URL}/datasets/title-search?address=${encodeURIComponent(address)}&postcode=${encodeURIComponent(postcode)}`,
      {
        headers: {
          Authorization: `Bearer ${apiConfig.landRegistry.apiKey}`,
          Accept: "application/json",
        },
      }
    )

    if (!response.ok) {
      console.log(`Title API error: ${response.status}`)
      return null
    }

    const data = await response.json()

    if (data.titles?.length > 0) {
      const title = data.titles[0]
      return {
        titleNumber: title.title_number,
        ownerName: title.proprietor_name || "Unknown",
        ownerAddress: title.proprietor_address || "",
        tenure: title.tenure,
      }
    }

    return null

  } catch (error) {
    console.error("Title fetch error:", error)
    return null
  }
}

/**
 * Find matching transaction for a property address
 */
function findMatchingTransaction(address: string, transactions: PricePaidTransaction[]): PricePaidTransaction | null {
  const normalizeAddress = (addr: string) => {
    return addr
      .toLowerCase()
      .replace(/[,.']/g, "")
      .replace(/\s+/g, " ")
      .replace(/\bflat\b/g, "")
      .replace(/\bapartment\b/g, "")
      .trim()
  }

  const propAddress = normalizeAddress(address)

  // Extract building number
  const propNumber = propAddress.match(/\b(\d+[a-z]?)\b/)?.[1]

  for (const trans of transactions) {
    const transAddress = normalizeAddress(`${trans.saon} ${trans.paon} ${trans.street}`)

    // Exact match
    if (transAddress === propAddress) return trans

    // Contains match
    if (transAddress.includes(propAddress) || propAddress.includes(transAddress)) {
      return trans
    }

    // Number + street match
    const transNumber = transAddress.match(/\b(\d+[a-z]?)\b/)?.[1]
    if (propNumber && transNumber && propNumber === transNumber) {
      // Check if street name matches
      const propStreet = propAddress.replace(/^\d+[a-z]?\s*/, "").split(" ")[0]
      const transStreet = transAddress.replace(/^\d+[a-z]?\s*/, "").split(" ")[0]

      if (propStreet && transStreet && propStreet === transStreet) {
        return trans
      }
    }
  }

  return null
}

function parsePropertyType(uri: string | undefined): string {
  if (!uri) return "Unknown"
  if (uri.includes("detached")) return "Detached"
  if (uri.includes("semi-detached")) return "Semi-Detached"
  if (uri.includes("terraced")) return "Terraced"
  if (uri.includes("flat")) return "Flat/Maisonette"
  return "Other"
}

function parseTenure(uri: string | undefined): string {
  if (!uri) return "U"
  if (uri.includes("freehold")) return "F"
  if (uri.includes("leasehold")) return "L"
  return "U"
}

interface PricePaidTransaction {
  paon: string
  saon: string
  street: string
  town: string
  postcode: string
  pricePaid: number
  transactionDate: string
  propertyType: string
  newBuild: string
  tenure: string
}

interface TitleData {
  titleNumber: string
  ownerName: string
  ownerAddress: string
  tenure: string
}
