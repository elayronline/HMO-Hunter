/**
 * Shape and formatting for the figures the public landing page quotes.
 *
 * This module is imported by client components, so it must stay free of any
 * server-only dependency. The query that fills it lives in
 * `lib/landing-stats.server.ts`; importing that from a client component pulls
 * `next/headers` into the browser bundle and fails the build.
 *
 * Every number here is counted from the properties table at request time. None
 * is ever written down in the copy, because a hardcoded figure is a claim that
 * stops being true the day after it is typed — which is exactly what happened
 * to the beta-places counter this replaces.
 */
export interface LandingStats {
  /** Properties in the searchable inventory. */
  properties: number
  /** Distinct planning authorities resolved across that inventory. */
  councils: number
  /** Properties inside an Article 4 direction that is in force. */
  inForce: number
  /** Properties a council source positively places outside one. */
  noneFound: number
  /** Properties where no source settles the question either way. */
  notEstablished: number
  /** Properties whose Article 4 position came from the council itself. */
  councilVerified: number
}

/** 2958 -> "2,958". Used so quoted counts read as figures, not identifiers. */
export function formatCount(n: number): string {
  return n.toLocaleString("en-GB")
}
