"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { runNativeIngestion } from "@/lib/services/native-ingestion"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import PropertyMap from "@/components/property-map"
import { createClient } from "@/lib/supabase/client"
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Building2, 
  Loader2,
  PoundSterling,
  Users,
  Calendar,
  TrendingUp,
  Home,
  MapPin,
  FileText,
  AlertCircle,
  ArrowLeft
} from "lucide-react"

export default function UserDashboard() {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [properties, setProperties] = useState<any[]>([])

  // Fetch properties for map on mount
  useEffect(() => {
    async function fetchProperties() {
      const supabase = createClient()
      const { data } = await supabase
        .from("properties")
        .select("id, postcode, latitude, longitude, address, purchase_price, property_type")
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .limit(100)
      
      if (data) {
        // Transform to PropertyMap format
        const mapProperties = data.map((p) => ({
          postcode: p.postcode,
          lat: Number(p.latitude),
          lng: Number(p.longitude),
          address: p.address || p.postcode,
          price: p.purchase_price || 0,
        }))
        setProperties(mapProperties)
      }
    }
    fetchProperties()
  }, [])

  async function refreshData() {
    setLoading(true)
    try {
      const ingestionResults = await runNativeIngestion()
      setResults(ingestionResults.results || [])
      setLastRefresh(new Date())
    } catch (err) {
      // Silent fail, results stay empty
    }
    setLoading(false)
  }

  const total = results.length
  const successCount = results.filter((r) => r.status === "success").length
  const failCount = results.filter((r) => r.status === "failed").length

  // Format currency
  const formatCurrency = (value?: number) => {
    if (!value) return "N/A"
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value)
  }

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A"
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
              <div className="h-6 w-px bg-slate-200" />
              <h1 className="text-lg font-semibold text-slate-900">Property Insights Dashboard</h1>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/stress-test">
                <Button variant="outline" size="sm">
                  Stress Test
                </Button>
              </Link>
              <Button onClick={refreshData} disabled={loading} size="sm" className="bg-teal-600 hover:bg-teal-700">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Data
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <p className="text-slate-600">
            Live data from HM Land Registry, PropertyData, StreetData, and PaTMa APIs
          </p>
        </div>

        {lastRefresh && (
          <p className="text-sm text-slate-500">
            Last refreshed: {lastRefresh.toLocaleTimeString()}
          </p>
        )}

        {/* Property Map */}
        {properties.length > 0 && (
          <Card className="bg-white border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-teal-600" />
                Property Locations
              </CardTitle>
              <CardDescription>Interactive map showing all properties with location data</CardDescription>
            </CardHeader>
            <CardContent>
              <PropertyMap properties={properties} />
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-white border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Total Properties</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-slate-600" />
                <span className="text-3xl font-bold text-slate-900">{total}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-green-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-700">Successful</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-3xl font-bold text-green-700">{successCount}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-red-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-700">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-500" />
                <span className="text-3xl font-bold text-red-700">{failCount}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-teal-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-teal-700">Data Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-500" />
                <span className="text-3xl font-bold text-teal-700">4</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">APIs Connected</p>
            </CardContent>
          </Card>
        </div>

        {/* Empty State */}
        {results.length === 0 && !loading && (
          <Card className="border-dashed border-2 border-slate-300 bg-white">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Building2 className="w-16 h-16 text-slate-300 mb-4" />
              <h3 className="text-xl font-semibold text-slate-700 mb-2">No Data Yet</h3>
              <p className="text-slate-500 text-center mb-6 max-w-md">
                Click "Refresh Data" to pull live property insights from connected APIs including HMO license data, valuations, and market analytics.
              </p>
              <Button onClick={refreshData} className="bg-teal-600 hover:bg-teal-700">
                <RefreshCw className="w-4 h-4 mr-2" />
                Load Property Data
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Property Results */}
        <div className="space-y-6">
          {results.map((r, i) => {
            const insights = r.insights
            const hmoLicence = insights?.propertyData?.hmoLicence
            const valuation = insights?.streetData?.valuation
            const propertyDetails = insights?.streetData?.propertyDetails
            const marketAnalytics = insights?.patma?.marketAnalytics
            const hmoViability = insights?.patma?.hmoViability
            const landRegistry = insights?.landRegistry
            const summary = insights?.summary

            return (
              <Card key={i} className="bg-white border-slate-200 overflow-hidden">
                {/* Property Header */}
                <CardHeader className="bg-slate-50 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-teal-100 rounded-lg">
                        <Building2 className="w-6 h-6 text-teal-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg text-slate-900">
                          {r.property?.address || r.property?.postcode || `Property ${i + 1}`}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {r.property?.postcode}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {summary?.isLicensedHMO && (
                        <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                          Licensed HMO
                        </Badge>
                      )}
                      <Badge variant={r.status === "success" ? "default" : "destructive"}>
                        {r.status === "success" ? (
                          <><CheckCircle className="w-3 h-3 mr-1" /> Success</>
                        ) : (
                          <><XCircle className="w-3 h-3 mr-1" /> Failed</>
                        )}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-6">
                  {r.status === "success" ? (
                    <div className="space-y-6">
                      {/* Data Completeness Bar */}
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-slate-600">Data Completeness</span>
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-teal-500 rounded-full transition-all"
                            style={{ width: `${summary?.dataCompleteness || 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-slate-700">
                          {summary?.dataCompleteness || 0}%
                        </span>
                      </div>

                      {/* Main Metrics Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* Estimated Value */}
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex items-center gap-2 mb-2">
                            <PoundSterling className="w-4 h-4 text-green-600" />
                            <span className="text-xs font-medium text-slate-500 uppercase">Est. Value</span>
                          </div>
                          <p className="text-xl font-bold text-slate-900">
                            {formatCurrency(summary?.estimatedValue || valuation?.estimatedValue)}
                          </p>
                        </div>

                        {/* Monthly Rent */}
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-medium text-slate-500 uppercase">Monthly Rent</span>
                          </div>
                          <p className="text-xl font-bold text-slate-900">
                            {formatCurrency(summary?.estimatedMonthlyRent || valuation?.estimatedRentalValue)}
                          </p>
                        </div>

                        {/* Rental Yield */}
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-4 h-4 text-purple-600" />
                            <span className="text-xs font-medium text-slate-500 uppercase">Rental Yield</span>
                          </div>
                          <p className="text-xl font-bold text-slate-900">
                            {marketAnalytics?.yieldEstimate ? `${marketAnalytics.yieldEstimate}%` : "N/A"}
                          </p>
                        </div>

                        {/* Property Type */}
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Home className="w-4 h-4 text-orange-600" />
                            <span className="text-xs font-medium text-slate-500 uppercase">Property Type</span>
                          </div>
                          <p className="text-xl font-bold text-slate-900 capitalize">
                            {summary?.propertyType || propertyDetails?.propertyType || "N/A"}
                          </p>
                        </div>
                      </div>

                      {/* HMO License Section */}
                      {hmoLicence && (
                        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                          <h4 className="text-sm font-semibold text-purple-800 mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            HMO License Details (PropertyData)
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-purple-600 uppercase">License Status</p>
                              <p className="font-semibold text-purple-900 capitalize">{hmoLicence.status || "N/A"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-purple-600 uppercase">Max Occupancy</p>
                              <p className="font-semibold text-purple-900 flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {hmoLicence.maxOccupancy || "N/A"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-purple-600 uppercase">Expiry Date</p>
                              <p className="font-semibold text-purple-900 flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {formatDate(hmoLicence.expiryDate)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-purple-600 uppercase">License Ref</p>
                              <p className="font-semibold text-purple-900 text-sm">{hmoLicence.reference || "N/A"}</p>
                            </div>
                          </div>
                          {hmoLicence.localAuthority && (
                            <p className="text-xs text-purple-600 mt-2">
                              Local Authority: {hmoLicence.localAuthority}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Land Registry Section */}
                      {landRegistry && landRegistry.transactions?.length > 0 && (
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Transaction History (HM Land Registry - FREE)
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-3">
                            <div>
                              <p className="text-xs text-blue-600 uppercase">Last Sale Price</p>
                              <p className="font-semibold text-blue-900">{formatCurrency(summary?.lastSalePrice)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-blue-600 uppercase">Last Sale Date</p>
                              <p className="font-semibold text-blue-900">{formatDate(summary?.lastSaleDate)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-blue-600 uppercase">Total Transactions</p>
                              <p className="font-semibold text-blue-900">{landRegistry.transactions.length}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Market Analytics Section */}
                      {marketAnalytics && (
                        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                          <h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Market Analytics (PaTMa)
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-green-600 uppercase">Average Rent</p>
                              <p className="font-semibold text-green-900">{formatCurrency(marketAnalytics.averageRent)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-green-600 uppercase">Yield Estimate</p>
                              <p className="font-semibold text-green-900">{marketAnalytics.yieldEstimate}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-green-600 uppercase">Demand Score</p>
                              <p className="font-semibold text-green-900">{marketAnalytics.demandScore}/100</p>
                            </div>
                            <div>
                              <p className="text-xs text-green-600 uppercase">Market Trend</p>
                              <p className="font-semibold text-green-900 capitalize">{marketAnalytics.trendDirection}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* HMO Viability Section */}
                      {hmoViability && (
                        <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                          <h4 className="text-sm font-semibold text-orange-800 mb-3 flex items-center gap-2">
                            <Home className="w-4 h-4" />
                            HMO Viability Analysis (PaTMa)
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-orange-600 uppercase">Viability Score</p>
                              <p className="font-semibold text-orange-900">{hmoViability.score}/100</p>
                            </div>
                            <div>
                              <p className="text-xs text-orange-600 uppercase">Potential Rooms</p>
                              <p className="font-semibold text-orange-900">{hmoViability.potentialRooms}</p>
                            </div>
                            <div>
                              <p className="text-xs text-orange-600 uppercase">Est. HMO Rent</p>
                              <p className="font-semibold text-orange-900">{formatCurrency(hmoViability.estimatedHMORent)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-orange-600 uppercase">Recommendation</p>
                              <p className="font-semibold text-orange-900 capitalize">{hmoViability.recommendation}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Valuation Details */}
                      {valuation && (
                        <div className="p-4 bg-teal-50 rounded-lg border border-teal-200">
                          <h4 className="text-sm font-semibold text-teal-800 mb-3 flex items-center gap-2">
                            <PoundSterling className="w-4 h-4" />
                            Property Valuation (StreetData)
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-teal-600 uppercase">Estimated Value</p>
                              <p className="font-semibold text-teal-900">{formatCurrency(valuation.estimatedValue)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-teal-600 uppercase">Est. Rental Value</p>
                              <p className="font-semibold text-teal-900">{formatCurrency(valuation.estimatedRentalValue)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-teal-600 uppercase">Confidence</p>
                              <p className="font-semibold text-teal-900 capitalize">{valuation.confidence}</p>
                            </div>
                            <div>
                              <p className="text-xs text-teal-600 uppercase">Last Updated</p>
                              <p className="font-semibold text-teal-900">{formatDate(valuation.lastUpdated)}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Raw Data Toggle */}
                      <details className="group">
                        <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700 flex items-center gap-2">
                          <span className="group-open:rotate-90 transition-transform">&#9654;</span>
                          View Raw API Response
                        </summary>
                        <pre className="mt-3 bg-slate-900 text-slate-100 p-4 rounded-lg text-xs overflow-x-auto max-h-64">
                          {JSON.stringify(insights, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-red-800">Error fetching data</p>
                        <p className="text-sm text-red-600">{r.error || "Unknown error occurred"}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
