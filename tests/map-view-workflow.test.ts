import { describe, it, expect } from "vitest"
import {
  initialViewMode,
  viewParam,
  urlAfterPropertyConsumed,
  countCoincident,
} from "@/lib/map/view-workflow"

describe("which view a load opens in", () => {
  it("defaults to the list when the URL says nothing", () => {
    expect(initialViewMode(null)).toBe("list")
    expect(initialViewMode(undefined)).toBe("list")
    expect(initialViewMode("")).toBe("list")
  })

  it("opens the map only when the URL asks for it", () => {
    expect(initialViewMode("map")).toBe("map")
  })

  it("treats an unrecognised value as the default rather than guessing", () => {
    expect(initialViewMode("grid")).toBe("list")
    expect(initialViewMode("MAP")).toBe("list")
    expect(initialViewMode("map ")).toBe("list")
  })

  it("round-trips: the parameter a mode writes reopens that mode", () => {
    for (const mode of ["map", "list"] as const) {
      expect(initialViewMode(viewParam(mode))).toBe(mode)
    }
  })

  it("keeps the default out of the URL", () => {
    expect(viewParam("list")).toBeNull()
    expect(viewParam("map")).toBe("map")
  })

  it("carries the choice, since there is no stored preference to fall back on", () => {
    // The URL is the only persistence: a bookmark or a shared link is what
    // makes a reader's choice survive, so the round trip above has to hold.
    expect(initialViewMode(viewParam("map"))).toBe("map")
    expect(initialViewMode(viewParam("list"))).toBe("list")
  })
})

describe("the URL left behind after a ?property= deep link", () => {
  it("stays on the map instead of pointing at the marketing page", () => {
    // The regression this exists for: the old code replaced the whole URL with
    // "/", so a refresh after following a deep link left the application.
    expect(urlAfterPropertyConsumed("?property=abc")).toBe("/map")
    expect(urlAfterPropertyConsumed("?property=abc")).not.toBe("/")
  })

  it("keeps every other parameter", () => {
    const url = urlAfterPropertyConsumed("?view=map&segment=licensed&property=abc")
    expect(url.startsWith("/map?")).toBe(true)
    expect(url).toContain("view=map")
    expect(url).toContain("segment=licensed")
    expect(url).not.toContain("property=")
  })

  it("handles an empty search and a leading-? absence", () => {
    expect(urlAfterPropertyConsumed("")).toBe("/map")
    expect(urlAfterPropertyConsumed("property=abc")).toBe("/map")
  })

  it("removes every repeat of the parameter", () => {
    expect(urlAfterPropertyConsumed("?property=a&property=b")).toBe("/map")
  })
})

describe("counting properties that share a coordinate", () => {
  const at = (id: string, latitude: number | null, longitude: number | null) => ({
    id,
    latitude,
    longitude,
  })

  it("reports nothing when every property stands alone", () => {
    const counts = countCoincident([at("a", 51.5, -0.1), at("b", 53.4, -2.2)])
    expect(counts.size).toBe(0)
  })

  it("counts the others, not the property itself", () => {
    const counts = countCoincident([
      at("a", 55.9448, -3.2141),
      at("b", 55.9448, -3.2141),
      at("c", 55.9448, -3.2141),
    ])
    expect(counts.get("a")).toBe(2)
    expect(counts.get("b")).toBe(2)
    expect(counts.get("c")).toBe(2)
  })

  it("scales to the worst real pile without miscounting", () => {
    // 20 properties share 55.9448,-3.2141 in the live table.
    const stacked = Array.from({ length: 20 }, (_, i) => at(`p${i}`, 55.9448, -3.2141))
    const counts = countCoincident([...stacked, at("alone", 51.5, -0.1)])
    expect(counts.size).toBe(20)
    expect(counts.get("p0")).toBe(19)
    expect(counts.has("alone")).toBe(false)
  })

  it("does not treat missing coordinates as a shared location", () => {
    // Two properties with no coordinate are not neighbours; they are unplaced.
    const counts = countCoincident([
      at("a", null, null),
      at("b", null, null),
      at("c", null, -0.1),
      at("d", 51.5, null),
    ])
    expect(counts.size).toBe(0)
  })

  it("separates points that differ only in the last decimal", () => {
    const counts = countCoincident([at("a", 51.50001, -0.1), at("b", 51.50002, -0.1)])
    expect(counts.size).toBe(0)
  })

  it("does not confuse a latitude with a longitude", () => {
    // Without a separator in the key, (51.5, -0.12) and (51.5-0.1, 2) would
    // collide. They are different places.
    const counts = countCoincident([at("a", 51.5, -0.12), at("b", 51.4, 2)])
    expect(counts.size).toBe(0)
  })

  it("returns an empty map for an empty set", () => {
    expect(countCoincident([]).size).toBe(0)
  })
})
