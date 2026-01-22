"use client"

import { Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { saveProperty, unsaveProperty } from "@/app/actions/saved-properties"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

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
        } else {
          setIsSaved(false)
        }
      } else {
        const result = await saveProperty(propertyId)
        if (result.error) {
          if (result.error === "You must be logged in to save properties") {
            router.push("/auth/login")
          } else {
            console.error("[v0] Error saving property:", result.error)
          }
        } else {
          setIsSaved(true)
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
