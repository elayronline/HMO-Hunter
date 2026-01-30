"use client"

import { cn } from "@/lib/utils"
import type { Property } from "@/lib/types/database"

interface HeroMetricsBarProps {
  property: Property
  className?: string
}

type MetricStatus = "positive" | "neutral" | "negative"

function getYieldStatus(netYield: number | null): MetricStatus {
  if (!netYield) return "neutral"
  if (netYield >= 6) return "positive"
  if (netYield >= 4) return "neutral"
  return "negative"
}

function getCashflowStatus(cashflow: number | null): MetricStatus {
  if (cashflow === null) return "neutral"
  if (cashflow >= 200) return "positive"
  if (cashflow >= 0) return "neutral"
  return "negative"
}

function getPricePerRoomStatus(pricePerRoom: number | null): MetricStatus {
  if (!pricePerRoom) return "neutral"
  if (pricePerRoom < 60000) return "positive"
  if (pricePerRoom <= 80000) return "neutral"
  return "negative"
}

const statusColors: Record<MetricStatus, string> = {
  positive: "text-emerald-600",
  neutral: "text-slate-900",
  negative: "text-red-600",
}

const statusDots: Record<MetricStatus, string> = {
  positive: "bg-emerald-500",
  neutral: "bg-slate-300",
  negative: "bg-red-500",
}

export function HeroMetricsBar({ property, className }: HeroMetricsBarProps) {
  // Calculate metrics
  const monthlyRent = property.listing_type === "purchase"
    ? (property.estimated_rent_per_room ? property.estimated_rent_per_room * property.bedrooms : null)
    : property.price_pcm

  const grossYield = (() => {
    if (property.listing_type !== "purchase" || !property.purchase_price || !monthlyRent) return null
    return (monthlyRent * 12 / property.purchase_price) * 100
  })()

  const netYield = grossYield ? grossYield * 0.7 : null

  const monthlyCashflow = (() => {
    if (!property.purchase_price || !monthlyRent) return null
    const annualRent = monthlyRent * 12
    const costs = annualRent * 0.3
    const mortgage = property.purchase_price * 0.75 * 0.055
    return Math.round((annualRent - costs - mortgage) / 12)
  })()

  const pricePerRoom = property.purchase_price && property.bedrooms
    ? Math.round(property.purchase_price / property.bedrooms)
    : null

  const metrics = [
    {
      label: "Net Yield",
      value: netYield ? `${netYield.toFixed(1)}%` : "—",
      status: getYieldStatus(netYield),
    },
    {
      label: "Cashflow",
      value: monthlyCashflow !== null
        ? `${monthlyCashflow >= 0 ? "+" : ""}£${Math.abs(monthlyCashflow).toLocaleString()}`
        : "—",
      status: getCashflowStatus(monthlyCashflow),
    },
    {
      label: "Price/Room",
      value: pricePerRoom ? `£${(pricePerRoom / 1000).toFixed(0)}k` : "—",
      status: getPricePerRoomStatus(pricePerRoom),
    },
  ]

  return (
    <div className={cn("grid grid-cols-3 divide-x divide-slate-200 bg-slate-50", className)}>
      {metrics.map((metric, i) => (
        <div key={i} className="py-3 px-3 text-center">
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
            {metric.label}
          </p>
          <p className={cn("text-xl font-bold mt-1", statusColors[metric.status])}>
            {metric.value}
          </p>
          <div className="flex justify-center mt-1.5">
            <div className={cn("w-1.5 h-1.5 rounded-full", statusDots[metric.status])} />
          </div>
        </div>
      ))}
    </div>
  )
}
