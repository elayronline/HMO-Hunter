import { UK_CITIES, ALL_CITIES_OPTION, type UKCity } from "@/lib/data/uk-cities"

/**
 * Where a location filter looks, and why it stopped looking at the `city`
 * column.
 *
 * The filter used to be `.eq("city", name)` against a hand-written list of 31
 * cities. `city` is free text written by whichever adapter ingested the row,
 * and the sources do not agree on granularity: some wrote a town, some wrote a
 * county. Measured across the 1,160 served properties on 2026-08-21:
 *
 * - **19 of the 31 options returned nothing.** Reading 0 while 74 Berkshire
 *   rows sat there. Brighton 0 against 67 in East Sussex. Coventry 0 against
 *   108 under West Midlands. Oxford 0, Cambridge 0, Bradford 0, Portsmouth 0.
 * - **639 rows — 55% of everything served — lived under a value the dropdown
 *   never offered**, so postcode search was the only way to reach them.
 * - Where both spellings existed the city silently lost half its stock:
 *   Manchester returned 36 and omitted 55 more filed as Greater Manchester;
 *   Birmingham returned 32 against 108 under West Midlands.
 *
 * None of that is fixable by renaming values. A row recorded as "Berkshire"
 * may be in Reading, Slough or Newbury — the column does not say, and guessing
 * would be inventing the fact. But every property carries a verified UK
 * coordinate, so the question "is this near Reading?" can be answered from
 * what is actually recorded rather than from what someone typed.
 *
 * Hence a catchment: a centre and a radius. The claim the UI can then make is
 * exactly the claim the data supports — *near* this city, not *in* it.
 */

/**
 * How far a city's catchment reaches, keyed by the zoom UK_CITIES already
 * carries. Zoom is that list's existing statement of how large a place is, so
 * the radius follows it rather than introducing a second, disagreeing opinion:
 * London (11) is a conurbation, most entries (12) are cities, and the compact
 * ones (13) are Oxford, Cambridge, York, Lisburn and Newry.
 *
 * Measured at these radii on 2026-08-21, every option that has stock now
 * returns it — Reading 74, Brighton 67, Coventry 55, Bradford 52, Oxford 40,
 * Cambridge 38, Portsmouth 24 — and 1,109 of 1,160 served properties are
 * reachable through some option. The twelve that still return nothing return
 * nothing truthfully: Plymouth, York, Edinburgh, Glasgow, Aberdeen, Dundee,
 * Swansea, Newport, Belfast, Derry, Lisburn and Newry hold no served stock at
 * any radius. Edinburgh is the one to understand — it holds 100 properties,
 * every one an unlicensed rental, so none is served to this view.
 */
export const RADIUS_KM_BY_ZOOM: Record<number, number> = {
  11: 25,
  12: 15,
  13: 8,
}

/** Falls back to the commonest scale rather than throwing on an unseen zoom. */
export function radiusKmForZoom(zoom: number): number {
  return RADIUS_KM_BY_ZOOM[zoom] ?? RADIUS_KM_BY_ZOOM[12]
}

export type Catchment = {
  name: string
  latitude: number
  longitude: number
  radiusKm: number
}

/**
 * The catchment for a city option, or null for "All Cities" and for any name
 * not on the list.
 *
 * Resolved here from UK_CITIES rather than from coordinates sent by the
 * client. The client already knows the centre — it has to, to move the map —
 * but a filter that accepts arbitrary coordinates over the wire accepts a
 * query the whitelist was written to prevent.
 */
export function cityCatchment(name: string | undefined): Catchment | null {
  if (!name || name === ALL_CITIES_OPTION.name) return null
  const city = UK_CITIES.find((c: UKCity) => c.name === name)
  if (!city) return null
  return {
    name: city.name,
    latitude: city.latitude,
    longitude: city.longitude,
    radiusKm: radiusKmForZoom(city.zoom),
  }
}

/**
 * The smallest latitude/longitude rectangle containing the catchment circle.
 *
 * PostgREST can express a box and cannot express a circle, so the box is what
 * the query filters on and `withinCatchment` trims the corners afterwards. The
 * box alone would over-return by up to the difference between a circle and its
 * square — at the diagonal that is 21km on a 15km radius, which is the width
 * of another town.
 *
 * A degree of latitude is ~111.32 km everywhere; a degree of longitude shrinks
 * with the cosine of the latitude, which over the UK's 50°–58° range is the
 * difference between 71 km and 59 km per degree. Using the flat figure for
 * both would make the box too narrow in the north and lose properties.
 */
export function boundingBox(catchment: Catchment) {
  const KM_PER_DEGREE_LAT = 111.32
  const dLat = catchment.radiusKm / KM_PER_DEGREE_LAT
  const dLng =
    catchment.radiusKm /
    (KM_PER_DEGREE_LAT * Math.cos((catchment.latitude * Math.PI) / 180))
  return {
    minLat: catchment.latitude - dLat,
    maxLat: catchment.latitude + dLat,
    minLng: catchment.longitude - dLng,
    maxLng: catchment.longitude + dLng,
  }
}

/** Great-circle distance in km. */
export function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const EARTH_RADIUS_KM = 6371
  const toRad = Math.PI / 180
  const dLat = (bLat - aLat) * toRad
  const dLng = (bLng - aLng) * toRad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

/**
 * Whether a property falls inside the catchment.
 *
 * A property with no coordinate is not near anywhere — it is a property whose
 * position nobody recorded — so it fails rather than passes. That is the
 * opposite of how the price filter treats an absent price, and deliberately
 * so: an unpriced off-market HMO is still the thing the user is looking for,
 * while an unplaceable one cannot be the answer to "what is near Reading?".
 * Nothing served holds a null coordinate today (0 of 1,160, checked
 * 2026-08-21), so this decides no rows yet.
 */
export function withinCatchment(
  property: { latitude?: number | null; longitude?: number | null },
  catchment: Catchment
): boolean {
  const { latitude, longitude } = property
  if (typeof latitude !== "number" || typeof longitude !== "number") return false
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return false
  return (
    distanceKm(catchment.latitude, catchment.longitude, latitude, longitude) <=
    catchment.radiusKm
  )
}

/** "within 15 km of Reading" — the panel's wording and the tests' both. */
export function catchmentLabel(catchment: Catchment): string {
  return `within ${catchment.radiusKm} km of ${catchment.name}`
}
