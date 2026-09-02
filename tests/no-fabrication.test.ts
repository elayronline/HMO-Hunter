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

  // This assertion used to pin the opposite: that the route wrote its computed
  // rent whenever a property was listing_type "rent" and had no price yet,
  // guarding only against overwriting a figure that already existed. That guard
  // aimed at the right target and still let 216 licence-register records through
  // — they are listing_type "rent" because there is no off_market value for
  // them, and they have no price because nobody is letting them. The condition
  // was not too loose; writing the column at all was the mistake. See the
  // dedicated describe block below.
  it("does not write a computed rent into the advertised-price column", () => {
    expect(route).not.toContain("!property.price_pcm ? totalRent : property.price_pcm")
  })
})

/**
 * price_pcm means "a landlord is advertising this". Nothing computed goes in it.
 *
 * /api/enrich-rents used to write its modelled figure there whenever a property
 * was listing_type "rent" and had no price yet. That guard was aimed at the
 * right target — never overwrite a real advertised figure — but it did not
 * consider a property that is not advertised at all.
 *
 * propertydata-hmo.ts stores licence-register records as listing_type "rent",
 * because there is no off_market value to give them, and they carry no price
 * because nobody is letting them. Both conditions, exactly. 216 register records
 * were handed a monthly rent for a letting that does not exist, and the property
 * card reports that column as what the property achieves today.
 *
 * Narrowing the condition would only move the hole, so the column is simply not
 * written from a computed value. The modelled figure lives in
 * estimated_gross_monthly_rent, which the hero reads and labels as modelled.
 */
describe("computed rents never reach price_pcm", () => {
  const RENT_ROUTE = join("app", "api", "enrich-rents", "route.ts")

  it("enrich-rents does not assign price_pcm", () => {
    const src = readFileSync(RENT_ROUTE, "utf8")
    // Strip comments so the explanation above (which names the column) does not
    // trip the check that the code no longer sets it.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n")
    expect(code).not.toMatch(/price_pcm\s*:/)
  })

  it("still writes the modelled figure to its own column", () => {
    const src = readFileSync(RENT_ROUTE, "utf8")
    expect(src).toMatch(/estimated_gross_monthly_rent\s*:/)
    expect(src).toMatch(/estimated_rent_per_room\s*:/)
  })
})

/**
 * The hero bar shows observed figures, or arithmetic on observed figures.
 *
 * PR #26 removed "Net Yield" (grossYield × 0.7) and "Cashflow" (30% costs, 75%
 * LTV, 5.5% interest, all hardcoded) from property-detail-card.tsx. The audit
 * found both still live in hero-metrics-bar.tsx — the same two figures, on the
 * same page, because the fix was applied to one component and not its twin.
 *
 * That is the failure this block exists to catch: not the original mistake, but
 * a correct fix landing on one call site while its duplicate keeps rendering.
 */
describe("the hero metrics bar states nothing it cannot source", () => {
  const HERO = join("components", "hero-metrics-bar.tsx")
  // Comments describe the removed arithmetic, so they must not count as its
  // presence — the same trap as the enrich-rents check above.
  const code = readFileSync(HERO, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n")

  it("does not apply a flat haircut to a yield and call it net", () => {
    expect(code).not.toMatch(/netYield/)
    expect(code).not.toMatch(/\*\s*0\.7\b/)
  })

  it("does not model cashflow from assumed costs, LTV and interest", () => {
    expect(code).not.toMatch(/monthlyCashflow/)
    expect(code).not.toMatch(/0\.055/)
    expect(code).not.toMatch(/0\.75\b/)
    expect(code).not.toMatch(/\*\s*0\.3\b/)
  })

  it("does not label a metric Net Yield or Cashflow", () => {
    expect(code).not.toMatch(/"Net Yield"/)
    expect(code).not.toMatch(/"Cashflow"/)
  })
})
