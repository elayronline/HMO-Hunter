import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { dataIntelligence } from "@/lib/services/data-intelligence"
import {
  AI_SYSTEM_PROMPT,
  DATA_SOURCE_PRIORITIES,
  INTELLIGENCE_CAPABILITIES,
  PROPERTY_RESOLUTION,
  TITLE_OWNER_CONFIG,
  LICENCE_DATA_CONFIG,
  LICENCE_INTELLIGENCE,
  PROVENANCE_REQUIREMENTS,
  UNIFIED_PROPERTY_SCHEMA,
  DATA_CONSTRAINTS,
  INTELLIGENCE_OBJECTIVES,
} from "@/lib/config/ai-intelligence"

/**
 * GET /api/intelligence
 *
 * Returns intelligence capabilities and system configuration
 */
export async function GET() {
  return NextResponse.json({
    systemPrompt: AI_SYSTEM_PROMPT,
    dataSources: DATA_SOURCE_PRIORITIES,
    capabilities: INTELLIGENCE_CAPABILITIES,
    propertyResolution: PROPERTY_RESOLUTION,
    titleOwnerConfig: TITLE_OWNER_CONFIG,
    licenceDataConfig: LICENCE_DATA_CONFIG,
    licenceIntelligence: LICENCE_INTELLIGENCE,
    provenanceRequirements: PROVENANCE_REQUIREMENTS,
    unifiedPropertySchema: UNIFIED_PROPERTY_SCHEMA,
    dataConstraints: DATA_CONSTRAINTS,
    objectives: INTELLIGENCE_OBJECTIVES,
    chainableIdentifiers: dataIntelligence.getChainableIdentifiers(),
    attributions: dataIntelligence.getAttributions(),
  })
}

/**
 * POST /api/intelligence
 *
 * Analyze properties for compliance risks and opportunities
 * Returns unified property intelligence objects
 *
 * Body: {
 *   propertyIds?: string[],
 *   city?: string,
 *   limit?: number,
 *   format?: "unified" | "summary"  // unified returns full objects
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { propertyIds, city, limit = 50, format = "summary" } = body

    // Build query
    let query = supabaseAdmin
      .from("properties")
      .select("*")
      .eq("is_stale", false)

    if (propertyIds && propertyIds.length > 0) {
      query = query.in("id", propertyIds)
    }

    if (city) {
      query = query.eq("city", city)
    }

    const { data: properties, error } = await query.limit(limit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Analyze each property
    const analyzedProperties = (properties || []).map(property => {
      // Build unified property object with full intelligence
      const unifiedObject = dataIntelligence.buildUnifiedPropertyObject(property)
      const complianceRisks = dataIntelligence.analyzeComplianceRisks(property)
      const opportunities = dataIntelligence.identifyOpportunities(property)
      const enrichmentChain = dataIntelligence.planEnrichmentChain(property)
      const resolution = dataIntelligence.resolveProperty(property)

      // Log audit entry
      dataIntelligence.logAuditEntry({
        action: "analyze_property",
        dataSource: "supabase",
        identifiers: {
          id: property.id,
          postcode: property.postcode,
          uprn: property.uprn || "",
          canonical_id: resolution.canonicalId || "",
        },
        success: true,
      })

      // Calculate scores
      const riskScore = complianceRisks.filter(r => r.severity === "high").length * 3 +
                        complianceRisks.filter(r => r.severity === "medium").length * 2 +
                        complianceRisks.filter(r => r.severity === "low").length

      const opportunityScore = opportunities.filter(o => o.priority === "high").length * 3 +
                              opportunities.filter(o => o.priority === "medium").length * 2

      if (format === "unified") {
        // Return full unified property object
        return {
          ...unifiedObject,
          analysis: {
            complianceRisks,
            opportunities,
            suggestedEnrichment: enrichmentChain,
            riskScore,
            opportunityScore,
            resolution,
          },
        }
      }

      // Return summary format
      return {
        id: property.id,
        title: property.title,
        address: property.address,
        postcode: property.postcode,
        city: property.city,
        hmo_status: property.hmo_status,
        owner_classification: unifiedObject.title_owner.owner_classification,
        licence_status: unifiedObject.licence_metadata.licence_status,
        analysis: {
          complianceRisks,
          opportunities,
          suggestedEnrichment: enrichmentChain,
          riskScore,
          opportunityScore,
          triggerStates: unifiedObject.trigger_states,
          missingData: unifiedObject.missing_data,
        },
        confidence_score: unifiedObject.overall_confidence_score,
      }
    })

    // Summary statistics
    const summary = {
      totalAnalyzed: analyzedProperties.length,
      highRiskProperties: analyzedProperties.filter(p => p.analysis.riskScore >= 3).length,
      highOpportunityProperties: analyzedProperties.filter(p => p.analysis.opportunityScore >= 3).length,
      criticalAlerts: analyzedProperties.filter(p =>
        p.analysis.triggerStates?.some((t: any) => t.alert_level === "critical")
      ).length,
      byRiskType: {} as Record<string, number>,
      byOpportunityType: {} as Record<string, number>,
      byLicenceStatus: {} as Record<string, number>,
      byOwnerType: {} as Record<string, number>,
    }

    analyzedProperties.forEach(p => {
      // Risk types
      p.analysis.complianceRisks.forEach((risk: any) => {
        summary.byRiskType[risk.type] = (summary.byRiskType[risk.type] || 0) + 1
      })

      // Opportunity types
      p.analysis.opportunities.forEach((opp: any) => {
        summary.byOpportunityType[opp.type] = (summary.byOpportunityType[opp.type] || 0) + 1
      })

      // Licence status
      if (p.licence_status) {
        summary.byLicenceStatus[p.licence_status] = (summary.byLicenceStatus[p.licence_status] || 0) + 1
      }

      // Owner type
      if (p.owner_classification) {
        summary.byOwnerType[p.owner_classification] = (summary.byOwnerType[p.owner_classification] || 0) + 1
      }
    })

    return NextResponse.json({
      success: true,
      summary,
      properties: analyzedProperties,
      provenance: {
        source: "HMO Hunter Intelligence Engine",
        analyzedAt: new Date().toISOString(),
        dataSourcePriority: "tier1_official > tier2_commercial > tier3_public",
        format,
      },
      constraints: {
        gdpr_compliant: true,
        data_minimisation: true,
        contact_details_conditions: DATA_CONSTRAINTS.gdpr.contactDetailsConditions,
      },
    })

  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
