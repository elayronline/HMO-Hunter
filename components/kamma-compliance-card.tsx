"use client"

import { useState, useEffect } from "react"
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  FileText,
  Info,
  MapPin,
  Building2,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface KammaData {
  success: boolean
  error?: string
  data: {
    licensingRequired: boolean
    article4: boolean
    schemes: {
      name: string
      type: string
      required: boolean
      authority: string
    }[]
    complexity: "low" | "medium" | "high"
    planningRequired: boolean
    riskLevel: string
    recommendations: string[]
  } | null
}

interface KammaComplianceCardProps {
  postcode: string
  address?: string
  uprn?: string
  bedrooms?: number
  className?: string
  autoCheck?: boolean
}

export function KammaComplianceCard({
  postcode,
  address,
  uprn,
  bedrooms,
  className,
  autoCheck = false,
}: KammaComplianceCardProps) {
  const [data, setData] = useState<KammaData | null>(null)
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState(false)

  const checkCompliance = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/kamma-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postcode, address, uprn, bedrooms }),
      })
      const result = await response.json()
      setData(result)
      setChecked(true)
    } catch (err) {
      setData({ success: false, error: "Failed to check compliance", data: null })
      setChecked(true)
    } finally {
      setLoading(false)
    }
  }

  // Auto-check on mount if autoCheck is enabled
  useEffect(() => {
    if (autoCheck && !checked && !loading) {
      checkCompliance()
    }
  }, [autoCheck])

  const getComplexityConfig = (complexity: string) => {
    switch (complexity) {
      case "low":
        return { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", label: "Easy Setup", description: "Standard licensing - straightforward process" }
      case "medium":
        return { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50", label: "Some Requirements", description: "Additional licences may be needed" }
      case "high":
        return { icon: XCircle, color: "text-red-600", bg: "bg-red-50", label: "Complex", description: "Multiple licences and planning permission needed" }
      default:
        return { icon: Info, color: "text-slate-600", bg: "bg-slate-50", label: "Unknown", description: "" }
    }
  }

  // Not yet checked - show button
  if (!checked) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold">Do I Need a Licence?</h3>
              <p className="text-sm text-white/80">Check HMO requirements for this area</p>
            </div>
          </div>
        </div>
        <CardContent className="p-4">
          <div className="text-center py-4">
            <p className="text-sm text-slate-600 mb-3">
              Find out what licences you need to operate an HMO at this property:
            </p>
            <ul className="text-sm text-slate-500 text-left mb-4 space-y-1 max-w-xs mx-auto">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Mandatory HMO licence requirements
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Additional or selective licensing
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Planning permission (Article 4) status
              </li>
            </ul>
            <Button
              onClick={checkCompliance}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Check Licensing Requirements
                </>
              )}
            </Button>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mt-3">
            <MapPin className="w-3 h-3" />
            <span>{postcode}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // API not configured or error
  if (!data?.success || !data.data) {
    const isAddressError = data?.error?.includes("Unprocessable") || data?.error?.includes("address")
    const isNotConfigured = data?.error?.includes("not configured") || data?.error?.includes("API key")

    return (
      <Card className={cn("overflow-hidden", className)}>
        <div className="p-4 bg-gradient-to-r from-slate-600 to-slate-700 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold">Compliance Check</h3>
              <p className="text-sm text-white/80">Kamma V3 API</p>
            </div>
          </div>
        </div>
        <CardContent className="p-4">
          <div className="text-center py-4">
            <Info className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            {isAddressError ? (
              <>
                <p className="text-sm text-slate-600 mb-2">
                  Address not found in Kamma database
                </p>
                <p className="text-xs text-slate-400 mb-4">
                  The property address couldn't be matched. Try the council website for licensing info.
                </p>
              </>
            ) : isNotConfigured ? (
              <>
                <p className="text-sm text-slate-600 mb-2">
                  Kamma API not configured
                </p>
                <p className="text-xs text-slate-400 mb-4">
                  Add KAMMA_API_KEY to enable real-time compliance checking.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-600 mb-2">
                  Unable to check compliance
                </p>
                <p className="text-xs text-slate-400 mb-4">
                  {data?.error || "Please try again later"}
                </p>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setChecked(false); setData(null) }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100">
            <MapPin className="w-3 h-3" />
            <span>{postcode}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const compliance = data.data
  const complexityConfig = getComplexityConfig(compliance.complexity)
  const ComplexityIcon = complexityConfig.icon

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold">Licensing Requirements</h3>
              <p className="text-sm text-white/80">What you need to operate an HMO here</p>
            </div>
          </div>
          <Badge className={cn("text-xs", complexityConfig.bg, complexityConfig.color)}>
            <ComplexityIcon className="w-3 h-3 mr-1" />
            {complexityConfig.label}
          </Badge>
        </div>
      </div>

      <CardContent className="p-4 space-y-4">
        {/* Key Status Indicators */}
        <div className="grid grid-cols-2 gap-3">
          <div className={cn(
            "p-3 rounded-xl border",
            compliance.licensingRequired
              ? "bg-amber-50 border-amber-200"
              : "bg-emerald-50 border-emerald-200"
          )}>
            <div className="flex items-center gap-2 mb-1">
              <FileText className={cn(
                "w-4 h-4",
                compliance.licensingRequired ? "text-amber-600" : "text-emerald-600"
              )} />
              <span className="text-xs font-medium text-slate-600">HMO Licence</span>
            </div>
            <div className={cn(
              "text-sm font-bold",
              compliance.licensingRequired ? "text-amber-700" : "text-emerald-700"
            )}>
              {compliance.licensingRequired ? "Yes, Required" : "Not Required"}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {compliance.licensingRequired
                ? "You must apply to the council"
                : "No HMO licence needed"}
            </p>
          </div>

          <div className={cn(
            "p-3 rounded-xl border",
            compliance.article4
              ? "bg-purple-50 border-purple-200"
              : "bg-emerald-50 border-emerald-200"
          )}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className={cn(
                "w-4 h-4",
                compliance.article4 ? "text-purple-600" : "text-emerald-600"
              )} />
              <span className="text-xs font-medium text-slate-600">Planning Permission</span>
            </div>
            <div className={cn(
              "text-sm font-bold",
              compliance.article4 ? "text-purple-700" : "text-emerald-700"
            )}>
              {compliance.article4 ? "Yes, Required" : "Not Required"}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {compliance.article4
                ? "Must apply before converting to HMO"
                : "No planning needed for HMO use"}
            </p>
          </div>
        </div>

        {/* Licensing Schemes */}
        {compliance.schemes && compliance.schemes.length > 0 && (
          <div className="p-3 bg-slate-50 rounded-xl">
            <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Licences You May Need
            </h4>
            <div className="space-y-2">
              {compliance.schemes.map((scheme, idx) => {
                const typeLabels: Record<string, { label: string; description: string }> = {
                  mandatory: { label: "Mandatory", description: "Required for 5+ tenants" },
                  additional: { label: "Additional", description: "Required for 3+ tenants in this area" },
                  selective: { label: "Selective", description: "All rentals in this area" },
                }
                const typeInfo = typeLabels[scheme.type.toLowerCase()] || { label: scheme.type, description: "" }

                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-800">{scheme.name}</div>
                      <div className="text-xs text-slate-500">{scheme.authority}</div>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          scheme.required
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-slate-50 text-slate-600"
                        )}
                      >
                        {typeInfo.label}
                      </Badge>
                      <p className="text-xs text-slate-400 mt-0.5">{typeInfo.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {compliance.recommendations && compliance.recommendations.length > 0 && (
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
            <h4 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Recommendations
            </h4>
            <ul className="space-y-1">
              {compliance.recommendations.map((rec, idx) => (
                <li key={idx} className="text-sm text-blue-700 flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recheck Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={checkCompliance}
          disabled={loading}
          className="w-full"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
          Recheck Compliance
        </Button>

        {/* Attribution */}
        <div className="text-xs text-slate-400 text-center pt-2 border-t border-slate-100">
          Based on latest council licensing data
        </div>
      </CardContent>
    </Card>
  )
}
