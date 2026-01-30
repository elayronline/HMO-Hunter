"use client"

import { cn } from "@/lib/utils"
import { MapPin, BedDouble, Bath, Maximize2 } from "lucide-react"
import type { Property } from "@/lib/types/database"

interface DealVerdictHeaderProps {
  property: Property
  onClose?: () => void
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

const verdictConfig: Record<Verdict, { label: string; gradient: string; textColor: string }> = {
  strong_buy: {
    label: "Strong Buy",
    gradient: "bg-gradient-to-r from-emerald-600 to-teal-600",
    textColor: "text-white",
  },
  worth_exploring: {
    label: "Worth Exploring",
    gradient: "bg-gradient-to-r from-amber-500 to-yellow-500",
    textColor: "text-white",
  },
  needs_work: {
    label: "Needs Work",
    gradient: "bg-gradient-to-r from-orange-500 to-red-400",
    textColor: "text-white",
  },
  pass: {
    label: "Pass",
    gradient: "bg-gradient-to-r from-slate-400 to-slate-500",
    textColor: "text-white",
  },
}

export function DealVerdictHeader({ property, onClose, className }: DealVerdictHeaderProps) {
  const verdict = getVerdict(property.deal_score)
  const config = verdictConfig[verdict]

  const price = property.listing_type === "purchase"
    ? property.purchase_price
    : property.price_pcm

  const priceLabel = property.listing_type === "purchase" ? "" : "/mo"

  return (
    <div className={cn("relative", config.gradient, className)}>
      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      <div className="p-4">
        {/* Verdict Badge */}
        <div className="flex items-center gap-2 mb-2">
          <span className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide",
            "bg-white/20 backdrop-blur-sm",
            config.textColor
          )}>
            {property.deal_score && (
              <span className="text-sm font-bold">{property.deal_score}</span>
            )}
            {config.label}
          </span>
        </div>

        {/* Price */}
        <div className={cn("text-[28px] font-bold leading-tight", config.textColor)}>
          £{price?.toLocaleString()}{priceLabel}
        </div>

        {/* Address */}
        <div className={cn("flex items-center gap-1.5 mt-2 text-sm opacity-90", config.textColor)}>
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{property.address}, {property.postcode}</span>
        </div>

        {/* Core Specs */}
        <div className={cn("flex items-center gap-4 mt-3 text-sm", config.textColor)}>
          <div className="flex items-center gap-1.5">
            <BedDouble className="w-4 h-4 opacity-80" />
            <span className="font-medium">{property.bedrooms}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Bath className="w-4 h-4 opacity-80" />
            <span className="font-medium">{property.bathrooms}</span>
          </div>
          {property.gross_internal_area_sqm && (
            <div className="flex items-center gap-1.5">
              <Maximize2 className="w-4 h-4 opacity-80" />
              <span className="font-medium">{Math.round(property.gross_internal_area_sqm)}m²</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
