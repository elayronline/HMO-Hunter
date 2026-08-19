import { describe, it, expect } from "vitest"
import {
  TIERS,
  TIER_LIMITS,
  TIER_LABELS,
  can,
  limitFor,
  isAtCap,
  lockReason,
  capMessage,
  normaliseTier,
  isStaleViewWindow,
  type Tier,
} from "@/lib/entitlements"

describe("the tier ladder", () => {
  it("has exactly three tiers", () => {
    expect(TIERS).toEqual(["free", "pro", "admin"])
  })

  it("gives every tier a label, so a tier is never spelled two ways in the UI", () => {
    for (const tier of TIERS) {
      expect(TIER_LABELS[tier]).toBeTruthy()
    }
  })

  it("gives every tier a complete set of limits", () => {
    for (const tier of TIERS) {
      const limits = TIER_LIMITS[tier]
      expect(limits).toHaveProperty("propertyViewsPerDay")
      expect(limits).toHaveProperty("savedProperties")
      expect(limits).toHaveProperty("savedSearches")
      expect(limits).toHaveProperty("priceAlerts")
    }
  })

  it("never lets a higher tier have a lower cap than a lower tier", () => {
    // null means unlimited, so it sorts above every number.
    const rank = (v: number | null) => (v === null ? Infinity : v)
    for (const key of ["savedProperties", "savedSearches", "priceAlerts"] as const) {
      expect(rank(TIER_LIMITS.pro[key])).toBeGreaterThanOrEqual(rank(TIER_LIMITS.free[key]))
      expect(rank(TIER_LIMITS.admin[key])).toBeGreaterThanOrEqual(rank(TIER_LIMITS.pro[key]))
    }
  })
})

describe("capabilities", () => {
  it("locks owner and contact data on free", () => {
    expect(can("free", "owner_data")).toBe(false)
    expect(can("free", "contact_data")).toBe(false)
  })

  it("opens owner and contact data on pro", () => {
    expect(can("pro", "owner_data")).toBe(true)
    expect(can("pro", "contact_data")).toBe(true)
  })

  it("keeps export off free and on pro", () => {
    expect(can("free", "export")).toBe(false)
    expect(can("pro", "export")).toBe(true)
  })

  it("reserves the admin console to admin — pro does not inherit it", () => {
    expect(can("pro", "admin_console")).toBe(false)
    expect(can("admin", "admin_console")).toBe(true)
  })

  it("gives admin everything pro has", () => {
    for (const c of ["owner_data", "contact_data", "export"] as const) {
      expect(can("admin", c)).toBe(true)
    }
  })
})

describe("normaliseTier", () => {
  it("accepts the three known tiers", () => {
    for (const tier of TIERS) {
      expect(normaliseTier(tier)).toBe(tier)
    }
  })

  // The point of this test: a row holding something this build does not
  // recognise must not be read as granting more than the lowest tier.
  it.each([undefined, null, "", "standard_pro", "premium", "PRO", 1, {}])(
    "falls back to free rather than trusting %p",
    (value) => {
      expect(normaliseTier(value)).toBe("free")
    },
  )
})

describe("isAtCap", () => {
  it("is true at the limit, not just past it", () => {
    expect(isAtCap("free", "saved_properties", TIER_LIMITS.free.savedProperties!)).toBe(true)
  })

  it("is false below the limit", () => {
    expect(isAtCap("free", "saved_properties", TIER_LIMITS.free.savedProperties! - 1)).toBe(false)
  })

  // The old system used 999999 to mean unlimited and that number reached the
  // UI. null must behave as no limit, never as a limit of zero.
  it("treats an unlimited tier as never capped, even at absurd counts", () => {
    expect(limitFor("admin", "saved_properties")).toBeNull()
    expect(isAtCap("admin", "saved_properties", 0)).toBe(false)
    expect(isAtCap("admin", "saved_properties", 10_000_000)).toBe(false)
  })
})

describe("lockReason", () => {
  it("returns null when the tier already has the capability", () => {
    expect(lockReason("pro", "owner_data")).toBeNull()
    expect(lockReason("admin", "export")).toBeNull()
  })

  it("explains the lock when it does not", () => {
    expect(lockReason("free", "owner_data")).toMatch(/Pro/)
    expect(lockReason("free", "export")).toMatch(/Pro/)
  })

  it("does not offer Pro as the answer to an internal area", () => {
    expect(lockReason("pro", "admin_console")).toBe("This area is internal.")
  })
})

describe("capMessage", () => {
  it("states the limit that actually applies rather than a hardcoded number", () => {
    const free = capMessage("free", "saved_properties", limitFor("free", "saved_properties"))
    const pro = capMessage("pro", "saved_properties", limitFor("pro", "saved_properties"))
    expect(free).toContain(String(TIER_LIMITS.free.savedProperties))
    expect(pro).toContain(String(TIER_LIMITS.pro.savedProperties))
    expect(free).not.toEqual(pro)
  })

  it("offers the upgrade to free and not to pro", () => {
    expect(capMessage("free", "saved_searches", 3)).toMatch(/Pro raises this limit/)
    expect(capMessage("pro", "saved_searches", 10)).not.toMatch(/Pro raises this limit/)
  })

  it("says nothing where there is no limit", () => {
    expect(capMessage("admin", "price_alerts", null)).toBe("")
  })
})

describe("isStaleViewWindow", () => {
  const now = new Date("2026-08-19T14:00:00.000Z")

  it("is fresh within the same UTC day", () => {
    expect(isStaleViewWindow("2026-08-19T00:00:01.000Z", now)).toBe(false)
    expect(isStaleViewWindow("2026-08-19T23:59:59.000Z", now)).toBe(false)
  })

  it("is stale once the UTC day has rolled over", () => {
    expect(isStaleViewWindow("2026-08-18T23:59:59.000Z", now)).toBe(true)
  })

  // A never-counted user must not be locked out by a null.
  it("treats a missing or unparseable stamp as stale", () => {
    expect(isStaleViewWindow(null, now)).toBe(true)
    expect(isStaleViewWindow("not a date", now)).toBe(true)
  })

  it("does not confuse the same day-of-month in a different month or year", () => {
    expect(isStaleViewWindow("2026-07-19T14:00:00.000Z", now)).toBe(true)
    expect(isStaleViewWindow("2025-08-19T14:00:00.000Z", now)).toBe(true)
  })
})

describe("the migration promise: nobody loses access they had", () => {
  // Every account measured on 2026-08-19 held is_premium = true, and migration
  // 018 maps those to pro. Whatever else changes, pro must keep the one thing
  // is_premium actually unlocked.
  it("keeps owner and contact data reachable for the tier the migration assigns", () => {
    const assigned: Tier = "pro"
    expect(can(assigned, "owner_data")).toBe(true)
    expect(can(assigned, "contact_data")).toBe(true)
  })
})
