"use client"

import { useState, useMemo, useCallback, memo } from "react"
import {
  X,
  Scale,
  Bed,
  Bath,
  Ruler,
  Zap,
  TrendingUp,
  MapPin,
  PoundSterling,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Wifi,
  Shield,
  Home,
  Trash2,
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

// Memoized formatters
const formatPrice = (price: number) => {
  if (price >= 1000000) return `£${(price / 1000000).toFixed(2)}M`
  if (price >= 1000) return `£${(price / 1000).toFixed(0)}k`
  return `£${price}`
}

const formatYield = (y: number) => `${y.toFixed(1)}%`
const formatArea = (a: number) => `${Math.round(a)} m²`
const formatSpeed = (s: number) => `${s} Mbps`

const epcColors: Record<string, string> = {
  A: "bg-emerald-500",
  B: "bg-green-500",
  C: "bg-lime-500",
  D: "bg-yellow-500",
  E: "bg-orange-500",
  F: "bg-red-500",
  G: "bg-red-700",
}

// Memoized comparison row
const ComparisonRow = memo(function ComparisonRow({
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
  formatter?: (value: number) => string
  highlightBest?: boolean
  bestIsHigher?: boolean
}) {
  const { formattedValues, bestIndex } = useMemo(() => {
    const formatted = values.map(v => {
      if (v === null || v === undefined) return "-"
      if (formatter && typeof v === "number") return formatter(v)
      if (typeof v === "boolean") return v ? "Yes" : "No"
      return String(v)
    })

    let best = -1
    if (highlightBest) {
      const numericValues = values.map(v => (typeof v === "number" ? v : null))
      const validValues = numericValues.filter((v): v is number => v !== null)
      if (validValues.length > 1) {
        const bestValue = bestIsHigher ? Math.max(...validValues) : Math.min(...validValues)
        best = numericValues.indexOf(bestValue)
      }
    }

    return { formattedValues: formatted, bestIndex: best }
  }, [values, formatter, highlightBest, bestIsHigher])

  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
      <td className="py-2.5 px-3 bg-slate-50/80 sticky left-0">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          {Icon && <Icon className="w-4 h-4 text-slate-400 shrink-0" />}
          <span className="truncate">{label}</span>
        </div>
      </td>
      {formattedValues.map((value, index) => (
        <td
          key={index}
          className={cn(
            "py-2.5 px-3 text-center min-w-[120px]",
            bestIndex === index && "bg-emerald-50/70"
          )}
        >
          <span
            className={cn(
              "text-sm",
              value === "-" ? "text-slate-300" : "text-slate-800",
              bestIndex === index && "font-semibold text-emerald-700"
            )}
          >
            {value}
          </span>
        </td>
      ))}
    </tr>
  )
})

// Collapsible section component
const CollapsibleSection = memo(function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  propertyCount,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  propertyCount: number
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <>
      <tr
        className="bg-slate-100/80 cursor-pointer hover:bg-slate-100 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <td colSpan={propertyCount + 1} className="py-2 px-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {title}
            </span>
            {isOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </td>
      </tr>
      {isOpen && children}
    </>
  )
})

// Compact property card for header
const PropertyCard = memo(function PropertyCard({
  property,
  onRemove,
}: {
  property: Property
  onRemove: () => void
}) {
  const [imgError, setImgError] = useState(false)
  const imgSrc = property.primary_image_url || property.images?.[0]

  return (
    <div className="relative bg-white rounded-lg border border-slate-200 overflow-hidden group">
      <button
        onClick={onRemove}
        className="absolute top-1.5 right-1.5 z-10 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
        aria-label={`Remove ${property.address} from comparison`}
      >
        <X className="w-3 h-3" />
      </button>

      {/* Compact Image */}
      <div className="aspect-[4/3] bg-slate-100 relative">
        {imgSrc && !imgError ? (
          <img
            src={imgSrc}
            alt={property.address}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Home className="w-8 h-8 text-slate-300" />
          </div>
        )}
        {/* Price overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
          <span className="text-white font-bold text-sm">
            {property.purchase_price
              ? formatPrice(property.purchase_price)
              : property.price_pcm
              ? `${formatPrice(property.price_pcm)}/mo`
              : "-"}
          </span>
        </div>
      </div>

      {/* Compact Info */}
      <div className="p-2">
        <p className="text-xs font-medium text-slate-800 truncate" title={property.address}>
          {property.address}
        </p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-slate-500">{property.postcode}</span>
          {property.is_hmo_licensed && (
            <Shield className="w-3 h-3 text-emerald-500" title="Licensed HMO" />
          )}
        </div>
      </div>
    </div>
  )
})

// EPC Badge component
const EpcBadge = memo(function EpcBadge({ rating }: { rating?: string }) {
  if (!rating) return <span className="text-slate-300">-</span>

  return (
    <Badge className={cn("text-white font-bold text-xs px-2", epcColors[rating.toUpperCase()] || "bg-slate-300")}>
      {rating.toUpperCase()}
    </Badge>
  )
})

// Boolean indicator component
const BooleanIndicator = memo(function BooleanIndicator({
  value,
  trueLabel,
  falseLabel,
}: {
  value?: boolean
  trueLabel?: string
  falseLabel?: string
}) {
  if (value === undefined || value === null) {
    return <span className="text-slate-300">-</span>
  }

  return value ? (
    <div className="flex items-center justify-center gap-1">
      <CheckCircle className="w-4 h-4 text-emerald-500" />
      {trueLabel && <span className="text-xs text-emerald-600">{trueLabel}</span>}
    </div>
  ) : (
    <div className="flex items-center justify-center gap-1">
      <XCircle className="w-4 h-4 text-slate-300" />
      {falseLabel && <span className="text-xs text-slate-400">{falseLabel}</span>}
    </div>
  )
})

export function PropertyComparison({
  properties,
  onRemove,
  onClear,
  className,
}: PropertyComparisonProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Memoize winner calculations for summary
  const winners = useMemo(() => {
    if (properties.length < 2) return null

    const getWinner = (
      getValue: (p: Property) => number | undefined,
      higherIsBetter: boolean
    ) => {
      const values = properties.map((p, i) => ({ value: getValue(p), index: i }))
      const valid = values.filter(v => v.value !== undefined)
      if (valid.length < 2) return null

      const winner = valid.reduce((best, curr) =>
        higherIsBetter
          ? (curr.value! > best.value! ? curr : best)
          : (curr.value! < best.value! ? curr : best)
      )
      return properties[winner.index]
    }

    return {
      bestPrice: getWinner(p => p.purchase_price, false),
      bestYield: getWinner(p => p.gross_yield, true),
      bestScore: getWinner(p => p.deal_score, true),
    }
  }, [properties])

  const handleRemove = useCallback((id: string) => {
    onRemove(id)
  }, [onRemove])

  if (properties.length === 0) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "fixed bottom-4 right-4 z-40 shadow-lg gap-2",
            "bg-white border-teal-300 hover:bg-teal-50 hover:border-teal-400",
            "transition-all duration-200",
            className
          )}
        >
          <Scale className="w-4 h-4 text-teal-600" />
          <span className="font-medium">Compare</span>
          <Badge variant="secondary" className="bg-teal-100 text-teal-700 h-5 px-1.5">
            {properties.length}
          </Badge>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[85vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Scale className="w-5 h-5 text-teal-600" />
              Compare Properties
              <Badge variant="outline" className="ml-1">
                {properties.length}
              </Badge>
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="text-slate-500 hover:text-red-600 gap-1.5 h-8"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </Button>
          </div>
        </DialogHeader>

        <div className="overflow-auto max-h-[calc(85vh-60px)]">
          {/* Property Cards Row */}
          <div className="p-4 bg-slate-50/50 border-b border-slate-200">
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: `repeat(${properties.length}, minmax(140px, 1fr))` }}
            >
              {properties.map(property => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  onRemove={() => handleRemove(property.id)}
                />
              ))}
            </div>

            {/* Quick Summary (only show with 2+ properties) */}
            {winners && (
              <div className="mt-3 flex flex-wrap gap-2">
                {winners.bestPrice && (
                  <Badge variant="outline" className="bg-white text-xs gap-1">
                    <PoundSterling className="w-3 h-3" />
                    Best Price: {winners.bestPrice.postcode}
                  </Badge>
                )}
                {winners.bestYield && (
                  <Badge variant="outline" className="bg-white text-xs gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Best Yield: {winners.bestYield.postcode}
                  </Badge>
                )}
                {winners.bestScore && (
                  <Badge variant="outline" className="bg-white text-xs gap-1">
                    <Zap className="w-3 h-3" />
                    Best Score: {winners.bestScore.postcode}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sr-only">
                <tr>
                  <th>Metric</th>
                  {properties.map(p => (
                    <th key={p.id}>{p.postcode}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Pricing Section */}
                <CollapsibleSection title="Pricing & Returns" propertyCount={properties.length}>
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
                </CollapsibleSection>

                {/* Property Details Section */}
                <CollapsibleSection title="Property Details" propertyCount={properties.length}>
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
                </CollapsibleSection>

                {/* Energy & Connectivity */}
                <CollapsibleSection title="Energy & Connectivity" propertyCount={properties.length} defaultOpen={false}>
                  <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 bg-slate-50/80 sticky left-0">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                        <Zap className="w-4 h-4 text-slate-400" />
                        EPC Rating
                      </div>
                    </td>
                    {properties.map((property, index) => (
                      <td key={index} className="py-2.5 px-3 text-center min-w-[120px]">
                        <EpcBadge rating={property.epc_rating} />
                      </td>
                    ))}
                  </tr>
                  <ComparisonRow
                    label="Broadband"
                    icon={Wifi}
                    values={properties.map(p => p.broadband_speed)}
                    formatter={formatSpeed}
                    highlightBest
                    bestIsHigher={true}
                  />
                </CollapsibleSection>

                {/* HMO Status */}
                <CollapsibleSection title="HMO Status" propertyCount={properties.length}>
                  <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 bg-slate-50/80 sticky left-0">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                        <Shield className="w-4 h-4 text-slate-400" />
                        Licensed HMO
                      </div>
                    </td>
                    {properties.map((property, index) => (
                      <td key={index} className="py-2.5 px-3 text-center min-w-[120px]">
                        <BooleanIndicator value={property.is_hmo_licensed} />
                      </td>
                    ))}
                  </tr>
                  <ComparisonRow
                    label="Licence Status"
                    values={properties.map(p => p.licence_status)}
                  />
                  <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 bg-slate-50/80 sticky left-0">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        Article 4 Area
                      </div>
                    </td>
                    {properties.map((property, index) => (
                      <td key={index} className="py-2.5 px-3 text-center min-w-[120px]">
                        {property.article_4 === true ? (
                          <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-700 text-xs">
                            Yes
                          </Badge>
                        ) : property.article_4 === false ? (
                          <span className="text-slate-400 text-xs">No</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    ))}
                  </tr>
                </CollapsibleSection>
              </tbody>
            </table>
          </div>

          {/* Footer Legend */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" />
              <span>Best value highlighted</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Hook for managing comparison state
export function usePropertyComparison(maxProperties = 4) {
  const [compareList, setCompareList] = useState<Property[]>([])

  const addToCompare = useCallback((property: Property) => {
    setCompareList(prev => {
      if (prev.find(p => p.id === property.id)) return prev
      if (prev.length >= maxProperties) {
        // Remove oldest and add new
        return [...prev.slice(1), property]
      }
      return [...prev, property]
    })
  }, [maxProperties])

  const removeFromCompare = useCallback((id: string) => {
    setCompareList(prev => prev.filter(p => p.id !== id))
  }, [])

  const clearCompare = useCallback(() => {
    setCompareList([])
  }, [])

  const isInCompare = useCallback((id: string) => {
    return compareList.some(p => p.id === id)
  }, [compareList])

  const toggleCompare = useCallback((property: Property) => {
    setCompareList(prev => {
      const exists = prev.find(p => p.id === property.id)
      if (exists) {
        return prev.filter(p => p.id !== property.id)
      }
      if (prev.length >= maxProperties) {
        return [...prev.slice(1), property]
      }
      return [...prev, property]
    })
  }, [maxProperties])

  return {
    compareList,
    addToCompare,
    removeFromCompare,
    clearCompare,
    isInCompare,
    toggleCompare,
    canAddMore: compareList.length < maxProperties,
    count: compareList.length,
  }
}
