"use server"

import { createClient } from "@/lib/supabase/server"

export async function seedSampleIngestionData() {
  const supabase = await createClient()

  const sampleProperties = [
    {
      title: "6 Bed Student Property - National Register",
      address: "78 Clapham High Street",
      postcode: "SW4 7UL",
      city: "London",
      latitude: 51.464,
      longitude: -0.138,
      price_pcm: 4200,
      listing_type: "rent",
      property_type: "HMO",
      hmo_status: "Licensed HMO",
      bedrooms: 6,
      bathrooms: 3,
      is_furnished: true,
      is_student_friendly: true,
      wifi_included: true,
      near_tube_station: true,
      description: "Perfect student accommodation in vibrant Clapham area. From National HMO Register.",
      images: ["/house-2.jpg", "/house-3.jpg"],
      primary_image: "/house-2.jpg",
      source_name: "PropertyData HMO",
      source_type: "licensed_api",
      source_url: null,
      external_id: "PD987654321",
      last_synced: new Date().toISOString(),
    },
    {
      title: "4 Bed Shared House - Enriched Data",
      address: "23 Bethnal Green Road",
      postcode: "E2 6LA",
      city: "London",
      latitude: 51.5226,
      longitude: -0.0628,
      price_pcm: 2800,
      listing_type: "rent",
      property_type: "HMO",
      hmo_status: "Unlicensed HMO",
      bedrooms: 4,
      bathrooms: 2,
      is_furnished: true,
      is_student_friendly: true,
      wifi_included: true,
      description: "Property with valuation data from Street Data API.",
      images: ["/modern-shared-house-property.jpg"],
      primary_image: "/modern-shared-house-property.jpg",
      source_name: "Street Data",
      source_type: "enrichment_api",
      source_url: null,
      external_id: "SD555555",
      last_synced: new Date().toISOString(),
    },
    {
      title: "Analytics-Enhanced Property",
      address: "156 Holloway Road",
      postcode: "N7 8DD",
      city: "London",
      latitude: 51.553,
      longitude: -0.114,
      price_pcm: 3500,
      listing_type: "rent",
      property_type: "HMO",
      hmo_status: "Licensed HMO",
      bedrooms: 5,
      bathrooms: 2,
      is_furnished: true,
      wifi_included: true,
      description: "Property with market analytics from PaTMa API.",
      images: ["/house-1.jpg"],
      primary_image: "/house-1.jpg",
      source_name: "PaTMa",
      source_type: "enrichment_api",
      source_url: null,
      external_id: "PM333333",
      last_synced: new Date().toISOString(),
    },
  ]

  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  }

  for (const property of sampleProperties) {
    try {
      const { error } = await supabase.from("properties").upsert(property, {
        onConflict: "postcode,external_id,source_name",
        ignoreDuplicates: false,
      })

      if (error) {
        results.failed++
        results.errors.push(`${property.external_id}: ${error.message}`)
      } else {
        results.success++
      }
    } catch (error) {
      results.failed++
      results.errors.push(`${property.external_id}: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  return results
}
