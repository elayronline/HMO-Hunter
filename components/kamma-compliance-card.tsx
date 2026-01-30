"use client"

import { useState } from "react"
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
  className?: string
}

export function KammaComplianceCard({
  postcode,
  address,
  uprn,
  className,
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
        body: JSON.stringify({ postcode, address, uprn }),
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

  const getComplexityConfig = (complexity: string) => {
    switch (complexity) {
      case "low":
        return { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", label: "Low Complexity" }
      case "medium":
        return { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50", label: "Medium Complexity" }
      case "high":
        return { icon: XCircle, color: "text-red-600", bg: "bg-red-50", label: "High Complexity" }
      default:
        return { icon: Info, color: "text-slate-600", bg: "bg-slate-50", label: "Unknown" }
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
              <h3 className="font-bold">Compliance Check</h3>
              <p className="text-sm text-white/80">Kamma V3 Licensing API</p>
            </div>
          </div>
        </div>
        <CardContent className="p-4">
          <div className="text-center py-4">
            <p className="text-sm text-slate-600 mb-4">
              Check HMO licensing requirements, Article 4 status, and compliance complexity for this property.
            </p>
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
                  Check Compliance
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
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <p className="text-sm text-slate-600 mb-2">
              {data?.error || "Kamma API not configured"}
            </p>
            <p className="text-xs text-slate-400">
              Contact admin to enable compliance checking
            </p>
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
              <h3 className="font-bold">Compliance Check</h3>
              <p className="text-sm text-white/80">Kamma V3 Results</p>
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
              <span className="text-xs font-medium text-slate-600">Licensing</span>
            </div>
            <div className={cn(
              "text-sm font-bold",
              compliance.licensingRequired ? "text-amber-700" : "text-emerald-700"
            )}>
              {compliance.licensingRequired ? "Required" : "Not Required"}
            </div>
          </div>

          <div className={cn(
            "p-3 rounded-xl border",
            compliance.article4
              ? "bg-purple-50 border-purple-200"
              : "bg-slate-50 border-slate-200"
          )}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className={cn(
                "w-4 h-4",
                compliance.article4 ? "text-purple-600" : "text-slate-400"
              )} />
              <span className="text-xs font-medium text-slate-600">Article 4</span>
            </div>
            <div className={cn(
              "text-sm font-bold",
              compliance.article4 ? "text-purple-700" : "text-slate-600"
            )}>
              {compliance.article4 ? "In Effect" : "Not Applicable"}
            </div>
          </div>
        </div>

        {/* Licensing Schemes */}
        {compliance.schemes && compliance.schemes.length > 0 && (
          <div className="p-3 bg-slate-50 rounded-xl">
            <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Applicable Licensing Schemes
            </h4>
            <div className="space-y-2">
              {compliance.schemes.map((scheme, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-800">{scheme.name}</div>
                    <div className="text-xs text-slate-500">{scheme.authority}</div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      scheme.required
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-slate-50 text-slate-600"
                    )}
                  >
                    {scheme.type}
                  </Badge>
                </div>
              ))}
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
          Data from Kamma V3 API · Real-time check
        </div>
      </CardContent>
    </Card>
  )
}
