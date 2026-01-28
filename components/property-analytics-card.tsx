"use client"

import { useState, useEffect } from "react"
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Target,
  PoundSterling,
  Users,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Sparkles,
  ChevronRight,
  Flame,
  Zap,
  Activity,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { Property } from "@/lib/types/database"

// ═══════════════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

interface PropertyAnalyticsCardProps {
  property: Property
  properties: Property[]
  comparisonMetric: "yield" | "rent" | "bedrooms"
  onMetricChange: (metric: "yield" | "rent" | "bedrooms") => void
  onPropertySelect: (property: Property) => void
  calculateROI: (property: Property) => string | number
  getMonthlyRent: (property: Property) => number
  className?: string
}

interface AreaAverages {
  avgYield: number
  avgRentPerRoom: number
  avgDealScore: number
  avgBedrooms: number
  minYield: number
  maxYield: number
}

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATED PROGRESS BAR COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

function AnimatedProgressBar({
  value,
  maxValue,
  areaAverage,
  color,
  delay = 0,
}: {
  value: number
  maxValue: number
  areaAverage: number
  color: "emerald" | "amber" | "red"
  delay?: number
}) {
  const [width, setWidth] = useState(0)
  const percentage = Math.min((value / maxValue) * 100, 100)
  const avgPercentage = Math.min((areaAverage / maxValue) * 100, 100)

  useEffect(() => {
    const timer = setTimeout(() => setWidth(percentage), delay)
    return () => clearTimeout(timer)
  }, [percentage, delay])

  const colorClasses = {
    emerald: "from-emerald-400 to-emerald-600",
    amber: "from-amber-400 to-amber-500",
    red: "from-red-400 to-red-500",
  }

  const glowClasses = {
    emerald: "shadow-emerald-500/30",
    amber: "shadow-amber-500/30",
    red: "shadow-red-500/30",
  }

  return (
    <div className="relative h-3 bg-slate-100 rounded-full overflow-visible">
      {/* Area average marker */}
      <div
        className="absolute top-1/2 -translate-y-1/2 z-20 flex flex-col items-center"
        style={{ left: `${avgPercentage}%` }}
      >
        <div className="w-0.5 h-5 bg-slate-400/60" />
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-slate-500 border-2 border-white shadow-sm cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Area average
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Animated progress bar */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 rounded-full bg-gradient-to-r transition-all duration-1000 ease-out shadow-lg",
          colorClasses[color],
          glowClasses[color]
        )}
        style={{ width: `${width}%` }}
      >
        {/* Shine effect */}
        <div className="absolute inset-0 rounded-full overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-shimmer" />
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// METRIC COMPARISON ROW
// ═══════════════════════════════════════════════════════════════════════════

function MetricRow({
  label,
  icon: Icon,
  value,
  areaAverage,
  format,
  tooltip,
  delay = 0,
}: {
  label: string
  icon: React.ElementType
  value: number
  areaAverage: number
  format: (v: number) => string
  tooltip: string
  delay?: number
}) {
  const diff = areaAverage !== 0 ? ((value - areaAverage) / areaAverage) * 100 : 0
  const isAbove = value > areaAverage
  const isClose = Math.abs(diff) < 5

  const color = isClose ? "amber" : isAbove ? "emerald" : "red"
  const diffColor = isClose ? "text-amber-600" : isAbove ? "text-emerald-600" : "text-red-500"
  const bgColor = isClose ? "bg-amber-50" : isAbove ? "bg-emerald-50" : "bg-red-50"
  const maxValue = Math.max(value, areaAverage) * 1.2

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-2">
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 cursor-help">
                <div className={cn("p-1.5 rounded-lg transition-colors", bgColor)}>
                  <Icon className={cn("w-3.5 h-3.5", diffColor)} />
                </div>
                <span className="text-sm font-medium text-slate-700">{label}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs max-w-[200px]">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-900 tabular-nums">{format(value)}</span>
          <div className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold transition-all",
            bgColor, diffColor
          )}>
            {isClose ? (
              <Minus className="w-3 h-3" />
            ) : isAbove ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            <span>{Math.abs(diff).toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <AnimatedProgressBar
        value={value}
        maxValue={maxValue}
        areaAverage={areaAverage}
        color={color}
        delay={delay}
      />

      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-slate-400">0</span>
        <span className="text-[10px] text-slate-400">Area avg: {format(areaAverage)}</span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// YIELD GAUGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

function YieldGauge({
  value,
  min,
  max,
  areaAverage,
}: {
  value: number
  min: number
  max: number
  areaAverage: number
}) {
  const [animatedPosition, setAnimatedPosition] = useState(0)
  const range = max - min || 1
  const position = ((value - min) / range) * 100
  const clampedPosition = Math.max(5, Math.min(95, position))

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedPosition(clampedPosition), 100)
    return () => clearTimeout(timer)
  }, [clampedPosition])

  const getPerformanceLabel = () => {
    if (clampedPosition >= 66) return { text: "Top Performer", color: "text-emerald-600", icon: Flame }
    if (clampedPosition >= 33) return { text: "Average", color: "text-amber-600", icon: Activity }
    return { text: "Below Average", color: "text-red-500", icon: TrendingDown }
  }

  const performance = getPerformanceLabel()
  const PerformanceIcon = performance.icon

  return (
    <div className="relative p-4 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl border border-slate-200/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-white rounded-xl shadow-sm">
            <BarChart3 className="w-4 h-4 text-teal-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Yield Position</p>
            <p className="text-xs text-slate-500">vs. comparable properties</p>
          </div>
        </div>
        <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white shadow-sm", performance.color)}>
          <PerformanceIcon className="w-3.5 h-3.5" />
          <span className="text-xs font-semibold">{performance.text}</span>
        </div>
      </div>

      {/* Gauge track */}
      <div className="relative h-8 rounded-full overflow-hidden shadow-inner">
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to right, #fecaca 0%, #fde68a 35%, #bbf7d0 65%, #6ee7b7 100%)"
          }}
        />

        {/* Animated marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 transition-all duration-1000 ease-out"
          style={{ left: `${animatedPosition}%` }}
        >
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute inset-0 w-8 h-8 -translate-x-1/2 bg-white/40 rounded-full blur-md" />
            {/* Marker */}
            <div className="relative w-7 h-7 -translate-x-1/2 rounded-full bg-white border-[3px] border-slate-800 shadow-xl flex items-center justify-center">
              <span className="text-[9px] font-bold text-slate-800">{value.toFixed(1)}</span>
            </div>
            {/* Label */}
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <span className="text-xs font-bold text-slate-700">{value.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scale labels */}
      <div className="flex justify-between mt-8 px-1">
        <div className="text-center">
          <p className="text-xs font-semibold text-red-500">{min.toFixed(1)}%</p>
          <p className="text-[10px] text-slate-400">Low</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold text-amber-500">{areaAverage.toFixed(1)}%</p>
          <p className="text-[10px] text-slate-400">Avg</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold text-emerald-500">{max.toFixed(1)}%</p>
          <p className="text-[10px] text-slate-400">High</p>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// QUICK INSIGHT BANNER
// ═══════════════════════════════════════════════════════════════════════════

function InsightBanner({
  insights,
}: {
  insights: { text: string; type: "good" | "neutral" | "bad" }[]
}) {
  const goodCount = insights.filter(i => i.type === "good").length
  const badCount = insights.filter(i => i.type === "bad").length
  const isPositive = goodCount >= badCount

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border p-4",
      isPositive
        ? "bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200/50"
        : "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200/50"
    )}>
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }} />
      </div>

      <div className="relative flex items-start gap-3">
        <div className={cn(
          "p-2 rounded-xl shrink-0",
          isPositive ? "bg-emerald-100" : "bg-amber-100"
        )}>
          <Sparkles className={cn("w-5 h-5", isPositive ? "text-emerald-600" : "text-amber-600")} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 mb-1">Quick Analysis</p>
          <p className="text-sm text-slate-600 leading-relaxed">
            This property{" "}
            {insights.map((insight, i) => (
              <span key={i}>
                {i > 0 && (i === insights.length - 1 ? ", and " : ", ")}
                <span className={cn(
                  "font-semibold",
                  insight.type === "good" ? "text-emerald-700" :
                  insight.type === "bad" ? "text-red-600" : "text-slate-700"
                )}>
                  {insight.text}
                </span>
              </span>
            ))}
            .
          </p>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPARISON PROPERTY CARD
// ═══════════════════════════════════════════════════════════════════════════

function ComparisonCard({
  property,
  isSelected,
  value,
  maxValue,
  format,
  metricLabel,
  rent,
  yield: yieldVal,
  onClick,
}: {
  property: Property
  isSelected: boolean
  value: number
  maxValue: number
  format: (v: number) => string
  metricLabel: string
  rent: number
  yield: number
  onClick: () => void
}) {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0
  const shortAddr = property.address
    ? property.address.split(",")[0].slice(0, 24)
    : property.postcode?.split(" ")[0] || "Property"

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative rounded-2xl transition-all duration-300 cursor-pointer",
        isSelected
          ? "bg-gradient-to-br from-teal-50 to-emerald-50 border-2 border-teal-400 shadow-lg shadow-teal-100/50 scale-[1.02]"
          : "bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md hover:scale-[1.01]"
      )}
    >
      <div className="flex gap-3 p-3">
        {/* Property Image */}
        <div className={cn(
          "relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-slate-100",
          isSelected && "ring-2 ring-teal-400 ring-offset-2"
        )}>
          <img
            src={property.primary_image || property.images?.[0] || "/placeholder.jpg"}
            alt={shortAddr}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          />

          {/* Hover overlay with metrics */}
          {!isSelected && (
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-end p-2">
              <span className="text-white text-[10px] font-medium">{yieldVal.toFixed(1)}% yield</span>
              <span className="text-white/80 text-[9px]">£{rent.toLocaleString()}/mo</span>
            </div>
          )}

          {/* Selected badge */}
          {isSelected && (
            <div className="absolute top-1 left-1 bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-lg">
              YOU
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-sm font-semibold truncate mb-0.5",
            isSelected ? "text-teal-800" : "text-slate-800"
          )}>
            {shortAddr}
          </p>
          <p className="text-xs text-slate-500 mb-2">
            {property.bedrooms} bed{property.bedrooms !== 1 ? "s" : ""} · £{rent.toLocaleString()}/mo
          </p>

          {/* Progress bar */}
          <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out",
                isSelected
                  ? "bg-gradient-to-r from-teal-400 to-emerald-500"
                  : "bg-gradient-to-r from-slate-300 to-slate-400"
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Metric value */}
        <div className="flex flex-col items-end justify-center shrink-0">
          <span className={cn(
            "text-lg font-bold tabular-nums",
            isSelected ? "text-teal-600" : "text-slate-700"
          )}>
            {format(value)}
          </span>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">
            {metricLabel}
          </span>
        </div>
      </div>

      {/* Selected glow effect */}
      {isSelected && (
        <div className="absolute inset-0 rounded-2xl ring-2 ring-teal-400/50 animate-pulse pointer-events-none" />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function PropertyAnalyticsCard({
  property,
  properties,
  comparisonMetric,
  onMetricChange,
  onPropertySelect,
  calculateROI,
  getMonthlyRent,
  className,
}: PropertyAnalyticsCardProps) {

  // Calculate area averages
  const calculateAreaAverages = (): AreaAverages => {
    if (properties.length === 0) {
      return { avgYield: 0, avgRentPerRoom: 0, avgDealScore: 0, avgBedrooms: 0, minYield: 0, maxYield: 0 }
    }

    const yields = properties.map(p => parseFloat(calculateROI(p) as string) || 0)
    const rentsPerRoom = properties.map(p => {
      const rent = getMonthlyRent(p)
      return p.bedrooms > 0 ? rent / p.bedrooms : rent
    })
    const dealScores = properties.map(p => p.deal_score || 0)
    const bedrooms = properties.map(p => p.bedrooms || 0)

    return {
      avgYield: yields.reduce((a, b) => a + b, 0) / yields.length,
      avgRentPerRoom: rentsPerRoom.reduce((a, b) => a + b, 0) / rentsPerRoom.length,
      avgDealScore: dealScores.reduce((a, b) => a + b, 0) / dealScores.length,
      avgBedrooms: bedrooms.reduce((a, b) => a + b, 0) / bedrooms.length,
      minYield: Math.min(...yields.filter(y => y > 0)),
      maxYield: Math.max(...yields),
    }
  }

  const area = calculateAreaAverages()
  const propYield = parseFloat(calculateROI(property) as string) || 0
  const propRent = getMonthlyRent(property)
  const propRentPerRoom = property.bedrooms > 0 ? propRent / property.bedrooms : propRent
  const propDealScore = property.deal_score || 0

  // Generate insights
  const generateInsights = () => {
    const insights: { text: string; type: "good" | "neutral" | "bad" }[] = []

    const yieldDiff = area.avgYield > 0 ? ((propYield - area.avgYield) / area.avgYield) * 100 : 0
    if (Math.abs(yieldDiff) < 5) {
      insights.push({ text: "matches area average in yield", type: "neutral" })
    } else if (yieldDiff > 0) {
      insights.push({ text: `outperforms in yield (+${yieldDiff.toFixed(0)}%)`, type: "good" })
    } else {
      insights.push({ text: `below average in yield (${yieldDiff.toFixed(0)}%)`, type: "bad" })
    }

    const rentDiff = area.avgRentPerRoom > 0 ? ((propRentPerRoom - area.avgRentPerRoom) / area.avgRentPerRoom) * 100 : 0
    if (Math.abs(rentDiff) < 5) {
      insights.push({ text: "matches rent per room", type: "neutral" })
    } else if (rentDiff > 0) {
      insights.push({ text: `higher rent per room (+${rentDiff.toFixed(0)}%)`, type: "good" })
    } else {
      insights.push({ text: `lower rent per room (${rentDiff.toFixed(0)}%)`, type: "bad" })
    }

    if (propDealScore >= 70) {
      insights.push({ text: "has a strong deal score", type: "good" })
    } else if (propDealScore >= 40) {
      insights.push({ text: "has a moderate deal score", type: "neutral" })
    } else if (propDealScore > 0) {
      insights.push({ text: "has a low deal score", type: "bad" })
    }

    return insights
  }

  // Get comparable properties
  const getComparables = () => {
    return properties
      .filter(p => p.id !== property.id)
      .slice(0, 4)
  }

  const comparables = getComparables()
  const allProps = [property, ...comparables]

  // Metric helpers
  const getMetricValue = (p: Property) => {
    if (comparisonMetric === "yield") return parseFloat(calculateROI(p) as string) || 0
    if (comparisonMetric === "rent") {
      const rent = getMonthlyRent(p)
      return p.bedrooms > 0 ? Math.round(rent / p.bedrooms) : rent
    }
    return p.bedrooms || 0
  }

  const formatMetric = (v: number) => {
    if (comparisonMetric === "yield") return `${v.toFixed(1)}%`
    if (comparisonMetric === "rent") return `£${v.toLocaleString()}`
    return `${v}`
  }

  const getMetricLabel = () => {
    if (comparisonMetric === "yield") return "yield"
    if (comparisonMetric === "rent") return "per room"
    return "beds"
  }

  const sorted = [...allProps].sort((a, b) => getMetricValue(b) - getMetricValue(a))
  const topValue = sorted.length > 0 ? getMetricValue(sorted[0]) : 1

  return (
    <div className={cn("space-y-5", className)}>
      {/* ═══════════════════════════════════════════════════════════════════
          SECTION HEADER
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl shadow-lg shadow-teal-500/25">
          <BarChart3 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900">Analytics & Comparison</h3>
          <p className="text-xs text-slate-500">Property performance vs. area</p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          HERO YIELD CARD
      ═══════════════════════════════════════════════════════════════════ */}
      <div className={cn(
        "relative overflow-hidden rounded-2xl p-5 border-2",
        propYield >= area.avgYield
          ? "bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 border-emerald-200"
          : "bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 border-amber-200"
      )}>
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/30 rounded-full blur-2xl" />
        <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-white/20 rounded-full blur-xl" />

        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Percent className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gross Yield</span>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs max-w-[220px]">
                    Annual rental income as a percentage of purchase price. Higher yield = better cash flow potential.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="text-5xl font-black text-slate-900 tracking-tight mb-1">
              {propYield.toFixed(1)}%
            </div>
            <p className="text-sm text-slate-500">
              Area average: <span className="font-semibold">{area.avgYield.toFixed(1)}%</span>
            </p>
          </div>

          {/* Difference badge */}
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-xl shadow-lg",
            propYield >= area.avgYield
              ? "bg-emerald-500 text-white"
              : "bg-red-500 text-white"
          )}>
            {propYield >= area.avgYield ? (
              <TrendingUp className="w-5 h-5" />
            ) : (
              <TrendingDown className="w-5 h-5" />
            )}
            <span className="text-lg font-bold">
              {Math.abs(((propYield - area.avgYield) / area.avgYield) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          METRICS COMPARISON
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Target className="w-4 h-4 text-teal-600" />
          Performance Metrics
        </h4>

        <div className="space-y-5">
          <MetricRow
            label="Rent per Room"
            icon={PoundSterling}
            value={Math.round(propRentPerRoom)}
            areaAverage={Math.round(area.avgRentPerRoom)}
            format={(v) => `£${v.toLocaleString()}`}
            tooltip="Monthly rent divided by number of bedrooms. Higher = better income per room."
            delay={0}
          />
          <MetricRow
            label="Deal Score"
            icon={Target}
            value={propDealScore}
            areaAverage={Math.round(area.avgDealScore)}
            format={(v) => `${v}/100`}
            tooltip="Composite score based on yield, condition, location, and market fundamentals."
            delay={100}
          />
          <MetricRow
            label="Max Occupancy"
            icon={Users}
            value={property.lettable_rooms || property.bedrooms || 0}
            areaAverage={parseFloat(area.avgBedrooms.toFixed(1))}
            format={(v) => `${v} rooms`}
            tooltip="Maximum lettable rooms for HMO licensing purposes."
            delay={200}
          />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          YIELD POSITION GAUGE
      ═══════════════════════════════════════════════════════════════════ */}
      <YieldGauge
        value={propYield}
        min={area.minYield || 0}
        max={area.maxYield || 10}
        areaAverage={area.avgYield}
      />

      {/* ═══════════════════════════════════════════════════════════════════
          QUICK INSIGHT
      ═══════════════════════════════════════════════════════════════════ */}
      <InsightBanner insights={generateInsights()} />

      {/* ═══════════════════════════════════════════════════════════════════
          PROPERTY COMPARISON
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700">Compare Properties</h4>

          {/* Segmented control */}
          <div className="flex bg-slate-100 rounded-xl p-1">
            {(["yield", "rent", "bedrooms"] as const).map((metric) => (
              <button
                key={metric}
                onClick={() => onMetricChange(metric)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                  comparisonMetric === metric
                    ? "bg-white text-teal-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {metric === "yield" ? "Yield" : metric === "rent" ? "Rent" : "Beds"}
              </button>
            ))}
          </div>
        </div>

        {comparables.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No comparable properties found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((p) => (
              <ComparisonCard
                key={p.id}
                property={p}
                isSelected={p.id === property.id}
                value={getMetricValue(p)}
                maxValue={topValue}
                format={formatMetric}
                metricLabel={getMetricLabel()}
                rent={Math.round(getMonthlyRent(p))}
                yield={parseFloat(calculateROI(p) as string) || 0}
                onClick={() => {
                  if (p.id !== property.id) onPropertySelect(p)
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
