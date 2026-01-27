"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Bell,
  ChevronDown,
  ChevronUp,
  Search,
  Plus,
  FileText,
  Clock,
  TrendingUp,
  BedDouble,
  Bath,
  Wifi,
  TrainFront,
  Heart,
  Trees,
  BarChart3,
  LogOut,
  User,
  Home,
  ShoppingCart,
  X,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getProperties } from "./actions/properties"
import { getSavedProperties } from "./actions/saved-properties"
import { SavePropertyButton } from "@/components/save-property-button"
import { createClient } from "@/lib/supabase/client"
import type { Property } from "@/lib/types/database"
import { PropertyGallery } from "@/components/property-gallery"
import { FreshnessBadge } from "@/components/freshness-badge"
import { BookViewingButton } from "@/components/book-viewing-button"
import { DEFAULT_CITY, type UKCity } from "@/lib/data/uk-cities"
import { CitySearchAutocomplete } from "@/components/city-search-autocomplete"
import { MainMapView } from "@/components/main-map-view"
import { EPCBadge } from "@/components/epc-badge"
import { Article4Warning } from "@/components/article4-warning"
import { OwnerInformationSection } from "@/components/owner-information-section"
import { PotentialHMOBadge } from "@/components/potential-hmo-badge"
import { PotentialHMODetailPanel } from "@/components/potential-hmo-detail-panel"
import { YieldCalculator } from "@/components/yield-calculator"
import { FloorPlanBadge } from "@/components/floor-plan-badge"
import { FloorPlanSection } from "@/components/floor-plan-section"
import { DEFAULT_LICENCE_TYPES } from "@/lib/types/licences"

export default function HMOHunterPage() {
  const [listingType, setListingType] = useState<"rent" | "purchase">("rent")
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [savedProperties, setSavedProperties] = useState<any[]>([])
  const [savedPropertyIds, setSavedPropertyIds] = useState<Set<string>>(new Set())

  const [showFullDetails, setShowFullDetails] = useState(false)

  const [selectedCity, setSelectedCity] = useState<UKCity>(DEFAULT_CITY)

  const [priceRange, setPriceRange] = useState([1000, 10000])
  const priceRangeKey = priceRange.join(",")
  const [propertyTypes, setPropertyTypes] = useState<string[]>(["HMO", "Flat", "House"])
  const propertyTypesKey = propertyTypes.join(",")
  const [availableNow, setAvailableNow] = useState(true)
  const [studentFriendly, setStudentFriendly] = useState(true)
  const [petFriendly, setPetFriendly] = useState(false)
  const [furnished, setFurnished] = useState(true)
  const [licensedHmoOnly, setLicensedHmoOnly] = useState(false)
  const [minEpcRating, setMinEpcRating] = useState<"A" | "B" | "C" | "D" | "E" | null>(null)
  const [article4Filter, setArticle4Filter] = useState<"include" | "exclude" | "only">("include")
  const [licenceTypeFilter, setLicenceTypeFilter] = useState<string>("all")

  // Potential HMO filters - show all but highlight opportunities
  const [showPotentialHMOs, setShowPotentialHMOs] = useState(false)
  const [hmoClassificationFilter, setHmoClassificationFilter] = useState<"ready_to_go" | "value_add" | null>(null)
  const [floorAreaBandFilter, setFloorAreaBandFilter] = useState<"under_90" | "90_120" | "120_plus" | null>(null)
  const [yieldBandFilter, setYieldBandFilter] = useState<"low" | "medium" | "high" | null>(null)
  const [epcBandFilter, setEpcBandFilter] = useState<"good" | "needs_upgrade" | null>(null)
  const [minDealScore, setMinDealScore] = useState<number>(0)

  const [searchExpanded, setSearchExpanded] = useState(true)
  const [filtersExpanded, setFiltersExpanded] = useState(true)
  const [recentExpanded, setRecentExpanded] = useState(false)
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(false)
  const [showArticle4Overlay, setShowArticle4Overlay] = useState(true)
  const [legendExpanded, setLegendExpanded] = useState(true)
  const [showPotentialHMOLayer, setShowPotentialHMOLayer] = useState(true)

  const [filterDebounceTimer, setFilterDebounceTimer] = useState<NodeJS.Timeout | null>(null)

  // Premium user status - TODO: Replace with actual subscription check
  // Set to true for development, false for production default
  const [isPremiumUser, setIsPremiumUser] = useState(true)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (listingType === "purchase") {
      setPriceRange([200000, 600000])
    } else {
      setPriceRange([1000, 10000])
    }
  }, [listingType])

  useEffect(() => {
    let mounted = true

    // Check auth status
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (mounted) {
        setUser(user)
        if (user) {
          fetchSavedProperties()
        }
      }
    }).catch((error) => {
      // Silently handle abort errors during unmount
      if (error.name !== 'AbortError') {
        console.error('Auth error:', error)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null)
        if (session?.user) {
          fetchSavedProperties()
        } else {
          setSavedProperties([])
          setSavedPropertyIds(new Set())
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function fetchSavedProperties() {
    const { data } = await getSavedProperties()
    if (data) {
      setSavedProperties(data)
      setSavedPropertyIds(new Set(data.map((sp: any) => sp.property.id)))
    }
  }

  useEffect(() => {
    async function fetchProperties() {
      setLoading(true)
      try {
        const data = await getProperties({
          listingType,
          minPrice: priceRange[0],
          maxPrice: priceRange[1],
          propertyTypes,
          city: selectedCity.name,
          availableNow,
          studentFriendly,
          petFriendly,
          furnished,
          licensedHmoOnly,
          minEpcRating,
          article4Filter,
          licenceTypeFilter: licenceTypeFilter !== "all" ? licenceTypeFilter : undefined,
          showPotentialHMOs,
          hmoClassification: hmoClassificationFilter,
          minDealScore: minDealScore > 0 ? minDealScore : undefined,
          floorAreaBand: floorAreaBandFilter,
          yieldBand: yieldBandFilter,
          epcBand: epcBandFilter,
        })
        setProperties(data)
        if (data.length > 0 && !selectedProperty) {
          setSelectedProperty(data[0])
        }
      } catch (error) {
        console.error("[v0] Failed to fetch properties:", error)
        if (error instanceof Error) {
          if (error.message.includes("Rate limit")) {
            // Show user-friendly message when rate limited
            console.log("[v0] Rate limited - showing cached properties")
            // Keep existing properties visible
          } else {
            console.log("[v0] Error loading properties:", error.message)
          }
        }
        // Don't clear existing properties on error - keep showing what we have
      } finally {
        setLoading(false)
      }
    }

    // Clear existing debounce timer
    if (filterDebounceTimer) {
      clearTimeout(filterDebounceTimer)
    }

    const timer = setTimeout(() => {
      fetchProperties()
    }, 500) // Wait 500ms after last filter change

    setFilterDebounceTimer(timer)

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [
    listingType,
    priceRangeKey,
    propertyTypesKey,
    selectedCity,
    availableNow,
    studentFriendly,
    petFriendly,
    furnished,
    licensedHmoOnly,
    minEpcRating,
    article4Filter,
    licenceTypeFilter,
    showPotentialHMOs,
    hmoClassificationFilter,
    minDealScore,
    floorAreaBandFilter,
    yieldBandFilter,
    epcBandFilter,
  ])

  const handleSearch = async () => {
    setLoading(true)
    try {
      const data = await getProperties({
        listingType,
        minPrice: priceRange[0],
        maxPrice: priceRange[1],
        propertyTypes,
        city: selectedCity.name,
        availableNow,
        studentFriendly,
        petFriendly,
        furnished,
        licensedHmoOnly,
        minEpcRating,
        article4Filter,
        licenceTypeFilter: licenceTypeFilter !== "all" ? licenceTypeFilter : undefined,
        showPotentialHMOs,
        hmoClassification: hmoClassificationFilter,
        minDealScore: minDealScore > 0 ? minDealScore : undefined,
        floorAreaBand: floorAreaBandFilter,
        yieldBand: yieldBandFilter,
        epcBand: epcBandFilter,
      })
      setProperties(data)
      if (data.length > 0) {
        setSelectedProperty(data[0])
      }
    } catch (error) {
      console.error("[v0] Failed to fetch properties:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  const calculateAveragePrice = () => {
    if (properties.length === 0) return 0
    const total = properties.reduce((sum, p) => {
      if (listingType === "purchase") {
        return sum + (p.purchase_price || 0)
      }
      return sum + (p.price_pcm || 0) / p.bedrooms
    }, 0)
    return Math.round(total / properties.length)
  }

  const calculatePropertyMix = () => {
    const total = properties.length
    if (total === 0) return { hmo: 0, other: 0 }
    const hmoCount = properties.filter((p) => p.property_type === "HMO").length
    return {
      hmo: Math.round((hmoCount / total) * 100),
      other: Math.round(((total - hmoCount) / total) * 100),
    }
  }

  const calculateROI = (property: Property) => {
    if (property.listing_type === "purchase" && property.purchase_price && property.estimated_rent_per_room) {
      const annualIncome = property.estimated_rent_per_room * property.bedrooms * 12
      const roi = (annualIncome / property.purchase_price) * 100
      return roi.toFixed(1)
    }
    return "N/A"
  }

  return (
    <div className="flex flex-col h-screen bg-slate-800">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative w-9 h-9">
            <div className="absolute inset-0 bg-teal-500 rounded-lg"></div>
            <svg
              className="absolute inset-0 w-9 h-9"
              viewBox="0 0 36 36"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M18 8L10 14V24H14V18H22V24H26V14L18 8Z"
                fill="white"
                stroke="white"
                strokeWidth="1"
                strokeLinejoin="round"
              />
              <circle cx="22" cy="22" r="8" fill="white" fillOpacity="0.3" />
              <path
                d="M22 18C20.34 18 19 19.34 19 21C19 22.66 20.34 24 22 24C23.66 24 25 22.66 25 21C25 19.34 23.66 18 22 18ZM22 22.5C21.17 22.5 20.5 21.83 20.5 21C20.5 20.17 21.17 19.5 22 19.5C22.83 19.5 23.5 20.17 23.5 21C23.5 21.83 22.83 22.5 22 22.5Z"
                fill="white"
              />
            </svg>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-slate-900">HMO</span>
            <span className="text-xl font-bold text-teal-600">Hunter</span>
          </div>
        </div>

        <nav className="flex items-center gap-8">
          <button className="text-slate-600 hover:text-slate-900 text-sm font-medium">Home</button>
          <button className="text-teal-600 hover:text-teal-700 text-sm font-medium">Properties</button>
          <button
            onClick={() => router.push("/user-dashboard")}
            className="text-slate-600 hover:text-slate-900 text-sm font-medium"
          >
            Dashboard
          </button>
          <button
            onClick={() => router.push("/saved")}
            className="text-slate-600 hover:text-slate-900 text-sm font-medium flex items-center gap-1.5"
          >
            <Heart className="w-4 h-4" />
            Saved
            {savedProperties.length > 0 && (
              <span className="bg-teal-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {savedProperties.length}
              </span>
            )}
          </button>
        </nav>

        <div className="flex items-center gap-3">
          {/* DEV: Premium Toggle - Remove in production */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg border border-slate-200">
            <span className="text-xs text-slate-600">Pro Mode:</span>
            <Switch
              checked={isPremiumUser}
              onCheckedChange={setIsPremiumUser}
              className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-amber-500 data-[state=checked]:to-orange-500 h-5 w-9"
            />
            {isPremiumUser && (
              <span className="text-xs font-bold text-amber-600">PRO</span>
            )}
          </div>

          <button className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <Bell className="w-5 h-5 text-slate-600" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-teal-500 rounded-full"></span>
          </button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 hover:bg-slate-100 rounded-lg p-1.5 transition-colors">
                  <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-teal-600" />
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-600" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium text-slate-900">{user.email}</p>
                  <p className="text-xs text-slate-500">Signed in</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={() => router.push("/auth/login")} className="bg-teal-600 hover:bg-teal-700 text-white">
              Sign in
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative" style={{ minHeight: 0 }}>
        {/* Left Sidebar Toggle Button */}
        {!leftPanelOpen && (
          <button
            onClick={() => setLeftPanelOpen(true)}
            className="absolute left-4 top-4 z-30 bg-white shadow-lg rounded-lg p-3 hover:bg-slate-50 transition-colors border border-slate-200"
            title="Open filters"
          >
            <Search className="w-5 h-5 text-teal-600" />
          </button>
        )}

        {/* Left Sidebar */}
        {leftPanelOpen && (
        <aside className="w-[280px] bg-white border-r border-slate-200 overflow-y-auto flex-shrink-0 relative">
          {/* Close button */}
          <button
            onClick={() => setLeftPanelOpen(false)}
            className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
            title="Close filters"
          >
            <X className="w-4 h-4 text-slate-600" />
          </button>

          {/* Search Parameters */}
          <div className="p-4 border-b border-slate-200">
            <button
              onClick={() => setSearchExpanded(!searchExpanded)}
              className="flex items-center justify-between w-full mb-4"
            >
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-teal-600" />
                <span className="font-semibold text-sm text-slate-900">Search Parameters</span>
              </div>
              {searchExpanded ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {searchExpanded && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-700 mb-2 block">Listing Type</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setListingType("rent")}
                      className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                        listingType === "rent"
                          ? "bg-teal-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      <Home className="w-4 h-4 inline mr-1.5" />
                      Rent
                    </button>
                    <button
                      onClick={() => setListingType("purchase")}
                      className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                        listingType === "purchase"
                          ? "bg-teal-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      <ShoppingCart className="w-4 h-4 inline mr-1.5" />
                      Purchase
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 mb-2.5 block">
                    {listingType === "purchase" ? "Purchase Price" : "Price Range"} (£
                    {priceRange[0].toLocaleString()} - £{priceRange[1].toLocaleString()}
                    {listingType === "rent" ? "pcm" : ""})
                  </label>
                  <div className="px-1">
                    <Slider
                      value={priceRange}
                      onValueChange={setPriceRange}
                      min={listingType === "purchase" ? 200000 : 1000}
                      max={listingType === "purchase" ? 600000 : 10000}
                      step={listingType === "purchase" ? 5000 : 100}
                      className="mb-3"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>£{priceRange[0].toLocaleString()}</span>
                    <span>
                      £{priceRange[1].toLocaleString()}
                      {listingType === "rent" ? "pcm" : ""}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 mb-2 block">Property Type</label>
                  <Select
                    defaultValue="hmo"
                    onValueChange={(value) => {
                      if (value === "hmo") setPropertyTypes(["HMO", "Flat", "House"])
                      else if (value === "flat") setPropertyTypes(["Flat"])
                      else if (value === "house") setPropertyTypes(["House"])
                    }}
                  >
                    <SelectTrigger className="w-full bg-white border-teal-200 focus:border-teal-500 focus:ring-teal-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hmo">HMO, Flat, House</SelectItem>
                      <SelectItem value="flat">Flat</SelectItem>
                      <SelectItem value="house">House</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 mb-2 block">Location</label>
                  <CitySearchAutocomplete
                    selectedCity={selectedCity}
                    onCityChange={setSelectedCity}
                  />
                </div>

                <Button onClick={handleSearch} className="w-full bg-teal-600 hover:bg-teal-700 text-white">
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
              </div>
            )}
          </div>

          {/* Property Filters */}
          <div className="p-4 border-b border-slate-200">
            <button
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className="flex items-center justify-between w-full mb-4"
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  />
                </svg>
                <span className="font-semibold text-sm text-slate-900">Property Filters</span>
              </div>
              {filtersExpanded ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {filtersExpanded && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">Available Now</span>
                  <Switch
                    checked={availableNow}
                    onCheckedChange={setAvailableNow}
                    className="data-[state=checked]:bg-teal-600"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">Student Friendly</span>
                  <Switch
                    checked={studentFriendly}
                    onCheckedChange={setStudentFriendly}
                    className="data-[state=checked]:bg-teal-600"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">Pet Friendly</span>
                  <Switch
                    checked={petFriendly}
                    onCheckedChange={setPetFriendly}
                    className="data-[state=checked]:bg-teal-600"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">Furnished</span>
                  <Switch
                    checked={furnished}
                    onCheckedChange={setFurnished}
                    className="data-[state=checked]:bg-teal-600"
                  />
                </div>
                {listingType === "purchase" && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">Licensed HMO Only</span>
                    <Switch
                      checked={licensedHmoOnly}
                      onCheckedChange={setLicensedHmoOnly}
                      className="data-[state=checked]:bg-teal-600"
                    />
                  </div>
                )}

                {/* EPC Rating Filter */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="text-xs font-medium text-slate-700 mb-2 block">Min EPC Rating</label>
                  <Select
                    value={minEpcRating || "any"}
                    onValueChange={(value) => setMinEpcRating(value === "any" ? null : value as any)}
                  >
                    <SelectTrigger className="w-full bg-white border-slate-200">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="A">A (Most Efficient)</SelectItem>
                      <SelectItem value="B">B or better</SelectItem>
                      <SelectItem value="C">C or better</SelectItem>
                      <SelectItem value="D">D or better</SelectItem>
                      <SelectItem value="E">E or better</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Article 4 Filter */}
                <div>
                  <label className="text-xs font-medium text-slate-700 mb-2 block">Article 4 Areas</label>
                  <Select
                    value={article4Filter}
                    onValueChange={(value) => setArticle4Filter(value as any)}
                  >
                    <SelectTrigger className="w-full bg-white border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="include">Include All</SelectItem>
                      <SelectItem value="exclude">Exclude Article 4</SelectItem>
                      <SelectItem value="only">Only Article 4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Licence Type Filter */}
                <div>
                  <label className="text-xs font-medium text-slate-700 mb-2 block">Licence Type</label>
                  <Select
                    value={licenceTypeFilter}
                    onValueChange={setLicenceTypeFilter}
                  >
                    <SelectTrigger className="w-full bg-white border-slate-200">
                      <SelectValue placeholder="All Licence Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Licence Types</SelectItem>
                      <SelectItem value="any_licensed">Any Licensed HMO</SelectItem>
                      <SelectItem value="unlicensed">Unlicensed Only</SelectItem>
                      <SelectItem value="---" disabled>───────────────</SelectItem>
                      {DEFAULT_LICENCE_TYPES.filter(t => t.is_active).map((type) => (
                        <SelectItem key={type.code} value={type.code}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Potential HMO Toggle - Pro Feature */}
                <div className="pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-700">Show Potential HMOs</span>
                      <span className="text-xs text-white bg-gradient-to-r from-amber-500 to-orange-500 px-1.5 py-0.5 rounded font-semibold">PRO</span>
                    </div>
                    {isPremiumUser ? (
                      <Switch
                        checked={showPotentialHMOs}
                        onCheckedChange={setShowPotentialHMOs}
                        className="data-[state=checked]:bg-amber-500"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Locked</span>
                        <div className="relative">
                          <Switch
                            checked={false}
                            disabled
                            className="opacity-50 cursor-not-allowed"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {!isPremiumUser && (
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-3 mb-3">
                      <p className="text-xs text-amber-800 mb-2">
                        Unlock HMO investment analysis with Pro
                      </p>
                      <Button
                        size="sm"
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs"
                      >
                        Upgrade to Pro
                      </Button>
                    </div>
                  )}

                  {showPotentialHMOs && isPremiumUser && (
                    <div className="space-y-3 pl-2 border-l-2 border-amber-200">
                      {/* HMO Classification */}
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1.5 block">Classification</label>
                        <Select
                          value={hmoClassificationFilter || "all"}
                          onValueChange={(value) => setHmoClassificationFilter(value === "all" ? null : value as any)}
                        >
                          <SelectTrigger className="w-full bg-white border-slate-200 h-8 text-xs">
                            <SelectValue placeholder="All Classifications" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Classifications</SelectItem>
                            <SelectItem value="ready_to_go">Ready to Go</SelectItem>
                            <SelectItem value="value_add">Value-Add</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Floor Area Band */}
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1.5 block">Floor Area</label>
                        <Select
                          value={floorAreaBandFilter || "all"}
                          onValueChange={(value) => setFloorAreaBandFilter(value === "all" ? null : value as any)}
                        >
                          <SelectTrigger className="w-full bg-white border-slate-200 h-8 text-xs">
                            <SelectValue placeholder="All Sizes" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Sizes</SelectItem>
                            <SelectItem value="under_90">Under 90 m²</SelectItem>
                            <SelectItem value="90_120">90-120 m²</SelectItem>
                            <SelectItem value="120_plus">120+ m²</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Yield Band */}
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1.5 block">Yield Band</label>
                        <Select
                          value={yieldBandFilter || "all"}
                          onValueChange={(value) => setYieldBandFilter(value === "all" ? null : value as any)}
                        >
                          <SelectTrigger className="w-full bg-white border-slate-200 h-8 text-xs">
                            <SelectValue placeholder="All Yields" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Yields</SelectItem>
                            <SelectItem value="high">High (8%+)</SelectItem>
                            <SelectItem value="medium">Medium (5-8%)</SelectItem>
                            <SelectItem value="low">Low (&lt;5%)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* EPC Band */}
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1.5 block">EPC Status</label>
                        <Select
                          value={epcBandFilter || "all"}
                          onValueChange={(value) => setEpcBandFilter(value === "all" ? null : value as any)}
                        >
                          <SelectTrigger className="w-full bg-white border-slate-200 h-8 text-xs">
                            <SelectValue placeholder="All EPC" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All EPC Status</SelectItem>
                            <SelectItem value="good">Compliant (C/D)</SelectItem>
                            <SelectItem value="needs_upgrade">Needs Upgrade (E/F/G)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Min Deal Score */}
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                          Min Deal Score: {minDealScore > 0 ? minDealScore : "Any"}
                        </label>
                        <Slider
                          value={[minDealScore]}
                          onValueChange={([value]) => setMinDealScore(value)}
                          min={0}
                          max={100}
                          step={5}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-slate-400 mt-1">
                          <span>0</span>
                          <span>100</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Recent Searches */}
          <div className="p-4 border-b border-slate-200">
            <button
              onClick={() => setRecentExpanded(!recentExpanded)}
              className="flex items-center justify-between w-full"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-teal-600" />
                <span className="font-semibold text-sm text-slate-900">Recent Searches</span>
              </div>
              {recentExpanded ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>
          </div>

        </aside>
        )}

        {/* Map Area */}
        <main className="flex-1 relative bg-slate-200 min-h-0 min-w-0" style={{ position: 'relative' }}>
          {/* MapLibre GL Map */}
          <MainMapView
            selectedCity={selectedCity}
            properties={properties}
            selectedProperty={selectedProperty}
            onPropertySelect={(property) => {
              setSelectedProperty(property)
              setRightPanelOpen(true)
            }}
            loading={loading}
            showArticle4Overlay={showArticle4Overlay}
            showPotentialHMOLayer={showPotentialHMOLayer}
          />

          {/* Selected Property Card Overlay */}
          {selectedProperty && (
            <Card className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-full w-72 shadow-2xl bg-white border-slate-200 z-20">
              {/* Close button */}
              <button
                onClick={() => setSelectedProperty(null)}
                className="absolute -top-2 -right-2 z-30 w-6 h-6 bg-slate-800 hover:bg-slate-700 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <div className="relative">
                <SavePropertyButton
                  propertyId={selectedProperty.id}
                  initialSaved={savedPropertyIds.has(selectedProperty.id)}
                />
              </div>
              <div className="flex gap-3 p-3 cursor-pointer" onClick={() => setRightPanelOpen(true)}>
                <div className="w-20 h-20 bg-slate-200 rounded flex-shrink-0 overflow-hidden">
                  <PropertyGallery
                    images={selectedProperty.images}
                    floorPlans={selectedProperty.floor_plans}
                    primaryImage={selectedProperty.primary_image}
                    fallbackImage={selectedProperty.image_url || "/modern-house-exterior.png"}
                    propertyTitle={selectedProperty.title}
                    latitude={selectedProperty.latitude}
                    longitude={selectedProperty.longitude}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-lg font-bold text-slate-900 mb-0.5">
                    {selectedProperty.listing_type === "purchase"
                      ? `£${selectedProperty.purchase_price?.toLocaleString()}`
                      : `£${selectedProperty.price_pcm?.toLocaleString()} pcm`}
                  </div>
                  <div className="text-xs text-slate-600 leading-relaxed">
                    {selectedProperty.address},
                    <br />
                    {selectedProperty.postcode}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <FreshnessBadge
                      lastSeenAt={selectedProperty.last_seen_at}
                      isStale={selectedProperty.is_stale}
                      className="text-xs"
                    />
                    {selectedProperty.is_potential_hmo && selectedProperty.hmo_classification && (
                      <PotentialHMOBadge
                        classification={selectedProperty.hmo_classification}
                        dealScore={selectedProperty.deal_score ?? undefined}
                        className="text-xs"
                        isPremium={isPremiumUser}
                      />
                    )}
                    {selectedProperty.epc_rating && (
                      <EPCBadge
                        rating={selectedProperty.epc_rating}
                        numericRating={selectedProperty.epc_rating_numeric}
                        className="text-xs"
                        showTooltip={false}
                      />
                    )}
                    {/* Contact availability indicator */}
                    {(selectedProperty.owner_contact_phone || selectedProperty.owner_contact_email) ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        Contact Available
                      </span>
                    ) : selectedProperty.company_name ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        Company Owner
                      </span>
                    ) : selectedProperty.owner_name ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Owner Known
                      </span>
                    ) : null}
                    {selectedProperty.article_4_area && (
                      <Article4Warning
                        article4Area={selectedProperty.article_4_area}
                        conservationArea={selectedProperty.conservation_area}
                        listedBuildingGrade={selectedProperty.listed_building_grade}
                        className="text-xs"
                      />
                    )}
                    <FloorPlanBadge
                      hasFloorPlanImages={!!(selectedProperty.floor_plans && selectedProperty.floor_plans.length > 0)}
                      hasEpcFloorPlan={!!selectedProperty.epc_certificate_url}
                      epcCertificateUrl={selectedProperty.epc_certificate_url}
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Map legend */}
          <Card className="absolute bottom-8 left-6 shadow-xl bg-white border-slate-200 z-20 overflow-hidden">
            <button
              onClick={() => setLegendExpanded(!legendExpanded)}
              className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors"
            >
              <span className="font-semibold text-sm text-slate-900">Map Legend</span>
              {legendExpanded ? (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              )}
            </button>
            {legendExpanded && (
              <div className="px-4 pb-4 space-y-2.5">
                {/* Green - Opportunities outside Article 4 */}
                <div className="pb-2.5 border-b border-slate-100">
                  <span className="text-xs font-semibold text-green-700 mb-2 block">Opportunities (Outside Article 4)</span>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-green-500 border-2 border-green-600 flex items-center justify-center">
                        <span className="text-[8px] text-white font-bold">85</span>
                      </div>
                      <span className="text-xs text-slate-700">Ready to Go HMO</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-green-400 border-2 border-green-500"></div>
                      <span className="text-xs text-slate-700">Value-Add HMO</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-green-500 border-[3px] border-green-600"></div>
                      <span className="text-xs text-slate-600">Potential HMO Opportunity</span>
                    </div>
                  </div>
                </div>

                {/* Teal - Standard properties */}
                <div className="space-y-1.5 pb-2.5 border-b border-slate-100">
                  <span className="text-xs font-medium text-teal-700">Standard Properties</span>
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-teal-700"></div>
                    <span className="text-xs text-slate-600">Licensed HMO</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-teal-500"></div>
                    <span className="text-xs text-slate-600">Standard Property</span>
                  </div>
                </div>

                {/* Red - Article 4 restricted */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-red-600">Article 4 Restricted</span>
                    <Switch
                      checked={showArticle4Overlay}
                      onCheckedChange={setShowArticle4Overlay}
                      className="data-[state=checked]:bg-red-400 scale-75"
                    />
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-red-600 border-[3px] border-white shadow-sm"></div>
                    <span className="text-xs text-slate-600">Property in Article 4</span>
                  </div>
                  {showArticle4Overlay && (
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded bg-red-300/40 border-2 border-red-600"></div>
                      <span className="text-xs text-slate-500">Article 4 Zone</span>
                    </div>
                  )}
                  {showArticle4Overlay && (
                    <div className="pt-1 mt-1 border-t border-slate-200">
                      <a
                        href="https://www.planning.data.gov.uk/dataset/article-4-direction-area"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-slate-400 hover:text-teal-600 transition-colors"
                      >
                        Data: planning.data.gov.uk
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Add Property button */}
          <Button className="absolute bottom-8 right-8 rounded-full h-14 px-6 bg-teal-600 hover:bg-teal-700 shadow-xl text-white font-medium z-20">
            <Plus className="w-5 h-5 mr-2" />
            Add Property
          </Button>
        </main>

        {/* Right Sidebar */}
        {rightPanelOpen && (
          <aside className="w-[360px] bg-white border-l border-slate-200 overflow-y-auto relative">
            {/* Close button */}
            <button
              onClick={() => setRightPanelOpen(false)}
              className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
              title="Close panel"
            >
              <X className="w-4 h-4 text-slate-600" />
            </button>
            {selectedProperty ? (
              <div>
                <div className="p-5 border-b border-slate-200">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-4 h-4 text-teal-600" />
                    <span className="font-semibold text-sm text-slate-900">Property Details</span>
                  </div>

                <div className="relative mb-4">
                  <PropertyGallery
                    images={selectedProperty.images}
                    floorPlans={selectedProperty.floor_plans}
                    primaryImage={selectedProperty.primary_image}
                    fallbackImage={selectedProperty.image_url || "/modern-house-exterior.png"}
                    propertyTitle={selectedProperty.title}
                    latitude={selectedProperty.latitude}
                    longitude={selectedProperty.longitude}
                  />
                  <SavePropertyButton
                    propertyId={selectedProperty.id}
                    initialSaved={savedPropertyIds.has(selectedProperty.id)}
                  />
                </div>

                {selectedProperty.source_url && (
                  <div className="mb-3 text-xs text-slate-500 italic">
                    Photos and floor plans sourced from the{" "}
                    <a
                      href={selectedProperty.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-600 hover:text-teal-700 underline"
                    >
                      original listing
                    </a>
                  </div>
                )}

                <div className="text-2xl font-bold text-teal-600 mb-4">
                  {selectedProperty.listing_type === "purchase"
                    ? `£${selectedProperty.purchase_price?.toLocaleString()}`
                    : `£${selectedProperty.price_pcm?.toLocaleString()} pcm`}
                </div>

                {selectedProperty.listing_type === "purchase" && (
                  <div className="mb-4 space-y-2 p-3 bg-teal-50 rounded-lg">
                    <div className="mb-2">
                      <FreshnessBadge lastSeenAt={selectedProperty.last_seen_at} isStale={selectedProperty.is_stale} />
                    </div>
                    {selectedProperty.tenure && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Tenure:</span>
                        <span className="text-slate-900 font-medium capitalize">{selectedProperty.tenure}</span>
                      </div>
                    )}
                    {selectedProperty.estimated_rent_per_room && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Est. Rent/Room:</span>
                        <span className="text-slate-900 font-medium">
                          £{selectedProperty.estimated_rent_per_room}/pcm
                        </span>
                      </div>
                    )}
                    {selectedProperty.licensed_hmo && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-teal-700">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Licensed HMO
                        </div>
                        {(selectedProperty.licence_start_date || selectedProperty.licence_end_date) && (
                          <div className="ml-6 text-xs text-slate-600 space-y-0.5">
                            {selectedProperty.licence_start_date && (
                              <div>Start: {new Date(selectedProperty.licence_start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
                            )}
                            {selectedProperty.licence_end_date && (
                              <div className={new Date(selectedProperty.licence_end_date) < new Date() ? "text-red-600" : ""}>
                                End: {new Date(selectedProperty.licence_end_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                {new Date(selectedProperty.licence_end_date) < new Date() && " (Expired)"}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {(selectedProperty.owner_contact_phone || selectedProperty.owner_contact_email) && (
                      <div className="flex items-center gap-2 text-sm text-emerald-700">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        Contact Available
                      </div>
                    )}
                    {selectedProperty.source_type && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Source:</span>
                        <span className="text-slate-900 font-medium">
                          {selectedProperty.source_type === "hmo_register" ? "HMO Register" : "Public Listing"}
                        </span>
                      </div>
                    )}
                    {selectedProperty.source_url && (
                      <div className="pt-2 border-t border-teal-200">
                        <a
                          href={selectedProperty.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-teal-700 hover:text-teal-800 flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                          View original listing
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Contact Available Banner for all listing types */}
                {(selectedProperty.owner_contact_phone || selectedProperty.owner_contact_email) &&
                  selectedProperty.listing_type !== "purchase" && (
                  <div className="mb-4 p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg">
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Owner Contact Available
                    </div>
                    <p className="text-xs text-emerald-600 mt-1">See Owner Information section below</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <BedDouble className="w-4 h-4 text-slate-600" />
                    <span className="text-sm text-slate-700">{selectedProperty.bedrooms} Beds</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Bath className="w-4 h-4 text-slate-600" />
                    <span className="text-sm text-slate-700">{selectedProperty.bathrooms} Baths</span>
                  </div>
                  {selectedProperty.wifi_included && (
                    <div className="flex items-center gap-2">
                      <Wifi className="w-4 h-4 text-slate-600" />
                      <span className="text-sm text-slate-700">WiFi Included</span>
                    </div>
                  )}
                  {selectedProperty.has_garden && (
                    <div className="flex items-center gap-2">
                      <Trees className="w-4 h-4 text-slate-600" />
                      <span className="text-sm text-slate-700">Garden</span>
                    </div>
                  )}
                  {selectedProperty.near_tube_station && (
                    <div className="flex items-center gap-2">
                      <TrainFront className="w-4 h-4 text-slate-600" />
                      <span className="text-sm text-slate-700">Near Tube Station</span>
                    </div>
                  )}
                </div>

                {/* EPC, Planning, and Floor Plan Badges */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedProperty.epc_rating && (
                    <EPCBadge
                      rating={selectedProperty.epc_rating}
                      numericRating={selectedProperty.epc_rating_numeric}
                      certificateUrl={selectedProperty.epc_certificate_url}
                      expiryDate={selectedProperty.epc_expiry_date}
                    />
                  )}
                  {selectedProperty.article_4_area && (
                    <Article4Warning
                      article4Area={selectedProperty.article_4_area}
                      conservationArea={selectedProperty.conservation_area}
                      listedBuildingGrade={selectedProperty.listed_building_grade}
                      planningConstraints={selectedProperty.planning_constraints}
                    />
                  )}
                  <FloorPlanBadge
                    hasFloorPlanImages={!!(selectedProperty.floor_plans && selectedProperty.floor_plans.length > 0)}
                    hasEpcFloorPlan={!!selectedProperty.epc_certificate_url}
                    epcCertificateUrl={selectedProperty.epc_certificate_url}
                    variant="full"
                  />
                </div>

                {/* Owner Information Section - Always show, component handles "no data" state */}
                <div className="mb-4">
                  <OwnerInformationSection property={selectedProperty} />
                </div>

                {/* Yield Calculator - Premium feature */}
                <div className="mb-4">
                  <YieldCalculator property={selectedProperty} isPremium={true} />
                </div>

                {/* Floor Plans Section */}
                <div className="mb-4">
                  <FloorPlanSection
                    floorPlans={selectedProperty.floor_plans}
                    epcCertificateUrl={selectedProperty.epc_certificate_url}
                    propertyTitle={selectedProperty.title}
                  />
                </div>

                {/* Potential HMO Analysis Section - Pro Feature */}
                {selectedProperty.is_potential_hmo && selectedProperty.hmo_classification && (
                  <div className="mb-4">
                    <PotentialHMODetailPanel property={selectedProperty} isPremium={isPremiumUser} />
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowFullDetails(true)}
                    className="flex-1 bg-white border border-teal-600 text-teal-600 hover:bg-teal-50"
                  >
                    View Full Details
                  </Button>
                  {selectedProperty.listing_type === "purchase" ? (
                    <Button className="flex-1 bg-teal-600 hover:bg-teal-700 text-white">
                      Contact Seller
                    </Button>
                  ) : (
                    <BookViewingButton
                      address={selectedProperty.address}
                      postcode={selectedProperty.postcode}
                      bedrooms={selectedProperty.bedrooms}
                      className="flex-1"
                    />
                  )}
                </div>
              </div>

              {/* Analytics & Comparison */}
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-teal-600" />
                  <span className="font-semibold text-sm text-slate-900">Analytics & Comparison</span>
                </div>

                <div className="flex gap-2 mb-4 border-b border-slate-200">
                  <button className="px-4 py-2 text-sm font-medium text-teal-600 border-b-2 border-teal-600">
                    {selectedProperty.listing_type === "purchase" ? "ROI Analysis" : "Price Per Room"}
                  </button>
                  <button className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">
                    Local Property Mix
                  </button>
                </div>

                <div className="flex gap-4 mb-6">
                  <div className="flex-1">
                    <div className="text-xs text-slate-600 mb-2">
                      {selectedProperty.listing_type === "purchase" ? "Est. Monthly Income" : "Price Per Room"}
                    </div>
                    <div className="h-32 flex items-end gap-8">
                      <div className="flex-1 flex flex-col items-center gap-2">
                        <div className="w-full bg-teal-600 rounded-t" style={{ height: "80%" }}></div>
                        <span className="text-xs text-slate-700">
                          {selectedProperty.listing_type === "purchase"
                            ? `£${((selectedProperty.estimated_rent_per_room || 0) * selectedProperty.bedrooms).toLocaleString()}`
                            : `£${Math.round((selectedProperty.price_pcm || 0) / selectedProperty.bedrooms)}`}
                        </span>
                        <span className="text-xs text-slate-500">Selected property</span>
                      </div>
                      <div className="flex-1 flex flex-col items-center gap-2">
                        <div className="w-full bg-slate-300 rounded-t" style={{ height: "70%" }}></div>
                        <span className="text-xs text-slate-700">£{calculateAveragePrice().toLocaleString()}</span>
                        <span className="text-xs text-slate-500">Area average</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="text-xs text-slate-600 mb-2">Local Property Mix</div>
                    <div className="relative w-32 h-32 mx-auto">
                      <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="20" />
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke="rgb(13 148 136)"
                          strokeWidth="20"
                          strokeDasharray="251.2"
                          strokeDashoffset={251.2 - (251.2 * calculatePropertyMix().hmo) / 100}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-lg font-bold text-slate-900">{calculatePropertyMix().hmo}%</div>
                          <div className="text-xs text-slate-500">HMO</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-teal-600"></div>
                        <span className="text-xs text-slate-600">HMO</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-slate-700 mb-3">Property Comparison</div>
                  <div className="grid grid-cols-4 gap-2">
                    {properties.slice(0, 3).map((prop, i) => (
                      <div key={prop.id} className="flex justify-center">
                        <div className="w-12 h-12 bg-slate-200 rounded overflow-hidden">
                          <img
                            src={prop.primary_image || prop.images?.[0] || `/house-${i + 1}.jpg`}
                            alt={`Property ${i + 1}`}
                            className="w-full h-full object-cover rounded"
                          />
                        </div>
                      </div>
                    ))}
                    <div className="text-xs text-slate-600 py-2">
                      {selectedProperty.listing_type === "purchase" ? "Price" : "Rent/Room"}
                    </div>
                    {properties.slice(0, 3).map((prop) => (
                      <div key={prop.id} className="text-xs font-medium text-slate-900 py-2 text-center">
                        £
                        {selectedProperty.listing_type === "purchase"
                          ? Math.round((prop.purchase_price || 0) / 1000) + "k"
                          : Math.round((prop.price_pcm || 0) / prop.bedrooms)}
                      </div>
                    ))}
                    <div className="text-xs text-slate-600 py-2 bg-slate-50">ROI</div>
                    {properties.slice(0, 3).map((prop) => (
                      <div key={prop.id} className="text-xs font-medium text-slate-900 py-2 text-center bg-slate-50">
                        {calculateROI(prop)}%
                      </div>
                    ))}
                    <div className="text-xs text-slate-600 py-2">Bedrooms</div>
                    {properties.slice(0, 3).map((prop) => (
                      <div key={prop.id} className="text-xs font-medium text-slate-900 py-2 text-center">
                        {prop.bedrooms}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8">
              <FileText className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm text-center">Select a property on the map to view details</p>
            </div>
          )}
        </aside>
        )}

        {/* Toggle button when panel is closed */}
        {!rightPanelOpen && (
          <button
            onClick={() => setRightPanelOpen(true)}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-30 bg-white shadow-lg rounded-l-lg p-3 hover:bg-slate-50 transition-colors border border-r-0 border-slate-200"
            title="Open property panel"
          >
            <ChevronDown className="w-5 h-5 text-slate-600 -rotate-90" />
          </button>
        )}
      </div>

      {showFullDetails && selectedProperty && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Full Property Details</h2>
              <button onClick={() => setShowFullDetails(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Property Gallery */}
              <div className="mb-6">
                <PropertyGallery
                  images={selectedProperty.images}
                  floorPlans={selectedProperty.floor_plans}
                  primaryImage={selectedProperty.primary_image}
                  fallbackImage={selectedProperty.image_url || "/modern-house-exterior.png"}
                  propertyTitle={selectedProperty.title}
                    latitude={selectedProperty.latitude}
                    longitude={selectedProperty.longitude}
                />
              </div>

              {/* Attribution */}
              {selectedProperty.source_url && (
                <div className="mb-4 text-sm text-slate-600 italic bg-slate-50 p-3 rounded">
                  Photos and floor plans sourced from the{" "}
                  <a
                    href={selectedProperty.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-600 hover:text-teal-700 underline font-medium"
                  >
                    original listing
                  </a>
                </div>
              )}

              {/* Price and Title */}
              <div className="mb-6">
                <div className="text-3xl font-bold text-teal-600 mb-2">
                  {selectedProperty.listing_type === "purchase"
                    ? `£${selectedProperty.purchase_price?.toLocaleString()}`
                    : `£${selectedProperty.price_pcm?.toLocaleString()} pcm`}
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">{selectedProperty.title}</h3>
                <p className="text-slate-600">
                  {selectedProperty.address}, {selectedProperty.postcode}
                </p>
              </div>

              {/* Purchase-specific info */}
              {selectedProperty.listing_type === "purchase" && (
                <div className="mb-6 grid grid-cols-2 gap-4 p-4 bg-teal-50 rounded-lg">
                  {selectedProperty.tenure && (
                    <div>
                      <div className="text-xs text-slate-600 mb-1">Tenure</div>
                      <div className="text-sm font-medium text-slate-900 capitalize">{selectedProperty.tenure}</div>
                    </div>
                  )}
                  {selectedProperty.estimated_rent_per_room && (
                    <div>
                      <div className="text-xs text-slate-600 mb-1">Est. Rent per Room</div>
                      <div className="text-sm font-medium text-slate-900">
                        £{selectedProperty.estimated_rent_per_room}/pcm
                      </div>
                    </div>
                  )}
                  {selectedProperty.licensed_hmo && (
                    <div className="col-span-2">
                      <div className="flex items-center gap-2 text-sm text-teal-700 font-medium">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Licensed HMO
                      </div>
                      {(selectedProperty.licence_start_date || selectedProperty.licence_end_date) && (
                        <div className="mt-1 ml-6 text-xs text-slate-600 space-y-0.5">
                          {selectedProperty.licence_start_date && (
                            <div>Licence Start: {new Date(selectedProperty.licence_start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
                          )}
                          {selectedProperty.licence_end_date && (
                            <div className={new Date(selectedProperty.licence_end_date) < new Date() ? "text-red-600 font-medium" : ""}>
                              Licence End: {new Date(selectedProperty.licence_end_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                              {new Date(selectedProperty.licence_end_date) < new Date() && " (Expired)"}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Property Features */}
              <div className="mb-6">
                <h4 className="font-semibold text-slate-900 mb-3">Property Features</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <BedDouble className="w-4 h-4 text-slate-600" />
                    {selectedProperty.bedrooms} Bedrooms
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Bath className="w-4 h-4 text-slate-600" />
                    {selectedProperty.bathrooms} Bathrooms
                  </div>
                  {selectedProperty.wifi_included && (
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <Wifi className="w-4 h-4 text-slate-600" />
                      WiFi Included
                    </div>
                  )}
                  {selectedProperty.has_garden && (
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <Trees className="w-4 h-4 text-slate-600" />
                      Garden
                    </div>
                  )}
                  {selectedProperty.near_tube_station && (
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <TrainFront className="w-4 h-4 text-slate-600" />
                      Near Tube Station
                    </div>
                  )}
                  {selectedProperty.is_furnished && (
                    <div className="flex items-center gap-2 text-sm text-slate-700">Furnished</div>
                  )}
                  {selectedProperty.is_student_friendly && (
                    <div className="flex items-center gap-2 text-sm text-slate-700">Student Friendly</div>
                  )}
                  {selectedProperty.is_pet_friendly && (
                    <div className="flex items-center gap-2 text-sm text-slate-700">Pet Friendly</div>
                  )}
                </div>
              </div>

              {/* EPC, Planning & Floor Plan Information */}
              <div className="mb-6 p-4 bg-slate-50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-3">Energy, Planning & Floor Plan</h4>
                <div className="space-y-3">
                  {selectedProperty.epc_rating && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">EPC Rating</span>
                      <EPCBadge
                        rating={selectedProperty.epc_rating}
                        numericRating={selectedProperty.epc_rating_numeric}
                        certificateUrl={selectedProperty.epc_certificate_url}
                        expiryDate={selectedProperty.epc_expiry_date}
                      />
                    </div>
                  )}
                  {selectedProperty.article_4_area && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Planning Restrictions</span>
                      <Article4Warning
                        article4Area={selectedProperty.article_4_area}
                        conservationArea={selectedProperty.conservation_area}
                        listedBuildingGrade={selectedProperty.listed_building_grade}
                        planningConstraints={selectedProperty.planning_constraints}
                      />
                    </div>
                  )}
                  {selectedProperty.conservation_area && !selectedProperty.article_4_area && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Conservation Area</span>
                      <span className="text-sm font-medium text-blue-600">Yes</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Floor Plan</span>
                    <FloorPlanBadge
                      hasFloorPlanImages={!!(selectedProperty.floor_plans && selectedProperty.floor_plans.length > 0)}
                      hasEpcFloorPlan={!!selectedProperty.epc_certificate_url}
                      epcCertificateUrl={selectedProperty.epc_certificate_url}
                      variant="full"
                    />
                  </div>
                </div>
              </div>

              {/* Owner Information in Full Details - Always show */}
              <div className="mb-6">
                <h4 className="font-semibold text-slate-900 mb-3">Title Owner & Licence Holder</h4>
                <OwnerInformationSection property={selectedProperty} defaultOpen={true} />
              </div>

              {/* Yield Calculator - Always show for all listings */}
              {/* Yield Calculator - Premium feature */}
              <div className="mb-6">
                <YieldCalculator property={selectedProperty} defaultOpen={true} isPremium={true} />
              </div>

              {/* Potential HMO Analysis in Full Details - Pro Feature */}
              {selectedProperty.is_potential_hmo && selectedProperty.hmo_classification && (
                <div className="mb-6">
                  <h4 className="font-semibold text-slate-900 mb-3">HMO Investment Analysis</h4>
                  <PotentialHMODetailPanel property={selectedProperty} defaultOpen={true} isPremium={isPremiumUser} />
                </div>
              )}

              {/* Description */}
              {selectedProperty.description && (
                <div className="mb-6">
                  <h4 className="font-semibold text-slate-900 mb-3">Description</h4>
                  <p className="text-slate-700 leading-relaxed">{selectedProperty.description}</p>
                </div>
              )}

              {/* Floor Plans Section */}
              <div className="mb-6">
                <h4 className="font-semibold text-slate-900 mb-3">Floor Plans</h4>
                <FloorPlanSection
                  floorPlans={selectedProperty.floor_plans}
                  epcCertificateUrl={selectedProperty.epc_certificate_url}
                  propertyTitle={selectedProperty.title}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <div className="flex-1">
                  <SavePropertyButton
                    propertyId={selectedProperty.id}
                    initialSaved={savedPropertyIds.has(selectedProperty.id)}
                  />
                </div>
                {selectedProperty.listing_type === "purchase" ? (
                  <Button className="flex-1 bg-teal-600 hover:bg-teal-700 text-white">
                    Contact Seller
                  </Button>
                ) : (
                  <BookViewingButton
                    address={selectedProperty.address}
                    postcode={selectedProperty.postcode}
                    bedrooms={selectedProperty.bedrooms}
                    className="flex-1"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
