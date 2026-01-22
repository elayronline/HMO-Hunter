"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"

interface FreshnessBadgeProps {
  lastSeenAt: string | null
  isStale: boolean
  className?: string
}

export function FreshnessBadge({ lastSeenAt, isStale, className = "" }: FreshnessBadgeProps) {
  const [daysSince, setDaysSince] = useState<number>(0)

  useEffect(() => {
    if (lastSeenAt) {
      const lastSeen = new Date(lastSeenAt)
      const now = new Date()
      const days = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24))
      setDaysSince(days)
    }
  }, [lastSeenAt])

  if (isStale) {
    return (
      <Badge variant="outline" className={`bg-amber-50 text-amber-700 border-amber-300 ${className}`}>
        May be unavailable
      </Badge>
    )
  }

  if (daysSince === 0) {
    return (
      <Badge variant="outline" className={`bg-green-50 text-green-700 border-green-300 ${className}`}>
        Verified today
      </Badge>
    )
  }

  if (daysSince === 1) {
    return (
      <Badge variant="outline" className={`bg-green-50 text-green-700 border-green-300 ${className}`}>
        Verified yesterday
      </Badge>
    )
  }

  if (daysSince <= 3) {
    return (
      <Badge variant="outline" className={`bg-blue-50 text-blue-700 border-blue-300 ${className}`}>
        Verified {daysSince}d ago
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className={`bg-slate-50 text-slate-600 border-slate-300 ${className}`}>
      Updated {daysSince}d ago
    </Badge>
  )
}
