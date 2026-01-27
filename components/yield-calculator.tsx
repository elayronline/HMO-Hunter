"use client"

import { useState, useMemo } from "react"
import {
  Calculator,
  TrendingUp,
  PoundSterling,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Info,
  ExternalLink,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import type { Property } from "@/lib/types/database"

interface YieldCalculatorProps {
  property: Property
  defaultOpen?: boolean
}

interface YieldProjection {
  year: number
  grossRent: number
  netRent: number
  cumulativeReturn: number
  yield: number
}

// Default assumptions for HMO properties
const DEFAULT_ASSUMPTIONS = {
  voidRate: 5, // 5% void periods
  managementFee: 10, // 10% management fee
  maintenanceReserve: 5, // 5% maintenance reserve
  insuranceCost: 1200, // Annual insurance
  licensingCost: 500, // HMO licence annual amortized
  utilitiesCost: 2400, // Utilities if included (£200/month)
  annualRentGrowth: 3, // 3% annual rent growth
  annualValueGrowth: 4, // 4% capital appreciation
}

export function YieldCalculator({ property, defaultOpen = false }: YieldCalculatorProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Editable assumptions
  const [voidRate, setVoidRate] = useState(DEFAULT_ASSUMPTIONS.voidRate)
  const [managementFee, setManagementFee] = useState(DEFAULT_ASSUMPTIONS.managementFee)
  const [maintenanceReserve, setMaintenanceReserve] = useState(DEFAULT_ASSUMPTIONS.maintenanceReserve)
  const [annualRentGrowth, setAnnualRentGrowth] = useState(DEFAULT_ASSUMPTIONS.annualRentGrowth)
  const [annualValueGrowth, setAnnualValueGrowth] = useState(DEFAULT_ASSUMPTIONS.annualValueGrowth)

  // Custom overrides for missing data
  const [customPurchasePrice, setCustomPurchasePrice] = useState<number | null>(null)
  const [customMonthlyRent, setCustomMonthlyRent] = useState<number | null>(null)

  // Determine data sources and what's missing
  const dataStatus = useMemo(() => {
    const status = {
      hasPurchasePrice: false,
      hasRentData: false,
      hasRoomCount: false,
      purchasePriceSource: "" as string,
      rentDataSource: "" as string,
      missingApis: [] as { name: string; provides: string; url: string }[],
    }

    // Check purchase price
    if (property.purchase_price && property.purchase_price > 0) {
      status.hasPurchasePrice = true
      status.purchasePriceSource = "Listing price"
    } else if (property.estimated_value && property.estimated_value > 0) {
      status.hasPurchasePrice = true
      status.purchasePriceSource = "StreetData/PaTMa estimate"
    } else if (customPurchasePrice && customPurchasePrice > 0) {
      status.hasPurchasePrice = true
      status.purchasePriceSource = "Manual entry"
    } else {
      status.missingApis.push({
        name: "StreetData API",
        provides: "Property valuations",
        url: "https://street.co.uk/api",
      })
    }

    // Check rent data
    if (property.price_pcm && property.price_pcm > 0) {
      status.hasRentData = true
      status.rentDataSource = "Listing rent"
    } else if (property.estimated_gross_monthly_rent && property.estimated_gross_monthly_rent > 0) {
      status.hasRentData = true
      status.rentDataSource = "Calculated estimate"
    } else if (property.estimated_rent_per_room && property.estimated_rent_per_room > 0) {
      status.hasRentData = true
      status.rentDataSource = "Per-room estimate"
    } else if (property.area_avg_rent && property.area_avg_rent > 0) {
      status.hasRentData = true
      status.rentDataSource = "Area average (PaTMa)"
    } else if (customMonthlyRent && customMonthlyRent > 0) {
      status.hasRentData = true
      status.rentDataSource = "Manual entry"
    } else {
      status.missingApis.push({
        name: "PaTMa API",
        provides: "Rental analytics & area averages",
        url: "https://patma.co.uk",
      })
    }

    // Room count
    status.hasRoomCount = (property.bedrooms || property.lettable_rooms || 0) > 0

    return status
  }, [property, customPurchasePrice, customMonthlyRent])

  // Calculate the base figures
  const baseCalculation = useMemo(() => {
    // Purchase price
    let purchasePrice = customPurchasePrice || property.purchase_price || property.estimated_value || 0

    // Monthly rent
    let monthlyRent = customMonthlyRent || 0
    if (!monthlyRent) {
      if (property.price_pcm && property.price_pcm > 0) {
        monthlyRent = property.price_pcm
      } else if (property.estimated_gross_monthly_rent && property.estimated_gross_monthly_rent > 0) {
        monthlyRent = property.estimated_gross_monthly_rent
      } else if (property.estimated_rent_per_room && property.estimated_rent_per_room > 0) {
        const rooms = property.lettable_rooms || property.bedrooms || 1
        monthlyRent = property.estimated_rent_per_room * rooms
      } else if (property.area_avg_rent && property.area_avg_rent > 0) {
        // Use area average rent
        monthlyRent = property.area_avg_rent
      }
    }

    const rooms = property.lettable_rooms || property.bedrooms || 1
    const rentPerRoom = monthlyRent / rooms

    return {
      purchasePrice,
      monthlyRent,
      annualGrossRent: monthlyRent * 12,
      rooms,
      rentPerRoom,
      canCalculate: purchasePrice > 0 && monthlyRent > 0,
    }
  }, [property, customPurchasePrice, customMonthlyRent])

  // Calculate annual costs
  const annualCosts = useMemo(() => {
    const { annualGrossRent } = baseCalculation

    const voidCost = annualGrossRent * (voidRate / 100)
    const managementCost = annualGrossRent * (managementFee / 100)
    const maintenanceCost = annualGrossRent * (maintenanceReserve / 100)
    const fixedCosts = DEFAULT_ASSUMPTIONS.insuranceCost + DEFAULT_ASSUMPTIONS.licensingCost

    const totalCosts = voidCost + managementCost + maintenanceCost + fixedCosts

    return {
      voidCost,
      managementCost,
      maintenanceCost,
      fixedCosts,
      totalCosts,
      netAnnualRent: annualGrossRent - totalCosts,
    }
  }, [baseCalculation, voidRate, managementFee, maintenanceReserve])

  // Calculate projections for 1, 3, 5 years
  const projections = useMemo(() => {
    if (!baseCalculation.canCalculate) return []

    const { purchasePrice, annualGrossRent } = baseCalculation
    const { netAnnualRent } = annualCosts

    const years = [1, 2, 3, 4, 5]
    let cumulativeReturn = 0
    let currentGrossRent = annualGrossRent
    let currentNetRent = netAnnualRent
    let currentPropertyValue = purchasePrice

    return years.map((year) => {
      // Apply rent growth
      if (year > 1) {
        currentGrossRent *= (1 + annualRentGrowth / 100)
        currentNetRent = currentGrossRent * (netAnnualRent / annualGrossRent) // Keep same ratio
      }

      // Apply capital appreciation
      currentPropertyValue *= (1 + annualValueGrowth / 100)

      cumulativeReturn += currentNetRent

      // Calculate yield based on original purchase price
      const cashOnCashYield = (currentNetRent / purchasePrice) * 100

      // Total return including capital appreciation
      const capitalGain = currentPropertyValue - purchasePrice
      const totalReturn = cumulativeReturn + capitalGain
      const totalYield = (totalReturn / purchasePrice) * 100

      return {
        year,
        grossRent: Math.round(currentGrossRent),
        netRent: Math.round(currentNetRent),
        cumulativeReturn: Math.round(cumulativeReturn),
        capitalGain: Math.round(capitalGain),
        propertyValue: Math.round(currentPropertyValue),
        totalReturn: Math.round(totalReturn),
        cashOnCashYield: cashOnCashYield.toFixed(1),
        totalYield: totalYield.toFixed(1),
      }
    })
  }, [baseCalculation, annualCosts, annualRentGrowth, annualValueGrowth])

  // Get specific year projections
  const year1 = projections.find(p => p.year === 1)
  const year3 = projections.find(p => p.year === 3)
  const year5 = projections.find(p => p.year === 5)

  // Gross yield (simple)
  const grossYield = baseCalculation.canCalculate
    ? ((baseCalculation.annualGrossRent / baseCalculation.purchasePrice) * 100).toFixed(1)
    : "N/A"

  // Net yield (year 1)
  const netYield = baseCalculation.canCalculate
    ? ((annualCosts.netAnnualRent / baseCalculation.purchasePrice) * 100).toFixed(1)
    : "N/A"

  return (
    <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white text-emerald-600">
            <Calculator className="w-5 h-5" />
          </div>
          <div className="text-left">
            <div className="font-semibold text-emerald-700">Yield Calculator</div>
            <div className="text-xs text-slate-600">
              {baseCalculation.canCalculate
                ? `${grossYield}% gross / ${netYield}% net yield`
                : "Enter data to calculate"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {baseCalculation.canCalculate && year5 && (
            <div className="text-right">
              <div className="text-sm font-medium text-emerald-700">
                {year5.totalYield}%
              </div>
              <div className="text-xs text-slate-500">5-year ROI</div>
            </div>
          )}
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/50">
          {/* Data Status */}
          <div className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-medium text-slate-600">Data Sources</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className={`p-2 rounded ${dataStatus.hasPurchasePrice ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                <span className="font-medium">Purchase Price:</span>{" "}
                {dataStatus.hasPurchasePrice ? dataStatus.purchasePriceSource : "Not available"}
              </div>
              <div className={`p-2 rounded ${dataStatus.hasRentData ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                <span className="font-medium">Rent Data:</span>{" "}
                {dataStatus.hasRentData ? dataStatus.rentDataSource : "Not available"}
              </div>
            </div>

            {dataStatus.missingApis.length > 0 && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-1 text-amber-700 text-xs font-medium mb-1">
                  <AlertCircle className="w-3 h-3" />
                  APIs needed for automatic data:
                </div>
                <div className="space-y-1">
                  {dataStatus.missingApis.map((api) => (
                    <div key={api.name} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">
                        <span className="font-medium">{api.name}</span> - {api.provides}
                      </span>
                      <a
                        href={api.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-600 hover:underline flex items-center gap-0.5"
                      >
                        Get API <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Manual Entry for Missing Data */}
          {(!dataStatus.hasPurchasePrice || !dataStatus.hasRentData) && (
            <div className="bg-white rounded-lg p-3 space-y-3">
              <div className="text-xs font-medium text-slate-600">Enter Missing Data</div>
              <div className="grid grid-cols-2 gap-3">
                {!property.purchase_price && !property.estimated_value && (
                  <div>
                    <Label className="text-xs text-slate-500">Purchase Price (£)</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 350000"
                      value={customPurchasePrice || ""}
                      onChange={(e) => setCustomPurchasePrice(e.target.value ? Number(e.target.value) : null)}
                      className="h-8 text-sm"
                    />
                  </div>
                )}
                {!property.price_pcm && !property.estimated_gross_monthly_rent && !property.area_avg_rent && (
                  <div>
                    <Label className="text-xs text-slate-500">Monthly Rent (£)</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 2500"
                      value={customMonthlyRent || ""}
                      onChange={(e) => setCustomMonthlyRent(e.target.value ? Number(e.target.value) : null)}
                      className="h-8 text-sm"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Key Figures */}
          {baseCalculation.canCalculate && (
            <>
              <div className="bg-white rounded-lg p-3">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-xs text-slate-500">Purchase Price</div>
                    <div className="text-lg font-bold text-slate-900">
                      £{baseCalculation.purchasePrice.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Monthly Rent</div>
                    <div className="text-lg font-bold text-slate-900">
                      £{baseCalculation.monthlyRent.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Rooms</div>
                    <div className="text-lg font-bold text-slate-900">
                      {baseCalculation.rooms}
                    </div>
                    <div className="text-xs text-slate-500">
                      £{Math.round(baseCalculation.rentPerRoom)}/room
                    </div>
                  </div>
                </div>
              </div>

              {/* Yield Projections */}
              <div className="bg-white rounded-lg p-3">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-semibold text-slate-900">Yield Projections</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {/* 1 Year */}
                  <div className="bg-emerald-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-500 mb-1">1 Year</div>
                    <div className="text-xl font-bold text-emerald-600">
                      {year1?.cashOnCashYield}%
                    </div>
                    <div className="text-xs text-slate-600">Net Yield</div>
                    <div className="mt-2 pt-2 border-t border-emerald-100">
                      <div className="text-sm font-medium text-slate-900">
                        £{year1?.netRent.toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-500">Net Income</div>
                    </div>
                  </div>

                  {/* 3 Year */}
                  <div className="bg-emerald-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-500 mb-1">3 Years</div>
                    <div className="text-xl font-bold text-emerald-600">
                      {year3?.totalYield}%
                    </div>
                    <div className="text-xs text-slate-600">Total ROI</div>
                    <div className="mt-2 pt-2 border-t border-emerald-100">
                      <div className="text-sm font-medium text-slate-900">
                        £{year3?.totalReturn.toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-500">Total Return</div>
                    </div>
                  </div>

                  {/* 5 Year */}
                  <div className="bg-emerald-100 rounded-lg p-3 text-center border-2 border-emerald-300">
                    <div className="text-xs text-slate-500 mb-1">5 Years</div>
                    <div className="text-2xl font-bold text-emerald-700">
                      {year5?.totalYield}%
                    </div>
                    <div className="text-xs text-slate-600">Total ROI</div>
                    <div className="mt-2 pt-2 border-t border-emerald-200">
                      <div className="text-sm font-medium text-slate-900">
                        £{year5?.totalReturn.toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-500">Total Return</div>
                    </div>
                  </div>
                </div>

                {/* Breakdown for 5 years */}
                {year5 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cumulative Rent (5yr):</span>
                      <span className="font-medium">£{year5.cumulativeReturn.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Capital Appreciation:</span>
                      <span className="font-medium text-emerald-600">+£{year5.capitalGain.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Est. Property Value:</span>
                      <span className="font-medium">£{year5.propertyValue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Gross Yield (Y1):</span>
                      <span className="font-medium">{grossYield}%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Annual Costs Breakdown */}
              <div className="bg-white rounded-lg p-3">
                <div className="flex items-center gap-2 mb-3">
                  <PoundSterling className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-semibold text-slate-900">Annual Costs (Year 1)</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Gross Annual Rent:</span>
                    <span className="font-medium text-emerald-600">£{baseCalculation.annualGrossRent.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Void Periods ({voidRate}%):</span>
                    <span>-£{Math.round(annualCosts.voidCost).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Management ({managementFee}%):</span>
                    <span>-£{Math.round(annualCosts.managementCost).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Maintenance ({maintenanceReserve}%):</span>
                    <span>-£{Math.round(annualCosts.maintenanceCost).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Insurance & Licensing:</span>
                    <span>-£{annualCosts.fixedCosts.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200 font-semibold">
                    <span className="text-slate-900">Net Annual Income:</span>
                    <span className="text-emerald-600">£{Math.round(annualCosts.netAnnualRent).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Advanced Assumptions */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700"
              >
                {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Adjust Assumptions
              </button>

              {showAdvanced && (
                <div className="bg-white rounded-lg p-3 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-slate-600">Void Rate: {voidRate}%</Label>
                      <Slider
                        value={[voidRate]}
                        onValueChange={(v) => setVoidRate(v[0])}
                        min={0}
                        max={15}
                        step={1}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Management Fee: {managementFee}%</Label>
                      <Slider
                        value={[managementFee]}
                        onValueChange={(v) => setManagementFee(v[0])}
                        min={0}
                        max={20}
                        step={1}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Annual Rent Growth: {annualRentGrowth}%</Label>
                      <Slider
                        value={[annualRentGrowth]}
                        onValueChange={(v) => setAnnualRentGrowth(v[0])}
                        min={0}
                        max={10}
                        step={0.5}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Capital Growth: {annualValueGrowth}%</Label>
                      <Slider
                        value={[annualValueGrowth]}
                        onValueChange={(v) => setAnnualValueGrowth(v[0])}
                        min={0}
                        max={10}
                        step={0.5}
                        className="mt-2"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setVoidRate(DEFAULT_ASSUMPTIONS.voidRate)
                      setManagementFee(DEFAULT_ASSUMPTIONS.managementFee)
                      setMaintenanceReserve(DEFAULT_ASSUMPTIONS.maintenanceReserve)
                      setAnnualRentGrowth(DEFAULT_ASSUMPTIONS.annualRentGrowth)
                      setAnnualValueGrowth(DEFAULT_ASSUMPTIONS.annualValueGrowth)
                    }}
                    className="text-xs text-emerald-600 hover:underline"
                  >
                    Reset to defaults
                  </button>
                </div>
              )}
            </>
          )}

          {/* Can't Calculate Message */}
          {!baseCalculation.canCalculate && (
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <div className="text-sm text-slate-600">
                Enter purchase price and monthly rent above to calculate yields
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
