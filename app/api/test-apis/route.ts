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
      `${apiConfig.propertyData.baseUrl}/hmo-register?postcode=${encodeURIComponent(property.postcode)}&key=${apiConfig.propertyData.apiKey}`
    )

    results.hmoRegisterApi = {
      endpoint: "/hmo-register",
      status: hmoResponse.status,
      success: hmoResponse.ok,
    }

    if (hmoResponse.ok) {
      const data = await hmoResponse.json()
      results.hmoRegisterApi.resultCount = data.data?.length || 0
      results.hmoRegisterApi.providesLicenceHolder = data.data?.some((h: any) => h.licence_holder_name) || false
      if (data.data?.[0]) {
        results.hmoRegisterApi.availableFields = Object.keys(data.data[0])
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
