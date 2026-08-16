import { describe, it, expect } from "vitest"
import { EXPORT_HEADERS, exportRow, toCsv } from "@/lib/export/rows"
import type { Property } from "@/lib/types/database"

function property(over: Partial<Property> = {}): Property {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    address: "1 Tyndale Road",
    postcode: "OX4 1JL",
    city: "Oxford",
    listing_type: "rent",
    purchase_price: null,
    bedrooms: 5,
    bathrooms: 2,
    property_type: "House",
    licensed_hmo: true,
    licence_status: null,
    hmo_licence_expiry: "2025-04-30",
    hmo_licence_reference: "23/04617/HMOMAN",
    epc_rating: "D",
    article_4_status: "in_force",
    article_4_council: "Oxford City Council",
    owner_name: null,
    company_name: null,
    company_number: null,
    licence_holder_name: null,
    source_name: "PropertyData HMO",
    source_url: "https://example.invalid/1",
    gross_internal_area_sqm: 92,
    ...over,
  } as unknown as Property
}

const cell = (p: Property, header: string) => exportRow(p)[EXPORT_HEADERS.indexOf(header)]

describe("export columns", () => {
  // The old CSV declared 24 headers and emitted 22 values, so Source URL
  // printed under "LHA Weekly Rate" and every column past position 21 was
  // labelled with the wrong name. Built from one list now, so it cannot drift.
  it("emits exactly one value per header", () => {
    expect(exportRow(property())).toHaveLength(EXPORT_HEADERS.length)
  })

  it("carries the published licence reference and expiry", () => {
    const p = property()
    expect(cell(p, "Licence reference")).toBe("23/04617/HMOMAN")
    expect(cell(p, "Licence expiry")).toBe("2025-04-30")
  })

  // scripts/DO_NOT_RUN_012_populate_licence_term_data.sql wrote these onto 252 rows.
  it("never falls back to the seeded licence columns", () => {
    const seeded = property({
      hmo_licence_reference: null,
      hmo_licence_expiry: null,
      licence_id: "LDN-HMO-8e23a7",
      licence_end_date: "2027-03-14",
      max_occupants: 6,
    } as Partial<Property>)
    expect(cell(seeded, "Licence reference")).toBeNull()
    expect(cell(seeded, "Licence expiry")).toBeNull()
    expect(EXPORT_HEADERS).not.toContain("Max Occupants")
  })

  // Removed with the features that produced them. gross_yield was never a
  // column on the table, which is what made every export 400.
  it("has no deal score, yield or LHA columns", () => {
    for (const gone of ["Deal Score", "Gross Yield (%)", "LHA Weekly Rate", "LHA Monthly Rate"]) {
      expect(EXPORT_HEADERS).not.toContain(gone)
    }
  })

  // price_pcm on an off-market record is our own city-average estimate.
  it("leaves the price empty rather than printing an estimated rent", () => {
    const offMarket = property({ purchase_price: null, price_pcm: 2400 } as Partial<Property>)
    expect(cell(offMarket, "Asking price (£)")).toBeNull()
    expect(cell(property({ purchase_price: 610000 }), "Asking price (£)")).toBe(610000)
  })

  it("states an unverified Article 4 status rather than leaving it blank", () => {
    expect(cell(property({ article_4_status: "unknown" }), "Article 4 status")).toBe("unknown")
  })
})

describe("csv encoding", () => {
  it("quotes values containing commas and escapes quotes", () => {
    const csv = toCsv([property({ address: 'Flat 2, "The Limes"' })])
    expect(csv.split("\n")[1]).toContain('"Flat 2, ""The Limes"""')
  })

  it("writes one header row and one row per property", () => {
    const csv = toCsv([property(), property({ id: "22222222-2222-4222-8222-222222222222" })])
    expect(csv.split("\n")).toHaveLength(3)
    expect(csv.split("\n")[0]).toBe(EXPORT_HEADERS.join(","))
  })
})
