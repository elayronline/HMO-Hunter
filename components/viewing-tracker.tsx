"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
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
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import {
  Calendar,
  Clock,
  MapPin,
  Star,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
} from "lucide-react"
import type { UserType } from "@/components/role-selection-modal"
import type { PropertyViewing, ViewingType, ViewingStatus } from "@/lib/types/pipeline"
import { VIEWING_CHECKLISTS } from "@/lib/types/pipeline"

interface ViewingTrackerProps {
  userType: UserType
}

const VIEWING_TYPE_LABELS: Record<ViewingType, string> = {
  site_visit: "Site Visit",
  inspection: "Inspection",
  portfolio_check: "Portfolio Check",
  client_viewing: "Client Viewing",
}

const STATUS_CONFIG: Record<ViewingStatus, { label: string; icon: typeof CheckCircle; color: string }> = {
  scheduled: { label: "Scheduled", icon: Clock, color: "text-blue-500" },
  confirmed: { label: "Confirmed", icon: CheckCircle, color: "text-green-500" },
  completed: { label: "Completed", icon: CheckCircle, color: "text-emerald-600" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "text-red-500" },
  no_show: { label: "No Show", icon: AlertCircle, color: "text-amber-500" },
}

export function ViewingTracker({ userType }: ViewingTrackerProps) {
  const [viewings, setViewings] = useState<PropertyViewing[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("upcoming")
  const [selectedViewing, setSelectedViewing] = useState<PropertyViewing | null>(null)
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)

  // Complete form
  const [rating, setRating] = useState(0)
  const [completionNotes, setCompletionNotes] = useState("")
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})

  const fetchViewings = useCallback(async (upcoming = true) => {
    try {
      const params = upcoming ? "?upcoming=true" : ""
      const res = await fetch(`/api/viewings${params}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setViewings(data)
    } catch {
      toast.error("Failed to load viewings")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchViewings(activeTab === "upcoming")
  }, [fetchViewings, activeTab])

  const updateViewingStatus = async (id: string, status: ViewingStatus) => {
    try {
      const res = await fetch("/api/viewings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      })
      if (!res.ok) throw new Error("Failed to update")
      const updated = await res.json()
      setViewings(prev => prev.map(v => v.id === id ? updated : v))
      toast.success(`Viewing ${status}`)
    } catch {
      toast.error("Failed to update viewing")
    }
  }

  const completeViewing = async () => {
    if (!selectedViewing) return

    try {
      const res = await fetch("/api/viewings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedViewing.id,
          status: "completed",
          rating: rating || undefined,
          notes: completionNotes || selectedViewing.notes,
          checklist,
          completed_at: new Date().toISOString(),
        }),
      })
      if (!res.ok) throw new Error("Failed to complete")
      const updated = await res.json()
      setViewings(prev => prev.map(v => v.id === selectedViewing.id ? updated : v))
      setShowCompleteDialog(false)
      setSelectedViewing(null)
      toast.success("Viewing completed!")
    } catch {
      toast.error("Failed to complete viewing")
    }
  }

  const openCompleteDialog = (viewing: PropertyViewing) => {
    setSelectedViewing(viewing)
    setRating(viewing.rating || 0)
    setCompletionNotes(viewing.notes || "")
    // Init checklist from ICP defaults
    const defaultChecklist: Record<string, boolean> = {}
    VIEWING_CHECKLISTS[userType]?.forEach(item => {
      defaultChecklist[item.key] = (viewing.checklist as Record<string, boolean>)?.[item.key] || false
    })
    setChecklist(defaultChecklist)
    setShowCompleteDialog(true)
  }

  const deleteViewing = async (id: string) => {
    try {
      const res = await fetch(`/api/viewings?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      setViewings(prev => prev.filter(v => v.id !== id))
      toast.success("Viewing deleted")
    } catch {
      toast.error("Failed to delete viewing")
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const isOverdue = (viewing: PropertyViewing) => {
    return (
      ["scheduled", "confirmed"].includes(viewing.status) &&
      new Date(viewing.scheduled_at) < new Date()
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-400">Loading viewings...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Viewings</h2>
        <div className="flex gap-2 text-sm text-slate-500">
          <Badge variant="outline">
            {viewings.filter(v => v.status === "scheduled" || v.status === "confirmed").length} upcoming
          </Badge>
          <Badge variant="outline">
            {viewings.filter(v => v.status === "completed").length} completed
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="all">All Viewings</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-3">
          {viewings.filter(v => ["scheduled", "confirmed"].includes(v.status)).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-slate-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p className="text-lg font-medium">No upcoming viewings</p>
                <p className="text-sm mt-1">
                  Schedule viewings from the property detail page or pipeline.
                </p>
              </CardContent>
            </Card>
          ) : (
            viewings
              .filter(v => ["scheduled", "confirmed"].includes(v.status))
              .map(viewing => (
                <ViewingCard
                  key={viewing.id}
                  viewing={viewing}
                  isOverdue={isOverdue(viewing)}
                  formatDate={formatDate}
                  onConfirm={() => updateViewingStatus(viewing.id, "confirmed")}
                  onCancel={() => updateViewingStatus(viewing.id, "cancelled")}
                  onComplete={() => openCompleteDialog(viewing)}
                  onNoShow={() => updateViewingStatus(viewing.id, "no_show")}
                  onDelete={() => deleteViewing(viewing.id)}
                />
              ))
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-3">
          {viewings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-slate-500">
                <p>No viewings recorded</p>
              </CardContent>
            </Card>
          ) : (
            viewings.map(viewing => (
              <ViewingCard
                key={viewing.id}
                viewing={viewing}
                isOverdue={isOverdue(viewing)}
                formatDate={formatDate}
                onConfirm={() => updateViewingStatus(viewing.id, "confirmed")}
                onCancel={() => updateViewingStatus(viewing.id, "cancelled")}
                onComplete={() => openCompleteDialog(viewing)}
                onNoShow={() => updateViewingStatus(viewing.id, "no_show")}
                onDelete={() => deleteViewing(viewing.id)}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Complete Viewing Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complete Viewing</DialogTitle>
            <DialogDescription>
              {selectedViewing?.property?.address}, {selectedViewing?.property?.postcode}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Star Rating */}
            <div>
              <label className="text-sm font-medium">Rating</label>
              <div className="flex gap-1 mt-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="focus:outline-none"
                  >
                    <Star
                      className={`h-8 w-8 transition-colors ${
                        star <= rating
                          ? "text-amber-400 fill-amber-400"
                          : "text-slate-200"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* ICP-specific checklist */}
            <div>
              <label className="text-sm font-medium">
                {userType === "council_ta" ? "Inspection Checklist"
                  : userType === "operator" ? "Compliance Checklist"
                  : userType === "agent" ? "Viewing Checklist"
                  : "Property Checklist"}
              </label>
              <div className="space-y-2 mt-2">
                {VIEWING_CHECKLISTS[userType]?.map(item => (
                  <div key={item.key} className="flex items-center gap-2">
                    <Checkbox
                      checked={checklist[item.key] || false}
                      onCheckedChange={(checked) =>
                        setChecklist(prev => ({ ...prev, [item.key]: !!checked }))
                      }
                    />
                    <span className="text-sm">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="Add your viewing notes..."
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
                Cancel
              </Button>
              <Button onClick={completeViewing}>
                <CheckCircle className="h-4 w-4 mr-1" /> Mark Complete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Individual viewing card component
function ViewingCard({
  viewing,
  isOverdue,
  formatDate,
  onConfirm,
  onCancel,
  onComplete,
  onNoShow,
  onDelete,
}: {
  viewing: PropertyViewing
  isOverdue: boolean
  formatDate: (date: string) => string
  onConfirm: () => void
  onCancel: () => void
  onComplete: () => void
  onNoShow: () => void
  onDelete: () => void
}) {
  const statusCfg = STATUS_CONFIG[viewing.status]
  const StatusIcon = statusCfg.icon

  return (
    <Card className={isOverdue ? "border-amber-300 bg-amber-50/50" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <StatusIcon className={`h-4 w-4 ${statusCfg.color}`} />
              <span className="text-sm font-medium truncate">
                {viewing.property?.address || "Unknown property"}
              </span>
              {isOverdue && (
                <Badge variant="destructive" className="text-[10px]">
                  Overdue
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {viewing.property?.postcode}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(viewing.scheduled_at)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {viewing.duration_minutes}min
              </span>
              <Badge variant="outline" className="text-[10px]">
                {VIEWING_TYPE_LABELS[viewing.viewing_type]}
              </Badge>
            </div>

            {viewing.contact_name && (
              <p className="text-xs text-slate-500 mt-1">
                Contact: {viewing.contact_name}
                {viewing.contact_phone && ` (${viewing.contact_phone})`}
              </p>
            )}

            {viewing.rating && (
              <div className="flex items-center gap-0.5 mt-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star
                    key={star}
                    className={`h-3.5 w-3.5 ${
                      star <= viewing.rating!
                        ? "text-amber-400 fill-amber-400"
                        : "text-slate-200"
                    }`}
                  />
                ))}
              </div>
            )}

            {viewing.notes && (
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                {viewing.notes}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            {viewing.status === "scheduled" && (
              <>
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={onConfirm}>
                  Confirm
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={onComplete}>
                  Complete
                </Button>
                <Button variant="ghost" size="sm" className="text-xs h-7 text-red-600" onClick={onCancel}>
                  Cancel
                </Button>
              </>
            )}
            {viewing.status === "confirmed" && (
              <>
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={onComplete}>
                  Complete
                </Button>
                <Button variant="ghost" size="sm" className="text-xs h-7 text-amber-600" onClick={onNoShow}>
                  No Show
                </Button>
              </>
            )}
            {["completed", "cancelled", "no_show"].includes(viewing.status) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => window.open(`/property/${viewing.property_id}`, "_blank")}
              >
                <Eye className="h-3 w-3 mr-1" /> View
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
