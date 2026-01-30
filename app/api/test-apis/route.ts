import { NextResponse } from "next/server"
import { validateApiConfig, getApiStatus, apiConfig } from "@/lib/config/api-config"

/**
 * Test API connections
 * GET /api/test-apis
 *
 * Tests all configured APIs and checks which can provide owner data
 */
export async function GET() {
  try {
    const validation = validateApiConfig()
    const status = getApiStatus()

    // Test property to use for API calls
    const testProperty = {
      address: "15 Holloway Road",
      postcode: "N7 6PA",
      city: "London",
    }

    // Run actual API tests
    const apiTests = await runApiTests(testProperty)

    // Generate recommendations
    const recommendations = generateRecommendations(apiTests)

    return NextResponse.json({
      success: validation.isValid,
      validation,
      status,
      apiTests,
      recommendations,
      testProperty,
      timestamp: new Date().toISOString(),
      migrationRequired: apiTests.databaseCheck?.migrationRequired || true,
      migrationSql: getMigrationSql(),
    })
  } catch (error) {
    console.error("[v0] Error testing APIs:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to test API connections",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

async function runApiTests(property: { address: string; postcode: string }) {
  const tests: Record<string, any> = {}

  // Test Searchland APIs
  tests.searchland = await testSearchlandApis(property)

  // Test Companies House API
  tests.companiesHouse = await testCompaniesHouseApi()

  // Test PropertyData HMO API
  tests.propertyData = await testPropertyDataApi(property)

  // Test Zoopla API
  tests.zoopla = await testZooplaApi(property)

  // Test StreetData API
  tests.streetData = await testStreetDataApi(property)

  // Test PaTMa API
  tests.patma = await testPaTMaApi(property)

  return tests
}

async function testSearchlandApis(property: { address: string; postcode: string }) {
  const results: any = {
    configured: apiConfig.searchland.enabled,
    apiKey: apiConfig.searchland.apiKey ? apiConfig.searchland.apiKey.substring(0, 8) + "..." : null,
  }

  if (!apiConfig.searchland.enabled) {
    results.error = "Not configured - add SEARCHLAND_API_KEY"
    return results
  }

  // Test coordinates for London N7 (Holloway Road area)
  const testLat = 51.5489
  const testLng = -0.1074

  // Test HMO Search API (correct endpoint)
  try {
    const hmoResponse = await fetch(
      `${apiConfig.searchland.baseUrl}/hmo/search?lat=${testLat}&lng=${testLng}&radius=1000`,
      {
        headers: {
          "Authorization": `Bearer ${apiConfig.searchland.apiKey}`,
        },
      }
    )

    results.hmoApi = {
      endpoint: "/hmo/search",
      status: hmoResponse.status,
      success: hmoResponse.ok,
    }

    if (hmoResponse.ok) {
      const data = await hmoResponse.json()
      results.hmoApi.cost = data.cost
      results.hmoApi.count = data.data?.length || 0
      results.hmoApi.providesLicenceData = data.data?.length > 0
      if (data.data?.[0]) {
        results.hmoApi.sampleFields = Object.keys(data.data[0])
      }
    } else {
      results.hmoApi.errorBody = await hmoResponse.text().catch(() => "No error body")
    }
  } catch (error) {
    results.hmoApi = { success: false, error: String(error) }
  }

  // Test Titles Search API (correct endpoint)
  try {
    const offset = 0.0005
    const geometry = {
      type: "Polygon",
      coordinates: [[
        [testLng - offset, testLat - offset],
        [testLng + offset, testLat - offset],
        [testLng + offset, testLat + offset],
        [testLng - offset, testLat + offset],
        [testLng - offset, testLat - offset],
      ]],
    }

    const titlesResponse = await fetch(`${apiConfig.searchland.baseUrl}/titles/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiConfig.searchland.apiKey}`,
      },
      body: JSON.stringify({ geometry, perPage: 5 }),
    })

    results.titlesApi = {
      endpoint: "/titles/search",
      status: titlesResponse.status,
      success: titlesResponse.ok,
    }

    if (titlesResponse.ok) {
      const data = await titlesResponse.json()
      results.titlesApi.cost = data.cost
      results.titlesApi.count = data.count
      results.titlesApi.providesOwnerData = data.data?.some((t: any) => t.ownership_category) || false
      if (data.data?.[0]) {
        results.titlesApi.sample = {
          title_no: data.data[0].title_no,
          ownership_category: data.data[0].ownership_category,
          class_of_title: data.data[0].calculated_class_of_title,
        }
      }
    } else {
      results.titlesApi.errorBody = await titlesResponse.text().catch(() => "No error body")
    }
  } catch (error) {
    results.titlesApi = { success: false, error: String(error) }
  }

  // Test Title Details API (for constraints/planning data)
  try {
    // Use a known title number from the search
    const testTitleNumber = "NGL820917"
    const titleResponse = await fetch(
      `${apiConfig.searchland.baseUrl}/titles/get?titleNumber=${testTitleNumber}`,
      {
        headers: {
          "Authorization": `Bearer ${apiConfig.searchland.apiKey}`,
        },
      }
    )

    results.titleDetailsApi = {
      endpoint: "/titles/get",
      status: titleResponse.status,
      success: titleResponse.ok,
    }

    if (titleResponse.ok) {
      const data = await titleResponse.json()
      results.titleDetailsApi.cost = data.cost
      results.titleDetailsApi.providesConstraints = !!data.data?.constraints?.length
      results.titleDetailsApi.constraintsCount = data.data?.constraints?.length || 0
      results.titleDetailsApi.sample = {
        title_no: data.data?.title_no,
        ownership: data.data?.ownership_category,
        constraints: data.data?.constraints?.slice(0, 3),
      }
    } else {
      results.titleDetailsApi.errorBody = await titleResponse.text().catch(() => "No error body")
    }
  } catch (error) {
    results.titleDetailsApi = { success: false, error: String(error) }
  }

  // Note about EPC
  results.epcNote = "EPC data not available from Searchland. Use UK Government EPC API instead (configured via EPC_API_KEY)."

  return results
}

async function testCompaniesHouseApi() {
  if (!apiConfig.companiesHouse.enabled) {
    return {
      configured: false,
      error: "Not configured - add COMPANIES_HOUSE_API_KEY (free at developer.company-information.service.gov.uk)",
    }
  }

  // Test with a known company number (TESCO PLC)
  const testCompanyNumber = "00445790"

  try {
    const response = await fetch(`${apiConfig.companiesHouse.baseUrl}/company/${testCompanyNumber}`, {
      headers: {
        "Authorization": `Basic ${Buffer.from(apiConfig.companiesHouse.apiKey + ":").toString("base64")}`,
      },
    })

    const result: any = {
      configured: true,
      apiKey: apiConfig.companiesHouse.apiKey?.substring(0, 8) + "...",
      status: response.status,
      success: response.ok,
      providesCompanyData: response.ok,
    }

    if (response.ok) {
      const data = await response.json()
      result.sampleResponse = {
        company_name: data.company_name,
        company_status: data.company_status,
        type: data.type,
      }
    } else {
      result.error = await response.text()
    }

    return result
  } catch (error) {
    return {
      configured: true,
      success: false,
      error: String(error),
    }
  }
}

async function testPropertyDataApi(property: { address: string; postcode: string }) {
  if (!apiConfig.propertyData.enabled) {
    return {
      configured: false,
      error: "Not configured - add PROPERTYDATA_API_KEY",
    }
  }

  const results: any = {
    configured: true,
    apiKey: apiConfig.propertyData.apiKey?.substring(0, 8) + "...",
  }

  // Test HMO Register API
  try {
    const hmoResponse = await fetch(
      `${apiConfig.propertyData.baseUrl}/national-hmo-register?postcode=${encodeURIComponent(property.postcode)}&key=${apiConfig.propertyData.apiKey}`
    )

    results.hmoRegisterApi = {
      endpoint: "/national-hmo-register",
      status: hmoResponse.status,
      success: hmoResponse.ok,
    }

    if (hmoResponse.ok) {
      const data = await hmoResponse.json()
      // PropertyData returns { status, data: { hmos: [...] } } structure
      const hmos = data.data?.hmos || data.data || data.hmo_licences || data.results || []
      const hmoArray = Array.isArray(hmos) ? hmos : []

      results.hmoRegisterApi.resultCount = hmoArray.length
      results.hmoRegisterApi.providesLicenceHolder = hmoArray.some((h: any) => h.licence_holder_name || h.licence_holder) || false
      results.hmoRegisterApi.rawStructure = Object.keys(data)
      if (hmoArray[0]) {
        results.hmoRegisterApi.availableFields = Object.keys(hmoArray[0])
        results.hmoRegisterApi.sample = {
          address: hmoArray[0].address || hmoArray[0].property_address,
          licenceHolder: hmoArray[0].licence_holder_name || hmoArray[0].licence_holder,
          reference: hmoArray[0].reference,
        }
      }
    } else {
      const errorText = await hmoResponse.text()
      results.hmoRegisterApi.error = errorText.substring(0, 200)
    }
  } catch (error) {
    results.hmoRegisterApi = { success: false, error: String(error) }
  }

  return results
}

async function testZooplaApi(property: { address: string; postcode: string }) {
  if (!apiConfig.zoopla.enabled) {
    return {
      configured: false,
      error: "Not configured - add ZOOPLA_API_KEY",
      signUpUrl: "https://developer.zoopla.co.uk/",
      description: "Property listings, sold prices, area statistics, Zed Index valuations",
    }
  }

  const results: any = {
    configured: true,
    apiKey: apiConfig.zoopla.apiKey?.substring(0, 8) + "...",
  }

  // Test Property Listings API
  try {
    const params = new URLSearchParams({
      api_key: apiConfig.zoopla.apiKey || "",
      postcode: property.postcode.replace(/\s+/g, ""),
      radius: "0.5",
      listing_status: "rent",
      page_size: "5",
    })

    const response = await fetch(`${apiConfig.zoopla.baseUrl}/property_listings.json?${params}`)

    results.propertyListingsApi = {
      endpoint: "/property_listings.json",
      status: response.status,
      success: response.ok,
    }

    if (response.ok) {
      const data = await response.json()
      results.propertyListingsApi.resultCount = data.result_count || 0
      results.propertyListingsApi.listingsReturned = data.listing?.length || 0
      results.propertyListingsApi.providesImages = data.listing?.some((l: any) => l.image_url) || false
      results.propertyListingsApi.providesAgentDetails = data.listing?.some((l: any) => l.agent_name) || false
      if (data.listing?.[0]) {
        results.propertyListingsApi.sampleFields = Object.keys(data.listing[0]).slice(0, 15)
        results.propertyListingsApi.sample = {
          address: data.listing[0].displayable_address,
          price: data.listing[0].price,
          bedrooms: data.listing[0].num_bedrooms,
          agent: data.listing[0].agent_name,
        }
      }
    } else {
      const errorText = await response.text()
      results.propertyListingsApi.error = errorText.substring(0, 200)
    }
  } catch (error) {
    results.propertyListingsApi = { success: false, error: String(error) }
  }

  // Test Area Statistics API
  try {
    const params = new URLSearchParams({
      api_key: apiConfig.zoopla.apiKey || "",
      postcode: property.postcode.replace(/\s+/g, ""),
      output_type: "outcode",
    })

    const response = await fetch(`${apiConfig.zoopla.baseUrl}/average_area_sold_price.json?${params}`)

    results.areaStatsApi = {
      endpoint: "/average_area_sold_price.json",
      status: response.status,
      success: response.ok,
    }

    if (response.ok) {
      const data = await response.json()
      results.areaStatsApi.averagePrice1Year = data.average_sold_price_1year
      results.areaStatsApi.averagePrice5Year = data.average_sold_price_5year
      results.areaStatsApi.numberOfSales = data.number_of_sales_1year
    } else {
      const errorText = await response.text()
      results.areaStatsApi.error = errorText.substring(0, 200)
    }
  } catch (error) {
    results.areaStatsApi = { success: false, error: String(error) }
  }

  // Test Zed Index API
  try {
    const params = new URLSearchParams({
      api_key: apiConfig.zoopla.apiKey || "",
      postcode: property.postcode.replace(/\s+/g, ""),
      output_type: "outcode",
    })

    const response = await fetch(`${apiConfig.zoopla.baseUrl}/zed_index.json?${params}`)

    results.zedIndexApi = {
      endpoint: "/zed_index.json",
      status: response.status,
      success: response.ok,
    }

    if (response.ok) {
      const data = await response.json()
      results.zedIndexApi.zedIndex = data.zed_index
      results.zedIndexApi.zedIndexChange1Year = data.zed_index_1year
    } else {
      const errorText = await response.text()
      results.zedIndexApi.error = errorText.substring(0, 200)
    }
  } catch (error) {
    results.zedIndexApi = { success: false, error: String(error) }
  }

  return results
}

async function testStreetDataApi(property: { address: string; postcode: string }) {
  if (!apiConfig.streetData.enabled) {
    return {
      configured: false,
      error: "Not configured - add STREETDATA_API_KEY",
      signUpUrl: "https://data.street.co.uk/",
      description: "Property valuations, rental yield calculations, year built data",
      envVar: "STREETDATA_API_KEY",
    }
  }

  const results: any = {
    configured: true,
    apiKey: apiConfig.streetData.apiKey?.substring(0, 8) + "...",
  }

  // Street Data API v2 - correct base URL
  const streetDataBaseUrl = "https://api.data.street.co.uk/street-data-api/v2"

  // Test Property Data API - search by postcode
  try {
    const postcodeNoSpaces = property.postcode.replace(/\s+/g, "")
    const response = await fetch(
      `${streetDataBaseUrl}/properties/areas/postcodes?postcode=${postcodeNoSpaces}&tier=core`,
      {
        headers: {
          "x-api-key": apiConfig.streetData.apiKey || "",
          "Content-Type": "application/json",
        },
      }
    )

    results.propertyApi = {
      endpoint: "/properties/areas/postcodes",
      status: response.status,
      success: response.ok,
    }

    if (response.ok) {
      const data = await response.json()
      const properties = data.data || []
      const propArray = Array.isArray(properties) ? properties : [properties]

      results.propertyApi.resultCount = propArray.length
      results.propertyApi.rawStructure = Object.keys(data)

      if (propArray[0]) {
        // StreetData uses JSON:API format with nested attributes
        const attrs = propArray[0].attributes || propArray[0]
        results.propertyApi.availableFields = Object.keys(attrs).slice(0, 20)
        results.propertyApi.providesValuation = !!attrs.estimated_value || !!attrs.price_estimate || !!attrs.avm_value
        results.propertyApi.providesRentalYield = !!attrs.rental_yield || !!attrs.yield || !!attrs.gross_yield
        results.propertyApi.sample = {
          address: attrs.full_address || attrs.address,
          estimatedValue: attrs.estimated_value || attrs.avm_value || attrs.price_estimate,
          rentalYield: attrs.rental_yield || attrs.gross_yield,
          bedrooms: attrs.bedrooms,
          propertyType: attrs.property_type,
        }
      }
    } else {
      const errorText = await response.text()
      results.propertyApi.error = errorText.substring(0, 300)
    }
  } catch (error) {
    results.propertyApi = { success: false, error: String(error) }
  }

  return results
}

async function testPaTMaApi(property: { address: string; postcode: string }) {
  if (!apiConfig.patma.enabled) {
    return {
      configured: false,
      error: "Not configured - add PATMA_API_KEY",
      signUpUrl: "https://app.patma.co.uk/profile/api_keys/create",
      description: "Rental price analysis, area demographics, investment metrics",
      envVar: "PATMA_API_KEY",
    }
  }

  const results: any = {
    configured: true,
    apiKey: apiConfig.patma.apiKey?.substring(0, 8) + "...",
  }

  // PaTMa API base URL
  const patmaBaseUrl = "https://app.patma.co.uk/api"

  // Test Asking Prices API (requires bedrooms and property_type)
  try {
    const params = new URLSearchParams({
      postcode: property.postcode,
      bedrooms: "3",
      property_type: "house",
    })

    const response = await fetch(
      `${patmaBaseUrl}/prospector/v1/asking-prices/?${params}`,
      {
        headers: {
          "Authorization": `Token ${apiConfig.patma.apiKey}`,
          "Content-Type": "application/json",
        },
      }
    )

    results.askingPricesApi = {
      endpoint: "/prospector/v1/asking-prices/",
      status: response.status,
      success: response.ok,
    }

    if (response.ok) {
      const data = await response.json()
      results.askingPricesApi.dataPoints = data.data?.data_points
      results.askingPricesApi.radius = data.data?.radius
      results.askingPricesApi.sample = {
        meanPrice: data.data?.mean,
        medianPrice: data.data?.median,
        dataPoints: data.data?.data_points,
        radiusMiles: data.data?.radius,
      }
    } else {
      const errorText = await response.text()
      results.askingPricesApi.error = errorText.substring(0, 300)
    }
  } catch (error) {
    results.askingPricesApi = { success: false, error: String(error) }
  }

  // Test Sold Prices API
  try {
    const params = new URLSearchParams({
      postcode: property.postcode,
      bedrooms: "3",
      property_type: "house",
    })

    const response = await fetch(
      `${patmaBaseUrl}/prospector/v1/sold-prices/?${params}`,
      {
        headers: {
          "Authorization": `Token ${apiConfig.patma.apiKey}`,
          "Content-Type": "application/json",
        },
      }
    )

    results.soldPricesApi = {
      endpoint: "/prospector/v1/sold-prices/",
      status: response.status,
      success: response.ok,
    }

    if (response.ok) {
      const data = await response.json()
      results.soldPricesApi.sample = {
        meanPrice: data.data?.mean,
        medianPrice: data.data?.median,
        dataPoints: data.data?.data_points,
      }
    } else {
      const errorText = await response.text()
      results.soldPricesApi.error = errorText.substring(0, 200)
    }
  } catch (error) {
    results.soldPricesApi = { success: false, error: String(error) }
  }

  return results
}

function generateRecommendations(apiTests: any) {
  const recommendations: string[] = []

  // Searchland HMO API
  if (apiTests.searchland?.hmoApi?.success) {
    recommendations.push(`AVAILABLE: Searchland HMO API working - ${apiTests.searchland.hmoApi.count} licences found (${apiTests.searchland.hmoApi.cost} credits)`)
  } else if (apiTests.searchland?.hmoApi?.status === 401) {
    recommendations.push("AUTH ERROR: Searchland API key may be invalid or expired")
  } else if (apiTests.searchland?.hmoApi) {
    recommendations.push("ISSUE: Searchland HMO API not working - " + (apiTests.searchland.hmoApi.error || "unknown error"))
  }

  // Searchland Titles API
  if (apiTests.searchland?.titlesApi?.success) {
    recommendations.push(`AVAILABLE: Searchland Titles API working - ${apiTests.searchland.titlesApi.count} titles found`)
    if (apiTests.searchland.titlesApi.providesOwnerData) {
      recommendations.push("AVAILABLE: Owner/ownership data included in titles")
    }
  } else if (apiTests.searchland?.titlesApi) {
    recommendations.push("ISSUE: Searchland Titles API not working")
  }

  // Searchland Title Details (constraints)
  if (apiTests.searchland?.titleDetailsApi?.success) {
    if (apiTests.searchland.titleDetailsApi.providesConstraints) {
      recommendations.push(`AVAILABLE: Planning constraints from /titles/get - ${apiTests.searchland.titleDetailsApi.constraintsCount} constraints found`)
    }
  }

  // Legacy check for old endpoint names (backwards compatibility)
  if (apiTests.searchland?.titleApi?.success) {
    if (apiTests.searchland.titleApi.providesOwnerData) {
      recommendations.push("AVAILABLE: Searchland Title API provides owner data - run enrichment to populate")
    } else {
      recommendations.push("PARTIAL: Searchland Title API works but no owner data in response for test property")
    }
  } else if (apiTests.searchland?.titleApi?.status === 404) {
    // Old endpoint - ignore, we use new ones now
  } else if (apiTests.searchland?.titleApi?.status === 401 || apiTests.searchland?.titleApi?.status === 403) {
    recommendations.push("AUTH ERROR: Searchland API key may be invalid or expired")
  } else if (apiTests.searchland?.titleApi) {
    recommendations.push("ISSUE: Searchland Title API not working - " + (apiTests.searchland?.titleApi?.error || "unknown error"))
  }

  // Companies House
  if (apiTests.companiesHouse?.success) {
    recommendations.push("AVAILABLE: Companies House API working - can enrich corporate landlord details")
  } else if (!apiTests.companiesHouse?.configured) {
    recommendations.push("NOT CONFIGURED: Add COMPANIES_HOUSE_API_KEY for company owner enrichment (free API)")
  }

  // PropertyData
  if (apiTests.propertyData?.hmoRegisterApi?.success) {
    if (apiTests.propertyData.hmoRegisterApi.providesLicenceHolder) {
      recommendations.push("AVAILABLE: PropertyData provides licence_holder_name for HMO properties")
    } else {
      recommendations.push("PARTIAL: PropertyData HMO API works but licence holder data varies by property")
    }
  }

  // Zoopla
  if (apiTests.zoopla?.propertyListingsApi?.success) {
    recommendations.push(`AVAILABLE: Zoopla API working - ${apiTests.zoopla.propertyListingsApi.resultCount} listings found`)
    if (apiTests.zoopla.propertyListingsApi.providesImages) {
      recommendations.push("AVAILABLE: Zoopla provides property images")
    }
    if (apiTests.zoopla.propertyListingsApi.providesAgentDetails) {
      recommendations.push("AVAILABLE: Zoopla provides agent contact details")
    }
  } else if (!apiTests.zoopla?.configured) {
    recommendations.push("NOT CONFIGURED: Add ZOOPLA_API_KEY for property listings and area stats")
  } else {
    recommendations.push("ISSUE: Zoopla API not working - " + (apiTests.zoopla?.propertyListingsApi?.error || "unknown error"))
  }

  // Zoopla Area Stats
  if (apiTests.zoopla?.areaStatsApi?.success) {
    recommendations.push(`AVAILABLE: Zoopla area stats - avg price £${apiTests.zoopla.areaStatsApi.averagePrice1Year?.toLocaleString() || "N/A"}`)
  }

  // Zoopla Zed Index
  if (apiTests.zoopla?.zedIndexApi?.success) {
    recommendations.push(`AVAILABLE: Zoopla Zed Index - ${apiTests.zoopla.zedIndexApi.zedIndex?.toLocaleString() || "N/A"}`)
  }

  // StreetData
  if (apiTests.streetData?.propertyApi?.success) {
    recommendations.push("AVAILABLE: StreetData API working - property valuations available")
    if (apiTests.streetData.propertyApi.providesValuation) {
      recommendations.push(`AVAILABLE: StreetData avg price: £${apiTests.streetData.propertyApi.sample?.averagePrice?.toLocaleString() || "N/A"}`)
    }
    if (apiTests.streetData.propertyApi.providesRentalYield) {
      recommendations.push(`AVAILABLE: StreetData rental yield: ${apiTests.streetData.propertyApi.sample?.rentalYield || "N/A"}%`)
    }
  } else if (!apiTests.streetData?.configured) {
    recommendations.push("NOT CONFIGURED: Add STREETDATA_API_KEY for property valuations (https://www.streetgroup.co.uk/street-data)")
  } else {
    recommendations.push("ISSUE: StreetData API not working - " + (apiTests.streetData?.propertyApi?.error || "unknown error"))
  }

  // PaTMa
  if (apiTests.patma?.rentalPricesApi?.success) {
    recommendations.push("AVAILABLE: PaTMa API working - rental analytics available")
    if (apiTests.patma.rentalPricesApi.providesRentalYield) {
      recommendations.push(`AVAILABLE: PaTMa rental yield: ${apiTests.patma.rentalPricesApi.sample?.rentalYield || "N/A"}%`)
    }
    if (apiTests.patma.rentalPricesApi.providesPopulation) {
      recommendations.push(`AVAILABLE: PaTMa area demographics available`)
    }
  } else if (!apiTests.patma?.configured) {
    recommendations.push("NOT CONFIGURED: Add PATMA_API_KEY for rental analytics (https://app.patma.co.uk/profile/api_keys/create)")
  } else {
    recommendations.push("ISSUE: PaTMa API not working - " + (apiTests.patma?.rentalPricesApi?.error || "unknown error"))
  }

  // Alternative sources
  recommendations.push("")
  recommendations.push("ALTERNATIVE SOURCES FOR OWNER DATA:")
  recommendations.push("- HM Land Registry (gov.uk) - £3 per search, authoritative")
  recommendations.push("- Local Authority HMO Registers - Free, has licence holder info")
  recommendations.push("- VOA (Valuation Office) datasets - Free, limited info")

  return recommendations
}

function getMigrationSql() {
  return `-- Run this in Supabase SQL Editor to add owner fields

-- Owner/Contact Information
ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_address TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_type TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_contact_email TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_contact_phone TEXT;

-- Company Information
ALTER TABLE properties ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS company_number TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS company_status TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS company_incorporation_date DATE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS directors JSONB;

-- EPC Data
ALTER TABLE properties ADD COLUMN IF NOT EXISTS epc_rating TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS epc_rating_numeric INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS epc_certificate_url TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS epc_expiry_date DATE;

-- Planning Constraints
ALTER TABLE properties ADD COLUMN IF NOT EXISTS article_4_area BOOLEAN DEFAULT FALSE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS planning_constraints JSONB;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS conservation_area BOOLEAN DEFAULT FALSE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS listed_building_grade TEXT;

-- Enrichment Tracking
ALTER TABLE properties ADD COLUMN IF NOT EXISTS title_number TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS title_last_enriched_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_enrichment_source TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_properties_owner_type ON properties(owner_type);
CREATE INDEX IF NOT EXISTS idx_properties_company_number ON properties(company_number);`
}
