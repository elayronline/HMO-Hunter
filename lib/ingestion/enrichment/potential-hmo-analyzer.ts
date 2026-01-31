import type { EnrichmentAdapter, PropertyListing } from "@/lib/types/ingestion"

/**
 * Potential HMO Analyzer
 *
 * Analyzes properties to determine HMO conversion potential and calculates deal scores.
 * Identifies "ready to go" and "value add" opportunities.
 */
export class PotentialHMOAnalyzer implements EnrichmentAdapter {
  name = "Potential HMO Analyzer"
  type = "enrichment_api" as const

  async enrich(property: any): Promise<Partial<PropertyListing> & {
    is_potential_hmo?: boolean
    hmo_classification?: "ready_to_go" | "value_add" | "not_suitable"
    deal_score?: number
    deal_score_breakdown?: any
    potential_occupants?: number
    estimated_gross_monthly_rent?: number
    estimated_yield_percentage?: number
    yield_band?: "low" | "medium" | "high"
    floor_area_band?: "under_90" | "90_120" | "120_plus"
  }> {
    // Skip if already analyzed or not a suitable property type
    if (property.is_potential_hmo !== null && property.is_potential_hmo !== undefined) {
      return {}
    }

    // For properties to be potential HMOs, they should be:
    // - Houses or large flats for purchase
    // - Have 3+ bedrooms (or enough space)
    // - In the right price range
    const isPurchaseListing = property.listing_type === "purchase"
    const isRentListing = property.listing_type === "rent"
    const bedrooms = property.bedrooms || 0
    const price = property.purchase_price || property.price_pcm || 0

    // Calculate floor area band (estimated from bedrooms if not available)
    const estimatedFloorArea = property.floor_area || this.estimateFloorArea(bedrooms, property.property_type)
    const floorAreaBand = this.getFloorAreaBand(estimatedFloorArea)

    // Skip if clearly not suitable
    if (bedrooms < 3 || price === 0) {
      return {
        is_potential_hmo: false,
        hmo_classification: "not_suitable",
        deal_score: 0,
      }
    }

    // Calculate potential HMO metrics
    const analysis = this.analyzeProperty(property, estimatedFloorArea)

    // Properties that are already Licensed HMOs aren't "potential" - they're already HMOs
    if (property.hmo_status === "Licensed HMO") {
      return {
        is_potential_hmo: false,
        hmo_classification: undefined,
        deal_score: analysis.dealScore,
        deal_score_breakdown: analysis.breakdown,
        floor_area_band: floorAreaBand,
      }
    }

    // Calculate classification
    const classification = this.classifyProperty(analysis, property)

    // Calculate yield
    const yieldData = this.calculateYield(property, analysis.potentialRent)

    return {
      is_potential_hmo: classification !== "not_suitable",
      hmo_classification: classification,
      deal_score: analysis.dealScore,
      deal_score_breakdown: analysis.breakdown,
      potential_occupants: analysis.potentialOccupants,
      estimated_gross_monthly_rent: analysis.potentialRent,
      estimated_yield_percentage: yieldData.yield,
      yield_band: yieldData.band,
      floor_area_band: floorAreaBand,
    }
  }

  private estimateFloorArea(bedrooms: number, propertyType: string): number {
    // Rough estimates based on typical UK property sizes
    const baseSize = {
      "House": 70,
      "Flat": 50,
      "HMO": 100,
      "Studio": 30,
    }[propertyType] || 60

    return baseSize + (bedrooms * 15)
  }

  private getFloorAreaBand(sqm: number): "under_90" | "90_120" | "120_plus" {
    if (sqm < 90) return "under_90"
    if (sqm < 120) return "90_120"
    return "120_plus"
  }

  private analyzeProperty(property: any, floorArea: number) {
    const bedrooms = property.bedrooms || 0
    const price = property.purchase_price || 0
    const epcRating = property.epc_rating
    const article4 = property.article_4_area
    const city = property.city || ""

    // Calculate potential occupants (rule of thumb: bedrooms + 1 for shared spaces usage)
    const potentialOccupants = Math.min(bedrooms + 1, 6) // Cap at 6 for small HMO

    // Estimate rent per room based on location
    const rentPerRoom = this.estimateRentPerRoom(city, epcRating)
    const potentialRent = potentialOccupants * rentPerRoom

    // Calculate deal score components
    const breakdown = {
      sizeScore: this.calculateSizeScore(floorArea, bedrooms),
      locationScore: this.calculateLocationScore(city, article4),
      priceScore: this.calculatePriceScore(price, city),
      yieldScore: this.calculateYieldScore(potentialRent, price),
      epcScore: this.calculateEpcScore(epcRating),
    }

    // Weighted average for deal score (1-100)
    const dealScore = Math.round(
      breakdown.sizeScore * 0.2 +
      breakdown.locationScore * 0.25 +
      breakdown.priceScore * 0.2 +
      breakdown.yieldScore * 0.25 +
      breakdown.epcScore * 0.1
    )

    return {
      potentialOccupants,
      potentialRent,
      dealScore: Math.max(0, Math.min(100, dealScore)),
      breakdown,
    }
  }

  private estimateRentPerRoom(city: string, epcRating?: string): number {
    // Base rent per room by city (rough UK averages)
    const cityRents: Record<string, number> = {
      "London": 850,
      "Manchester": 550,
      "Birmingham": 500,
      "Leeds": 480,
      "Bristol": 600,
      "Liverpool": 450,
      "Newcastle": 450,
      "Sheffield": 420,
      "Nottingham": 450,
      "Leicester": 450,
      "Reading": 650,
      "Portsmouth": 500,
      "Southampton": 520,
      "Brighton": 650,
      "Oxford": 700,
      "Cambridge": 700,
    }

    let baseRent = cityRents[city] || 450

    // Adjust for EPC rating
    if (epcRating === "A" || epcRating === "B") baseRent *= 1.1
    if (epcRating === "F" || epcRating === "G") baseRent *= 0.85

    return Math.round(baseRent)
  }

  private calculateSizeScore(floorArea: number, bedrooms: number): number {
    // Ideal: 90-150 sqm for HMO with good room sizes
    if (floorArea < 60) return 20
    if (floorArea < 90) return 50
    if (floorArea <= 150) return 90
    return 75 // Very large may need subdivision
  }

  private calculateLocationScore(city: string, article4?: boolean): number {
    // High demand cities
    const highDemand = ["London", "Manchester", "Birmingham", "Bristol", "Leeds", "Brighton"]
    const mediumDemand = ["Liverpool", "Newcastle", "Sheffield", "Nottingham", "Reading", "Portsmouth"]

    let score = 50

    if (highDemand.includes(city)) score = 85
    else if (mediumDemand.includes(city)) score = 70

    // Article 4 penalty (planning permission required)
    if (article4) score -= 30

    return Math.max(0, score)
  }

  private calculatePriceScore(price: number, city: string): number {
    // Good deals based on city price expectations
    const avgPrices: Record<string, number> = {
      "London": 550000,
      "Manchester": 280000,
      "Birmingham": 250000,
      "Bristol": 350000,
      "Leeds": 230000,
      "default": 250000,
    }

    const avgPrice = avgPrices[city] || avgPrices["default"]
    const ratio = price / avgPrice

    if (ratio < 0.7) return 95 // Great deal
    if (ratio < 0.85) return 80 // Good deal
    if (ratio < 1.0) return 65 // Fair
    if (ratio < 1.15) return 50 // Average
    return 30 // Expensive
  }

  private calculateYieldScore(monthlyRent: number, purchasePrice: number): number {
    if (purchasePrice === 0) return 50

    const annualRent = monthlyRent * 12
    const grossYield = (annualRent / purchasePrice) * 100

    if (grossYield >= 10) return 100
    if (grossYield >= 8) return 85
    if (grossYield >= 6) return 70
    if (grossYield >= 5) return 55
    if (grossYield >= 4) return 40
    return 25
  }

  private calculateEpcScore(epcRating?: string): number {
    const scores: Record<string, number> = {
      "A": 100,
      "B": 90,
      "C": 80,
      "D": 65,
      "E": 45,
      "F": 25,
      "G": 10,
    }
    return scores[epcRating || ""] || 50 // Unknown = average
  }

  private classifyProperty(
    analysis: { dealScore: number; potentialOccupants: number },
    property: any
  ): "ready_to_go" | "value_add" | "not_suitable" {
    const { dealScore } = analysis
    const article4 = property.article_4_area
    const epcRating = property.epc_rating
    const bedrooms = property.bedrooms || 0

    // Not suitable if:
    // - Too small (< 3 bedrooms)
    // - Very poor EPC that would need major work
    // - Deal score too low
    if (bedrooms < 3 || dealScore < 30) {
      return "not_suitable"
    }

    // Ready to go if:
    // - Good deal score (60+)
    // - Not in Article 4 area
    // - Decent EPC (C or better)
    // - 4+ bedrooms
    if (
      dealScore >= 60 &&
      !article4 &&
      ["A", "B", "C", "D"].includes(epcRating || "D") &&
      bedrooms >= 4
    ) {
      return "ready_to_go"
    }

    // Value add if:
    // - Moderate deal score (40+)
    // - Could be improved with work
    if (dealScore >= 40) {
      return "value_add"
    }

    return "not_suitable"
  }

  private calculateYield(
    property: any,
    estimatedRent: number
  ): { yield: number; band: "low" | "medium" | "high" } {
    const price = property.purchase_price || 0

    if (price === 0) {
      return { yield: 0, band: "low" }
    }

    const annualRent = estimatedRent * 12
    const grossYield = (annualRent / price) * 100

    let band: "low" | "medium" | "high" = "low"
    if (grossYield >= 8) band = "high"
    else if (grossYield >= 5) band = "medium"

    return {
      yield: Math.round(grossYield * 10) / 10,
      band,
    }
  }
}
