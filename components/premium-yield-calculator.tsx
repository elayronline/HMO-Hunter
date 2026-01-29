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

  // Room configuration
  const [rooms, setRooms] = useState<RoomConfig[]>(() => {
    const numRooms = property.bedrooms || 3
    return Array.from({ length: numRooms }, (_, i) => ({
      id: i + 1,
      name: `Room ${i + 1}`,
      rent: 550,
      size: "medium" as const,
    }))
  })

  // Custom inputs
  const [customPrice, setCustomPrice] = useState<number>(property.purchase_price || 0)
  const [customCosts, setCustomCosts] = useState(DEFAULT_COSTS)
  const [scenarioAdjustment, setScenarioAdjustment] = useState(0) // price negotiation %

  // Calculations
  const calculations = useMemo(() => {
    const purchasePrice = customPrice * (1 - scenarioAdjustment / 100)
    const totalMonthlyRent = rooms.reduce((sum, r) => sum + r.rent, 0)
    const annualGrossRent = totalMonthlyRent * 12

    // Costs
    const voidCost = annualGrossRent * (customCosts.voidRate / 100)
    const mgmtCost = annualGrossRent * (customCosts.managementFee / 100)
    const maintCost = annualGrossRent * (customCosts.maintenanceReserve / 100)
    const utilitiesCost = customCosts.utilities * 12
    const fixedCosts = customCosts.insurance + customCosts.licenceFee + customCosts.councilTax

    const totalCosts = voidCost + mgmtCost + maintCost + utilitiesCost + fixedCosts
    const annualNetRent = annualGrossRent - totalCosts

    // Mortgage (if applicable)
    const mortgageAmount = purchasePrice * (customCosts.ltv / 100)
    const monthlyMortgage = mortgageAmount * (customCosts.mortgageRate / 100 / 12)
    const annualMortgage = monthlyMortgage * 12

    const cashflow = annualNetRent - annualMortgage
    const deposit = purchasePrice - mortgageAmount

    // Yields
    const grossYield = purchasePrice > 0 ? (annualGrossRent / purchasePrice) * 100 : 0
    const netYield = purchasePrice > 0 ? (annualNetRent / purchasePrice) * 100 : 0
    const cashOnCash = deposit > 0 ? (cashflow / deposit) * 100 : 0

    // Deal Score (0-100)
    let dealScore = 50
    if (netYield > 8) dealScore += 20
    else if (netYield > 6) dealScore += 10
    else if (netYield < 4) dealScore -= 15

    if (cashOnCash > 12) dealScore += 15
    else if (cashOnCash > 8) dealScore += 8
    else if (cashOnCash < 0) dealScore -= 20

    if (rooms.length >= 5) dealScore += 10
    if (property.epc_rating === "A" || property.epc_rating === "B") dealScore += 5
    if (property.epc_rating === "E" || property.epc_rating === "F" || property.epc_rating === "G") dealScore -= 10

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
      <div className="rounded-2xl overflow-hidden border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <Calculator className="w-8 h-8 text-white" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <h3 className="text-lg font-bold text-slate-900">Premium Yield Calculator</h3>
            <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full text-[10px] font-bold text-white flex items-center gap-1">
              <Crown className="w-3 h-3" /> PRO
            </span>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Room-by-room analysis, deal scoring, scenario modelling & more
          </p>
          <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <Check className="w-3.5 h-3.5 text-green-500" /> True net yield
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Check className="w-3.5 h-3.5 text-green-500" /> Cash-on-cash ROI
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Check className="w-3.5 h-3.5 text-green-500" /> Deal scoring
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Check className="w-3.5 h-3.5 text-green-500" /> PDF reports
            </div>
          </div>
          <Button
            onClick={onUpgrade}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          >
            <Lock className="w-4 h-4 mr-2" />
            Unlock Premium
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-purple-200 bg-white shadow-xl">
      {/* Header with Deal Score */}
      <div className="bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-white/20 rounded-xl">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Yield Calculator</span>
                <span className="px-1.5 py-0.5 bg-white/20 rounded text-[10px] font-semibold text-white">PRO</span>
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-3 bg-white/10 hover:bg-white/20 text-white text-xs"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white/10 backdrop-blur rounded-xl p-2.5 text-center">
            <div className="text-[10px] text-white/70 uppercase tracking-wide">Net Yield</div>
            <div className="text-lg font-bold text-white">{calculations.netYield.toFixed(1)}%</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-2.5 text-center">
            <div className="text-[10px] text-white/70 uppercase tracking-wide">Cash-on-Cash</div>
            <div className="text-lg font-bold text-white">{calculations.cashOnCash.toFixed(1)}%</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-2.5 text-center">
            <div className="text-[10px] text-white/70 uppercase tracking-wide">Monthly</div>
            <div className="text-lg font-bold text-white">£{Math.round(calculations.cashflow / 12).toLocaleString()}</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-2.5 text-center">
            <div className="text-[10px] text-white/70 uppercase tracking-wide">Deal Score</div>
            <div className={`text-lg font-bold ${calculations.dealScore >= 60 ? 'text-green-300' : calculations.dealScore >= 40 ? 'text-amber-300' : 'text-red-300'}`}>
              {calculations.dealScore}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100">
        {[
          { id: "overview", label: "Overview", icon: BarChart3 },
          { id: "rooms", label: "Rooms", icon: BedDouble },
          { id: "costs", label: "Costs", icon: PoundSterling },
          { id: "scenarios", label: "Scenarios", icon: Zap },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
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
          <div className="space-y-4">
            {/* Deal Score Card */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-700">Deal Score</span>
                <span className={`text-2xl font-bold ${getDealScoreColor(calculations.dealScore)}`}>
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
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Poor</span>
                <span className={`font-medium ${getDealScoreColor(calculations.dealScore)}`}>
                  {getDealScoreLabel(calculations.dealScore)}
                </span>
                <span>Excellent</span>
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-purple-50 rounded-xl p-3">
                <div className="text-[10px] text-purple-600 uppercase tracking-wide mb-1">Gross Yield</div>
                <div className="text-xl font-bold text-purple-700">{calculations.grossYield.toFixed(1)}%</div>
                <div className="text-[10px] text-slate-500">Before costs</div>
              </div>
              <div className="bg-green-50 rounded-xl p-3">
                <div className="text-[10px] text-green-600 uppercase tracking-wide mb-1">Net Yield</div>
                <div className="text-xl font-bold text-green-700">{calculations.netYield.toFixed(1)}%</div>
                <div className="text-[10px] text-slate-500">After all costs</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-3">
                <div className="text-[10px] text-blue-600 uppercase tracking-wide mb-1">Annual Cashflow</div>
                <div className="text-xl font-bold text-blue-700">£{calculations.cashflow.toLocaleString()}</div>
                <div className="text-[10px] text-slate-500">After mortgage</div>
              </div>
              <div className="bg-amber-50 rounded-xl p-3">
                <div className="text-[10px] text-amber-600 uppercase tracking-wide mb-1">5-Year ROI</div>
                <div className="text-xl font-bold text-amber-700">{calculations.roi5yr.toFixed(0)}%</div>
                <div className="text-[10px] text-slate-500">Total return</div>
              </div>
            </div>

            {/* Quick Summary */}
            <div className="bg-slate-50 rounded-xl p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Purchase Price</span>
                <span className="font-semibold">£{calculations.purchasePrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Deposit ({customCosts.ltv}% LTV)</span>
                <span className="font-semibold">£{calculations.deposit.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Monthly Rent ({rooms.length} rooms)</span>
                <span className="font-semibold">£{calculations.totalMonthlyRent.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Price per Room</span>
                <span className="font-semibold">£{Math.round(calculations.pricePerRoom).toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* Rooms Tab */}
        {activeTab === "rooms" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Room Configuration</span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  onClick={removeRoom}
                  disabled={rooms.length <= 1}
                >
                  <Minus className="w-3.5 h-3.5" />
                </Button>
                <span className="w-8 text-center text-sm font-medium">{rooms.length}</span>
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
                <div key={room.id} className="bg-slate-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">Room {room.id}</span>
                    <div className="flex gap-1">
                      {(Object.keys(ROOM_PRESETS) as Array<keyof typeof ROOM_PRESETS>).map((size) => (
                        <button
                          key={size}
                          onClick={() => updateRoomSize(room.id, size)}
                          className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-all ${
                            room.size === size
                              ? "bg-purple-600 text-white"
                              : "bg-white text-slate-500 hover:bg-purple-100"
                          }`}
                        >
                          {ROOM_PRESETS[size].icon}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">£</span>
                    <Input
                      type="number"
                      value={room.rent}
                      onChange={(e) => updateRoomRent(room.id, Number(e.target.value))}
                      className="h-8 text-sm font-medium"
                    />
                    <span className="text-xs text-slate-500">/month</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-purple-50 rounded-xl p-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-purple-700">Total Monthly Rent</span>
              <span className="text-xl font-bold text-purple-700">
                £{calculations.totalMonthlyRent.toLocaleString()}
              </span>
            </div>

            <div className="text-[10px] text-slate-500 text-center">
              S = Small (£450) • M = Medium (£550) • L = Large (£650) • E = En-suite (£750)
            </div>
          </div>
        )}

        {/* Costs Tab */}
        {activeTab === "costs" && (
          <div className="space-y-4">
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600">Void Rate</span>
                  <span className="font-medium">{customCosts.voidRate}%</span>
                </div>
                <Slider
                  value={[customCosts.voidRate]}
                  onValueChange={([v]) => setCustomCosts({ ...customCosts, voidRate: v })}
                  min={0}
                  max={20}
                  step={1}
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600">Management Fee</span>
                  <span className="font-medium">{customCosts.managementFee}%</span>
                </div>
                <Slider
                  value={[customCosts.managementFee]}
                  onValueChange={([v]) => setCustomCosts({ ...customCosts, managementFee: v })}
                  min={0}
                  max={20}
                  step={1}
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600">Maintenance Reserve</span>
                  <span className="font-medium">{customCosts.maintenanceReserve}%</span>
                </div>
                <Slider
                  value={[customCosts.maintenanceReserve]}
                  onValueChange={([v]) => setCustomCosts({ ...customCosts, maintenanceReserve: v })}
                  min={0}
                  max={20}
                  step={1}
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600">Mortgage Rate</span>
                  <span className="font-medium">{customCosts.mortgageRate}%</span>
                </div>
                <Slider
                  value={[customCosts.mortgageRate * 10]}
                  onValueChange={([v]) => setCustomCosts({ ...customCosts, mortgageRate: v / 10 })}
                  min={30}
                  max={80}
                  step={1}
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600">LTV</span>
                  <span className="font-medium">{customCosts.ltv}%</span>
                </div>
                <Slider
                  value={[customCosts.ltv]}
                  onValueChange={([v]) => setCustomCosts({ ...customCosts, ltv: v })}
                  min={50}
                  max={85}
                  step={5}
                  className="w-full"
                />
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="bg-slate-50 rounded-xl p-3 space-y-2">
              <div className="text-xs font-semibold text-slate-700 mb-2">Annual Cost Breakdown</div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">Voids ({customCosts.voidRate}%)</span>
                  <span>£{Math.round(calculations.costBreakdown.voids).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Management ({customCosts.managementFee}%)</span>
                  <span>£{Math.round(calculations.costBreakdown.management).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Maintenance ({customCosts.maintenanceReserve}%)</span>
                  <span>£{Math.round(calculations.costBreakdown.maintenance).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Insurance</span>
                  <span>£{customCosts.insurance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">HMO Licence</span>
                  <span>£{customCosts.licenceFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Mortgage</span>
                  <span>£{Math.round(calculations.costBreakdown.mortgage).toLocaleString()}</span>
                </div>
                <div className="border-t border-slate-200 pt-1.5 flex justify-between font-semibold">
                  <span>Total Costs</span>
                  <span>£{Math.round(calculations.totalCosts + calculations.costBreakdown.mortgage).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scenarios Tab */}
        {activeTab === "scenarios" && (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-600">Price Negotiation</span>
                <span className="font-medium text-green-600">-{scenarioAdjustment}%</span>
              </div>
              <Slider
                value={[scenarioAdjustment]}
                onValueChange={([v]) => setScenarioAdjustment(v)}
                min={0}
                max={20}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>Asking: £{customPrice.toLocaleString()}</span>
                <span>Your offer: £{calculations.purchasePrice.toLocaleString()}</span>
              </div>
            </div>

            {/* Scenario Comparison */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <div className="text-[10px] text-slate-500 uppercase mb-1">At Asking Price</div>
                <div className="text-lg font-bold text-slate-700">
                  {((calculations.annualNetRent / customPrice) * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] text-slate-500">Net Yield</div>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center border-2 border-green-200">
                <div className="text-[10px] text-green-600 uppercase mb-1">With Negotiation</div>
                <div className="text-lg font-bold text-green-700">
                  {calculations.netYield.toFixed(1)}%
                </div>
                <div className="text-[10px] text-green-600">Net Yield</div>
              </div>
            </div>

            {/* What-If Summary */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4">
              <div className="text-sm font-semibold text-purple-700 mb-3">5-Year Projection</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Cashflow</span>
                  <span className="font-semibold">£{Math.round(calculations.totalReturn5yr - (customPrice * 0.04 * 5)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Capital Growth (4%/yr)</span>
                  <span className="font-semibold">£{Math.round(customPrice * 0.04 * 5).toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-purple-200 pt-2">
                  <span className="font-semibold text-purple-700">Total Return</span>
                  <span className="font-bold text-purple-700">£{Math.round(calculations.totalReturn5yr).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">ROI on Deposit</span>
                  <span className="font-bold text-green-600">{calculations.roi5yr.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
