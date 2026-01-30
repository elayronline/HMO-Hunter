import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { apiConfig } from "@/lib/config/api-config"

/**
 * Test all configured APIs on real properties
 * GET /api/test-enrichment?limit=5
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get("limit") || "5"), 10)

  const results: any = {
    timestamp: new Date().toISOString(),
    propertiesTested: 0,
    apiResults: [],
  }

  // Get real properties from database
  const { data: properties, error } = await supabaseAdmin
    .from("properties")
    .select("id, address, postcode, city, bedrooms, property_type")
    .eq("is_stale", false)
    .not("postcode", "is", null)
    .limit(limit)

  if (error || !properties?.length) {
    return NextResponse.json({
      success: false,
      error: error?.message || "No properties found",
    })
  }

  results.propertiesTested = properties.length

  // Test each property with all APIs
  for (const property of properties) {
    const propertyResult: any = {
      property: {
        id: property.id,
        address: property.address,
        postcode: property.postcode,
        city: property.city,
      },
      apis: {},
    }

    // 1. Test Zoopla API
    if (apiConfig.zoopla.enabled) {
      propertyResult.apis.zoopla = await testZooplaForProperty(property)
    }

    // 2. Test PropertyData API
    if (apiConfig.propertyData.enabled) {
      propertyResult.apis.propertyData = await testPropertyDataForProperty(property)
    }

    // 3. Test StreetData API
    if (apiConfig.streetData.enabled) {
      propertyResult.apis.streetData = await testStreetDataForProperty(property)
    }

    // 4. Test PaTMa API
    if (apiConfig.patma.enabled) {
      propertyResult.apis.patma = await testPaTMaForProperty(property)
    }

    results.apiResults.push(propertyResult)

    // Rate limit between properties
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  // Summary
  results.summary = {
    zoopla: {
      tested: results.apiResults.filter((r: any) => r.apis.zoopla).length,
      successful: results.apiResults.filter((r: any) => r.apis.zoopla?.success).length,
    },
    propertyData: {
      tested: results.apiResults.filter((r: any) => r.apis.propertyData).length,
      successful: results.apiResults.filter((r: any) => r.apis.propertyData?.success).length,
    },
    streetData: {
      tested: results.apiResults.filter((r: any) => r.apis.streetData).length,
      successful: results.apiResults.filter((r: any) => r.apis.streetData?.success).length,
    },
    patma: {
      tested: results.apiResults.filter((r: any) => r.apis.patma).length,
      successful: results.apiResults.filter((r: any) => r.apis.patma?.success).length,
    },
  }

  return NextResponse.json(results)
}

async function testZooplaForProperty(property: { postcode: string; address: string }) {
  try {
    const params = new URLSearchParams({
      api_key: apiConfig.zoopla.apiKey || "",
      postcode: property.postcode.replace(/\s+/g, ""),
      radius: "0.1",
      listing_status: "rent",
      page_size: "5",
    })

    const response = await fetch(`${apiConfig.zoopla.baseUrl}/property_listings.json?${params}`)

    if (!response.ok) {
      return { success: false, status: response.status, error: await response.text() }
    }

    const data = await response.json()
    const listings = data.listing || []

    // Try to find a matching listing
    const matchedListing = listings.find((l: any) =>
      l.displayable_address?.toLowerCase().includes(property.address.split(",")[0].toLowerCase())
    )

    return {
      success: true,
      totalListings: data.result_count,
      nearbyListings: listings.length,
      matchedListing: matchedListing ? {
        address: matchedListing.displayable_address,
        price: matchedListing.price,
        bedrooms: matchedListing.num_bedrooms,
        agent: matchedListing.agent_name,
        hasImages: !!matchedListing.image_url,
        url: matchedListing.details_url,
      } : null,
      sampleNearby: listings[0] ? {
        address: listings[0].displayable_address,
        price: listings[0].price,
        bedrooms: listings[0].num_bedrooms,
      } : null,
    }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

async function testPropertyDataForProperty(property: { postcode: string }) {
  try {
    const params = new URLSearchParams({
      key: apiConfig.propertyData.apiKey || "",
      postcode: property.postcode,
    })

    const response = await fetch(`${apiConfig.propertyData.baseUrl}/national-hmo-register?${params}`)

    if (!response.ok) {
      return { success: false, status: response.status, error: await response.text() }
    }

    const data = await response.json()
    const hmos = data.data || []

    return {
      success: true,
      hmosFound: hmos.length,
      apiCallsCost: data.api_calls_cost,
      sample: hmos[0] ? {
        address: hmos[0].address,
        council: hmos[0].council,
        licenceType: hmos[0].licence_type,
        licenceExpiry: hmos[0].licence_expiry,
        occupancy: hmos[0].occupancy,
        reference: hmos[0].reference,
      } : null,
    }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

async function testStreetDataForProperty(property: { postcode: string }) {
  try {
    const streetDataBaseUrl = "https://api.data.street.co.uk/street-data-api/v2"
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

    if (!response.ok) {
      return { success: false, status: response.status, error: await response.text() }
    }

    const data = await response.json()
    const properties = data.data || []
    const propArray = Array.isArray(properties) ? properties : [properties]

    if (propArray[0]) {
      const attrs = propArray[0].attributes || {}
      return {
        success: true,
        propertiesFound: propArray.length,
        sample: {
          address: attrs.address?.street_group_format?.address_lines,
          propertyType: attrs.property_type?.value,
          bedrooms: attrs.number_of_bedrooms?.value,
          bathrooms: attrs.number_of_bathrooms?.value,
          yearBuilt: attrs.year_built?.value,
          floorArea: attrs.internal_area_square_metres?.value,
          tenure: attrs.tenure?.value,
          councilTaxBand: attrs.council_tax?.band?.value,
        },
      }
    }

    return { success: true, propertiesFound: 0, sample: null }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

async function testPaTMaForProperty(property: { postcode: string; bedrooms?: number }) {
  try {
    const patmaBaseUrl = "https://app.patma.co.uk/api"
    const bedrooms = property.bedrooms || 3
    const propertyType = "house"

    // Test asking prices
    const askingParams = new URLSearchParams({
      postcode: property.postcode,
      bedrooms: bedrooms.toString(),
      property_type: propertyType,
    })

    const askingResponse = await fetch(
      `${patmaBaseUrl}/prospector/v1/asking-prices/?${askingParams}`,
      {
        headers: {
          "Authorization": `Token ${apiConfig.patma.apiKey}`,
          "Content-Type": "application/json",
        },
      }
    )

    // Test sold prices
    const soldResponse = await fetch(
      `${patmaBaseUrl}/prospector/v1/sold-prices/?${askingParams}`,
      {
        headers: {
          "Authorization": `Token ${apiConfig.patma.apiKey}`,
          "Content-Type": "application/json",
        },
      }
    )

    const result: any = { success: true }

    if (askingResponse.ok) {
      const askingData = await askingResponse.json()
      result.askingPrices = {
        meanPrice: askingData.data?.mean,
        medianPrice: askingData.data?.median,
        dataPoints: askingData.data?.data_points,
        radiusMiles: askingData.data?.radius,
      }
    }

    if (soldResponse.ok) {
      const soldData = await soldResponse.json()
      result.soldPrices = {
        meanPrice: soldData.data?.mean,
        medianPrice: soldData.data?.median,
        dataPoints: soldData.data?.data_points,
      }
    }

    // Calculate potential yield if we have both
    if (result.askingPrices?.medianPrice && result.soldPrices?.medianPrice) {
      // Rough rental yield estimate (annual rent / purchase price * 100)
      // Assuming asking rent is monthly
      const estimatedAnnualRent = result.askingPrices.medianPrice * 12
      result.estimatedYield = ((estimatedAnnualRent / result.soldPrices.medianPrice) * 100).toFixed(2) + "%"
    }

    return result
  } catch (error) {
    return { success: false, error: String(error) }
  }
}
