/**
 * Image Fallback Chain
 *
 * Handles the Rightmove 403 issue by providing a fallback chain:
 * 1. Primary image (Zoopla/Rightmove)
 * 2. Google Street View
 * 3. Placeholder with property type icon
 *
 * Also provides image proxy URL generation for CORS-safe loading.
 */

const PLACEHOLDER_BASE = "/property-placeholder.svg"

export type ImageSource = "zoopla" | "rightmove" | "street_view" | "google_search" | "placeholder"

export interface ResolvedImage {
  url: string
  source: ImageSource
  isFallback: boolean
}

/**
 * Resolve the best available image for a property.
 * Returns the first available image in the fallback chain.
 */
export function resolvePropertyImage(property: {
  primary_image?: string | null
  images?: string[] | null
  zoopla_images?: string[] | null
  image_url?: string | null
  latitude?: number | null
  longitude?: number | null
  address?: string | null
  postcode?: string | null
}): ResolvedImage {
  // 1. Primary image
  if (property.primary_image && !isBlockedUrl(property.primary_image)) {
    return { url: property.primary_image, source: detectSource(property.primary_image), isFallback: false }
  }

  // 2. Zoopla images array
  if (property.zoopla_images?.length) {
    const valid = property.zoopla_images.find(url => !isBlockedUrl(url))
    if (valid) return { url: valid, source: "zoopla", isFallback: false }
  }

  // 3. General images array
  if (property.images?.length) {
    const valid = property.images.find(url => !isBlockedUrl(url))
    if (valid) return { url: valid, source: detectSource(valid), isFallback: false }
  }

  // 4. Legacy image_url
  if (property.image_url && !isBlockedUrl(property.image_url)) {
    return { url: property.image_url, source: detectSource(property.image_url), isFallback: false }
  }

  // 5. Google Street View (if coords available)
  if (property.latitude && property.longitude && process.env.GOOGLE_MAPS_API_KEY) {
    const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${property.latitude},${property.longitude}&key=${process.env.GOOGLE_MAPS_API_KEY}`
    return { url: streetViewUrl, source: "street_view", isFallback: true }
  }

  // 6. Placeholder
  return { url: PLACEHOLDER_BASE, source: "placeholder", isFallback: true }
}

/**
 * Check if a URL is known to be blocked (Rightmove 403, etc.)
 */
function isBlockedUrl(url: string): boolean {
  const blockedPatterns = [
    "media.rightmove.co.uk",  // Known 403 without auth
    "rightmove.co.uk/photos", // Alternate pattern
  ]
  return blockedPatterns.some(pattern => url.includes(pattern))
}

/**
 * Detect the source of an image URL
 */
function detectSource(url: string): ImageSource {
  if (url.includes("zoopla")) return "zoopla"
  if (url.includes("rightmove")) return "rightmove"
  if (url.includes("googleapis.com/maps")) return "street_view"
  if (url.includes("googleapis.com/customsearch")) return "google_search"
  return "zoopla" // Default
}

/**
 * Get all available images for a property, filtering out blocked URLs
 */
export function getAvailableImages(property: {
  primary_image?: string | null
  images?: string[] | null
  zoopla_images?: string[] | null
  floor_plans?: string[] | null
}): string[] {
  const all: string[] = []

  if (property.primary_image && !isBlockedUrl(property.primary_image)) {
    all.push(property.primary_image)
  }

  for (const img of property.zoopla_images || []) {
    if (!isBlockedUrl(img) && !all.includes(img)) {
      all.push(img)
    }
  }

  for (const img of property.images || []) {
    if (!isBlockedUrl(img) && !all.includes(img)) {
      all.push(img)
    }
  }

  return all
}
