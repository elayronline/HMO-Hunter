import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { globSync } from "node:fs"

/**
 * The seeded licence columns must not reach a reader.
 *
 * scripts/DO_NOT_RUN_012_populate_licence_term_data.sql wrote licence_id,
 * licence_start_date, licence_end_date and max_occupants onto 252 rows from
 * hardcoded per-city constants — six distinct end dates in total, references
 * built from MD5(address), occupancy set to bedrooms + 1. Every value those
 * columns hold today is seed fiction, so a component that renders one is
 * presenting an invented fact as register data.
 *
 * Ingestion may legitimately write them, and the licences feature has its own
 * `licence` objects that are a different shape; both are excluded below. What
 * this guards is the read path a user sees.
 */
const SEEDED = ["licence_id", "licence_start_date", "licence_end_date", "max_occupants"]

const WRITERS_AND_TYPES = [
  "lib/ingestion/",
  "lib/types/",
  "app/api/enrich-hmo-licence/",
  "app/api/scrape-council-hmo/",
  "app/api/licences/",
  "lib/config/ai-intelligence.ts",
  // Reads them, but its only consumer is /api/intelligence, which nothing calls.
  "lib/services/data-intelligence.ts",
  "lib/services/property-insights.ts",
  // Take a `licence` object from the licences API, not a property row.
  "components/licence-card.tsx",
  "components/licence-details-card.tsx",
]

function sourceFiles(): string[] {
  return globSync("{app,components,lib}/**/*.{ts,tsx}").filter(
    (f) => !WRITERS_AND_TYPES.some((prefix) => f.startsWith(prefix))
  )
}

/** Strip comments so the explanations of this rule do not trip it. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n")
}

describe("seeded licence columns stay out of the read path", () => {
  it("no user-facing file reads them", () => {
    const offenders: string[] = []
    for (const file of sourceFiles()) {
      const body = code(readFileSync(file, "utf8"))
      for (const column of SEEDED) {
        if (new RegExp(`\\b(property|input|p)\\.${column}\\b`).test(body)) {
          offenders.push(`${file} reads ${column}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
