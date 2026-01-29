import { SourceAdapter, type PropertyListing } from "@/lib/types/ingestion"
import { apiConfig } from "@/lib/config/api-config"

/**
 * Zoopla API Adapter (Property Listings Source)
 * Phase 1 - Property Listings Data Source
 *
 * Uses Zoopla's property listings API to fetch rental and sale properties
 * Docs: https://developer.zoopla.co.uk/
 */
export class ZooplaAdapter extends SourceAdapter {
  name = "Zoopla"
  type = "property_listings" as const
  phase = 1 as const

  private apiKey: string
  private baseUrl: string

  constructor(apiKey?: string, baseUrl?: string) {
    super()
    this.apiKey = apiKey || apiConfig.zoopla.apiKey || ""
    this.baseUrl = baseUrl || apiConfig.zoopla.baseUrl
  }

  async fetch(options?: {
    postcode?: string
    area?: string
    listingType?: "rent" | "sale"
    minBedrooms?: number
    maxBedrooms?: number
    minPrice?: number
    maxPrice?: number
    radius?: number
    pageSize?: number
  }): Promise<PropertyListing[]> {
    if (!this.apiKey) {
      console.warn("[Zoopla] API key not configured")
      return []
    }

    const {
      postcode,
      area,
      listingType = "rent",
      minBedrooms,
      maxBedrooms,
      minPrice,
      maxPrice,
      radius = 1,
      pageSize = 100,
    } = options || {}

    // Build query parameters
    const params = new URLSearchParams({
      api_key: this.apiKey,
      listing_status: listingType === "rent" ? "rent" : "sale",
      page_size: pageSize.toString(),
      radius: radius.toString(),
    })

    // Add location - either postcode or area
    if (postcode) {
      params.append("postcode", this.normalizePostcode(postcode))
    } else if (area) {
      params.append("area", area)
    } else {
      // Default to some HMO-dense areas if no location specified
      params.append("area", "London")
    }

    // Add optional filters
    if (minBedrooms) params.append("minimum_beds", minBedrooms.toString())
    if (maxBedrooms) params.append("maximum_beds", maxBedrooms.toString())
    if (minPrice) params.append("minimum_price", minPrice.toString())
    if (maxPrice) params.append("maximum_price", maxPrice.toString())

    // Note: property_type filter removed as Zoopla API v1 doesn't support comma-separated values
    // and returns all property types by default

    const allListings: PropertyListing[] = []

    try {
      const url = `${this.baseUrl}/property_listings.json?${params.toString()}`
      console.log(`[Zoopla] Fetching: ${url.replace(this.apiKey, "***")}`)

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
      })

      if (!response.ok) {
        const errorBody = await response.text()
        console.error(`[Zoopla] API error: ${response.status} - ${errorBody}`)
        return []
      }

      const data = await response.json()

      if (!data.listing || !Array.isArray(data.listing)) {
        console.warn("[Zoopla] No listings found in response")
        return []
      }

      console.log(`[Zoopla] Found ${data.listing.length} listings (${data.result_count} total available)`)

      for (const listing of data.listing) {
        try {
          const propertyPostcode = this.normalizePostcode(listing.outcode + " " + (listing.incode || ""))
          const city = listing.county || listing.post_town || this.getCityFromPostcode(propertyPostcode)

          // Determine listing type
          const isRental = listing.listing_status === "rent"

          // Build full address including property number for better matching
          const propertyNumber = listing.property_number || ""
          const streetName = listing.street_name || ""
          const fullAddress = propertyNumber
            ? `${propertyNumber} ${listing.displayable_address}`
            : listing.displayable_address

          const property: PropertyListing = {
            title: listing.title || listing.displayable_address,
            address: fullAddress,
            postcode: propertyPostcode,
            city: city,
            latitude: parseFloat(listing.latitude) || 0,
            longitude: parseFloat(listing.longitude) || 0,
            listing_type: isRental ? "rent" : "purchase",
            property_type: this.mapPropertyType(listing.property_type),
            bedrooms: parseInt(listing.num_bedrooms) || 0,
            bathrooms: parseInt(listing.num_bathrooms) || 1,
            lettable_rooms: parseInt(listing.num_bedrooms) || 0,
            description: listing.description || listing.short_description || "",
            external_id: `zoopla-${listing.listing_id}`,
            source_url: listing.details_url,

            // Pricing
            price_pcm: isRental ? parseInt(listing.rental_prices?.per_month) || parseInt(listing.price) : undefined,
            purchase_price: !isRental ? parseInt(listing.price) : undefined,

            // Images - extract all available images from Zoopla
            images: this.extractAllImages(listing),
            floor_plans: listing.floor_plan ? [listing.floor_plan] : [],

            // Features
            is_furnished: listing.furnished_state === "furnished" || listing.furnished_state === "part_furnished",
            is_pet_friendly: listing.pets_allowed === "Y",
            is_student_friendly: listing.students_allowed === "Y",

            // Additional data
            floor_area_sqft: parseInt(listing.floor_area?.value) || undefined,

            // Agent info
            agent_name: listing.agent_name,
            agent_phone: listing.agent_phone,

            // Timestamps
            last_seen_at: new Date().toISOString(),

            // Raw Zoopla data for exact matching
            _raw: {
              listing_id: listing.listing_id,
              property_number: listing.property_number,
              street_name: listing.street_name,
              outcode: listing.outcode,
              incode: listing.incode,
              displayable_address: listing.displayable_address,
            },
          } as PropertyListing & { _raw: any }

          // Skip if no valid coordinates
          if (!property.latitude || !property.longitude) {
            const coords = await this.geocode(property.address, property.postcode)
            if (coords) {
              property.latitude = coords.lat
              property.longitude = coords.lng
            } else {
              console.warn(`[Zoopla] Skipping property without coordinates: ${property.address}`)
              continue
            }
          }

          allListings.push(property)
        } catch (err) {
          console.error(`[Zoopla] Error processing listing ${listing.listing_id}:`, err)
          continue
        }
      }

      console.log(`[Zoopla] Successfully processed ${allListings.length} listings`)
    } catch (error) {
      console.error("[Zoopla] Fetch error:", error)
    }

    return allListings
  }

  /**
   * Fetch listings by area name (e.g., "Manchester", "Birmingham")
   */
  async fetchByArea(area: string, listingType: "rent" | "sale" = "rent"): Promise<PropertyListing[]> {
    return this.fetch({ area, listingType })
  }

  /**
   * Fetch listings by postcode with radius
   */
  async fetchByPostcode(postcode: string, radius: number = 1, listingType: "rent" | "sale" = "rent"): Promise<PropertyListing[]> {
    return this.fetch({ postcode, radius, listingType })
  }

  /**
   * Extract all images from a Zoopla listing
   * Prioritizes higher resolution images
   */
  private extractAllImages(listing: any): string[] {
    const images: string[] = []

    // First, try to get images from other_image array (medium res)
    if (listing.other_image && Array.isArray(listing.other_image)) {
      for (const img of listing.other_image) {
        if (img.url) {
          // Convert to higher resolution (645x430)
          const highResUrl = img.url.replace("/354/255/", "/645/430/")
          images.push(highResUrl)
        }
      }
    }

    // Fallback to original_image array (full res but larger files)
    if (images.length === 0 && listing.original_image && Array.isArray(listing.original_image)) {
      images.push(...listing.original_image)
    }

    // Final fallback to single image_url
    if (images.length === 0 && listing.image_645_430_url) {
      images.push(listing.image_645_430_url)
    } else if (images.length === 0 && listing.image_url) {
      images.push(listing.image_url)
    }

    return images
  }

  /**
   * Map Zoopla property types to our standard types
   */
  private mapPropertyType(zooplaType: string): string {
    const typeMap: Record<string, string> = {
      "Detached house": "House",
      "Semi-detached house": "House",
      "Terraced house": "House",
      "End of terrace house": "House",
      "Town house": "House",
      "Cottage": "House",
      "Bungalow": "Bungalow",
      "Flat": "Flat",
      "Maisonette": "Flat",
      "Studio": "Studio",
      "Land": "Land",
      "Park home": "Other",
    }
    return typeMap[zooplaType] || "Other"
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SOLD PRICES & AREA STATISTICS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Fetch sold prices for an area/postcode
   * Returns historical sale data for investment analysis
   */
  async fetchSoldPrices(options: {
    postcode?: string
    area?: string
    radius?: number
    pageSize?: number
  }): Promise<SoldPrice[]> {
    if (!this.apiKey) {
      console.warn("[Zoopla] API key not configured")
      return []
    }

    const { postcode, area, radius = 0.5, pageSize = 100 } = options

    const params = new URLSearchParams({
      api_key: this.apiKey,
      radius: radius.toString(),
      page_size: pageSize.toString(),
      order_by: "last_sale_date",
      ordering: "descending",
    })

    if (postcode) {
      params.append("postcode", this.normalizePostcode(postcode))
    } else if (area) {
      params.append("area", area)
    } else {
      return []
    }

    try {
      const url = `${this.baseUrl}/property_rich_list.json?${params.toString()}`
      console.log(`[Zoopla] Fetching sold prices: ${url.replace(this.apiKey, "***")}`)

      const response = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" },
      })

      if (!response.ok) {
        console.error(`[Zoopla] Sold prices API error: ${response.status}`)
        return []
      }

      const data = await response.json()
      const results: SoldPrice[] = []

      if (data.listing && Array.isArray(data.listing)) {
        for (const item of data.listing) {
          if (item.last_sale_price && item.last_sale_date) {
            results.push({
              address: item.displayable_address,
              postcode: this.normalizePostcode(item.outcode + " " + (item.incode || "")),
              price: parseInt(item.last_sale_price),
              date: item.last_sale_date,
              propertyType: item.property_type,
              bedrooms: parseInt(item.num_bedrooms) || 0,
              latitude: parseFloat(item.latitude),
              longitude: parseFloat(item.longitude),
            })
          }
        }
      }

      console.log(`[Zoopla] Found ${results.length} sold prices`)
      return results
    } catch (error) {
      console.error("[Zoopla] Sold prices fetch error:", error)
      return []
    }
  }

  /**
   * Fetch average sold prices for an area
   * Great for comparing areas for investment potential
   */
  async fetchAverageAreaSoldPrice(options: {
    postcode?: string
    area?: string
    outputType?: "outcode" | "area" | "town" | "county" | "country"
  }): Promise<AreaAveragePrice | null> {
    if (!this.apiKey) {
      console.warn("[Zoopla] API key not configured")
      return null
    }

    const { postcode, area, outputType = "outcode" } = options

    const params = new URLSearchParams({
      api_key: this.apiKey,
      output_type: outputType,
    })

    if (postcode) {
      params.append("postcode", this.normalizePostcode(postcode))
    } else if (area) {
      params.append("area", area)
    } else {
      return null
    }

    try {
      const url = `${this.baseUrl}/average_area_sold_price.json?${params.toString()}`
      console.log(`[Zoopla] Fetching area averages: ${url.replace(this.apiKey, "***")}`)

      const response = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" },
      })

      if (!response.ok) {
        console.error(`[Zoopla] Area average API error: ${response.status}`)
        return null
      }

      const data = await response.json()

      return {
        area: data.area_name || area || postcode || "",
        averagePrice: parseInt(data.average_sold_price_1year) || 0,
        averagePrice5Year: parseInt(data.average_sold_price_5year) || 0,
        averagePrice7Year: parseInt(data.average_sold_price_7year) || 0,
        numberOfSales1Year: parseInt(data.number_of_sales_1year) || 0,
        numberOfSales5Year: parseInt(data.number_of_sales_5year) || 0,
        numberOfSales7Year: parseInt(data.number_of_sales_7year) || 0,
        turnover: data.turnover || "",
      }
    } catch (error) {
      console.error("[Zoopla] Area average fetch error:", error)
      return null
    }
  }

  /**
   * Fetch area value graphs data for trend visualization
   */
  async fetchAreaValueGraphs(options: {
    postcode?: string
    area?: string
    outputType?: "outcode" | "area" | "town" | "county"
  }): Promise<AreaValueGraph | null> {
    if (!this.apiKey) {
      console.warn("[Zoopla] API key not configured")
      return null
    }

    const { postcode, area, outputType = "outcode" } = options

    const params = new URLSearchParams({
      api_key: this.apiKey,
      output_type: outputType,
    })

    if (postcode) {
      params.append("postcode", this.normalizePostcode(postcode))
    } else if (area) {
      params.append("area", area)
    } else {
      return null
    }

    try {
      const url = `${this.baseUrl}/area_value_graphs.json?${params.toString()}`
      console.log(`[Zoopla] Fetching value graphs: ${url.replace(this.apiKey, "***")}`)

      const response = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" },
      })

      if (!response.ok) {
        console.error(`[Zoopla] Value graphs API error: ${response.status}`)
        return null
      }

      const data = await response.json()

      return {
        area: data.area_name || area || postcode || "",
        averageValuesGraphUrl: data.average_values_graph_url,
        valueRangesGraphUrl: data.value_ranges_graph_url,
        homesValueGraphUrl: data.home_values_graph_url,
        valueChangeGraphUrl: data.value_trend_graph_url,
        averageValue: parseInt(data.average_current_value) || 0,
        valueChange1Year: parseFloat(data.value_change_1year) || 0,
        valueChange5Year: parseFloat(data.value_change_5year) || 0,
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude),
      }
    } catch (error) {
      console.error("[Zoopla] Value graphs fetch error:", error)
      return null
    }
  }

  /**
   * Fetch Zoopla estimates for a specific property
   */
  async fetchZedIndex(options: {
    postcode?: string
    area?: string
    outputType?: "outcode" | "area" | "town" | "county"
  }): Promise<ZedIndex | null> {
    if (!this.apiKey) {
      console.warn("[Zoopla] API key not configured")
      return null
    }

    const { postcode, area, outputType = "outcode" } = options

    const params = new URLSearchParams({
      api_key: this.apiKey,
      output_type: outputType,
    })

    if (postcode) {
      params.append("postcode", this.normalizePostcode(postcode))
    } else if (area) {
      params.append("area", area)
    } else {
      return null
    }

    try {
      const url = `${this.baseUrl}/zed_index.json?${params.toString()}`
      console.log(`[Zoopla] Fetching Zed Index: ${url.replace(this.apiKey, "***")}`)

      const response = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" },
      })

      if (!response.ok) {
        console.error(`[Zoopla] Zed Index API error: ${response.status}`)
        return null
      }

      const data = await response.json()

      return {
        area: data.area_name || area || postcode || "",
        zedIndex: parseInt(data.zed_index) || 0,
        zedIndexChange1Year: parseFloat(data.zed_index_1year) || 0,
        zedIndexChange5Year: parseFloat(data.zed_index_5year) || 0,
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude),
      }
    } catch (error) {
      console.error("[Zoopla] Zed Index fetch error:", error)
      return null
    }
  }

  /**
   * Get comprehensive area statistics combining multiple endpoints
   */
  async fetchAreaStatistics(options: {
    postcode?: string
    area?: string
  }): Promise<AreaStatistics | null> {
    const { postcode, area } = options

    if (!postcode && !area) return null

    // Fetch all data in parallel
    const [averagePrice, valueGraphs, zedIndex, soldPrices] = await Promise.all([
      this.fetchAverageAreaSoldPrice({ postcode, area }),
      this.fetchAreaValueGraphs({ postcode, area }),
      this.fetchZedIndex({ postcode, area }),
      this.fetchSoldPrices({ postcode, area, pageSize: 20 }),
    ])

    if (!averagePrice && !valueGraphs && !zedIndex) {
      return null
    }

    return {
      area: averagePrice?.area || valueGraphs?.area || zedIndex?.area || area || postcode || "",
      postcode: postcode || "",

      // Price data
      averagePrice: averagePrice?.averagePrice || 0,
      averagePrice5Year: averagePrice?.averagePrice5Year || 0,
      priceChange1Year: valueGraphs?.valueChange1Year || 0,
      priceChange5Year: valueGraphs?.valueChange5Year || 0,

      // Sales volume
      numberOfSales1Year: averagePrice?.numberOfSales1Year || 0,
      numberOfSales5Year: averagePrice?.numberOfSales5Year || 0,
      turnover: averagePrice?.turnover || "",

      // Zoopla estimates
      zedIndex: zedIndex?.zedIndex || 0,

      // Graph URLs for visualization
      averageValuesGraphUrl: valueGraphs?.averageValuesGraphUrl,
      valueRangesGraphUrl: valueGraphs?.valueRangesGraphUrl,
      valueChangeGraphUrl: valueGraphs?.valueChangeGraphUrl,

      // Recent sold prices
      recentSoldPrices: soldPrices.slice(0, 10),

      // Location
      latitude: valueGraphs?.latitude || zedIndex?.latitude,
      longitude: valueGraphs?.longitude || zedIndex?.longitude,

      // Timestamp
      fetchedAt: new Date().toISOString(),
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENHANCED PROPERTY DATA
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Fetch detailed property information with all images
   */
  async fetchPropertyDetails(listingId: string): Promise<PropertyDetails | null> {
    if (!this.apiKey) {
      console.warn("[Zoopla] API key not configured")
      return null
    }

    const params = new URLSearchParams({
      api_key: this.apiKey,
      listing_id: listingId,
    })

    try {
      const url = `${this.baseUrl}/property_listings.json?${params.toString()}`
      console.log(`[Zoopla] Fetching property details: ${url.replace(this.apiKey, "***")}`)

      const response = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" },
      })

      if (!response.ok) {
        console.error(`[Zoopla] Property details API error: ${response.status}`)
        return null
      }

      const data = await response.json()
      const listing = data.listing?.[0]

      if (!listing) return null

      // Extract all image URLs
      const images: string[] = []
      if (listing.image_url) images.push(listing.image_url)
      if (listing.image_354_255_url) images.push(listing.image_354_255_url)
      if (listing.image_645_430_url) images.push(listing.image_645_430_url)
      if (listing.image_80_60_url) images.push(listing.image_80_60_url)
      if (listing.image_150_113_url) images.push(listing.image_150_113_url)

      return {
        listingId: listing.listing_id,
        address: listing.displayable_address,
        postcode: this.normalizePostcode(listing.outcode + " " + (listing.incode || "")),
        price: parseInt(listing.price) || 0,
        priceChange: listing.price_change_summary,
        description: listing.description,
        shortDescription: listing.short_description,
        propertyType: listing.property_type,
        bedrooms: parseInt(listing.num_bedrooms) || 0,
        bathrooms: parseInt(listing.num_bathrooms) || 1,
        receptionRooms: parseInt(listing.num_recepts) || 0,
        floorArea: listing.floor_area?.value ? parseInt(listing.floor_area.value) : undefined,
        floorAreaUnit: listing.floor_area?.units,

        // All images
        images,
        floorPlan: listing.floor_plan,

        // Features
        furnishedState: listing.furnished_state,
        petsAllowed: listing.pets_allowed === "Y",
        studentsAllowed: listing.students_allowed === "Y",
        billsIncluded: listing.bills_included,
        availableFrom: listing.available_from_display,

        // Agent details
        agent: {
          name: listing.agent_name,
          address: listing.agent_address,
          phone: listing.agent_phone,
          logo: listing.agent_logo,
          profileUrl: listing.agent_profile_page_url,
        },

        // Location
        latitude: parseFloat(listing.latitude),
        longitude: parseFloat(listing.longitude),
        streetName: listing.street_name,
        county: listing.county,
        postTown: listing.post_town,
        country: listing.country,

        // Listing info
        detailsUrl: listing.details_url,
        firstPublished: listing.first_published_date,
        lastPublished: listing.last_published_date,
        listingStatus: listing.listing_status,
        newHome: listing.new_home === "true",

        // Days on market
        daysOnMarket: this.calculateDaysOnMarket(listing.first_published_date),
      }
    } catch (error) {
      console.error("[Zoopla] Property details fetch error:", error)
      return null
    }
  }

  /**
   * Calculate days on market from first published date
   */
  private calculateDaysOnMarket(firstPublished: string): number {
    if (!firstPublished) return 0
    const published = new Date(firstPublished)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - published.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export interface SoldPrice {
  address: string
  postcode: string
  price: number
  date: string
  propertyType: string
  bedrooms: number
  latitude?: number
  longitude?: number
}

export interface AreaAveragePrice {
  area: string
  averagePrice: number
  averagePrice5Year: number
  averagePrice7Year: number
  numberOfSales1Year: number
  numberOfSales5Year: number
  numberOfSales7Year: number
  turnover: string
}

export interface AreaValueGraph {
  area: string
  averageValuesGraphUrl?: string
  valueRangesGraphUrl?: string
  homesValueGraphUrl?: string
  valueChangeGraphUrl?: string
  averageValue: number
  valueChange1Year: number
  valueChange5Year: number
  latitude?: number
  longitude?: number
}

export interface ZedIndex {
  area: string
  zedIndex: number
  zedIndexChange1Year: number
  zedIndexChange5Year: number
  latitude?: number
  longitude?: number
}

export interface AreaStatistics {
  area: string
  postcode: string
  averagePrice: number
  averagePrice5Year: number
  priceChange1Year: number
  priceChange5Year: number
  numberOfSales1Year: number
  numberOfSales5Year: number
  turnover: string
  zedIndex: number
  averageValuesGraphUrl?: string
  valueRangesGraphUrl?: string
  valueChangeGraphUrl?: string
  recentSoldPrices: SoldPrice[]
  latitude?: number
  longitude?: number
  fetchedAt: string
}

export interface PropertyDetails {
  listingId: string
  address: string
  postcode: string
  price: number
  priceChange?: string
  description: string
  shortDescription?: string
  propertyType: string
  bedrooms: number
  bathrooms: number
  receptionRooms: number
  floorArea?: number
  floorAreaUnit?: string
  images: string[]
  floorPlan?: string
  furnishedState?: string
  petsAllowed: boolean
  studentsAllowed: boolean
  billsIncluded?: string
  availableFrom?: string
  agent: {
    name: string
    address?: string
    phone?: string
    logo?: string
    profileUrl?: string
  }
  latitude: number
  longitude: number
  streetName?: string
  county?: string
  postTown?: string
  country?: string
  detailsUrl: string
  firstPublished?: string
  lastPublished?: string
  listingStatus: string
  newHome: boolean
  daysOnMarket: number
}
