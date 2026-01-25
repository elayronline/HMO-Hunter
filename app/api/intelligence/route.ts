import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { dataIntelligence } from "@/lib/services/data-intelligence"
import { AI_SYSTEM_PROMPT, DATA_SOURCE_PRIORITIES, INTELLIGENCE_CAPABILITIES } from "@/lib/config/ai-intelligence"

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
    chainableIdentifiers: dataIntelligence.getChainableIdentifiers(),
    attributions: dataIntelligence.getAttributions(),
  })
}

/**
 * POST /api/intelligence
 *
 * Analyze properties for compliance risks and opportunities
 *
 * Body: { propertyIds?: string[], city?: string, limit?: number }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { propertyIds, city, limit = 50 } = body

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
      const complianceRisks = dataIntelligence.analyzeComplianceRisks(property)
      const opportunities = dataIntelligence.identifyOpportunities(property)
      const enrichmentChain = dataIntelligence.planEnrichmentChain(property)

      // Log audit entry
      dataIntelligence.logAuditEntry({
        action: "analyze_property",
        dataSource: "supabase",
        identifiers: {
          id: property.id,
          postcode: property.postcode,
          uprn: property.uprn || "",
        },
        success: true,
      })

      return {
        id: property.id,
        title: property.title,
        address: property.address,
        postcode: property.postcode,
        city: property.city,
        hmo_status: property.hmo_status,
        analysis: {
          complianceRisks,
          opportunities,
          suggestedEnrichment: enrichmentChain,
          riskScore: complianceRisks.filter(r => r.severity === "high").length * 3 +
                     complianceRisks.filter(r => r.severity === "medium").length * 2 +
                     complianceRisks.filter(r => r.severity === "low").length,
          opportunityScore: opportunities.filter(o => o.priority === "high").length * 3 +
                           opportunities.filter(o => o.priority === "medium").length * 2,
        },
      }
    })

    // Summary statistics
    const summary = {
      totalAnalyzed: analyzedProperties.length,
      highRiskProperties: analyzedProperties.filter(p => p.analysis.riskScore >= 3).length,
      highOpportunityProperties: analyzedProperties.filter(p => p.analysis.opportunityScore >= 3).length,
      byRiskType: {} as Record<string, number>,
      byOpportunityType: {} as Record<string, number>,
    }

    analyzedProperties.forEach(p => {
      p.analysis.complianceRisks.forEach(risk => {
        summary.byRiskType[risk.type] = (summary.byRiskType[risk.type] || 0) + 1
      })
      p.analysis.opportunities.forEach(opp => {
        summary.byOpportunityType[opp.type] = (summary.byOpportunityType[opp.type] || 0) + 1
      })
    })

    return NextResponse.json({
      success: true,
      summary,
      properties: analyzedProperties,
      provenance: {
        source: "HMO Hunter Intelligence Engine",
        analyzedAt: new Date().toISOString(),
        dataSourcePriority: "tier1_official > tier2_commercial > tier3_public",
      },
    })

  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
