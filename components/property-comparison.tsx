"use client"

import { useState, useEffect } from "react"
import {
  X,
  Plus,
  Scale,
  Home,
  Bed,
  Bath,
  Ruler,
  Zap,
  TrendingUp,
  MapPin,
  PoundSterling,
  CheckCircle,
  XCircle,
  Minus,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface Property {
  id: string
  address: string
  postcode: string
  city?: string
  purchase_price?: number
  price_pcm?: number
  bedrooms?: number
  bathrooms?: number
  floor_area_sqm?: number
  epc_rating?: string
  property_type?: string
  is_hmo_licensed?: boolean
  licence_status?: string
  gross_yield?: number
  deal_score?: number
  article_4?: boolean
  broadband_speed?: number
  images?: string[]
  primary_image_url?: string
}

interface PropertyComparisonProps {
  properties: Property[]
  onRemove: (id: string) => void
  onClear: () => void
  className?: string
}

// Comparison row component
function ComparisonRow({
  label,
  icon: Icon,
  values,
  formatter,
  highlightBest,
  bestIsHigher = true,
}: {
  label: string
  icon?: React.ElementType
  values: (string | number | boolean | null | undefined)[]
  formatter?: (value: any) => string
  highlightBest?: boolean
  bestIsHigher?: boolean
}) {
  const formattedValues = values.map(v => {
    if (v === null || v === undefined) return "-"
    if (formatter) return formatter(v)
    if (typeof v === "boolean") return v ? "Yes" : "No"
    return String(v)
  })

  // Determine best value for highlighting
  let bestIndex = -1
  if (highlightBest) {
    const numericValues = values.map(v =>
      typeof v === "number" ? v : null
    )
    const validValues = numericValues.filter(v => v !== null) as number[]
    if (validValues.length > 0) {
      const best = bestIsHigher ? Math.max(...validValues) : Math.min(...validValues)
      bestIndex = numericValues.indexOf(best)
    }
  }

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-3 px-4 bg-slate-50">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          {Icon && <Icon className="w-4 h-4 text-slate-400" />}
          {label}
        </div>
      </td>
      {formattedValues.map((value, index) => (
        <td
          key={index}
          className={cn(
            "py-3 px-4 text-center",
            bestIndex === index && "bg-emerald-50"
          )}
        >
          <span
            className={cn(
              "text-sm",
              value === "-" ? "text-slate-400" : "text-slate-900",
              bestIndex === index && "font-semibold text-emerald-700"
            )}
          >
            {value}
            {bestIndex === index && highlightBest && (
              <CheckCircle className="w-3 h-3 inline-block ml-1 text-emerald-500" />
            )}
          </span>
        </td>
      ))}
    </tr>
  )
}

export function PropertyComparison({
  properties,
  onRemove,
  onClear,
  className,
}: PropertyComparisonProps) {
  const [showDetails, setShowDetails] = useState(true)

  if (properties.length === 0) {
    return null
  }

  const formatPrice = (price: number) => {
    if (price >= 1000000) return `£${(price / 1000000).toFixed(2)}M`
    if (price >= 1000) return `£${(price / 1000).toFixed(0)}k`
    return `£${price}`
  }

  const formatYield = (y: number) => `${y.toFixed(1)}%`
  const formatArea = (a: number) => `${a.toFixed(0)} m²`
  const formatSpeed = (s: number) => `${s} Mbps`

  const getEpcColor = (rating: string) => {
    const colors: Record<string, string> = {
      A: "bg-emerald-500",
      B: "bg-green-500",
      C: "bg-lime-500",
      D: "bg-yellow-500",
      E: "bg-orange-500",
      F: "bg-red-500",
      G: "bg-red-700",
    }
    return colors[rating?.toUpperCase()] || "bg-slate-300"
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "fixed bottom-4 right-4 z-40 shadow-lg",
            "bg-white border-teal-200 hover:bg-teal-50",
            className
          )}
        >
          <Scale className="w-4 h-4 mr-2" />
          Compare ({properties.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-teal-600" />
              Property Comparison
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="text-slate-500 hover:text-slate-700"
            >
              Clear All
            </Button>
          </div>
        </DialogHeader>

        <div className="mt-4">
          {/* Property Headers */}
          <div className="grid gap-4" style={{ gridTemplateColumns: `200px repeat(${properties.length}, 1fr)` }}>
            <div className="p-4" /> {/* Empty corner cell */}
            {properties.map((property) => (
              <Card key={property.id} className="p-4 relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 h-6 w-6 p-0"
                  onClick={() => onRemove(property.id)}
                >
                  <X className="w-4 h-4" />
                </Button>

                {/* Property Image */}
                <div className="aspect-video rounded-lg overflow-hidden bg-slate-100 mb-3">
                  <img
                    src={property.primary_image_url || property.images?.[0] || "/placeholder.svg"}
                    alt={property.address}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Property Info */}
                <h3 className="font-semibold text-slate-900 text-sm truncate">
                  {property.address}
                </h3>
                <p className="text-xs text-slate-500 mb-2">{property.postcode}</p>

                {/* Price Badge */}
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-teal-50 border-teal-200 text-teal-700">
                    {property.purchase_price
                      ? formatPrice(property.purchase_price)
                      : property.price_pcm
                      ? `${formatPrice(property.price_pcm)}/mo`
                      : "-"}
                  </Badge>
                  {property.is_hmo_licensed && (
                    <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700 text-xs">
                      Licensed
                    </Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Comparison Table */}
          <div className="mt-6 border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-100">
                  <th className="py-3 px-4 text-left text-sm font-semibold text-slate-700 w-[200px]">
                    Metric
                  </th>
                  {properties.map((property) => (
                    <th
                      key={property.id}
                      className="py-3 px-4 text-center text-sm font-semibold text-slate-700"
                    >
                      {property.postcode}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Pricing Section */}
                <tr className="bg-slate-50">
                  <td colSpan={properties.length + 1} className="py-2 px-4">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Pricing
                    </span>
                  </td>
                </tr>
                <ComparisonRow
                  label="Purchase Price"
                  icon={PoundSterling}
                  values={properties.map(p => p.purchase_price)}
                  formatter={formatPrice}
                  highlightBest
                  bestIsHigher={false}
                />
                <ComparisonRow
                  label="Monthly Rent"
                  icon={PoundSterling}
                  values={properties.map(p => p.price_pcm)}
                  formatter={formatPrice}
                  highlightBest
                  bestIsHigher={true}
                />
                <ComparisonRow
                  label="Gross Yield"
                  icon={TrendingUp}
                  values={properties.map(p => p.gross_yield)}
                  formatter={formatYield}
                  highlightBest
                  bestIsHigher={true}
                />
                <ComparisonRow
                  label="Deal Score"
                  icon={Zap}
                  values={properties.map(p => p.deal_score)}
                  highlightBest
                  bestIsHigher={true}
                />

                {/* Property Details Section */}
                <tr className="bg-slate-50">
                  <td colSpan={properties.length + 1} className="py-2 px-4">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Property Details
                    </span>
                  </td>
                </tr>
                <ComparisonRow
                  label="Bedrooms"
                  icon={Bed}
                  values={properties.map(p => p.bedrooms)}
                  highlightBest
                  bestIsHigher={true}
                />
                <ComparisonRow
                  label="Bathrooms"
                  icon={Bath}
                  values={properties.map(p => p.bathrooms)}
                />
                <ComparisonRow
                  label="Floor Area"
                  icon={Ruler}
                  values={properties.map(p => p.floor_area_sqm)}
                  formatter={formatArea}
                  highlightBest
                  bestIsHigher={true}
                />
                <ComparisonRow
                  label="Property Type"
                  icon={Home}
                  values={properties.map(p => p.property_type)}
                />

                {/* Energy & Connectivity */}
                <tr className="bg-slate-50">
                  <td colSpan={properties.length + 1} className="py-2 px-4">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Energy & Connectivity
                    </span>
                  </td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-3 px-4 bg-slate-50">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <Zap className="w-4 h-4 text-slate-400" />
                      EPC Rating
                    </div>
                  </td>
                  {properties.map((property, index) => (
                    <td key={index} className="py-3 px-4 text-center">
                      {property.epc_rating ? (
                        <Badge
                          className={cn(
                            "text-white font-bold",
                            getEpcColor(property.epc_rating)
                          )}
                        >
                          {property.epc_rating.toUpperCase()}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  ))}
                </tr>
                <ComparisonRow
                  label="Broadband Speed"
                  values={properties.map(p => p.broadband_speed)}
                  formatter={formatSpeed}
                  highlightBest
                  bestIsHigher={true}
                />

                {/* HMO Status */}
                <tr className="bg-slate-50">
                  <td colSpan={properties.length + 1} className="py-2 px-4">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      HMO Status
                    </span>
                  </td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-3 px-4 bg-slate-50">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <CheckCircle className="w-4 h-4 text-slate-400" />
                      Licensed HMO
                    </div>
                  </td>
                  {properties.map((property, index) => (
                    <td key={index} className="py-3 px-4 text-center">
                      {property.is_hmo_licensed ? (
                        <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                      ) : (
                        <XCircle className="w-5 h-5 text-slate-300 mx-auto" />
                      )}
                    </td>
                  ))}
                </tr>
                <ComparisonRow
                  label="Licence Status"
                  values={properties.map(p => p.licence_status)}
                />
                <tr className="border-b border-slate-100">
                  <td className="py-3 px-4 bg-slate-50">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      Article 4 Area
                    </div>
                  </td>
                  {properties.map((property, index) => (
                    <td key={index} className="py-3 px-4 text-center">
                      {property.article_4 ? (
                        <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-700">
                          Yes
                        </Badge>
                      ) : property.article_4 === false ? (
                        <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-500">
                          No
                        </Badge>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200" />
              <span>Best value</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-emerald-500" />
              <span>Highlighted winner</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Hook for managing comparison state
export function usePropertyComparison(maxProperties = 3) {
  const [compareList, setCompareList] = useState<Property[]>([])

  const addToCompare = (property: Property) => {
    setCompareList(prev => {
      if (prev.find(p => p.id === property.id)) return prev
      if (prev.length >= maxProperties) {
        // Remove oldest and add new
        return [...prev.slice(1), property]
      }
      return [...prev, property]
    })
  }

  const removeFromCompare = (id: string) => {
    setCompareList(prev => prev.filter(p => p.id !== id))
  }

  const clearCompare = () => {
    setCompareList([])
  }

  const isInCompare = (id: string) => {
    return compareList.some(p => p.id === id)
  }

  return {
    compareList,
    addToCompare,
    removeFromCompare,
    clearCompare,
    isInCompare,
    canAddMore: compareList.length < maxProperties,
  }
}
