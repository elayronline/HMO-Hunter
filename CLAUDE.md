
## No fabricated data — the platform's core rule

The product's value to a user is accurate sourcing and accurate verification, and
nothing else. A single invented figure destroys the credibility of every other
figure, because a reader cannot tell which is which once both sit in the same
column.

**Every user-facing value must be one of three things:**

1. **Observed** — read from a named source, carrying that source and a date.
2. **Derived** — computed from observed values by arithmetic the report states
   in words ("the city average room rent × the current bedroom count").
3. **Absent** — and said to be absent. "Not published" and "Not established"
   are legitimate answers. A plausible-looking placeholder is not.

There is no fourth option. "Realistic sample data", "so the UI has something to
show", and "an estimate to fill the gap" all mean the same thing as wrong.

**In practice:**

- Never `Math.random()` outside pure presentation (a skeleton's width claims
  nothing). `tests/no-fabrication.test.ts` enforces this across `lib`, `app`,
  `components` and `scripts`.
- Never build an ingestion identifier from `Date.now()` or a random draw. A key
  that moves between runs cannot dedupe, so each sync inserts the same record
  again. Derive it from the thing itself — postcode plus address, or the natural
  key of a transaction.
- Never write an estimate into a column that also holds observed values, unless
  the read path can still tell them apart. `purchase_price` means *a vendor is
  asking this*; a property that is not on the market has no asking price.
- Never overwrite an observed value with a computed one.
- An estimate must be reproducible. A number that differs between two runs for
  the same input was never an estimate.

**What this cost when it was violated:** an enrichment route divided a rent it
had itself invented by a random yield between 6.5% and 8.5% and stored the
result as a purchase price. One licensed HMO held £425,000 and £495,000 in two
rows, and the report rendered both as "Asking price · recorded · source:
Listing" for a property that had never been listed. 678 rows carried a price no
source had ever published.
