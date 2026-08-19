"use client"

import { useEffect, useState } from "react"

/**
 * Client-side read of what this account may do.
 *
 * The map used to answer this from `user.user_metadata.is_premium` while the
 * API answered it from the credits table, so the two could disagree about the
 * same reader. Both now read `user_credits.tier` through /api/entitlements.
 */

export type Tier = "free" | "pro" | "admin"

export interface EntitlementsSnapshot {
  tier: Tier
  tierLabel: string
  isAdmin: boolean
  can: Record<string, boolean>
  propertyViews: { used: number; limit: number | null; remaining: number | null }
  resources: {
    savedProperties: { current: number; limit: number | null }
    savedSearches: { current: number; limit: number | null }
    priceAlerts: { current: number; limit: number | null }
  }
}

export interface UseEntitlements {
  entitlements: EntitlementsSnapshot | null
  /** True only once a real answer has arrived. */
  loaded: boolean
  can: (capability: string) => boolean
}

export function useEntitlements(): UseEntitlements {
  const [entitlements, setEntitlements] = useState<EntitlementsSnapshot | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const response = await fetch("/api/entitlements")
        if (!cancelled && response.ok) {
          setEntitlements(await response.json())
        }
      } catch {
        // Leave it null. A failed read must not be read as a grant.
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }

    load()

    const onChanged = () => load()
    window.addEventListener("entitlements-changed", onChanged)

    return () => {
      cancelled = true
      window.removeEventListener("entitlements-changed", onChanged)
    }
  }, [])

  return {
    entitlements,
    loaded,
    // Absent an answer this is false, so a slow or failed fetch shows the
    // locked state rather than briefly revealing owner data.
    can: (capability: string) => entitlements?.can?.[capability] === true,
  }
}
