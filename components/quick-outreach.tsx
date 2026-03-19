"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import {
  Mail, FileText, Send, Eye, AlertTriangle, CheckCircle,
  User, MapPin, Sparkles, Clock, ShieldCheck, XCircle, ImagePlus,
} from "lucide-react"
import type { Property } from "@/lib/types/database"
import type { D2VTemplate } from "@/lib/types/pipeline"
import {
  detectScenario,
  buildSmartMergeData,
  SCENARIO_TEMPLATES,
  validatePostalAddress,
  FOLLOW_UP_TEMPLATES,
  type LetterScenario,
} from "@/lib/d2v-templates"
import { SenderProfileEditor, loadSenderProfile, saveSenderProfile, type SenderProfile } from "@/components/sender-profile"

interface QuickOutreachProps {
  property: Property
  className?: string
  variant?: "button" | "icon" | "compact"
}

export function QuickOutreach({ property, className = "", variant = "button" }: QuickOutreachProps) {
  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState<D2VTemplate[]>([])
  const [channel, setChannel] = useState<"email" | "letter">(
    property.owner_contact_email || property.licence_holder_email ? "email" : "letter"
  )
  const [body, setBody] = useState("")
  const [subject, setSubject] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [enableFollowUps, setEnableFollowUps] = useState(true)
  const [senderProfile, setSenderProfile] = useState<SenderProfile | null>(null)
  const [showProfileEditor, setShowProfileEditor] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // Auto-detect scenario from property data
  const detectedScenario = useMemo(() => detectScenario(property), [property])
  const [selectedScenario, setSelectedScenario] = useState<LetterScenario>(detectedScenario)
  const scenarioConfig = SCENARIO_TEMPLATES[selectedScenario]

  // Smart merge data with property intelligence + sender profile
  const mergeData = useMemo(() => {
    const data = buildSmartMergeData(property)
    // Override placeholder values with sender profile
    if (senderProfile) {
      if (senderProfile.name) data.your_name = senderProfile.name
      if (senderProfile.company) data.your_company = senderProfile.company
      if (senderProfile.phone) data.your_phone = senderProfile.phone
      if (senderProfile.email) data.your_email = senderProfile.email
      if (senderProfile.address) data.your_address = senderProfile.address
      if (senderProfile.website) data.your_website = senderProfile.website
    }
    return data
  }, [property, senderProfile])

  // Address validation for letters
  const addressValidation = useMemo(
    () => validatePostalAddress(property.address || "", property.postcode || ""),
    [property.address, property.postcode]
  )

  // Recipient info
  const recipientName = property.owner_name || property.licence_holder_name || "Property Owner"
  const recipientEmail = property.owner_contact_email || property.licence_holder_email
  const hasEmail = !!recipientEmail

  const mergePlaceholders = useCallback((text: string): string => {
    let merged = text
    for (const [key, value] of Object.entries(mergeData)) {
      merged = merged.replaceAll(`{{${key}}}`, value)
    }
    return merged
  }, [mergeData])

  // Load body from scenario template when dialog opens or scenario changes
  useEffect(() => {
    if (open) {
      const template = channel === "email" ? scenarioConfig.emailTemplate : scenarioConfig.letterTemplate
      setBody(template)
      setSubject(scenarioConfig.subject)
    }
  }, [open, selectedScenario, channel]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/d2v/templates")
      if (res.ok) setTemplates(await res.json())
    } catch { /* silently fail */ }
  }, [])

  useEffect(() => {
    if (open) {
      fetchTemplates()
      // Load sender profile
      loadSenderProfile().then(p => setSenderProfile(p))
    }
  }, [open, fetchTemplates])

  const handleScenarioChange = (scenario: LetterScenario) => {
    setSelectedScenario(scenario)
    const config = SCENARIO_TEMPLATES[scenario]
    setBody(channel === "email" ? config.emailTemplate : config.letterTemplate)
    setSubject(config.subject)
  }

  const handleChannelChange = (newChannel: "email" | "letter") => {
    setChannel(newChannel)
    const template = newChannel === "email" ? scenarioConfig.emailTemplate : scenarioConfig.letterTemplate
    setBody(template)
  }

  // Merged content for preview
  const mergedBody = mergePlaceholders(body)
  const mergedSubject = mergePlaceholders(subject)
  const mailtoUrl = recipientEmail
    ? `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(mergedSubject)}&body=${encodeURIComponent(mergedBody)}`
    : ""

  const canSend = channel === "email"
    ? (hasEmail && body.length > 10)
    : (addressValidation.isValid && body.length > 10)

  const handleSend = async () => {
    setSending(true)
    try {
      if (channel === "email") {
        window.open(mailtoUrl, "_blank")
        setSent(true)
        toast.success(`Email opened for ${recipientName}`)
      } else {
        // Create campaign + send via Stannp
        const campaignRes = await fetch("/api/d2v/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `${scenarioConfig.label}: ${property.address}`,
            channel: "letter",
            property_ids: [property.id],
          }),
        })

        if (!campaignRes.ok) {
          const err = await campaignRes.json()
          throw new Error(err.error || "Failed to create campaign")
        }

        const campaign = await campaignRes.json()

        // Save template for reuse
        await fetch("/api/d2v/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `${scenarioConfig.label} - ${new Date().toISOString().split("T")[0]}`,
            body,
            channel: "letter",
          }),
        }).catch(() => {})

        // Send
        const sendRes = await fetch("/api/d2v/campaigns", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaign_id: campaign.id }),
        })

        if (!sendRes.ok) {
          const err = await sendRes.json()
          throw new Error(err.error || "Failed to send letter")
        }

        const result = await sendRes.json()
        setSent(true)

        if (result.sent_count > 0) {
          toast.success(`Letter sent to ${recipientName} via Royal Mail`)
        } else {
          toast.error("Letter failed — check address data")
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send")
    } finally {
      setSending(false)
    }
  }

  // Trigger button variants
  const triggerButton = variant === "icon" ? (
    <Button variant="outline" size="sm" className={`gap-1.5 ${className}`} onClick={() => setOpen(true)}>
      <Send className="h-3.5 w-3.5" />
    </Button>
  ) : variant === "compact" ? (
    <button onClick={() => setOpen(true)} className={`flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium ${className}`}>
      <Send className="h-3 w-3" /> Contact Owner
    </button>
  ) : (
    <Button variant="outline" className={`gap-1.5 border-teal-200 text-teal-700 hover:bg-teal-50 ${className}`} onClick={() => setOpen(true)}>
      <Send className="h-4 w-4" /> Contact Owner
    </Button>
  )

  return (
    <>
      {triggerButton}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-teal-600" />
              Contact Owner
            </DialogTitle>
            <DialogDescription>
              Personalised outreach powered by HMO Hunter property intelligence.
            </DialogDescription>
          </DialogHeader>

          {sent ? (
            <div className="py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-lg font-medium">
                {channel === "email" ? "Email Ready!" : "Letter Sent!"}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {channel === "email"
                  ? `Your email client opened with a pre-filled message to ${recipientEmail}`
                  : `Letter posted to ${property.address}, ${property.postcode} via Royal Mail`}
              </p>
              {enableFollowUps && scenarioConfig.followUpDays.length > 0 && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                  <Clock className="h-4 w-4 inline mr-1" />
                  Follow-ups scheduled: {scenarioConfig.followUpDays.map(d => `${d} days`).join(", ")}
                </div>
              )}
              <p className="text-xs text-slate-400 mt-3">Reference: {mergeData.reference_code}</p>
              <Button className="mt-4" onClick={() => { setOpen(false); setSent(false) }}>Done</Button>
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              {/* Recipient card */}
              <div className="rounded-lg bg-slate-50 border p-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{recipientName}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      {property.address}, {property.postcode}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    {hasEmail && (
                      <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700">
                        <Mail className="h-2.5 w-2.5 mr-0.5" /> Email
                      </Badge>
                    )}
                    <Badge variant="outline" className={`text-[10px] ${
                      addressValidation.confidence === "high" ? "bg-green-50 text-green-700" :
                      addressValidation.confidence === "medium" ? "bg-amber-50 text-amber-700" :
                      "bg-red-50 text-red-700"
                    }`}>
                      <ShieldCheck className="h-2.5 w-2.5 mr-0.5" />
                      Address: {addressValidation.confidence}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Address validation warnings */}
              {channel === "letter" && addressValidation.issues.length > 0 && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-xs">Address issues:</p>
                    {addressValidation.issues.map((issue, i) => (
                      <p key={i} className="text-xs">{issue}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Scenario selector — auto-detected with override */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-500">Scenario</label>
                  <div className="flex items-center gap-1 text-[10px] text-teal-600">
                    <Sparkles className="h-3 w-3" />
                    Auto-detected from property data
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.values(SCENARIO_TEMPLATES).map(s => (
                    <button
                      key={s.id}
                      onClick={() => handleScenarioChange(s.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        selectedScenario === s.id
                          ? "bg-teal-600 text-white shadow-sm"
                          : `${s.color} hover:opacity-80`
                      }`}
                    >
                      {s.label}
                      {s.id === detectedScenario && (
                        <span className="ml-1 opacity-70">*</span>
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{scenarioConfig.description}</p>
              </div>

              {/* Your letterhead — inline logo upload + details */}
              <div className="rounded-lg border bg-white p-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-500">Your Letterhead</label>
                  <button
                    onClick={() => setShowProfileEditor(true)}
                    className="text-[10px] text-teal-600 hover:underline"
                  >
                    Edit all details
                  </button>
                </div>
                <div className="flex items-start gap-3">
                  {/* Logo upload area */}
                  <div className="flex-shrink-0">
                    {senderProfile?.logoUrl ? (
                      <div className="relative group">
                        <img
                          src={senderProfile.logoUrl}
                          alt="Your logo"
                          className="h-14 w-auto max-w-[140px] object-contain rounded border bg-slate-50 p-1"
                        />
                        <button
                          onClick={() => logoInputRef.current?.click()}
                          className="absolute inset-0 bg-black/40 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px]"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => logoInputRef.current?.click()}
                        className="w-[140px] h-14 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center gap-0.5 text-slate-400 hover:border-teal-300 hover:text-teal-500 transition-colors"
                      >
                        <ImagePlus className="h-5 w-5" />
                        <span className="text-[10px]">Upload Logo</span>
                      </button>
                    )}
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        if (file.size > 2 * 1024 * 1024) {
                          toast.error("Logo must be under 2MB")
                          return
                        }
                        const reader = new FileReader()
                        reader.onload = async () => {
                          const url = reader.result as string
                          const updated = { ...(senderProfile || { name: "", company: "", phone: "", email: "", address: "", website: "", logoUrl: null }), logoUrl: url }
                          setSenderProfile(updated)
                          await saveSenderProfile(updated)
                          toast.success("Logo saved")
                        }
                        reader.readAsDataURL(file)
                      }}
                    />
                  </div>

                  {/* Sender details summary */}
                  <div className="flex-1 text-xs text-slate-600 leading-relaxed">
                    {senderProfile?.name ? (
                      <>
                        <p className="font-semibold">{senderProfile.name}</p>
                        {senderProfile.company && <p>{senderProfile.company}</p>}
                        {senderProfile.phone && <p>{senderProfile.phone}</p>}
                        {senderProfile.email && <p className="text-teal-600">{senderProfile.email}</p>}
                      </>
                    ) : (
                      <p className="text-slate-400 italic">
                        Add your name and details via "Edit all details" — they'll appear on your letters.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Channel selection */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Channel</label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleChannelChange("email")}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        channel === "email" ? "bg-teal-600 text-white" : "bg-white border text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Mail className="h-4 w-4" /> Email
                      <span className="text-[10px] opacity-70">(free)</span>
                    </button>
                    <button
                      onClick={() => handleChannelChange("letter")}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        channel === "letter" ? "bg-teal-600 text-white" : "bg-white border text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <FileText className="h-4 w-4" /> Post Letter
                      <span className="text-[10px] opacity-70">(3 cr)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Subject (email only) */}
              {channel === "email" && (
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Subject</label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
              )}

              {/* Message body with edit/preview */}
              <Tabs defaultValue="edit" className="w-full">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-500">Message</label>
                  <TabsList className="h-7">
                    <TabsTrigger value="edit" className="text-xs h-6 px-2">Edit</TabsTrigger>
                    <TabsTrigger value="preview" className="text-xs h-6 px-2">
                      <Eye className="h-3 w-3 mr-1" /> Preview
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="edit" className="mt-0">
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={12}
                    className="font-mono text-xs leading-relaxed"
                  />
                </TabsContent>

                <TabsContent value="preview" className="mt-0">
                  <div className={`border rounded-lg min-h-[300px] ${
                    channel === "letter"
                      ? "bg-white p-8 shadow-inner font-serif text-sm leading-relaxed"
                      : "bg-white p-4"
                  }`}>
                    {channel === "email" && (
                      <div className="mb-3 pb-3 border-b text-xs text-slate-400">
                        <p>To: {recipientEmail || "—"}</p>
                        <p>Subject: {mergedSubject}</p>
                      </div>
                    )}
                    {channel === "letter" && (
                      <div className="mb-6 flex items-start justify-between">
                        {senderProfile?.logoUrl ? (
                          <img src={senderProfile.logoUrl} alt="Logo" className="h-12 w-auto object-contain" />
                        ) : (
                          <div />
                        )}
                        <div className="text-right text-xs text-slate-500 leading-relaxed">
                          {senderProfile?.name && <p className="font-semibold">{senderProfile.name}</p>}
                          {senderProfile?.company && <p>{senderProfile.company}</p>}
                          {senderProfile?.address && <p>{senderProfile.address}</p>}
                          {senderProfile?.phone && <p>{senderProfile.phone}</p>}
                          {senderProfile?.email && <p>{senderProfile.email}</p>}
                          <p className="mt-2 text-slate-400">{mergeData.date}</p>
                        </div>
                      </div>
                    )}
                    <div className={`whitespace-pre-wrap ${
                      channel === "letter" ? "text-sm leading-[1.8]" : "text-sm leading-relaxed"
                    }`}>
                      {mergedBody}
                    </div>
                    {channel === "letter" && (
                      <div className="mt-6 pt-4 border-t text-[10px] text-slate-300">
                        Ref: {mergeData.reference_code} · Sent via HMO Hunter
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              {/* Follow-up sequence toggle */}
              <div className="flex items-center justify-between px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-xs font-medium text-blue-800">Automatic follow-ups</p>
                    <p className="text-[10px] text-blue-600">
                      {scenarioConfig.followUpDays.length} follow-up{scenarioConfig.followUpDays.length > 1 ? "s" : ""}: after {scenarioConfig.followUpDays.join(" & ")} days
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEnableFollowUps(!enableFollowUps)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    enableFollowUps ? "bg-blue-600 text-white" : "bg-white text-blue-600 border border-blue-300"
                  }`}
                >
                  {enableFollowUps ? "On" : "Off"}
                </button>
              </div>

              {/* Send */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="text-xs text-slate-500">
                  {channel === "email" ? "Free — opens your email client" : "3 credits — posted via Royal Mail"}
                  <span className="ml-2 text-slate-400">Ref: {mergeData.reference_code}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button
                    onClick={handleSend}
                    disabled={!canSend || sending}
                    className="bg-teal-600 hover:bg-teal-700 gap-1.5"
                  >
                    {sending ? "..." : channel === "email" ? (
                      <><Mail className="h-4 w-4" /> Open in Email</>
                    ) : (
                      <><Send className="h-4 w-4" /> Send Letter</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <SenderProfileEditor
        open={showProfileEditor}
        onClose={() => setShowProfileEditor(false)}
        onSave={(p) => setSenderProfile(p)}
        initialProfile={senderProfile || undefined}
      />
    </>
  )
}
