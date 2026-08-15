import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

/**
 * The platform is worth using because its numbers are real.
 *
 * A sourcer's whole reason to open this rather than a portal is that what it
 * says about an address can be relied on. A single invented figure destroys
 * that for every other figure too, because the reader has no way to tell which
 * is which — and invented data is indistinguishable from real data once it is
 * sitting in the same column.
 *
 * This is not hypothetical. An enrichment route generated purchase prices by
 * dividing a rent it had itself made up by a random yield between 6.5% and
 * 8.5%, and wrote them into the same column as genuine asking prices. The same
 * licensed HMO carried £425,000 in one row and £495,000 in another, and the
 * report presented both as "Asking price · recorded · source: Listing".
 *
 * So the rule is absolute: nothing user-facing is ever generated. A figure is
 * observed from a source, derived from observed figures by stated arithmetic,
 * or absent. There is no fourth option, and "realistic placeholder" is the same
 * thing as wrong.
 *
 * Randomness in an identifier is the same failure wearing a different hat: an
 * id that changes between runs cannot dedupe, so every sync lays down another
 * copy of a record that already exists.
 */

const ROOTS = ["lib", "app", "components", "scripts"]

/**
 * Where randomness is legitimate: it decorates, it does not inform. A skeleton
 * placeholder's width is not a claim about anything.
 */
const PRESENTATION_ONLY = [join("components", "ui", "sidebar.tsx")]

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue
      out.push(...sourceFiles(path))
    } else if (/\.tsx?$/.test(entry) && !entry.includes(".test.")) {
      out.push(path)
    }
  }
  return out
}

const FILES = ROOTS.flatMap((r) => sourceFiles(r))

describe("nothing user-facing is generated", () => {
  it("has files to check, so a broken walk cannot pass silently", () => {
    expect(FILES.length).toBeGreaterThan(100)
  })

  it("never invents a value with Math.random outside presentation", () => {
    const offenders = FILES.filter(
      (f) =>
        !PRESENTATION_ONLY.some((allowed) => f.endsWith(allowed)) &&
        readFileSync(f, "utf8").includes("Math.random()")
    )
    expect(offenders).toEqual([])
  })

  // An identifier built from the clock is a new identifier every run, which
  // means the upsert key never matches and the record is inserted again.
  it("never builds an ingestion identifier from the clock", () => {
    const offenders = FILES.filter((f) => f.includes(join("lib", "ingestion"))).filter((f) => {
      const src = readFileSync(f, "utf8")
      return /(external_id|transactionId)\s*:[^,\n]*Date\.now\(\)/.test(src)
    })
    expect(offenders).toEqual([])
  })
})

describe("the rent estimate is a stated average, not a plausible-looking number", () => {
  const route = readFileSync(join("app", "api", "enrich-rents", "route.ts"), "utf8")

  it("does not jitter the city average to make it look measured", () => {
    expect(route).not.toContain("Math.random()")
    expect(route).not.toContain("generateRoomRent")
  })

  // A price is published by a vendor or it does not exist. It is never
  // back-calculated from a rent this codebase estimated in the first place.
  it("does not derive a purchase price from an estimated rent", () => {
    expect(route).not.toMatch(/purchasePrice\s*=\s*Math\.round\(annualRent/)
  })

  it("does not overwrite an advertised let price with a computed one", () => {
    expect(route).toContain("!property.price_pcm ? totalRent : property.price_pcm")
  })
})
