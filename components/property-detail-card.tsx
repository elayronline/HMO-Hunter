"use client"

import { useState, useEffect, useCallback } from "react"
import {
  BedDouble,
  Bath,
  Wifi,
  Trees,
  TrainFront,
  Building2,
  MapPin,
  ExternalLink,
  Phone,
  Shield,
  Car,
  PawPrint,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Sofa,
  LayoutGrid,
  Copy,
  Check,
  Share2,
  ChevronRight,
  Zap,
  HelpCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { roomRent } from "@/lib/properties/room-rents"
import type { Property } from "@/lib/types/database"
import { EPCBadge } from "@/components/epc-badge"
import { AgentContactCard } from "@/components/agent-contact-card"
import { AreaStatisticsCard } from "@/components/area-statistics-card"
import { SoldPriceHistory } from "@/components/sold-price-history"
import { KammaComplianceCard } from "@/components/kamma-compliance-card"
import { LicenceDetailsCard } from "@/components/licence-details-card"
import { HmoPlanningDecisionsCard } from "@/components/hmo-planning-decisions-card"
import {
  categorise,
  licenceExpiry,
  licenceReference,
  type CategorisableProperty,
  type LicenceState,
} from "@/lib/properties/category"
// DataEnrichmentCard removed - enrichment is automated, not user-triggered
import { EnrichedDataDisplay } from "@/components/enriched-data-display"
import { SavePropertyButton } from "@/components/save-property-button"
import { toast } from "sonner"
import { csrfFetch } from "@/lib/csrf-client"

// ═══════════════════════════════════════════════════════════════════════════
// SPACING CONSTANTS (4px base)
// ═══════════════════════════════════════════════════════════════════════════
// 4px = gap-1, p-1
// 8px = gap-2, p-2
// 12px = gap-3, p-3
// 16px = gap-4, p-4

interface PropertyDetailCardProps {
  property: Property
  onViewFullDetails: () => void
  canSeeOwnerData?: boolean
  isSaved?: boolean
  className?: string
  hideFooter?: boolean
  hideHeader?: boolean
}

type TabType = "analysis" | "details" | "compliance"

export function PropertyDetailCard({
  property,
  onViewFullDetails,
  canSeeOwnerData = false,
  isSaved = false,
  className,
  hideFooter = false,
  hideHeader = false,
}: PropertyDetailCardProps) {
  const [activeTab, setActiveTab] = useState<TabType>("analysis")
  const [copiedCompanyNumber, setCopiedCompanyNumber] = useState(false)
  const [isEnriching, setIsEnriching] = useState(false)
  const [enrichedProperty, setEnrichedProperty] = useState<Property>(property)

  // Reset enriched data when a different property is selected
  useEffect(() => {
    setEnrichedProperty(property)
  }, [property.id])

  // Auto-enrich property data when viewed
  useEffect(() => {
    const controller = new AbortController()

    const shouldEnrich = () => {
      // Check if any enrichment is missing or stale (> 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const needsStreetData = !property.streetdata_enriched_at || property.streetdata_enriched_at < sevenDaysAgo
      const needsPaTMa = !property.patma_enriched_at || property.patma_enriched_at < sevenDaysAgo
      const needsPropertyData = !property.propertydata_enriched_at || property.propertydata_enriched_at < sevenDaysAgo
      return needsStreetData || needsPaTMa || needsPropertyData
    }

    const enrichProperty = async () => {
      if (!shouldEnrich() || isEnriching) return

      setIsEnriching(true)
      try {
        const response = await csrfFetch("/api/enrich-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ propertyIds: [property.id] }),
          signal: controller.signal,
        })

        if (response.ok) {
          // Fetch updated property data
          const updatedResponse = await fetch(`/api/property/${property.id}`, {
            signal: controller.signal,
          })
          if (updatedResponse.ok) {
            const data = await updatedResponse.json()
            if (data.property) {
              setEnrichedProperty(data.property)
            }
          }
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
      } finally {
        if (!controller.signal.aborted) setIsEnriching(false)
      }
    }

    enrichProperty()
    return () => controller.abort()
  }, [property.id])

  // Use enriched property data for display
  const displayProperty = enrichedProperty

  // Share handler
  const handleShare = async () => {
    const url = property.source_url || window.location.href

    try {
      await navigator.clipboard.writeText(url)
      toast.success("Link copied to clipboard!")
    } catch (error) {
      toast.error("Failed to copy link")
      // Show alert as fallback
      alert(`Copy this link:\n${url}`)
    }
  }

  // Calculations
  const monthlyRent = property.listing_type === "purchase"
    ? (property.estimated_rent_per_room ? property.estimated_rent_per_room * property.bedrooms : null)
    : property.price_pcm

  const grossYield = (() => {
    if (property.listing_type !== "purchase" || !property.purchase_price || !monthlyRent) return null
    return ((monthlyRent * 12 / property.purchase_price) * 100).toFixed(1)
  })()

  /*
   * The yield's basis, stated on the face of the panel.
   *
   * Gross yield on a purchase listing is modelled: the asking price is
   * observed, the rent is `estimated_rent_per_room × bedrooms`. 231 of the
   * 1,068 purchase rows (21.6%) take that rate from the national default
   * rather than a city figure, and a reader could not previously tell which
   * they were looking at.
   */
  const rentBasis = property.listing_type === "purchase" && monthlyRent
    ? roomRent(property.city, property.article_4_council)
    : null

  /*
   * Rent per room on a letting. Both inputs are observed — the advertised
   * monthly rent and the bedroom count — so this is arithmetic on real values
   * rather than a model, and it is the figure an HMO investor actually
   * compares between properties.
   */
  const rentPerRoom = (() => {
    if (property.listing_type === "purchase") return null
    if (!property.price_pcm || !property.bedrooms) return null
    return Math.round(property.price_pcm / property.bedrooms)
  })()

  /*
   * Net yield and monthly cashflow were removed here.
   *
   * "Net Yield" was `grossYield × 0.7` — a flat 30% haircut presented as a
   * distinct metric, with nothing saying so. Cashflow assumed 30% costs, 75%
   * LTV and 5.5% interest, all hardcoded, and rendered as a pound figure a
   * reader would take for their own. It also painted RED when null, because
   * `monthlyCashflow !== null && monthlyCashflow >= 0` is false for a null —
   * so 1,890 rows (63.9%) showed a red dash that read as negative cashflow.
   * Neither can be stated honestly without inputs the reader controls.
   */

  /*
   * Derived from the expiry date, not the stored licence_status. Councils only
   * write "expired" on revocation, so a licence that simply ran out still reads
   * "active" — this panel was showing "Licence Active" in emerald over a date
   * in the past. Same rule as the list card and the segment tabs.
   */
  const licenceState = categorise(property as CategorisableProperty).licence
  const licenceConfigs: Record<LicenceState, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
    licensed: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", label: "Active" },
    licence_ending: { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50", label: "Ending soon" },
    licence_expired: { icon: XCircle, color: "text-red-600", bg: "bg-red-50", label: "Expired" },
    // Amber, not red: the term we hold has run out, the register has not said
    // the licence has.
    licence_term_ended: { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50", label: "term ended, unconfirmed" },
    licence_undated: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", label: "Active" },
    unlicensed: { icon: AlertCircle, color: "text-slate-400", bg: "bg-slate-50", label: "None recorded" },
  }
  const licenceConfig = licenceConfigs[licenceState]
  const publishedExpiry = licenceExpiry(property)
  const publishedReference = licenceReference(property)

  const amenities = [
    { icon: Wifi, label: "WiFi", show: property.wifi_included },
    { icon: Trees, label: "Garden", show: property.has_garden },
    { icon: TrainFront, label: "Tube", show: property.near_tube_station },
    { icon: Car, label: "Parking", show: property.has_parking },
    { icon: PawPrint, label: "Pets", show: property.is_pet_friendly },
    { icon: GraduationCap, label: "Students", show: property.is_student_friendly },
    { icon: Sofa, label: "Furnished", show: property.is_furnished },
  ].filter(a => a.show)

  const copyCompanyNumber = () => {
    if (property.company_number) {
      navigator.clipboard.writeText(property.company_number)
      setCopiedCompanyNumber(true)
      setTimeout(() => setCopiedCompanyNumber(false), 2000)
    }
  }

  return (
    <div className={cn("flex flex-col h-full bg-white", className)}>

      {/* ═══════════════════════════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════════════════════════ */}
      {!hideHeader && <div className="shrink-0 p-4 border-b border-slate-200">

        {/*
          * Planning and licence position first.
          *
          * This is the reason the ICP is on this panel rather than a portal —
          * the three-state Article 4 position and a licence state that does not
          * pretend. The price sat above it, and the price is the one thing a
          * reader can get anywhere.
          */}
        <div className="flex flex-wrap gap-2 mb-3" role="list" aria-label="Property status tags">
          {/*
            * Reads the categorised licence state, not the raw columns. This row
            * used to show "Licensed" off `licensed_hmo` and "Expired Licence"
            * off `licence_status === "expired"` — so a property whose term had
            * run out while the register still said active showed a plain green
            * "Licensed", contradicting the panel's own header a few pixels
            * below, which has read the categorised state since the licence work.
            * The register saying expired and our copy of the date running out
            * are different findings and are never merged.
            */}
          {licenceState !== "unlicensed" && (
            <span
              className={cn(
                "inline-flex items-center gap-1 h-6 px-2 rounded text-xs font-medium",
                licenceConfig.bg,
                licenceConfig.color,
              )}
              role="listitem"
            >
              <licenceConfig.icon className="w-3 h-3" aria-hidden="true" />
              {licenceState === "licensed" || licenceState === "licence_undated"
                ? "Licensed"
                : licenceState === "licence_ending"
                  ? "Licence ending soon"
                  : licenceState === "licence_expired"
                    ? "Recorded as expired"
                    : "Licence term ended, unconfirmed"}
            </span>
          )}
          {property.article_4_status === "in_force" && (
            <span className="inline-flex items-center gap-1 h-6 px-2 rounded text-xs font-medium bg-purple-50 text-purple-700" role="listitem">
              <AlertCircle className="w-3 h-3" aria-hidden="true" /> Article 4 Area
            </span>
          )}
          {property.article_4_status === "unknown" && (
            <span className="inline-flex items-center gap-1 h-6 px-2 rounded text-xs font-medium bg-slate-100 text-slate-600" role="listitem">
              <HelpCircle className="w-3 h-3" aria-hidden="true" /> Article 4 Unknown
            </span>
          )}
          
        </div>

        {/* Price */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-xl md:text-2xl font-bold text-slate-900">
              {(() => {
                const price = property.listing_type === "purchase" ? property.purchase_price : property.price_pcm
                return price ? `£${price.toLocaleString()}` : "Price on application"
              })()}
            </span>
            <span className="text-sm text-slate-500">
              {property.listing_type === "purchase" ? "asking" : "/mo"}
            </span>
          </div>
        </div>

        {/* Address */}
        <div className="flex items-center gap-2 mt-3">
          <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
          <p className="text-sm text-slate-700 truncate">{property.address}, {property.postcode}</p>
        </div>

        {/* Specs */}
        <div className="flex items-center gap-2 md:gap-4 mt-3">
          <div className="flex items-center gap-1 text-sm text-slate-600">
            <BedDouble className="w-4 h-4 text-slate-400" />
            <span>{property.bedrooms}</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-slate-600">
            <Bath className="w-4 h-4 text-slate-400" />
            <span>{property.bathrooms}</span>
          </div>
          {property.gross_internal_area_sqm && (
            <span className="text-sm text-slate-600">{Math.round(property.gross_internal_area_sqm)}m²</span>
          )}
          {property.epc_rating && (
            <EPCBadge rating={property.epc_rating} numericRating={property.epc_rating_numeric} className="text-xs" />
          )}
        </div>

      </div>}

      {/* ═══════════════════════════════════════════════════════════════════
          HEADLINE METRIC
          One figure, or none. The old bar was three columns rendered
          unconditionally — for the 63.9% of stock that is a letting, all three
          showed an em-dash, so a third of the panel's height said nothing
          three times.
      ═══════════════════════════════════════════════════════════════════ */}
      {(grossYield || rentPerRoom !== null) && (
        <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-3">
          {grossYield ? (
            <>
              <div className="flex items-baseline justify-between">
                <p className="text-xs text-slate-500">Gross yield</p>
                <p className="text-base font-bold text-slate-900">{grossYield}%</p>
              </div>
              {/* No colour threshold. The old rule painted >=6% green, which
                  endorsed a modelled number — and against a median of 2.5%
                  across purchase stock it almost never fired anyway. */}
              {rentBasis && (
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Modelled: £{rentBasis.rate.toLocaleString()}/room × {property.bedrooms} rooms ÷ asking price
                  {rentBasis.basis === "city"
                    ? ` · ${rentBasis.city} room rate`
                    : " · national average room rate, no city figure held"}
                </p>
              )}
            </>
          ) : (
            <div className="flex items-baseline justify-between">
              <p className="text-xs text-slate-500">Rent per room</p>
              <p className="text-base font-bold text-slate-900">
                £{rentPerRoom?.toLocaleString()}
                <span className="ml-1 text-xs font-normal text-slate-500">/mo</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TABS
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="shrink-0 grid grid-cols-3 border-b border-slate-200" role="tablist">
        {[
          { id: "analysis" as TabType, label: "Analysis" },
          { id: "details" as TabType, label: "Details" },
          { id: "compliance" as TabType, label: "Licensing" },
        ].map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "py-3 text-sm font-medium text-center transition-colors relative",
              activeTab === tab.id ? "text-teal-600" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-teal-600 rounded-full" aria-hidden="true" />
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          CONTENT
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">

          {/* ANALYSIS TAB */}
          {activeTab === "analysis" && (
            <>
              <AreaStatisticsCard postcode={property.postcode} />
              <SoldPriceHistory postcode={property.postcode} currentPrice={property.purchase_price || property.price_pcm || undefined} />
            </>
          )}

          {/* DETAILS TAB */}
          {activeTab === "details" && (
            <>
              {/* Features */}
              {amenities.length > 0 && (
                <Section title="Features">
                  <div className="flex flex-wrap gap-2">
                    {amenities.map((a, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 h-8 px-3 bg-white rounded-lg text-sm text-slate-700 border border-slate-200">
                        <a.icon className="w-4 h-4 text-teal-600" />
                        {a.label}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {/* Floor Plans */}
              <Section title="Floor Plans">
                {property.floor_plans && property.floor_plans.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {property.floor_plans.map((plan, idx) => (
                      <a
                        key={idx}
                        href={plan}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="aspect-video bg-white rounded-lg border border-slate-200 flex items-center justify-center hover:border-teal-400 transition-colors"
                      >
                        <LayoutGrid className="w-6 h-6 text-slate-300" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-6">No floor plans available</p>
                )}
              </Section>

              {/* EPC */}
              {property.epc_rating && (
                <Section title="Energy Performance">
                  <Row label="Rating" value={<EPCBadge rating={property.epc_rating} numericRating={property.epc_rating_numeric} />} />
                  {property.gross_internal_area_sqm && (
                    <Row label="Floor Area" value={`${Math.round(property.gross_internal_area_sqm)}m²`} />
                  )}
                  {property.epc_certificate_url && property.epc_certificate_url !== "not_available" && (
                    <a
                      href={property.epc_certificate_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-teal-600 font-medium mt-2 hover:text-teal-700"
                    >
                      View certificate <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </Section>
              )}

              {/* Ownership - Pro capability */}
              {(property.owner_name || property.company_name) && (
                <Section title="Ownership">
                  {canSeeOwnerData ? (
                    property.company_name ? (
                      <>
                        <Row
                          label="Company"
                          value={
                            <span className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-slate-400" />
                              {property.company_name}
                            </span>
                          }
                        />
                        {property.company_number && (
                          <div className="flex items-center gap-2 h-10 px-3 bg-white rounded-lg border border-slate-200 mt-2">
                            <code className="text-sm text-slate-600 flex-1">{property.company_number}</code>
                            <button
                              onClick={copyCompanyNumber}
                              className="text-slate-400 hover:text-slate-600"
                              aria-label={copiedCompanyNumber ? "Company number copied" : "Copy company number"}
                            >
                              {copiedCompanyNumber ? <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <Row label="Owner" value={property.owner_name} />
                    )
                  ) : (
                    <div className="text-center py-3">
                      <div className="flex items-center justify-center gap-2 text-amber-600 mb-2">
                        <Shield className="w-4 h-4" />
                        <span className="text-sm font-medium">Pro feature</span>
                      </div>
                      <p className="text-xs text-slate-500">Upgrade to see owner details</p>
                    </div>
                  )}
                </Section>
              )}

              <AgentContactCard property={property} />

              {/* Enriched Data from APIs - auto-loads when property is viewed */}
              <EnrichedDataDisplay property={displayProperty} isLoading={isEnriching} />
            </>
          )}

          {/* LICENSING TAB */}
          {activeTab === "compliance" && (
            <>
              {/* Kamma Compliance Check - Real-time API (Primary: answers "Do I need a licence?") */}
              <KammaComplianceCard
                postcode={property.postcode}
                address={property.address}
                uprn={property.uprn || undefined}
                bedrooms={property.bedrooms}
                autoCheck
              />

              {/* Licence Details from Council Register */}
              <LicenceDetailsCard propertyId={property.id} />

              {/* Article 4 status — all three states are shown. An unchecked or
                  uncovered council must not render as silence, because silence
                  reads as "no restriction". */}
              {property.article_4_status === "in_force" && (
                <div className="rounded-lg p-4 bg-purple-50">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-purple-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-purple-800">Article 4 Direction</p>
                      <p className="text-xs text-purple-600 mt-1">
                        Planning permission required for HMO use.
                        {property.article_4_area_name ? ` ${property.article_4_area_name}.` : ""}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {property.article_4_status === "unknown" && (
                <div className="rounded-lg p-4 bg-slate-50">
                  <div className="flex items-center gap-3">
                    <HelpCircle className="w-5 h-5 text-slate-500 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Article 4 status unknown</p>
                      <p className="text-xs text-slate-600 mt-1">
                        {property.article_4_council
                          ? `${property.article_4_council} does not publish HMO Article 4 boundaries to the national planning dataset.`
                          : "This property has not been checked against Article 4 boundaries yet."}{" "}
                        Confirm directly with the council before relying on this.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {property.article_4_status === "none_found" && (
                <div className="rounded-lg p-4 bg-emerald-50">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">No Article 4 direction found</p>
                      <p className="text-xs text-emerald-700 mt-1">
                        Checked against {property.article_4_council ?? "the local authority"}&rsquo;s
                        published boundaries
                        {property.article_4_checked_at
                          ? ` on ${new Date(property.article_4_checked_at).toLocaleDateString("en-GB")}`
                          : ""}
                        .
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Sits directly under the Article 4 status because it answers the
                  question that status raises: permission is required here, but
                  is it actually granted? */}
              <HmoPlanningDecisionsCard
                latitude={property.latitude}
                longitude={property.longitude}
                radiusKm={2}
                defaultExpanded={property.article_4_status === "in_force"}
              />

              {/* Current Licence Status (if property has one) */}
              {property.licensed_hmo && (
                <div className={cn("rounded-lg p-4", licenceConfig.bg)}>
                  <div className="flex items-center gap-3">
                    <licenceConfig.icon className={cn("w-5 h-5 shrink-0", licenceConfig.color)} />
                    <div className="min-w-0">
                      <p className={cn("text-sm font-semibold", licenceConfig.color)}>
                        Licence {licenceConfig.label}
                      </p>
                      {publishedExpiry ? (
                        <p className="text-xs text-slate-600 mt-1">
                          {licenceState === "licence_expired"
                            ? "Expired"
                            : licenceState === "licence_term_ended"
                            ? "Term we hold ran out"
                            : "Valid until"}{" "}
                          {new Date(publishedExpiry).toLocaleDateString("en-GB")}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-600 mt-1">
                          The register published no expiry date
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Licence # read licence_id and there was a "Max Occupants"
                      figure beside it. Both come from
                      scripts/DO_NOT_RUN_012_populate_licence_term_data.sql — the reference
                      is MD5(address) and the occupancy is bedrooms + 1 — so
                      this panel was presenting two invented facts as register
                      data. Only the council's own reference is shown now, and
                      only when there is one. */}
                  {publishedReference && (
                    <div className="mt-4 pt-4 border-t border-black/10">
                      <p className="text-xs text-slate-500">Licence reference</p>
                      <p className="text-sm font-mono font-medium text-slate-800 mt-1">{publishedReference}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════════════════════ */}
      {!hideFooter && <div className="shrink-0 p-4 border-t border-slate-200 bg-white">
        <div className="flex flex-wrap gap-2">
          {property.listing_type === "purchase" && (
            <Button
              className="flex-1 h-10 bg-teal-600 hover:bg-teal-700 text-white font-medium"
              aria-label="Book a viewing for this property"
              onClick={() => {
                // Priority: agent phone > source URL > alert
                if (property.agent_phone) {
                  window.location.href = `tel:${property.agent_phone}`
                } else if (property.source_url) {
                  window.open(property.source_url, '_blank', 'noopener,noreferrer')
                } else if (property.zoopla_listing_url) {
                  window.open(property.zoopla_listing_url, '_blank', 'noopener,noreferrer')
                } else {
                  alert('Viewing booking not available. Try viewing the original listing.')
                }
              }}
            >
              <Phone className="w-4 h-4 mr-2" aria-hidden="true" />
              Book Viewing
            </Button>
          )}
          <Button variant="outline" onClick={onViewFullDetails} className="flex-1 h-10 font-medium" aria-label="View full property details">
            Full Details
            <ChevronRight className="w-4 h-4 ml-1" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={handleShare}
            aria-label="Share property"
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
        {property.source_url && (
          <a
            href={property.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-teal-600 mt-3"
          >
            View listing <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">{title}</h3>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between h-10">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value}</span>
    </div>
  )
}
