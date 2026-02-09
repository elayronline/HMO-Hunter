"use client"

import { useState, useEffect } from "react"
import { Coins, Clock, AlertTriangle } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"

interface CreditStatus {
  role: 'admin' | 'standard_pro'
  isAdmin: boolean
  credits: {
    remaining: number
    total: number
    used: number
    percentUsed: number
  }
  freePropertyViews: {
    remaining: number
    total: number
    used: number
  }
  resources: {
    savedProperties: { current: number; limit: number }
    savedSearches: { current: number; limit: number }
    priceAlerts: { current: number; limit: number }
  }
  isWarning: boolean
  isBlocked: boolean
  resetIn: string
  resetAt: string
}

export function CreditBalance() {
  const [credits, setCredits] = useState<CreditStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchCredits() {
      try {
        const response = await fetch('/api/credits')
        if (response.ok) {
          const data = await response.json()
          setCredits(data)
        }
      } catch (error) {
        console.error('Failed to fetch credits:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCredits()

    // Refresh every 5 minutes
    const interval = setInterval(fetchCredits, 5 * 60 * 1000)

    // Listen for credit-changing actions (save, view, etc.) with debounce
    let debounceTimer: ReturnType<typeof setTimeout>
    const handleCreditsChanged = () => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(fetchCredits, 500)
    }
    window.addEventListener("credits-changed", handleCreditsChanged)

    return () => {
      clearInterval(interval)
      clearTimeout(debounceTimer)
      window.removeEventListener("credits-changed", handleCreditsChanged)
    }
  }, [])

  if (isLoading || !credits) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 animate-pulse">
        <div className="w-4 h-4 rounded-full bg-slate-200" />
        <div className="w-6 h-4 rounded bg-slate-200" />
      </div>
    )
  }

  // Admin users don't see credit balance
  if (credits.isAdmin) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
              <span className="text-xs font-bold text-purple-600">ADMIN</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Unlimited access</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  const percentUsed = credits.credits.percentUsed
  const isWarning = percentUsed >= 80
  const isBlocked = percentUsed >= 100

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
            isBlocked
              ? "bg-red-50 border-red-200 hover:bg-red-100"
              : isWarning
              ? "bg-amber-50 border-amber-200 hover:bg-amber-100"
              : "bg-slate-50 border-slate-200 hover:bg-slate-100"
          }`}
        >
          {isBlocked ? (
            <AlertTriangle className="w-4 h-4 text-red-500" />
          ) : (
            <Coins className={`w-4 h-4 ${isWarning ? "text-amber-500" : "text-teal-500"}`} />
          )}
          <span
            className={`text-sm font-medium ${
              isBlocked
                ? "text-red-600"
                : isWarning
                ? "text-amber-600"
                : "text-slate-700"
            }`}
          >
            {credits.credits.remaining}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 max-w-[calc(100vw-2rem)]" align="end">
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-slate-900">Daily Credits</h4>
              <span className="text-xs text-slate-500">
                {credits.credits.remaining} / {credits.credits.total}
              </span>
            </div>
            <Progress
              value={100 - percentUsed}
              className={`h-2 ${
                isBlocked
                  ? "[&>div]:bg-red-500"
                  : isWarning
                  ? "[&>div]:bg-amber-500"
                  : "[&>div]:bg-teal-500"
              }`}
            />
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span>Free property views</span>
              <span className="font-medium">
                {credits.freePropertyViews.remaining} / {credits.freePropertyViews.total}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Saved properties</span>
              <span className="font-medium">
                {credits.resources.savedProperties.current} / {credits.resources.savedProperties.limit}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Saved searches</span>
              <span className="font-medium">
                {credits.resources.savedSearches.current} / {credits.resources.savedSearches.limit}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Price alerts</span>
              <span className="font-medium">
                {credits.resources.priceAlerts.current} / {credits.resources.priceAlerts.limit}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              <span>Resets in {credits.resetIn}</span>
            </div>
          </div>

          {isBlocked && (
            <div className="p-2 bg-red-50 rounded-md">
              <p className="text-xs text-red-600">
                You've used all your daily credits. They'll reset at midnight UTC.
              </p>
            </div>
          )}

          {isWarning && !isBlocked && (
            <div className="p-2 bg-amber-50 rounded-md">
              <p className="text-xs text-amber-600">
                Credits running low. Use them wisely!
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
