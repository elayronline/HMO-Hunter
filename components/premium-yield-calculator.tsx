"use client"

import { useState, useMemo } from "react"
import {
  Calculator,
  TrendingUp,
  Home,
  PoundSterling,
  Percent,
  ChevronRight,
  Download,
  BarChart3,
  Zap,
  Shield,
  Sparkles,
  Lock,
  Crown,
  BedDouble,
  Plus,
  Minus,
  Settings2,
  FileText,
  ArrowRight,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import type { Property } from "@/lib/types/database"

interface PremiumYieldCalculatorProps {
  property: Property
  isPremium?: boolean
  onUpgrade?: () => void
}

type TabType = "overview" | "rooms" | "costs" | "scenarios"

interface RoomConfig {
  id: number
  name: string
  rent: number
  size: "small" | "medium" | "large" | "ensuite"
}

const ROOM_PRESETS = {
  small: { label: "Small", rent: 450, icon: "S" },
  medium: { label: "Medium", rent: 550, icon: "M" },
  large: { label: "Large", rent: 650, icon: "L" },
  ensuite: { label: "En-suite", rent: 750, icon: "E" },
}

const DEFAULT_COSTS = {
  voidRate: 8,
  managementFee: 12,
  maintenanceReserve: 10,
  insurance: 1200,
  licenceFee: 750,
  utilities: 200, // per month if included
  councilTax: 0,
  mortgageRate: 5.5,
  ltv: 75,
}

export function PremiumYieldCalculator({
  property,
  isPremium = false,
  onUpgrade,
}: PremiumYieldCalculatorProps) {
  const [activeTab, setActiveTab] = useState<TabType>("overview")
  const [showDetails, setShowDetails] = useState(false)

  // Get the best available rent estimate from property data
  const getInitialRoomRent = (): number => {
    // Priority: estimated_rent_per_room > area_avg_rent / rooms > default
    if (property.estimated_rent_per_room && property.estimated_rent_per_room > 0) {
      return Math.round(property.estimated_rent_per_room)
    }
    if (property.estimated_gross_monthly_rent && property.estimated_gross_monthly_rent > 0) {
      const numRooms = property.lettable_rooms || property.bedrooms || 3
      return Math.round(property.estimated_gross_monthly_rent / numRooms)
    }
    if (property.area_avg_rent && property.area_avg_rent > 0) {
      const numRooms = property.lettable_rooms || property.bedrooms || 3
      return Math.round(property.area_avg_rent / numRooms)
    }
    return 550 // Default fallback
  }

  // Room configuration - use lettable_rooms over bedrooms if available
  const [rooms, setRooms] = useState<RoomConfig[]>(() => {
    const numRooms = property.lettable_rooms || property.bedrooms || 3
    const initialRent = getInitialRoomRent()
    // Determine size based on rent level
    const getSize = (rent: number): RoomConfig["size"] => {
      if (rent >= 700) return "ensuite"
      if (rent >= 600) return "large"
      if (rent >= 500) return "medium"
      return "small"
    }
    return Array.from({ length: numRooms }, (_, i) => ({
      id: i + 1,
      name: `Room ${i + 1}`,
      rent: initialRent,
      size: getSize(initialRent),
    }))
  })

  // Custom inputs - use purchase_price or estimated_value
  const [customPrice, setCustomPrice] = useState<number>(
    property.purchase_price || property.estimated_value || 0
  )
  const [customCosts, setCustomCosts] = useState(DEFAULT_COSTS)
  const [scenarioAdjustment, setScenarioAdjustment] = useState(0) // price negotiation %

  // Calculations
  const calculations = useMemo(() => {
    // Ensure valid purchase price (minimum £1 to avoid division by zero)
    const purchasePrice = Math.max(1, customPrice * (1 - scenarioAdjustment / 100))

    // Calculate total monthly rent from rooms (ensure each room rent is valid)
    const totalMonthlyRent = rooms.reduce((sum, r) => sum + Math.max(0, r.rent || 0), 0)
    const annualGrossRent = totalMonthlyRent * 12

    // Costs (ensure percentages are valid 0-100)
    const voidRate = Math.max(0, Math.min(100, customCosts.voidRate))
    const mgmtRate = Math.max(0, Math.min(100, customCosts.managementFee))
    const maintRate = Math.max(0, Math.min(100, customCosts.maintenanceReserve))

    const voidCost = annualGrossRent * (voidRate / 100)
    const mgmtCost = annualGrossRent * (mgmtRate / 100)
    const maintCost = annualGrossRent * (maintRate / 100)
    const utilitiesCost = Math.max(0, customCosts.utilities) * 12
    const fixedCosts = Math.max(0, customCosts.insurance) + Math.max(0, customCosts.licenceFee) + Math.max(0, customCosts.councilTax)

    const totalCosts = voidCost + mgmtCost + maintCost + utilitiesCost + fixedCosts
    const annualNetRent = annualGrossRent - totalCosts

    // Mortgage (ensure valid LTV 0-100 and rate)
    const ltv = Math.max(0, Math.min(100, customCosts.ltv))
    const mortgageRate = Math.max(0, customCosts.mortgageRate)
    const mortgageAmount = purchasePrice * (ltv / 100)
    const monthlyMortgage = mortgageAmount * (mortgageRate / 100 / 12)
    const annualMortgage = monthlyMortgage * 12

    const cashflow = annualNetRent - annualMortgage
    const deposit = purchasePrice - mortgageAmount

    // Yields (with safeguards against division by zero)
    const grossYield = purchasePrice > 0 ? (annualGrossRent / purchasePrice) * 100 : 0
    const netYield = purchasePrice > 0 ? (annualNetRent / purchasePrice) * 100 : 0
    const cashOnCash = deposit > 0 ? (cashflow / deposit) * 100 : 0

    // Deal Score (0-100) - Enhanced with more property data
    let dealScore = 50

    // Yield scoring (0-20 points)
    if (netYield > 8) dealScore += 20
    else if (netYield > 6) dealScore += 10
    else if (netYield > 4) dealScore += 0
    else dealScore -= 15

    // Cash-on-cash scoring (0-15 points)
    if (cashOnCash > 12) dealScore += 15
    else if (cashOnCash > 8) dealScore += 8
    else if (cashOnCash > 4) dealScore += 4
    else if (cashOnCash < 0) dealScore -= 20

    // Room count scoring (0-10 points)
    if (rooms.length >= 6) dealScore += 10
    else if (rooms.length >= 5) dealScore += 7
    else if (rooms.length >= 4) dealScore += 3

    // EPC scoring (±10 points)
    if (property.epc_rating === "A" || property.epc_rating === "B") dealScore += 10
    else if (property.epc_rating === "C") dealScore += 5
    else if (property.epc_rating === "D") dealScore += 0
    else if (property.epc_rating === "E") dealScore -= 5
    else if (property.epc_rating === "F" || property.epc_rating === "G") dealScore -= 10

    // Licensed HMO bonus (+5 points)
    if (property.licensed_hmo) dealScore += 5

    // Article 4 penalty (-5 points)
    if (property.article_4_area) dealScore -= 5

    // Floor area bonus for larger properties
    if (property.floor_area_band === "120_plus") dealScore += 5
    else if (property.floor_area_band === "90_120") dealScore += 2

    // Price per room scoring (lower is better)
    if (pricePerRoom > 0) {
      if (pricePerRoom < 50000) dealScore += 5
      else if (pricePerRoom < 70000) dealScore += 2
      else if (pricePerRoom > 100000) dealScore -= 5
    }

    dealScore = Math.max(0, Math.min(100, dealScore))

    // Price per room
    const pricePerRoom = purchasePrice > 0 ? purchasePrice / rooms.length : 0

    // 5-year projection
    const rentGrowth = 0.03
    const valueGrowth = 0.04
    let totalCashflow = 0
    for (let i = 0; i < 5; i++) {
      totalCashflow += cashflow * Math.pow(1 + rentGrowth, i)
    }
    const futureValue = purchasePrice * Math.pow(1 + valueGrowth, 5)
    const totalReturn5yr = totalCashflow + (futureValue - purchasePrice)
    const roi5yr = deposit > 0 ? (totalReturn5yr / deposit) * 100 : 0

    return {
      purchasePrice,
      totalMonthlyRent,
      annualGrossRent,
      annualNetRent,
      totalCosts,
      grossYield,
      netYield,
      cashOnCash,
      cashflow,
      monthlyMortgage,
      deposit,
      dealScore,
      pricePerRoom,
      totalReturn5yr,
      roi5yr,
      costBreakdown: {
        voids: voidCost,
        management: mgmtCost,
        maintenance: maintCost,
        utilities: utilitiesCost,
        insurance: customCosts.insurance,
        licence: customCosts.licenceFee,
        mortgage: annualMortgage,
      },
    }
  }, [rooms, customPrice, customCosts, scenarioAdjustment, property])

  const addRoom = () => {
    setRooms([...rooms, {
      id: rooms.length + 1,
      name: `Room ${rooms.length + 1}`,
      rent: 550,
      size: "medium",
    }])
  }

  const removeRoom = () => {
    if (rooms.length > 1) {
      setRooms(rooms.slice(0, -1))
    }
  }

  const updateRoomRent = (id: number, rent: number) => {
    setRooms(rooms.map(r => r.id === id ? { ...r, rent } : r))
  }

  const updateRoomSize = (id: number, size: RoomConfig["size"]) => {
    setRooms(rooms.map(r => r.id === id ? { ...r, size, rent: ROOM_PRESETS[size].rent } : r))
  }

  const getDealScoreColor = (score: number) => {
    if (score >= 70) return "text-green-600"
    if (score >= 50) return "text-amber-600"
    return "text-red-600"
  }

  const getDealScoreLabel = (score: number) => {
    if (score >= 80) return "Excellent"
    if (score >= 70) return "Great"
    if (score >= 60) return "Good"
    if (score >= 50) return "Fair"
    if (score >= 40) return "Below Average"
    return "Poor"
  }

  // Locked state for non-premium
  if (!isPremium) {
    return (
      <div className="rounded-xl overflow-hidden border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 w-full">
        <div className="p-5 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <Calculator className="w-7 h-7 text-white" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <h3 className="text-base font-bold text-slate-900">Premium Calculator</h3>
            <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full text-[10px] font-bold text-white flex items-center gap-1">
              <Crown className="w-3 h-3" /> PRO
            </span>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Room-by-room analysis, deal scoring & more
          </p>
          <div className="grid grid-cols-2 gap-2 mb-4 text-left">
            {[
              "True net yield",
              "Cash-on-cash ROI",
              "Deal scoring",
              "PDF reports",
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
                <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
          <Button
            onClick={onUpgrade}
            className="w-full h-9 text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          >
            <Lock className="w-4 h-4 mr-1.5" />
            Unlock Premium
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl overflow-hidden border border-purple-200 bg-white shadow-lg w-full">
      {/* Header with Deal Score */}
      <div className="bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <Calculator className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-white">Yield Calculator</span>
            <span className="px-1.5 py-0.5 bg-white/20 rounded text-[10px] font-semibold text-white">PRO</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 bg-white/10 hover:bg-white/20 text-white text-xs"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            Export
          </Button>
        </div>

        {/* Quick Stats - 2x2 Grid */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Net Yield", value: `${calculations.netYield.toFixed(1)}%`, color: "text-white" },
            { label: "Cash-on-Cash", value: `${calculations.cashOnCash.toFixed(1)}%`, color: "text-white" },
            { label: "Monthly", value: `£${Math.round(calculations.cashflow / 12).toLocaleString()}`, color: "text-white" },
            { label: "Deal Score", value: `${calculations.dealScore}/100`, color: calculations.dealScore >= 60 ? 'text-green-300' : calculations.dealScore >= 40 ? 'text-amber-300' : 'text-red-300' },
          ].map((stat, i) => (
            <div key={i} className="bg-white/10 backdrop-blur rounded-lg p-2.5">
              <div className="text-[10px] text-white/70 uppercase tracking-wide">{stat.label}</div>
              <div className={`text-base font-bold ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {[
          { id: "overview", label: "Overview", icon: BarChart3 },
          { id: "rooms", label: "Rooms", icon: BedDouble },
          { id: "costs", label: "Costs", icon: PoundSterling },
          { id: "scenarios", label: "Scenarios", icon: Zap },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex-1 h-10 text-xs font-medium flex items-center justify-center gap-1 transition-all ${
              activeTab === tab.id
                ? "text-purple-600 border-b-2 border-purple-600 bg-purple-50/50"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-3">
            {/* Deal Score Card */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-700">Deal Score</span>
                <span className={`text-xl font-bold ${getDealScoreColor(calculations.dealScore)}`}>
                  {calculations.dealScore}/100
                </span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all ${
                    calculations.dealScore >= 70 ? 'bg-green-500' :
                    calculations.dealScore >= 50 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${calculations.dealScore}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500">Poor</span>
                <span className={`text-xs font-medium ${getDealScoreColor(calculations.dealScore)}`}>
                  {getDealScoreLabel(calculations.dealScore)}
                </span>
                <span className="text-[10px] text-slate-500">Excellent</span>
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Gross Yield", value: `${calculations.grossYield.toFixed(1)}%`, sub: "Before costs", bg: "bg-purple-50", labelColor: "text-purple-600", valueColor: "text-purple-700" },
                { label: "Net Yield", value: `${calculations.netYield.toFixed(1)}%`, sub: "After costs", bg: "bg-green-50", labelColor: "text-green-600", valueColor: "text-green-700" },
                { label: "Annual Cash", value: `£${calculations.cashflow.toLocaleString()}`, sub: "After mortgage", bg: "bg-blue-50", labelColor: "text-blue-600", valueColor: "text-blue-700" },
                { label: "5-Year ROI", value: `${calculations.roi5yr.toFixed(0)}%`, sub: "Total return", bg: "bg-amber-50", labelColor: "text-amber-600", valueColor: "text-amber-700" },
              ].map((metric, i) => (
                <div key={i} className={`${metric.bg} rounded-lg p-2.5`}>
                  <p className={`text-[10px] ${metric.labelColor} uppercase tracking-wide`}>{metric.label}</p>
                  <p className={`text-lg font-bold ${metric.valueColor} mt-0.5`}>{metric.value}</p>
                  <p className="text-[10px] text-slate-500">{metric.sub}</p>
                </div>
              ))}
            </div>

            {/* Quick Summary */}
            <div className="bg-slate-50 rounded-lg p-3">
              {[
                { label: "Purchase Price", value: `£${calculations.purchasePrice.toLocaleString()}` },
                { label: `Deposit (${customCosts.ltv}% LTV)`, value: `£${calculations.deposit.toLocaleString()}` },
                { label: `Monthly Rent (${rooms.length} rooms)`, value: `£${calculations.totalMonthlyRent.toLocaleString()}` },
                { label: "Price per Room", value: `£${Math.round(calculations.pricePerRoom).toLocaleString()}` },
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between h-7">
                  <span className="text-xs text-slate-600">{row.label}</span>
                  <span className="text-sm font-semibold text-slate-900">{row.value}</span>
                </div>
              ))}
            </div>

            {/* Property Data Comparison */}
            {(property.estimated_yield_percentage || property.deal_score || property.estimated_gross_monthly_rent) && (
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <h4 className="text-xs font-semibold text-blue-700 mb-2">vs. Property Estimates</h4>
                <div className="space-y-0">
                  {property.estimated_yield_percentage && (
                    <div className="flex items-center justify-between h-6">
                      <span className="text-[11px] text-slate-600">Est. Yield (listing)</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500">{property.estimated_yield_percentage.toFixed(1)}%</span>
                        <span className={`text-[11px] font-bold ${calculations.netYield > property.estimated_yield_percentage ? 'text-green-600' : 'text-amber-600'}`}>
                          {calculations.netYield > property.estimated_yield_percentage ? '↑' : '↓'} {Math.abs(calculations.netYield - property.estimated_yield_percentage).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )}
                  {property.deal_score !== null && property.deal_score !== undefined && (
                    <div className="flex items-center justify-between h-6">
                      <span className="text-[11px] text-slate-600">Deal Score (listing)</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500">{property.deal_score}/100</span>
                        <span className={`text-[11px] font-bold ${calculations.dealScore > property.deal_score ? 'text-green-600' : 'text-amber-600'}`}>
                          {calculations.dealScore > property.deal_score ? '↑' : '↓'} {Math.abs(calculations.dealScore - property.deal_score)}
                        </span>
                      </div>
                    </div>
                  )}
                  {property.estimated_gross_monthly_rent && (
                    <div className="flex items-center justify-between h-6">
                      <span className="text-[11px] text-slate-600">Est. Rent (listing)</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500">£{property.estimated_gross_monthly_rent.toLocaleString()}</span>
                        <span className={`text-[11px] font-bold ${calculations.totalMonthlyRent > property.estimated_gross_monthly_rent ? 'text-green-600' : 'text-amber-600'}`}>
                          {calculations.totalMonthlyRent > property.estimated_gross_monthly_rent ? '↑' : '↓'} £{Math.abs(calculations.totalMonthlyRent - property.estimated_gross_monthly_rent).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Rooms Tab */}
        {activeTab === "rooms" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Room Configuration</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  onClick={removeRoom}
                  disabled={rooms.length <= 1}
                >
                  <Minus className="w-3.5 h-3.5" />
                </Button>
                <span className="w-6 text-center text-sm font-bold text-slate-700">{rooms.length}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  onClick={addRoom}
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {rooms.map((room) => (
                <div key={room.id} className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">Room {room.id}</span>
                    <div className="flex gap-1">
                      {(Object.keys(ROOM_PRESETS) as Array<keyof typeof ROOM_PRESETS>).map((size) => (
                        <button
                          key={size}
                          onClick={() => updateRoomSize(room.id, size)}
                          className={`w-7 h-7 rounded text-[10px] font-bold transition-all ${
                            room.size === size
                              ? "bg-purple-600 text-white"
                              : "bg-white text-slate-500 hover:bg-purple-100 border border-slate-200"
                          }`}
                        >
                          {ROOM_PRESETS[size].icon}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">£</span>
                    <Input
                      type="number"
                      value={room.rent}
                      onChange={(e) => updateRoomRent(room.id, Number(e.target.value))}
                      className="h-8 text-sm font-medium flex-1"
                    />
                    <span className="text-xs text-slate-500">/mo</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-purple-50 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-purple-700">Total Monthly</span>
              <span className="text-lg font-bold text-purple-700">
                £{calculations.totalMonthlyRent.toLocaleString()}
              </span>
            </div>

            <p className="text-[10px] text-slate-500 text-center">
              S=Small £450 • M=Medium £550 • L=Large £650 • E=En-suite £750
            </p>
          </div>
        )}

        {/* Costs Tab */}
        {activeTab === "costs" && (
          <div className="space-y-3">
            <div className="space-y-3">
              {[
                { label: "Void Rate", value: customCosts.voidRate, suffix: "%", key: "voidRate", min: 0, max: 20, step: 1, multiplier: 1 },
                { label: "Management", value: customCosts.managementFee, suffix: "%", key: "managementFee", min: 0, max: 20, step: 1, multiplier: 1 },
                { label: "Maintenance", value: customCosts.maintenanceReserve, suffix: "%", key: "maintenanceReserve", min: 0, max: 20, step: 1, multiplier: 1 },
                { label: "Mortgage Rate", value: customCosts.mortgageRate, suffix: "%", key: "mortgageRate", min: 30, max: 80, step: 1, multiplier: 10 },
                { label: "LTV", value: customCosts.ltv, suffix: "%", key: "ltv", min: 50, max: 85, step: 5, multiplier: 1 },
              ].map((slider) => (
                <div key={slider.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-600">{slider.label}</span>
                    <span className="text-xs font-bold text-slate-900">{slider.value}{slider.suffix}</span>
                  </div>
                  <Slider
                    value={[slider.value * slider.multiplier]}
                    onValueChange={([v]) => setCustomCosts({ ...customCosts, [slider.key]: v / slider.multiplier })}
                    min={slider.min}
                    max={slider.max}
                    step={slider.step}
                    className="w-full"
                  />
                </div>
              ))}
            </div>

            {/* Cost Breakdown */}
            <div className="bg-slate-50 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Annual Costs</h4>
              <div className="space-y-0">
                {[
                  { label: `Voids (${customCosts.voidRate}%)`, value: `£${Math.round(calculations.costBreakdown.voids).toLocaleString()}` },
                  { label: `Mgmt (${customCosts.managementFee}%)`, value: `£${Math.round(calculations.costBreakdown.management).toLocaleString()}` },
                  { label: `Maint (${customCosts.maintenanceReserve}%)`, value: `£${Math.round(calculations.costBreakdown.maintenance).toLocaleString()}` },
                  { label: "Insurance", value: `£${customCosts.insurance.toLocaleString()}` },
                  { label: "HMO Licence", value: `£${customCosts.licenceFee.toLocaleString()}` },
                  { label: "Mortgage", value: `£${Math.round(calculations.costBreakdown.mortgage).toLocaleString()}` },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between h-6">
                    <span className="text-[11px] text-slate-600">{row.label}</span>
                    <span className="text-[11px] font-medium text-slate-900">{row.value}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between h-7 border-t border-slate-200 mt-1 pt-1">
                  <span className="text-sm font-semibold text-slate-700">Total</span>
                  <span className="text-sm font-bold text-slate-900">£{Math.round(calculations.totalCosts + calculations.costBreakdown.mortgage).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scenarios Tab */}
        {activeTab === "scenarios" && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-600">Price Negotiation</span>
                <span className="text-xs font-bold text-green-600">-{scenarioAdjustment}%</span>
              </div>
              <Slider
                value={[scenarioAdjustment]}
                onValueChange={([v]) => setScenarioAdjustment(v)}
                min={0}
                max={20}
                step={1}
                className="w-full"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-slate-500">Asking: £{customPrice.toLocaleString()}</span>
                <span className="text-[10px] font-medium text-slate-700">Offer: £{calculations.purchasePrice.toLocaleString()}</span>
              </div>
            </div>

            {/* Scenario Comparison */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Asking", value: `${((calculations.annualNetRent / customPrice) * 100).toFixed(1)}%`, sub: "Net Yield", bg: "bg-slate-50", border: "", labelColor: "text-slate-500", valueColor: "text-slate-700", subColor: "text-slate-500" },
                { label: "Negotiated", value: `${calculations.netYield.toFixed(1)}%`, sub: "Net Yield", bg: "bg-green-50", border: "border border-green-200", labelColor: "text-green-600", valueColor: "text-green-700", subColor: "text-green-600" },
              ].map((scenario, i) => (
                <div key={i} className={`${scenario.bg} ${scenario.border} rounded-lg p-2.5 text-center`}>
                  <span className={`text-[10px] ${scenario.labelColor} uppercase`}>{scenario.label}</span>
                  <div className={`text-lg font-bold ${scenario.valueColor} mt-0.5`}>{scenario.value}</div>
                  <span className={`text-[10px] ${scenario.subColor}`}>{scenario.sub}</span>
                </div>
              ))}
            </div>

            {/* What-If Summary */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-purple-700 mb-2">5-Year Projection</h4>
              <div className="space-y-0">
                {[
                  { label: "Total Cashflow", value: `£${Math.round(calculations.totalReturn5yr - (customPrice * 0.04 * 5)).toLocaleString()}` },
                  { label: "Capital Growth", value: `£${Math.round(customPrice * 0.04 * 5).toLocaleString()}` },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between h-6">
                    <span className="text-xs text-slate-600">{row.label}</span>
                    <span className="text-sm font-semibold text-slate-900">{row.value}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between h-8 border-t border-purple-200 mt-1 pt-1">
                  <span className="text-sm font-semibold text-purple-700">Total Return</span>
                  <span className="text-base font-bold text-purple-700">£{Math.round(calculations.totalReturn5yr).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between h-6">
                  <span className="text-xs text-slate-600">ROI on Deposit</span>
                  <span className="text-sm font-bold text-green-600">{calculations.roi5yr.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
