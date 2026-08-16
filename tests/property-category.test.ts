import { describe, it, expect } from "vitest"
import {
  categorise,
  isServed,
  rentIsEvidence,
  MARKET_LABELS,
  LICENCE_ENDING_WINDOW_MONTHS,
  sourcingCategory,
  licenceExpiry,
  licenceReference,
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

/**
 * A rental listing is not inventory here. Where it is an existing HMO it is
 * evidence — the property is operating, the owner is active, and the advertised
 * rent is a real figure for the rooms. Where it is not an HMO it is nothing.
 */
describe("an existing HMO the owner is letting", () => {
  const letHmo = property({
    listing_type: "rent",
    purchase_price: null,
    price_pcm: 2400,
    source_name: "Zoopla",
    licensed_hmo: true,
    hmo_licence_expiry: "2028-03-01",
  })

  it("is a live advertisement, not a cold outreach case", () => {
    expect(categorise(letHmo, NOW).market).toBe("let_listed")
  })

  it("is served, and keeps its licence state", () => {
    expect(isServed(letHmo)).toBe(true)
    expect(categorise(letHmo, NOW).licence).toBe("licensed")
  })

  it("shows its rent as evidence", () => {
    expect(rentIsEvidence(letHmo, NOW)).toBe(true)
  })

  // The label must describe what the owner is doing, never offer the property
  // to the reader — this is a buyer's platform.
  it("is labelled as an existing HMO rather than as something to rent", () => {
    const label = MARKET_LABELS[categorise(letHmo, NOW).market]
    expect(label).toContain("Existing HMO")
    expect(label.toLowerCase()).not.toContain("to let")
    expect(label.toLowerCase()).not.toContain("for rent")
  })

  it("still applies when the licence is coming to an end", () => {
    const ending = { ...letHmo, hmo_licence_expiry: "2026-10-01" }
    const c = categorise(ending, NOW)
    expect(c.market).toBe("let_listed")
    expect(c.licence).toBe("licence_ending")
  })

  // Register records are stored as "rent" too, but nobody advertised them.
  it("does not call a register record a live advertisement", () => {
    const register = { ...letHmo, source_name: "PropertyData HMO" }
    expect(categorise(register, NOW).market).toBe("off_market")
    expect(rentIsEvidence(register, NOW)).toBe(false)
  })

  it("does not show a rent for a property with no HMO behind it", () => {
    const plainRental = property({
      listing_type: "rent", purchase_price: null, price_pcm: 1200,
      source_name: "Zoopla", licensed_hmo: false,
    })
    expect(isServed(plainRental)).toBe(false)
  })
})

/**
 * The three buckets a sourcer actually chooses between. They must partition the
 * served set — every served property is exactly one of them — or the map's
 * counts will not add up to what it displays.
 */
describe("sourcing category", () => {
  it("calls a licensed HMO with no sale listing an existing off-market HMO", () => {
    expect(sourcingCategory({ listing_type: "rent", licensed_hmo: true })).toBe(
      "existing_off_market"
    )
  })

  it("calls a licensed HMO on the market a for-sale HMO", () => {
    expect(sourcingCategory({ listing_type: "purchase", licensed_hmo: true })).toBe("for_sale_hmo")
  })

  it("calls a house with no HMO use a change of use", () => {
    expect(sourcingCategory({ listing_type: "purchase", licensed_hmo: false })).toBe(
      "change_of_use"
    )
  })

  it("treats a commercial building for sale as a change of use", () => {
    expect(
      sourcingCategory({ listing_type: "purchase", property_type: "commercial", licensed_hmo: false })
    ).toBe("change_of_use")
  })

  // An expired licence is still evidence the building was in HMO use, which is
  // the fact the planning question turns on.
  it("counts an expired licence as existing HMO use, not a conversion", () => {
    expect(sourcingCategory({ listing_type: "rent", licence_status: "expired" })).toBe(
      "existing_off_market"
    )
    expect(sourcingCategory({ listing_type: "purchase", licence_status: "expired" })).toBe(
      "for_sale_hmo"
    )
  })

  it("assigns every served property exactly one category", () => {
    const served = [
      { listing_type: "purchase", licensed_hmo: false },
      { listing_type: "purchase", licensed_hmo: true },
      { listing_type: "rent", licensed_hmo: true },
      { listing_type: "rent", licence_status: "expired" },
      { listing_type: "purchase", property_type: "commercial", licensed_hmo: false },
    ]
    for (const p of served) {
      expect(["existing_off_market", "for_sale_hmo", "change_of_use"]).toContain(
        sourcingCategory(p)
      )
    }
  })
})

/**
 * The seeded licence columns. scripts/DO_NOT_RUN_012_populate_licence_term_data.sql wrote
 * licence_id, licence_start_date, licence_end_date and max_occupants onto 252
 * rows from hardcoded per-city constants — six distinct end dates in total,
 * references built from MD5(address), occupancy set to bedrooms + 1. None of
 * it was published by a council, so none of it may reach a card.
 */
describe("licence evidence reads only published columns", () => {
  it("returns the published expiry", () => {
    expect(licenceExpiry({ hmo_licence_expiry: "2027-04-01" })).toBe("2027-04-01")
  })

  it("returns the council's own reference", () => {
    expect(licenceReference({ hmo_licence_reference: "24/02862/HMOMAN" })).toBe("24/02862/HMOMAN")
  })

  it("says absent rather than falling back to the seeded columns", () => {
    // Exactly the shape of a seeded row: a licence term and a reference are
    // present on the record, and neither is an answer.
    const seeded = {
      hmo_licence_expiry: null,
      hmo_licence_reference: null,
      licence_end_date: "2027-03-14",
      licence_id: "LDN-HMO-8e23a7",
      max_occupants: 6,
    } as Parameters<typeof licenceExpiry>[0]
    expect(licenceExpiry(seeded)).toBeNull()
    expect(licenceReference(seeded)).toBeNull()
  })

  // The badge, the tab, the sort and the licence-type filter all turn on this
  // one derivation. When they each had their own, the Expired tab counted 15
  // and the list underneath it showed 98 cards badged expired.
  it("derives expiry from the date, not the stored status", () => {
    const ranOut = property({ licensed_hmo: true, hmo_licence_expiry: "2025-04-01" })
    expect(ranOut.licence_status).toBeNull()
    expect(categorise(ranOut, NOW).licence).toBe("licence_expired")
  })

  it("still lets a revoked licence be expired before its date", () => {
    const revoked = property({
      licensed_hmo: true,
      hmo_licence_expiry: "2030-01-01",
      licence_status: "expired",
    })
    expect(categorise(revoked, NOW).licence).toBe("licence_expired")
  })
})
