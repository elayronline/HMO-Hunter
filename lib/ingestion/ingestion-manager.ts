import type { SourceAdapter, EnrichmentAdapter, IngestionResult } from "@/lib/types/ingestion"
import { supabaseAdmin } from "@/lib/supabase-admin"

export class IngestionManager {
  private phase1Adapters: SourceAdapter[] = [] // Core HMO data
  private phase2Adapters: EnrichmentAdapter[] = [] // Basic enrichment data
  private phase3Adapters: EnrichmentAdapter[] = [] // Owner/EPC/Planning enrichment
  private existingExternalIds = new Set<string>() // For deduplication

  registerPhase1Adapter(adapter: SourceAdapter) {
    if (adapter.phase === 1) {
      this.phase1Adapters.push(adapter)
    }
  }

  registerPhase2Adapter(adapter: EnrichmentAdapter) {
    this.phase2Adapters.push(adapter)
  }

  registerPhase3Adapter(adapter: EnrichmentAdapter) {
    this.phase3Adapters.push(adapter)
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

      const supabase = supabaseAdmin
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
            source_url: listing.source_url,
            external_id: listing.external_id,
            last_synced: now,
            last_seen_at: now,
            is_stale: false,
            stale_marked_at: null,
            hmo_status: listing.licence_status === "active" ? "Licensed HMO" : "Unlicensed HMO",
            licensed_hmo: listing.licence_status === "active",
            // HMO Licence fields
            licence_id: listing.licence_id,
            licence_start_date: listing.licence_start_date,
            licence_end_date: listing.licence_end_date,
            licence_status: listing.licence_status,
            max_occupants: listing.max_occupants,
            uprn: listing.uprn,
            // Phase 3 - Owner/Contact fields
            owner_name: listing.owner_name,
            owner_address: listing.owner_address,
            owner_type: listing.owner_type,
            owner_contact_email: listing.owner_contact_email,
            owner_contact_phone: listing.owner_contact_phone,
            company_name: listing.company_name,
            company_number: listing.company_number,
            company_status: listing.company_status,
            company_incorporation_date: listing.company_incorporation_date,
            directors: listing.directors,
            // Phase 3 - EPC fields
            epc_rating: listing.epc_rating,
            epc_rating_numeric: listing.epc_rating_numeric,
            epc_certificate_url: listing.epc_certificate_url,
            epc_expiry_date: listing.epc_expiry_date,
            // Phase 3 - Planning fields
            article_4_area: listing.article_4_area ?? false,
            planning_constraints: listing.planning_constraints,
            conservation_area: listing.conservation_area ?? false,
            listed_building_grade: listing.listed_building_grade,
            // Phase 3 - Enrichment tracking
            title_number: listing.title_number,
            title_last_enriched_at: listing.title_last_enriched_at,
            owner_enrichment_source: listing.owner_enrichment_source,
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
    console.log("[IngestionManager] Starting Phase 2/3 enrichment...")

    try {
      const supabase = supabaseAdmin

      // Get all properties that need enrichment or analysis
      // This includes properties without purchase_price OR without is_potential_hmo set
      const { data: properties } = await supabase
        .from("properties")
        .select("id, address, postcode, city, property_type, purchase_price, price_pcm, listing_type, bedrooms, bathrooms, uprn, company_number, epc_rating, owner_name, article_4_area, is_potential_hmo, hmo_status, floor_area")
        .or("purchase_price.is.null,is_potential_hmo.is.null")
        .eq("is_stale", false)
        .limit(100) // Enrich in batches

      if (!properties || properties.length === 0) {
        console.log("[IngestionManager] No properties need enrichment")
        return
      }

      console.log(`[IngestionManager] Found ${properties.length} properties to enrich`)

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

        // Run all Phase 3 enrichment adapters (Owner/EPC/Planning + Potential HMO Analyzer)
        for (const adapter of this.phase3Adapters) {
          try {
            const data = await adapter.enrich({ ...property, ...enrichedData } as any)
            Object.assign(enrichedData, data)
          } catch (error) {
            console.error(`[${adapter.name}] Enrichment failed:`, error)
          }
        }

        // Update property with enriched data
        if (Object.keys(enrichedData).length > 0) {
          const { error } = await supabase.from("properties").update(enrichedData).eq("id", property.id)
          if (error) {
            console.error(`[IngestionManager] Failed to update property ${property.id}:`, error)
          }
        }
      }

      console.log(`[IngestionManager] Enriched ${properties.length} properties`)
    } catch (error) {
      console.error("[IngestionManager] Enrichment error:", error)
    }
  }

  private async markStaleProperties() {
    try {
      const supabase = supabaseAdmin
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
