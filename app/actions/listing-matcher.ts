"use server"

import { getRightmoveListingUrl, getRightmoveSearchUrl } from "@/lib/ingestion/adapters/rightmove"

/**
 * Listing Matcher - Links HMO properties to live rental listings
 *
 * Flow:
 * 1. Takes HMO property data (from PropertyData API)
 * 2. Searches Rightmove for matching listings
 * 3. Returns direct URL, photos, and live price
 */

export interface ListingMatch {
  found: boolean
  source: "rightmove" | "zoopla" | "fallback"
  directUrl: string
  images: string[]
  livePrice?: number
  agent?: {
    name: string
    phone?: string
  }
  matchConfidence?: number
}

/**
 * Find a matching listing for an HMO property
 *
 * @param address - Full property address
 * @param postcode - Property postcode
 * @param bedrooms - Number of bedrooms (helps matching accuracy)
 * @returns Listing match with direct URL and photos
 */
export async function findMatchingListing(
  address: string,
  postcode: string,
  bedrooms?: number
): Promise<ListingMatch> {
  // Check if Apify is configured
  const hasApify = !!process.env.APIFY_API_TOKEN

  if (hasApify) {
    try {
      // Try to find exact match via Apify Rightmove scraper
      const match = await getRightmoveListingUrl(address, postcode, bedrooms)

      if (match) {
        return {
          found: true,
          source: "rightmove",
          directUrl: match.url,
          images: match.images,
          livePrice: match.price,
          matchConfidence: 0.9,
        }
      }
    } catch (error) {
      console.error("[ListingMatcher] Apify error:", error)
    }
  }

  // Fallback: Return search URL (user will see search results)
  const searchUrl = getRightmoveSearchUrl(postcode, address)

  return {
    found: false,
    source: "fallback",
    directUrl: searchUrl,
    images: [],
    matchConfidence: 0,
  }
}

/**
 * Batch find listings for multiple properties
 * More efficient than individual calls
 */
export async function findMatchingListingsBatch(
  properties: Array<{
    id: string
    address: string
    postcode: string
    bedrooms?: number
  }>
): Promise<Map<string, ListingMatch>> {
  const results = new Map<string, ListingMatch>()

  // Group by postcode for efficient caching
  const byPostcode = new Map<string, typeof properties>()
  for (const prop of properties) {
    const existing = byPostcode.get(prop.postcode) || []
    existing.push(prop)
    byPostcode.set(prop.postcode, existing)
  }

  // Process each postcode group
  for (const [postcode, props] of byPostcode) {
    console.log(`[ListingMatcher] Processing ${props.length} properties in ${postcode}`)

    for (const prop of props) {
      const match = await findMatchingListing(prop.address, postcode, prop.bedrooms)
      results.set(prop.id, match)
    }
  }

  return results
}

/**
 * Get booking/viewing URL for a property
 * This is the main function used by the "Book Viewing" button
 */
export async function getBookingUrl(
  address: string,
  postcode: string,
  bedrooms?: number
): Promise<{
  url: string
  isDirect: boolean
  source: string
}> {
  const match = await findMatchingListing(address, postcode, bedrooms)

  return {
    url: match.directUrl,
    isDirect: match.found,
    source: match.source,
  }
}

/**
 * Get property images from live listing
 */
export async function getListingImages(
  address: string,
  postcode: string
): Promise<string[]> {
  const match = await findMatchingListing(address, postcode)
  return match.images
}

/**
 * Get the best available image for a property
 * Priority: Listing photos > Street View > Placeholder
 */
export async function getBestPropertyImage(
  address: string,
  postcode: string,
  latitude?: number,
  longitude?: number
): Promise<{
  url: string
  source: "listing" | "streetview" | "placeholder"
}> {
  // Try to get listing images
  const images = await getListingImages(address, postcode)

  if (images.length > 0) {
    return {
      url: images[0],
      source: "listing",
    }
  }

  // Fallback to Street View
  const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (latitude && longitude && googleApiKey) {
    return {
      url: `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${latitude},${longitude}&key=${googleApiKey}`,
      source: "streetview",
    }
  }

  // Final fallback to placeholder
  return {
    url: "/placeholder.jpg",
    source: "placeholder",
  }
}
