"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ExternalLink, Loader2 } from "lucide-react"

interface BookViewingButtonProps {
  address: string
  postcode: string
  bedrooms?: number
  className?: string
  variant?: "default" | "outline" | "secondary"
  size?: "default" | "sm" | "lg"
  sourceUrl?: string // Direct listing URL if available
}

/**
 * Book Viewing Button Component
 *
 * Opens Rightmove search for the property's postcode.
 * If sourceUrl is provided (from enrichment), opens directly.
 */
export function BookViewingButton({
  address,
  postcode,
  bedrooms,
  className,
  variant = "default",
  size = "default",
  sourceUrl,
}: BookViewingButtonProps) {
  const handleClick = () => {
    // If we have a direct source URL from enrichment, use it
    if (sourceUrl && sourceUrl.includes("rightmove.co.uk")) {
      window.open(sourceUrl, "_blank", "noopener,noreferrer")
      return
    }

    // Otherwise, open Rightmove search with postcode
    // Use the standard search format that normal users would use
    const cleanPostcode = postcode.replace(/\s+/g, "")
    const searchUrl = `https://www.rightmove.co.uk/property-to-rent/find.html?locationIdentifier=POSTCODE%5E${cleanPostcode}&propertyTypes=&includeLetAgreed=false&mustHave=&dontShow=&furnishTypes=&keywords=`

    window.open(searchUrl, "_blank", "noopener,noreferrer")
  }

  return (
    <Button
      onClick={handleClick}
      variant={variant}
      size={size}
      className={`bg-teal-600 hover:bg-teal-700 text-white ${className}`}
    >
      <ExternalLink className="mr-2 h-4 w-4" />
      Book Viewing
    </Button>
  )
}

/**
 * Simple version that just opens a search URL (no API call)
 * Use this if you don't have Apify configured
 */
export function BookViewingButtonSimple({
  address,
  postcode,
  className,
  variant = "default",
  size = "default",
}: Omit<BookViewingButtonProps, "bedrooms">) {
  const handleClick = () => {
    // Build search URL with address keywords for better results
    const addressKeyword = address.split(",")[0].trim()
    const searchUrl = `https://www.rightmove.co.uk/property-to-rent/search.html?searchLocation=${encodeURIComponent(postcode)}&keywords=${encodeURIComponent(addressKeyword)}`

    window.open(searchUrl, "_blank", "noopener,noreferrer")
  }

  return (
    <Button
      onClick={handleClick}
      variant={variant}
      size={size}
      className={className}
    >
      <ExternalLink className="mr-2 h-4 w-4" />
      Book Viewing
    </Button>
  )
}

/**
 * Book Viewing with Portal Choice
 * Lets user choose between Rightmove and Zoopla
 */
export function BookViewingButtonWithChoice({
  address,
  postcode,
  className,
}: Pick<BookViewingButtonProps, "address" | "postcode" | "className">) {
  const addressKeyword = address.split(",")[0].trim()

  const rightmoveUrl = `https://www.rightmove.co.uk/property-to-rent/search.html?searchLocation=${encodeURIComponent(postcode)}&keywords=${encodeURIComponent(addressKeyword)}`

  const zooplaUrl = `https://www.zoopla.co.uk/to-rent/property/${postcode.replace(/\s+/g, "-").toLowerCase()}/?q=${encodeURIComponent(addressKeyword)}`

  return (
    <div className={`flex gap-2 ${className}`}>
      <Button
        onClick={() => window.open(rightmoveUrl, "_blank", "noopener,noreferrer")}
        variant="default"
        size="sm"
      >
        Rightmove
      </Button>
      <Button
        onClick={() => window.open(zooplaUrl, "_blank", "noopener,noreferrer")}
        variant="outline"
        size="sm"
      >
        Zoopla
      </Button>
    </div>
  )
}
