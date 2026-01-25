"use server"

import { IngestionManager } from "@/lib/ingestion/ingestion-manager"
import { PropertyDataHMOAdapter } from "@/lib/ingestion/adapters/propertydata-hmo"
import { SearchlandAdapter } from "@/lib/ingestion/adapters/searchland"
import { StreetDataAdapter } from "@/lib/ingestion/adapters/streetdata"
import { PaTMaAdapter } from "@/lib/ingestion/adapters/patma"
import { SearchlandOwnershipAdapter } from "@/lib/ingestion/enrichment/searchland-ownership"
import { SearchlandEPCAdapter } from "@/lib/ingestion/enrichment/searchland-epc"
import { SearchlandPlanningAdapter } from "@/lib/ingestion/enrichment/searchland-planning"
import { CompaniesHouseAdapter } from "@/lib/ingestion/enrichment/companies-house"
import { PotentialHMOAnalyzer } from "@/lib/ingestion/enrichment/potential-hmo-analyzer"
import type { IngestionResult } from "@/lib/types/ingestion"

export async function runIngestion(sourceName?: string): Promise<IngestionResult[]> {
  const manager = new IngestionManager()

  // Phase 1: Core HMO Data
  manager.registerPhase1Adapter(new PropertyDataHMOAdapter())
  manager.registerPhase1Adapter(new SearchlandAdapter())

  // Phase 2: Property Enrichment (valuation, market data)
  manager.registerPhase2Adapter(new StreetDataAdapter())
  manager.registerPhase2Adapter(new PaTMaAdapter())

  // Phase 3: Owner/EPC/Planning Enrichment
  manager.registerPhase3Adapter(new SearchlandOwnershipAdapter())
  manager.registerPhase3Adapter(new SearchlandEPCAdapter())
  manager.registerPhase3Adapter(new SearchlandPlanningAdapter())
  manager.registerPhase3Adapter(new CompaniesHouseAdapter())

  // Phase 4: Potential HMO Analysis (always run after other enrichments)
  manager.registerPhase3Adapter(new PotentialHMOAnalyzer())

  return await manager.runIngestion(sourceName)
}

export async function getIngestionHistory(): Promise<any[]> {
  // In production, store ingestion runs in a separate table
  return [
    {
      id: 1,
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      source: "PropertyData HMO",
      status: "success",
      properties_added: 15,
      duration_ms: 3200,
    },
    {
      id: 2,
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      source: "Searchland",
      status: "success",
      properties_added: 12,
      duration_ms: 2800,
    },
    {
      id: 3,
      timestamp: new Date(Date.now() - 10800000).toISOString(),
      source: "Searchland EPC",
      status: "success",
      properties_enriched: 25,
      duration_ms: 2100,
    },
    {
      id: 4,
      timestamp: new Date(Date.now() - 14400000).toISOString(),
      source: "Companies House",
      status: "success",
      properties_enriched: 8,
      duration_ms: 1500,
    },
  ]
}
