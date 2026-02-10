"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, TrendingUp, Wrench, Home, Ruler, Bath, Utensils, Zap, PoundSterling, BarChart3, Users, FileCheck, Lock, Crown } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { Property, DealScoreBreakdown } from "@/lib/types/database"

interface PotentialHMODetailPanelProps {
  property: Property
  defaultOpen?: boolean
  isPremium?: boolean
}

const classificationConfig = {
  ready_to_go: {
    label: "Ready to Go",
    icon: TrendingUp,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    description: "Compliant or near-compliant with minimal works required",
  },
  value_add: {
    label: "Value-Add Opportunity",
    icon: Wrench,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    description: "Reconfiguration, EPC upgrades, or amenity improvements required",
  },
  not_suitable: {
    label: "Not Suitable",
    icon: Home,
    color: "text-slate-500",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
    description: "Does not meet HMO conversion criteria",
  },
}

const yieldBandColors = {
  high: "text-green-600",
  medium: "text-amber-600",
  low: "text-red-500",
}

const floorAreaBandLabels = {
  under_90: "Under 90 m²",
  "90_120": "90-120 m²",
  "120_plus": "120+ m²",
}

const epcImprovementLabels = {
  high: "High potential (E/F/G)",
  medium: "Medium potential",
  low: "Low potential (C/D)",
  none: "Already optimal (A/B)",
}

export function PotentialHMODetailPanel({ property, defaultOpen = false, isPremium = false }: PotentialHMODetailPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  if (!property.is_potential_hmo || !property.hmo_classification) {
    return null
  }

  const config = classificationConfig[property.hmo_classification]
  const Icon = config.icon

  const breakdown = property.deal_score_breakdown as DealScoreBreakdown | null

  // Non-premium users see locked state
  if (!isPremium) {
    return (
      <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 overflow-hidden">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <TrendingUp className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="font-semibold text-amber-800 flex items-center gap-2">
                  HMO Investment Analysis
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full">
                    <Crown className="w-3 h-3" />
                    PRO
                  </span>
                </div>
                <div className="text-xs text-amber-600">Unlock detailed deal scoring & compliance data</div>
              </div>
            </div>
          </div>

          {/* Blurred preview */}
          <div className="relative">
            <div className="blur-sm pointer-events-none opacity-60">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-white/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500">Deal Score</div>
                  <div className="text-lg font-bold text-slate-400">••/100</div>
                </div>
                <div className="bg-white/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500">Est. Yield</div>
                  <div className="text-lg font-bold text-slate-400">•.•%</div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-2 bg-slate-200 rounded w-full"></div>
                <div className="h-2 bg-slate-200 rounded w-3/4"></div>
                <div className="h-2 bg-slate-200 rounded w-5/6"></div>
              </div>
            </div>

            {/* Lock overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-100 flex items-center justify-center">
                  <Lock className="w-6 h-6 text-amber-600" />
                </div>
                <Button
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold shadow-lg"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Upgrade to Pro
                </Button>
                <p className="text-xs text-amber-700 mt-2">
                  Get deal scores, yield analysis & compliance checks
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className={`${config.bgColor} ${config.borderColor} border overflow-hidden`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-white ${config.color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="text-left">
            <div className={`font-semibold ${config.color}`}>{config.label}</div>
            <div className="text-xs text-slate-600">
              Deal Score: {property.deal_score}/100
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-medium text-slate-900">
              {property.lettable_rooms || property.bedrooms} rooms
            </div>
            <div className={`text-xs ${yieldBandColors[(property.yield_band as keyof typeof yieldBandColors) || "low"]}`}>
              {property.estimated_yield_percentage || "N/A"}% yield
            </div>
          </div>
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/50">
          {/* Deal Score Breakdown */}
          {breakdown && (
            <div className="pt-4">
              <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Deal Score Breakdown
              </h4>
              <div className="space-y-2">
                <ScoreBar label="Floor Area Efficiency" score={breakdown.floorAreaEfficiency} maxScore={20} />
                <ScoreBar label="EPC Rating" score={breakdown.epcRatingScore} maxScore={15} />
                <ScoreBar label="Licensing Upside" score={breakdown.licensingUpside} maxScore={15} />
                <ScoreBar label="Lettable Rooms" score={breakdown.lettableRoomsScore} maxScore={15} />
                <ScoreBar label="Compliance" score={breakdown.complianceScore} maxScore={15} />
                <ScoreBar label="Yield Potential" score={breakdown.yieldScore} maxScore={20} />
              </div>
              <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between items-center">
                <span className="text-sm font-medium text-slate-700">Total Deal Score</span>
                <span className="text-lg font-bold text-teal-600">{property.deal_score}/100</span>
              </div>
            </div>
          )}

          {/* Space & Layout */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Ruler className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-medium text-slate-600">Floor Area</span>
              </div>
              <div className="text-sm font-semibold text-slate-900">
                {property.gross_internal_area_sqm ? `${property.gross_internal_area_sqm} m²` : "Est. " + (property.floor_area_band && floorAreaBandLabels[property.floor_area_band as keyof typeof floorAreaBandLabels] ? floorAreaBandLabels[property.floor_area_band as keyof typeof floorAreaBandLabels] : "N/A")}
              </div>
              {property.floor_area_band && floorAreaBandLabels[property.floor_area_band as keyof typeof floorAreaBandLabels] && (
                <div className="text-xs text-slate-500 mt-1">
                  {floorAreaBandLabels[property.floor_area_band as keyof typeof floorAreaBandLabels]}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-medium text-slate-600">Occupancy</span>
              </div>
              <div className="text-sm font-semibold text-slate-900">
                {property.potential_occupants || property.lettable_rooms || property.bedrooms} occupants
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {property.requires_mandatory_licensing ? "Mandatory licensing required" : "Unlicensed HMO"}
              </div>
            </div>
          </div>

          {/* Compliance Status */}
          <div className="bg-white rounded-lg p-3">
            <h4 className="text-xs font-medium text-slate-600 mb-2 flex items-center gap-2">
              <FileCheck className="w-4 h-4" />
              Compliance Status
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <ComplianceItem
                label="Space Standards"
                compliant={property.meets_space_standards ?? false}
              />
              <ComplianceItem
                label="Bathroom Ratio"
                compliant={property.bathroom_ratio_compliant ?? false}
              />
              <ComplianceItem
                label="Kitchen Size"
                compliant={property.kitchen_size_compliant ?? true}
              />
            </div>
            {property.compliance_complexity && (
              <div className="mt-2 pt-2 border-t border-slate-100 text-xs">
                <span className="text-slate-500">Compliance Complexity: </span>
                <span className={`font-medium ${
                  property.compliance_complexity === "low" ? "text-green-600" :
                  property.compliance_complexity === "medium" ? "text-amber-600" : "text-red-500"
                }`}>
                  {property.compliance_complexity.charAt(0).toUpperCase() + property.compliance_complexity.slice(1)}
                </span>
              </div>
            )}
          </div>

          {/* EPC Upgrade Potential */}
          {property.epc_improvement_potential && property.epc_improvement_potential !== "none" && epcImprovementLabels[property.epc_improvement_potential as keyof typeof epcImprovementLabels] && (
            <div className="bg-white rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-medium text-slate-600">EPC Upgrade Potential</span>
              </div>
              <div className="text-sm font-semibold text-slate-900">
                {epcImprovementLabels[property.epc_improvement_potential as keyof typeof epcImprovementLabels]}
              </div>
              {property.epc_upgrade_cost_estimate && (
                <div className="text-xs text-slate-500 mt-1">
                  Est. upgrade cost: £{property.epc_upgrade_cost_estimate.toLocaleString()}
                </div>
              )}
            </div>
          )}

          {/* Financial Analysis */}
          <div className="bg-white rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3">
              <PoundSterling className="w-4 h-4 text-green-500" />
              <span className="text-xs font-medium text-slate-600">Financial Analysis</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-500">Est. Rent/Room</div>
                <div className="text-sm font-semibold text-slate-900">
                  £{property.estimated_rent_per_room || "N/A"}/mo
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Gross Monthly</div>
                <div className="text-sm font-semibold text-slate-900">
                  £{property.estimated_gross_monthly_rent?.toLocaleString() || "N/A"}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Annual Income</div>
                <div className="text-sm font-semibold text-slate-900">
                  £{property.estimated_annual_income?.toLocaleString() || "N/A"}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Est. Yield</div>
                <div className={`text-sm font-semibold ${yieldBandColors[(property.yield_band as keyof typeof yieldBandColors) || "low"]}`}>
                  {property.estimated_yield_percentage || "N/A"}%
                  {property.yield_band && <span className="text-xs text-slate-500 ml-1">({property.yield_band})</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Value-Add Flags */}
          {(property.has_value_add_potential || property.is_ex_local_authority) && (
            <div className="flex flex-wrap gap-2">
              {property.has_value_add_potential && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                  <Wrench className="w-3 h-3" />
                  Value-Add Potential
                </span>
              )}
              {property.is_ex_local_authority && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                  <Home className="w-3 h-3" />
                  Ex-Local Authority
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function ScoreBar({ label, score, maxScore }: { label: string; score: number; maxScore: number }) {
  const percentage = (score / maxScore) * 100

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-900">{score}/{maxScore}</span>
      </div>
      <Progress value={percentage} className="h-1.5" />
    </div>
  )
}

function ComplianceItem({ label, compliant }: { label: string; compliant: boolean }) {
  return (
    <div className="text-center">
      <div className={`w-6 h-6 mx-auto rounded-full flex items-center justify-center ${
        compliant ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"
      }`}>
        {compliant ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>
      <div className="text-xs text-slate-600 mt-1">{label}</div>
    </div>
  )
}
