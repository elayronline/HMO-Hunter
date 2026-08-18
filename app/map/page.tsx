"use client"

import { Suspense, useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
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
  Trees,
  BarChart3,
  Info,
  Percent,
  Target,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Home,
  Key,
  X,
  ExternalLink,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  LayoutGrid,
  Briefcase,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getProperties, getPropertyById } from "../actions/properties"
import { getSavedProperties } from "../actions/saved-properties"
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
import { FloorPlanBadge } from "@/components/floor-plan-badge"
import { FloorPlanSection } from "@/components/floor-plan-section"
import { BroadbandBadge } from "@/components/broadband-badge"
import { EpcFloorAreaBadge } from "@/components/epc-floor-area-badge"
import { PropertyDetailCard } from "@/components/property-detail-card"
import { PropertyAnalyticsCard } from "@/components/property-analytics-card"
import { LicenceExpiryWarning } from "@/components/licence-expiry-warning"
import { useToast } from "@/hooks/use-toast"
import { OnboardingWalkthrough } from "@/components/onboarding-walkthrough"
import { HelpCircle, SlidersHorizontal } from "lucide-react"
import { AppShell, ShellButton } from "@/components/app-shell"
import { Checkbox } from "@/components/ui/checkbox"
import { CurrentUsePanel } from "@/components/current-use-panel"
import {
  SOURCING_LABELS,
  sourcingCategory,
  SOURCING_DESCRIPTIONS,
  PRICE_SLIDER_MIN,
  PRICE_SLIDER_MAX,
  inSegment,
  type CategorisableProperty,
  type SourcingCategory,
} from "@/lib/properties/category"
import { SavedSearches, type SearchFilters } from "@/components/saved-searches"
import { countMarkerBuckets } from "@/lib/properties/marker-bucket"
import { ExportButton } from "@/components/export-button"
import { PropertyComparison, usePropertyComparison } from "@/components/property-comparison"
import { Map, List } from "lucide-react"
import { PropertyListView } from "@/components/property-list-view"
import { csrfFetch } from "@/lib/csrf-client"

export default function HMOHunterPage() {
  // useSearchParams needs a Suspense boundary to avoid opting the whole route
  // into client-side rendering — the same reason /hmo-check has one.
  //
  // Without it the boundary is missing from the tree React derives useId from,
  // and the server and client disagree about that tree: every generated id on
  // this page came out different on the two sides. React does not repair
  // attributes, so the Radix triggers in the filters panel kept a server-side
  // aria-controls pointing at an element id the client never creates. Visually
  // nothing was wrong, which is why it read as noise; to a screen reader the
  // control pointed at nothing.
  return (
    <Suspense fallback={null}>
      <MapPage />
    </Suspense>
  )
}

function MapPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Initialize state from URL params for persistence across navigation
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const skipNextAuthUpdate = useRef(false)
  const [savedProperties, setSavedProperties] = useState<SavedProperty[]>([])
  const [savedPropertyIds, setSavedPropertyIds] = useState<Set<string>>(new Set())

  const [showFullDetails, setShowFullDetails] = useState(false)

  const [selectedLocation, setSelectedLocation] = useState<SearchLocation>(DEFAULT_LOCATION)

  const [priceRange, setPriceRange] = useState([PRICE_SLIDER_MIN, PRICE_SLIDER_MAX])
  const [sourcingCategories, setSourcingCategories] = useState<SourcingCategory[]>([
    "existing_off_market",
    "for_sale_hmo",
    "change_of_use",
  ])
  const priceRangeKey = priceRange.join(",")
  const sourcingKey = sourcingCategories.join(",")
  const [minEpcRating, setMinEpcRating] = useState<"A" | "B" | "C" | "D" | "E" | null>(null)
  const [article4Filter, setArticle4Filter] = useState<
    "include" | "exclude" | "confirmed_clear" | "only"
  >("include")
  const [licenceTypeFilter, setLicenceTypeFilter] = useState<string>("all")
  const [broadbandFilter, setBroadbandFilter] = useState<"all" | "fiber" | "superfast" | "any">("all")
  const [ownerDataFilter, setOwnerDataFilter] = useState(false)

  // Licence expiry filter - premium feature (month range within a year)
  const [licenceExpiryEnabled, setLicenceExpiryEnabled] = useState(false)
  const [licenceExpiryMonthRange, setLicenceExpiryMonthRange] = useState<[number, number]>([1, 12]) // [startMonth, endMonth] 1-12
  const [licenceExpiryYear, setLicenceExpiryYear] = useState<number>(new Date().getFullYear())

  // Segment filter - main category tabs for clearer UX
  const [activeSegment, setActiveSegment] = useState<"all" | "licensed" | "expired" | "conversion" | "restricted">(() => {
    const param = searchParams.get("segment")
    if (param === "licensed" || param === "expired" || param === "conversion" || param === "restricted") return param
    return "all"
  })

  /*
   * "Show Potential HMOs" stood here, a PRO-badged switch that rendered
   * checked={false} beside the word "Locked" for free users while its state
   * was true and all 931 change-of-use properties were on screen. It also did
   * the same job as the "Potential change of use" sourcing checkbox — both
   * returned exactly 592 properties when turned off — so it was a second,
   * lying control for a filter that already had an honest one.
   *
   * Its nested sub-filters went with it, except the two that read something
   * anybody published:
   *   Classification  removed — derived from deal_score, which the product
   *                   removed in 5396d0f, and it reads a missing EPC as "D".
   *   Yield Band      removed — a band over estimated_yield_percentage, which
   *                   comes from the city-average room rent.
   *   Floor Area      kept, but matched against the measured area rather than
   *                   the stored band; the band is guessed from bedroom count
   *                   on the ~353 rows with no measurement.
   *   EPC Status      kept — epc_rating is observed.
   */
  const [floorAreaBandFilter, setFloorAreaBandFilter] = useState<"under_90" | "90_120" | "120_plus" | null>(null)
  const [epcBandFilter, setEpcBandFilter] = useState<"good" | "needs_upgrade" | null>(null)

  // Phase 6 - TA Sourcing filters
  const [minBedrooms, setMinBedrooms] = useState<number>(0)
  const [minBathrooms, setMinBathrooms] = useState<number>(0)
  const [isFurnished, setIsFurnished] = useState(false)
  const [hasParking, setHasParking] = useState(false)

  // Role selection modal state

  const [searchExpanded, setSearchExpanded] = useState(true)
  const [filtersExpanded, setFiltersExpanded] = useState(true)
  const [advancedFiltersExpanded, setAdvancedFiltersExpanded] = useState(false)
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(false)
  const [showArticle4Overlay, setShowArticle4Overlay] = useState(true)
  const [comparisonMetric, setComparisonMetric] = useState<"yield" | "rent" | "bedrooms">("yield")
  const [legendExpanded, setLegendExpanded] = useState(true)
  const [showPotentialHMOLayer, setShowPotentialHMOLayer] = useState(true)

  const filterDebounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Onboarding walkthrough state
  const [showWalkthrough, setShowWalkthrough] = useState(false)
  const [viewMode, setViewMode] = useState<"map" | "list">(() => {
    const param = searchParams.get("view")
    return param === "list" ? "list" : "map"
  })

  // Property comparison hook
  const {
    compareList,
    addToCompare,
    removeFromCompare,
    clearCompare,
    isInCompare,
    canAddMore,
  } = usePropertyComparison(3)

  // Premium user status - check user metadata for subscription tier
  // TODO: Implement actual subscription system with Stripe or similar
  // For now, check user_metadata.is_premium flag (can be set via Supabase dashboard)
  const isPremiumUser = user?.user_metadata?.is_premium === true

  const supabase = createClient()
  const { toast } = useToast()

  // Check for demo mode via URL parameter
  const isDemoMode = searchParams.get('demo') === 'true'

  // Sync key filter state to URL for persistence across navigation
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    const params = new URLSearchParams(searchParams.toString())
    if (viewMode !== "map") params.set("view", viewMode); else params.delete("view")
    params.delete("type")
    if (activeSegment !== "all") params.set("segment", activeSegment); else params.delete("segment")
    const newUrl = params.toString() ? `?${params.toString()}` : "/map"
    router.replace(newUrl, { scroll: false })
  }, [viewMode, activeSegment])

  // Memoized callbacks for performance - prevents unnecessary re-renders
  const handleOpenLeftPanel = useCallback(() => {
    setRightPanelOpen(false) // close right panel on mobile to avoid z-index conflict
    setLeftPanelOpen(true)
  }, [])
  const handleCloseLeftPanel = useCallback(() => setLeftPanelOpen(false), [])
  const handleOpenRightPanel = useCallback(() => {
    setLeftPanelOpen(false) // close left panel on mobile to avoid z-index conflict
    setRightPanelOpen(true)
  }, [])
  const handleCloseRightPanel = useCallback(() => setRightPanelOpen(false), [])
  const handleToggleSearch = useCallback(() => setSearchExpanded(prev => !prev), [])
  const handleToggleFilters = useCallback(() => setFiltersExpanded(prev => !prev), [])
  const handleToggleLegend = useCallback(() => setLegendExpanded(prev => !prev), [])
  const handleClearSelection = useCallback(() => setSelectedProperty(null), [])
  const handleCloseFullDetails = useCallback(() => setShowFullDetails(false), [])

  // Escape key handler, body scroll lock, and focus trap for full details modal
  const previousFocusRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showFullDetails) handleCloseFullDetails()
    }
    if (showFullDetails) {
      previousFocusRef.current = document.activeElement as HTMLElement
      document.body.style.overflow = 'hidden'
      // Focus the modal dialog after render
      requestAnimationFrame(() => {
        const dialog = document.querySelector('[role="dialog"]') as HTMLElement
        if (dialog) dialog.focus()
      })
    } else {
      document.body.style.overflow = ''
      // Restore focus to the element that opened the modal
      if (previousFocusRef.current) {
        previousFocusRef.current.focus()
        previousFocusRef.current = null
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => {
      window.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [showFullDetails, handleCloseFullDetails])

  // Focus trap: keep Tab within modal when open
  useEffect(() => {
    if (!showFullDetails) return
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const dialog = document.querySelector('[role="dialog"]') as HTMLElement
      if (!dialog) return
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleTab)
    return () => window.removeEventListener('keydown', handleTab)
  }, [showFullDetails])

  // Track property view and deduct credits if needed
  const trackPropertyView = useCallback(async (propertyId: string) => {
    if (!user) return // Don't track for non-logged-in users

    try {
      const response = await csrfFetch('/api/track-property-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId })
      })

      const data = await response.json()

      if (!response.ok && data.insufficientCredits) {
        toast({
          title: "Daily Limit Reached",
          description: "You've used all your property views for today. Resets at midnight UTC.",
          variant: "destructive"
        })
      } else if (data.warning) {
        toast({
          title: "Credits Running Low",
          description: data.warning,
        })
      } else if (data.freeViewUsed && data.freeViewsRemaining !== undefined && data.freeViewsRemaining <= 5 && data.freeViewsRemaining > 0) {
        toast({
          title: "Free Views Running Low",
          description: `${data.freeViewsRemaining} free property views remaining today`,
        })
      }
      // Notify credit balance to refresh
      window.dispatchEvent(new Event("credits-changed"))
    } catch (error) {
      // Silently fail - don't block property viewing
    }
  }, [user, toast])

  const handleSelectProperty = useCallback((property: Property) => {
    setSelectedProperty(property)
    trackPropertyView(property.id)
  }, [trackPropertyView])

  // Show walkthrough immediately in demo mode
  useEffect(() => {
    if (isDemoMode) {
      setShowWalkthrough(true)
    }
  }, [isDemoMode])

  // Handle property query parameter - open property details panel when navigating from saved properties
  useEffect(() => {
    const propertyId = searchParams.get('property')
    if (!propertyId) return

    async function openPropertyFromUrl() {
      // First try to find in current properties list
      let property = properties.find(p => p.id === propertyId)

      // If not found in current list, fetch directly by ID
      if (!property) {
        try {
          property = await getPropertyById(propertyId!) ?? undefined
        } catch (error) {
          // silently ignore
        }
      }

      if (property) {
        setSelectedProperty(property)
        setRightPanelOpen(true)
      }
      // Always clear the URL parameter to prevent repeated failed lookups
      window.history.replaceState({}, '', '/')
    }

    openPropertyFromUrl()
  }, [searchParams, properties])

  useEffect(() => {
    let mounted = true

    // Check auth status
    supabase.auth.getUser().then(({ data: { user: authUser } }: { data: { user: User | null } }) => {
      if (mounted) {
        setUser(authUser)
        if (authUser) {
          fetchSavedProperties()
          if (!authUser.user_metadata?.onboarding_completed || isDemoMode) {
            setShowWalkthrough(true)
          }
        }
      }
    }).catch((error: Error) => {
      // Silently handle abort errors during unmount
      if (error.name !== 'AbortError') {
        // silently ignore non-abort auth errors
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: { user: User | null } | null) => {
      if (mounted) {
        // Skip if a local user update just happened (e.g. role change)
        if (skipNextAuthUpdate.current) {
          skipNextAuthUpdate.current = false
          return
        }
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
    if (data && Array.isArray(data)) {
      // Transform Supabase response to match SavedProperty type
      const transformed: SavedProperty[] = data.map((item: { id: string; notes: string | null; created_at: string; property: Property | Property[] }) => ({
        id: item.id,
        notes: item.notes,
        created_at: item.created_at,
        property: Array.isArray(item.property) ? item.property[0] : item.property,
      })).filter((sp: SavedProperty) => sp.property)

      setSavedProperties(transformed)
      setSavedPropertyIds(new Set(transformed.map((sp: SavedProperty) => sp.property.id)))
    }
  }

  /**
   * The filters as they stand, in one place.
   *
   * There were two of these — one in the fetch effect, one in the Search
   * button — and they had drifted. The button's copy was missing the four
   * property-requirement filters, so pressing Search with "Min Bedrooms 6+"
   * set went from 516 properties to 1,523 while the panel still read "6+".
   * A single reader cannot drift from itself, which is the point of it.
   *
   * Anything added here must also be added to the effect's dependency list
   * below, or a change to it will not trigger a refetch.
   */
  function currentFilters() {
    return {
      minPrice: priceRange[0],
      maxPrice: priceRange[1],
      sourcingCategories,
      city: selectedLocation.type === "city" ? selectedLocation.name : "All Cities",
      postcodePrefix: selectedLocation.type === "postcode" ? selectedLocation.postcode : undefined,
      minEpcRating,
      article4Filter,
      licenceTypeFilter: licenceTypeFilter !== "all" ? licenceTypeFilter : undefined,
      floorAreaBand: floorAreaBandFilter,
      epcBand: epcBandFilter,
      hasFiber: broadbandFilter === "fiber" ? true : undefined,
      minBroadbandSpeed: broadbandFilter === "superfast" ? 30 : broadbandFilter === "any" ? 1 : undefined,
      hasOwnerData: ownerDataFilter || undefined,
      licenceExpiryStartMonth: licenceExpiryEnabled ? licenceExpiryMonthRange[0] : undefined,
      licenceExpiryEndMonth: licenceExpiryEnabled ? licenceExpiryMonthRange[1] : undefined,
      licenceExpiryYear: licenceExpiryEnabled ? licenceExpiryYear : undefined,
      minBedrooms: minBedrooms > 0 ? minBedrooms : undefined,
      minBathrooms: minBathrooms > 0 ? minBathrooms : undefined,
      isFurnished: isFurnished || undefined,
      hasParking: hasParking || undefined,
    }
  }

  useEffect(() => {
    async function fetchProperties() {
      setLoading(true)
      try {
        const data = await getProperties(currentFilters())
        setProperties(data)
      } catch (error) {
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
    if (filterDebounceTimerRef.current) {
      clearTimeout(filterDebounceTimerRef.current)
    }

    const timer = setTimeout(() => {
      fetchProperties()
    }, 500) // Wait 500ms after last filter change

    filterDebounceTimerRef.current = timer

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [
    priceRangeKey,
    sourcingKey,
    selectedLocation,
    minEpcRating,
    article4Filter,
    licenceTypeFilter,
    floorAreaBandFilter,
    epcBandFilter,
    broadbandFilter,
    ownerDataFilter,
    licenceExpiryEnabled,
    licenceExpiryMonthRange[0],
    licenceExpiryMonthRange[1],
    licenceExpiryYear,
    minBedrooms,
    minBathrooms,
    isFurnished,
    hasParking,
  ])

  /**
   * The Search button. Filters already refetch on change, so this only skips
   * the debounce — it must never apply a different set from the one the panel
   * is showing, which is why it reads the same currentFilters().
   */
  const handleSearch = async () => {
    setLoading(true)
    try {
      setProperties(await getProperties(currentFilters()))
    } catch {
      toast({
        title: "Error loading properties",
        description: "Please try again or refresh the page.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleResetFilters = () => {
    setPriceRange([PRICE_SLIDER_MIN, PRICE_SLIDER_MAX])
    setSourcingCategories(["existing_off_market", "for_sale_hmo", "change_of_use"])
    setSelectedLocation(DEFAULT_LOCATION)
    setMinEpcRating(null)
    setArticle4Filter("include")
    setLicenceTypeFilter("all")
    setBroadbandFilter("all")
    setFloorAreaBandFilter(null)
    setEpcBandFilter(null)
    setActiveSegment("all")
    setLicenceExpiryEnabled(false)
    setLicenceExpiryMonthRange([1, 12])
    setLicenceExpiryYear(new Date().getFullYear())
    setMinBedrooms(0)
    setMinBathrooms(0)
    setIsFurnished(false)
    setHasParking(false)
    setOwnerDataFilter(false)
    setAdvancedFiltersExpanded(false)
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

  // How much of the current result set carries an unverified Article 4 status.
  // Surfaced in the filter panel so the uncertainty is stated rather than left
  // for the user to infer from an absent badge.
  const article4UnknownCount = useMemo(
    () => properties.filter((p) => p.article_4_status === "unknown").length,
    [properties]
  )

  const calculateAverageMetric = () => {
    if (properties.length === 0) return 0
    const total = properties.reduce((sum, p) => {
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

  // Segment membership comes from inSegment() in lib/properties/category.ts so
  // the tabs, the counts and the export all answer it the same way.
  const segmentCounts = useMemo(() => {
    const counts = {
      all: properties.length,
      licensed: 0,
      expired: 0,
      conversion: 0,
      restricted: 0,
    }
    for (const p of properties) {
      const c = p as CategorisableProperty & { article_4_area?: boolean | null }
      if (inSegment(c, "licensed")) counts.licensed++
      if (inSegment(c, "expired")) counts.expired++
      if (inSegment(c, "conversion")) counts.conversion++
      if (inSegment(c, "restricted")) counts.restricted++
    }
    return counts
  }, [properties])

  // Filter properties based on active segment
  const segmentFilteredProperties = useMemo(() => {
    if (activeSegment === "all") return properties
    return properties.filter((p) =>
      inSegment(p as CategorisableProperty & { article_4_area?: boolean | null }, activeSegment)
    )
  }, [properties, activeSegment])

  const displayProperties = segmentFilteredProperties

  // The legend counts markers, not segments. The tabs above the map count
  // segments, and a property can sit in more than one of those — which is
  // exactly how the legend came to advertise a teal swatch that nothing on the
  // map could render. See lib/properties/marker-bucket.ts.
  const markerCounts = useMemo(
    () => countMarkerBuckets(displayProperties, showPotentialHMOLayer),
    [displayProperties, showPotentialHMOLayer]
  )

  return (
    <AppShell
      title="Map"
      /* Nothing is counted until the load finishes: "0 of 0" would read as a
         result, and an empty set is not a fact about the data yet. */
      subtitle={
        loading
          ? undefined
          : `${displayProperties.length.toLocaleString()} of ${properties.length.toLocaleString()} properties shown`
      }
      counts={{ saved: savedProperties.length }}
      bleed
      actions={
        /* The filters live in a panel this page owns, so opening it is a page
           action rather than navigation. On desktop the floating control inside
           the map already does this, which is why this one is mobile-only. */
        !leftPanelOpen ? (
          <span className="md:hidden">
            <ShellButton onClick={handleOpenLeftPanel}>
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </ShellButton>
          </span>
        ) : undefined
      }
    >
    <div className="flex flex-col h-full bg-slate-800">
      <a
        href="#map-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-teal-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        Skip to map
      </a>
      <div className="flex flex-1 overflow-hidden relative" style={{ minHeight: 0 }}>
        {/* Left Sidebar Toggle Button - Desktop only, map view only */}
        {!leftPanelOpen && viewMode === "map" && (
          <button
            onClick={handleOpenLeftPanel}
            className="hidden md:block absolute left-4 top-4 z-30 bg-white shadow-lg rounded-lg p-3 hover:bg-slate-50 transition-colors border border-slate-200"
            title="Open filters"
            aria-label="Open filters"
          >
            <Search className="w-5 h-5 text-teal-600" />
          </button>
        )}

        {/* Mobile overlay backdrop */}
        {leftPanelOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={handleCloseLeftPanel}
            aria-hidden="true"
          />
        )}

        {/* Left Sidebar - fixed overlay on mobile, normal sidebar on desktop.
            It used to be map-only, which left the list view able to filter by
            location and nothing else: no sourcing categories, no EPC, no
            Article 4, no licence type, no advanced filters, no saved searches
            and no reset. Whatever had been set on the map stayed applied there
            with no way to see or change it. */}
        {leftPanelOpen && (
        <aside className="fixed md:relative top-0 md:top-auto bottom-0 left-0 w-[min(85vw,300px)] md:w-[280px] bg-white border-r border-slate-200 overflow-y-auto flex-shrink-0 z-50 md:z-auto shadow-2xl md:shadow-none">
          {/* Close button */}
          <button
            onClick={handleCloseLeftPanel}
            className="absolute top-3 right-3 z-10 p-2.5 md:p-2 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
            title="Close filters"
            aria-label="Close filters"
          >
            <X className="w-5 h-5 md:w-4 md:h-4 text-slate-600" />
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
                    Purchase Price (£{priceRange[0].toLocaleString()} - £{priceRange[1].toLocaleString()})
                  </label>
                  <div className="px-1">
                    <Slider
                      value={priceRange}
                      onValueChange={setPriceRange}
                      min={PRICE_SLIDER_MIN}
                      max={PRICE_SLIDER_MAX}
                      step={10000}
                      className="mb-3"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>£{priceRange[0].toLocaleString()}</span>
                    <span>£{priceRange[1].toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  {/* Built form — flat, house, bungalow — was never the question
                      a sourcer starts from, and "All Property Types" told them
                      nothing. What actually decides the work is which of three
                      jobs a property represents, so that is what this selects.
                      The three partition the served stock exactly; see
                      sourcingCategory() in lib/properties/category.ts. */}
                  <label className="text-xs font-medium text-slate-700 mb-2 block">
                    Kind of opportunity
                  </label>
                  <div className="space-y-1.5">
                    {(Object.keys(SOURCING_LABELS) as SourcingCategory[]).map((key) => {
                      const checked = sourcingCategories.includes(key)
                      return (
                        <label
                          key={key}
                          className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-2.5 transition-colors hover:border-teal-300 hover:bg-teal-50/40"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v: boolean | "indeterminate") =>
                              setSourcingCategories((prev) =>
                                v === true ? [...prev, key] : prev.filter((c) => c !== key)
                              )
                            }
                            className="mt-0.5 shrink-0"
                          />
                          <span className="min-w-0">
                            <span className="block text-xs font-semibold text-slate-800">
                              {SOURCING_LABELS[key]}
                            </span>
                            <span className="mt-0.5 block text-[10px] leading-relaxed text-slate-500">
                              {SOURCING_DESCRIPTIONS[key]}
                            </span>
                          </span>
                        </label>
                      )
                    })}
                    {sourcingCategories.length === 0 && (
                      <p className="text-[10px] text-amber-700">
                        Nothing selected, so nothing will show. Pick at least one.
                      </p>
                    )}
                  </div>
                </div>

                {/* The Purchase / R2HMO toggle stood here. Everything the
                    platform serves is now an acquisition opportunity, so there
                    is no mode to choose between — what varies is the licence
                    state, which is shown per property rather than filtered by a
                    mode switch. */}

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

          {/* Saved Searches */}
          <SavedSearches
            currentFilters={{
              priceRange,
              sourcingCategories,
              selectedLocation,
              minEpcRating,
              article4Filter,
              licenceTypeFilter,
              broadbandFilter,
              ownerDataFilter,
              activeSegment,
              floorAreaBandFilter,
              epcBandFilter,
              // Phase 6 - TA Sourcing
              minBedrooms,
              minBathrooms,
              isFurnished,
              hasParking,
            }}
            onLoadFilters={(filters: SearchFilters) => {
              setPriceRange(filters.priceRange)
              // Searches saved before the sourcing categories existed carry the
              // old built-form list instead. Leave the current selection alone
              // rather than restoring a filter the search never recorded.
              if (filters.sourcingCategories?.length) {
                setSourcingCategories(filters.sourcingCategories as SourcingCategory[])
              }
              setSelectedLocation(filters.selectedLocation)
              setMinEpcRating(filters.minEpcRating as any)
              setArticle4Filter(filters.article4Filter as any)
              setLicenceTypeFilter(filters.licenceTypeFilter)
              setBroadbandFilter(filters.broadbandFilter as any)
              setOwnerDataFilter(filters.ownerDataFilter)
              setActiveSegment(filters.activeSegment as any)
              setFloorAreaBandFilter(filters.floorAreaBandFilter as any)
              setEpcBandFilter(filters.epcBandFilter as any)
              // Phase 6 - TA Sourcing
              if (filters.minBedrooms !== undefined) setMinBedrooms(filters.minBedrooms)
              if (filters.minBathrooms !== undefined) setMinBathrooms(filters.minBathrooms)
              if (filters.isFurnished !== undefined) setIsFurnished(filters.isFurnished)
              if (filters.hasParking !== undefined) setHasParking(filters.hasParking)
            }}
            isLoggedIn={!!user}
          />

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
                      <SelectItem value="exclude">Exclude known Article 4</SelectItem>
                      <SelectItem value="confirmed_clear">Confirmed outside only</SelectItem>
                      <SelectItem value="only">Only Article 4</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] leading-snug text-slate-500 mt-1.5">
                    {article4Filter === "exclude" &&
                      "Hides areas with a known Article 4 direction. Properties whose council publishes no data are still shown, badged as unverified."}
                    {article4Filter === "confirmed_clear" &&
                      "Strict: only properties checked against a council that publishes its Article 4 boundaries. Far fewer results."}
                    {article4Filter === "only" &&
                      "Only properties inside a known Article 4 direction area."}
                    {article4Filter === "include" &&
                      "No Article 4 filter applied."}
                  </p>
                  {article4Filter !== "only" &&
                    article4Filter !== "confirmed_clear" &&
                    article4UnknownCount > 0 && (
                      <p className="text-[11px] leading-snug text-slate-600 mt-1.5 flex items-start gap-1.5">
                        <HelpCircle className="w-3 h-3 mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
                        <span>
                          <strong className="font-medium">{article4UnknownCount}</strong> of{" "}
                          {properties.length} shown have an unverified Article 4 status — their
                          council publishes no boundary data. Confirm with the council before
                          relying on it.
                        </span>
                      </p>
                    )}
                </div>

                {/* Advanced Filters Toggle */}
                {(() => {
                  const activeCount = [
                    broadbandFilter !== "all",
                    licenceTypeFilter !== "all",
                    licenceExpiryEnabled,
                    isFurnished,
                    hasParking,
                    ownerDataFilter,
                  ].filter(Boolean).length
                  return (
                    <button
                      onClick={() => setAdvancedFiltersExpanded(!advancedFiltersExpanded)}
                      className="flex items-center justify-between w-full pt-3 border-t border-slate-200"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Advanced Filters</span>
                        {activeCount > 0 && !advancedFiltersExpanded && (
                          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-teal-100 text-teal-700 text-[10px] font-bold">{activeCount}</span>
                        )}
                      </div>
                      {advancedFiltersExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </button>
                  )
                })()}

                {advancedFiltersExpanded && (<>
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
                      {/* Mandatory / Additional / Selective / Scottish / NI
                          and an "Article 4 Direction" that is not a licence at
                          all stood below here. Every one of them queried
                          property_licences, a table that does not exist, so
                          the action swallowed the error and returned zero:
                          picking the commonest HMO licence in the country
                          emptied the page. Nothing records licence type per
                          property yet, so the honest list is the four states
                          the properties table can actually answer for. */}
                      <SelectItem value="all">All Licence Types</SelectItem>
                      <SelectItem value="any_licensed">Any Licensed HMO</SelectItem>
                      <SelectItem value="expired_licence">Expired Licence Only</SelectItem>
                      <SelectItem value="unlicensed">Unlicensed Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Licence Expiry Date Filter - Premium Feature */}
                <div className="pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-700">Licence Expiry Filter</span>
                      <span className="text-xs text-white bg-gradient-to-r from-amber-500 to-orange-500 px-1.5 py-0.5 rounded font-semibold">PRO</span>
                    </div>
                    {isPremiumUser ? (
                      <Switch
                        checked={licenceExpiryEnabled}
                        onCheckedChange={setLicenceExpiryEnabled}
                        className="data-[state=checked]:bg-amber-500"
                      />
                    ) : (
                      // Was a button labelled "Upgrade" with an empty onClick.
                      // There is no upgrade flow to send anyone to, and a
                      // control that does nothing when pressed is worse than
                      // a label that never invited the press.
                      <span className="text-xs text-slate-400">Not on your plan</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mb-2">Filter by licence expiry month range</p>

                  {licenceExpiryEnabled && isPremiumUser && (
                    <div className="space-y-3 mt-2">
                      {/* Year selector */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">Year:</span>
                        <input
                          type="number"
                          min="2020"
                          max="2035"
                          value={licenceExpiryYear}
                          onChange={(e) => setLicenceExpiryYear(parseInt(e.target.value) || new Date().getFullYear())}
                          className="w-20 h-7 text-xs px-2 border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        />
                      </div>

                      {/* Month range slider */}
                      <div>
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>{["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][licenceExpiryMonthRange[0] - 1]}</span>
                          <span>{["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][licenceExpiryMonthRange[1] - 1]}</span>
                        </div>
                        <Slider
                          value={licenceExpiryMonthRange}
                          onValueChange={(value) => setLicenceExpiryMonthRange(value as [number, number])}
                          min={1}
                          max={12}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                          <span>Jan</span>
                          <span>Dec</span>
                        </div>
                      </div>

                      {/* Info message */}
                      <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                        Showing licences expiring {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][licenceExpiryMonthRange[0] - 1]} - {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][licenceExpiryMonthRange[1] - 1]} {licenceExpiryYear}
                      </p>
                    </div>
                  )}
                </div>

                {/* Phase 6 - TA Sourcing Filters */}
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Property Requirements</p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">Min Bedrooms</label>
                      <Select
                        value={minBedrooms > 0 ? String(minBedrooms) : "any"}
                        onValueChange={(value) => setMinBedrooms(value === "any" ? 0 : parseInt(value))}
                      >
                        <SelectTrigger className="w-full h-8 text-xs bg-white border-slate-200">
                          <SelectValue placeholder="Any" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          <SelectItem value="2">2+</SelectItem>
                          <SelectItem value="3">3+</SelectItem>
                          <SelectItem value="4">4+</SelectItem>
                          <SelectItem value="5">5+</SelectItem>
                          <SelectItem value="6">6+</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">Min Bathrooms</label>
                      <Select
                        value={minBathrooms > 0 ? String(minBathrooms) : "any"}
                        onValueChange={(value) => setMinBathrooms(value === "any" ? 0 : parseInt(value))}
                      >
                        <SelectTrigger className="w-full h-8 text-xs bg-white border-slate-200">
                          <SelectValue placeholder="Any" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          <SelectItem value="1">1+</SelectItem>
                          <SelectItem value="2">2+</SelectItem>
                          <SelectItem value="3">3+</SelectItem>
                          <SelectItem value="4">4+</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-600">Furnished Only</span>
                      <Switch
                        checked={isFurnished}
                        onCheckedChange={setIsFurnished}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-600">Has Parking</span>
                      <Switch
                        checked={hasParking}
                        onCheckedChange={setHasParking}
                      />
                    </div>
                  </div>
                </div>

                {/* Owner Data Filter Toggle */}
                <div className="pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-700">Owner Data Only</span>
                      <span className="text-xs text-white bg-gradient-to-r from-amber-500 to-orange-500 px-1.5 py-0.5 rounded font-semibold">PRO</span>
                    </div>
                    {isPremiumUser ? (
                      <Switch
                        checked={ownerDataFilter}
                        onCheckedChange={setOwnerDataFilter}
                      />
                    ) : (
                      // Was a button labelled "Upgrade" with an empty onClick.
                      // There is no upgrade flow to send anyone to, and a
                      // control that does nothing when pressed is worse than
                      // a label that never invited the press.
                      <span className="text-xs text-slate-400">Not on your plan</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Show only listings with title owner information</p>
                </div>

                {/* Property size and EPC. These were nested under the
                    PRO-gated "Show Potential HMOs" switch, so a free user
                    could not reach them at all — while the data that switch
                    claimed to gate was on their screen regardless. Both read
                    published values, so neither is gated. */}
                <div className="pt-3 border-t border-slate-100 space-y-3">
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
                    <p className="text-[11px] leading-snug text-slate-500 mt-1.5">
                      Matches the measured floor area. Properties with no
                      measurement on record are not returned.
                    </p>
                  </div>

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
                        {/* Said "Compliant (C/D)" while the query matched
                            A, B, C and D. The label is the query now. */}
                        <SelectItem value="good">A to D</SelectItem>
                        <SelectItem value="needs_upgrade">Needs upgrade (E/F/G)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                </>)}
              </div>
            )}
          </div>

          {/* "Recent Searches" was a header that toggled a piece of
              state and rendered nothing underneath it, in any state. */}

        </aside>
        )}

        {/* Map Area */}
        <main id="map-main" className={`flex-1 relative bg-slate-200 min-h-0 min-w-0 ${viewMode === "list" ? "flex flex-col" : ""}`} style={{ position: 'relative' }}>

          {/* List View Top Bar - search, segments, and filters at the top */}
          {viewMode === "list" && (
            <div className="bg-white border-b border-slate-200 z-20 shrink-0">
              {/* Row 1: Segment tabs + View toggle */}
              <div className="flex items-center justify-between px-3 md:px-4 py-2 border-b border-slate-100">
                <div role="tablist" aria-label="Property category filter" className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
                  <button role="tab" aria-selected={activeSegment === "all"} onClick={() => setActiveSegment("all")}
                    className={`shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${activeSegment === "all" ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                    <LayoutGrid className="w-3.5 h-3.5" /> All <span className="opacity-70">{segmentCounts.all}</span>
                  </button>
                  <button role="tab" aria-selected={activeSegment === "licensed"} onClick={() => setActiveSegment("licensed")}
                    className={`shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${activeSegment === "licensed" ? "bg-teal-600 text-white" : "text-teal-700 hover:bg-teal-50"}`}>
                    <ShieldCheck className="w-3.5 h-3.5" /> Licensed <span className="opacity-70">{segmentCounts.licensed}</span>
                  </button>
                  <button role="tab" aria-selected={activeSegment === "expired"} onClick={() => setActiveSegment("expired")}
                    className={`shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${activeSegment === "expired" ? "bg-amber-500 text-white" : "text-amber-700 hover:bg-amber-50"}`}>
                    <Clock className="w-3.5 h-3.5" /> Expired <span className="opacity-70">{segmentCounts.expired}</span>
                  </button>
                  <button role="tab" aria-selected={activeSegment === "conversion"} onClick={() => setActiveSegment("conversion")}
                    className={`shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${activeSegment === "conversion" ? "bg-green-600 text-white" : "text-green-700 hover:bg-green-50"}`}>
                    <TrendingUp className="w-3.5 h-3.5" /> Change of use <span className="opacity-70">{segmentCounts.conversion}</span>
                  </button>
                  <button role="tab" aria-selected={activeSegment === "restricted"} onClick={() => setActiveSegment("restricted")}
                    className={`shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${activeSegment === "restricted" ? "bg-red-600 text-white" : "text-red-600 hover:bg-red-50"}`}>
                    <AlertTriangle className="w-3.5 h-3.5" /> Restricted <span className="opacity-70">{segmentCounts.restricted}</span>
                  </button>
                </div>
                <div className="flex items-center bg-slate-100 rounded-full p-0.5 ml-3 shrink-0">
                  {/* This whole block renders only when viewMode is "list", so Map is never the active half. */}
                  <button onClick={() => setViewMode("map")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all text-slate-600 hover:bg-slate-200" aria-label="Map view">
                    <Map className="w-3.5 h-3.5" /> Map
                  </button>
                  <button onClick={() => setViewMode("list")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${viewMode === "list" ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-200"}`} aria-label="List view">
                    <List className="w-3.5 h-3.5" /> List
                  </button>
                </div>
              </div>
              {/* Row 2: how many, and how to get at the filters.
                  This row used to carry its own location box, price readout and
                  a "Property Type" select — a second filter for the same thing
                  the sidebar already filters, on built form rather than the
                  sourcing categories, uncontrolled so it never reflected a
                  reset, and with no counterpart in map view. Picking "Houses"
                  dropped 445 properties (every HMO-typed row among them) and
                  the filter stayed applied, invisible, after switching to the
                  map. The sidebar is the one place filters live now, and it
                  renders in both views. */}
              <div className="flex items-center gap-3 px-3 md:px-4 py-2 overflow-x-auto scrollbar-hide">
                <button
                  onClick={handleOpenLeftPanel}
                  className={`shrink-0 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 ${leftPanelOpen ? "md:hidden" : ""}`}
                >
                  <Search className="w-3.5 h-3.5" />
                  Filters
                </button>
                <div className="shrink-0 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{displayProperties.length}</span> properties
                </div>
                {user && displayProperties.length > 0 && (
                  <div className="shrink-0">
                    <ExportButton
                      filters={currentFilters()}
                      segment={activeSegment}
                      disabled={loading}
                      isAdmin={user.user_metadata?.is_admin === true}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Segment Tabs - Category Filter (map view only) */}
          {viewMode === "map" && (
          <div role="tablist" aria-label="Property category filter" className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-1.5 border border-slate-200 max-w-[95vw] overflow-x-auto scrollbar-hide">
            <button
              role="tab"
              aria-selected={activeSegment === "all"}
              onClick={() => setActiveSegment("all")}
              className={`shrink-0 whitespace-nowrap px-3 py-3 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 ${
                activeSegment === "all"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> All <span className="opacity-70">{segmentCounts.all}</span>
            </button>
            <button
              role="tab"
              aria-selected={activeSegment === "licensed"}
              onClick={() => setActiveSegment("licensed")}
              className={`shrink-0 whitespace-nowrap px-3 py-3 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-1 ${
                activeSegment === "licensed"
                  ? "bg-teal-600 text-white shadow-sm"
                  : "text-teal-700 hover:bg-teal-50"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Licensed <span className="opacity-70">{segmentCounts.licensed}</span>
            </button>
            <button
              role="tab"
              aria-selected={activeSegment === "expired"}
              onClick={() => setActiveSegment("expired")}
              className={`shrink-0 whitespace-nowrap px-3 py-3 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1 ${
                activeSegment === "expired"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "text-amber-700 hover:bg-amber-50"
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> Expired <span className="opacity-70">{segmentCounts.expired}</span>
            </button>
            <button
              role="tab"
              aria-selected={activeSegment === "conversion"}
              onClick={() => setActiveSegment("conversion")}
              className={`shrink-0 whitespace-nowrap px-3 py-3 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-1 ${
                activeSegment === "conversion"
                  ? "bg-green-600 text-white shadow-sm"
                  : "text-green-700 hover:bg-green-50"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" /> Change of use <span className="opacity-70">{segmentCounts.conversion}</span>
            </button>
            <button
              role="tab"
              aria-selected={activeSegment === "restricted"}
              onClick={() => setActiveSegment("restricted")}
              className={`shrink-0 whitespace-nowrap px-3 py-3 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1 ${
                activeSegment === "restricted"
                  ? "bg-red-600 text-white shadow-sm"
                  : "text-red-600 hover:bg-red-50"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" /> Restricted <span className="opacity-70">{segmentCounts.restricted}</span>
            </button>
          </div>
          )}

          {/* View Mode Toggle + Property Count Indicator & Export (map view only) */}
          {viewMode === "map" && (
          <>
          <div className="absolute top-[4.5rem] left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 max-w-[95vw]">
            <div className="flex items-center bg-white/95 backdrop-blur-sm rounded-full shadow-lg border border-slate-200 p-0.5">
              <button
                onClick={() => setViewMode("map")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  viewMode === "map"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
                aria-label="Map view"
              >
                <Map className="w-3.5 h-3.5" /> Map
              </button>
              {/* This whole block renders only when viewMode is "map", so List is never the active half. */}
              <button
                onClick={() => setViewMode("list")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all text-slate-600 hover:bg-slate-100"
                aria-label="List view"
              >
                <List className="w-3.5 h-3.5" /> List
              </button>
            </div>
          </div>
          <div className="absolute top-[7rem] left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 max-w-[95vw]">
            <div className="bg-slate-800/90 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full shadow-lg">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Loading...
                </span>
              ) : (
                <span>
                  Showing <span className="font-bold">{displayProperties.length}</span> properties
                  {selectedLocation.name !== "All Cities" && <span className="opacity-70"> in {selectedLocation.name}</span>}
                </span>
              )}
            </div>
            {user && displayProperties.length > 0 && (
              <ExportButton
                filters={currentFilters()}
                segment={activeSegment}
                disabled={loading}
                isAdmin={user.user_metadata?.is_admin === true}
              />
            )}
          </div>
          </>
          )}

          {viewMode === "map" ? (
            <>
              {/* Empty state when no properties match filters */}
              {!loading && displayProperties.length === 0 && (
                <div className="absolute top-28 left-1/2 -translate-x-1/2 z-20">
                  <div className="bg-slate-800/90 backdrop-blur-sm text-white text-xs px-4 py-2 rounded-full shadow-lg text-center">
                    No properties match your filters.
                    <button onClick={handleResetFilters} className="ml-1 underline text-teal-300">Reset filters</button>
                  </div>
                </div>
              )}

              {/* MapLibre GL Map */}
              <MainMapView
                selectedCity={selectedLocation}
                properties={displayProperties}
                selectedProperty={selectedProperty}
                onPropertySelect={(property) => {
                  setSelectedProperty(property)
                  setRightPanelOpen(true)
                }}
                loading={loading}
                showArticle4Overlay={showArticle4Overlay}
                showPotentialHMOLayer={showPotentialHMOLayer}
              />
            </>
          ) : (
            <PropertyListView
              properties={displayProperties}
              selectedProperty={selectedProperty}
              onPropertySelect={(property) => {
                setSelectedProperty(property)
                setRightPanelOpen(true)
              }}
              loading={loading}
              savedPropertyIds={savedPropertyIds}
            />
          )}

          {/* Map legend - Reorganized by user intent (hidden in list view) */}
          {viewMode === "map" && <Card className="absolute bottom-4 md:bottom-8 left-2 md:left-6 shadow-xl bg-white border-slate-200 z-20 overflow-hidden max-w-[200px] md:max-w-[280px]">
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
                {/* Every row below is a count of markers on screen. A row is
                    shown only when something is drawn in it, so the legend
                    cannot advertise a colour this map is not using. */}

                {/* RESTRICTIONS — first, because it wins every other branch */}
                {markerCounts.article4 > 0 && (
                  <div className="pb-2.5 border-b border-slate-100">
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
                      <span className="text-xs text-slate-600">Article 4 area</span>
                      <span className="text-[10px] text-red-600 ml-auto">{markerCounts.article4}</span>
                    </div>
                    {/* Article 4 is read first, so a property here is drawn red
                        whatever else is true of it. Saying so is the difference
                        between a legend and a colour chart. */}
                    <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
                      Shown ahead of licence and conversion state, so a licensed
                      HMO inside one of these areas is red here.
                    </p>
                    {showArticle4Overlay && (
                      <div className="flex items-center gap-2.5 mt-1.5">
                        <div className="w-4 h-4 rounded bg-red-300/40 border-2 border-red-600"></div>
                        <span className="text-xs text-slate-500">Article 4 zone overlay</span>
                      </div>
                    )}
                    {/* The dots and the overlay do not share a source. The
                        overlay is the national feed's geometry; a red dot is a
                        position recorded from whichever source decided that
                        address — for most of them, a council's own publication,
                        not the feed. Crediting only the feed under a red dot
                        credited the wrong body for two thirds of them. */}
                    <div className="pt-1 mt-1 border-t border-slate-200 space-y-0.5">
                      <p className="text-[10px] leading-relaxed text-slate-400">
                        Positions recorded from council publications and
                        planning.data.gov.uk.
                      </p>
                      {showArticle4Overlay && (
                        <a
                          href="https://www.planning.data.gov.uk/dataset/article-4-direction-area"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-slate-400 hover:text-teal-600 transition-colors block"
                        >
                          Overlay shapes: planning.data.gov.uk
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* LICENCE LAPSED */}
                {markerCounts.expired > 0 && (
                  <div className="pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Licence lapsed</span>
                      <span className="text-[10px] text-slate-400">Enforcement risk for the owner</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-amber-500 border-2 border-amber-600"></div>
                      <span className="text-xs text-slate-600">Recorded as expired</span>
                      <span className="text-[10px] text-amber-600 ml-auto">{markerCounts.expired}</span>
                    </div>
                  </div>
                )}

                {/* CHANGE OF USE — also shown while the layer is off, or the
                    switch would hide itself the moment you used it. */}
                {(markerCounts.conversion > 0 || !showPotentialHMOLayer) && (
                  <div className="pb-2.5 border-b border-slate-100">
                    {/* This layer could not be turned off: the state existed,
                        its setter was never called, and the legend offered no
                        control while Article 4 had one. */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Change of use</span>
                        <span className="text-[10px] text-slate-400">No HMO use today</span>
                      </div>
                      <Switch
                        checked={showPotentialHMOLayer}
                        onCheckedChange={setShowPotentialHMOLayer}
                        className="data-[state=checked]:bg-green-500 scale-75"
                        aria-label="Show change of use markers"
                      />
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-green-600 border-2 border-green-700"></div>
                      <span className="text-xs text-slate-600">No HMO use today</span>
                      <span className="text-[10px] text-green-600 ml-auto">{markerCounts.conversion}</span>
                    </div>
                    {/* These markers come in two greens. The shade is decided by
                        hmo_classification, which is a threshold on the deal
                        score that was removed from the product — so it is not
                        described here, because it no longer means anything a
                        reader could act on. */}
                    <div className="mt-1.5 text-[10px] text-slate-400">
                      Larger green marker = more owner contact detail held
                    </div>
                  </div>
                )}

                {/* IN HMO USE */}
                {markerCounts.licensed > 0 && (
                  <div className="pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">In HMO use</span>
                      <span className="text-[10px] text-slate-400">Licence in force</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-teal-700"></div>
                      <span className="text-xs text-slate-600">Licensed HMO</span>
                      <span className="text-[10px] text-teal-600 ml-auto">{markerCounts.licensed}</span>
                    </div>
                  </div>
                )}

                {/* EVERYTHING ELSE — drawn all along, never explained */}
                {markerCounts.other > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Other</span>
                      <span className="text-[10px] text-slate-400">Nothing recorded yet</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-teal-500"></div>
                      <span className="text-xs text-slate-600">No position held</span>
                      <span className="text-[10px] text-slate-500 ml-auto">{markerCounts.other}</span>
                    </div>
                    <p className="text-[10px] leading-relaxed text-slate-400">
                      An address we hold nothing on is unchecked, not clear.
                    </p>
                  </div>
                )}

              </div>
            )}
          </Card>}

        </main>

        {/* Right Sidebar */}
        {rightPanelOpen && (
          <>
          {/* Mobile backdrop overlay */}
          <div className="md:hidden fixed inset-0 bg-black/50 z-50" onClick={handleCloseRightPanel} aria-hidden="true" />
          <aside className="w-full md:w-[320px] lg:w-[400px] fixed md:relative top-0 md:top-auto bottom-0 left-0 right-0 md:inset-auto z-[51] md:z-auto bg-white border-l border-slate-200 overflow-y-auto">
            {/* Close button */}
            <button
              onClick={handleCloseRightPanel}
              className="absolute top-3 right-3 z-10 p-2.5 md:p-2 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
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
                    {/* Compare button */}
                    <button
                      onClick={() => {
                        if (isInCompare(selectedProperty.id)) {
                          removeFromCompare(selectedProperty.id)
                          toast({ title: "Removed from comparison" })
                        } else if (canAddMore) {
                          addToCompare(selectedProperty)
                          toast({ title: "Added to comparison", description: `${compareList.length + 1} of 3 properties` })
                        } else {
                          toast({ title: "Comparison full", description: "Remove a property first", variant: "destructive" })
                        }
                      }}
                      className={`absolute top-2 right-12 p-2 rounded-full shadow-md transition-colors ${
                        isInCompare(selectedProperty.id)
                          ? "bg-teal-500 text-white"
                          : "bg-white/90 text-slate-600 hover:bg-teal-50 hover:text-teal-600"
                      }`}
                      title={isInCompare(selectedProperty.id) ? "Remove from comparison" : "Add to comparison"}
                      aria-label={isInCompare(selectedProperty.id) ? "Remove from comparison" : "Add to comparison"}
                    >
                      <BarChart3 className="w-4 h-4" />
                    </button>
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
          </>
        )}

        {/* Toggle button when panel is closed */}
        {!rightPanelOpen && (
          <button
            onClick={handleOpenRightPanel}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-30 bg-white shadow-lg rounded-l-lg p-3 hover:bg-slate-50 transition-colors border border-r-0 border-slate-200"
            title="Open property panel"
            aria-label="Open property panel"
          >
            <ChevronDown className="w-5 h-5 text-slate-600 -rotate-90" />
          </button>
        )}
      </div>

      {showFullDetails && selectedProperty && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="full-details-title" tabIndex={-1}>
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
              <h2 id="full-details-title" className="text-xl font-bold text-slate-900">Full Property Details</h2>
              <button onClick={handleCloseFullDetails} className="text-slate-400 hover:text-slate-600" aria-label="Close property details">
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
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl font-bold text-teal-600">
                    {selectedProperty.listing_type === "purchase"
                      ? (selectedProperty.purchase_price ? `£${selectedProperty.purchase_price.toLocaleString()}` : "Price on application")
                      : (selectedProperty.price_pcm ? `£${selectedProperty.price_pcm.toLocaleString()} pcm` : "Price on application")}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${
                    selectedProperty.listing_type === "rent"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-blue-100 text-blue-700"
                  }`}>
                    {selectedProperty.listing_type === "rent" ? (
                      <><Home className="w-4 h-4" /> Rent-to-HMO</>
                    ) : (
                      <><Key className="w-4 h-4" /> Purchase</>
                    )}
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">{selectedProperty.title}</h3>
                <p className="text-slate-600">
                  {selectedProperty.address}, {selectedProperty.postcode}
                </p>
              </div>

              {/* Purchase-specific info */}
              {/* Current use, shown for every property rather than only for
                  purchase listings. The old block was gated on listing_type
                  === "purchase", so all 457 off-market licensed HMOs displayed
                  no licence information whatsoever. */}
              <div className="mb-6">
                <h4 className="font-semibold text-slate-900 mb-3">Current use</h4>
                <CurrentUsePanel property={selectedProperty} />
              </div>

              {selectedProperty.listing_type === "purchase" &&
                (selectedProperty.tenure || selectedProperty.estimated_rent_per_room) && (
                  <div className="mb-6 grid grid-cols-2 gap-4 p-4 bg-teal-50 rounded-lg">
                    {selectedProperty.tenure && (
                      <div>
                        <div className="text-xs text-slate-600 mb-1">Tenure</div>
                        <div className="text-sm font-medium text-slate-900 capitalize">
                          {selectedProperty.tenure}
                        </div>
                      </div>
                    )}
                    {selectedProperty.estimated_rent_per_room && (
                      <div>
                        <div className="text-xs text-slate-600 mb-1">Indicative rent per room</div>
                        <div className="text-sm font-medium text-slate-900">
                          £{selectedProperty.estimated_rent_per_room}/pcm
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          City average, not this property&rsquo;s letting history.
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
                <OwnerInformationSection property={selectedProperty} defaultOpen={true} isPremium={isPremiumUser} />
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

      {/* Property Comparison Tool */}
      {compareList.length > 0 && (
        <PropertyComparison
          properties={compareList}
          onRemove={removeFromCompare}
          onClear={clearCompare}
        />
      )}

      {/* Onboarding Walkthrough - shown on first login */}
      <OnboardingWalkthrough
        isOpen={showWalkthrough}
        onComplete={() => setShowWalkthrough(false)}
        onShowPropertyDetails={() => {
          // Select first property to demo the details panel
          if (properties.length > 0 && !selectedProperty) {
            setSelectedProperty(properties[0])
            setRightPanelOpen(true)
          } else if (selectedProperty) {
            setRightPanelOpen(true)
          }
        }}
        onHidePropertyDetails={() => {
          setRightPanelOpen(false)
        }}
      />
    </div>
    </AppShell>
  )
}
