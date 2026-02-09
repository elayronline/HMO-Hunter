"use client"

import { Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { saveProperty, unsaveProperty } from "@/app/actions/saved-properties"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"

interface SavePropertyButtonProps {
  propertyId: string
  initialSaved?: boolean
}

export function SavePropertyButton({ propertyId, initialSaved = false }: SavePropertyButtonProps) {
  const [isSaved, setIsSaved] = useState(initialSaved)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleToggleSave = async () => {
    startTransition(async () => {
      if (isSaved) {
        const result = await unsaveProperty(propertyId)
        if (result.error) {
          console.error("[v0] Error unsaving property:", result.error)
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
          } else if ((result as any).limitReached) {
            toast({
              title: "Saved Properties Limit Reached",
              description: `You've reached your limit of ${(result as any).limit} saved properties. Remove some to save more.`,
              variant: "destructive",
            })
          } else if ((result as any).insufficientCredits) {
            toast({
              title: "Daily Credits Exhausted",
              description: "You've used all your credits for today. Resets at midnight UTC.",
              variant: "destructive",
            })
          } else {
            console.error("[v0] Error saving property:", result.error)
            toast({
              title: "Error",
              description: result.error,
              variant: "destructive",
            })
          }
        } else {
          setIsSaved(true)
          toast({ title: "Property saved", description: "Added to your saved properties." })
          // Notify credit balance to refresh
          window.dispatchEvent(new Event("credits-changed"))
          // Show warning if credits are running low
          if ((result as any).warning) {
            toast({
              title: "Credits Running Low",
              description: (result as any).warning,
            })
          }
        }
      }
    })
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="absolute top-2 right-2 z-10 bg-white/90 hover:bg-white"
      onClick={handleToggleSave}
      disabled={isPending}
    >
      <Heart className={`h-5 w-5 ${isSaved ? "fill-teal-600 text-teal-600" : "text-slate-600"}`} />
    </Button>
  )
}
