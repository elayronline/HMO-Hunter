"use client"

import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface EPCBadgeProps {
  rating: "A" | "B" | "C" | "D" | "E" | "F" | "G" | null
  numericRating?: number | null
  certificateUrl?: string | null
  expiryDate?: string | null
  className?: string
  showTooltip?: boolean
}

const ratingColors: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: "bg-green-500", text: "text-white", border: "border-green-600" },
  B: { bg: "bg-green-400", text: "text-white", border: "border-green-500" },
  C: { bg: "bg-lime-400", text: "text-gray-900", border: "border-lime-500" },
  D: { bg: "bg-yellow-400", text: "text-gray-900", border: "border-yellow-500" },
  E: { bg: "bg-orange-400", text: "text-white", border: "border-orange-500" },
  F: { bg: "bg-orange-500", text: "text-white", border: "border-orange-600" },
  G: { bg: "bg-red-500", text: "text-white", border: "border-red-600" },
}

const ratingDescriptions: Record<string, string> = {
  A: "Very energy efficient - lowest running costs",
  B: "Highly energy efficient",
  C: "Good energy efficiency",
  D: "Average energy efficiency",
  E: "Below average efficiency",
  F: "Poor energy efficiency - high running costs",
  G: "Very poor efficiency - highest running costs",
}

export function EPCBadge({
  rating,
  numericRating,
  certificateUrl,
  expiryDate,
  className = "",
  showTooltip = true,
}: EPCBadgeProps) {
  if (!rating) {
    return (
      <Badge variant="outline" className={`bg-gray-50 text-gray-500 border-gray-300 ${className}`}>
        EPC N/A
      </Badge>
    )
  }

  const colors = ratingColors[rating] || ratingColors.G
  const description = ratingDescriptions[rating] || "Energy rating"

  const badge = (
    <Badge
      className={`${colors.bg} ${colors.text} ${colors.border} border font-semibold ${className}`}
    >
      EPC {rating}
      {numericRating !== undefined && numericRating !== null && (
        <span className="ml-1 opacity-80">({numericRating})</span>
      )}
    </Badge>
  )

  if (!showTooltip) {
    return badge
  }

  const isExpired = expiryDate && new Date(expiryDate) < new Date()

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">Energy Rating: {rating}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
            {numericRating !== undefined && numericRating !== null && (
              <p className="text-sm">Score: {numericRating}/100</p>
            )}
            {expiryDate && (
              <p className={`text-sm ${isExpired ? "text-red-500" : ""}`}>
                {isExpired ? "Expired: " : "Valid until: "}
                {new Date(expiryDate).toLocaleDateString()}
              </p>
            )}
            {certificateUrl && (
              <a
                href={certificateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-500 hover:underline block"
              >
                View certificate
              </a>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
