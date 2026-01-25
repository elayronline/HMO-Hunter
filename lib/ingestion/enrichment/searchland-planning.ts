import { EnrichmentAdapter, type PropertyListing } from "@/lib/types/ingestion"
import { apiConfig } from "@/lib/config/api-config"
import type { PlanningConstraint } from "@/lib/types/database"

/**
 * Searchland Planning Enrichment Adapter
 * Phase 2 - Article 4 & Planning Constraints Data
 *
 * Uses Searchland's Planning API to fetch planning restrictions
 * including Article 4 directions, conservation areas, and listed buildings
 */
export class SearchlandPlanningAdapter extends EnrichmentAdapter {
  name = "Searchland Planning"
  type = "enrichment_api" as const

  private apiKey: string
  private baseUrl: string

  constructor(apiKey?: string, baseUrl?: string) {
    super()
    this.apiKey = apiKey || apiConfig.searchland.apiKey || ""
    this.baseUrl = baseUrl || apiConfig.searchland.baseUrl
  }

  async enrich(property: PropertyListing): Promise<Partial<PropertyListing>> {
    if (!this.apiKey) {
      console.warn("[SearchlandPlanning] API key not configured")
      return {}
    }

    try {
      const response = await fetch(`${this.baseUrl}/planning`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          address: property.address,
          postcode: property.postcode,
          latitude: property.latitude,
          longitude: property.longitude,
          uprn: property.uprn,
        }),
      })

      if (!response.ok) {
        console.warn(`[SearchlandPlanning] API error for ${property.address}: ${response.status}`)
        return {}
      }

      const data = await response.json()

      if (!data.planning) {
        console.log(`[SearchlandPlanning] No planning data found for ${property.address}`)
        return {}
      }

      const planning = data.planning

      // Check for Article 4 direction
      const article4Area = this.detectArticle4(planning)

      // Check for conservation area
      const conservationArea = planning.conservation_area === true ||
        planning.constraints?.some((c: any) =>
          c.type?.toLowerCase().includes("conservation")
        )

      // Check for listed building
      const listedBuildingGrade = this.parseListedBuildingGrade(planning.listed_building_grade)

      // Collect all planning constraints
      const planningConstraints: PlanningConstraint[] = []

      if (article4Area) {
        planningConstraints.push({
          type: "Article 4",
          description: "Article 4 Direction - Planning permission required for HMO conversion",
          reference: planning.article_4_reference,
        })
      }

      if (conservationArea) {
        planningConstraints.push({
          type: "Conservation Area",
          description: "Property is within a designated conservation area",
          reference: planning.conservation_area_name,
        })
      }

      if (listedBuildingGrade) {
        planningConstraints.push({
          type: "Listed Building",
          description: `Grade ${listedBuildingGrade} listed building - strict planning controls apply`,
          reference: planning.listed_building_reference,
        })
      }

      // Add any other constraints from the API
      if (planning.constraints && Array.isArray(planning.constraints)) {
        for (const constraint of planning.constraints) {
          if (!this.isDuplicateConstraint(constraint, planningConstraints)) {
            planningConstraints.push({
              type: constraint.type || "Other",
              description: constraint.description || constraint.name,
              reference: constraint.reference,
            })
          }
        }
      }

      const enrichment: Partial<PropertyListing> = {
        article_4_area: article4Area,
        conservation_area: conservationArea,
        listed_building_grade: listedBuildingGrade,
        planning_constraints: planningConstraints.length > 0 ? planningConstraints : undefined,
      }

      if (article4Area) {
        console.log(`[SearchlandPlanning] WARNING: ${property.address} is in Article 4 area`)
      }
      console.log(`[SearchlandPlanning] Enriched ${property.address} with ${planningConstraints.length} constraints`)

      return enrichment
    } catch (error) {
      console.error(`[SearchlandPlanning] Enrichment error for ${property.address}:`, error)
      return {}
    }
  }

  private detectArticle4(planning: any): boolean {
    // Check various ways Article 4 might be indicated
    if (planning.article_4 === true) return true
    if (planning.article_4_direction === true) return true
    if (planning.article_4_area === true) return true

    // Check in constraints array
    if (planning.constraints && Array.isArray(planning.constraints)) {
      return planning.constraints.some((c: any) =>
        c.type?.toLowerCase().includes("article 4") ||
        c.description?.toLowerCase().includes("article 4")
      )
    }

    return false
  }

  private parseListedBuildingGrade(grade: any): "I" | "II*" | "II" | undefined {
    if (!grade) return undefined

    const gradeStr = String(grade).toUpperCase().trim()

    if (gradeStr === "I" || gradeStr === "1" || gradeStr === "GRADE I") {
      return "I"
    }
    if (gradeStr === "II*" || gradeStr === "2*" || gradeStr === "GRADE II*") {
      return "II*"
    }
    if (gradeStr === "II" || gradeStr === "2" || gradeStr === "GRADE II") {
      return "II"
    }

    return undefined
  }

  private isDuplicateConstraint(constraint: any, existing: PlanningConstraint[]): boolean {
    const type = constraint.type?.toLowerCase() || ""
    return existing.some(
      (e) =>
        e.type.toLowerCase() === type ||
        (type.includes("article 4") && e.type === "Article 4") ||
        (type.includes("conservation") && e.type === "Conservation Area") ||
        (type.includes("listed") && e.type === "Listed Building")
    )
  }
}
