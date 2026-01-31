"use client"

import { useState } from "react"
import {
  Building2,
  Scale,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  Users,
  Home,
  Calendar,
  Info,
  Shield,
  FileText,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import type { Property } from "@/lib/types/database"

interface LicensingScheme {
  scheme_id: string
  type: "mandatory" | "additional" | "selective"
  occupants?: number
  households?: number
  date_start: string | null
  date_end: string | null
  link?: string
  is_advised: boolean
}

interface LicensingRequirementsCardProps {
  property: Property
  schemes?: LicensingScheme[]
  adviceText?: {
    current: string
    mandatory: string
    additional: string
    selective: string
  }
  className?: string
}

export function LicensingRequirementsCard({
  property,
  schemes = [],
  adviceText,
  className,
}: LicensingRequirementsCardProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  // Determine compliance complexity
  const getComplianceLevel = () => {
    const hasArticle4 = property.article_4_area
    const schemeCount = schemes.length
    const hasMandatory = schemes.some(s => s.type === "mandatory")
    const hasAdditional = schemes.some(s => s.type === "additional")
    const hasSelective = schemes.some(s => s.type === "selective")

    if (hasArticle4 && schemeCount >= 2) return "high"
    if (hasMandatory && (hasAdditional || hasSelective)) return "high"
    if (hasMandatory || hasArticle4) return "medium"
    if (hasAdditional || hasSelective) return "medium"
    return "low"
  }

  const complexityLevel = property.compliance_complexity || getComplianceLevel()

  const complexityConfig = {
    low: {
      color: "text-emerald-700",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      icon: CheckCircle2,
      label: "Easy Setup",
      description: "Standard process - one licence or none needed",
    },
    medium: {
      color: "text-amber-700",
      bg: "bg-amber-50",
      border: "border-amber-200",
      icon: Info,
      label: "Some Requirements",
      description: "Additional licences needed for this area",
    },
    high: {
      color: "text-red-700",
      bg: "bg-red-50",
      border: "border-red-200",
      icon: AlertTriangle,
      label: "Complex Setup",
      description: "Multiple licences + planning permission needed",
    },
  }

  const config = complexityConfig[complexityLevel]
  const ComplexityIcon = config.icon

  // Get scheme type config
  const schemeTypeConfig = {
    mandatory: {
      color: "text-red-700",
      bg: "bg-red-50",
      border: "border-red-200",
      label: "Mandatory HMO Licence",
      shortLabel: "Mandatory",
      description: "Required for properties with 5+ tenants from 2+ households",
      icon: Shield,
    },
    additional: {
      color: "text-amber-700",
      bg: "bg-amber-50",
      border: "border-amber-200",
      label: "Additional Licence",
      shortLabel: "Additional",
      description: "This council requires a licence for smaller HMOs too",
      icon: FileText,
    },
    selective: {
      color: "text-blue-700",
      bg: "bg-blue-50",
      border: "border-blue-200",
      label: "Selective Licence",
      shortLabel: "Selective",
      description: "All private rentals in this area need a licence",
      icon: Building2,
    },
  }

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Permanent"
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" })
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Header */}
      <div className={cn("p-4 border-b", config.bg, config.border)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", config.bg, config.border, "border")}>
              <Scale className={cn("w-5 h-5", config.color)} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">What Licences Do I Need?</h3>
              <p className={cn("text-sm", config.color)}>{config.description}</p>
            </div>
          </div>
          <Badge className={cn(config.bg, config.color, config.border, "border")}>
            <ComplexityIcon className="w-3 h-3 mr-1" />
            {config.label}
          </Badge>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4">
        {/* Overall Status */}
        {adviceText?.current && (
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <Info className="w-5 h-5 text-slate-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-slate-700">{adviceText.current}</p>
          </div>
        )}

        {/* Licensing Schemes */}
        {schemes.length > 0 ? (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wide">
              Applicable Schemes ({schemes.length})
            </h4>

            {schemes.map((scheme, idx) => {
              const schemeConfig = schemeTypeConfig[scheme.type]
              const SchemeIcon = schemeConfig.icon

              return (
                <Collapsible key={scheme.scheme_id || idx}>
                  <CollapsibleTrigger className="w-full">
                    <div className={cn(
                      "flex items-center justify-between p-3 rounded-xl border transition-all",
                      schemeConfig.bg,
                      schemeConfig.border,
                      "hover:shadow-sm"
                    )}>
                      <div className="flex items-center gap-3">
                        <SchemeIcon className={cn("w-5 h-5", schemeConfig.color)} />
                        <div className="text-left">
                          <p className={cn("font-medium", schemeConfig.color)}>
                            {schemeConfig.label} Licensing
                          </p>
                          <p className="text-xs text-slate-500">
                            {scheme.date_end
                              ? `Until ${formatDate(scheme.date_end)}`
                              : "Permanent scheme"
                            }
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {scheme.is_advised && (
                          <Badge variant="outline" className="text-xs bg-white">
                            Applies
                          </Badge>
                        )}
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="mt-2 ml-8 p-3 bg-white rounded-lg border border-slate-200 space-y-3">
                      {/* Thresholds */}
                      <div className="grid grid-cols-2 gap-3">
                        {scheme.occupants && (
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-600">
                              {scheme.occupants}+ occupants
                            </span>
                          </div>
                        )}
                        {scheme.households && (
                          <div className="flex items-center gap-2">
                            <Home className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-600">
                              {scheme.households}+ households
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Dates */}
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Calendar className="w-4 h-4" />
                        <span>
                          Started: {formatDate(scheme.date_start)}
                          {scheme.date_end && ` • Ends: ${formatDate(scheme.date_end)}`}
                        </span>
                      </div>

                      {/* Advice Text */}
                      {adviceText && adviceText[scheme.type] && (
                        <p className="text-sm text-slate-600 italic">
                          {adviceText[scheme.type]}
                        </p>
                      )}

                      {/* Council Link */}
                      {scheme.link && (
                        <a
                          href={scheme.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "inline-flex items-center gap-2 text-sm font-medium",
                            schemeConfig.color,
                            "hover:underline"
                          )}
                        >
                          Apply at Council Website
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <div>
              <p className="font-medium text-emerald-800">No Special Licensing Required</p>
              <p className="text-sm text-emerald-600">Standard letting regulations apply</p>
            </div>
          </div>
        )}

        {/* Article 4 Warning */}
        {property.article_4_area && (
          <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-800">Planning Permission Required</p>
              <p className="text-sm text-red-600 mb-2">
                This area has restrictions on converting properties to HMOs. You must apply
                for planning permission from the council <strong>before</strong> operating as an HMO.
              </p>
              <p className="text-xs text-red-500">
                ⚠️ This can take 8-12 weeks and may be refused. Factor this into your investment decision.
              </p>
            </div>
          </div>
        )}

        {/* Quick Reference */}
        <div className="pt-3 border-t border-slate-100">
          <h4 className="text-sm font-medium text-slate-500 mb-2">What Do These Mean?</h4>
          <div className="grid grid-cols-1 gap-2 text-sm">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
              <span className="text-slate-600"><strong>Mandatory:</strong> National law - required for 5+ tenants from 2+ households in a 3+ storey building</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
              <span className="text-slate-600"><strong>Additional:</strong> Council-specific - covers smaller HMOs (usually 3-4 tenants) in this area</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
              <span className="text-slate-600"><strong>Selective:</strong> Council-specific - all private rentals (not just HMOs) need a licence in this area</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 flex-shrink-0" />
              <span className="text-slate-600"><strong>Planning Permission:</strong> Must apply to convert to HMO use - separate from licensing</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

/**
 * Compact compliance badge for property cards
 */
export function ComplianceBadge({
  complexity,
  hasArticle4,
  schemeCount = 0,
  className,
}: {
  complexity?: "low" | "medium" | "high" | null
  hasArticle4?: boolean
  schemeCount?: number
  className?: string
}) {
  // Derive complexity if not provided
  const derivedComplexity = complexity || (
    hasArticle4 && schemeCount >= 2 ? "high" :
    hasArticle4 || schemeCount >= 2 ? "medium" :
    schemeCount >= 1 ? "medium" : "low"
  )

  const config = {
    low: {
      color: "text-emerald-700",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      label: "Low",
      icon: CheckCircle2,
    },
    medium: {
      color: "text-amber-700",
      bg: "bg-amber-50",
      border: "border-amber-200",
      label: "Med",
      icon: Info,
    },
    high: {
      color: "text-red-700",
      bg: "bg-red-50",
      border: "border-red-200",
      label: "High",
      icon: AlertTriangle,
    },
  }

  const cfg = config[derivedComplexity]
  const Icon = cfg.icon

  return (
    <Badge
      className={cn(
        cfg.bg,
        cfg.color,
        cfg.border,
        "border text-xs",
        className
      )}
    >
      <Icon className="w-3 h-3 mr-1" />
      {cfg.label} Complexity
    </Badge>
  )
}
