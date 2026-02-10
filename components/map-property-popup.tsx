"use client"

import { cn } from "@/lib/utils"
import { BedDouble, Bath, Maximize2, ChevronRight, Shield, AlertTriangle, Home, Key } from "lucide-react"
import type { Property } from "@/lib/types/database"

interface MapPropertyPopupProps {
  property: Property
  onClick: () => void
  onClose: () => void
  className?: string
}

type Verdict = "strong_buy" | "worth_exploring" | "needs_work" | "pass"

function getVerdict(score: number | null | undefined): Verdict {
  if (!score) return "pass"
  if (score >= 75) return "strong_buy"
  if (score >= 60) return "worth_exploring"
  if (score >= 45) return "needs_work"
  return "pass"
}

const verdictConfig: Record<Verdict, { label: string; bg: string; text: string }> = {
  strong_buy: { label: "Strong Buy", bg: "bg-emerald-100", text: "text-emerald-700" },
  worth_exploring: { label: "Worth Exploring", bg: "bg-amber-100", text: "text-amber-700" },
  needs_work: { label: "Needs Work", bg: "bg-orange-100", text: "text-orange-700" },
  pass: { label: "Pass", bg: "bg-slate-100", text: "text-slate-600" },
}

export function MapPropertyPopup({ property, onClick, onClose, className }: MapPropertyPopupProps) {
  const verdict = getVerdict(property.deal_score)
  const config = verdictConfig[verdict]

  const price = property.listing_type === "purchase"
    ? property.purchase_price
    : property.price_pcm

  const priceLabel = property.listing_type === "purchase" ? "" : "/mo"

  // Calculate metrics
  const monthlyRent = property.listing_type === "purchase"
    ? (property.estimated_rent_per_room ? property.estimated_rent_per_room * property.bedrooms : null)
    : property.price_pcm

  const netYield = (() => {
    if (property.listing_type !== "purchase" || !property.purchase_price || !monthlyRent) return null
    return ((monthlyRent * 12 / property.purchase_price) * 100 * 0.7).toFixed(1)
  })()

  const monthlyCashflow = (() => {
    if (!property.purchase_price || !monthlyRent) return null
    const annualRent = monthlyRent * 12
    const costs = annualRent * 0.3
    const mortgage = property.purchase_price * 0.75 * 0.055
    return Math.round((annualRent - costs - mortgage) / 12)
  })()

  return (
    <div className={cn(
      "w-[min(320px,calc(100vw-2rem))] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden",
      className
    )}>
      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        className="absolute -top-3 -right-3 z-10 w-8 h-8 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div
        onClick={onClick}
        className="cursor-pointer hover:bg-slate-50 transition-colors"
      >
        {/* Header Row */}
        <div className="p-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-slate-900">
                  £{price?.toLocaleString()}{priceLabel}
                </span>
                <span className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                  property.listing_type === "rent"
                    ? "bg-purple-100 text-purple-700"
                    : "bg-blue-100 text-blue-700"
                )}>
                  {property.listing_type === "rent" ? (
                    <><Home className="w-3 h-3" /> R2R</>
                  ) : (
                    <><Key className="w-3 h-3" /> BUY</>
                  )}
                </span>
              </div>
              <p className="text-sm text-slate-600 mt-1 truncate">
                {property.address}, {property.postcode}
              </p>
            </div>
            <span className={cn(
              "shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase",
              config.bg,
              config.text
            )}>
              {config.label}
            </span>
          </div>

          {/* Specs Row */}
          <div className="flex items-center gap-4 mt-3 text-sm text-slate-600">
            <div className="flex items-center gap-1.5">
              <BedDouble className="w-4 h-4 text-slate-400" />
              <span>{property.bedrooms} bed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Bath className="w-4 h-4 text-slate-400" />
              <span>{property.bathrooms} bath</span>
            </div>
            {property.gross_internal_area_sqm && (
              <div className="flex items-center gap-1.5">
                <Maximize2 className="w-4 h-4 text-slate-400" />
                <span>{Math.round(property.gross_internal_area_sqm)}m²</span>
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100" />

        {/* Metrics Row */}
        <div className="px-4 py-3 flex items-center gap-3 text-sm">
          {netYield && (
            <span className="text-emerald-600 font-semibold">{netYield}% yield</span>
          )}
          {monthlyCashflow !== null && (
            <span className={cn(
              "font-semibold",
              monthlyCashflow >= 0 ? "text-emerald-600" : "text-red-600"
            )}>
              {monthlyCashflow >= 0 ? "+" : ""}£{Math.abs(monthlyCashflow)}/mo
            </span>
          )}
          {property.licensed_hmo && (
            <span className="inline-flex items-center gap-1 text-teal-600">
              <Shield className="w-3.5 h-3.5" />
              Licensed
            </span>
          )}
          {property.article_4_area && (
            <span className="inline-flex items-center gap-1 text-purple-600">
              <AlertTriangle className="w-3.5 h-3.5" />
              Art. 4
            </span>
          )}
        </div>

        {/* CTA Row */}
        <div className="px-4 py-3 bg-slate-50 flex items-center justify-between">
          <span className="text-sm text-slate-500">Click to view details</span>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>
      </div>
    </div>
  )
}
