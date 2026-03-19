"use client"

import { Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { saveProperty, unsaveProperty } from "@/app/actions/saved-properties"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface SavePropertyButtonProps {
  propertyId: string
  initialSaved?: boolean
  size?: "sm" | "default" | "icon"
  className?: string
}

export function SavePropertyButton({
  propertyId,
  initialSaved = false,
  size = "icon",
  className,
}: SavePropertyButtonProps) {
  const [isSaved, setIsSaved] = useState(initialSaved)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleToggleSave = async () => {
    startTransition(async () => {
      if (isSaved) {
        const result = await unsaveProperty(propertyId)
        if (result.error) {
          toast({
            title: "Error",
            description: "Failed to unsave property. Please try again.",
            variant: "destructive",
          })
        } else {
          setIsSaved(false)
        }
      } else {
        const result = await saveProperty(propertyId)
        if (result.error) {
          if (result.error === "You must be logged in to save properties") {
            router.push("/auth/login")
            return
          }

          const extResult = result as Record<string, unknown>

          if (extResult.limitReached) {
            toast({
              title: "Saved Properties Limit Reached",
              description: `You've reached your limit of ${extResult.limit ?? 100} saved properties. Remove some to save more.`,
              variant: "destructive",
            })
          } else if (extResult.insufficientCredits) {
            toast({
              title: "Daily Credits Exhausted",
              description: "You've used all your credits for today. Resets at midnight UTC.",
              variant: "destructive",
            })
          } else {
            toast({
              title: "Error",
              description: result.error,
              variant: "destructive",
            })
          }
        } else {
          setIsSaved(true)
          toast({ title: "Property saved", description: "Added to your saved properties." })
          window.dispatchEvent(new Event("credits-changed"))

          const extResult = result as Record<string, unknown>
          if (extResult.warning) {
            toast({
              title: "Credits Running Low",
              description: String(extResult.warning),
            })
          }
        }
      }
    })
  }

  return (
    <Button
      variant="ghost"
      size={size}
      className={cn("bg-white/90 hover:bg-white", className)}
      onClick={handleToggleSave}
      disabled={isPending}
      aria-label={isSaved ? "Remove from saved properties" : "Save property"}
    >
      <Heart className={cn("h-5 w-5", isSaved ? "fill-teal-600 text-teal-600" : "text-slate-600")} />
    </Button>
  )
}
