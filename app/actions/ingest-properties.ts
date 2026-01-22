"use server"

import { IngestionManager } from "@/lib/ingestion/ingestion-manager"
import { PropertyDataHMOAdapter } from "@/lib/ingestion/adapters/propertydata-hmo"
import { StreetDataAdapter } from "@/lib/ingestion/adapters/streetdata"
import { PaTMaAdapter } from "@/lib/ingestion/adapters/patma"

export async function ingestProperties(source?: string) {
  const manager = new IngestionManager()

  // Register Phase 1 adapter (Core HMO Data)
  manager.registerPhase1Adapter(new PropertyDataHMOAdapter())

  // Register Phase 2 adapters (Enrichment)
  manager.registerPhase2Adapter(new StreetDataAdapter())
  manager.registerPhase2Adapter(new PaTMaAdapter())

  const results = await manager.runIngestion(source)

  return {
    success: true,
    results,
  }
}
