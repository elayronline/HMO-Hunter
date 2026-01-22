import type { SourceAdapter, EnrichmentAdapter, IngestionResult } from "@/lib/types/ingestion"
import { createClient } from "@/lib/supabase/server"

export class IngestionManager {
  private phase1Adapters: SourceAdapter[] = [] // Core HMO data
  private phase2Adapters: EnrichmentAdapter[] = [] // Enrichment data
  private existingExternalIds = new Set<string>() // For deduplication

  registerPhase1Adapter(adapter: SourceAdapter) {
    if (adapter.phase === 1) {
      this.phase1Adapters.push(adapter)
    }
  }

  registerPhase2Adapter(adapter: EnrichmentAdapter) {
    this.phase2Adapters.push(adapter)
  }

  async runIngestion(sourceName?: string): Promise<IngestionResult[]> {
    const results: IngestionResult[] = []

    // Phase 1: Ingest core HMO data
    const adaptersToRun = sourceName ? this.phase1Adapters.filter((a) => a.name === sourceName) : this.phase1Adapters

    for (const adapter of adaptersToRun) {
      const startTime = Date.now()

      try {
        const result = await this.ingestFromSource(adapter)
        result.duration_ms = Date.now() - startTime
        results.push(result)
      } catch (error) {
        results.push({
          source: adapter.name,
          total: 0,
          created: 0,
          updated: 0,
          skipped: 0,
          errors: [error instanceof Error ? error.message : "Unknown error"],
          duration_ms: Date.now() - startTime,
          timestamp: new Date(),
        })
      }
    }

    // Phase 2: Enrich existing properties
    if (!sourceName) {
      await this.runEnrichment()
    }

    await this.markStaleProperties()

    return results
  }

  private async ingestFromSource(adapter: SourceAdapter): Promise<IngestionResult> {
    const result: IngestionResult = {
      source: adapter.name,
      total: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      duration_ms: 0,
      timestamp: new Date(),
    }

    try {
      const listings = await adapter.fetch()
      result.total = listings.length

      const supabase = await createClient()
      const now = new Date().toISOString()

      for (const listing of listings) {
        try {
          // Deduplication: Check for existing property by (postcode + external_id)
          const { data: existingProperty } = await supabase
            .from("properties")
            .select("id, external_id")
            .eq("postcode", listing.postcode)
            .eq("external_id", listing.external_id)
            .maybeSingle()

          // Skip if already processed
          const dedupeKey = `${listing.postcode}-${listing.external_id}`
          if (existingProperty?.external_id && this.existingExternalIds.has(dedupeKey)) {
            result.skipped++
            continue
          }

          const propertyData = {
            title: listing.title,
            address: listing.address,
            postcode: listing.postcode,
            city: listing.city,
            latitude: listing.latitude,
            longitude: listing.longitude,
            price_pcm: listing.price_pcm,
            purchase_price: listing.purchase_price,
            listing_type: listing.listing_type,
            property_type: listing.property_type,
            bedrooms: listing.bedrooms,
            bathrooms: listing.bathrooms,
            description: listing.description,
            images: listing.images,
            floor_plans: listing.floor_plans,
            primary_image: listing.images?.[0],
            is_furnished: listing.is_furnished,
            is_student_friendly: listing.is_student_friendly,
            is_pet_friendly: listing.is_pet_friendly,
            has_garden: listing.has_garden,
            wifi_included: listing.wifi_included,
            near_tube_station: listing.near_tube_station,
            available_from: listing.available_from,
            source_name: adapter.name,
            source_type: adapter.type,
            source_url: listing.source_url,
            external_id: listing.external_id,
            last_synced: now,
            last_seen_at: now,
            is_stale: false,
            stale_marked_at: null,
            hmo_status: listing.licence_status === "active" ? "Licensed HMO" : "Standard HMO",
          }

          if (existingProperty) {
            // Update existing property
            const { error } = await supabase.from("properties").update(propertyData).eq("id", existingProperty.id)

            if (error) {
              result.errors.push(`${listing.external_id}: ${error.message}`)
            } else {
              result.updated++
              this.existingExternalIds.add(dedupeKey)
            }
          } else {
            // Insert new property
            const { error } = await supabase.from("properties").insert({
              ...propertyData,
              last_ingested_at: now,
            })

            if (error) {
              result.errors.push(`${listing.external_id}: ${error.message}`)
            } else {
              result.created++
              this.existingExternalIds.add(dedupeKey)
            }
          }
        } catch (error) {
          result.errors.push(`${listing.external_id}: ${error instanceof Error ? error.message : "Unknown error"}`)
        }
      }
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : "Unknown error")
    }

    return result
  }

  private async runEnrichment() {
    console.log("[IngestionManager] Starting Phase 2 enrichment...")

    try {
      const supabase = await createClient()

      // Get properties that need enrichment (recently added or updated)
      const { data: properties } = await supabase
        .from("properties")
        .select("id, address, postcode, city, property_type, purchase_price")
        .is("purchase_price", null)
        .limit(50) // Enrich in batches

      if (!properties || properties.length === 0) {
        console.log("[IngestionManager] No properties need enrichment")
        return
      }

      for (const property of properties) {
        const enrichedData: any = {}

        // Run all Phase 2 enrichment adapters
        for (const adapter of this.phase2Adapters) {
          try {
            const data = await adapter.enrich(property as any)
            Object.assign(enrichedData, data)
          } catch (error) {
            console.error(`[${adapter.name}] Enrichment failed:`, error)
          }
        }

        // Update property with enriched data
        if (Object.keys(enrichedData).length > 0) {
          await supabase.from("properties").update(enrichedData).eq("id", property.id)
        }
      }

      console.log(`[IngestionManager] Enriched ${properties.length} properties`)
    } catch (error) {
      console.error("[IngestionManager] Enrichment error:", error)
    }
  }

  private async markStaleProperties() {
    try {
      const supabase = await createClient()
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      await supabase
        .from("properties")
        .update({
          is_stale: true,
          stale_marked_at: new Date().toISOString(),
        })
        .lt("last_seen_at", sevenDaysAgo.toISOString())
        .eq("is_stale", false)
    } catch (error) {
      console.error("Error marking stale properties:", error)
    }
  }
}
