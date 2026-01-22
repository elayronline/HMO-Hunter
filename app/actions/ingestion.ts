"use server"

import { IngestionManager } from "@/lib/ingestion/ingestion-manager"
import { PropertyDataHMOAdapter } from "@/lib/ingestion/adapters/propertydata-hmo"
import { StreetDataAdapter } from "@/lib/ingestion/adapters/streetdata"
import { PaTMaAdapter } from "@/lib/ingestion/adapters/patma"
import type { IngestionResult } from "@/lib/types/ingestion"

export async function runIngestion(sourceName?: string): Promise<IngestionResult[]> {
  const manager = new IngestionManager()

  // Phase 1: Core HMO Data
  manager.registerPhase1Adapter(new PropertyDataHMOAdapter())

  // Phase 2: Property Enrichment
  manager.registerPhase2Adapter(new StreetDataAdapter())
  manager.registerPhase2Adapter(new PaTMaAdapter())

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
      source: "Street Data",
      status: "success",
      properties_added: 12,
      duration_ms: 2800,
    },
    {
      id: 3,
      timestamp: new Date(Date.now() - 10800000).toISOString(),
      source: "PaTMa",
      status: "success",
      properties_added: 8,
      duration_ms: 2100,
    },
  ]
}
