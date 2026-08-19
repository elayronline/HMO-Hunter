"use client"

import { useState, useEffect } from "react"
import { Gauge } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"

/**
 * The account's tier and how much of it is used.
 *
 * Replaces CreditBalance, which showed a daily credit balance nothing spent,
 * and the separate PRO chip that AppShell derived from
 * `user_metadata.is_premium`. Those were two sources of truth in one header —
 * this component reads one endpoint, so the badge and the limits can never
 * disagree.
 */

type Tier = "free" | "pro" | "admin"

interface Allowance {
  current: number
  /** null means the tier has no limit. Not the same as a limit of zero. */
  limit: number | null
}

interface Entitlements {
  tier: Tier
  tierLabel: string
  isAdmin: boolean
  can: Record<string, boolean>
  propertyViews: { used: number; limit: number | null; remaining: number | null }
  resources: {
    savedProperties: Allowance
    savedSearches: Allowance
    priceAlerts: Allowance
  }
}

const TIER_CHIP: Record<Tier, string> = {
  free: "border-slate-200 bg-slate-50 text-slate-600",
  pro: "border-amber-200 bg-amber-50 text-amber-600",
  admin: "border-purple-200 bg-purple-50 text-purple-600",
}

function Row({ label, current, limit }: { label: string; current: number; limit: number | null }) {
  // "No limit" is written out rather than shown as a number. The old endpoint
  // sent 999999 for an admin and it reached the screen.
  if (limit === null) {
    return (
      <div className="flex items-center justify-between py-1.5">
        <span className="text-sm text-ink-subtle">{label}</span>
        <span className="text-sm text-ink">{current} · no limit</span>
      </div>
    )
  }

  const pct = limit === 0 ? 100 : Math.min(100, Math.round((current / limit) * 100))

  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-subtle">{label}</span>
        <span className="text-sm text-ink">
          {current} of {limit}
        </span>
      </div>
      <Progress value={pct} className="mt-1 h-1" />
    </div>
  )
}

export function PlanStatus() {
  const [ent, setEnt] = useState<Entitlements | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/entitlements")
        if (response.ok) setEnt(await response.json())
      } catch {
        // A failed read leaves the chip absent rather than showing a guess.
      }
    }

    load()
    const interval = setInterval(load, 5 * 60 * 1000)

    let debounce: ReturnType<typeof setTimeout>
    const onChanged = () => {
      clearTimeout(debounce)
      debounce = setTimeout(load, 500)
    }
    window.addEventListener("entitlements-changed", onChanged)

    return () => {
      clearInterval(interval)
      clearTimeout(debounce)
      window.removeEventListener("entitlements-changed", onChanged)
    }
  }, [])

  if (!ent) return null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[0.6875rem] font-bold uppercase transition-colors ${TIER_CHIP[ent.tier]}`}
          aria-label={`Plan: ${ent.tierLabel}. Show usage.`}
        >
          <Gauge className="h-3 w-3" />
          {ent.tierLabel}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <p className="text-sm font-medium text-ink">{ent.tierLabel} plan</p>

        <div className="mt-2 divide-y divide-border">
          {ent.propertyViews.limit !== null && (
            <Row
              label="Property views today"
              current={ent.propertyViews.used}
              limit={ent.propertyViews.limit}
            />
          )}
          <Row
            label="Saved properties"
            current={ent.resources.savedProperties.current}
            limit={ent.resources.savedProperties.limit}
          />
          <Row
            label="Saved searches"
            current={ent.resources.savedSearches.current}
            limit={ent.resources.savedSearches.limit}
          />
          <Row
            label="Price alerts"
            current={ent.resources.priceAlerts.current}
            limit={ent.resources.priceAlerts.limit}
          />
        </div>

        {ent.tier === "free" && (
          <p className="mt-3 text-xs leading-relaxed text-ink-subtle">
            Pro adds owner and contact details, export, unlimited property views and
            higher limits.
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
