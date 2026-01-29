"use client"

import * as React from "react"
import { Check, ChevronsUpDown, MapPin } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CITIES_BY_REGION, ALL_CITIES_OPTION, type UKCity } from "@/lib/data/uk-cities"

interface CitySearchAutocompleteProps {
  selectedCity: UKCity
  onCityChange: (city: UKCity) => void
}

export function CitySearchAutocomplete({
  selectedCity,
  onCityChange,
}: CitySearchAutocompleteProps) {
  const [open, setOpen] = React.useState(false)

  const regions = ["England", "Scotland", "Wales", "Northern Ireland"] as const

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
            {selectedCity.name === "All Cities" ? "All Cities (UK-wide)" : `${selectedCity.name}, UK`}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search cities..." />
          <CommandList>
            <CommandEmpty>No city found.</CommandEmpty>
            <CommandGroup heading="Show All">
              <CommandItem
                value="All Cities"
                onSelect={() => {
                  onCityChange(ALL_CITIES_OPTION)
                  setOpen(false)
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selectedCity.name === "All Cities"
                      ? "opacity-100"
                      : "opacity-0"
                  )}
                />
                All Cities (UK-wide)
              </CommandItem>
            </CommandGroup>
            {regions.map((region) => (
              <CommandGroup key={region} heading={region}>
                {CITIES_BY_REGION[region]?.map((city) => (
                  <CommandItem
                    key={city.name}
                    value={`${city.name} ${city.region}`}
                    onSelect={() => {
                      onCityChange(city)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedCity.name === city.name
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
