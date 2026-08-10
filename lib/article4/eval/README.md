# Article 4 gold eval set

Ground truth for HMO Article 4 by council. This is what turns "accurate" from a
claim into a measurement — and phase 2 sells that measurement, so the bar for
what counts is deliberately high.

## The two rules

**1. Nothing counts until a human confirms it.** Every one of the 75 seeded
entries is `status: "unverified"` — a hypothesis, not a fact. The harness
excludes them and reports them as pending.

**2. Verification must be independent.** An entry confirmed against
planning.data.gov.uk does not count, because that is the same source the
pipeline reads. Scoring it would measure the pipeline's agreement with itself.
Ground truth comes from the **council's own website** — their Article 4 page,
planning policy pages, or the direction notice itself.

Entries failing either rule are excluded and surfaced in `warnings`, so a thin
gold set can never quietly produce a flattering headline figure.

## How to verify an entry

1. Find the council's own Article 4 / HMO planning page.
2. Record what you find:

```json
{
  "slug": "manchester",
  "name": "Manchester",
  "gssCode": "E08000003",
  "status": "verified",
  "expected": {
    "hasHmoArticle4": true,
    "extent": "city-wide",
    "commencedOn": "2020-04-06"
  },
  "evidence": {
    "independentSource": true,
    "sourceUrl": "https://www.manchester.gov.uk/…",
    "quote": "…verbatim sentence from the council page confirming it…"
  },
  "verifiedBy": "your-name",
  "verifiedAt": "2026-08-10T12:00:00.000Z",
  "notes": ""
}
```

`quote` matters: it is what a later dispute gets resolved against, and it is the
same evidence standard the extraction pipeline is held to.

A confirmed **negative** is as valuable as a positive — set
`hasHmoArticle4: false`. Without real negatives the harness cannot detect
over-claiming.

## What the seed categories mean

| `seededAs` | Count | What to do |
|---|---|---|
| `machine-positive` | 45 | Councils the national feed reports. Confirm on the council site — these are cheap wins but only count with an independent source. |
| `known-missing` | 24 | Believed to operate an Article 4 but absent from the feed. **Verify these first** — they are the failure the eval set exists to measure. |
| `likely-negative` | 6 | Believed clear. Confirming these is what proves the pipeline is not over-claiming. |

## Running it

```bash
npx vitest run tests/article4-eval.test.ts
```

Prints precision, recall and miss rate, and names every council missed.

## Reading the numbers

**Recall is the metric, not precision.** The pipeline never asserts a negative,
so it is structurally near-incapable of a false positive — precision will sit at
or near 100% and means very little. What it does is *miss*. A missed Article 4
is what costs someone a purchase, so `missRate` is reported separately and never
averaged into a single score.

`MIN_SCORABLE_FOR_HEADLINE` is 30. Below that the harness marks results
indicative and not publishable. Do not quote a figure that carries a warning.
