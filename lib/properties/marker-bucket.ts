/**
 * Which marker a property actually gets on the map.
 *
 * The legend used to count segments while the map drew a priority cascade, and
 * those are two different partitions of the same data. `inSegment()` treats
 * Article 4 as an overlapping flag — a licensed HMO inside an Article 4 area is
 * in both the "licensed" and the "restricted" segment. The map returns on the
 * first branch that matches, so that same property is drawn red and nothing on
 * screen says it is licensed.
 *
 * Counting segments and then putting the number next to a colour swatch says
 * "this many dots look like this", which was false for every row but Article 4:
 * the legend claimed 494 licensed with a teal swatch when no row in the table
 * could render teal at all, and 98 lapsed licences against a single amber dot.
 *
 * So the cascade gets a name and one definition. The legend counts buckets, not
 * segments, and can only ever report what is on screen.
 *
 * The order below is the map's order and must stay in step with
 * `getMarkerStyle()` in components/map-inner.tsx.
 */

export type MarkerBucket =
  | "article4"
  | "expired"
  | "conversion"
  | "licensed"
  | "other"

export interface MarkerCandidate {
  article_4_status?: "in_force" | "none_found" | "unknown" | null
  licence_status?: string | null
  is_potential_hmo?: boolean | null
  hmo_status?: string | null
}

/**
 * Whether this address has an Article 4 position at all.
 *
 * 942 of 2,958 properties do not: their council publishes no boundary and no
 * page we could read, so nothing has been established either way. Drawn from
 * the boolean they were indistinguishable from the 536 checked and found
 * outside one, which states an answer the data does not have. The map keeps
 * them in whatever bucket they belong to and marks the edge instead, because
 * "we do not know" is not a category of property — it is a gap in what is held
 * about one.
 */
export function article4Unverified(property: MarkerCandidate): boolean {
  return property.article_4_status !== "in_force" &&
    property.article_4_status !== "none_found"
}

/**
 * `showConversionLayer` mirrors the map's `showPotentialHMOLayer` prop, which
 * gates the green markers.
 */
export function markerBucket(
  property: MarkerCandidate,
  showConversionLayer = true
): MarkerBucket {
  if (property.article_4_status === "in_force") return "article4"

  // The marker reads the council's own word for it and nothing else. A licence
  // whose expiry date has passed is counted as lapsed by categorise(), but it
  // is not drawn amber unless the status says so — which is why the legend's
  // lapsed count ran ahead of the amber dots.
  if (property.licence_status === "expired") return "expired"

  const isConversion =
    property.is_potential_hmo || property.hmo_status === "Potential HMO"
  if (isConversion && showConversionLayer) return "conversion"

  if (property.hmo_status === "Licensed HMO") return "licensed"

  return "other"
}

export function countMarkerBuckets(
  properties: MarkerCandidate[],
  showConversionLayer = true
): Record<MarkerBucket, number> & { unverified: number } {
  const counts = {
    article4: 0,
    expired: 0,
    conversion: 0,
    licensed: 0,
    other: 0,
    /** Cuts across the buckets rather than being one of them. */
    unverified: 0,
  }
  for (const p of properties) {
    counts[markerBucket(p, showConversionLayer)]++
    if (article4Unverified(p)) counts.unverified++
  }
  return counts
}
