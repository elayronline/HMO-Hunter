import { describe, it, expect } from "vitest"
import {
  categorise,
  isServed,
  LICENCE_ENDING_WINDOW_MONTHS,
  type CategorisableProperty,
} from "@/lib/properties/category"

const NOW = new Date("2026-08-11T00:00:00.000Z")

function property(over: Partial<CategorisableProperty> = {}): CategorisableProperty {
  return {
    listing_type: "purchase",
    purchase_price: 250_000,
    licensed_hmo: false,
    hmo_licence_expiry: null,
    licence_status: null,
    ...over,
  }
}

describe("market status", () => {
  it("reads for sale from the listing type", () => {
    expect(categorise(property(), NOW).market).toBe("for_sale")
  })

  // The old model called this "rent", which is what put register records in the
  // same bucket as rental listings.
  it("treats anything not for sale as off market", () => {
    expect(categorise(property({ listing_type: "rent" }), NOW).market).toBe("off_market")
    expect(categorise(property({ listing_type: null }), NOW).market).toBe("off_market")
  })

  // The axes are independent: this is the 20 licensed HMOs currently for sale.
  it("lets a licensed HMO also be for sale", () => {
    const c = categorise(
      property({ listing_type: "purchase", licensed_hmo: true, hmo_licence_expiry: "2028-01-01" }),
      NOW
    )
    expect(c.market).toBe("for_sale")
    expect(c.licence).toBe("licensed")
  })
})

describe("licence state", () => {
  it("is unlicensed with no licence", () => {
    expect(categorise(property(), NOW).licence).toBe("unlicensed")
  })

  it("is licensed when expiry is beyond the window", () => {
    const c = categorise(property({ licensed_hmo: true, hmo_licence_expiry: "2027-06-01" }), NOW)
    expect(c.licence).toBe("licensed")
  })

  it("is ending inside the window", () => {
    const c = categorise(property({ licensed_hmo: true, hmo_licence_expiry: "2026-10-01" }), NOW)
    expect(c.licence).toBe("licence_ending")
    expect(c.daysToExpiry).toBe(51)
  })

  it("is expired once the date has passed", () => {
    const c = categorise(property({ licensed_hmo: true, hmo_licence_expiry: "2026-01-01" }), NOW)
    expect(c.licence).toBe("licence_expired")
    expect(c.daysToExpiry).toBeLessThan(0)
  })

  // Nearly half the licensed stock has no date. Guessing "active" would claim a
  // licence is in force on no evidence; guessing "ending" would invent urgency.
  it("keeps a licensed property with no expiry date in its own state", () => {
    const c = categorise(property({ licensed_hmo: true, hmo_licence_expiry: null }), NOW)
    expect(c.licence).toBe("licence_undated")
    expect(c.daysToExpiry).toBeNull()
  })

  // A licence can be revoked before its printed expiry, so the council's own
  // word outranks arithmetic on the date.
  it("trusts an explicit expired status over a future date", () => {
    const c = categorise(
      property({ licensed_hmo: true, hmo_licence_expiry: "2028-01-01", licence_status: "expired" }),
      NOW
    )
    expect(c.licence).toBe("licence_expired")
  })

  it("moves a property from ending to expired as time passes, with no data change", () => {
    const row = property({ licensed_hmo: true, hmo_licence_expiry: "2026-09-01" })
    expect(categorise(row, new Date("2026-08-11")).licence).toBe("licence_ending")
    expect(categorise(row, new Date("2026-09-02")).licence).toBe("licence_expired")
    // ...and it was merely licensed well before the window opened.
    expect(categorise(row, new Date("2025-01-01")).licence).toBe("licensed")
  })

  it("uses the configured window", () => {
    expect(LICENCE_ENDING_WINDOW_MONTHS).toBe(6)
  })
})

describe("what the platform serves", () => {
  it("serves anything for sale", () => {
    expect(isServed(property({ listing_type: "purchase", licensed_hmo: false }))).toBe(true)
  })

  it("serves an off-market licensed HMO — the outreach case", () => {
    expect(isServed(property({ listing_type: "rent", licensed_hmo: true }))).toBe(true)
  })

  it("serves an expired-licence property, which is the sharpest lead of all", () => {
    expect(isServed(property({ listing_type: "rent", licensed_hmo: false, licence_status: "expired" }))).toBe(true)
  })

  // The 1,407 Zoopla listings with no licence, no owner and no sale price.
  it("does not serve a rental listing with nothing tying it to an HMO", () => {
    expect(isServed(property({ listing_type: "rent", licensed_hmo: false, purchase_price: null }))).toBe(false)
  })
})
