"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Skeleton } from "@/components/ui/skeleton"
import { Home, ImageOff, MapPin } from "lucide-react"

interface PropertyImageProps {
  address: string
  postcode: string
  latitude?: number
  longitude?: number
  existingImages?: string[]
  bedrooms?: number
  listingType?: "rent" | "purchase"
  alt?: string
  width?: number
  height?: number
  className?: string
  priority?: boolean
}

/**
 * Check if an image URL is a stock/placeholder image
 */
function isStockImage(url: string | null | undefined): boolean {
  if (!url) return true
  return url.includes("unsplash.com") ||
    url.includes("placeholder") ||
    url.includes("stock") ||
    url.includes("example.com")
}

/**
 * Generate Google Street View URL
 */
function getStreetViewUrl(lat: number, lng: number, width: number, height: number): string {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) return ""
  return `https://maps.googleapis.com/maps/api/streetview?size=${width}x${height}&location=${lat},${lng}&heading=0&pitch=0&fov=90&key=${apiKey}`
}

/**
 * Property Image Component
 *
 * Priority order:
 * 1. Real property images from database (not stock/placeholder)
 * 2. Zoopla listing images (fetched via API)
 * 3. Google Street View (if lat/lng and API key available)
 * 4. Stock images from database (if any)
 * 5. Placeholder image
 */
export function PropertyImage({
  address,
  postcode,
  latitude,
  longitude,
  existingImages,
  bedrooms,
  listingType,
  alt,
  width = 400,
  height = 300,
  className = "",
  priority = false,
}: PropertyImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageSource, setImageSource] = useState<"listing" | "zoopla" | "streetview" | "stock" | "placeholder">("placeholder")
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    const fetchImages = async () => {
      const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

      // Priority 1: Use real images (not stock) if available
      if (existingImages && existingImages.length > 0) {
        const realImages = existingImages.filter(img => !isStockImage(img))
        if (realImages.length > 0) {
          setImageUrl(realImages[0])
          setImageSource("listing")
          setIsLoading(false)
          return
        }
      }

      // Priority 2: Try Zoopla images
      if (postcode) {
        try {
          const params = new URLSearchParams({ postcode })
          if (address) params.append("address", address)
          if (bedrooms) params.append("bedrooms", bedrooms.toString())
          if (listingType) params.append("listingType", listingType === "purchase" ? "sale" : "rent")

          const response = await fetch(`/api/zoopla-images?${params.toString()}`)
          if (response.ok) {
            const data = await response.json()
            if (data.images && data.images.length > 0) {
              setImageUrl(data.images[0])
              setImageSource("zoopla")
              setIsLoading(false)
              return
            }
          }
        } catch (err) {
          console.log("[PropertyImage] Zoopla images not available, falling back")
        }
      }

      // Priority 3: Try Google Street View
      if (latitude && longitude && googleApiKey) {
        const streetViewUrl = getStreetViewUrl(latitude, longitude, width, height)
        if (streetViewUrl) {
          setImageUrl(streetViewUrl)
          setImageSource("streetview")
          setIsLoading(false)
          return
        }
      }

      // Priority 4: Fall back to stock images from database
      if (existingImages && existingImages.length > 0) {
        setImageUrl(existingImages[0])
        setImageSource("stock")
        setIsLoading(false)
        return
      }

      // Priority 5: Placeholder
      setImageUrl("/placeholder.jpg")
      setImageSource("placeholder")
      setIsLoading(false)
    }

    fetchImages()
  }, [address, postcode, latitude, longitude, existingImages, bedrooms, listingType, width, height])

  const handleImageError = () => {
    setHasError(true)
    // Fallback to placeholder on error
    if (imageSource !== "placeholder") {
      setImageUrl("/placeholder.jpg")
      setImageSource("placeholder")
    }
  }

  if (isLoading) {
    return (
      <Skeleton
        className={`${className}`}
        style={{ width, height }}
      />
    )
  }

  if (hasError && imageSource === "placeholder") {
    // Show a nice fallback UI if even placeholder fails
    return (
      <div
        className={`flex items-center justify-center bg-muted ${className}`}
        style={{ width, height }}
      >
        <div className="text-center text-muted-foreground">
          <Home className="mx-auto h-12 w-12 mb-2" />
          <p className="text-sm">No image available</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image
        src={imageUrl || "/placeholder.jpg"}
        alt={alt || `Property at ${address}`}
        width={width}
        height={height}
        className="object-cover w-full h-full"
        onError={handleImageError}
        priority={priority}
      />

      {/* Image source badge */}
      {imageSource === "zoopla" && (
        <div className="absolute bottom-2 right-2 bg-purple-600/80 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
          <Home className="w-3 h-3" />
          Zoopla
        </div>
      )}
      {imageSource === "streetview" && (
        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          Street View
        </div>
      )}
      {imageSource === "stock" && (
        <div className="absolute bottom-2 right-2 bg-amber-500/80 text-white text-xs px-2 py-1 rounded">
          Stock Image
        </div>
      )}
    </div>
  )
}

/**
 * Property Image Gallery
 * Shows multiple images with navigation
 */
export function PropertyImageGallery({
  images,
  address,
  className = "",
}: {
  images: string[]
  address: string
  className?: string
}) {
  const [currentIndex, setCurrentIndex] = useState(0)

  if (!images || images.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-muted h-64 rounded-lg ${className}`}>
        <div className="text-center text-muted-foreground">
          <ImageOff className="mx-auto h-12 w-12 mb-2" />
          <p className="text-sm">No images available</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <div className="relative aspect-video overflow-hidden rounded-lg">
        <Image
          src={images[currentIndex]}
          alt={`${address} - Image ${currentIndex + 1}`}
          fill
          className="object-cover"
        />
      </div>

      {images.length > 1 && (
        <>
          {/* Navigation dots */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-colors ${index === currentIndex ? "bg-white" : "bg-white/50"
                  }`}
                aria-label={`Go to image ${index + 1}`}
              />
            ))}
          </div>

          {/* Arrow navigation */}
          <button
            onClick={() => setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
            aria-label="Previous image"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={() => setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
            aria-label="Next image"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Image counter */}
          <div className="absolute top-4 right-4 bg-black/50 text-white text-sm px-2 py-1 rounded">
            {currentIndex + 1} / {images.length}
          </div>
        </>
      )}
    </div>
  )
}
