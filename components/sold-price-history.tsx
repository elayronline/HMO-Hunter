"use client"

import { useState, useEffect } from "react"
import {
  History,
  TrendingUp,
  TrendingDown,
  Home,
  Calendar,
  MapPin,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  BarChart3,
  PoundSterling,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import type { SoldPrice } from "@/lib/ingestion/adapters/zoopla"

interface SoldPriceHistoryProps {
  postcode?: string
  area?: string
  currentPrice?: number
  className?: string
  defaultExpanded?: boolean
  maxItems?: number
}

interface SoldPriceStats {
  averagePrice: number
  medianPrice: number
  minPrice: number
  maxPrice: number
  totalSales: number
}

export function SoldPriceHistory({
  postcode,
  area,
  currentPrice,
  className,
  defaultExpanded = false,
  maxItems = 10,
}: SoldPriceHistoryProps) {
  const [prices, setPrices] = useState<SoldPrice[]>([])
  const [stats, setStats] = useState<SoldPriceStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [showAll, setShowAll] = useState(false)

  const fetchPrices = async () => {
    if (!postcode && !area) return

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (postcode) params.append("postcode", postcode)
      else if (area) params.append("area", area)
      params.append("limit", maxItems.toString())

      const response = await fetch(`/api/sold-prices?${params.toString()}`)

      if (!response.ok) {
        throw new Error("Failed to fetch sold prices")
      }

      const data = await response.json()
      setPrices(data.prices || [])
      setStats(data.stats || null)
    } catch (err) {
      console.error("[SoldPriceHistory] Error:", err)
      setError("Unable to load sold prices")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isExpanded && prices.length === 0 && !loading) {
      fetchPrices()
    }
  }, [isExpanded, postcode, area])

  const formatPrice = (price: number) => {
    if (price >= 1000000) {
      return `£${(price / 1000000).toFixed(2)}M`
    }
    return `£${(price / 1000).toFixed(0)}k`
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
      })
    } catch {
      return dateStr
    }
  }

  const getComparisonBadge = (price: number) => {
    if (!currentPrice || !stats) return null

    const diff = ((currentPrice - price) / price) * 100

    if (diff > 10) {
      return (
        <Badge className="bg-red-50 text-red-600 border-red-200 text-xs">
          <TrendingUp className="w-3 h-3 mr-1" />
          {diff.toFixed(0)}% above
        </Badge>
      )
    } else if (diff < -10) {
      return (
        <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200 text-xs">
          <TrendingDown className="w-3 h-3 mr-1" />
          {Math.abs(diff).toFixed(0)}% below
        </Badge>
      )
    }
    return null
  }

  if (!postcode && !area) {
    return null
  }

  const displayPrices = showAll ? prices : prices.slice(0, 5)

  return (
    <Card className={cn("overflow-hidden", className)}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <History className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h3 className="font-bold">Sold Price History</h3>
                <p className="text-sm text-white/80">
                  {postcode || area} area
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {stats && (
                <div className="text-right mr-2">
                  <div className="text-lg font-bold">
                    {formatPrice(stats.averagePrice)}
                  </div>
                  <div className="text-xs text-white/80">avg sold</div>
                </div>
              )}
              <div className={cn(
                "p-1.5 rounded-full transition-transform",
                isExpanded ? "bg-white/20 rotate-180" : "bg-white/10"
              )}>
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4 space-y-4">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 text-orange-500 animate-spin" />
                <span className="ml-2 text-slate-600">Loading sold prices...</span>
              </div>
            )}

            {error && (
              <div className="text-center py-6 text-slate-500">
                <p>{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchPrices}
                  className="mt-2"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              </div>
            )}

            {stats && !loading && (
              <>
                {/* Stats Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-100">
                    <div className="flex items-center gap-2 text-orange-600 mb-1">
                      <BarChart3 className="w-4 h-4" />
                      <span className="text-xs font-medium">Average</span>
                    </div>
                    <div className="text-xl font-bold text-slate-900">
                      {formatPrice(stats.averagePrice)}
                    </div>
                  </div>

                  <div className="p-3 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2 text-slate-600 mb-1">
                      <PoundSterling className="w-4 h-4" />
                      <span className="text-xs font-medium">Median</span>
                    </div>
                    <div className="text-xl font-bold text-slate-900">
                      {formatPrice(stats.medianPrice)}
                    </div>
                  </div>
                </div>

                {/* Price Range */}
                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500">Price Range</span>
                    <span className="text-xs text-slate-500">{stats.totalSales} sales</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">
                      {formatPrice(stats.minPrice)}
                    </span>
                    <div className="flex-1 mx-3 h-2 bg-gradient-to-r from-emerald-300 via-amber-300 to-red-300 rounded-full" />
                    <span className="text-sm font-medium text-slate-700">
                      {formatPrice(stats.maxPrice)}
                    </span>
                  </div>
                </div>

                {/* Current Price Comparison */}
                {currentPrice && (
                  <div className={cn(
                    "p-3 rounded-xl border",
                    currentPrice < stats.averagePrice
                      ? "bg-emerald-50 border-emerald-200"
                      : currentPrice > stats.averagePrice
                      ? "bg-amber-50 border-amber-200"
                      : "bg-slate-50 border-slate-200"
                  )}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-slate-500">This property</div>
                        <div className="text-lg font-bold text-slate-900">
                          £{currentPrice.toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        {currentPrice < stats.averagePrice ? (
                          <div className="text-emerald-600">
                            <TrendingDown className="w-5 h-5 inline mr-1" />
                            <span className="font-medium">
                              {(((stats.averagePrice - currentPrice) / stats.averagePrice) * 100).toFixed(0)}% below avg
                            </span>
                          </div>
                        ) : currentPrice > stats.averagePrice ? (
                          <div className="text-amber-600">
                            <TrendingUp className="w-5 h-5 inline mr-1" />
                            <span className="font-medium">
                              {(((currentPrice - stats.averagePrice) / stats.averagePrice) * 100).toFixed(0)}% above avg
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500">At average</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Recent Sales List */}
                {prices.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-slate-700">Recent Sales</h4>
                      {prices.length > 5 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowAll(!showAll)}
                          className="text-xs"
                        >
                          {showAll ? "Show Less" : `Show All (${prices.length})`}
                          {showAll ? (
                            <ChevronUp className="w-3 h-3 ml-1" />
                          ) : (
                            <ChevronDown className="w-3 h-3 ml-1" />
                          )}
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {displayPrices.map((sale, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-100 hover:border-orange-200 hover:bg-orange-50/50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Home className="w-4 h-4 text-slate-400 flex-shrink-0" />
                              <span className="text-sm font-medium text-slate-800 truncate">
                                {sale.address}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {sale.postcode}
                              </span>
                              <span>•</span>
                              <span>{sale.bedrooms} bed {sale.propertyType}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(sale.date)}
                              </span>
                            </div>
                          </div>
                          <div className="text-right ml-3">
                            <div className="font-bold text-slate-900">
                              £{sale.price.toLocaleString()}
                            </div>
                            {getComparisonBadge(sale.price)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {prices.length === 0 && !loading && (
                  <div className="text-center py-6 text-slate-500">
                    <History className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p>No recent sales data available</p>
                  </div>
                )}

                {/* Data Attribution */}
                <div className="text-xs text-slate-400 text-center pt-2 border-t border-slate-100">
                  Data from Zoopla • Updated periodically
                </div>
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
