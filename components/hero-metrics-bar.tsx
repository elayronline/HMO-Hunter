"use client"

import { cn } from "@/lib/utils"
import type { Property } from "@/lib/types/database"
import { getLhaMonthlyRate } from "@/lib/data/lha-rates"

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

function getR2RMarginStatus(margin: number | null): MetricStatus {
  if (margin === null) return "neutral"
  if (margin >= 30) return "positive"
  if (margin >= 10) return "neutral"
  return "negative"
}

function getSpreadStatus(spread: number | null): MetricStatus {
  if (spread === null) return "neutral"
  if (spread >= 300) return "positive"
  if (spread >= 0) return "neutral"
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

  // R2R metrics for rent properties
  const isRent = property.listing_type === "rent"
  let r2rMargin: number | null = null
  let monthlySpread: number | null = null
  let rentPerRoom: number | null = null

  if (isRent && property.price_pcm && property.price_pcm > 0 && property.bedrooms && property.bedrooms > 0) {
    const lhaRate = property.city
      ? getLhaMonthlyRate(property.city, property.bedrooms, property.postcode)
      : null
    if (lhaRate) {
      monthlySpread = Math.round(lhaRate - property.price_pcm)
      r2rMargin = Math.round(((lhaRate - property.price_pcm) / property.price_pcm) * 100)
    }
    rentPerRoom = Math.round(property.price_pcm / property.bedrooms)
  }

  const metrics = isRent ? [
    {
      label: "R2R Margin",
      value: r2rMargin !== null ? `${r2rMargin >= 0 ? "+" : ""}${r2rMargin}%` : "—",
      status: getR2RMarginStatus(r2rMargin),
    },
    {
      label: "Mo. Spread",
      value: monthlySpread !== null
        ? `${monthlySpread >= 0 ? "+" : ""}£${Math.abs(monthlySpread).toLocaleString()}`
        : "—",
      status: getSpreadStatus(monthlySpread),
    },
    {
      label: "Rent/Room",
      value: rentPerRoom ? `£${rentPerRoom.toLocaleString()}` : "—",
      status: getRentPerRoomStatus(rentPerRoom),
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
        <div key={i} className="py-3 px-3 text-center">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
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
