"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import PropertyMap from "@/components/property-map"
import { createClient } from "@/lib/supabase/client"
import { HmoStatsCard } from "@/components/hmo-stats-card"
import {
  Building2,
  MapPin,
  ArrowLeft,
  TrendingUp,
  Home,
  Shield
} from "lucide-react"

export default function UserDashboard() {
  const [properties, setProperties] = useState<any[]>([])
  const [stats, setStats] = useState({
    total: 0,
    purchase: 0,
    rent: 0,
    licensed: 0
  })

  // Fetch properties and stats on mount
  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()

      // Fetch properties for map
      const { data: propData } = await supabase
        .from("properties")
        .select("id, postcode, latitude, longitude, address, purchase_price, property_type, listing_type, licensed_hmo")
        .eq("is_stale", false)
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .limit(100)

      if (propData) {
        const mapProperties = propData.map((p: any) => ({
          postcode: p.postcode,
          lat: Number(p.latitude),
          lng: Number(p.longitude),
          address: p.address || p.postcode,
          price: p.purchase_price || 0,
        }))
        setProperties(mapProperties)

        // Calculate stats from fetched data
        setStats({
          total: propData.length,
          purchase: propData.filter((p: any) => p.listing_type === "purchase").length,
          rent: propData.filter((p: any) => p.listing_type === "rent").length,
          licensed: propData.filter((p: any) => p.licensed_hmo).length
        })
      }
    }
    fetchData()
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 md:gap-4 min-w-0">
              <Link href="/map">
                <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900 px-2 md:px-3">
                  <ArrowLeft className="w-4 h-4 md:mr-2" />
                  <span className="hidden md:inline">Back to Home</span>
                </Button>
              </Link>
              <div className="hidden md:block h-6 w-px bg-slate-200" />
              <h1 className="text-sm md:text-lg font-semibold text-slate-900 truncate">Dashboard</h1>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-3 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">
        {/* Header */}
        <div>
          <p className="text-slate-600">
            Your property portfolio overview and market insights
          </p>
        </div>

        {/* HMO Portfolio Statistics */}
        <HmoStatsCard className="mb-6" />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-white border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Total Properties</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-slate-600" />
                <span className="text-3xl font-bold text-slate-900">{stats.total}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-700">Purchase</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Home className="w-5 h-5 text-blue-500" />
                <span className="text-3xl font-bold text-blue-700">{stats.purchase}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-purple-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-purple-700">Rent-to-Rent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-500" />
                <span className="text-3xl font-bold text-purple-700">{stats.rent}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-teal-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-teal-700">Licensed HMOs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-teal-500" />
                <span className="text-3xl font-bold text-teal-700">{stats.licensed}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Property Map */}
        {properties.length > 0 && (
          <Card className="bg-white border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-teal-600" />
                Property Locations
              </CardTitle>
              <CardDescription>Interactive map showing properties with location data</CardDescription>
            </CardHeader>
            <CardContent>
              <PropertyMap properties={properties} />
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {properties.length === 0 && (
          <Card className="border-dashed border-2 border-slate-300 bg-white">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Building2 className="w-16 h-16 text-slate-300 mb-4" />
              <h3 className="text-xl font-semibold text-slate-700 mb-2">No Properties Found</h3>
              <p className="text-slate-500 text-center mb-6 max-w-md">
                Properties will appear here once data is available. Browse the main map to explore listings.
              </p>
              <Link href="/map">
                <Button className="bg-teal-600 hover:bg-teal-700">
                  <MapPin className="w-4 h-4 mr-2" />
                  Browse Properties
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
