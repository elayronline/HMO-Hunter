"use client"

import { useState, useMemo } from "react"
import { Calculator, TrendingUp, ChevronDown, ChevronUp, Lock, Crown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import type { Property } from "@/lib/types/database"

interface YieldCalculatorProps {
  property: Property
  defaultOpen?: boolean
  isPremium?: boolean
}

// Default assumptions
const DEFAULT_ASSUMPTIONS = {
  voidRate: 5,
  managementFee: 10,
  maintenanceReserve: 5,
  fixedCosts: 1700,
  annualRentGrowth: 3,
  annualValueGrowth: 4,
}

export function YieldCalculator({ property, defaultOpen = false, isPremium = false }: YieldCalculatorProps) {
  const [isEnabled, setIsEnabled] = useState(isPremium && defaultOpen)
  const [customMonthlyRent, setCustomMonthlyRent] = useState<number | null>(null)
  const [customPurchasePrice, setCustomPurchasePrice] = useState<number | null>(null)

  const isRental = property.listing_type === "rent"

  // Get monthly rent
  const monthlyRent = useMemo(() => {
    if (customMonthlyRent && customMonthlyRent > 0) return customMonthlyRent
    if (property.price_pcm && property.price_pcm > 0) return property.price_pcm
    if (property.estimated_gross_monthly_rent && property.estimated_gross_monthly_rent > 0) return property.estimated_gross_monthly_rent
    if (property.estimated_rent_per_room && property.estimated_rent_per_room > 0) {
      const rooms = property.lettable_rooms || property.bedrooms || 1
      return property.estimated_rent_per_room * rooms
    }
    if (property.area_avg_rent && property.area_avg_rent > 0) return property.area_avg_rent
    return 0
  }, [property, customMonthlyRent])

  // Get purchase price (only for purchase listings)
  const purchasePrice = useMemo(() => {
    if (!isRental) {
      if (customPurchasePrice && customPurchasePrice > 0) return customPurchasePrice
      if (property.purchase_price && property.purchase_price > 0) return property.purchase_price
      if (property.estimated_value && property.estimated_value > 0) return property.estimated_value
    }
    return 0
  }, [property, customPurchasePrice, isRental])

  const rooms = property.lettable_rooms || property.bedrooms || 1
  const rentPerRoom = monthlyRent > 0 ? Math.round(monthlyRent / rooms) : 0
  const annualGross = monthlyRent * 12

  // Calculate costs
  const costs = useMemo(() => {
    const voidCost = annualGross * (DEFAULT_ASSUMPTIONS.voidRate / 100)
    const mgmtCost = annualGross * (DEFAULT_ASSUMPTIONS.managementFee / 100)
    const maintCost = annualGross * (DEFAULT_ASSUMPTIONS.maintenanceReserve / 100)
    const totalCosts = voidCost + mgmtCost + maintCost + DEFAULT_ASSUMPTIONS.fixedCosts
    return {
      total: totalCosts,
      net: annualGross - totalCosts,
    }
  }, [annualGross])

  // Calculate projections
  const projections = useMemo(() => {
    if (monthlyRent <= 0) return null

    let y1Net = costs.net
    let y3Net = 0
    let y5Net = 0
    let cumulative = 0

    for (let i = 1; i <= 5; i++) {
      const yearNet = y1Net * Math.pow(1 + DEFAULT_ASSUMPTIONS.annualRentGrowth / 100, i - 1)
      cumulative += yearNet
      if (i === 1) y1Net = yearNet
      if (i === 3) y3Net = cumulative
      if (i === 5) y5Net = cumulative
    }

    if (!isRental && purchasePrice > 0) {
      const y1Yield = (y1Net / purchasePrice) * 100
      const y3Return = y3Net + (purchasePrice * Math.pow(1 + DEFAULT_ASSUMPTIONS.annualValueGrowth / 100, 3) - purchasePrice)
      const y5Return = y5Net + (purchasePrice * Math.pow(1 + DEFAULT_ASSUMPTIONS.annualValueGrowth / 100, 5) - purchasePrice)
      return {
        y1: { net: Math.round(y1Net), yield: y1Yield.toFixed(1) },
        y3: { net: Math.round(y3Net), total: Math.round(y3Return), yield: ((y3Return / purchasePrice) * 100).toFixed(1) },
        y5: { net: Math.round(y5Net), total: Math.round(y5Return), yield: ((y5Return / purchasePrice) * 100).toFixed(1) },
      }
    }

    return {
      y1: { net: Math.round(y1Net) },
      y3: { net: Math.round(y3Net) },
      y5: { net: Math.round(y5Net) },
    }
  }, [monthlyRent, costs.net, purchasePrice, isRental])

  const canCalculate = monthlyRent > 0 && (isRental || purchasePrice > 0)
  const needsInput = isRental ? monthlyRent <= 0 : (monthlyRent <= 0 || purchasePrice <= 0)

  return (
    <div className="rounded-xl overflow-hidden border-2 border-purple-300 bg-gradient-to-br from-purple-50 via-violet-50 to-indigo-50 shadow-lg">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <Calculator className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Yield Calculator</span>
              <span className="px-1.5 py-0.5 bg-white/20 rounded text-[10px] font-semibold text-white flex items-center gap-1">
                <Crown className="w-3 h-3" />
                PRO
              </span>
            </div>
            {canCalculate && projections && (
              <span className="text-xs text-white/80">
                {isRental
                  ? `£${projections.y1.net.toLocaleString()}/yr net`
                  : `${projections.y1.yield}% yield`
                }
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isPremium && (
            <Lock className="w-4 h-4 text-white/60" />
          )}
          <Switch
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
            disabled={!isPremium}
            className={!isPremium ? "opacity-50 cursor-not-allowed" : ""}
          />
        </div>
      </div>

      {/* Content */}
      {!isPremium ? (
        <div className="px-4 py-6 text-center">
          <Lock className="w-8 h-8 text-purple-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700">Premium Feature</p>
          <p className="text-xs text-slate-500 mt-1">Upgrade to access yield projections</p>
        </div>
      ) : isEnabled ? (
        <div className="px-3 py-3 space-y-2">
          {/* Input section for missing data */}
          {needsInput && (
            <div className="flex gap-2">
              {monthlyRent <= 0 && (
                <div className="flex-1">
                  <Input
                    type="number"
                    placeholder="Monthly rent £"
                    value={customMonthlyRent || ""}
                    onChange={(e) => setCustomMonthlyRent(e.target.value ? Number(e.target.value) : null)}
                    className="h-7 text-xs"
                  />
                </div>
              )}
              {!isRental && purchasePrice <= 0 && (
                <div className="flex-1">
                  <Input
                    type="number"
                    placeholder="Purchase price £"
                    value={customPurchasePrice || ""}
                    onChange={(e) => setCustomPurchasePrice(e.target.value ? Number(e.target.value) : null)}
                    className="h-7 text-xs"
                  />
                </div>
              )}
            </div>
          )}

          {canCalculate && projections && (
            <>
              {/* Key figures row */}
              <div className="flex gap-2 text-xs">
                <div className="flex-1 bg-white rounded-lg p-2 text-center shadow-sm">
                  <div className="text-slate-500">Monthly</div>
                  <div className="font-bold text-slate-900">£{monthlyRent.toLocaleString()}</div>
                </div>
                <div className="flex-1 bg-white rounded-lg p-2 text-center shadow-sm">
                  <div className="text-slate-500">{rooms} rooms</div>
                  <div className="font-bold text-slate-900">£{rentPerRoom}/rm</div>
                </div>
                <div className="flex-1 bg-white rounded-lg p-2 text-center shadow-sm">
                  <div className="text-slate-500">Annual Net</div>
                  <div className="font-bold text-purple-600">£{costs.net.toLocaleString()}</div>
                </div>
              </div>

              {/* Projections */}
              <div className="bg-white rounded-lg p-2 shadow-sm">
                <div className="flex items-center gap-1 mb-2">
                  <TrendingUp className="w-3 h-3 text-purple-500" />
                  <span className="text-xs font-semibold text-slate-700">
                    {isRental ? "Net Income Projections" : "Return Projections"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-purple-50 rounded-lg p-2">
                    <div className="text-[10px] text-slate-500">1 Year</div>
                    {isRental ? (
                      <div className="text-sm font-bold text-purple-600">£{projections.y1.net.toLocaleString()}</div>
                    ) : (
                      <>
                        <div className="text-sm font-bold text-purple-600">{projections.y1.yield}%</div>
                        <div className="text-[10px] text-slate-500">£{projections.y1.net.toLocaleString()}</div>
                      </>
                    )}
                  </div>
                  <div className="bg-purple-50 rounded-lg p-2">
                    <div className="text-[10px] text-slate-500">3 Years</div>
                    {isRental ? (
                      <div className="text-sm font-bold text-purple-600">£{projections.y3.net.toLocaleString()}</div>
                    ) : (
                      <>
                        <div className="text-sm font-bold text-purple-600">{projections.y3.yield}%</div>
                        <div className="text-[10px] text-slate-500">£{projections.y3.total?.toLocaleString()}</div>
                      </>
                    )}
                  </div>
                  <div className="bg-gradient-to-br from-purple-100 to-indigo-100 rounded-lg p-2 border border-purple-300">
                    <div className="text-[10px] text-slate-500">5 Years</div>
                    {isRental ? (
                      <div className="text-sm font-bold text-purple-700">£{projections.y5.net.toLocaleString()}</div>
                    ) : (
                      <>
                        <div className="text-sm font-bold text-purple-700">{projections.y5.yield}%</div>
                        <div className="text-[10px] text-slate-500">£{projections.y5.total?.toLocaleString()}</div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Methodology explanation */}
              <div className="text-[10px] text-slate-400 italic px-1">
                {isRental
                  ? `Net income after ${DEFAULT_ASSUMPTIONS.voidRate}% voids, ${DEFAULT_ASSUMPTIONS.managementFee}% mgmt, ${DEFAULT_ASSUMPTIONS.maintenanceReserve}% maint, £${DEFAULT_ASSUMPTIONS.fixedCosts} fixed. ${DEFAULT_ASSUMPTIONS.annualRentGrowth}% annual growth.`
                  : `ROI = net income + ${DEFAULT_ASSUMPTIONS.annualValueGrowth}% capital growth. Costs: ${DEFAULT_ASSUMPTIONS.voidRate}% voids, ${DEFAULT_ASSUMPTIONS.managementFee}% mgmt, ${DEFAULT_ASSUMPTIONS.maintenanceReserve}% maint.`
                }
              </div>
            </>
          )}

          {!canCalculate && !needsInput && (
            <div className="py-4 text-xs text-slate-500 text-center">
              Enter rent data to calculate
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 py-4 text-center text-xs text-slate-500">
          Toggle on to view yield projections
        </div>
      )}
    </div>
  )
}
