"use server"

import { createServiceRoleClient } from "@/lib/supabase/server"
import { UK_CITIES } from "@/lib/data/uk-cities"

// Sample street names for generating addresses
const STREET_NAMES = [
  "High Street", "Station Road", "Church Lane", "Victoria Road", "Park Avenue",
  "Queen Street", "King Street", "Mill Lane", "The Green", "Manor Road",
  "Grove Road", "Albert Street", "George Street", "London Road", "Bridge Street",
  "New Road", "Main Street", "Springfield Road", "Castle Street", "West Street"
]

const HMO_TYPES = ["Licensed HMO", "Potential HMO", "Standard HMO"]

// Average rent per room by city (monthly)
const CITY_RENT_RANGES: Record<string, [number, number]> = {
  "London": [700, 1000],
  "Manchester": [500, 700],
  "Birmingham": [450, 650],
  "Leeds": [400, 600],
  "Liverpool": [380, 550],
  "Newcastle": [400, 580],
  "Sheffield": [380, 550],
  "Bristol": [550, 750],
  "Nottingham": [400, 580],
  "Leicester": [400, 580],
  "Coventry": [420, 600],
  "Bradford": [350, 500],
  "Southampton": [500, 700],
  "Portsmouth": [480, 680],
  "Plymouth": [400, 580],
  "Reading": [600, 850],
  "Oxford": [650, 900],
  "Cambridge": [650, 900],
  "Brighton": [600, 850],
  "York": [450, 650],
  "Edinburgh": [550, 750],
  "Glasgow": [450, 650],
  "Aberdeen": [450, 650],
  "Dundee": [400, 580],
  "Cardiff": [450, 650],
  "Swansea": [380, 550],
  "Newport": [380, 550],
  "Belfast": [400, 580],
  "Derry": [350, 500],
  "Lisburn": [380, 550],
  "Newry": [350, 500],
}

// Purchase price multipliers by city (relative to London = 1.0)
const CITY_PRICE_MULTIPLIERS: Record<string, number> = {
  "London": 1.0,
  "Manchester": 0.55,
  "Birmingham": 0.50,
  "Leeds": 0.45,
  "Liverpool": 0.40,
  "Newcastle": 0.42,
  "Sheffield": 0.40,
  "Bristol": 0.65,
  "Nottingham": 0.42,
  "Leicester": 0.45,
  "Coventry": 0.48,
  "Bradford": 0.35,
  "Southampton": 0.58,
  "Portsmouth": 0.55,
  "Plymouth": 0.48,
  "Reading": 0.70,
  "Oxford": 0.80,
  "Cambridge": 0.82,
  "Brighton": 0.72,
  "York": 0.55,
  "Edinburgh": 0.60,
  "Glasgow": 0.48,
  "Aberdeen": 0.45,
  "Dundee": 0.38,
  "Cardiff": 0.50,
  "Swansea": 0.40,
  "Newport": 0.42,
  "Belfast": 0.38,
  "Derry": 0.32,
  "Lisburn": 0.36,
  "Newry": 0.32,
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generatePostcode(city: string): string {
  const prefixes: Record<string, string[]> = {
    "London": ["N1", "E2", "SE5", "NW5", "E8", "SW9", "W2", "EC1", "N7", "E1"],
    "Manchester": ["M1", "M3", "M4", "M14", "M15", "M20"],
    "Birmingham": ["B1", "B5", "B15", "B16", "B29", "B30"],
    "Leeds": ["LS1", "LS2", "LS6", "LS7", "LS8", "LS9"],
    "Liverpool": ["L1", "L3", "L7", "L8", "L15", "L17"],
    "Newcastle": ["NE1", "NE2", "NE4", "NE6", "NE7"],
    "Sheffield": ["S1", "S2", "S3", "S10", "S11"],
    "Bristol": ["BS1", "BS2", "BS5", "BS6", "BS7", "BS8"],
    "Nottingham": ["NG1", "NG2", "NG3", "NG7", "NG9"],
    "Leicester": ["LE1", "LE2", "LE3", "LE4", "LE5"],
    "Coventry": ["CV1", "CV3", "CV5", "CV6"],
    "Bradford": ["BD1", "BD3", "BD5", "BD7", "BD8"],
    "Southampton": ["SO14", "SO15", "SO16", "SO17"],
    "Portsmouth": ["PO1", "PO2", "PO4", "PO5"],
    "Plymouth": ["PL1", "PL2", "PL4", "PL5"],
    "Reading": ["RG1", "RG2", "RG4", "RG6"],
    "Oxford": ["OX1", "OX2", "OX3", "OX4"],
    "Cambridge": ["CB1", "CB2", "CB4", "CB5"],
    "Brighton": ["BN1", "BN2", "BN3"],
    "York": ["YO1", "YO10", "YO23", "YO24"],
    "Edinburgh": ["EH1", "EH3", "EH6", "EH8", "EH9"],
    "Glasgow": ["G1", "G3", "G4", "G11", "G12"],
    "Aberdeen": ["AB10", "AB11", "AB24", "AB25"],
    "Dundee": ["DD1", "DD2", "DD3", "DD4"],
    "Cardiff": ["CF10", "CF11", "CF14", "CF24"],
    "Swansea": ["SA1", "SA2", "SA3", "SA4"],
    "Newport": ["NP19", "NP20"],
    "Belfast": ["BT1", "BT7", "BT9", "BT12", "BT15"],
    "Derry": ["BT47", "BT48"],
    "Lisburn": ["BT27", "BT28"],
    "Newry": ["BT34", "BT35"],
  }

  const cityPrefixes = prefixes[city] || ["XX1"]
  const prefix = randomElement(cityPrefixes)
  const number = randomInt(1, 9)
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"
  const suffix = letters[randomInt(0, letters.length - 1)] + letters[randomInt(0, letters.length - 1)]

  return `${prefix} ${number}${suffix}`
}

export async function seedAllCities(): Promise<{
  success: boolean
  message: string
  propertiesAdded: number
  citiesSeeded: string[]
  errors: string[]
}> {
  const errors: string[] = []
  let propertiesAdded = 0
  const citiesSeeded: string[] = []

  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return {
        success: false,
        message: "SUPABASE_SERVICE_ROLE_KEY not configured",
        propertiesAdded: 0,
        citiesSeeded: [],
        errors: ["SUPABASE_SERVICE_ROLE_KEY not set"],
      }
    }

    const supabase = createServiceRoleClient()

    console.log(`[SeedAllCities] Starting seed for ${UK_CITIES.length} cities...`)

    for (const city of UK_CITIES) {
      try {
        // Generate 8-15 properties per city
        const propertyCount = randomInt(8, 15)
        console.log(`[SeedAllCities] Generating ${propertyCount} properties for ${city.name}...`)

        const rentRange = CITY_RENT_RANGES[city.name] || [400, 600]
        const priceMultiplier = CITY_PRICE_MULTIPLIERS[city.name] || 0.5

        for (let i = 0; i < propertyCount; i++) {
          const bedrooms = randomInt(3, 8)
          const bathrooms = Math.ceil(bedrooms / 2.5)
          const hmoStatus = randomElement(HMO_TYPES)
          const isLicensed = hmoStatus === "Licensed HMO"
          const listingType = Math.random() > 0.7 ? "purchase" : "rent"

          // Rent calculation
          const rentPerRoom = randomInt(rentRange[0], rentRange[1])
          const pricePcm = rentPerRoom * bedrooms

          // Purchase price calculation (based on yield ~6-8%)
          const annualRent = pricePcm * 12
          const yieldRate = 0.06 + Math.random() * 0.02
          const basePurchasePrice = annualRent / yieldRate
          const purchasePrice = Math.round(basePurchasePrice * priceMultiplier / 5000) * 5000

          // Generate coordinates with slight randomization around city center
          const lat = city.latitude + (Math.random() - 0.5) * 0.04
          const lng = city.longitude + (Math.random() - 0.5) * 0.04

          const streetNumber = randomInt(1, 150)
          const street = randomElement(STREET_NAMES)
          const postcode = generatePostcode(city.name)

          const propertyData = {
            title: `${bedrooms} Bed ${isLicensed ? "Licensed " : ""}HMO - ${city.name}`,
            address: `${streetNumber} ${street}`,
            postcode,
            city: city.name,
            country: "UK",
            latitude: lat,
            longitude: lng,
            listing_type: listingType,
            price_pcm: listingType === "rent" ? pricePcm : null,
            purchase_price: listingType === "purchase" ? purchasePrice : null,
            estimated_rent_per_room: rentPerRoom,
            property_type: "HMO",
            hmo_status: hmoStatus,
            licensed_hmo: isLicensed,
            bedrooms,
            bathrooms,
            is_furnished: Math.random() > 0.2,
            is_student_friendly: Math.random() > 0.3,
            is_pet_friendly: Math.random() > 0.7,
            has_garden: Math.random() > 0.5,
            has_parking: Math.random() > 0.6,
            wifi_included: Math.random() > 0.3,
            near_tube_station: city.name === "London" ? Math.random() > 0.3 : false,
            is_stale: false,
            tenure: listingType === "purchase" ? (Math.random() > 0.3 ? "freehold" : "leasehold") : null,
            description: `${bedrooms} bedroom ${isLicensed ? "licensed " : ""}HMO property in ${city.name}. ${
              isLicensed ? "Fully licensed with council. " : ""
            }${Math.random() > 0.5 ? "Recently refurbished. " : ""}${
              Math.random() > 0.5 ? "Close to local amenities. " : ""
            }Ideal for ${Math.random() > 0.5 ? "students" : "young professionals"}.`,
          }

          const { error: insertError } = await supabase
            .from("properties")
            .insert(propertyData)

          if (insertError) {
            console.error(`[SeedAllCities] Insert error for ${city.name}:`, insertError.message)
            errors.push(`${city.name}: ${insertError.message}`)
          } else {
            propertiesAdded++
          }
        }

        citiesSeeded.push(city.name)
      } catch (error) {
        console.error(`[SeedAllCities] Error seeding ${city.name}:`, error)
        errors.push(`${city.name}: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    }

    console.log(`[SeedAllCities] Complete. Added ${propertiesAdded} properties across ${citiesSeeded.length} cities.`)

    return {
      success: propertiesAdded > 0,
      message: `Added ${propertiesAdded} properties across ${citiesSeeded.length} cities`,
      propertiesAdded,
      citiesSeeded,
      errors,
    }
  } catch (error) {
    console.error("[SeedAllCities] Fatal error:", error)
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
      propertiesAdded: 0,
      citiesSeeded: [],
      errors: [error instanceof Error ? error.message : "Unknown error"],
    }
  }
}
