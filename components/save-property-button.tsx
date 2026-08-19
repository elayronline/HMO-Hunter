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
              // The limit comes from the server, because Free and Pro do not
              // share a number and the old hardcoded 100 was only ever Pro's.
              title: "Saved properties limit reached",
              description:
                typeof extResult.error === "string"
                  ? extResult.error
                  : "You have reached your saved properties limit.",
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
          window.dispatchEvent(new Event("entitlements-changed"))
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
