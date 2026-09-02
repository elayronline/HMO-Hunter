import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { SourceAdapter, type PropertyListing } from "@/lib/types/ingestion"

/**
 * The `city` column's contract after 2026-08-21: one unit, the local authority
 * district, or null. Everything here is about what may be written into it.
 */
class TestAdapter extends SourceAdapter {
  name = "test"
  type = "hmo_register" as const
  phase = 1 as const
  async fetch(): Promise<PropertyListing[]> {
    return []
  }
  // The resolver is protected; these expose it for the test only.
  district(postcode: string) {
    return this.getDistrictFromPostcode(postcode)
  }
  lookup(postcode: string) {
    return this.lookupPostcode(postcode)
  }
}

function respondWith(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response)
}

const READING = {
  status: 200,
  result: { latitude: 51.4562, longitude: -0.9705, admin_district: "Reading" },
}

describe("getDistrictFromPostcode", () => {
  let adapter: TestAdapter
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    adapter = new TestAdapter()
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    // The cache is static and shared, so each test uses its own postcodes.
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns the local authority, not the county or the post town", () => {
    // The row that motivated this: Zoopla calls RG2 "Berkshire", the post town
    // is Reading, and the licensing authority is Reading Borough Council.
    fetchMock.mockReturnValue(respondWith(READING))
    return expect(adapter.district("RG2 0DX")).resolves.toBe("Reading")
  })

  it("returns null when the postcode does not resolve", async () => {
    // Never a guess, and never a nearby city. An unplaced property is not a
    // property in some other authority.
    fetchMock.mockReturnValue(respondWith({ status: 404 }, false))
    await expect(adapter.district("ZZ99 9ZZ")).resolves.toBeNull()
  })

  it("returns null when the API answers without a district", async () => {
    fetchMock.mockReturnValue(
      respondWith({ status: 200, result: { latitude: 51.4, longitude: -0.9 } })
    )
    await expect(adapter.district("RG3 0AA")).resolves.toBeNull()
  })

  it("returns null for an empty postcode without calling out", async () => {
    await expect(adapter.district("")).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("retries once with the space, then stops", async () => {
    fetchMock.mockReturnValue(respondWith({ status: 404 }, false))
    await adapter.district("RG4 0AA")
    // Unspaced, then spaced. Not a third attempt.
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0][0])).toContain("RG40AA")
    expect(String(fetchMock.mock.calls[1][0])).toContain("RG4%200AA")
  })

  it("survives a network error rather than failing the ingest", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"))
    await expect(adapter.district("RG5 0AA")).resolves.toBeNull()
  })

  it("caches, so the district and the coordinates cost one call between them", async () => {
    fetchMock.mockReturnValue(respondWith(READING))
    const first = await adapter.lookup("RG6 0AA")
    const second = await adapter.lookup("RG6 0AA")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(first).toEqual({ lat: 51.4562, lng: -0.9705, district: "Reading" })
    expect(second).toEqual(first)
  })

  it("carries the coordinates alongside the district, from one response", async () => {
    // The district used to be dropped from this exact payload.
    fetchMock.mockReturnValue(respondWith(READING))
    const lookup = await adapter.lookup("RG7 0AA")
    expect(lookup?.lat).toBe(51.4562)
    expect(lookup?.lng).toBe(-0.9705)
    expect(lookup?.district).toBe("Reading")
  })
})

describe("the postcode-area guess that used to stand here", () => {
  it("is gone from the codebase entirely", async () => {
    // It took the first two letters, and fell back to the FIRST LETTER when
    // that missed — so SO16 (Southampton) resolved through "S" to Sheffield,
    // BN (Brighton) through "B" to Birmingham, EX (Exeter) through "E" to
    // London, and LL (North Wales) through "L" to Liverpool. A UK postcode area
    // is the letters before the first digit; truncating to one is not a
    // degraded answer, it is a different postcode's answer.
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("lib/types/ingestion.ts", "utf8")
    )
    expect(source).not.toContain("postcodeToCity")
    expect(source).not.toContain("getCityFromPostcode(postcode: string): string")
  })
})
