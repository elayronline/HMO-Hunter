"use client"

import { useState } from "react"
import {
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  Building2,
  Copy,
  Check,
  Clock,
  TrendingDown,
  User,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn, formatUKPhone } from "@/lib/utils"
import type { Property } from "@/lib/types/database"

interface AgentContactCardProps {
  property: Property
  className?: string
  compact?: boolean
}

export function AgentContactCard({
  property,
  className,
  compact = false,
}: AgentContactCardProps) {
  const [copiedPhone, setCopiedPhone] = useState(false)
  const [copiedEmail, setCopiedEmail] = useState(false)

  const hasAgentInfo = property.agent_name || property.agent_phone || property.agent_email
  const hasListingUrl = property.source_url || property.zoopla_listing_url

  // Show fallback card if no agent info but has listing URL
  if (!hasAgentInfo) {
    if (!hasListingUrl) {
      return null
    }

    // Fallback: Show "View on Zoopla/Source" card
    return (
      <Card className={cn("overflow-hidden", className)}>
        <div className="p-4 bg-gradient-to-r from-slate-600 to-slate-700 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold">Book a Viewing</h3>
              <p className="text-sm text-white/80">Via estate agent</p>
            </div>
          </div>
        </div>
        <div className="p-4">
          <p className="text-sm text-slate-600 mb-4">
            Book a viewing through the estate agent on the original listing.
          </p>
          <Button
            className="w-full bg-teal-600 hover:bg-teal-700 text-white h-12"
            asChild
          >
            <a
              href={property.source_url ?? property.zoopla_listing_url ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Listing & Book
            </a>
          </Button>
        </div>
      </Card>
    )
  }

  const copyToClipboard = async (text: string, type: "phone" | "email") => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === "phone") {
        setCopiedPhone(true)
        setTimeout(() => setCopiedPhone(false), 2000)
      } else {
        setCopiedEmail(true)
        setTimeout(() => setCopiedEmail(false), 2000)
      }
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const getDaysOnMarketBadge = () => {
    if (!property.days_on_market) return null

    const days = property.days_on_market
    let variant: "default" | "success" | "warning" | "danger" = "default"
    let label = `${days} days`

    if (days <= 7) {
      variant = "success"
      label = "New listing"
    } else if (days <= 30) {
      variant = "default"
    } else if (days <= 90) {
      variant = "warning"
      label = `${days} days - Motivated?`
    } else {
      variant = "danger"
      label = `${days} days - Stale`
    }

    const badgeColors = {
      default: "bg-slate-100 text-slate-600 border-slate-200",
      success: "bg-emerald-50 text-emerald-700 border-emerald-200",
      warning: "bg-amber-50 text-amber-700 border-amber-200",
      danger: "bg-red-50 text-red-700 border-red-200",
    }

    return (
      <Badge className={cn("text-xs", badgeColors[variant])}>
        <Clock className="w-3 h-3 mr-1" />
        {label}
      </Badge>
    )
  }

  if (compact) {
    return (
      <div className={cn("flex items-center gap-3 p-3 bg-slate-50 rounded-xl", className)}>
        {property.agent_logo ? (
          <img
            src={property.agent_logo}
            alt={property.agent_name || "Agent"}
            className="w-10 h-10 rounded-lg object-contain bg-white border border-slate-200"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-slate-900 truncate">
            {property.agent_name || "Estate Agent"}
          </div>
          {property.agent_phone && (
            <a
              href={`tel:${property.agent_phone}`}
              className="text-sm text-teal-600 hover:text-teal-700"
            >
              {formatUKPhone(property.agent_phone)}
            </a>
          )}
        </div>
        {property.agent_phone && (
          <Button
            size="sm"
            className="bg-teal-600 hover:bg-teal-700 text-white"
            asChild
          >
            <a href={`tel:${property.agent_phone}`}>
              <Phone className="w-4 h-4" />
            </a>
          </Button>
        )}
      </div>
    )
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-teal-600 to-emerald-600 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold">Book a Viewing</h3>
              <p className="text-sm text-white/80">Via estate agent</p>
            </div>
          </div>
          {getDaysOnMarketBadge()}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Agent Info */}
        <div className="flex items-start gap-4">
          {property.agent_logo ? (
            <img
              src={property.agent_logo}
              alt={property.agent_name || "Agent"}
              className="w-16 h-16 rounded-xl object-contain bg-white border-2 border-slate-200 p-1"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-slate-400" />
            </div>
          )}
          <div className="flex-1">
            <h4 className="font-bold text-lg text-slate-900">
              {property.agent_name || "Estate Agent"}
            </h4>
            {property.agent_address && (
              <div className="flex items-start gap-1.5 text-sm text-slate-500 mt-1">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{property.agent_address}</span>
              </div>
            )}
          </div>
        </div>

        {/* Price Change Alert */}
        {property.price_change_summary && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200">
            <TrendingDown className="w-5 h-5 text-amber-600" />
            <div>
              <div className="font-medium text-amber-800">Price Change</div>
              <div className="text-sm text-amber-600">{property.price_change_summary}</div>
            </div>
          </div>
        )}

        {/* Contact Buttons */}
        <div className="space-y-2">
          {property.agent_phone && (
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white h-12"
                asChild
              >
                <a href={`tel:${property.agent_phone}`}>
                  <Phone className="w-4 h-4 mr-2" />
                  {formatUKPhone(property.agent_phone)}
                </a>
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12"
                onClick={() => copyToClipboard(property.agent_phone!, "phone")}
              >
                {copiedPhone ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          )}

          {property.agent_email && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 h-12 border-2"
                asChild
              >
                <a href={`mailto:${property.agent_email}`}>
                  <Mail className="w-4 h-4 mr-2" />
                  {property.agent_email}
                </a>
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12"
                onClick={() => copyToClipboard(property.agent_email!, "email")}
              >
                {copiedEmail ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Agent Profile Link */}
        {property.agent_profile_url && (
          <a
            href={property.agent_profile_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 p-3 text-sm text-slate-600 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition-colors"
          >
            <User className="w-4 h-4" />
            View Agent Profile
            <ExternalLink className="w-3 h-3" />
          </a>
        )}

        {/* Listing Info */}
        {property.first_listed_date && (
          <div className="pt-3 border-t border-slate-100 text-center">
            <span className="text-xs text-slate-400">
              First listed: {new Date(property.first_listed_date).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
    </Card>
  )
}

/**
 * Compact inline agent display for property cards
 */
export function AgentContactInline({ property }: { property: Property }) {
  if (!property.agent_name && !property.agent_phone) return null

  return (
    <div className="flex items-center gap-2 text-sm">
      {property.agent_logo ? (
        <img
          src={property.agent_logo}
          alt=""
          className="w-5 h-5 rounded object-contain"
        />
      ) : (
        <Building2 className="w-4 h-4 text-slate-400" />
      )}
      <span className="text-slate-600 truncate">
        {property.agent_name || "Agent"}
      </span>
      {property.agent_phone && (
        <a
          href={`tel:${property.agent_phone}`}
          className="text-teal-600 hover:text-teal-700 font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          <Phone className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  )
}
