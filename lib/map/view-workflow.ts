/**
 * The rules behind the map/list workflow, kept out of the 2,200-line page so
 * they can be tested directly.
 *
 * The shape of the journey these encode:
 *
 *   list (default) --click row--> detail panel beside the list, nothing navigates
 *                  --show on map--> map, flown to that property, still selected
 *                  --toggle--> map, whole filtered set, selection preserved
 *   map            --click pin--> same detail panel
 *                  --toggle--> list, scrolled to the selected row
 *
 * The list is the default because it answers "what have I got?" without waiting
 * for tiles, and because nothing is hidden by starting there — every property in
 * the table carries a valid UK coordinate, so the two views show the same set.
 *
 * There is deliberately no stored view preference. React hydrates the map
 * route's Suspense boundary lazily, so a preference restored in an effect does
 * not apply on load and, when it eventually does, changes the view under
 * someone already reading. The URL carries the choice instead.
 */

export type ViewMode = "map" | "list"

/**
 * The view a page load should open in, given the `view` URL parameter.
 *
 * Only ever reads the URL. A stored preference is applied after mount instead,
 * because deriving initial state from localStorage makes the server and client
 * render different trees — the hydration mismatch this page has been bitten by
 * before.
 */
export function initialViewMode(param: string | null | undefined): ViewMode {
  return param === "map" ? "map" : "list"
}

/**
 * What `view` should say in the URL, or null to drop the parameter.
 *
 * List is the default, so map is the state worth recording. Keeping the default
 * out of the URL means a bare /map link means "however this reader works".
 */
export function viewParam(mode: ViewMode): string | null {
  return mode === "list" ? null : mode
}

/**
 * The URL to leave behind once `?property=` has been consumed.
 *
 * This replaced the whole address with "/" before, which pointed the bar at the
 * marketing page: following a deep link into a property silently discarded the
 * map, its filters and the view, and a refresh left the application entirely.
 * Every other parameter has to survive.
 */
export function urlAfterPropertyConsumed(search: string): string {
  const params = new URLSearchParams(search)
  params.delete("property")
  const query = params.toString()
  return query ? `/map?${query}` : "/map"
}

export interface Locatable {
  id: string
  latitude: number | null
  longitude: number | null
}

/**
 * For each property, how many *others* sit on its exact coordinate.
 *
 * Properties with no coordinate are absent from the result rather than counted
 * as sharing one — "no location" and "shares a location" are different facts,
 * and collapsing them would have every unmappable property claim neighbours.
 *
 * Measured across the table on 2026-08-19: 452 of 2,958 properties share a
 * point with at least one other, over 175 points, the largest holding 20. That
 * is why "show on map" says how crowded the destination is before going there.
 */
export function countCoincident(properties: readonly Locatable[]): Map<string, number> {
  const byPoint = new Map<string, string[]>()
  for (const property of properties) {
    if (property.latitude == null || property.longitude == null) continue
    const key = `${property.latitude},${property.longitude}`
    const bucket = byPoint.get(key)
    if (bucket) bucket.push(property.id)
    else byPoint.set(key, [property.id])
  }

  const counts = new Map<string, number>()
  for (const ids of byPoint.values()) {
    if (ids.length < 2) continue
    for (const id of ids) counts.set(id, ids.length - 1)
  }
  return counts
}
