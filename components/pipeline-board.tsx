"use client"

import { useState, useEffect, useCallback } from "react"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  useSensor,
  useSensors,
  PointerSensor,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import { useSortable } from "@dnd-kit/sortable"
import { useDroppable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import {
  ArrowRight,
  Archive,
  Trash2,
  MoreVertical,
  Plus,
  Star,
  GripVertical,
  Eye,
  Mail,
  Calendar,
} from "lucide-react"
import type { UserType } from "@/components/role-selection-modal"
import type { PipelineDeal, PipelineStageConfig } from "@/lib/types/pipeline"

interface PipelineBoardProps {
  userType: UserType
}

// Default stage configs (used before DB fetch)
const DEFAULT_STAGES: Record<UserType, PipelineStageConfig[]> = {
  investor: [
    { id: "1", user_type: "investor", stage_key: "identified", stage_label: "Identified", stage_order: 1, color: "#94a3b8", is_terminal: false },
    { id: "2", user_type: "investor", stage_key: "researched", stage_label: "Researched", stage_order: 2, color: "#60a5fa", is_terminal: false },
    { id: "3", user_type: "investor", stage_key: "contacted", stage_label: "Contacted", stage_order: 3, color: "#a78bfa", is_terminal: false },
    { id: "4", user_type: "investor", stage_key: "viewing", stage_label: "Viewing", stage_order: 4, color: "#fbbf24", is_terminal: false },
    { id: "5", user_type: "investor", stage_key: "offer_made", stage_label: "Offer Made", stage_order: 5, color: "#f97316", is_terminal: false },
    { id: "6", user_type: "investor", stage_key: "under_offer", stage_label: "Under Offer", stage_order: 6, color: "#22d3ee", is_terminal: false },
    { id: "7", user_type: "investor", stage_key: "completed", stage_label: "Completed", stage_order: 7, color: "#22c55e", is_terminal: true },
    { id: "8", user_type: "investor", stage_key: "dead", stage_label: "Dead", stage_order: 8, color: "#ef4444", is_terminal: true },
  ],
  council_ta: [
    { id: "1", user_type: "council_ta", stage_key: "identified", stage_label: "Identified", stage_order: 1, color: "#94a3b8", is_terminal: false },
    { id: "2", user_type: "council_ta", stage_key: "assessed", stage_label: "Assessed", stage_order: 2, color: "#60a5fa", is_terminal: false },
    { id: "3", user_type: "council_ta", stage_key: "shortlisted", stage_label: "Shortlisted", stage_order: 3, color: "#a78bfa", is_terminal: false },
    { id: "4", user_type: "council_ta", stage_key: "inspection", stage_label: "Inspection", stage_order: 4, color: "#fbbf24", is_terminal: false },
    { id: "5", user_type: "council_ta", stage_key: "placement_ready", stage_label: "Placement Ready", stage_order: 5, color: "#22d3ee", is_terminal: false },
    { id: "6", user_type: "council_ta", stage_key: "placed", stage_label: "Placed", stage_order: 6, color: "#22c55e", is_terminal: true },
    { id: "7", user_type: "council_ta", stage_key: "rejected", stage_label: "Rejected", stage_order: 7, color: "#ef4444", is_terminal: true },
  ],
  operator: [
    { id: "1", user_type: "operator", stage_key: "identified", stage_label: "Identified", stage_order: 1, color: "#94a3b8", is_terminal: false },
    { id: "2", user_type: "operator", stage_key: "compliance_check", stage_label: "Compliance Check", stage_order: 2, color: "#60a5fa", is_terminal: false },
    { id: "3", user_type: "operator", stage_key: "renewal_due", stage_label: "Renewal Due", stage_order: 3, color: "#fbbf24", is_terminal: false },
    { id: "4", user_type: "operator", stage_key: "in_progress", stage_label: "In Progress", stage_order: 4, color: "#a78bfa", is_terminal: false },
    { id: "5", user_type: "operator", stage_key: "compliant", stage_label: "Compliant", stage_order: 5, color: "#22c55e", is_terminal: true },
    { id: "6", user_type: "operator", stage_key: "non_compliant", stage_label: "Non-Compliant", stage_order: 6, color: "#ef4444", is_terminal: true },
  ],
  agent: [
    { id: "1", user_type: "agent", stage_key: "sourced", stage_label: "Sourced", stage_order: 1, color: "#94a3b8", is_terminal: false },
    { id: "2", user_type: "agent", stage_key: "packaged", stage_label: "Packaged", stage_order: 2, color: "#60a5fa", is_terminal: false },
    { id: "3", user_type: "agent", stage_key: "presented", stage_label: "Presented", stage_order: 3, color: "#a78bfa", is_terminal: false },
    { id: "4", user_type: "agent", stage_key: "client_viewing", stage_label: "Client Viewing", stage_order: 4, color: "#fbbf24", is_terminal: false },
    { id: "5", user_type: "agent", stage_key: "offer", stage_label: "Offer", stage_order: 5, color: "#f97316", is_terminal: false },
    { id: "6", user_type: "agent", stage_key: "exchanged", stage_label: "Exchanged", stage_order: 6, color: "#22c55e", is_terminal: true },
    { id: "7", user_type: "agent", stage_key: "fallen_through", stage_label: "Fallen Through", stage_order: 7, color: "#ef4444", is_terminal: true },
  ],
}

const PRIORITY_LABELS = ["None", "Low", "Medium", "High"] as const
const PRIORITY_COLORS = ["text-slate-400", "text-blue-500", "text-amber-500", "text-red-500"]

export function PipelineBoard({ userType }: PipelineBoardProps) {
  const [deals, setDeals] = useState<PipelineDeal[]>([])
  const [stages] = useState<PipelineStageConfig[]>(DEFAULT_STAGES[userType] || DEFAULT_STAGES.investor)
  const [loading, setLoading] = useState(true)
  const [editingDeal, setEditingDeal] = useState<PipelineDeal | null>(null)
  const [editNotes, setEditNotes] = useState("")
  const [editLabel, setEditLabel] = useState("")
  const [editPriority, setEditPriority] = useState(0)
  const [editValue, setEditValue] = useState("")

  const fetchDeals = useCallback(async () => {
    try {
      const res = await fetch("/api/pipeline")
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setDeals(data)
    } catch {
      toast.error("Failed to load pipeline")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDeals()
  }, [fetchDeals])

  const moveDeal = async (dealId: string, newStage: string) => {
    try {
      const res = await fetch("/api/pipeline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: dealId, stage: newStage }),
      })
      if (!res.ok) throw new Error("Failed to move deal")
      const updated = await res.json()
      setDeals(prev => prev.map(d => d.id === dealId ? updated : d))
      toast.success(`Moved to ${stages.find(s => s.stage_key === newStage)?.stage_label}`)
    } catch {
      toast.error("Failed to move deal")
    }
  }

  const archiveDeal = async (dealId: string) => {
    try {
      const res = await fetch("/api/pipeline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: dealId, archived_at: new Date().toISOString() }),
      })
      if (!res.ok) throw new Error("Failed to archive")
      setDeals(prev => prev.filter(d => d.id !== dealId))
      toast.success("Deal archived")
    } catch {
      toast.error("Failed to archive deal")
    }
  }

  const deleteDeal = async (dealId: string) => {
    try {
      const res = await fetch(`/api/pipeline?id=${dealId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      setDeals(prev => prev.filter(d => d.id !== dealId))
      toast.success("Deal removed")
    } catch {
      toast.error("Failed to delete deal")
    }
  }

  const saveEdits = async () => {
    if (!editingDeal) return
    try {
      const res = await fetch("/api/pipeline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingDeal.id,
          notes: editNotes || null,
          label: editLabel || null,
          priority: editPriority,
          expected_value: editValue ? parseFloat(editValue) : null,
        }),
      })
      if (!res.ok) throw new Error("Failed to update")
      const updated = await res.json()
      setDeals(prev => prev.map(d => d.id === editingDeal.id ? updated : d))
      setEditingDeal(null)
      toast.success("Deal updated")
    } catch {
      toast.error("Failed to update deal")
    }
  }

  const openEditDialog = (deal: PipelineDeal) => {
    setEditingDeal(deal)
    setEditNotes(deal.notes || "")
    setEditLabel(deal.label || "")
    setEditPriority(deal.priority)
    setEditValue(deal.expected_value?.toString() || "")
  }

  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragId(null)
    const { active, over } = event
    if (!over) return

    const dealId = active.id as string
    const targetStage = over.id as string

    // Find the deal and check if stage actually changed
    const deal = deals.find(d => d.id === dealId)
    if (!deal || deal.stage === targetStage) return

    // Optimistic update
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: targetStage } : d))

    // Persist to server
    try {
      const res = await fetch("/api/pipeline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: dealId, stage: targetStage }),
      })
      if (!res.ok) throw new Error("Failed")
      const updated = await res.json()
      setDeals(prev => prev.map(d => d.id === dealId ? updated : d))
      toast.success(`Moved to ${stages.find(s => s.stage_key === targetStage)?.stage_label}`)
    } catch {
      // Revert optimistic update
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: deal.stage } : d))
      toast.error("Failed to move deal")
    }
  }

  const activeDeal = activeDragId ? deals.find(d => d.id === activeDragId) : null

  const activeStages = stages.filter(s => !s.is_terminal)
  const terminalStages = stages.filter(s => s.is_terminal)

  const getDealsByStage = (stageKey: string) =>
    deals.filter(d => d.stage === stageKey)

  const totalValue = deals
    .filter(d => !stages.find(s => s.stage_key === d.stage)?.is_terminal)
    .reduce((sum, d) => sum + (d.expected_value || 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-400">Loading pipeline...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">Deal Pipeline</h2>
          <Badge variant="secondary">{deals.length} deals</Badge>
          {totalValue > 0 && (
            <Badge variant="outline" className="font-mono">
              Pipeline value: £{totalValue.toLocaleString("en-GB")}
            </Badge>
          )}
        </div>
      </div>

      {/* Kanban columns — drag & drop enabled */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {activeStages.map(stage => {
          const stageDeals = getDealsByStage(stage.stage_key)
          return (
            <DroppableColumn
              key={stage.stage_key}
              id={stage.stage_key}
              isOver={false}
            >
              <div className="mb-2 flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
                <span className="text-sm font-medium text-slate-700">
                  {stage.stage_label}
                </span>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {stageDeals.length}
                </Badge>
              </div>

              <div className="space-y-2 min-h-[100px] bg-slate-50 rounded-lg p-2">
                {stageDeals.map(deal => (
                  <DraggableCard key={deal.id} id={deal.id}>
                  <Card className="cursor-grab hover:shadow-md transition-shadow active:cursor-grabbing">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {deal.property?.address || "Unknown property"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {deal.property?.postcode} · {deal.property?.city}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(deal)}>
                              <GripVertical className="h-4 w-4 mr-2" /> Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => window.open(`/property/${deal.property_id}`, "_blank")}>
                              <Eye className="h-4 w-4 mr-2" /> View Property
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => archiveDeal(deal.id)}>
                              <Archive className="h-4 w-4 mr-2" /> Archive
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => deleteDeal(deal.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Property quick info */}
                      <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                        {deal.property?.bedrooms && (
                          <span>{deal.property.bedrooms} bed</span>
                        )}
                        {deal.property?.deal_score && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            Score: {deal.property.deal_score}
                          </Badge>
                        )}
                        {deal.property?.epc_rating && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            EPC {deal.property.epc_rating}
                          </Badge>
                        )}
                      </div>

                      {/* Deal metadata */}
                      <div className="flex items-center gap-2 mt-2">
                        {deal.priority > 0 && (
                          <Star className={`h-3.5 w-3.5 ${PRIORITY_COLORS[deal.priority]} fill-current`} />
                        )}
                        {deal.label && (
                          <Badge variant="secondary" className="text-[10px]">
                            {deal.label}
                          </Badge>
                        )}
                        {deal.expected_value && (
                          <span className="text-[10px] font-mono text-slate-500 ml-auto">
                            £{deal.expected_value.toLocaleString("en-GB")}
                          </span>
                        )}
                      </div>

                      {/* Stage navigation */}
                      <div className="flex items-center gap-1 mt-2 pt-2 border-t">
                        {stages
                          .filter(s => s.stage_order === stage.stage_order + 1 || (s.is_terminal))
                          .slice(0, 3)
                          .map(nextStage => (
                            <Button
                              key={nextStage.stage_key}
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] px-1.5"
                              onClick={(e) => {
                                e.stopPropagation()
                                moveDeal(deal.id, nextStage.stage_key)
                              }}
                            >
                              <ArrowRight className="h-3 w-3 mr-0.5" />
                              {nextStage.stage_label}
                            </Button>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                  </DraggableCard>
                ))}

                {stageDeals.length === 0 && (
                  <div className="flex items-center justify-center h-20 text-xs text-slate-400">
                    No deals
                  </div>
                )}
              </div>
            </DroppableColumn>
          )
        })}

        {/* Terminal stages — also droppable */}
        <div className="flex-shrink-0 w-[200px]">
          {terminalStages.map(stage => {
            const stageDeals = getDealsByStage(stage.stage_key)
            return (
              <div key={stage.stage_key} className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  <span className="text-xs font-medium text-slate-500">
                    {stage.stage_label}
                  </span>
                  <Badge variant="secondary" className="ml-auto text-[10px]">
                    {stageDeals.length}
                  </Badge>
                </div>
                {stageDeals.slice(0, 2).map(deal => (
                  <div
                    key={deal.id}
                    className="text-xs text-slate-500 truncate pl-5"
                  >
                    {deal.property?.address}
                  </div>
                ))}
                {stageDeals.length > 2 && (
                  <div className="text-[10px] text-slate-400 pl-5">
                    +{stageDeals.length - 2} more
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Drag overlay — ghost card that follows cursor */}
      <DragOverlay>
        {activeDeal ? (
          <Card className="w-[260px] shadow-xl opacity-90 rotate-2">
            <CardContent className="p-3">
              <p className="text-sm font-medium truncate">{activeDeal.property?.address}</p>
              <p className="text-xs text-slate-500">{activeDeal.property?.postcode}</p>
            </CardContent>
          </Card>
        ) : null}
      </DragOverlay>
      </DndContext>

      {/* Edit dialog */}
      <Dialog open={!!editingDeal} onOpenChange={(open) => !open && setEditingDeal(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Deal</DialogTitle>
            <DialogDescription>
              {editingDeal?.property?.address}, {editingDeal?.property?.postcode}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">Label</label>
              <Input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder="e.g., Hot lead, Follow up"
                maxLength={50}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Priority</label>
              <Select
                value={String(editPriority)}
                onValueChange={(v) => setEditPriority(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_LABELS.map((label, i) => (
                    <SelectItem key={i} value={String(i)}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Expected Value (£)</label>
              <Input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="e.g., 250000"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add notes about this deal..."
                rows={4}
                maxLength={2000}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingDeal(null)}>
                Cancel
              </Button>
              <Button onClick={saveEdits}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Droppable column wrapper
function DroppableColumn({ id, children, isOver }: { id: string; children: React.ReactNode; isOver: boolean }) {
  const { setNodeRef, isOver: isDragOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-[280px] transition-colors ${isDragOver ? "ring-2 ring-teal-400 rounded-lg" : ""}`}
    >
      {children}
    </div>
  )
}

// Draggable card wrapper
function DraggableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  )
}
