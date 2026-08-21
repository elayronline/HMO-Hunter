import { describe, it, expect } from "vitest"
import {
  cityCatchment,
  boundingBox,
  distanceKm,
  withinCatchment,
  catchmentLabel,
  radiusKmForZoom,
  RADIUS_KM_BY_ZOOM,
} from "@/lib/properties/location"
import { UK_CITIES, ALL_CITIES_OPTION } from "@/lib/data/uk-cities"

describe("cityCatchment", () => {
  it("resolves every option the dropdown offers", () => {
    // A city on the list with no catchment is an option that silently returns
    // everything, which is how the old filter failed in the other direction.
    for (const city of UK_CITIES) {
      const catchment = cityCatchment(city.name)
      expect(catchment, city.name).not.toBeNull()
      expect(catchment!.radiusKm).toBeGreaterThan(0)
    }
  })

  it("returns null for All Cities, so no location condition is applied", () => {
    expect(cityCatchment(ALL_CITIES_OPTION.name)).toBeNull()
    expect(cityCatchment(undefined)).toBeNull()
  })

  it("returns null for a name that is not on the list", () => {
    // The names that broke the old filter are exactly these: values written by
    // an adapter that were never dropdown options. They must not resolve to a
    // guessed centre.
    expect(cityCatchment("West Midlands")).toBeNull()
    expect(cityCatchment("Berkshire")).toBeNull()
    expect(cityCatchment("Greater Manchester")).toBeNull()
  })

  it("takes its radius from the city's own zoom", () => {
    expect(cityCatchment("London")!.radiusKm).toBe(RADIUS_KM_BY_ZOOM[11])
    expect(cityCatchment("Reading")!.radiusKm).toBe(RADIUS_KM_BY_ZOOM[12])
    expect(cityCatchment("Oxford")!.radiusKm).toBe(RADIUS_KM_BY_ZOOM[13])
  })

  it("falls back to the city scale for an unseen zoom rather than throwing", () => {
    expect(radiusKmForZoom(99)).toBe(RADIUS_KM_BY_ZOOM[12])
  })
})

describe("distanceKm", () => {
  it("measures a known separation", () => {
    // Leeds to Bradford, the pair that makes overlap unavoidable: ~14 km, so at
    // a 15 km radius each city's catchment reaches the other's centre.
    const leeds = UK_CITIES.find((c) => c.name === "Leeds")!
    const bradford = UK_CITIES.find((c) => c.name === "Bradford")!
    const d = distanceKm(leeds.latitude, leeds.longitude, bradford.latitude, bradford.longitude)
    expect(d).toBeGreaterThan(12)
    expect(d).toBeLessThan(16)
  })

  it("is zero at the same point and symmetric", () => {
    expect(distanceKm(51.4543, -0.9781, 51.4543, -0.9781)).toBe(0)
    expect(distanceKm(51.5, -0.1, 53.4, -2.2)).toBeCloseTo(distanceKm(53.4, -2.2, 51.5, -0.1), 9)
  })
})

describe("boundingBox", () => {
  it("contains the whole circle", () => {
    // The box is the query's coarse cut. If it were tighter than the circle it
    // would drop properties the radius says are inside, and no later step
    // could put them back.
    const catchment = cityCatchment("Reading")!
    const box = boundingBox(catchment)
    for (const bearing of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const rad = (bearing * Math.PI) / 180
      const dLat = (catchment.radiusKm * Math.cos(rad)) / 111.32
      const dLng =
        (catchment.radiusKm * Math.sin(rad)) /
        (111.32 * Math.cos((catchment.latitude * Math.PI) / 180))
      const lat = catchment.latitude + dLat
      const lng = catchment.longitude + dLng
      expect(lat).toBeGreaterThanOrEqual(box.minLat)
      expect(lat).toBeLessThanOrEqual(box.maxLat)
      expect(lng).toBeGreaterThanOrEqual(box.minLng)
      expect(lng).toBeLessThanOrEqual(box.maxLng)
    }
  })

  it("widens the longitude span with latitude", () => {
    // A flat km-per-degree for longitude would make northern boxes too narrow.
    const aberdeen = cityCatchment("Aberdeen")!
    const brighton = cityCatchment("Brighton")!
    const span = (c: ReturnType<typeof cityCatchment>) => {
      const b = boundingBox(c!)
      return b.maxLng - b.minLng
    }
    expect(aberdeen.radiusKm).toBe(brighton.radiusKm)
    expect(span(aberdeen)).toBeGreaterThan(span(brighton))
  })
})

describe("withinCatchment", () => {
  const reading = cityCatchment("Reading")!

  it("accepts a property at the centre", () => {
    expect(withinCatchment({ latitude: reading.latitude, longitude: reading.longitude }, reading)).toBe(true)
  })

  it("rejects a property beyond the radius that a bounding box would keep", () => {
    // The corner case the trim exists for: due north-east at the box corner is
    // inside the rectangle and outside the circle.
    const dLat = reading.radiusKm / 111.32
    const dLng = reading.radiusKm / (111.32 * Math.cos((reading.latitude * Math.PI) / 180))
    const corner = { latitude: reading.latitude + dLat, longitude: reading.longitude + dLng }
    const box = boundingBox(reading)
    expect(corner.latitude).toBeLessThanOrEqual(box.maxLat)
    expect(corner.longitude).toBeLessThanOrEqual(box.maxLng)
    expect(withinCatchment(corner, reading)).toBe(false)
  })

  it("rejects a property whose position was never recorded", () => {
    // Unlike an absent price, an absent coordinate cannot answer "near where?".
    expect(withinCatchment({ latitude: null, longitude: null }, reading)).toBe(false)
    expect(withinCatchment({ latitude: 51.4, longitude: null }, reading)).toBe(false)
    expect(withinCatchment({}, reading)).toBe(false)
    expect(withinCatchment({ latitude: Number.NaN, longitude: -0.9 }, reading)).toBe(false)
  })

  it("catches the stock the city column hid", () => {
    // Central Reading, RG1. The row that motivated this: filed under city
    // "Berkshire", so `.eq("city", "Reading")` never returned it, though it is
    // 1 km from the centre the dropdown flies to.
    expect(withinCatchment({ latitude: 51.4562, longitude: -0.9705 }, reading)).toBe(true)
  })

  it("does not reach a different city", () => {
    const oxford = UK_CITIES.find((c) => c.name === "Oxford")!
    expect(withinCatchment({ latitude: oxford.latitude, longitude: oxford.longitude }, reading)).toBe(false)
  })
})

describe("catchmentLabel", () => {
  it("states the distance rather than claiming the property is in the city", () => {
    expect(catchmentLabel(cityCatchment("Reading")!)).toBe("within 15 km of Reading")
    expect(catchmentLabel(cityCatchment("London")!)).toBe("within 25 km of London")
    expect(catchmentLabel(cityCatchment("Oxford")!)).toBe("within 8 km of Oxford")
  })
})
