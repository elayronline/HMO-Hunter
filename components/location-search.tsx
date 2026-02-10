"use client"

import * as React from "react"
import { Check, ChevronsUpDown, MapPin, Search, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CITIES_BY_REGION, ALL_CITIES_OPTION, UK_CITIES, type UKCity } from "@/lib/data/uk-cities"

// Extended location type that includes postcode searches
export type SearchLocation = UKCity & {
  type: "city" | "postcode"
  postcode?: string
}

interface LocationSearchProps {
  selectedLocation: SearchLocation
  onLocationChange: (location: SearchLocation) => void
}

// Convert a city to SearchLocation
export function cityToSearchLocation(city: UKCity): SearchLocation {
  return { ...city, type: "city" }
}

// Default location (All Cities)
export const DEFAULT_LOCATION: SearchLocation = {
  ...ALL_CITIES_OPTION,
  type: "city"
}

// Validate UK postcode format
function isValidPostcodeFormat(input: string): boolean {
  // Match full or partial UK postcodes
  const postcodeRegex = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9]?[A-Z]{0,2}$/i
  return postcodeRegex.test(input.trim())
}

// Lookup postcode using postcodes.io (free API)
async function lookupPostcode(postcode: string): Promise<SearchLocation | null> {
  try {
    const cleanPostcode = postcode.trim().toUpperCase().replace(/\s+/g, "")

    // Try exact postcode first
    let response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(cleanPostcode)}`)

    if (!response.ok) {
      // Try partial/outcode lookup (e.g., "M14", "E1")
      response = await fetch(`https://api.postcodes.io/outcodes/${encodeURIComponent(cleanPostcode)}`)
    }

    if (!response.ok) {
      return null
    }

    const data = await response.json()

    if (data.status === 200 && data.result) {
      const result = data.result
      return {
        name: result.postcode || result.outcode,
        region: result.region || result.country || "England",
        latitude: result.latitude,
        longitude: result.longitude,
        zoom: result.postcode ? 15 : 13, // Zoom closer for full postcodes
        type: "postcode",
        postcode: result.postcode || result.outcode
      }
    }

    return null
  } catch (error) {
    console.error("[LocationSearch] Postcode lookup failed:", error)
    return null
  }
}

export function LocationSearch({
  selectedLocation,
  onLocationChange,
}: LocationSearchProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")
  const [isSearching, setIsSearching] = React.useState(false)
  const [postcodeResult, setPostcodeResult] = React.useState<SearchLocation | null>(null)
  const [searchError, setSearchError] = React.useState<string | null>(null)

  const regions = ["England", "Scotland", "Wales", "Northern Ireland"] as const

  // Debounced postcode search
  React.useEffect(() => {
    const trimmed = searchValue.trim()

    // Reset states
    setPostcodeResult(null)
    setSearchError(null)

    // Check if input looks like a postcode
    if (trimmed.length >= 2 && isValidPostcodeFormat(trimmed)) {
      setIsSearching(true)

      const timer = setTimeout(async () => {
        const result = await lookupPostcode(trimmed)
        setIsSearching(false)

        if (result) {
          setPostcodeResult(result)
        } else if (trimmed.length >= 3) {
          setSearchError("Postcode not found")
        }
      }, 300)

      return () => clearTimeout(timer)
    }

    setIsSearching(false)
  }, [searchValue])

  const handleSelectPostcode = () => {
    if (postcodeResult) {
      onLocationChange(postcodeResult)
      setOpen(false)
      setSearchValue("")
      setPostcodeResult(null)
    }
  }

  const displayName = React.useMemo(() => {
    if (selectedLocation.type === "postcode") {
      return `${selectedLocation.postcode} area`
    }
    if (selectedLocation.name === "All Cities") {
      return "All Cities (UK-wide)"
    }
    return `${selectedLocation.name}, UK`
  }, [selectedLocation])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-white border-teal-200 focus:border-teal-500 focus:ring-teal-500"
        >
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-teal-600" />
            {displayName}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(320px,calc(100vw-2rem))] p-0" align="start">
        <Command shouldFilter={true}>
          <CommandInput
            placeholder="Search city or enter postcode (e.g., M14, E1 6AN)..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            {/* Postcode search result */}
            {(isSearching || postcodeResult || searchError) && (
              <>
                <CommandGroup heading="Postcode Search">
                  {isSearching && (
                    <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Searching postcodes...
                    </div>
                  )}
                  {postcodeResult && !isSearching && (
                    <CommandItem
                      value={`postcode-${postcodeResult.postcode}`}
                      onSelect={handleSelectPostcode}
                      className="cursor-pointer"
                    >
                      <Search className="mr-2 h-4 w-4 text-teal-600" />
                      <div>
                        <div className="font-medium">{postcodeResult.postcode}</div>
                        <div className="text-xs text-muted-foreground">
                          {postcodeResult.region} - Click to search this area
                        </div>
                      </div>
                    </CommandItem>
                  )}
                  {searchError && !isSearching && (
                    <div className="px-2 py-3 text-sm text-muted-foreground">
                      {searchError}
                    </div>
                  )}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            <CommandEmpty>No city found. Try a UK postcode instead.</CommandEmpty>

            {/* All Cities option */}
            <CommandGroup heading="Show All">
              <CommandItem
                value="All Cities"
                onSelect={() => {
                  onLocationChange(DEFAULT_LOCATION)
                  setOpen(false)
                  setSearchValue("")
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selectedLocation.name === "All Cities" ? "opacity-100" : "opacity-0"
                  )}
                />
                All Cities (UK-wide)
              </CommandItem>
            </CommandGroup>

            {/* Cities by region */}
            {regions.map((region) => (
              <CommandGroup key={region} heading={region}>
                {CITIES_BY_REGION[region]?.map((city) => (
                  <CommandItem
                    key={city.name}
                    value={`${city.name} ${city.region}`}
                    onSelect={() => {
                      onLocationChange(cityToSearchLocation(city))
                      setOpen(false)
                      setSearchValue("")
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedLocation.name === city.name && selectedLocation.type === "city"
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {city.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
