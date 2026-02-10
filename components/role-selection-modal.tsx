"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { Home, Building2, Users, Briefcase } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export type UserType = "investor" | "council_ta" | "operator" | "agent"

interface RoleSelectionModalProps {
  isOpen: boolean
  onComplete: (userType: UserType) => void
  currentRole?: UserType | null
  onClose?: () => void
}

export const roles: { id: UserType; icon: typeof Home; label: string; description: string; hint: string; color: string; selectedColor: string }[] = [
  {
    id: "investor",
    icon: Home,
    label: "Property Investor",
    description: "Buy properties to convert or operate as HMOs",
    hint: "Purchase listings, yield & cashflow analysis",
    color: "border-slate-200 hover:border-blue-300 hover:bg-blue-50",
    selectedColor: "border-blue-500 bg-blue-50 ring-2 ring-blue-200",
  },
  {
    id: "council_ta",
    icon: Building2,
    label: "Council / TA Officer",
    description: "Source properties for temporary accommodation placements",
    hint: "Rent listings, LHA rates & TA suitability filters",
    color: "border-slate-200 hover:border-teal-300 hover:bg-teal-50",
    selectedColor: "border-teal-500 bg-teal-50 ring-2 ring-teal-200",
  },
  {
    id: "operator",
    icon: Users,
    label: "Property Manager",
    description: "Manage HMO portfolios and lettings",
    hint: "Purchase listings, licence tracking & compliance",
    color: "border-slate-200 hover:border-purple-300 hover:bg-purple-50",
    selectedColor: "border-purple-500 bg-purple-50 ring-2 ring-purple-200",
  },
  {
    id: "agent",
    icon: Briefcase,
    label: "Agent / Other",
    description: "Estate agent, letting agent, sourcing agent, or other",
    hint: "Purchase listings, deal scoring & comparisons",
    color: "border-slate-200 hover:border-slate-400 hover:bg-slate-50",
    selectedColor: "border-slate-500 bg-slate-50 ring-2 ring-slate-200",
  },
]

export function RoleSelectionModal({ isOpen, onComplete, currentRole, onClose }: RoleSelectionModalProps) {
  const isEditing = !!currentRole
  const [selectedRole, setSelectedRole] = useState<UserType | null>(currentRole ?? null)
  const [saving, setSaving] = useState(false)

  // Sync selectedRole when currentRole changes (e.g. modal re-opened)
  const [prevCurrentRole, setPrevCurrentRole] = useState(currentRole)
  if (currentRole !== prevCurrentRole) {
    setPrevCurrentRole(currentRole)
    setSelectedRole(currentRole ?? null)
  }

  const handleConfirm = async () => {
    if (!selectedRole) return
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        data: { user_type: selectedRole },
      })
      if (error) throw error
      setSaving(false)
      onComplete(selectedRole)
    } catch (error) {
      console.error("[RoleSelection] Error saving user type:", error)
      toast.error("Failed to save your role. Please try again.")
      setSaving(false)
      return
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && isEditing) onClose?.() }}>
      <DialogContent className="sm:max-w-[480px] max-h-[calc(100dvh-2rem)] overflow-y-auto" onPointerDownOutside={(e) => { if (!isEditing) e.preventDefault() }}>
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">
            {isEditing ? "Change Your Role" : "Welcome to HMO Hunter"}
          </DialogTitle>
          <DialogDescription className="text-center text-slate-500">
            {isEditing
              ? "Select a different role to update how the platform works for you."
              : "How will you use the platform? This helps us show the most relevant features first."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          {roles.map((role) => {
            const Icon = role.icon
            const isSelected = selectedRole === role.id
            return (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role.id)}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all cursor-pointer text-center",
                  isSelected ? role.selectedColor : role.color
                )}
              >
                <Icon className={cn("w-8 h-8", isSelected ? "text-slate-900" : "text-slate-400")} />
                <span className="text-sm font-semibold text-slate-900">{role.label}</span>
                <span className="text-xs text-slate-500 leading-tight">{role.description}</span>
                <span className="text-[10px] text-slate-400 leading-tight mt-1">{role.hint}</span>
              </button>
            )
          })}
        </div>

        <Button
          onClick={handleConfirm}
          disabled={!selectedRole || saving}
          className="w-full mt-4"
          size="lg"
        >
          {saving ? "Saving..." : isEditing ? "Save Changes" : "Continue"}
        </Button>

        {!isEditing && (
          <p className="text-xs text-slate-400 text-center">
            You can change this later in your profile settings.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
