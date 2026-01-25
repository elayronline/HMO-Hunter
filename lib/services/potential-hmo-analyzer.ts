/**
 * Potential HMO Analyzer Service
 *
 * Identifies and scores properties for HMO conversion potential
 * based on comprehensive criteria including:
 * - Location & Planning (Article 4 exclusion)
 * - Space Standards compliance
 * - EPC viability
 * - Financial potential
 */

import type { Property } from "@/lib/types/database"

export interface HMOAnalysisResult {
  isPotentialHMO: boolean
  hmoClassification: "ready_to_go" | "value_add" | "not_suitable"
  hmoSuitabilityScore: number
  dealScore: number
  dealScoreBreakdown: DealScoreBreakdown
  potentialOccupants: number
  lettableRooms: number
  requiresMandatoryLicensing: boolean
  complianceComplexity: "low" | "medium" | "high"
  meetsSpaceStandards: boolean
  bathroomRatioCompliant: boolean
  kitchenSizeCompliant: boolean
  epcUpgradeViable: boolean
  epcImprovementPotential: "high" | "medium" | "low" | "none"
  estimatedRentPerRoom: number
  estimatedGrossMonthlyRent: number
  estimatedAnnualIncome: number
  yieldBand: "low" | "medium" | "high"
  estimatedYieldPercentage: number
  floorAreaBand: "under_90" | "90_120" | "120_plus" | null
  hasValueAddPotential: boolean
  exclusionReasons: string[]
  hasTitleOwnerInfo: boolean
  hasLicenceHolderInfo: boolean
  hasContactInfo: boolean
}

export interface DealScoreBreakdown {
  floorAreaEfficiency: number      // 0-15 points
  epcRatingScore: number           // 0-15 points
  licensingUpside: number          // 0-10 points
  lettableRoomsScore: number       // 0-15 points
  complianceScore: number          // 0-10 points
  yieldScore: number               // 0-15 points
  contactDataScore: number         // 0-20 points (title owner + licence holder info)
}

// Minimum space standards (UK HMO regulations)
const SPACE_STANDARDS = {
  SINGLE_ADULT_MIN_SQM: 6.51,
  DOUBLE_MIN_SQM: 10.22,
  CHILD_UNDER_10_MIN_SQM: 4.64,
  ABSOLUTE_MIN_SQM: 4.64,
  KITCHEN_MIN_SQM: 7,
  MIN_CEILING_HEIGHT_M: 2.14,
  BATHROOM_RATIO: 5, // 1 bathroom per 5 tenants
}

// Average rent per room by region (GBP per month)
const REGIONAL_RENT_ESTIMATES: Record<string, number> = {
  "London": 850,
  "Greater London": 850,
  "Manchester": 550,
  "Birmingham": 500,
  "Leeds": 480,
  "Liverpool": 450,
  "Bristol": 600,
  "Sheffield": 450,
  "Newcastle": 420,
  "Nottingham": 480,
  "Leicester": 460,
  "Coventry": 480,
  "Brighton": 650,
  "Southampton": 520,
  "Portsmouth": 500,
  "Oxford": 700,
  "Cambridge": 720,
  "Reading": 620,
  "Cardiff": 480,
  "Edinburgh": 580,
  "Glasgow": 500,
  "default": 500,
}

export function analyzePropertyForHMO(property: Property): HMOAnalysisResult {
  const exclusionReasons: string[] = []

  // Check exclusion criteria first

  // 1. Exclude Article 4 areas
  if (property.article_4_area) {
    exclusionReasons.push("Located within Article 4 Direction area")
  }

  // 2. Check EPC - exclude where improvement not feasible
  const epcAnalysis = analyzeEPC(property.epc_rating)
  if (epcAnalysis.improvementPotential === "none") {
    exclusionReasons.push("EPC improvement not feasible")
  }

  // 3. Check if requires major structural work (based on conservation/listed status)
  if (property.listed_building_grade) {
    exclusionReasons.push("Listed building - major works restricted")
  }

  // Calculate floor area band and estimates
  const grossArea = estimateGrossInternalArea(property)
  const floorAreaBand = getFloorAreaBand(grossArea)

  // Exclude properties under 90 sqm (not viable for standard HMO)
  if (floorAreaBand === "under_90" && grossArea < 70) {
    exclusionReasons.push("Floor area too small for viable HMO conversion")
  }

  // Calculate lettable rooms and occupancy
  const lettableRooms = estimateLettableRooms(property, grossArea)
  const potentialOccupants = lettableRooms // 1 person per room for calculations

  // Check minimum occupancy (3+ residents)
  if (potentialOccupants < 3) {
    exclusionReasons.push("Cannot accommodate minimum 3 residents")
  }

  // Determine if it's a potential HMO
  const isPotentialHMO = exclusionReasons.length === 0

  // Space standards compliance
  const meetsSpaceStandards = checkSpaceStandards(grossArea, lettableRooms)
  const bathroomRatioCompliant = property.bathrooms >= Math.ceil(potentialOccupants / SPACE_STANDARDS.BATHROOM_RATIO)
  const kitchenSizeCompliant = true // Assume compliant unless we have specific data

  // Licensing requirements (5+ occupants from 2+ households)
  const requiresMandatoryLicensing = potentialOccupants >= 5

  // Financial analysis
  const rentPerRoom = getRegionalRentEstimate(property.city)
  const grossMonthlyRent = rentPerRoom * lettableRooms
  const annualIncome = grossMonthlyRent * 12
  const estimatedYield = property.purchase_price
    ? (annualIncome / property.purchase_price) * 100
    : property.estimated_value
      ? (annualIncome / property.estimated_value) * 100
      : 0
  const yieldBand = getYieldBand(estimatedYield)

  // Check for contact/owner information availability
  const hasTitleOwnerInfo = !!(property.owner_name || property.company_name || property.company_number)
  const hasLicenceHolderInfo = !!(property.licensed_hmo || property.hmo_status?.includes("Licensed"))
  const hasContactInfo = !!(property.owner_contact_email || property.owner_contact_phone || property.owner_address)

  // Calculate scores
  const dealScoreBreakdown = calculateDealScoreBreakdown(
    property,
    grossArea,
    lettableRooms,
    epcAnalysis,
    requiresMandatoryLicensing,
    estimatedYield,
    hasTitleOwnerInfo,
    hasLicenceHolderInfo,
    hasContactInfo
  )

  const dealScore = Object.values(dealScoreBreakdown).reduce((a, b) => a + b, 0)
  const hmoSuitabilityScore = isPotentialHMO ? Math.min(100, Math.round(dealScore)) : 0

  // Determine classification
  const hmoClassification = determineClassification(
    isPotentialHMO,
    dealScore,
    epcAnalysis,
    property,
    hasTitleOwnerInfo,
    hasLicenceHolderInfo
  )

  // Compliance complexity
  const complianceComplexity = determineComplianceComplexity(
    property,
    epcAnalysis,
    meetsSpaceStandards,
    bathroomRatioCompliant
  )

  // Value-add potential
  const hasValueAddPotential =
    hmoClassification === "value_add" ||
    epcAnalysis.improvementPotential === "high" ||
    (floorAreaBand === "120_plus" && lettableRooms < 6)

  return {
    isPotentialHMO,
    hmoClassification,
    hmoSuitabilityScore,
    dealScore,
    dealScoreBreakdown,
    potentialOccupants,
    lettableRooms,
    requiresMandatoryLicensing,
    complianceComplexity,
    meetsSpaceStandards,
    bathroomRatioCompliant,
    kitchenSizeCompliant,
    epcUpgradeViable: epcAnalysis.upgradeViable,
    epcImprovementPotential: epcAnalysis.improvementPotential,
    estimatedRentPerRoom: rentPerRoom,
    estimatedGrossMonthlyRent: grossMonthlyRent,
    estimatedAnnualIncome: annualIncome,
    yieldBand,
    estimatedYieldPercentage: Math.round(estimatedYield * 100) / 100,
    floorAreaBand,
    hasValueAddPotential,
    exclusionReasons,
    hasTitleOwnerInfo,
    hasLicenceHolderInfo,
    hasContactInfo,
  }
}

function analyzeEPC(rating: Property["epc_rating"]): {
  upgradeViable: boolean
  improvementPotential: "high" | "medium" | "low" | "none"
  score: number
} {
  switch (rating) {
    case "A":
    case "B":
      return { upgradeViable: false, improvementPotential: "none", score: 15 }
    case "C":
      return { upgradeViable: false, improvementPotential: "low", score: 14 }
    case "D":
      return { upgradeViable: true, improvementPotential: "low", score: 12 }
    case "E":
      return { upgradeViable: true, improvementPotential: "medium", score: 10 }
    case "F":
      return { upgradeViable: true, improvementPotential: "high", score: 6 }
    case "G":
      return { upgradeViable: true, improvementPotential: "high", score: 3 }
    default:
      return { upgradeViable: true, improvementPotential: "medium", score: 8 }
  }
}

function estimateGrossInternalArea(property: Property): number {
  // If we have actual data, use it
  if ((property as any).gross_internal_area_sqm) {
    return (property as any).gross_internal_area_sqm
  }

  // Estimate based on bedrooms (UK average room sizes)
  // Average bedroom: 12 sqm, bathroom: 5 sqm, kitchen: 10 sqm, living: 18 sqm, hallway: 8 sqm
  const bedroomArea = property.bedrooms * 12
  const bathroomArea = property.bathrooms * 5
  const commonArea = 36 // kitchen + living + hallway estimate

  return bedroomArea + bathroomArea + commonArea
}

function getFloorAreaBand(sqm: number): "under_90" | "90_120" | "120_plus" | null {
  if (!sqm) return null
  if (sqm < 90) return "under_90"
  if (sqm <= 120) return "90_120"
  return "120_plus"
}

function estimateLettableRooms(property: Property, grossArea: number): number {
  // Start with existing bedrooms
  let rooms = property.bedrooms

  // For larger properties, estimate additional room potential
  if (grossArea >= 120) {
    // Large properties might accommodate more rooms
    const potentialRooms = Math.floor(grossArea / 15) // ~15 sqm per lettable room including shared space allocation
    rooms = Math.max(rooms, Math.min(potentialRooms, 8)) // Cap at 8 rooms
  }

  return rooms
}

function checkSpaceStandards(grossArea: number, rooms: number): boolean {
  if (!grossArea || !rooms) return false
  const avgRoomSize = grossArea / rooms
  return avgRoomSize >= SPACE_STANDARDS.SINGLE_ADULT_MIN_SQM
}

function getRegionalRentEstimate(city: string): number {
  // Check for exact match first
  if (REGIONAL_RENT_ESTIMATES[city]) {
    return REGIONAL_RENT_ESTIMATES[city]
  }

  // Check for partial matches (e.g., "London Borough of X" -> "London")
  for (const [region, rent] of Object.entries(REGIONAL_RENT_ESTIMATES)) {
    if (city.toLowerCase().includes(region.toLowerCase())) {
      return rent
    }
  }

  return REGIONAL_RENT_ESTIMATES.default
}

function getYieldBand(yieldPercentage: number): "low" | "medium" | "high" {
  if (yieldPercentage >= 8) return "high"
  if (yieldPercentage >= 5) return "medium"
  return "low"
}

function calculateDealScoreBreakdown(
  property: Property,
  grossArea: number,
  lettableRooms: number,
  epcAnalysis: ReturnType<typeof analyzeEPC>,
  requiresMandatoryLicensing: boolean,
  estimatedYield: number,
  hasTitleOwnerInfo: boolean,
  hasLicenceHolderInfo: boolean,
  hasContactInfo: boolean
): DealScoreBreakdown {
  // Floor area efficiency (0-15)
  let floorAreaEfficiency = 0
  if (grossArea >= 120) floorAreaEfficiency = 15
  else if (grossArea >= 90) floorAreaEfficiency = 12
  else if (grossArea >= 70) floorAreaEfficiency = 8
  else floorAreaEfficiency = 4

  // EPC rating score (0-15)
  const epcRatingScore = epcAnalysis.score

  // Licensing upside (0-10) - 5+ occupants = mandatory licensing = more value
  const licensingUpside = requiresMandatoryLicensing ? 10 : 5

  // Lettable rooms score (0-15)
  let lettableRoomsScore = 0
  if (lettableRooms >= 6) lettableRoomsScore = 15
  else if (lettableRooms >= 5) lettableRoomsScore = 12
  else if (lettableRooms >= 4) lettableRoomsScore = 9
  else if (lettableRooms >= 3) lettableRoomsScore = 6
  else lettableRoomsScore = 3

  // Compliance score (0-10) - simpler = better
  let complianceScore = 10
  if (property.conservation_area) complianceScore -= 3
  if (property.article_4_area) complianceScore -= 7 // Should already be excluded, but just in case
  if (epcAnalysis.improvementPotential === "high") complianceScore -= 2
  complianceScore = Math.max(0, complianceScore)

  // Yield score (0-15)
  let yieldScore = 0
  if (estimatedYield >= 10) yieldScore = 15
  else if (estimatedYield >= 8) yieldScore = 13
  else if (estimatedYield >= 6) yieldScore = 10
  else if (estimatedYield >= 5) yieldScore = 7
  else if (estimatedYield >= 4) yieldScore = 4
  else yieldScore = 2

  // Contact/Owner data score (0-20) - CRITICAL for "Ready to Go"
  // This is the key differentiator for top-ranked properties
  let contactDataScore = 0

  // Title owner information (0-10)
  if (hasTitleOwnerInfo) {
    contactDataScore += 10
  }

  // Licence holder information (0-5)
  if (hasLicenceHolderInfo) {
    contactDataScore += 5
  }

  // Contact details (email/phone/address) (0-5)
  if (hasContactInfo) {
    contactDataScore += 5
  }

  return {
    floorAreaEfficiency,
    epcRatingScore,
    licensingUpside,
    lettableRoomsScore,
    complianceScore,
    yieldScore,
    contactDataScore,
  }
}

function determineClassification(
  isPotentialHMO: boolean,
  dealScore: number,
  epcAnalysis: ReturnType<typeof analyzeEPC>,
  property: Property,
  hasTitleOwnerInfo: boolean,
  hasLicenceHolderInfo: boolean
): "ready_to_go" | "value_add" | "not_suitable" {
  if (!isPotentialHMO) return "not_suitable"

  // Ready-to-go: HIGHEST TIER - Must have:
  // - Good EPC (A-D)
  // - High score (70+)
  // - Not in conservation area
  // - MUST have Title Owner information (critical for "Ready to Go")
  const hasGoodEpc = ["A", "B", "C", "D"].includes(property.epc_rating || "")

  if (
    dealScore >= 70 &&
    hasGoodEpc &&
    !property.conservation_area &&
    hasTitleOwnerInfo // REQUIRED: Must have title owner info to be "Ready to Go"
  ) {
    return "ready_to_go"
  }

  // Value-add: Good potential but missing something
  // - Score 40+ but missing contact info
  // - OR has contact info but needs EPC work
  // - OR has contact info but lower score
  if (dealScore >= 40) {
    return "value_add"
  }

  // Properties with very low scores or major issues
  return "not_suitable"
}

function determineComplianceComplexity(
  property: Property,
  epcAnalysis: ReturnType<typeof analyzeEPC>,
  meetsSpaceStandards: boolean,
  bathroomRatioCompliant: boolean
): "low" | "medium" | "high" {
  let complexity = 0

  if (!meetsSpaceStandards) complexity += 2
  if (!bathroomRatioCompliant) complexity += 1
  if (property.conservation_area) complexity += 2
  if (epcAnalysis.improvementPotential === "high") complexity += 2
  if (epcAnalysis.improvementPotential === "medium") complexity += 1

  if (complexity >= 4) return "high"
  if (complexity >= 2) return "medium"
  return "low"
}

/**
 * Batch analyze properties for HMO potential
 */
export function analyzePropertiesForHMO(properties: Property[]): Map<string, HMOAnalysisResult> {
  const results = new Map<string, HMOAnalysisResult>()

  for (const property of properties) {
    results.set(property.id, analyzePropertyForHMO(property))
  }

  return results
}

/**
 * Filter properties to only potential HMOs
 */
export function filterPotentialHMOs(
  properties: Property[],
  options?: {
    minDealScore?: number
    classification?: "ready_to_go" | "value_add"
    yieldBand?: "low" | "medium" | "high"
    floorAreaBand?: "under_90" | "90_120" | "120_plus"
    epcBand?: "good" | "needs_upgrade" // C/D vs E-G
  }
): Property[] {
  return properties.filter(property => {
    const analysis = analyzePropertyForHMO(property)

    if (!analysis.isPotentialHMO) return false

    if (options?.minDealScore && analysis.dealScore < options.minDealScore) return false

    if (options?.classification && analysis.hmoClassification !== options.classification) return false

    if (options?.yieldBand && analysis.yieldBand !== options.yieldBand) return false

    if (options?.floorAreaBand && analysis.floorAreaBand !== options.floorAreaBand) return false

    if (options?.epcBand) {
      const goodEpc = ["A", "B", "C", "D"].includes(property.epc_rating || "")
      if (options.epcBand === "good" && !goodEpc) return false
      if (options.epcBand === "needs_upgrade" && goodEpc) return false
    }

    return true
  })
}
