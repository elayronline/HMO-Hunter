/**
 * Article 4 Prediction Engine
 *
 * Predicts areas likely to receive future Article 4 Directions
 * based on HMO concentration analysis, council patterns, and proximity
 * to existing Article 4 zones.
 *
 * Risk factors:
 *  1. HMO Density       — high concentration of HMOs per postcode sector
 *  2. Unlicensed Ratio   — proportion of unlicensed vs licensed HMOs
 *  3. Licence Churn      — expired licences not renewed (enforcement pressure)
 *  4. Article 4 Proximity — nearness to existing Article 4 boundaries
 *  5. Council Pattern     — councils that already have Article 4 tend to expand
 *  6. Complaint Pressure  — areas with many occupants / high density housing
 */

import type { Property } from "@/lib/types/database"

export interface PredictedArticle4Zone {
  id: string
  centroid: [number, number] // [lng, lat]
  radius_km: number
  risk_score: number // 0-100
  risk_level: "high" | "medium" | "low"
  postcode_sector: string
  council: string
  factors: PredictionFactor[]
  hmo_count: number
  unlicensed_count: number
  expired_count: number
  nearby_article4: boolean
}

export interface PredictionFactor {
  name: string
  score: number
  max: number
  description: string
}

// Councils known to have or be expanding Article 4 Directions
const EXPANDING_COUNCILS = new Set([
  "manchester", "salford", "leeds", "birmingham", "nottingham",
  "bristol", "brighton", "southampton", "portsmouth", "oxford",
  "cambridge", "coventry", "leicester", "sheffield", "newcastle",
  "liverpool", "cardiff", "reading", "exeter", "york",
  "bath", "canterbury", "durham", "lancaster", "lincoln",
  "loughborough", "warwick", "wolverhampton", "stoke-on-trent",
])

// Minimum thresholds to generate a prediction zone
const MIN_HMOS_FOR_PREDICTION = 3
const MIN_RISK_SCORE = 35

/**
 * Analyze properties and generate predicted Article 4 zones
 */
export function predictFutureArticle4Zones(
  properties: Property[],
  existingArticle4Features?: GeoJSON.Feature[]
): PredictedArticle4Zone[] {
  // Group properties by postcode sector (e.g., "M14 5", "LS6 3")
  const sectorGroups = groupByPostcodeSector(properties)

  const predictions: PredictedArticle4Zone[] = []

  for (const [sector, sectorProperties] of sectorGroups.entries()) {
    // Skip sectors that are already in Article 4 zones
    const allInArticle4 = sectorProperties.every(p => p.article_4_area)
    if (allInArticle4) continue

    // Need minimum HMO presence to make a prediction
    const hmoProperties = sectorProperties.filter(p =>
      p.hmo_status === "Licensed HMO" ||
      p.hmo_status === "Unlicensed HMO" ||
      p.licensed_hmo ||
      p.is_potential_hmo
    )

    if (hmoProperties.length < MIN_HMOS_FOR_PREDICTION) continue

    const factors: PredictionFactor[] = []
    let totalScore = 0

    // Factor 1: HMO Density (0-25 points)
    const densityScore = calculateDensityScore(hmoProperties, sectorProperties)
    factors.push(densityScore)
    totalScore += densityScore.score

    // Factor 2: Unlicensed Ratio (0-20 points)
    const unlicensedScore = calculateUnlicensedScore(sectorProperties)
    factors.push(unlicensedScore)
    totalScore += unlicensedScore.score

    // Factor 3: Licence Churn / Expired Licences (0-15 points)
    const churnScore = calculateChurnScore(sectorProperties)
    factors.push(churnScore)
    totalScore += churnScore.score

    // Factor 4: Proximity to Existing Article 4 (0-20 points)
    const proximityScore = calculateProximityScore(
      sectorProperties,
      existingArticle4Features
    )
    factors.push(proximityScore)
    totalScore += proximityScore.score

    // Factor 5: Council Expansion Pattern (0-15 points)
    const councilScore = calculateCouncilScore(sectorProperties)
    factors.push(councilScore)
    totalScore += councilScore.score

    // Factor 6: Occupancy Pressure (0-5 points)
    const pressureScore = calculatePressureScore(sectorProperties)
    factors.push(pressureScore)
    totalScore += pressureScore.score

    // Only include zones above minimum risk threshold
    if (totalScore < MIN_RISK_SCORE) continue

    // Calculate centroid of the sector
    const centroid = calculateCentroid(sectorProperties)

    // Radius based on spread of properties in the sector
    const radius = calculateSpreadRadius(sectorProperties, centroid)

    const riskLevel: "high" | "medium" | "low" =
      totalScore >= 70 ? "high" :
      totalScore >= 50 ? "medium" : "low"

    const unlicensedCount = sectorProperties.filter(p =>
      p.hmo_status === "Unlicensed HMO" || (!p.licensed_hmo && p.is_potential_hmo)
    ).length

    const expiredCount = sectorProperties.filter(p =>
      p.licence_status === "expired"
    ).length

    predictions.push({
      id: `predicted-${sector.replace(/\s+/g, "-")}`,
      centroid,
      radius_km: radius,
      risk_score: Math.min(100, totalScore),
      risk_level: riskLevel,
      postcode_sector: sector,
      council: sectorProperties[0]?.city || "Unknown",
      factors,
      hmo_count: hmoProperties.length,
      unlicensed_count: unlicensedCount,
      expired_count: expiredCount,
      nearby_article4: proximityScore.score > 0,
    })
  }

  // Sort by risk score descending
  return predictions.sort((a, b) => b.risk_score - a.risk_score)
}

/**
 * Convert predicted zones to GeoJSON for map display
 * Creates circular polygons around predicted centroids
 */
export function predictionsToGeoJSON(
  predictions: PredictedArticle4Zone[]
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = predictions.map(zone => {
    // Create a circle polygon (approximated with 32 points)
    const circle = createCirclePolygon(zone.centroid, zone.radius_km, 32)

    return {
      type: "Feature",
      properties: {
        id: zone.id,
        risk_score: zone.risk_score,
        risk_level: zone.risk_level,
        postcode_sector: zone.postcode_sector,
        council: zone.council,
        hmo_count: zone.hmo_count,
        unlicensed_count: zone.unlicensed_count,
        expired_count: zone.expired_count,
        nearby_article4: zone.nearby_article4,
        factors: JSON.stringify(zone.factors),
      },
      geometry: circle,
    }
  })

  return {
    type: "FeatureCollection",
    features,
  }
}

// ─── Helper Functions ───────────────────────────────────────────

function groupByPostcodeSector(properties: Property[]): Map<string, Property[]> {
  const groups = new Map<string, Property[]>()

  for (const property of properties) {
    if (!property.postcode) continue
    // Postcode sector: e.g., "M14 5" from "M14 5RX"
    const sector = getPostcodeSector(property.postcode)
    if (!sector) continue

    const existing = groups.get(sector) || []
    existing.push(property)
    groups.set(sector, existing)
  }

  return groups
}

function getPostcodeSector(postcode: string): string | null {
  const clean = postcode.trim().toUpperCase()
  // UK postcode: "M14 5RX" → sector "M14 5"
  const match = clean.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d)/)
  return match ? match[1].replace(/\s+/g, " ") : null
}

function calculateDensityScore(
  hmoProperties: Property[],
  allProperties: Property[]
): PredictionFactor {
  const max = 25
  const hmoRatio = allProperties.length > 0
    ? hmoProperties.length / allProperties.length
    : 0

  let score = 0
  if (hmoRatio >= 0.5) score = 25
  else if (hmoRatio >= 0.35) score = 20
  else if (hmoRatio >= 0.25) score = 15
  else if (hmoRatio >= 0.15) score = 10
  else if (hmoRatio >= 0.08) score = 5

  // Bonus for absolute count
  if (hmoProperties.length >= 10) score = Math.min(max, score + 5)
  else if (hmoProperties.length >= 6) score = Math.min(max, score + 3)

  return {
    name: "HMO Density",
    score,
    max,
    description: `${hmoProperties.length} HMOs out of ${allProperties.length} properties (${(hmoRatio * 100).toFixed(0)}%)`,
  }
}

function calculateUnlicensedScore(properties: Property[]): PredictionFactor {
  const max = 20
  const unlicensed = properties.filter(p =>
    p.hmo_status === "Unlicensed HMO" || (!p.licensed_hmo && p.is_potential_hmo)
  )
  const licensed = properties.filter(p =>
    p.licensed_hmo || p.licence_status === "active"
  )
  const total = unlicensed.length + licensed.length
  if (total === 0) return { name: "Unlicensed HMOs", score: 0, max, description: "No HMO data" }

  const unlicensedRatio = unlicensed.length / total

  let score = 0
  if (unlicensedRatio >= 0.6) score = 20
  else if (unlicensedRatio >= 0.4) score = 15
  else if (unlicensedRatio >= 0.25) score = 10
  else if (unlicensedRatio >= 0.1) score = 5

  return {
    name: "Unlicensed HMOs",
    score,
    max,
    description: `${unlicensed.length} unlicensed out of ${total} HMOs (${(unlicensedRatio * 100).toFixed(0)}%)`,
  }
}

function calculateChurnScore(properties: Property[]): PredictionFactor {
  const max = 15
  const expired = properties.filter(p => p.licence_status === "expired")
  const allLicensed = properties.filter(p =>
    p.licence_status === "active" || p.licence_status === "expired"
  )

  if (allLicensed.length === 0) {
    return { name: "Licence Churn", score: 0, max, description: "No licence data" }
  }

  const churnRatio = expired.length / allLicensed.length

  let score = 0
  if (churnRatio >= 0.5) score = 15
  else if (churnRatio >= 0.3) score = 10
  else if (churnRatio >= 0.15) score = 5

  // Bonus for high absolute expired count
  if (expired.length >= 5) score = Math.min(max, score + 3)

  return {
    name: "Licence Churn",
    score,
    max,
    description: `${expired.length} expired licences out of ${allLicensed.length} (${(churnRatio * 100).toFixed(0)}%)`,
  }
}

function calculateProximityScore(
  properties: Property[],
  article4Features?: GeoJSON.Feature[]
): PredictionFactor {
  const max = 20

  if (!article4Features || article4Features.length === 0) {
    return { name: "Article 4 Proximity", score: 0, max, description: "No nearby Article 4 data" }
  }

  // Check if any property in this sector is near an existing Article 4 zone
  const centroid = calculateCentroid(properties)
  let minDistance = Infinity

  for (const feature of article4Features) {
    const featureCentroid = getFeatureCentroid(feature)
    if (!featureCentroid) continue
    const dist = haversineDistance(centroid, featureCentroid)
    minDistance = Math.min(minDistance, dist)
  }

  let score = 0
  if (minDistance < 0.5) score = 20       // Within 500m
  else if (minDistance < 1.0) score = 15   // Within 1km
  else if (minDistance < 2.0) score = 10   // Within 2km
  else if (minDistance < 5.0) score = 5    // Within 5km

  const distLabel = minDistance === Infinity
    ? "No Article 4 nearby"
    : `${minDistance.toFixed(1)}km from nearest Article 4 zone`

  return {
    name: "Article 4 Proximity",
    score,
    max,
    description: distLabel,
  }
}

function calculateCouncilScore(properties: Property[]): PredictionFactor {
  const max = 15
  const city = (properties[0]?.city || "").toLowerCase()

  // Check if any property in this sector is already in Article 4
  // (partial coverage = council is actively using Article 4)
  const hasPartialArticle4 = properties.some(p => p.article_4_area) &&
    properties.some(p => !p.article_4_area)

  let score = 0

  if (hasPartialArticle4) {
    // Council already has Article 4 in this exact area — high expansion risk
    score = 15
  } else if (EXPANDING_COUNCILS.has(city)) {
    score = 10
  } else {
    // Check for partial city name match
    for (const council of EXPANDING_COUNCILS) {
      if (city.includes(council) || council.includes(city)) {
        score = 8
        break
      }
    }
  }

  return {
    name: "Council Pattern",
    score,
    max,
    description: hasPartialArticle4
      ? "Council already has Article 4 in this area"
      : EXPANDING_COUNCILS.has(city)
        ? `${properties[0]?.city} is known to expand Article 4`
        : "No known expansion pattern",
  }
}

function calculatePressureScore(properties: Property[]): PredictionFactor {
  const max = 5

  // Higher occupancy properties create more neighbourhood pressure
  const highOccupancy = properties.filter(p =>
    (p.max_occupants && p.max_occupants >= 6) ||
    (p.bedrooms >= 5)
  )

  let score = 0
  if (highOccupancy.length >= 5) score = 5
  else if (highOccupancy.length >= 3) score = 3
  else if (highOccupancy.length >= 1) score = 1

  return {
    name: "Occupancy Pressure",
    score,
    max,
    description: `${highOccupancy.length} high-occupancy properties (5+ beds or 6+ occupants)`,
  }
}

function calculateCentroid(properties: Property[]): [number, number] {
  const validProps = properties.filter(p =>
    p.latitude && p.longitude &&
    !isNaN(Number(p.latitude)) && !isNaN(Number(p.longitude))
  )

  if (validProps.length === 0) return [0, 0]

  const sumLng = validProps.reduce((s, p) => s + Number(p.longitude), 0)
  const sumLat = validProps.reduce((s, p) => s + Number(p.latitude), 0)

  return [sumLng / validProps.length, sumLat / validProps.length]
}

function calculateSpreadRadius(
  properties: Property[],
  centroid: [number, number]
): number {
  const validProps = properties.filter(p =>
    p.latitude && p.longitude &&
    !isNaN(Number(p.latitude)) && !isNaN(Number(p.longitude))
  )

  if (validProps.length < 2) return 0.3 // Default 300m

  // Calculate average distance from centroid
  const distances = validProps.map(p =>
    haversineDistance(centroid, [Number(p.longitude), Number(p.latitude)])
  )

  const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length

  // Clamp between 200m and 2km
  return Math.max(0.2, Math.min(2.0, avgDist * 1.5))
}

function getFeatureCentroid(feature: GeoJSON.Feature): [number, number] | null {
  const geom = feature.geometry
  if (!geom) return null

  if (geom.type === "Point") {
    return geom.coordinates as [number, number]
  }

  if (geom.type === "Polygon") {
    const coords = geom.coordinates[0]
    if (!coords || coords.length === 0) return null
    const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length
    const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length
    return [lng, lat]
  }

  if (geom.type === "MultiPolygon") {
    const allCoords = geom.coordinates.flat(2)
    if (allCoords.length === 0) return null
    const lng = allCoords.reduce((s, c) => s + c[0], 0) / allCoords.length
    const lat = allCoords.reduce((s, c) => s + c[1], 0) / allCoords.length
    return [lng, lat]
  }

  return null
}

/**
 * Haversine distance in km between two [lng, lat] points
 */
function haversineDistance(a: [number, number], b: [number, number]): number {
  const R = 6371 // Earth radius km
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)

  return 2 * R * Math.asin(Math.sqrt(h))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/**
 * Create a circle polygon approximation
 */
function createCirclePolygon(
  center: [number, number],
  radiusKm: number,
  points: number
): GeoJSON.Polygon {
  const coords: number[][] = []
  const [lng, lat] = center

  for (let i = 0; i <= points; i++) {
    const angle = (i * 360) / points
    const dx = radiusKm * Math.cos(toRad(angle))
    const dy = radiusKm * Math.sin(toRad(angle))

    // Approximate degree offset (1 degree lat ≈ 111km, 1 degree lng varies with latitude)
    const latOffset = dy / 111
    const lngOffset = dx / (111 * Math.cos(toRad(lat)))

    coords.push([lng + lngOffset, lat + latOffset])
  }

  return {
    type: "Polygon",
    coordinates: [coords],
  }
}
