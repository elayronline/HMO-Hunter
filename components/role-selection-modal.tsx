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

export type UserType = "investor" | "council_ta" | "operator" | "agent"

interface RoleSelectionModalProps {
  isOpen: boolean
  onComplete: (userType: UserType) => void
}

const roles: { id: UserType; icon: typeof Home; label: string; description: string; color: string; selectedColor: string }[] = [
  {
    id: "investor",
    icon: Home,
    label: "Property Investor",
    description: "Buy properties to convert or operate as HMOs",
    color: "border-slate-200 hover:border-blue-300 hover:bg-blue-50",
    selectedColor: "border-blue-500 bg-blue-50 ring-2 ring-blue-200",
  },
  {
    id: "council_ta",
    icon: Building2,
    label: "Council / TA Officer",
    description: "Source properties for temporary accommodation placements",
    color: "border-slate-200 hover:border-teal-300 hover:bg-teal-50",
    selectedColor: "border-teal-500 bg-teal-50 ring-2 ring-teal-200",
  },
  {
    id: "operator",
    icon: Users,
    label: "Property Manager",
    description: "Manage HMO portfolios and lettings",
    color: "border-slate-200 hover:border-purple-300 hover:bg-purple-50",
    selectedColor: "border-purple-500 bg-purple-50 ring-2 ring-purple-200",
  },
  {
    id: "agent",
    icon: Briefcase,
    label: "Agent / Other",
    description: "Estate agent, letting agent, sourcing agent, or other",
    color: "border-slate-200 hover:border-slate-400 hover:bg-slate-50",
    selectedColor: "border-slate-500 bg-slate-50 ring-2 ring-slate-200",
  },
]

export function RoleSelectionModal({ isOpen, onComplete }: RoleSelectionModalProps) {
  const [selectedRole, setSelectedRole] = useState<UserType | null>(null)
  const [saving, setSaving] = useState(false)

  const handleConfirm = async () => {
    if (!selectedRole) return
    setSaving(true)
    try {
      const supabase = createClient()
      await supabase.auth.updateUser({
        data: { user_type: selectedRole },
      })
      onComplete(selectedRole)
    } catch (error) {
      console.error("[RoleSelection] Error saving user type:", error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[480px]" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">Welcome to HMO Hunter</DialogTitle>
          <DialogDescription className="text-center text-slate-500">
            How will you use the platform? This helps us show the most relevant features first.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 mt-4">
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
          {saving ? "Saving..." : "Continue"}
        </Button>

        <p className="text-xs text-slate-400 text-center">
          You can change this later in your profile settings.
        </p>
      </DialogContent>
    </Dialog>
  )
}
