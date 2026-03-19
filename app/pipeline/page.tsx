"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PipelineBoard } from "@/components/pipeline-board"
import { D2VComposer } from "@/components/d2v-composer"
import { ViewingTracker } from "@/components/viewing-tracker"
import { createClient } from "@/lib/supabase/client"
import { getVisibilityForRole } from "@/lib/role-visibility"
import type { UserType } from "@/components/role-selection-modal"
import {
  Kanban, Mail, Calendar, Search, ArrowLeft, Zap,
  TrendingUp, ShieldCheck, FileText, Users, Building2,
  Briefcase, Home, ChevronRight, Sparkles, Eye,
} from "lucide-react"
import { toast } from "sonner"

// ICP-specific value propositions
const ICP_VALUE: Record<UserType, {
  headline: string
  subtitle: string
  stats: { label: string; value: string; icon: typeof Zap }[]
  competitiveEdge: string
}> = {
  investor: {
    headline: "Find & Close HMO Deals Faster",
    subtitle: "From discovery to completion — the only platform that combines HMO intelligence with deal execution tools.",
    stats: [
      { label: "Avg. days to find a deal", value: "3x faster", icon: Zap },
      { label: "Off-market data sources", value: "6 sources", icon: Search },
      { label: "Owner contact rate", value: "85%+", icon: Users },
    ],
    competitiveEdge: "Unlike PropStream or PropertyData, HMO Hunter combines deal sourcing, owner outreach, and pipeline management in one platform — no spreadsheets needed.",
  },
  council_ta: {
    headline: "Source TA Properties Efficiently",
    subtitle: "Identify, assess, and place properties for temporary accommodation — all in one workflow.",
    stats: [
      { label: "Properties with TA data", value: "LHA + suitability", icon: ShieldCheck },
      { label: "Compliance checks", value: "Automated", icon: FileText },
      { label: "Inspection tracking", value: "Built-in", icon: Calendar },
    ],
    competitiveEdge: "No other platform combines HMO register data with LHA rates, TA suitability scoring, and inspection workflow management for council teams.",
  },
  operator: {
    headline: "Stay Compliant, Stay Profitable",
    subtitle: "Track every licence, inspection, and compliance deadline across your entire HMO portfolio.",
    stats: [
      { label: "Licence expiry alerts", value: "90 days ahead", icon: ShieldCheck },
      { label: "Compliance checks", value: "8-point", icon: FileText },
      { label: "Portfolio visibility", value: "All-in-one", icon: Building2 },
    ],
    competitiveEdge: "Purpose-built for HMO operators — not a generic property management tool. Every feature is designed around HMO licensing and compliance.",
  },
  agent: {
    headline: "Source & Package Deals at Scale",
    subtitle: "Find off-market opportunities, contact owners directly, and manage your deal pipeline from sourcing to exchange.",
    stats: [
      { label: "D2V letter templates", value: "Ready-made", icon: Mail },
      { label: "Off-market leads", value: "3 free sources", icon: Search },
      { label: "Pipeline stages", value: "7-stage flow", icon: Kanban },
    ],
    competitiveEdge: "GoDryv charges per letter. PropertyEngine lacks HMO intelligence. HMO Hunter gives you both — with integrated owner data and deal scoring.",
  },
}

export default function PipelinePage() {
  const [userType, setUserType] = useState<UserType>("investor")
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function loadUserType() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth/login")
        return
      }
      if (user.user_metadata?.user_type) {
        setUserType(user.user_metadata.user_type as UserType)
      }
      setLoading(false)
    }
    loadUserType()
  }, [router])

  const visibility = getVisibilityForRole(userType)
  const value = ICP_VALUE[userType]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    )
  }

  const tabs: { key: string; label: string; icon: typeof Kanban; visible: boolean }[] = [
    { key: "pipeline", label: "Pipeline", icon: Kanban, visible: visibility.showPipeline },
    { key: "d2v", label: "D2V Outreach", icon: Mail, visible: visibility.showD2VOutreach },
    { key: "viewings", label: "Viewings", icon: Calendar, visible: visibility.showViewingTracker },
    { key: "off-market", label: "Off-Market Leads", icon: Search, visible: visibility.showOffMarketSourcing },
  ]

  const visibleTabs = tabs.filter(t => t.visible)
  const defaultTab = visibleTabs[0]?.key || "pipeline"

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/map")}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Map</span>
            </button>
            <span className="text-slate-300">/</span>
            <h1 className="text-sm font-semibold text-slate-900">Deal Management</h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Badge variant="outline" className="gap-1">
              <Sparkles className="h-3 w-3" />
              {userType === "investor" ? "Investor" : userType === "council_ta" ? "Council/TA" : userType === "operator" ? "Operator" : "Agent"}
            </Badge>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 py-6">
        {/* ICP Value Banner */}
        <div className="mb-6 bg-gradient-to-r from-teal-600 to-emerald-600 rounded-xl p-6 text-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-xl font-bold">{value.headline}</h2>
              <p className="text-teal-100 text-sm mt-1 max-w-xl">{value.subtitle}</p>
            </div>
            <div className="flex gap-4">
              {value.stats.map((stat, i) => {
                const Icon = stat.icon
                return (
                  <div key={i} className="text-center">
                    <Icon className="h-5 w-5 mx-auto mb-1 text-teal-200" />
                    <p className="text-lg font-bold">{stat.value}</p>
                    <p className="text-[10px] text-teal-200 leading-tight">{stat.label}</p>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-teal-500/30">
            <p className="text-xs text-teal-100 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" />
              {value.competitiveEdge}
            </p>
          </div>
        </div>

        {/* Main tabs */}
        <Tabs defaultValue={defaultTab}>
          <TabsList className="mb-6 bg-white border">
            {visibleTabs.map(tab => {
              const Icon = tab.icon
              return (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className="flex items-center gap-1.5 data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700"
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              )
            })}
          </TabsList>

          {visibility.showPipeline && (
            <TabsContent value="pipeline">
              <PipelineBoard userType={userType} />
            </TabsContent>
          )}

          {visibility.showD2VOutreach && (
            <TabsContent value="d2v">
              <D2VComposer />
            </TabsContent>
          )}

          {visibility.showViewingTracker && (
            <TabsContent value="viewings">
              <ViewingTracker userType={userType} />
            </TabsContent>
          )}

          {visibility.showOffMarketSourcing && (
            <TabsContent value="off-market">
              <OffMarketDashboard />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}

// ============================================================
// OFF-MARKET DASHBOARD — Dual-source: existing properties + new leads
// ============================================================

function OffMarketDashboard() {
  const [activeView, setActiveView] = useState<"properties" | "leads">("properties")
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [propertySummary, setPropertySummary] = useState<Record<string, number>>({})
  const [leadSummary, setLeadSummary] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [propertyFilter, setPropertyFilter] = useState("")
  const [leadSource, setLeadSource] = useState("all")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch both sources in parallel
      const [propRes, leadsRes] = await Promise.all([
        fetch(`/api/off-market${propertyFilter ? `?type=${propertyFilter}` : ""}`),
        fetch(`/api/off-market/leads${leadSource !== "all" ? `?source=${leadSource}` : ""}`),
      ])

      if (propRes.ok) {
        const data = await propRes.json()
        setOpportunities(data.opportunities || [])
        setPropertySummary(data.summary || {})
      }

      if (leadsRes.ok) {
        const data = await leadsRes.json()
        setLeads(data.leads || [])
        setLeadSummary(data.summary || {})
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false)
    }
  }, [propertyFilter, leadSource])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const SOURCE_CONFIG: Record<string, { label: string; description: string; color: string; icon: typeof FileText }> = {
    gazette_probate: {
      label: "Probate Notices",
      description: "Properties entering probate from The Gazette — deceased estates with solicitor contacts",
      color: "bg-purple-100 text-purple-700 border-purple-200",
      icon: FileText,
    },
    unclaimed_estate: {
      label: "Unclaimed Estates",
      description: "Gov.uk Bona Vacantia — estates with no known heir, potential property acquisitions",
      color: "bg-amber-100 text-amber-700 border-amber-200",
      icon: Users,
    },
    land_registry_repo: {
      label: "Repossessions",
      description: "Land Registry Category B transactions — repossessions, power of sale, below-market deals",
      color: "bg-red-100 text-red-700 border-red-200",
      icon: Building2,
    },
  }

  const PROPERTY_OPP_CONFIG: Record<string, { label: string; color: string }> = {
    expired_licence: { label: "Expired Licence", color: "bg-red-100 text-red-700" },
    expiring_licence: { label: "Expiring Soon", color: "bg-amber-100 text-amber-700" },
    unlicensed_potential: { label: "Unlicensed Potential", color: "bg-purple-100 text-purple-700" },
    long_on_market: { label: "Long on Market", color: "bg-blue-100 text-blue-700" },
    stale_listing: { label: "Stale Listing", color: "bg-slate-100 text-slate-700" },
  }

  const totalLeads = Object.values(leadSummary).reduce((a, b) => a + b, 0)
  const totalProps = opportunities.length

  if (loading) {
    return <div className="animate-pulse text-slate-400 py-12 text-center">Loading off-market intelligence...</div>
  }

  return (
    <div className="space-y-6">
      {/* Source cards */}
      <div className="grid md:grid-cols-3 gap-3">
        {Object.entries(SOURCE_CONFIG).map(([key, config]) => {
          const Icon = config.icon
          const count = leadSummary[key] || 0
          return (
            <Card
              key={key}
              className={`cursor-pointer transition-all hover:shadow-md ${
                activeView === "leads" && leadSource === key ? "ring-2 ring-teal-500" : ""
              }`}
              onClick={() => { setActiveView("leads"); setLeadSource(key) }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-md ${config.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="font-medium text-sm">{config.label}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">{config.description}</p>
                  </div>
                  <Badge variant="secondary" className="text-lg font-bold px-2.5">
                    {count}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center text-xs text-teal-600 font-medium">
                  <span>View leads</span>
                  <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Toggle between property opps and external leads */}
      <div className="flex items-center gap-2 border-b pb-3">
        <button
          onClick={() => setActiveView("properties")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeView === "properties"
              ? "bg-teal-600 text-white"
              : "bg-white text-slate-600 hover:bg-slate-50 border"
          }`}
        >
          Property Signals ({totalProps})
        </button>
        <button
          onClick={() => { setActiveView("leads"); setLeadSource("all") }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeView === "leads"
              ? "bg-teal-600 text-white"
              : "bg-white text-slate-600 hover:bg-slate-50 border"
          }`}
        >
          External Leads ({totalLeads})
        </button>
      </div>

      {/* Property Signals View */}
      {activeView === "properties" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setPropertyFilter("")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                !propertyFilter ? "bg-slate-900 text-white" : "bg-white text-slate-600 border hover:bg-slate-50"
              }`}
            >
              All ({totalProps})
            </button>
            {Object.entries(PROPERTY_OPP_CONFIG).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setPropertyFilter(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  propertyFilter === key ? "bg-slate-900 text-white" : `${config.color} hover:opacity-80`
                }`}
              >
                {config.label} ({propertySummary[key] || 0})
              </button>
            ))}
          </div>

          {opportunities.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No property signals yet"
              description="Signals appear when properties have expired licences, are long on market, or show HMO conversion potential. Ingest property data to populate this view."
            />
          ) : (
            <div className="grid gap-2">
              {opportunities.slice(0, 50).map((opp: any) => (
                <div
                  key={opp.id}
                  className="flex items-center justify-between p-3 bg-white border rounded-lg hover:shadow-sm transition-shadow group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{opp.address}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] flex-shrink-0 ${
                        PROPERTY_OPP_CONFIG[opp.opportunity_type]?.color || "bg-slate-100"
                      }`}>
                        {PROPERTY_OPP_CONFIG[opp.opportunity_type]?.label || opp.opportunity_type}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span>{opp.postcode}</span>
                      {opp.city && <span>{opp.city}</span>}
                      {opp.bedrooms && <span>{opp.bedrooms} bed</span>}
                      {opp.deal_score && <span>Score: {opp.deal_score}</span>}
                      {opp.owner_name && <span className="text-teal-600">Owner: {opp.owner_name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {opp.purchase_price && (
                      <span className="text-xs font-mono text-slate-600">
                        £{opp.purchase_price.toLocaleString()}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => window.open(`/property/${opp.id}`, "_blank")}
                    >
                      <Eye className="h-3 w-3 mr-1" /> View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* External Leads View */}
      {activeView === "leads" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setLeadSource("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                leadSource === "all" ? "bg-slate-900 text-white" : "bg-white text-slate-600 border"
              }`}
            >
              All Sources ({totalLeads})
            </button>
            {Object.entries(SOURCE_CONFIG).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setLeadSource(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  leadSource === key ? "bg-slate-900 text-white" : `${config.color} border`
                }`}
              >
                {config.label} ({leadSummary[key] || 0})
              </button>
            ))}
          </div>

          {leads.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No external leads yet"
              description="External leads come from The Gazette (probate notices), Unclaimed Estates (Gov.uk), and Land Registry (repossessions). An admin can trigger data ingestion from the admin panel."
            />
          ) : (
            <div className="grid gap-2">
              {leads.map((lead: any) => {
                const sourceConfig = SOURCE_CONFIG[lead.source]
                const SourceIcon = sourceConfig?.icon || FileText
                return (
                  <div
                    key={lead.id}
                    className="p-3 bg-white border rounded-lg hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`p-1 rounded ${sourceConfig?.color || "bg-slate-100"}`}>
                            <SourceIcon className="h-3 w-3" />
                          </div>
                          <span className="font-medium text-sm truncate">
                            {lead.property_address || lead.deceased_name || lead.bv_reference}
                          </span>
                          <Badge variant="outline" className="text-[10px] flex-shrink-0">
                            Score: {lead.opportunity_score}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          {lead.postcode && <span>{lead.postcode}</span>}
                          {lead.city && <span>{lead.city}</span>}
                          {lead.deceased_name && <span>Deceased: {lead.deceased_name}</span>}
                          {lead.solicitor_name && (
                            <span className="text-teal-600">Solicitor: {lead.solicitor_name}</span>
                          )}
                          {lead.sale_price && (
                            <span className="font-mono">£{lead.sale_price.toLocaleString()}</span>
                          )}
                          {lead.claim_expiry_date && (
                            <span className="text-amber-600">
                              Claim by: {new Date(lead.claim_expiry_date).toLocaleDateString("en-GB")}
                            </span>
                          )}
                          {lead.date_of_death && (
                            <span>DoD: {new Date(lead.date_of_death).toLocaleDateString("en-GB")}</span>
                          )}
                          {lead.place_of_death && !lead.property_address && (
                            <span>Place: {lead.place_of_death}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Badge
                          variant="outline"
                          className={`text-[10px] cursor-default ${
                            lead.status === "new" ? "bg-green-50 text-green-700" :
                            lead.status === "contacted" ? "bg-blue-50 text-blue-700" :
                            lead.status === "dismissed" ? "bg-slate-50 text-slate-500" :
                            "bg-teal-50 text-teal-700"
                          }`}
                        >
                          {lead.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Reusable empty state
function EmptyState({ icon: Icon, title, description }: { icon: typeof Search; title: string; description: string }) {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
        <Icon className="h-8 w-8 text-slate-300" />
      </div>
      <p className="font-medium text-slate-700">{title}</p>
      <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">{description}</p>
    </div>
  )
}
