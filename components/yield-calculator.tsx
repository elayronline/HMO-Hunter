"use client"

import { useState, useMemo } from "react"
import { Calculator, TrendingUp, ChevronDown, ChevronUp } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { Property } from "@/lib/types/database"

interface YieldCalculatorProps {
  property: Property
  defaultOpen?: boolean
}

// Default assumptions
const DEFAULT_ASSUMPTIONS = {
  voidRate: 5,
  managementFee: 10,
  maintenanceReserve: 5,
  fixedCosts: 1700, // Insurance + licensing
  annualRentGrowth: 3,
  annualValueGrowth: 4,
}

export function YieldCalculator({ property, defaultOpen = false }: YieldCalculatorProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
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

  // Calculate projections (net income only for rentals, ROI for purchases)
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

    // For purchase listings, calculate ROI
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

    // For rentals, just cumulative net income
    return {
      y1: { net: Math.round(y1Net) },
      y3: { net: Math.round(y3Net) },
      y5: { net: Math.round(y5Net) },
    }
  }, [monthlyRent, costs.net, purchasePrice, isRental])

  const canCalculate = monthlyRent > 0 && (isRental || purchasePrice > 0)
  const needsInput = isRental ? monthlyRent <= 0 : (monthlyRent <= 0 || purchasePrice <= 0)

  return (
    <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-700">
            {isRental ? "Income Calculator" : "Yield Calculator"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {canCalculate && projections && (
            <span className="text-xs font-semibold text-emerald-600">
              {isRental
                ? `£${projections.y1.net.toLocaleString()}/yr net`
                : `${projections.y1.yield}% yield`
              }
            </span>
          )}
          {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {isOpen && (
        <div className="px-3 pb-3 space-y-2 border-t border-emerald-100">
          {/* Input section for missing data */}
          {needsInput && (
            <div className="pt-2 flex gap-2">
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
              <div className="pt-2 flex gap-3 text-xs">
                <div className="flex-1 bg-white rounded p-2 text-center">
                  <div className="text-slate-500">Monthly</div>
                  <div className="font-semibold text-slate-900">£{monthlyRent.toLocaleString()}</div>
                </div>
                <div className="flex-1 bg-white rounded p-2 text-center">
                  <div className="text-slate-500">{rooms} rooms</div>
                  <div className="font-semibold text-slate-900">£{rentPerRoom}/rm</div>
                </div>
                <div className="flex-1 bg-white rounded p-2 text-center">
                  <div className="text-slate-500">Annual Net</div>
                  <div className="font-semibold text-emerald-600">£{costs.net.toLocaleString()}</div>
                </div>
              </div>

              {/* Projections */}
              <div className="bg-white rounded p-2">
                <div className="flex items-center gap-1 mb-2">
                  <TrendingUp className="w-3 h-3 text-emerald-500" />
                  <span className="text-xs font-medium text-slate-700">
                    {isRental ? "Net Income Projections" : "Return Projections"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-emerald-50 rounded p-2">
                    <div className="text-[10px] text-slate-500">1 Year</div>
                    {isRental ? (
                      <div className="text-sm font-bold text-emerald-600">£{projections.y1.net.toLocaleString()}</div>
                    ) : (
                      <>
                        <div className="text-sm font-bold text-emerald-600">{projections.y1.yield}%</div>
                        <div className="text-[10px] text-slate-500">£{projections.y1.net.toLocaleString()}</div>
                      </>
                    )}
                  </div>
                  <div className="bg-emerald-50 rounded p-2">
                    <div className="text-[10px] text-slate-500">3 Years</div>
                    {isRental ? (
                      <div className="text-sm font-bold text-emerald-600">£{projections.y3.net.toLocaleString()}</div>
                    ) : (
                      <>
                        <div className="text-sm font-bold text-emerald-600">{projections.y3.yield}%</div>
                        <div className="text-[10px] text-slate-500">£{projections.y3.total?.toLocaleString()}</div>
                      </>
                    )}
                  </div>
                  <div className="bg-emerald-100 rounded p-2 border border-emerald-200">
                    <div className="text-[10px] text-slate-500">5 Years</div>
                    {isRental ? (
                      <div className="text-sm font-bold text-emerald-700">£{projections.y5.net.toLocaleString()}</div>
                    ) : (
                      <>
                        <div className="text-sm font-bold text-emerald-700">{projections.y5.yield}%</div>
                        <div className="text-[10px] text-slate-500">£{projections.y5.total?.toLocaleString()}</div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Costs breakdown - compact */}
              <div className="text-[10px] text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5 pt-1">
                <span>Gross: £{annualGross.toLocaleString()}</span>
                <span>Voids {DEFAULT_ASSUMPTIONS.voidRate}%</span>
                <span>Mgmt {DEFAULT_ASSUMPTIONS.managementFee}%</span>
                <span>Maint {DEFAULT_ASSUMPTIONS.maintenanceReserve}%</span>
                <span>Fixed £{DEFAULT_ASSUMPTIONS.fixedCosts}</span>
              </div>

              {/* Methodology explanation */}
              <div className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-100 mt-1">
                {isRental
                  ? `Cumulative net income after deducting voids, management, maintenance & fixed costs. Assumes ${DEFAULT_ASSUMPTIONS.annualRentGrowth}% annual rent growth.`
                  : `ROI includes net rental income + ${DEFAULT_ASSUMPTIONS.annualValueGrowth}% annual capital appreciation. Net yield based on purchase price.`
                }
              </div>
            </>
          )}

          {!canCalculate && !needsInput && (
            <div className="pt-2 text-xs text-slate-500 text-center">
              Enter rent data to calculate
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
