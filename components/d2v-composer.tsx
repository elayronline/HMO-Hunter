"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  Mail,
  FileText,
  Send,
  Plus,
  Trash2,
  Copy,
  Users,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react"
import { D2V_PLACEHOLDERS } from "@/lib/types/pipeline"
import type { D2VTemplate, D2VCampaign, D2VChannel } from "@/lib/types/pipeline"

// Default templates per channel
const DEFAULT_LETTER_BODY = `Dear {{owner_name}},

I am writing to you regarding your property at {{property_address}}, {{property_postcode}}.

I am a property investor actively looking to purchase properties in the {{property_city}} area. I noticed your property and would be very interested in discussing a potential purchase.

I can offer a quick, hassle-free sale with:
- No estate agent fees
- Flexible completion timeline
- Cash buyer (no chain)

If you are considering selling, or would simply like to discuss your options, please do not hesitate to contact me.

I look forward to hearing from you.

Kind regards,
{{your_name}}
{{your_phone}}
{{your_email}}`

const DEFAULT_EMAIL_BODY = `Dear {{owner_name}},

I noticed your property at {{property_address}} and I'm interested in discussing a potential purchase opportunity.

As an active property investor in {{property_city}}, I can offer a straightforward, chain-free purchase with flexible timelines.

Would you be open to a brief conversation? I'm happy to discuss at your convenience.

Best regards,
{{your_name}}
{{your_phone}}`

export function D2VComposer() {
  const [templates, setTemplates] = useState<D2VTemplate[]>([])
  const [campaigns, setCampaigns] = useState<D2VCampaign[]>([])
  const [activeTab, setActiveTab] = useState("campaigns")
  const [loading, setLoading] = useState(true)

  // Template form
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [templateSubject, setTemplateSubject] = useState("")
  const [templateBody, setTemplateBody] = useState("")
  const [templateChannel, setTemplateChannel] = useState<D2VChannel>("letter")

  // Campaign form
  const [showCampaignDialog, setShowCampaignDialog] = useState(false)
  const [campaignName, setCampaignName] = useState("")
  const [campaignChannel, setCampaignChannel] = useState<D2VChannel>("email")
  const [campaignTemplateId, setCampaignTemplateId] = useState("")
  const [campaignPropertyIds, setCampaignPropertyIds] = useState("")

  // Property search for campaigns
  const [propertySearch, setPropertySearch] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([])
  const [searchingProperties, setSearchingProperties] = useState(false)

  const searchProperties = async () => {
    if (!propertySearch.trim()) return
    setSearchingProperties(true)
    try {
      // Search via the map-data endpoint with a city/postcode filter
      const res = await fetch(`/api/map-data?search=${encodeURIComponent(propertySearch)}&limit=20`)
      if (res.ok) {
        const data = await res.json()
        setSearchResults(Array.isArray(data) ? data : data.properties || [])
      }
    } catch {
      // Fall back to off-market endpoint for broader search
      try {
        const res = await fetch(`/api/off-market?city=${encodeURIComponent(propertySearch)}&limit=20`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data.opportunities || [])
        }
      } catch {
        toast.error("Search failed")
      }
    } finally {
      setSearchingProperties(false)
    }
  }

  const loadPropertiesFrom = async (source: "saved" | "pipeline" | "off-market") => {
    setSearchingProperties(true)
    try {
      let url = ""
      if (source === "saved") {
        // Fetch saved properties
        const res = await fetch("/api/saved-searches")
        // Use a simpler approach - just load from saved properties action
        url = "/api/pipeline" // Pipeline has property data joined
      } else if (source === "pipeline") {
        url = "/api/pipeline"
      } else {
        url = "/api/off-market?limit=50"
      }

      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        let properties: any[] = []

        if (source === "off-market") {
          properties = data.opportunities || []
        } else {
          // Pipeline deals have property nested
          properties = (Array.isArray(data) ? data : []).map((d: any) => d.property || d).filter(Boolean)
        }

        setSearchResults(properties)
      }
    } catch {
      toast.error(`Failed to load ${source} properties`)
    } finally {
      setSearchingProperties(false)
    }
  }

  const fetchData = useCallback(async () => {
    try {
      const [templatesRes, campaignsRes] = await Promise.all([
        fetch("/api/d2v/templates"),
        fetch("/api/d2v/campaigns"),
      ])
      if (templatesRes.ok) setTemplates(await templatesRes.json())
      if (campaignsRes.ok) setCampaigns(await campaignsRes.json())
    } catch {
      toast.error("Failed to load D2V data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const createTemplate = async () => {
    if (!templateName || !templateBody) {
      toast.error("Name and body are required")
      return
    }

    try {
      const res = await fetch("/api/d2v/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName,
          subject: templateSubject || undefined,
          body: templateBody,
          channel: templateChannel,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create template")
      }

      const template = await res.json()
      setTemplates(prev => [template, ...prev])
      setShowTemplateDialog(false)
      resetTemplateForm()
      toast.success("Template created")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create template")
    }
  }

  const deleteTemplate = async (id: string) => {
    try {
      const res = await fetch(`/api/d2v/templates?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      setTemplates(prev => prev.filter(t => t.id !== id))
      toast.success("Template deleted")
    } catch {
      toast.error("Failed to delete template")
    }
  }

  const createCampaign = async () => {
    if (!campaignName) {
      toast.error("Campaign name is required")
      return
    }

    // Use selected property IDs from the picker, or fall back to text input
    let propertyIds = selectedPropertyIds.length > 0
      ? selectedPropertyIds
      : campaignPropertyIds.split(/[,\n]/).map(id => id.trim()).filter(Boolean)

    if (propertyIds.length === 0) {
      toast.error("Select at least one property")
      return
    }

    try {
      const res = await fetch("/api/d2v/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName,
          channel: campaignChannel,
          template_id: campaignTemplateId || undefined,
          property_ids: propertyIds,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create campaign")
      }

      const campaign = await res.json()
      setCampaigns(prev => [campaign, ...prev])
      setShowCampaignDialog(false)
      resetCampaignForm()
      toast.success("Campaign created")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create campaign")
    }
  }

  const sendCampaign = async (campaignId: string) => {
    try {
      const res = await fetch("/api/d2v/campaigns", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: campaignId }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to send campaign")
      }

      const result = await res.json()
      toast.success(`Sent: ${result.sent_count}, Failed: ${result.failed_count}`)
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send campaign")
    }
  }

  const resetTemplateForm = () => {
    setTemplateName("")
    setTemplateSubject("")
    setTemplateBody("")
    setTemplateChannel("letter")
  }

  const resetCampaignForm = () => {
    setCampaignName("")
    setCampaignChannel("email")
    setCampaignTemplateId("")
    setCampaignPropertyIds("")
    setSelectedPropertyIds([])
    setSearchResults([])
    setPropertySearch("")
  }

  const insertPlaceholder = (placeholder: string) => {
    setTemplateBody(prev => prev + placeholder)
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case "sent": return <CheckCircle className="h-4 w-4 text-green-500" />
      case "failed": return <XCircle className="h-4 w-4 text-red-500" />
      case "draft": return <Clock className="h-4 w-4 text-slate-400" />
      case "sending": return <Send className="h-4 w-4 text-blue-500 animate-pulse" />
      default: return <Clock className="h-4 w-4 text-slate-400" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-400">Loading D2V...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Direct to Vendor Outreach</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTemplateChannel("letter")
              setTemplateBody(DEFAULT_LETTER_BODY)
              setShowTemplateDialog(true)
            }}
          >
            <FileText className="h-4 w-4 mr-1" /> New Template
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCampaignDialog(true)}
          >
            <Plus className="h-4 w-4 mr-1" /> New Campaign
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="campaigns">
            Campaigns ({campaigns.length})
          </TabsTrigger>
          <TabsTrigger value="templates">
            Templates ({templates.length})
          </TabsTrigger>
        </TabsList>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-3">
          {campaigns.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-slate-500">
                <Mail className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p className="text-lg font-medium">No campaigns yet</p>
                <p className="text-sm mt-1">Create a campaign to reach property owners directly.</p>
                <Button className="mt-4" onClick={() => setShowCampaignDialog(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Create Campaign
                </Button>
              </CardContent>
            </Card>
          ) : (
            campaigns.map(campaign => (
              <Card key={campaign.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {statusIcon(campaign.status)}
                      <div>
                        <p className="font-medium">{campaign.name}</p>
                        <p className="text-xs text-slate-500">
                          {campaign.channel === "email" ? "Email" : "Letter"} ·
                          {campaign.total_recipients} recipients ·
                          Created {new Date(campaign.created_at).toLocaleDateString("en-GB")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {campaign.status === "sent" && (
                        <div className="flex gap-2 text-xs">
                          <Badge variant="outline" className="bg-green-50">
                            {campaign.sent_count} sent
                          </Badge>
                          {campaign.failed_count > 0 && (
                            <Badge variant="outline" className="bg-red-50">
                              {campaign.failed_count} failed
                            </Badge>
                          )}
                          {campaign.responded_count > 0 && (
                            <Badge variant="outline" className="bg-blue-50">
                              {campaign.responded_count} responded
                            </Badge>
                          )}
                        </div>
                      )}

                      {campaign.status === "draft" && (
                        <Button
                          size="sm"
                          onClick={() => sendCampaign(campaign.id)}
                        >
                          <Send className="h-4 w-4 mr-1" /> Send
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-3">
          {templates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-slate-500">
                <FileText className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p className="text-lg font-medium">No templates yet</p>
                <p className="text-sm mt-1">Create reusable letter and email templates.</p>
                <Button
                  className="mt-4"
                  onClick={() => {
                    setTemplateChannel("letter")
                    setTemplateBody(DEFAULT_LETTER_BODY)
                    setShowTemplateDialog(true)
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Create Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            templates.map(template => (
              <Card key={template.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {template.channel === "email" ? (
                        <Mail className="h-5 w-5 text-blue-500" />
                      ) : (
                        <FileText className="h-5 w-5 text-amber-500" />
                      )}
                      <div>
                        <p className="font-medium">{template.name}</p>
                        <p className="text-xs text-slate-500">
                          {template.channel === "email" ? "Email" : "Letter"} ·
                          {template.placeholders?.length || 0} merge fields ·
                          Created {new Date(template.created_at).toLocaleDateString("en-GB")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setTemplateName(template.name + " (copy)")
                          setTemplateSubject(template.subject || "")
                          setTemplateBody(template.body)
                          setTemplateChannel(template.channel)
                          setShowTemplateDialog(true)
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        onClick={() => deleteTemplate(template.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Template</DialogTitle>
            <DialogDescription>Build a reusable outreach template with merge fields.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-sm font-medium">Template Name</label>
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Standard Purchase Letter"
                />
              </div>
              <div className="w-32">
                <label className="text-sm font-medium">Channel</label>
                <Select
                  value={templateChannel}
                  onValueChange={(v) => {
                    setTemplateChannel(v as D2VChannel)
                    if (v === "letter" && !templateBody) setTemplateBody(DEFAULT_LETTER_BODY)
                    if (v === "email" && !templateBody) setTemplateBody(DEFAULT_EMAIL_BODY)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="letter">Letter</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {templateChannel === "email" && (
              <div>
                <label className="text-sm font-medium">Subject Line</label>
                <Input
                  value={templateSubject}
                  onChange={(e) => setTemplateSubject(e.target.value)}
                  placeholder="e.g., Regarding your property at {{property_address}}"
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Body</label>
              <Textarea
                value={templateBody}
                onChange={(e) => setTemplateBody(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500">Merge Fields (click to insert)</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {D2V_PLACEHOLDERS.map(p => (
                  <Button
                    key={p}
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] font-mono"
                    onClick={() => insertPlaceholder(p)}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowTemplateDialog(false); resetTemplateForm() }}>
                Cancel
              </Button>
              <Button onClick={createTemplate}>
                Create Template
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Campaign Dialog */}
      <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Campaign</DialogTitle>
            <DialogDescription>Send outreach to property owners.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">Campaign Name</label>
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g., Manchester Expired Licences March 2026"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-sm font-medium">Channel</label>
                <Select value={campaignChannel} onValueChange={(v) => setCampaignChannel(v as D2VChannel)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email (2 credits each)</SelectItem>
                    <SelectItem value="letter">Letter (3 credits each)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium">Template</label>
                <Select value={campaignTemplateId} onValueChange={setCampaignTemplateId}>
                  <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                  <SelectContent>
                    {templates
                      .filter(t => t.channel === campaignChannel)
                      .map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Find Properties</label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={propertySearch}
                    onChange={(e) => setPropertySearch(e.target.value)}
                    placeholder="Search by address, postcode, or city..."
                    className="flex-1"
                    onKeyDown={(e) => { if (e.key === "Enter") searchProperties() }}
                  />
                  <Button variant="outline" size="sm" onClick={searchProperties} disabled={searchingProperties}>
                    {searchingProperties ? "..." : "Search"}
                  </Button>
                </div>

                {/* Quick-add sources */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => loadPropertiesFrom("saved")}
                    className="text-[11px] px-2 py-1 rounded bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100"
                  >
                    + Saved Properties
                  </button>
                  <button
                    onClick={() => loadPropertiesFrom("pipeline")}
                    className="text-[11px] px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                  >
                    + Pipeline Deals
                  </button>
                  <button
                    onClick={() => loadPropertiesFrom("off-market")}
                    className="text-[11px] px-2 py-1 rounded bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
                  >
                    + Off-Market Leads
                  </button>
                </div>

                {/* Search results */}
                {searchResults.length > 0 && (
                  <div className="border rounded-lg max-h-[160px] overflow-y-auto">
                    {searchResults.map((p: any) => {
                      const isAdded = selectedPropertyIds.includes(p.id)
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            if (isAdded) {
                              setSelectedPropertyIds(prev => prev.filter(id => id !== p.id))
                            } else {
                              setSelectedPropertyIds(prev => [...prev, p.id])
                            }
                          }}
                          className={`w-full text-left px-3 py-2 text-xs border-b last:border-0 transition-colors ${
                            isAdded ? "bg-teal-50" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <span className="font-medium truncate block">{p.address}</span>
                              <span className="text-slate-500">{p.postcode} · {p.city}</span>
                              {p.owner_name && <span className="text-teal-600 ml-2">Owner: {p.owner_name}</span>}
                            </div>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              isAdded ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-500"
                            }`}>
                              {isAdded ? "Added" : "Add"}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Selected count */}
                {selectedPropertyIds.length > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 bg-teal-50 rounded-lg border border-teal-200">
                    <span className="text-sm font-medium text-teal-700">
                      {selectedPropertyIds.length} propert{selectedPropertyIds.length === 1 ? "y" : "ies"} selected
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-teal-600">
                        {selectedPropertyIds.length * (campaignChannel === "email" ? 2 : 3)} credits
                      </span>
                      <button
                        onClick={() => setSelectedPropertyIds([])}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowCampaignDialog(false); resetCampaignForm() }}>
                Cancel
              </Button>
              <Button onClick={createCampaign}>
                <Users className="h-4 w-4 mr-1" /> Create Campaign
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
