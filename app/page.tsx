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

export default function HMOHunterPage() {
  const [listingType, setListingType] = useState<"rent" | "purchase">("rent")
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [savedProperties, setSavedProperties] = useState<any[]>([])
  const [savedPropertyIds, setSavedPropertyIds] = useState<Set<string>>(new Set())

  const [showFullDetails, setShowFullDetails] = useState(false)

  const [mapCenter] = useState({ lat: 51.5074, lng: -0.1278 }) // London center

  const [priceRange, setPriceRange] = useState([1000, 10000])
  const priceRangeKey = priceRange.join(",")
  const [propertyTypes, setPropertyTypes] = useState<string[]>(["HMO", "Flat", "House"])
  const propertyTypesKey = propertyTypes.join(",")
  const [availableNow, setAvailableNow] = useState(true)
  const [studentFriendly, setStudentFriendly] = useState(true)
  const [petFriendly, setPetFriendly] = useState(false)
  const [furnished, setFurnished] = useState(true)
  const [licensedHmoOnly, setLicensedHmoOnly] = useState(false)

  const [searchExpanded, setSearchExpanded] = useState(true)
  const [filtersExpanded, setFiltersExpanded] = useState(true)
  const [savedExpanded, setSavedExpanded] = useState(true)
  const [recentExpanded, setRecentExpanded] = useState(false)
  const [trendsExpanded, setTrendsExpanded] = useState(true)

  const [filterDebounceTimer, setFilterDebounceTimer] = useState<NodeJS.Timeout | null>(null)

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
          city: "London",
          availableNow,
          studentFriendly,
          petFriendly,
          furnished,
          licensedHmoOnly,
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
    availableNow,
    studentFriendly,
    petFriendly,
    furnished,
    licensedHmoOnly,
  ])

  const handleSearch = async () => {
    setLoading(true)
    try {
      const data = await getProperties({
        listingType,
        minPrice: priceRange[0],
        maxPrice: priceRange[1],
        propertyTypes,
        city: "London",
        availableNow,
        studentFriendly,
        petFriendly,
        furnished,
        licensedHmoOnly,
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

  const latLngToScreenPosition = (lat: number, lng: number) => {
    // London bounding box for viewport
    const bounds = {
      north: 51.55,
      south: 51.45,
      east: -0.05,
      west: -0.2,
    }

    // Calculate percentage position within bounds
    const x = ((lng - bounds.west) / (bounds.east - bounds.west)) * 100
    const y = ((bounds.north - lat) / (bounds.north - bounds.south)) * 100

    // Clamp values to keep markers on screen
    return {
      x: Math.max(10, Math.min(90, x)),
      y: Math.max(10, Math.min(90, y)),
    }
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
            onClick={() => router.push("/stress-test")}
            className="text-slate-600 hover:text-slate-900 text-sm font-medium"
          >
            Stress Test
          </button>
          <button className="text-slate-600 hover:text-slate-900 text-sm font-medium">About</button>
        </nav>

        <div className="flex items-center gap-3">
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

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-[280px] bg-white border-r border-slate-200 overflow-y-auto">
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
                  <Select defaultValue="london">
                    <SelectTrigger className="w-full bg-white border-teal-200 focus:border-teal-500 focus:ring-teal-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="london">London, UK</SelectItem>
                      <SelectItem value="manchester">Manchester, UK</SelectItem>
                      <SelectItem value="birmingham">Birmingham, UK</SelectItem>
                    </SelectContent>
                  </Select>
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
              </div>
            )}
          </div>

          {/* Saved Properties */}
          <div className="p-4 border-b border-slate-200">
            <button
              onClick={() => setSavedExpanded(!savedExpanded)}
              className="flex items-center justify-between w-full mb-4"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-600" />
                <span className="font-semibold text-sm text-slate-900">Saved Properties</span>
              </div>
              {savedExpanded ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {savedExpanded && (
              <div className="space-y-2">
                {savedProperties.length === 0 ? (
                  <div className="text-xs text-slate-500 text-center py-4">
                    {user ? "No saved properties yet" : "Login to save properties"}
                  </div>
                ) : (
                  savedProperties.slice(0, 4).map((savedProp) => (
                    <div
                      key={savedProp.id}
                      onClick={() => setSelectedProperty(savedProp.property)}
                      className="flex items-center gap-3 p-2 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <div className="w-10 h-10 bg-slate-200 rounded flex-shrink-0">
                        <img
                          src={savedProp.property.image_url || "/cozy-suburban-house.png"}
                          alt="Property"
                          className="w-full h-full object-cover rounded"
                        />
                      </div>
                      <span className="text-xs text-slate-700 flex-1">{savedProp.property.title}</span>
                      <Heart className="w-4 h-4 text-teal-600 fill-teal-600 flex-shrink-0" />
                    </div>
                  ))
                )}
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

          {/* Market Trends */}
          <div className="p-4">
            <button
              onClick={() => setTrendsExpanded(!trendsExpanded)}
              className="flex items-center justify-between w-full mb-4"
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-teal-600" />
                <span className="font-semibold text-sm text-slate-900">Market Trends</span>
              </div>
              {trendsExpanded ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {trendsExpanded && (
              <div className="space-y-2">
                <svg viewBox="0 0 240 80" className="w-full h-16">
                  <path
                    d="M0,50 Q30,30 60,40 T120,35 T180,30 T240,25"
                    fill="none"
                    stroke="rgb(13 148 136)"
                    strokeWidth="2.5"
                  />
                  <path
                    d="M0,55 Q30,40 60,45 T120,42 T180,38 T240,35"
                    fill="none"
                    stroke="rgb(20 184 166)"
                    strokeWidth="2.5"
                  />
                  <path
                    d="M0,60 Q30,45 60,52 T120,50 T180,48 T240,45"
                    fill="none"
                    stroke="rgb(94 234 212)"
                    strokeWidth="2.5"
                  />
                </svg>
              </div>
            )}
          </div>
        </aside>

        {/* Map Area */}
        <main className="flex-1 relative bg-slate-200">
          <div className="w-full h-full relative overflow-hidden">
            {/* Map background with street pattern */}
            <div className="absolute inset-0 bg-slate-100">
              <svg className="absolute inset-0 w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
                    <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgb(148 163 184)" strokeWidth="0.5" />
                    <path d="M 50 0 L 50 100 M 0 50 L 100 50" fill="none" stroke="rgb(148 163 184)" strokeWidth="0.3" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />

                {/* Street names and labels */}
                <text x="15%" y="20%" fontSize="8" fill="rgb(100 116 139)" opacity="0.5">
                  Regent St
                </text>
                <text x="65%" y="30%" fontSize="8" fill="rgb(100 116 139)" opacity="0.5">
                  Baker St
                </text>
                <text x="25%" y="60%" fontSize="8" fill="rgb(100 116 139)" opacity="0.5">
                  Towarea Road
                </text>
                <text x="75%" y="75%" fontSize="8" fill="rgb(100 116 139)" opacity="0.5">
                  Russell Square
                </text>
                <text x="50%" y="65%" fontSize="10" fill="rgb(71 85 105)" opacity="0.7" fontWeight="500">
                  London
                </text>
              </svg>

              {/* Green park areas */}
              <div className="absolute top-[15%] right-[10%] w-24 h-32 bg-green-100 opacity-40 rounded-lg"></div>
              <div className="absolute bottom-[20%] left-[8%] w-32 h-24 bg-green-100 opacity-40 rounded-lg"></div>
              <div className="absolute top-[10%] left-[30%] w-20 h-20 bg-green-100 opacity-40 rounded-full"></div>
            </div>

            {/* Search radius circle */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full border-2 border-teal-500/40 bg-teal-50/30"></div>

            {loading ? (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-600">
                Loading properties...
              </div>
            ) : (
              properties.map((property) => {
                const { x, y } = latLngToScreenPosition(Number(property.latitude), Number(property.longitude))

                const markerType =
                  property.hmo_status === "Licensed HMO"
                    ? "licensed"
                    : property.hmo_status === "Potential HMO"
                      ? "potential"
                      : "standard"

                return (
                  <div
                    key={property.id}
                    onClick={() => setSelectedProperty(property)}
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full font-bold text-white flex items-center justify-center cursor-pointer hover:scale-110 transition-transform shadow-md
                      ${
                        markerType === "licensed"
                          ? "bg-teal-700 w-10 h-10 text-xs"
                          : markerType === "potential"
                            ? "bg-white border-2 border-teal-600 text-teal-600 w-9 h-9 text-xs"
                            : "bg-teal-600 w-9 h-9 text-xs"
                      }
                    `}
                    style={{ left: `${x}%`, top: `${y}%` }}
                  >
                    {property.bedrooms}
                  </div>
                )
              })
            )}

            {selectedProperty && (
              <Card className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-full w-72 shadow-2xl bg-white border-slate-200">
                <div className="relative">
                  <SavePropertyButton
                    propertyId={selectedProperty.id}
                    initialSaved={savedPropertyIds.has(selectedProperty.id)}
                  />
                </div>
                <div className="flex gap-3 p-3">
                  <div className="w-20 h-20 bg-slate-200 rounded flex-shrink-0 overflow-hidden">
                    <PropertyGallery
                      images={selectedProperty.images}
                      floorPlans={selectedProperty.floor_plans}
                      primaryImage={selectedProperty.primary_image}
                      fallbackImage={selectedProperty.image_url || "/modern-house-exterior.png"}
                      propertyTitle={selectedProperty.title}
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
                    <div className="mt-2">
                      <FreshnessBadge
                        lastSeenAt={selectedProperty.last_seen_at}
                        isStale={selectedProperty.is_stale}
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Map legend */}
            <Card className="absolute bottom-8 left-6 p-4 shadow-xl bg-white border-slate-200">
              <div className="font-semibold text-sm mb-3 text-slate-900">Legend</div>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-teal-600"></div>
                  <span className="text-xs text-slate-700">Standard HMO</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-teal-700"></div>
                  <span className="text-xs text-slate-700">Licensed HMO</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full border-2 border-teal-600 bg-white"></div>
                  <span className="text-xs text-slate-700">Potential HMO</span>
                </div>
              </div>
            </Card>

            {/* Google Maps attribution */}
            <div className="absolute bottom-3 right-3 text-[10px] text-slate-500 bg-white/90 px-2 py-1 rounded">
              Map data ©2022 Weds Mbaas Terms of Use
            </div>

            {/* Add Property button */}
            <Button className="absolute bottom-8 right-8 rounded-full h-14 px-6 bg-teal-600 hover:bg-teal-700 shadow-xl text-white font-medium">
              <Plus className="w-5 h-5 mr-2" />
              Add Property
            </Button>
          </div>
        </main>

        {/* Right Sidebar */}
        <aside className="w-[360px] bg-white border-l border-slate-200 overflow-y-auto">
          {selectedProperty && (
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
                      <div className="flex items-center gap-2 text-sm text-teal-700">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Licensed HMO
                      </div>
                    )}
                    {selectedProperty.source_type && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Source:</span>
                        <span className="text-slate-900 font-medium">
                          {selectedProperty.source_type === "council_register" ? "Council Register" : "Public Listing"}
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

                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowFullDetails(true)}
                    className="flex-1 bg-white border border-teal-600 text-teal-600 hover:bg-teal-50"
                  >
                    View Full Details
                  </Button>
                  <Button className="flex-1 bg-teal-600 hover:bg-teal-700 text-white">
                    {selectedProperty.listing_type === "purchase" ? "Contact Seller" : "Book Viewing"}
                  </Button>
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
          )}
        </aside>
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

              {/* Description */}
              {selectedProperty.description && (
                <div className="mb-6">
                  <h4 className="font-semibold text-slate-900 mb-3">Description</h4>
                  <p className="text-slate-700 leading-relaxed">{selectedProperty.description}</p>
                </div>
              )}

              {/* Floor Plans Section - only show if floor plans exist */}
              {selectedProperty.floor_plans && selectedProperty.floor_plans.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-semibold text-slate-900 mb-3">Floor Plans</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedProperty.floor_plans.map((floorPlan, index) => (
                      <div key={index} className="border border-slate-200 rounded-lg overflow-hidden">
                        {floorPlan.toLowerCase().endsWith(".pdf") ? (
                          <a
                            href={floorPlan}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col items-center justify-center p-8 bg-slate-50 hover:bg-slate-100 transition-colors"
                          >
                            <FileText className="w-12 h-12 text-slate-400 mb-2" />
                            <span className="text-sm text-slate-600">View PDF Floor Plan {index + 1}</span>
                          </a>
                        ) : (
                          <img
                            src={floorPlan || "/placeholder.svg"}
                            alt={`Floor plan ${index + 1}`}
                            className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(floorPlan, "_blank")}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-2 italic">Floor plans sourced from the original listing</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <Button
                  onClick={() => {
                    /* Save property logic */
                  }}
                  className="flex-1 bg-white border border-teal-600 text-teal-600 hover:bg-teal-50"
                >
                  <SavePropertyButton
                    propertyId={selectedProperty.id}
                    initialSaved={savedPropertyIds.has(selectedProperty.id)}
                  />
                </Button>
                <Button className="flex-1 bg-teal-600 hover:bg-teal-700 text-white">
                  {selectedProperty.listing_type === "purchase" ? "Contact Seller" : "Book Viewing"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
