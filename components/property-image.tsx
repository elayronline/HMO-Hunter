"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Skeleton } from "@/components/ui/skeleton"
import { Home, ImageOff } from "lucide-react"

interface PropertyImageProps {
  address: string
  postcode: string
  latitude?: number
  longitude?: number
  existingImages?: string[]
  alt?: string
  width?: number
  height?: number
  className?: string
  priority?: boolean
}

/**
 * Property Image Component
 *
 * Priority order:
 * 1. Existing images from database (if provided)
 * 2. Google Street View (if lat/lng and API key available)
 * 3. Placeholder image
 */
export function PropertyImage({
  address,
  postcode,
  latitude,
  longitude,
  existingImages,
  alt,
  width = 400,
  height = 300,
  className = "",
  priority = false,
}: PropertyImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageSource, setImageSource] = useState<"listing" | "streetview" | "placeholder">("placeholder")
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    // Priority 1: Use existing images if available
    if (existingImages && existingImages.length > 0) {
      setImageUrl(existingImages[0])
      setImageSource("listing")
      setIsLoading(false)
      return
    }

    // Priority 2: Try Google Street View
    const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (latitude && longitude && googleApiKey) {
      const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=${width}x${height}&location=${latitude},${longitude}&key=${googleApiKey}`
      setImageUrl(streetViewUrl)
      setImageSource("streetview")
      setIsLoading(false)
      return
    }

    // Priority 3: Placeholder
    setImageUrl("/placeholder.jpg")
    setImageSource("placeholder")
    setIsLoading(false)
  }, [address, postcode, latitude, longitude, existingImages, width, height])

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
      {imageSource === "streetview" && (
        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
          Street View
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
