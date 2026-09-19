import { describe, expect, it } from "vitest"
import { MAP_STYLE, withStadiaKey } from "@/lib/map/stadia"

describe("withStadiaKey", () => {
  it("appends the key to Stadia tile and style requests", () => {
    expect(withStadiaKey("https://tiles.stadiamaps.com/data/openmaptiles/10/511/340.pbf", "k1"))
      .toBe("https://tiles.stadiamaps.com/data/openmaptiles/10/511/340.pbf?api_key=k1")
    expect(withStadiaKey(MAP_STYLE, "k1")).toBe(`${MAP_STYLE}?api_key=k1`)
  })

  it("uses & when the URL already carries a query string", () => {
    expect(withStadiaKey("https://tiles.stadiamaps.com/x.json?v=2", "k1"))
      .toBe("https://tiles.stadiamaps.com/x.json?v=2&api_key=k1")
  })

  it("leaves non-Stadia requests untouched", () => {
    const own = "/api/article4-data"
    const carto = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
    const lookalike = "https://stadiamaps.com.evil.example/tile.pbf"
    for (const url of [own, carto, lookalike]) expect(withStadiaKey(url, "k1")).toBe(url)
  })

  it("does nothing without a key, and never doubles an existing key", () => {
    const url = "https://tiles.stadiamaps.com/a.pbf"
    expect(withStadiaKey(url, undefined)).toBe(url)
    expect(withStadiaKey(url, "")).toBe(url)
    expect(withStadiaKey(`${url}?api_key=old`, "new")).toBe(`${url}?api_key=old`)
  })

  it("URL-encodes the key", () => {
    expect(withStadiaKey("https://tiles.stadiamaps.com/a.pbf", "a b&c"))
      .toBe("https://tiles.stadiamaps.com/a.pbf?api_key=a%20b%26c")
  })
})
