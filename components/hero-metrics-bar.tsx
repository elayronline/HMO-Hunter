"use client"

import { cn } from "@/lib/utils"
import type { Property } from "@/lib/types/database"
import { roomRent, type RoomRent } from "@/lib/properties/room-rents"

interface HeroMetricsBarProps {
  property: Property
  className?: string
}

type MetricStatus = "positive" | "neutral" | "negative"

function getPricePerRoomStatus(pricePerRoom: number | null): MetricStatus {
  if (!pricePerRoom) return "neutral"
  if (pricePerRoom < 60000) return "positive"
  if (pricePerRoom <= 80000) return "neutral"
  return "negative"
}

/**
 * Where an observed rent per room sits in its city's published band.
 *
 * This read backwards: under £400 was "Good" and over £600 was "Poor". The
 * shape was copied from getPricePerRoomStatus above, where low genuinely is
 * better because that is what a buyer pays — but rent per room is what the
 * property earns, so the copy needed inverting and was not. A £700/room
 * property showed red and a £350/room one showed green.
 *
 * The thresholds are no longer flat national numbers either. £400 and £600 were
 * invented at this call site, and room rents are not national: the table this
 * now reads puts Hull's band at £350–500 and London's at £650–1100, so a single
 * pair of figures called the same rent good in one city and poor in another.
 * The band comes from CITY_ROOM_RENTS, the same source as the modelled yield
 * shown below this bar.
 *
 * With no city rate held, this returns neutral rather than judging against the
 * national fallback. The status dot has one word to say it in and "Average"
 * would be a claim; declining to grade is the honest answer where the basis is
 * a national default rather than this property's own market.
 */
function getRentPerRoomStatus(rentPerRoom: number | null, band: RoomRent): MetricStatus {
  if (!rentPerRoom) return "neutral"
  if (band.basis === "national") return "neutral"
  if (rentPerRoom >= band.max) return "positive"
  if (rentPerRoom >= band.min) return "neutral"
  return "negative"
}

const statusColors: Record<MetricStatus, string> = {
  positive: "text-emerald-600",
  neutral: "text-slate-900",
  negative: "text-red-600",
}

const statusLabels: Record<MetricStatus, string> = {
  positive: "Good",
  neutral: "Average",
  negative: "Poor",
}

const statusDots: Record<MetricStatus, string> = {
  positive: "bg-emerald-500",
  neutral: "bg-slate-300",
  negative: "bg-red-500",
}

export function HeroMetricsBar({ property, className }: HeroMetricsBarProps) {
  /*
   * Net yield and monthly cashflow were removed from this bar.
   *
   * The same two figures were removed from components/property-detail-card.tsx
   * in PR #26 and survived here, on the same page, because the fix was applied
   * to one component and not its twin. Both rendered on /property/[id].
   *
   * "Net Yield" was `grossYield * 0.7` — a flat 30% haircut presented as a
   * distinct metric, with a traffic light on it and nothing saying where the
   * 30% came from. Cashflow was
   *   (annualRent - annualRent * 0.3 - purchase_price * 0.75 * 0.055) / 12
   * — an assumed cost ratio, an assumed 75% LTV and an assumed 5.5% interest
   * rate, rendered as a signed pound figure a reader would take for their own.
   * The rent both started from was itself modelled
   * (`estimated_rent_per_room × bedrooms`), so neither number had an observed
   * input beyond the asking price.
   *
   * Gross yield is not shown here either: this bar has one line per metric and
   * no room to state a basis, and PR #26's finding was that a colour-coded
   * threshold on a modelled number endorses it. The modelled yield still
   * appears on this page — PropertyDetailCard renders it directly below, with
   * its basis written on the face of the panel, which is where it can be read
   * honestly. What is left here is observed, or arithmetic on observed values.
   */
  const pricePerRoom = property.purchase_price && property.bedrooms
    ? Math.round(property.purchase_price / property.bedrooms)
    : null

  // A property with no asking price is not for sale — it is an existing HMO,
  // and what it is worth is a conversation with the owner. The old branch here
  // computed an R2HMO margin against the LHA rate, which was rent-to-rent
  // arithmetic for a model the platform no longer runs. What a buyer can
  // actually use is what the property is observed to achieve, so these are
  // measured figures with nothing derived from an assumption.
  const hasAskingPrice = property.purchase_price != null && property.purchase_price > 0
  const rentPerRoom =
    property.price_pcm && property.price_pcm > 0 && property.bedrooms && property.bedrooms > 0
      ? Math.round(property.price_pcm / property.bedrooms)
      : null

  // Same lookup the detail card uses for the yield basis, so the two panels on
  // this page grade a rent against the same published band.
  const rentBand = roomRent(property.city, property.article_4_council)

  const metrics = !hasAskingPrice ? [
    {
      label: "Let At",
      value: property.price_pcm ? `£${property.price_pcm.toLocaleString()}` : "—",
      status: "neutral" as const,
    },
    {
      label: "Rent/Room",
      value: rentPerRoom ? `£${rentPerRoom.toLocaleString()}` : "—",
      status: getRentPerRoomStatus(rentPerRoom, rentBand),
    },
    {
      label: "Rooms",
      value: property.bedrooms ? String(property.bedrooms) : "—",
      status: "neutral" as const,
    },
  ] : [
    {
      label: "Asking",
      value: property.purchase_price ? `£${property.purchase_price.toLocaleString()}` : "—",
      status: "neutral" as const,
    },
    {
      label: "Price/Room",
      value: pricePerRoom ? `£${(pricePerRoom / 1000).toFixed(0)}k` : "—",
      status: getPricePerRoomStatus(pricePerRoom),
    },
    {
      label: "Rooms",
      value: property.bedrooms ? String(property.bedrooms) : "—",
      status: "neutral" as const,
    },
  ]

  return (
    <div className={cn("grid grid-cols-3 divide-x divide-slate-200 bg-slate-50", className)}>
      {metrics.map((metric, i) => (
        <div key={i} className="py-2.5 px-2 sm:py-3 sm:px-3 text-center min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate">
            {metric.label}
          </p>
          <p className={cn("text-lg sm:text-xl font-bold mt-0.5 sm:mt-1 truncate", statusColors[metric.status])}>
            {metric.value}
          </p>
          <div className="flex items-center justify-center gap-1 mt-1.5">
            <div className={cn("w-1.5 h-1.5 rounded-full", statusDots[metric.status])} />
            <span className={cn("text-[10px] font-medium", statusColors[metric.status])}>
              {statusLabels[metric.status]}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
