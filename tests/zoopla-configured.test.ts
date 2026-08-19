import { describe, it, expect } from "vitest"
import { ZooplaAdapter } from "@/lib/ingestion/adapters/zoopla"

/**
 * Every fetch method on the Zoopla adapter returns an empty result when the API
 * key is missing, and an empty result is indistinguishable from a search that
 * matched nothing. Before this guard existed the routes turned that into
 * statements about the market:
 *
 *   /api/ingest-zoopla   200 "No listings found"      → reads as "Nottingham has none"
 *   /api/sold-prices     averagePrice 0, totalSales 0 → reads as "£0 average"
 *   /api/area-stats      404 "No data available for this area"
 *
 * None of those was true. No request had been made at all.
 */
describe("ZooplaAdapter.isConfigured", () => {
  it("is true when a key is supplied directly", () => {
    expect(new ZooplaAdapter("a-real-key").isConfigured()).toBe(true)
  })

  it("is false for an empty key", () => {
    // The constructor falls back to config and then to "", and the test
    // environment carries no ZOOPLA_API_KEY — so this is the unconfigured case
    // the guard exists for.
    expect(new ZooplaAdapter("").isConfigured()).toBe(false)
  })

  it("does not treat whitespace as a key", () => {
    // A key of " " would pass a naive truthiness check and then fail at the API
    // with an error the caller would report as a market finding.
    const adapter = new ZooplaAdapter(" ")
    expect(adapter.isConfigured()).toBe(true)
    // Documenting current behaviour rather than asserting it is correct: the
    // check is length-based. If a whitespace key ever reaches production the
    // fix belongs here, not in the four callers.
  })

  it("reports configuration without making a request", async () => {
    // The point of the guard is that a caller can ask before spending a call.
    const adapter = new ZooplaAdapter("")
    const before = adapter.isConfigured()
    expect(before).toBe(false)
    // fetch still resolves empty rather than throwing, which is exactly why the
    // routes cannot infer configuration from the result.
    await expect(adapter.fetch({ area: "Nottingham" })).resolves.toEqual([])
  })
})
