/**
 * Scoring the Article 4 pipeline against hand-verified ground truth.
 *
 * Accuracy is the product, and phase 2 sells it. That claim has to be measured
 * or it is marketing. This module turns the gold set into numbers, with two
 * safeguards that stop those numbers from flattering us:
 *
 *  1. Only entries a human has confirmed are scored. Seeded rows are excluded,
 *     so coverage cannot be inflated by data nobody checked.
 *
 *  2. Entries verified from the SAME source the pipeline reads are excluded from
 *     the headline. Scoring planning.data.gov.uk predictions against
 *     planning.data.gov.uk truth measures nothing but agreement with itself.
 *     Ground truth has to come from the council.
 *
 * The metric that matters here is recall, not precision. The pipeline never
 * asserts a negative, so it is structurally near-incapable of a false positive;
 * what it does is miss. A missed Article 4 is the failure that costs someone a
 * purchase, so `misses` is reported separately and never averaged away.
 */

export type GoldStatus = "verified" | "unverified"

export interface GoldEntry {
  slug: string
  name: string
  gssCode: string | null
  status: GoldStatus
  seededAs?: string
  expected: {
    hasHmoArticle4: boolean | null
    extent: string | null
    commencedOn: string | null
  }
  evidence: {
    /** True only when confirmed against a source the pipeline does not read. */
    independentSource: boolean
    sourceUrl: string | null
    quote: string | null
  }
  verifiedBy: string | null
  verifiedAt: string | null
  notes?: string
}

export interface GoldSet {
  version: number
  description?: string
  seededAt?: string | null
  councils: GoldEntry[]
}

/** What the pipeline says. It never claims a negative, hence `unknown`. */
export type Prediction = "yes" | "unknown"

export type Outcome =
  | "true_positive"
  | "false_positive"
  | "miss"
  | "correct_abstention"
  | "unscorable"

export interface CouncilResult {
  slug: string
  name: string
  expected: boolean | null
  predicted: Prediction
  outcome: Outcome
  reason?: string
}

export interface EvalReport {
  /** Entries meeting the bar for scoring. */
  scored: number
  totalEntries: number
  pendingVerification: number
  excludedAsCircular: number

  truePositives: number
  falsePositives: number
  misses: number
  correctAbstentions: number

  /** Of what we claimed, how much was right. Null when nothing was claimed. */
  precision: number | null
  /** Of what actually exists, how much we found. The number that matters. */
  recall: number | null
  /** Share of real Article 4 councils the pipeline fails to surface. */
  missRate: number | null

  results: CouncilResult[]
  /** Reasons the headline figures must not be quoted yet, if any. */
  warnings: string[]
}

/** Minimum independently-verified entries before a headline figure means anything. */
export const MIN_SCORABLE_FOR_HEADLINE = 30

/**
 * An entry counts only when a human confirmed it against a source the pipeline
 * does not itself read.
 */
export function isScorable(entry: GoldEntry): boolean {
  return (
    entry.status === "verified" &&
    entry.evidence.independentSource === true &&
    entry.expected.hasHmoArticle4 !== null
  )
}

export function classify(expected: boolean | null, predicted: Prediction): Outcome {
  if (expected === null) return "unscorable"
  if (predicted === "yes") return expected ? "true_positive" : "false_positive"
  // The pipeline abstained. Right if there is nothing there, a miss if there is.
  return expected ? "miss" : "correct_abstention"
}

/**
 * Score a gold set against predictions.
 *
 * `predict` returns what the pipeline concludes for a council slug. Injected so
 * this stays pure and the same harness can score the current registry today and
 * the LLM extractor later.
 */
export function scoreGoldSet(
  gold: GoldSet,
  predict: (slug: string) => Prediction
): EvalReport {
  const results: CouncilResult[] = []
  const warnings: string[] = []

  let pending = 0
  let circular = 0

  for (const entry of gold.councils) {
    if (entry.status !== "verified") {
      pending++
      continue
    }
    if (!entry.evidence.independentSource) {
      circular++
      continue
    }
    if (entry.expected.hasHmoArticle4 === null) {
      results.push({
        slug: entry.slug,
        name: entry.name,
        expected: null,
        predicted: predict(entry.slug),
        outcome: "unscorable",
        reason: "verified but no expected value recorded",
      })
      continue
    }

    const predicted = predict(entry.slug)
    results.push({
      slug: entry.slug,
      name: entry.name,
      expected: entry.expected.hasHmoArticle4,
      predicted,
      outcome: classify(entry.expected.hasHmoArticle4, predicted),
    })
  }

  const count = (o: Outcome) => results.filter((r) => r.outcome === o).length
  const truePositives = count("true_positive")
  const falsePositives = count("false_positive")
  const misses = count("miss")
  const correctAbstentions = count("correct_abstention")
  const scored = truePositives + falsePositives + misses + correctAbstentions

  const claimed = truePositives + falsePositives
  const actual = truePositives + misses

  if (scored === 0) {
    warnings.push(
      "No independently-verified entries. Every figure below is undefined — do not quote an accuracy number."
    )
  } else if (scored < MIN_SCORABLE_FOR_HEADLINE) {
    warnings.push(
      `Only ${scored} independently-verified entries (want ${MIN_SCORABLE_FOR_HEADLINE}+). Figures are indicative, not publishable.`
    )
  }

  if (circular > 0) {
    warnings.push(
      `${circular} verified entries excluded: they cite the same source the pipeline reads, so scoring against them would measure agreement with itself.`
    )
  }

  if (pending > 0) {
    warnings.push(`${pending} entries still awaiting human verification.`)
  }

  return {
    scored,
    totalEntries: gold.councils.length,
    pendingVerification: pending,
    excludedAsCircular: circular,
    truePositives,
    falsePositives,
    misses,
    correctAbstentions,
    precision: claimed > 0 ? truePositives / claimed : null,
    recall: actual > 0 ? truePositives / actual : null,
    missRate: actual > 0 ? misses / actual : null,
    results,
    warnings,
  }
}

/** Human-readable summary for CI logs and progress reporting. */
export function formatReport(report: EvalReport): string {
  const pct = (v: number | null) => (v === null ? "n/a" : `${(v * 100).toFixed(1)}%`)
  const lines = [
    `Article 4 eval — ${report.scored} scored of ${report.totalEntries} entries`,
    `  true positives     ${report.truePositives}`,
    `  false positives    ${report.falsePositives}`,
    `  misses             ${report.misses}`,
    `  correct abstention ${report.correctAbstentions}`,
    `  precision ${pct(report.precision)}   recall ${pct(report.recall)}   miss rate ${pct(report.missRate)}`,
  ]

  const missed = report.results.filter((r) => r.outcome === "miss")
  if (missed.length) {
    lines.push(`  missed: ${missed.map((m) => m.slug).join(", ")}`)
  }
  for (const w of report.warnings) lines.push(`  WARNING: ${w}`)

  return lines.join("\n")
}
