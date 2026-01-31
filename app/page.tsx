"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
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
  Info,
  PoundSterling,
  Percent,
  Target,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  LogOut,
  User,
  Home,
  X,
  ExternalLink,
  RotateCcw,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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
import type { Property, SavedProperty } from "@/lib/types/database"
import type { User } from "@supabase/supabase-js"
import { PropertyGallery } from "@/components/property-gallery"
import { FreshnessBadge } from "@/components/freshness-badge"
import { DEFAULT_CITY, ALL_CITIES_OPTION, type UKCity } from "@/lib/data/uk-cities"
import { LocationSearch, DEFAULT_LOCATION, type SearchLocation, cityToSearchLocation } from "@/components/location-search"
import { MainMapView } from "@/components/main-map-view"
import { EPCBadge } from "@/components/epc-badge"
import { Article4Warning } from "@/components/article4-warning"
import { OwnerInformationSection } from "@/components/owner-information-section"
import { PotentialHMOBadge } from "@/components/potential-hmo-badge"
import { PotentialHMODetailPanel } from "@/components/potential-hmo-detail-panel"
import { PremiumYieldCalculator } from "@/components/premium-yield-calculator"
import { FloorPlanBadge } from "@/components/floor-plan-badge"
import { FloorPlanSection } from "@/components/floor-plan-section"
import { BroadbandBadge } from "@/components/broadband-badge"
import { EpcFloorAreaBadge } from "@/components/epc-floor-area-badge"
import { PropertyDetailCard } from "@/components/property-detail-card"
import { PropertyAnalyticsCard } from "@/components/property-analytics-card"
import { DEFAULT_LICENCE_TYPES } from "@/lib/types/licences"
import { LicenceExpiryWarning } from "@/components/licence-expiry-warning"
import { useToast } from "@/hooks/use-toast"

export default function HMOHunterPage() {
  const [listingType, setListingType] = useState<"rent" | "purchase">("purchase")
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [savedProperties, setSavedProperties] = useState<SavedProperty[]>([])
  const [savedPropertyIds, setSavedPropertyIds] = useState<Set<string>>(new Set())

  const [showFullDetails, setShowFullDetails] = useState(false)

  const [selectedLocation, setSelectedLocation] = useState<SearchLocation>(DEFAULT_LOCATION)

  const [priceRange, setPriceRange] = useState([50000, 2000000])
  const priceRangeKey = priceRange.join(",")
  const [propertyTypes, setPropertyTypes] = useState<string[]>(["HMO", "Flat", "House", "Bungalow", "Studio", "Other"])
  const propertyTypesKey = propertyTypes.join(",")
  const [availableNow, setAvailableNow] = useState(false)
  const [studentFriendly, setStudentFriendly] = useState(false)
  const [petFriendly, setPetFriendly] = useState(false)
  const [furnished, setFurnished] = useState(false)
  const [licensedHmoOnly, setLicensedHmoOnly] = useState(false)
  const [minEpcRating, setMinEpcRating] = useState<"A" | "B" | "C" | "D" | "E" | null>(null)
  const [article4Filter, setArticle4Filter] = useState<"include" | "exclude" | "only">("include")
  const [licenceTypeFilter, setLicenceTypeFilter] = useState<string>("all")
  const [broadbandFilter, setBroadbandFilter] = useState<"all" | "fiber" | "superfast" | "any">("all")

  // Segment filter - main category tabs for clearer UX
  const [activeSegment, setActiveSegment] = useState<"all" | "licensed" | "expired" | "opportunities" | "restricted">("all")

  // Potential HMO filters - show all but highlight opportunities
  const [showPotentialHMOs, setShowPotentialHMOs] = useState(true)
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
  const [comparisonMetric, setComparisonMetric] = useState<"yield" | "rent" | "bedrooms">("yield")
  const [legendExpanded, setLegendExpanded] = useState(true)
  const [showPotentialHMOLayer, setShowPotentialHMOLayer] = useState(true)

  const [filterDebounceTimer, setFilterDebounceTimer] = useState<NodeJS.Timeout | null>(null)

  // Premium user status - check user metadata for subscription tier
  // TODO: Implement actual subscription system with Stripe or similar
  // For now, check user_metadata.is_premium flag (can be set via Supabase dashboard)
  const isPremiumUser = user?.user_metadata?.is_premium === true

  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  // Memoized callbacks for performance - prevents unnecessary re-renders
  const handleNavigateToLogin = useCallback(() => router.push("/auth/login"), [router])
  const handleNavigateToDashboard = useCallback(() => router.push("/user-dashboard"), [router])
  const handleNavigateToSaved = useCallback(() => router.push("/saved"), [router])
  const handleOpenLeftPanel = useCallback(() => setLeftPanelOpen(true), [])
  const handleCloseLeftPanel = useCallback(() => setLeftPanelOpen(false), [])
  const handleOpenRightPanel = useCallback(() => setRightPanelOpen(true), [])
  const handleCloseRightPanel = useCallback(() => setRightPanelOpen(false), [])
  const handleToggleSearch = useCallback(() => setSearchExpanded(prev => !prev), [])
  const handleToggleFilters = useCallback(() => setFiltersExpanded(prev => !prev), [])
  const handleToggleRecent = useCallback(() => setRecentExpanded(prev => !prev), [])
  const handleToggleLegend = useCallback(() => setLegendExpanded(prev => !prev), [])
  const handleClearSelection = useCallback(() => setSelectedProperty(null), [])
  const handleCloseFullDetails = useCallback(() => setShowFullDetails(false), [])
  const handleSelectProperty = useCallback((property: Property) => setSelectedProperty(property), [])

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
      setSavedPropertyIds(new Set(data.map((sp: SavedProperty) => sp.property.id)))
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
          city: selectedLocation.type === "city" ? selectedLocation.name : "All Cities",
          postcodePrefix: selectedLocation.type === "postcode" ? selectedLocation.postcode : undefined,
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
          hasFiber: broadbandFilter === "fiber" ? true : undefined,
          minBroadbandSpeed: broadbandFilter === "superfast" ? 30 : broadbandFilter === "any" ? 1 : undefined,
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
            toast({
              title: "Please wait",
              description: "Loading cached properties. Updates will appear shortly.",
              variant: "default",
            })
          } else {
            toast({
              title: "Error loading properties",
              description: "Please try again or refresh the page.",
              variant: "destructive",
            })
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
    selectedLocation,
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
    broadbandFilter,
  ])

  const handleSearch = async () => {
    setLoading(true)
    try {
      const data = await getProperties({
        listingType,
        minPrice: priceRange[0],
        maxPrice: priceRange[1],
        propertyTypes,
        city: selectedLocation.type === "city" ? selectedLocation.name : "All Cities",
        postcodePrefix: selectedLocation.type === "postcode" ? selectedLocation.postcode : undefined,
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
        hasFiber: broadbandFilter === "fiber" ? true : undefined,
        minBroadbandSpeed: broadbandFilter === "superfast" ? 30 : broadbandFilter === "any" ? 1 : undefined,
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

  const handleResetFilters = () => {
    setListingType("purchase")
    setPriceRange([50000, 2000000])
    setPropertyTypes(["HMO", "Flat", "House", "Bungalow", "Studio", "Other"])
    setSelectedCity(DEFAULT_CITY)
    setAvailableNow(false)
    setStudentFriendly(false)
    setPetFriendly(false)
    setFurnished(false)
    setLicensedHmoOnly(false)
    setMinEpcRating(null)
    setArticle4Filter("include")
    setLicenceTypeFilter("all")
    setBroadbandFilter("all")
    setShowPotentialHMOs(true)
    setHmoClassificationFilter(null)
    setFloorAreaBandFilter(null)
    setYieldBandFilter(null)
    setEpcBandFilter(null)
    setMinDealScore(0)
    setActiveSegment("all")
  }

  const getMonthlyRent = (p: Property): number => {
    if (p.price_pcm && p.price_pcm > 0) return p.price_pcm
    if (p.estimated_gross_monthly_rent && p.estimated_gross_monthly_rent > 0) return p.estimated_gross_monthly_rent
    if (p.estimated_rent_per_room && p.estimated_rent_per_room > 0) {
      const rooms = p.lettable_rooms || p.bedrooms || 1
      return p.estimated_rent_per_room * rooms
    }
    if (p.area_avg_rent && p.area_avg_rent > 0) return p.area_avg_rent
    return 0
  }

  const calculateAverageMetric = () => {
    if (properties.length === 0) return 0
    const total = properties.reduce((sum, p) => {
      if (listingType === "purchase") {
        return sum + getMonthlyRent(p)
      }
      const rent = getMonthlyRent(p)
      const rooms = p.bedrooms || 1
      return sum + rent / rooms
    }, 0)
    return Math.round(total / properties.length)
  }


  const calculateROI = (property: Property) => {
    if (property.rental_yield && property.rental_yield > 0) {
      return property.rental_yield.toFixed(1)
    }
    const rent = getMonthlyRent(property)
    const price = property.purchase_price || property.estimated_value || 0
    if (rent > 0 && price > 0) {
      const annualIncome = rent * 12
      const roi = (annualIncome / price) * 100
      return roi.toFixed(1)
    }
    return "N/A"
  }

  const getComparableProperties = (selected: Property): Property[] => {
    const scored = properties
      .filter((p) => p.id !== selected.id && p.listing_type === selected.listing_type)
      .map((p) => {
        let score = 0
        if (p.city && selected.city && p.city === selected.city) score += 3
        if (p.bedrooms === selected.bedrooms) score += 2
        else if (Math.abs(p.bedrooms - selected.bedrooms) === 1) score += 1
        if (selected.listing_type === "purchase") {
          const selPrice = selected.purchase_price || selected.estimated_value || 0
          const pPrice = p.purchase_price || p.estimated_value || 0
          if (selPrice > 0 && pPrice > 0) {
            const ratio = pPrice / selPrice
            if (ratio >= 0.8 && ratio <= 1.2) score += 2
            else if (ratio >= 0.6 && ratio <= 1.4) score += 1
          }
        } else {
          const selRent = getMonthlyRent(selected)
          const pRent = getMonthlyRent(p)
          if (selRent > 0 && pRent > 0) {
            const ratio = pRent / selRent
            if (ratio >= 0.8 && ratio <= 1.2) score += 2
            else if (ratio >= 0.6 && ratio <= 1.4) score += 1
          }
        }
        return { property: p, score }
      })
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, 3).map((s) => s.property)
  }

  const calculateAreaAverages = () => {
    if (properties.length === 0) return { avgYield: 0, avgDealScore: 0, avgBedrooms: 0, avgRentPerRoom: 0, minYield: 0, maxYield: 0 }
    let totalYield = 0, totalDealScore = 0, totalBedrooms = 0, totalRentPerRoom = 0
    let yieldCount = 0, dealScoreCount = 0
    let minYield = Infinity, maxYield = -Infinity
    for (const p of properties) {
      const y = parseFloat(calculateROI(p) as string)
      if (!isNaN(y)) {
        totalYield += y
        yieldCount++
        if (y < minYield) minYield = y
        if (y > maxYield) maxYield = y
      }
      if (p.deal_score != null) {
        totalDealScore += p.deal_score
        dealScoreCount++
      }
      totalBedrooms += p.bedrooms || 0
      const rent = getMonthlyRent(p)
      const rooms = p.bedrooms || 1
      totalRentPerRoom += rooms > 0 ? rent / rooms : 0
    }
    const n = properties.length
    return {
      avgYield: yieldCount > 0 ? totalYield / yieldCount : 0,
      avgDealScore: dealScoreCount > 0 ? totalDealScore / dealScoreCount : 0,
      avgBedrooms: n > 0 ? totalBedrooms / n : 0,
      avgRentPerRoom: n > 0 ? totalRentPerRoom / n : 0,
      minYield: minYield === Infinity ? 0 : minYield,
      maxYield: maxYield === -Infinity ? 0 : maxYield,
    }
  }

  // Calculate segment counts for the category tabs
  const segmentCounts = useMemo(() => {
    const counts = {
      all: properties.length,
      licensed: 0,
      expired: 0,
      opportunities: 0,
      restricted: 0,
    }

    for (const p of properties) {
      // Licensed HMOs with active licence
      if (p.licensed_hmo && p.licence_status !== "expired") {
        counts.licensed++
      }
      // Expired licence HMOs
      if (p.licence_status === "expired") {
        counts.expired++
      }
      // Opportunities - potential HMOs (ready_to_go or value_add)
      if (p.is_potential_hmo && (p.hmo_classification === "ready_to_go" || p.hmo_classification === "value_add")) {
        counts.opportunities++
      }
      // Restricted - Article 4 areas
      if (p.article_4_area) {
        counts.restricted++
      }
    }

    return counts
  }, [properties])

  // Filter properties based on active segment
  const segmentFilteredProperties = useMemo(() => {
    if (activeSegment === "all") return properties

    return properties.filter(p => {
      switch (activeSegment) {
        case "licensed":
          return p.licensed_hmo && p.licence_status !== "expired"
        case "expired":
          return p.licence_status === "expired"
        case "opportunities":
          return p.is_potential_hmo && (p.hmo_classification === "ready_to_go" || p.hmo_classification === "value_add")
        case "restricted":
          return p.article_4_area
        default:
          return true
      }
    })
  }, [properties, activeSegment])

  return (
    <div className="flex flex-col h-screen bg-slate-800">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-1.5 flex items-center justify-between">
        <div className="flex items-center">
          <img
            src="/hmo-hunter-logo.png"
            alt="HMO Hunter"
            className="h-14 w-auto"
          />
        </div>

        <nav className="flex items-center gap-8">
          <button className="text-slate-600 hover:text-slate-900 text-sm font-medium">Home</button>
          <button className="text-teal-600 hover:text-teal-700 text-sm font-medium">Properties</button>
          <button
            onClick={handleNavigateToDashboard}
            className="text-slate-600 hover:text-slate-900 text-sm font-medium"
          >
            Dashboard
          </button>
          <button
            onClick={handleNavigateToSaved}
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
          {/* Premium badge - shown when user has premium subscription */}
          {isPremiumUser && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
              <span className="text-xs font-bold text-amber-600">PRO</span>
            </div>
          )}

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
            <Button onClick={handleNavigateToLogin} className="bg-teal-600 hover:bg-teal-700 text-white">
              Sign in
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative" style={{ minHeight: 0 }}>
        {/* Left Sidebar Toggle Button */}
        {!leftPanelOpen && (
          <button
            onClick={handleOpenLeftPanel}
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
            onClick={handleCloseLeftPanel}
            className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
            title="Close filters"
          >
            <X className="w-4 h-4 text-slate-600" />
          </button>

          {/* Search Parameters */}
          <div className="p-4 border-b border-slate-200">
            <button
              onClick={handleToggleSearch}
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
                  <label className="text-xs font-medium text-slate-700 mb-2.5 block">
                    {listingType === "purchase" ? "Purchase Price" : "Monthly Rent"} (£{priceRange[0].toLocaleString()} - £{priceRange[1].toLocaleString()}{listingType === "rent" ? " pcm" : ""})
                  </label>
                  <div className="px-1">
                    <Slider
                      value={priceRange}
                      onValueChange={setPriceRange}
                      min={listingType === "purchase" ? 50000 : 500}
                      max={listingType === "purchase" ? 2000000 : 15000}
                      step={listingType === "purchase" ? 10000 : 100}
                      className="mb-3"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>£{priceRange[0].toLocaleString()}{listingType === "rent" ? " pcm" : ""}</span>
                    <span>£{priceRange[1].toLocaleString()}{listingType === "rent" ? " pcm" : ""}</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 mb-2 block">Property Type</label>
                  <Select
                    defaultValue="all"
                    onValueChange={(value) => {
                      if (value === "all") setPropertyTypes(["HMO", "Flat", "House", "Bungalow", "Studio", "Other"])
                      else if (value === "flat") setPropertyTypes(["Flat", "Studio"])
                      else if (value === "house") setPropertyTypes(["House", "Bungalow"])
                    }}
                  >
                    <SelectTrigger className="w-full bg-white border-teal-200 focus:border-teal-500 focus:ring-teal-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Property Types</SelectItem>
                      <SelectItem value="flat">Flats & Studios</SelectItem>
                      <SelectItem value="house">Houses & Bungalows</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 mb-2 block">Location</label>
                  <LocationSearch
                    selectedLocation={selectedLocation}
                    onLocationChange={setSelectedLocation}
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSearch} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white">
                    <Search className="w-4 h-4 mr-2" />
                    Search
                  </Button>
                  <Button
                    onClick={handleResetFilters}
                    variant="outline"
                    className="px-3 border-slate-300 hover:bg-slate-100"
                    title="Reset all filters"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Property Filters */}
          <div className="p-4 border-b border-slate-200">
            <button
              onClick={handleToggleFilters}
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
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">Licensed HMO Only</span>
                  <Switch
                    checked={licensedHmoOnly}
                    onCheckedChange={setLicensedHmoOnly}
                    className="data-[state=checked]:bg-teal-600"
                  />
                </div>

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

                {/* Broadband Filter */}
                <div>
                  <label className="text-xs font-medium text-slate-700 mb-2 block">Broadband</label>
                  <Select
                    value={broadbandFilter}
                    onValueChange={(value) => setBroadbandFilter(value as any)}
                  >
                    <SelectTrigger className="w-full bg-white border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Properties</SelectItem>
                      <SelectItem value="fiber">Full Fiber Only</SelectItem>
                      <SelectItem value="superfast">Superfast+ (30Mbps+)</SelectItem>
                      <SelectItem value="any">Any Broadband</SelectItem>
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
                      <SelectItem value="expired_licence">Expired Licence Only</SelectItem>
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

                {/* Acquisition Strategy - Advanced */}
                <div className="pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-700">Rent-to-Rent Mode</span>
                      <span className="text-xs text-slate-500">Show rental listings for R2R strategy</span>
                    </div>
                    <Switch
                      checked={listingType === "rent"}
                      onCheckedChange={(checked) => {
                        setListingType(checked ? "rent" : "purchase")
                        // Reset price range when switching
                        if (checked) {
                          setPriceRange([500, 15000])
                        } else {
                          setPriceRange([50000, 2000000])
                        }
                      }}
                      className="data-[state=checked]:bg-purple-600"
                    />
                  </div>
                  {listingType === "rent" && (
                    <div className="mt-2 bg-purple-50 border border-purple-200 rounded-lg p-2">
                      <p className="text-xs text-purple-700">
                        Showing rental listings. Lease properties and sublet as HMO rooms.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Recent Searches */}
          <div className="p-4 border-b border-slate-200">
            <button
              onClick={handleToggleRecent}
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
          {/* Segment Tabs - Category Filter */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-1.5 border border-slate-200">
            <button
              onClick={() => setActiveSegment("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeSegment === "all"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              All <span className="ml-1 opacity-70">{segmentCounts.all}</span>
            </button>
            <button
              onClick={() => setActiveSegment("licensed")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeSegment === "licensed"
                  ? "bg-teal-600 text-white shadow-sm"
                  : "text-teal-700 hover:bg-teal-50"
              }`}
            >
              Licensed <span className="ml-1 opacity-70">{segmentCounts.licensed}</span>
            </button>
            <button
              onClick={() => setActiveSegment("expired")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeSegment === "expired"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "text-amber-700 hover:bg-amber-50"
              }`}
            >
              Expired <span className="ml-1 opacity-70">{segmentCounts.expired}</span>
            </button>
            <button
              onClick={() => setActiveSegment("opportunities")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeSegment === "opportunities"
                  ? "bg-green-600 text-white shadow-sm"
                  : "text-green-700 hover:bg-green-50"
              }`}
            >
              Opportunities <span className="ml-1 opacity-70">{segmentCounts.opportunities}</span>
            </button>
            <button
              onClick={() => setActiveSegment("restricted")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeSegment === "restricted"
                  ? "bg-red-600 text-white shadow-sm"
                  : "text-red-600 hover:bg-red-50"
              }`}
            >
              Restricted <span className="ml-1 opacity-70">{segmentCounts.restricted}</span>
            </button>
          </div>

          {/* Property Count Indicator */}
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20">
            <div className="bg-slate-800/90 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full shadow-lg">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Loading...
                </span>
              ) : (
                <span>
                  Showing <span className="font-bold">{segmentFilteredProperties.length}</span> properties
                  {selectedLocation.name !== "All Cities" && <span className="opacity-70"> in {selectedLocation.name}</span>}
                </span>
              )}
            </div>
          </div>

          {/* MapLibre GL Map */}
          <MainMapView
            selectedCity={selectedLocation}
            properties={segmentFilteredProperties}
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
            <Card className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-full w-80 shadow-2xl bg-white border-slate-200 z-20">
              {/* Close button */}
              <button
                onClick={handleClearSelection}
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
              <div className="flex gap-3 p-4 cursor-pointer" onClick={handleOpenRightPanel}>
                <div className="w-20 h-20 bg-slate-200 rounded-lg flex-shrink-0 overflow-hidden">
                  <PropertyGallery
                    images={selectedProperty.images}
                    floorPlans={selectedProperty.floor_plans}
                    primaryImage={selectedProperty.primary_image}
                    fallbackImage={selectedProperty.image_url || "/modern-house-exterior.png"}
                    propertyTitle={selectedProperty.title}
                    latitude={selectedProperty.latitude}
                    longitude={selectedProperty.longitude}
                    postcode={selectedProperty.postcode}
                    address={selectedProperty.address}
                    bedrooms={selectedProperty.bedrooms}
                    listingType={selectedProperty.listing_type}
                    externalId={selectedProperty.external_id}
                    price={selectedProperty.listing_type === "rent" ? selectedProperty.price_pcm : selectedProperty.purchase_price}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-lg font-bold text-slate-900 mb-1">
                    {selectedProperty.listing_type === "purchase"
                      ? (selectedProperty.purchase_price ? `£${selectedProperty.purchase_price.toLocaleString()}` : "POA")
                      : (selectedProperty.price_pcm ? `£${selectedProperty.price_pcm.toLocaleString()} pcm` : "POA")}
                  </div>
                  <div className="text-sm text-slate-600 leading-snug truncate">
                    {selectedProperty.address}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {selectedProperty.postcode}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                      <BedDouble className="w-3 h-3" />
                      {selectedProperty.bedrooms}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                      <Bath className="w-3 h-3" />
                      {selectedProperty.bathrooms}
                    </span>
                    {selectedProperty.licensed_hmo && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-100 text-teal-700 rounded text-xs font-medium">
                        Licensed
                      </span>
                    )}
                    {selectedProperty.licence_status === "expired" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                        Expired
                      </span>
                    )}
                    <LicenceExpiryWarning property={selectedProperty} />
                    {selectedProperty.epc_rating && (
                      <EPCBadge
                        rating={selectedProperty.epc_rating}
                        numericRating={selectedProperty.epc_rating_numeric}
                        className="text-xs"
                        showTooltip={false}
                      />
                    )}
                  </div>
                </div>
              </div>
              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-center">
                <span className="text-xs text-slate-500">Click to view full details</span>
              </div>
            </Card>
          )}

          {/* Map legend - Reorganized by user intent */}
          <Card className="absolute bottom-8 left-6 shadow-xl bg-white border-slate-200 z-20 overflow-hidden max-w-[280px]">
            <button
              onClick={handleToggleLegend}
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
              <div className="px-4 pb-4 space-y-3">
                {/* READY TO OPERATE */}
                <div className="pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">Ready to Operate</span>
                    <span className="text-[10px] text-slate-400">Rent immediately</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-teal-700"></div>
                    <span className="text-xs text-slate-600">Licensed HMO</span>
                    <span className="text-[10px] text-teal-600 ml-auto">{segmentCounts.licensed}</span>
                  </div>
                </div>

                {/* REQUIRES ACTION */}
                <div className="pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Requires Action</span>
                    <span className="text-[10px] text-slate-400">Needs renewal</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-amber-500 border-2 border-amber-600"></div>
                    <span className="text-xs text-slate-600">Expired Licence</span>
                    <span className="text-[10px] text-amber-600 ml-auto">{segmentCounts.expired}</span>
                  </div>
                </div>

                {/* OPPORTUNITIES */}
                <div className="pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Opportunities</span>
                    <span className="text-[10px] text-slate-400">Conversion potential</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-green-600 border-2 border-green-700"></div>
                      <span className="text-xs text-slate-600">Ready to Go</span>
                      <span className="text-[10px] text-green-600 ml-auto">Minimal work</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-green-500"></div>
                      <span className="text-xs text-slate-600">Value-Add</span>
                      <span className="text-[10px] text-green-600 ml-auto">Some work</span>
                    </div>
                  </div>
                  <div className="mt-1.5 text-[10px] text-slate-400">
                    <span>{segmentCounts.opportunities} opportunities</span>
                    <span className="ml-2 text-slate-300">|</span>
                    <span className="ml-2">Larger = more contact info</span>
                  </div>
                </div>

                {/* RESTRICTIONS */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Restrictions</span>
                      <span className="text-[10px] text-slate-400">Planning required</span>
                    </div>
                    <Switch
                      checked={showArticle4Overlay}
                      onCheckedChange={setShowArticle4Overlay}
                      className="data-[state=checked]:bg-red-400 scale-75"
                    />
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-red-600 border-2 border-white shadow-sm"></div>
                    <span className="text-xs text-slate-600">Article 4 Area</span>
                    <span className="text-[10px] text-red-600 ml-auto">{segmentCounts.restricted}</span>
                  </div>
                  {showArticle4Overlay && (
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded bg-red-300/40 border-2 border-red-600"></div>
                      <span className="text-xs text-slate-500">Article 4 Zone overlay</span>
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
          <aside className="w-full md:w-[400px] fixed md:relative inset-0 md:inset-auto z-40 md:z-auto bg-white border-l border-slate-200 overflow-y-auto">
            {/* Close button */}
            <button
              onClick={handleCloseRightPanel}
              className="absolute top-3 right-3 z-10 p-2 md:p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
              title="Close panel"
              aria-label="Close property details"
            >
              <X className="w-5 h-5 md:w-4 md:h-4 text-slate-600" />
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
                      postcode={selectedProperty.postcode}
                      address={selectedProperty.address}
                      bedrooms={selectedProperty.bedrooms}
                      listingType={selectedProperty.listing_type}
                      externalId={selectedProperty.external_id}
                      price={selectedProperty.listing_type === "rent" ? selectedProperty.price_pcm : selectedProperty.purchase_price}
                    />
                    <SavePropertyButton
                      propertyId={selectedProperty.id}
                      initialSaved={savedPropertyIds.has(selectedProperty.id)}
                    />
                  </div>

                  {/* Property Detail Card */}
                  <PropertyDetailCard
                    property={selectedProperty}
                    onViewFullDetails={() => setShowFullDetails(true)}
                    isPremium={isPremiumUser}
                    isSaved={savedPropertyIds.has(selectedProperty.id)}
                  />
                </div>

                {/* Analytics & Comparison */}
                <div className="p-5 border-t border-slate-100">
                  <PropertyAnalyticsCard
                    property={selectedProperty}
                    properties={properties}
                    comparisonMetric={comparisonMetric}
                    onMetricChange={setComparisonMetric}
                    onPropertySelect={(p) => {
                      setSelectedProperty(p)
                      setShowFullDetails(false)
                    }}
                    calculateROI={calculateROI}
                    getMonthlyRent={getMonthlyRent}
                  />
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
            onClick={handleOpenRightPanel}
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
              <button onClick={handleCloseFullDetails} className="text-slate-400 hover:text-slate-600">
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
                  postcode={selectedProperty.postcode}
                  address={selectedProperty.address}
                  bedrooms={selectedProperty.bedrooms}
                  listingType={selectedProperty.listing_type}
                  externalId={selectedProperty.external_id}
                  price={selectedProperty.listing_type === "rent" ? selectedProperty.price_pcm : selectedProperty.purchase_price}
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
                    ? (selectedProperty.purchase_price ? `£${selectedProperty.purchase_price.toLocaleString()}` : "Price on application")
                    : (selectedProperty.price_pcm ? `£${selectedProperty.price_pcm.toLocaleString()} pcm` : "Price on application")}
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
                  {selectedProperty.licence_status === "expired" && !selectedProperty.licensed_hmo && (
                    <div className="col-span-2">
                      <div className="flex items-center gap-2 text-sm text-amber-600 font-medium">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Expired HMO Licence
                      </div>
                      {selectedProperty.licence_end_date && (
                        <div className="mt-1 ml-6 text-xs text-amber-700">
                          Licence Expired: {new Date(selectedProperty.licence_end_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                      )}
                      <div className="mt-2 ml-6 text-xs text-slate-600 bg-amber-50 p-2 rounded">
                        This property previously held an HMO licence that has now expired. Contact the owner for current licensing status.
                      </div>
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

              {/* EPC Certificate Section */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-slate-900 mb-3">EPC Certificate</h4>
                <div className="space-y-3">
                  {selectedProperty.epc_rating && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Energy Rating</span>
                      <EPCBadge
                        rating={selectedProperty.epc_rating}
                        numericRating={selectedProperty.epc_rating_numeric}
                      />
                    </div>
                  )}
                  {(selectedProperty.gross_internal_area_sqm || selectedProperty.floor_area_band) && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Floor Area</span>
                      <span className="text-sm font-bold text-slate-900">
                        {selectedProperty.gross_internal_area_sqm
                          ? `${Math.round(selectedProperty.gross_internal_area_sqm)}m² (${Math.round(selectedProperty.gross_internal_area_sqm * 10.764)} sq ft)`
                          : selectedProperty.floor_area_band === "120_plus" ? "120m²+"
                          : selectedProperty.floor_area_band === "90_120" ? "90-120m²"
                          : "<90m²"
                        }
                      </span>
                    </div>
                  )}
                  {selectedProperty.epc_expiry_date && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Certificate Expiry</span>
                      <span className={`text-sm font-medium ${new Date(selectedProperty.epc_expiry_date) < new Date() ? "text-red-600" : "text-slate-900"}`}>
                        {new Date(selectedProperty.epc_expiry_date).toLocaleDateString("en-GB")}
                      </span>
                    </div>
                  )}
                  {selectedProperty.epc_certificate_url && (
                    <a
                      href={selectedProperty.epc_certificate_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-2 text-sm text-blue-700 hover:text-blue-800 font-medium"
                    >
                      <FileText className="w-4 h-4" />
                      View Full EPC Certificate
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {!selectedProperty.epc_rating && !selectedProperty.epc_certificate_url && (
                    <p className="text-sm text-slate-500 italic">No EPC data available for this property</p>
                  )}
                </div>
              </div>

              {/* Planning Restrictions Section */}
              {(selectedProperty.article_4_area || selectedProperty.conservation_area) && (
                <div className="mb-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <h4 className="font-semibold text-slate-900 mb-3">Planning Restrictions</h4>
                  <div className="space-y-3">
                    {selectedProperty.article_4_area && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Article 4 Direction</span>
                        <Article4Warning
                          article4Area={selectedProperty.article_4_area}
                          conservationArea={selectedProperty.conservation_area}
                          listedBuildingGrade={selectedProperty.listed_building_grade}
                          planningConstraints={selectedProperty.planning_constraints}
                        />
                      </div>
                    )}
                    {selectedProperty.conservation_area && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Conservation Area</span>
                        <span className="text-sm font-medium text-amber-700">Yes</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Broadband & Connectivity */}
              <div className="mb-6 p-4 bg-slate-50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-3">Broadband & Connectivity</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Connection Type</span>
                    <BroadbandBadge
                      hasFiber={selectedProperty.has_fiber}
                      hasSuperfast={selectedProperty.has_superfast}
                      maxDownload={selectedProperty.broadband_max_down}
                      maxUpload={selectedProperty.broadband_max_up}
                      ultrafastDown={selectedProperty.broadband_ultrafast_down}
                      superfastDown={selectedProperty.broadband_superfast_down}
                      lastChecked={selectedProperty.broadband_last_checked}
                      showSpeed={true}
                    />
                  </div>
                  {selectedProperty.broadband_max_down && selectedProperty.broadband_max_down > 0 && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Max Download</span>
                        <span className="text-sm font-medium text-slate-900">
                          {selectedProperty.broadband_max_down >= 1000
                            ? `${(selectedProperty.broadband_max_down / 1000).toFixed(1)} Gbps`
                            : `${Math.round(selectedProperty.broadband_max_down)} Mbps`}
                        </span>
                      </div>
                      {selectedProperty.broadband_max_up && selectedProperty.broadband_max_up > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">Max Upload</span>
                          <span className="text-sm font-medium text-slate-900">
                            {selectedProperty.broadband_max_up >= 1000
                              ? `${(selectedProperty.broadband_max_up / 1000).toFixed(1)} Gbps`
                              : `${Math.round(selectedProperty.broadband_max_up)} Mbps`}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  {selectedProperty.has_fiber === false && selectedProperty.has_superfast === false && (
                    <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                      No fiber or superfast broadband available at this property. Only basic broadband.
                    </p>
                  )}
                  {selectedProperty.has_fiber === null && selectedProperty.has_superfast === null && (
                    <p className="text-xs text-slate-500 italic">
                      Broadband availability not yet checked for this property.
                    </p>
                  )}
                </div>
              </div>

              {/* Owner Information in Full Details - Always show */}
              <div className="mb-6">
                <h4 className="font-semibold text-slate-900 mb-3">Title Owner & Licence Holder</h4>
                <OwnerInformationSection property={selectedProperty} defaultOpen={true} />
              </div>

              {/* Yield Calculator - Premium feature */}
              <div className="mb-6">
                <PremiumYieldCalculator property={selectedProperty} isPremium={isPremiumUser} />
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
                <p className="text-sm text-slate-500 mb-3">Floor plan images from the property listing</p>
                <FloorPlanSection
                  floorPlans={selectedProperty.floor_plans}
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
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
