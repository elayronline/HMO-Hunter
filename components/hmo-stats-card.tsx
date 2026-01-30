"use client"

import { useState, useEffect } from "react"
import {
  Building2,
  TrendingUp,
  Zap,
  Target,
  Home,
  MapPin,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BarChart3,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

interface HmoStats {
  summary: {
    totalProperties: number
    zooplaSourced: number
    hmoRegister: number
    potentialHMOs: number
    withImages: number
  }
  classification: {
    readyToGo: number
    valueAdd: number
  }
  yield: {
    high: number
    medium: number
  }
  byBedrooms: Record<string, number>
  topCities: { city: string; count: number }[]
  topDeals: {
    address: string
    city: string
    bedrooms: number
    dealScore: number
    classification: string
    monthlyRent: number
    yield: number
  }[]
}

interface HmoStatsCardProps {
  className?: string
  defaultExpanded?: boolean
}

export function HmoStatsCard({ className, defaultExpanded = true }: HmoStatsCardProps) {
  const [stats, setStats] = useState<HmoStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const fetchStats = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/hmo-stats")
      if (!response.ok) throw new Error("Failed to fetch stats")
      const data = await response.json()
      setStats(data)
    } catch (err) {
      setError("Unable to load HMO statistics")
      console.error("[HmoStats] Error:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  if (loading) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 text-teal-500 animate-spin" />
          <span className="ml-2 text-slate-600">Loading statistics...</span>
        </CardContent>
      </Card>
    )
  }

  if (error || !stats) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="py-8 text-center">
          <p className="text-slate-500">{error || "No data available"}</p>
          <Button variant="outline" size="sm" onClick={fetchStats} className="mt-3">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-teal-600 to-emerald-600 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h3 className="font-bold">HMO Portfolio Statistics</h3>
                <p className="text-sm text-white/80">Live data overview</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right mr-2">
                <div className="text-2xl font-bold">{stats.summary.totalProperties.toLocaleString()}</div>
                <div className="text-xs text-white/80">total properties</div>
              </div>
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
            {/* Summary Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatBox
                icon={Building2}
                label="Total Properties"
                value={stats.summary.totalProperties}
                color="slate"
              />
              <StatBox
                icon={Sparkles}
                label="Potential HMOs"
                value={stats.summary.potentialHMOs}
                color="purple"
              />
              <StatBox
                icon={Zap}
                label="Ready to Go"
                value={stats.classification.readyToGo}
                color="emerald"
              />
              <StatBox
                icon={Target}
                label="Value-Add"
                value={stats.classification.valueAdd}
                color="blue"
              />
            </div>

            {/* Classification Breakdown */}
            <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200">
              <h4 className="text-sm font-semibold text-purple-800 mb-3 flex items-center gap-2">
                <Target className="w-4 h-4" />
                By Classification
              </h4>
              <div className="space-y-2">
                <ProgressBar
                  label="Ready to Go"
                  value={stats.classification.readyToGo}
                  total={stats.summary.potentialHMOs}
                  color="emerald"
                />
                <ProgressBar
                  label="Value-Add"
                  value={stats.classification.valueAdd}
                  total={stats.summary.potentialHMOs}
                  color="blue"
                />
              </div>
            </div>

            {/* Yield Distribution */}
            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
              <h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                By Yield Band
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-white rounded-lg">
                  <div className="text-2xl font-bold text-emerald-600">{stats.yield.high}</div>
                  <div className="text-xs text-slate-500">High Yield (8%+)</div>
                </div>
                <div className="text-center p-3 bg-white rounded-lg">
                  <div className="text-2xl font-bold text-amber-600">{stats.yield.medium}</div>
                  <div className="text-xs text-slate-500">Medium Yield (5-8%)</div>
                </div>
              </div>
            </div>

            {/* Top Cities */}
            {stats.topCities.length > 0 && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Top Cities
                </h4>
                <div className="flex flex-wrap gap-2">
                  {stats.topCities.slice(0, 6).map((city) => (
                    <Badge
                      key={city.city}
                      variant="outline"
                      className="bg-white border-slate-200"
                    >
                      {city.city}: {city.count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Top Deals */}
            {stats.topDeals && stats.topDeals.length > 0 && (
              <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                <h4 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Top Deals (by score)
                </h4>
                <div className="space-y-2">
                  {stats.topDeals.slice(0, 5).map((deal, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-white rounded-lg border border-amber-100"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">
                          {deal.address}
                        </div>
                        <div className="text-xs text-slate-500">
                          {deal.city} · {deal.bedrooms} beds
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={cn(
                          "text-xs",
                          deal.classification === "ready_to_go"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-blue-100 text-blue-700"
                        )}>
                          {deal.classification === "ready_to_go" ? "Ready" : "Value-Add"}
                        </Badge>
                        <div className="text-right">
                          <div className="text-sm font-bold text-amber-600">{deal.dealScore}</div>
                          <div className="text-[10px] text-slate-400">score</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Data Sources */}
            <div className="text-xs text-slate-400 text-center pt-2 border-t border-slate-100">
              Sources: Zoopla ({stats.summary.zooplaSourced}) · HMO Register ({stats.summary.hmoRegister})
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

function StatBox({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: number
  color: "slate" | "purple" | "emerald" | "blue" | "amber"
}) {
  const colorClasses = {
    slate: "bg-slate-50 border-slate-200 text-slate-600",
    purple: "bg-purple-50 border-purple-200 text-purple-600",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-600",
    blue: "bg-blue-50 border-blue-200 text-blue-600",
    amber: "bg-amber-50 border-amber-200 text-amber-600",
  }

  return (
    <div className={cn("p-3 rounded-xl border", colorClasses[color])}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
    </div>
  )
}

function ProgressBar({
  label,
  value,
  total,
  color,
}: {
  label: string
  value: number
  total: number
  color: "emerald" | "blue" | "amber"
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0
  const colorClasses = {
    emerald: "bg-emerald-500",
    blue: "bg-blue-500",
    amber: "bg-amber-500",
  }

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-800">{value}</span>
      </div>
      <div className="h-2 bg-white rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", colorClasses[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
