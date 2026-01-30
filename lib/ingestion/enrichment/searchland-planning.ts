import { EnrichmentAdapter, type PropertyListing } from "@/lib/types/ingestion"
import { apiConfig } from "@/lib/config/api-config"
import type { PlanningConstraint } from "@/lib/types/database"

/**
 * Searchland Planning Enrichment Adapter
 * Phase 2 - Article 4 & Planning Constraints Data
 *
 * Uses Searchland's /titles/get endpoint which includes planning constraints
 * in the response (conservation areas, listed buildings, Article 4, etc.)
 *
 * Note: Searchland does NOT have a separate /planning endpoint.
 * Constraints come from /titles/get response fields:
 * - constraints: string[] (e.g. ["Conservation Area", "Listed Building(s) 50m Buffer"])
 * - sqmt_of_title_is_planning_consideration.sqmt_is_not_article_4
 * - sqmt_of_title_is_planning_consideration.sqmt_is_not_conservation_area
 */
export class SearchlandPlanningAdapter extends EnrichmentAdapter {
  name = "Searchland Planning"
  type = "enrichment_api" as const

  private apiKey: string
  private baseUrl: string

  constructor(apiKey?: string, baseUrl?: string) {
    super()
    this.apiKey = apiKey || apiConfig.searchland.apiKey || ""
    this.baseUrl = baseUrl || "https://api.searchland.co.uk/v1"
  }

  async enrich(property: PropertyListing): Promise<Partial<PropertyListing>> {
    if (!this.apiKey) {
      console.warn("[SearchlandPlanning] API key not configured")
      return {}
    }

    // Skip if we already have a title number and can use it directly
    if (property.title_number) {
      return this.enrichFromTitle(property.title_number, property.address)
    }

    // Otherwise, search for title by coordinates
    if (!property.latitude || !property.longitude) {
      console.warn(`[SearchlandPlanning] No coordinates for ${property.address}`)
      return {}
    }

    try {
      // Step 1: Search for titles at this location using POST with geometry
      const offset = 0.0003 // ~30 meters
      const geometry = {
        type: "Polygon",
        coordinates: [[
          [property.longitude - offset, property.latitude - offset],
          [property.longitude + offset, property.latitude - offset],
          [property.longitude + offset, property.latitude + offset],
          [property.longitude - offset, property.latitude + offset],
          [property.longitude - offset, property.latitude - offset],
        ]],
      }

      const searchResponse = await fetch(`${this.baseUrl}/titles/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ geometry, perPage: 5 }),
      })

      if (!searchResponse.ok) {
        console.warn(`[SearchlandPlanning] Title search error: ${searchResponse.status}`)
        return {}
      }

      const searchData = await searchResponse.json()

      if (!searchData.data || searchData.data.length === 0) {
        console.log(`[SearchlandPlanning] No titles found for ${property.address}`)
        return {}
      }

      // Step 2: Get full details for first matching title
      const titleNumber = searchData.data[0].title_no
      return this.enrichFromTitle(titleNumber, property.address)

    } catch (error) {
      console.error(`[SearchlandPlanning] Error for ${property.address}:`, error)
      return {}
    }
  }

  /**
   * Get planning constraints from a specific title
   */
  private async enrichFromTitle(titleNumber: string, address: string): Promise<Partial<PropertyListing>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/titles/get?titleNumber=${encodeURIComponent(titleNumber)}`,
        {
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
          },
        }
      )

      if (!response.ok) {
        console.warn(`[SearchlandPlanning] Get title error: ${response.status}`)
        return {}
      }

      const result = await response.json()
      const title = result.data

      if (!title) {
        console.log(`[SearchlandPlanning] No data for title ${titleNumber}`)
        return {}
      }

      // Extract constraints from title data
      const constraints = title.constraints || []
      const planningConsideration = title.sqmt_of_title_is_planning_consideration || {}

      // Detect Article 4 from sqmt calculation (if sqmt_is_not_article_4 ≈ 0, it IS in Article 4)
      const article4Area = Math.abs(planningConsideration.sqmt_is_not_article_4 || 1) < 0.001

      // Detect conservation area
      const conservationArea = Math.abs(planningConsideration.sqmt_is_not_conservation_area || 1) < 0.001 ||
        constraints.some((c: string) => c.toLowerCase().includes("conservation"))

      // Detect listed building from constraints
      const listedBuildingGrade = this.detectListedBuilding(constraints)

      // Build planning constraints array
      const planningConstraints: PlanningConstraint[] = []

      if (article4Area) {
        planningConstraints.push({
          type: "Article 4",
          description: "Article 4 Direction - Planning permission required for HMO conversion",
        })
      }

      if (conservationArea) {
        planningConstraints.push({
          type: "Conservation Area",
          description: "Property is within a designated conservation area",
        })
      }

      if (listedBuildingGrade) {
        planningConstraints.push({
          type: "Listed Building",
          description: `Grade ${listedBuildingGrade} listed building - strict planning controls apply`,
        })
      }

      // Add other constraints from the array
      for (const constraint of constraints) {
        if (!this.isAlreadyCaptured(constraint, planningConstraints)) {
          planningConstraints.push({
            type: this.categorizeConstraint(constraint),
            description: constraint,
          })
        }
      }

      const enrichment: Partial<PropertyListing> = {
        title_number: titleNumber,
        article_4_area: article4Area,
        conservation_area: conservationArea,
        listed_building_grade: listedBuildingGrade,
        planning_constraints: planningConstraints.length > 0 ? planningConstraints : undefined,
      }

      if (article4Area) {
        console.log(`[SearchlandPlanning] WARNING: ${address} is in Article 4 area`)
      }
      console.log(`[SearchlandPlanning] Enriched ${address} with ${planningConstraints.length} constraints`)

      return enrichment
    } catch (error) {
      console.error(`[SearchlandPlanning] Title error:`, error)
      return {}
    }
  }

  /**
   * Detect listed building grade from constraints array
   */
  private detectListedBuilding(constraints: string[]): "I" | "II*" | "II" | undefined {
    for (const c of constraints) {
      const lower = c.toLowerCase()
      if (lower.includes("listed building") || lower.includes("grade i") || lower.includes("grade ii")) {
        if (lower.includes("grade i ") || lower.includes("grade 1 ")) return "I"
        if (lower.includes("grade ii*") || lower.includes("grade 2*")) return "II*"
        if (lower.includes("grade ii") || lower.includes("grade 2")) return "II"
        // Generic listed building mention without grade
        return "II"
      }
    }
    return undefined
  }

  /**
   * Categorize constraint type from description string
   */
  private categorizeConstraint(constraint: string): string {
    const lower = constraint.toLowerCase()
    if (lower.includes("flood")) return "Flood Risk"
    if (lower.includes("sssi")) return "SSSI"
    if (lower.includes("open space")) return "Open Space"
    if (lower.includes("tree")) return "Tree Preservation"
    if (lower.includes("aonb")) return "AONB"
    if (lower.includes("green belt")) return "Green Belt"
    return "Planning Constraint"
  }

  /**
   * Check if constraint is already captured in the list
   */
  private isAlreadyCaptured(constraint: string, existing: PlanningConstraint[]): boolean {
    const lower = constraint.toLowerCase()
    return existing.some(e => {
      if (lower.includes("conservation") && e.type === "Conservation Area") return true
      if (lower.includes("listed") && e.type === "Listed Building") return true
      if (lower.includes("article 4") && e.type === "Article 4") return true
      return false
    })
  }
}
