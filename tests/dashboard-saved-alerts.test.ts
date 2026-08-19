import { describe, it, expect } from "vitest"
import {
  savedAlerts,
  urgencyRank,
  SAVED_HORIZON_DAYS,
  type SavedRow,
  type CommencingDirection,
} from "@/lib/dashboard/saved-alerts"

const NOW = new Date("2026-08-19T00:00:00.000Z")

const iso = (daysFromNow: number) =>
  new Date(NOW.getTime() + daysFromNow * 86_400_000).toISOString().slice(0, 10)

const row = (over: Partial<SavedRow> = {}): SavedRow => ({
  id: "p1",
  address: "1 Test Street",
  postcode: "OX4 1JL",
  ...over,
})

const direction = (over: Partial<CommencingDirection> = {}): CommencingDirection => ({
  council: "Dartford",
  date: iso(60),
  daysAway: 60,
  extent: null,
  ...over,
})

describe("alerts on saved listings", () => {
  it("says nothing when nothing is saved", () => {
    expect(savedAlerts([], [], NOW)).toEqual([])
  })

  it("says nothing about a saved listing with no dated change", () => {
    expect(savedAlerts([row()], [], NOW)).toEqual([])
  })

  it("keeps the register's word apart from our arithmetic", () => {
    // The distinction the property cards already make: an explicit "expired"
    // from the council is a finding, a date that ran out in our copy is not.
    const registerSaysExpired = savedAlerts(
      [row({ licence_status: "expired", hmo_licence_expiry: iso(-30) })],
      [],
      NOW
    )
    expect(registerSaysExpired[0].kind).toBe("licence_recorded_expired")

    const ourDateRanOut = savedAlerts(
      [row({ licence_status: "active", hmo_licence_expiry: iso(-30) })],
      [],
      NOW
    )
    expect(ourDateRanOut[0].kind).toBe("licence_term_ended")
    expect(ourDateRanOut[0].detail).toContain("rather than the council's finding")
  })

  it("never claims a licence expired on the strength of a stale date", () => {
    const alerts = savedAlerts(
      [row({ licence_status: "active", hmo_licence_expiry: iso(-800) })],
      [],
      NOW
    )
    expect(alerts.map((a) => a.kind)).not.toContain("licence_recorded_expired")
  })

  it("flags a licence running out inside the six-month window, and not beyond it", () => {
    const inside = savedAlerts([row({ hmo_licence_expiry: iso(SAVED_HORIZON_DAYS - 1) })], [], NOW)
    expect(inside[0].kind).toBe("licence_expiring")

    const outside = savedAlerts([row({ hmo_licence_expiry: iso(SAVED_HORIZON_DAYS + 1) })], [], NOW)
    expect(outside).toEqual([])
  })

  it("raises a saved listing whose council has a direction commencing", () => {
    const alerts = savedAlerts(
      [row({ article_4_council: "Dartford" })],
      [direction()],
      NOW
    )
    expect(alerts).toHaveLength(1)
    expect(alerts[0].kind).toBe("article4_commencing")
    expect(alerts[0].daysAway).toBe(60)
  })

  it("does not raise a listing in a different council", () => {
    const alerts = savedAlerts(
      [row({ article_4_council: "Preston" })],
      [direction({ council: "Dartford" })],
      NOW
    )
    expect(alerts).toEqual([])
  })

  it("can raise more than one alert for the same listing", () => {
    // A saved property can be both about to be restricted and about to lose its
    // licence. Reporting only the first would hide the other.
    const alerts = savedAlerts(
      [row({ article_4_council: "Dartford", hmo_licence_expiry: iso(10) })],
      [direction()],
      NOW
    )
    expect(alerts.map((a) => a.kind).sort()).toEqual(["article4_commencing", "licence_expiring"])
  })
})

describe("what counts as most pressing", () => {
  it("puts what has already happened above what is coming", () => {
    const alerts = savedAlerts(
      [
        row({ id: "future", hmo_licence_expiry: iso(5) }),
        row({ id: "past", hmo_licence_expiry: iso(-5) }),
      ],
      [],
      NOW
    )
    expect(alerts.map((a) => a.propertyId)).toEqual(["past", "future"])
  })

  it("ranks the freshest of the past first, not the oldest", () => {
    // Sorting on the raw day count would put a licence that lapsed three years
    // ago above one that lapsed yesterday.
    const alerts = savedAlerts(
      [
        row({ id: "ancient", hmo_licence_expiry: iso(-1000) }),
        row({ id: "yesterday", hmo_licence_expiry: iso(-1) }),
      ],
      [],
      NOW
    )
    expect(alerts.map((a) => a.propertyId)).toEqual(["yesterday", "ancient"])
  })

  it("ranks the soonest of the future first", () => {
    const alerts = savedAlerts(
      [
        row({ id: "later", hmo_licence_expiry: iso(90) }),
        row({ id: "sooner", hmo_licence_expiry: iso(9) }),
      ],
      [],
      NOW
    )
    expect(alerts.map((a) => a.propertyId)).toEqual(["sooner", "later"])
  })

  it("tiers past before future regardless of distance", () => {
    expect(urgencyRank({ daysAway: -1 })[0]).toBe(0)
    expect(urgencyRank({ daysAway: 0 })[0]).toBe(1)
    expect(urgencyRank({ daysAway: 500 })[0]).toBe(1)
  })
})
