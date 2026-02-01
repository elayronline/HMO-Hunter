"use client"

import { useState, useEffect } from "react"
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Home,
  PoundSterling,
  Calendar,
  MapPin,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
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
import type { AreaStatistics, SoldPrice } from "@/lib/ingestion/adapters/zoopla"

interface AreaStatisticsCardProps {
  postcode?: string
  area?: string
  className?: string
  defaultExpanded?: boolean
}

export function AreaStatisticsCard({
  postcode,
  area,
  className,
  defaultExpanded = false,
}: AreaStatisticsCardProps) {
  const [stats, setStats] = useState<AreaStatistics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [showAllSales, setShowAllSales] = useState(false)

  const fetchStats = async () => {
    if (!postcode && !area) return

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (postcode) params.append("postcode", postcode)
      else if (area) params.append("area", area)

      const response = await fetch(`/api/area-stats?${params.toString()}`)

      if (!response.ok) {
        throw new Error("Failed to fetch area statistics")
      }

      const data = await response.json()
      setStats(data)
    } catch (err) {
      console.error("[AreaStats] Error:", err)
      setError("Unable to load area statistics")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [postcode, area])

  const formatPrice = (price: number) => {
    if (price >= 1000000) {
      return `£${(price / 1000000).toFixed(2)}M`
    }
    return `£${(price / 1000).toFixed(0)}k`
  }

  const formatChange = (change: number) => {
    const prefix = change > 0 ? "+" : ""
    return `${prefix}${change.toFixed(1)}%`
  }

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-4 h-4 text-emerald-500" />
    if (change < 0) return <TrendingDown className="w-4 h-4 text-red-500" />
    return <Minus className="w-4 h-4 text-slate-400" />
  }

  const getTrendColor = (change: number) => {
    if (change > 0) return "text-emerald-600"
    if (change < 0) return "text-red-600"
    return "text-slate-500"
  }

  if (!postcode && !area) {
    return null
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h3 className="font-bold">Area Statistics</h3>
                <p className="text-sm text-white/80">
                  {stats?.area || postcode || area}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {stats && (
                <div className="text-right mr-2">
                  <div className="text-lg font-bold">
                    {formatPrice(stats.averagePrice)}
                  </div>
                  <div className="text-xs text-white/80">avg price</div>
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
                <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                <span className="ml-2 text-slate-600">Loading statistics...</span>
              </div>
            )}

            {error && (
              <div className="text-center py-6 text-slate-500">
                <p>{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchStats}
                  className="mt-2"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              </div>
            )}

            {stats && !loading && (
              <>
                {/* Price Summary Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                    <div className="flex items-center gap-2 text-blue-600 mb-1">
                      <PoundSterling className="w-4 h-4" />
                      <span className="text-xs font-medium">Avg Price (1yr)</span>
                    </div>
                    <div className="text-xl font-bold text-slate-900">
                      {formatPrice(stats.averagePrice)}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {getTrendIcon(stats.priceChange1Year)}
                      <span className={cn("text-sm font-medium", getTrendColor(stats.priceChange1Year))}>
                        {formatChange(stats.priceChange1Year)}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2 text-slate-600 mb-1">
                      <Calendar className="w-4 h-4" />
                      <span className="text-xs font-medium">5 Year Avg</span>
                    </div>
                    <div className="text-xl font-bold text-slate-900">
                      {formatPrice(stats.averagePrice5Year)}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {getTrendIcon(stats.priceChange5Year)}
                      <span className={cn("text-sm font-medium", getTrendColor(stats.priceChange5Year))}>
                        {formatChange(stats.priceChange5Year)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sales Activity */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Home className="w-4 h-4" />
                      <span className="font-medium">Sales Activity</span>
                    </div>
                    {stats.turnover && (
                      <Badge variant="outline" className="text-xs">
                        {stats.turnover} turnover
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-2xl font-bold text-slate-900">
                        {stats.numberOfSales1Year}
                      </div>
                      <div className="text-xs text-slate-500">Sales (1 year)</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-slate-900">
                        {stats.numberOfSales5Year}
                      </div>
                      <div className="text-xs text-slate-500">Sales (5 years)</div>
                    </div>
                  </div>
                </div>

                {/* Zed Index */}
                {stats.zedIndex > 0 && (
                  <div className="p-3 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl border border-purple-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-purple-600 font-medium mb-1">
                          Area Price Index
                        </div>
                        <div className="text-2xl font-bold text-purple-700">
                          {formatPrice(stats.zedIndex)}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                          Zed Index
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}

                {/* Graph Links */}
                {(stats.averageValuesGraphUrl || stats.valueChangeGraphUrl) && (
                  <div className="flex flex-wrap gap-2">
                    {stats.averageValuesGraphUrl && (
                      <a
                        href={stats.averageValuesGraphUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100 transition-colors"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        Value Graph
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {stats.valueChangeGraphUrl && (
                      <a
                        href={stats.valueChangeGraphUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm hover:bg-indigo-100 transition-colors"
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                        Trend Graph
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}

                {/* Recent Sold Prices */}
                {stats.recentSoldPrices && stats.recentSoldPrices.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-slate-700">Recent Sales</h4>
                      {stats.recentSoldPrices.length > 5 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowAllSales(!showAllSales)}
                          className="text-xs"
                        >
                          {showAllSales ? "Show Less" : `Show All (${stats.recentSoldPrices.length})`}
                          {showAllSales ? (
                            <ChevronUp className="w-3 h-3 ml-1" />
                          ) : (
                            <ChevronDown className="w-3 h-3 ml-1" />
                          )}
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {(showAllSales ? stats.recentSoldPrices : stats.recentSoldPrices.slice(0, 5)).map(
                        (sale, idx) => (
                          <SoldPriceRow key={idx} sale={sale} />
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* Last Updated */}
                <div className="text-xs text-slate-400 text-center pt-2 border-t border-slate-100">
                  Updated {new Date(stats.fetchedAt).toLocaleDateString()}
                </div>
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

function SoldPriceRow({ sale }: { sale: SoldPrice }) {
  return (
    <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-800 truncate">
          {sale.address}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>{sale.bedrooms} bed</span>
          <span>•</span>
          <span>{sale.propertyType}</span>
          <span>•</span>
          <span>{new Date(sale.date).toLocaleDateString()}</span>
        </div>
      </div>
      <div className="text-right ml-3">
        <div className="font-bold text-slate-900">
          £{sale.price.toLocaleString()}
        </div>
      </div>
    </div>
  )
}
