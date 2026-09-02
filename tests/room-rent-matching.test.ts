import { describe, it, expect } from "vitest"
import { roomRent, CITY_ROOM_RENTS } from "@/lib/properties/room-rents"

/**
 * The national fallback is the weakest figure the product publishes, so how
 * often it gets used is a measure of quality on its own. It was being used for
 * 1,306 properties whose city was in the table all along — the listing supplied
 * a county, the lookup asked for a city, and the two never met.
 */

describe("matching a property to a city rate", () => {
  it("uses the city when the listing supplies a real one", () => {
    const r = roomRent("Bristol")
    expect(r.basis).toBe("city")
    expect(r.city).toBe("Bristol")
    expect(r.matchedOn).toBe("city")
    expect(r.rate).toBe(CITY_ROOM_RENTS["Bristol"].avg)
  })

  /**
   * The actual shape of the data: county in, city needed. Every one of these
   * pairs appears in the database, and every one took the national figure
   * before the planning authority was consulted.
   */
  it.each([
    ["West Yorkshire", "Leeds", "Leeds"],
    ["Oxfordshire", "Oxford", "Oxford"],
    ["Berkshire", "Reading", "Reading"],
    ["South Yorkshire", "Sheffield", "Sheffield"],
    ["Greater Manchester", "Manchester", "Manchester"],
    ["Merseyside", "Liverpool", "Liverpool"],
    ["Hampshire", "Portsmouth", "Portsmouth"],
    ["West Midlands", "Coventry", "Coventry"],
    ["Cambridgeshire", "Cambridge", "Cambridge"],
  ])("recovers %s → %s from the planning authority", (city, council, expected) => {
    const r = roomRent(city, council)
    expect(r.basis).toBe("city")
    expect(r.city).toBe(expected)
    expect(r.matchedOn).toBe("council")
    expect(r.rate).toBe(CITY_ROOM_RENTS[expected].avg)
  })

  it("handles councils whose name carries statutory decoration", () => {
    expect(roomRent("Avon", "Bristol, City of").city).toBe("Bristol")
    expect(roomRent("East Sussex", "Brighton and Hove").city).toBe("Brighton")
    expect(roomRent("Tyne and Wear", "Newcastle upon Tyne").city).toBe("Newcastle")
    expect(roomRent("East Riding", "Kingston upon Hull, City of").city).toBe("Hull")
  })

  /**
   * Order matters. A city that matches must never be overridden by the council,
   * or a property in a district with its own rate would be quietly reassigned
   * to the authority's rate instead.
   */
  it("prefers a matching city over the council", () => {
    const r = roomRent("Oxford", "Bristol, City of")
    expect(r.city).toBe("Oxford")
    expect(r.matchedOn).toBe("city")
  })

  it("still falls back nationally when neither is recognised", () => {
    const r = roomRent("Somewhere", "Some District Council")
    expect(r.basis).toBe("national")
    expect(r.city).toBeNull()
    expect(r.rate).toBe(CITY_ROOM_RENTS["_default"].avg)
  })

  it("falls back nationally with nothing to go on", () => {
    expect(roomRent(null).basis).toBe("national")
    expect(roomRent(undefined, null).basis).toBe("national")
  })

  /**
   * Scotland and Wales resolve no planning authority — the Article 4 pipeline
   * is English — so their city has to keep working on its own.
   */
  it("works where no planning authority is resolved", () => {
    for (const city of ["Edinburgh", "Glasgow", "Cardiff"]) {
      const r = roomRent(city, null)
      expect(r.basis, city).toBe("city")
      expect(r.city, city).toBe(city)
    }
  })

  it("never invents a rate — every result comes from the table", () => {
    const known = new Set(Object.values(CITY_ROOM_RENTS).map((v) => v.avg))
    const samples = [
      roomRent("Leeds"),
      roomRent("West Yorkshire", "Leeds"),
      roomRent("Nowhere", "Nowhere"),
      roomRent(null),
    ]
    for (const s of samples) expect(known.has(s.rate)).toBe(true)
  })
})

/**
 * The band travels with the rate.
 *
 * hero-metrics-bar graded an observed rent per room against £400/£600 —
 * invented at that call site, and flat across a country where Hull's band is
 * £350–500 and London's is £650–1100. Carrying min and max here means a caller
 * places a rent inside its own city's published range instead.
 */
describe("roomRent carries the published band, not just the average", () => {
  it("returns the city band for a recognised city", () => {
    const r = roomRent("Hull")
    expect(r.basis).toBe("city")
    expect(r.min).toBe(350)
    expect(r.max).toBe(500)
    expect(r.rate).toBeGreaterThanOrEqual(r.min)
    expect(r.rate).toBeLessThanOrEqual(r.max)
  })

  it("returns the band when the city was matched via the council", () => {
    const r = roomRent("East Riding", "Kingston upon Hull, City of")
    expect(r.city).toBe("Hull")
    expect(r.min).toBe(350)
    expect(r.max).toBe(500)
  })

  it("returns the national band, flagged as national, when no city matches", () => {
    const r = roomRent("Somewhere", "Some District Council")
    expect(r.basis).toBe("national")
    expect(r.min).toBeGreaterThan(0)
    expect(r.max).toBeGreaterThan(r.min)
  })

  // The bands must not overlap into nonsense: every city's max exceeds its min,
  // and the average sits inside its own band.
  it("holds a coherent band for every city in the table", () => {
    for (const [city, band] of Object.entries(CITY_ROOM_RENTS)) {
      expect(band.min, `${city} min < max`).toBeLessThan(band.max)
      expect(band.avg, `${city} avg >= min`).toBeGreaterThanOrEqual(band.min)
      expect(band.avg, `${city} avg <= max`).toBeLessThanOrEqual(band.max)
    }
  })
})
