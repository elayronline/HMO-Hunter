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

function getRentPerRoomStatus(rentPerRoom: number | null): MetricStatus {
  if (!rentPerRoom) return "neutral"
  if (rentPerRoom < 400) return "positive"
  if (rentPerRoom <= 600) return "neutral"
  return "negative"
}

const statusColors: Record<MetricStatus, string> = {
  positive: "text-emerald-600",
  neutral: "text-slate-900",
  negative: "text-red-600",
}

const statusLabels: Record<MetricStatus, string> = {
  positive: "Good",
  neutral: "Average",
  negative: "Poor",
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

  // A property with no asking price is not for sale — it is an existing HMO,
  // and what it is worth is a conversation with the owner. The old branch here
  // computed an R2HMO margin against the LHA rate, which was rent-to-rent
  // arithmetic for a model the platform no longer runs. What a buyer can
  // actually use is what the property is observed to achieve, so these are
  // measured figures with nothing derived from an assumption.
  const hasAskingPrice = property.purchase_price != null && property.purchase_price > 0
  const rentPerRoom =
    property.price_pcm && property.price_pcm > 0 && property.bedrooms && property.bedrooms > 0
      ? Math.round(property.price_pcm / property.bedrooms)
      : null

  const metrics = !hasAskingPrice ? [
    {
      label: "Let At",
      value: property.price_pcm ? `£${property.price_pcm.toLocaleString()}` : "—",
      status: "neutral" as const,
    },
    {
      label: "Rent/Room",
      value: rentPerRoom ? `£${rentPerRoom.toLocaleString()}` : "—",
      status: getRentPerRoomStatus(rentPerRoom),
    },
    {
      label: "Rooms",
      value: property.bedrooms ? String(property.bedrooms) : "—",
      status: "neutral" as const,
    },
  ] : [
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
        <div key={i} className="py-2.5 px-2 sm:py-3 sm:px-3 text-center min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate">
            {metric.label}
          </p>
          <p className={cn("text-lg sm:text-xl font-bold mt-0.5 sm:mt-1 truncate", statusColors[metric.status])}>
            {metric.value}
          </p>
          <div className="flex items-center justify-center gap-1 mt-1.5">
            <div className={cn("w-1.5 h-1.5 rounded-full", statusDots[metric.status])} />
            <span className={cn("text-[10px] font-medium", statusColors[metric.status])}>
              {statusLabels[metric.status]}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
