import { describe, it, expect } from "vitest"
import { stableId } from "@/lib/ingestion/adapters/propertydata-hmo"

/**
 * The identifier is the dedupe key on ingestion. When it moved between runs —
 * the old fallback embedded Date.now() — every sync laid down another copy of
 * the same property, and 31 licence register records ended up in the database
 * twice, each copy carrying a different estimated price.
 */
describe("register records keep one identity across runs", () => {
  it("returns the same identifier for the same property every time", () => {
    const a = stableId("LS2 9AZ", "13 Archery Place Woodhouse Leeds LS2 9AZ")
    const b = stableId("LS2 9AZ", "13 Archery Place Woodhouse Leeds LS2 9AZ")
    expect(a).toBe(b)
  })

  it("separates two unreferenced licences in the same postcode", () => {
    expect(stableId("LS6 3HN", "28 Bennett Road")).not.toBe(stableId("LS6 3HN", "30 Bennett Road"))
  })

  it("ignores spacing and case in the postcode", () => {
    expect(stableId("ls29az", "13 Archery Place")).toBe(stableId("LS2 9AZ", "13 Archery Place"))
  })

  it("contains no digits that could be a timestamp", () => {
    const id = stableId("LS2 9AZ", "13 Archery Place")
    expect(id).not.toMatch(/\d{13}/)
  })
})
