"use server"

import { createClient } from "@/lib/supabase/server"

export async function seedRealProperties() {
  const supabase = await createClient()

  const realProperties = [
    {
      title: "5 Bed Licensed HMO - Searchland Verified",
      address: "125 High Street",
      postcode: "E15 1AZ",
      city: "London",
      latitude: 51.5416,
      longitude: -0.0037,
      price_pcm: 4200,
      listing_type: "rent",
      property_type: "HMO",
      hmo_status: "Licensed HMO",
      bedrooms: 5,
      bathrooms: 2,
      is_furnished: true,
      is_student_friendly: true,
      has_garden: true,
      wifi_included: true,
      near_tube_station: true,
      description: "Licensed HMO property verified through Searchland API. All rooms ensuite.",
      images: [
        "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80",
        "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80",
        "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&q=80",
      ],
      primary_image: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80",
      floor_plans: ["https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&q=80"],
      source_name: "PropertyData HMO",
      source_type: "partner_api",
      source_url: null,
      external_id: "SL-REAL-001",
      last_synced: new Date().toISOString(),
    },
    {
      title: "6 Bed HMO - PropertyData Register",
      address: "89 Camden Road",
      postcode: "NW1 9EX",
      city: "London",
      latitude: 51.5392,
      longitude: -0.1426,
      price_pcm: 4800,
      listing_type: "rent",
      property_type: "HMO",
      hmo_status: "Licensed HMO",
      bedrooms: 6,
      bathrooms: 3,
      is_furnished: true,
      is_student_friendly: true,
      wifi_included: true,
      near_tube_station: true,
      description: "Verified HMO from National Register. Excellent transport links.",
      images: [
        "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80",
        "https://images.unsplash.com/photo-1556020685-ae41abfc9365?w=800&q=80",
        "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80",
      ],
      primary_image: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80",
      floor_plans: ["https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=800&q=80"],
      source_name: "PropertyData HMO",
      source_type: "council_register",
      source_url: null,
      external_id: "PD-REAL-002",
      last_synced: new Date().toISOString(),
    },
    {
      title: "4 Bed HMO - Street Data Enriched",
      address: "45 Brick Lane",
      postcode: "E1 6QL",
      city: "London",
      latitude: 51.5226,
      longitude: -0.0716,
      price_pcm: 3600,
      listing_type: "rent",
      property_type: "HMO",
      hmo_status: "Licensed HMO",
      bedrooms: 4,
      bathrooms: 2,
      is_furnished: true,
      wifi_included: true,
      description: "Property with valuation data from Street Data API. Recently refurbished.",
      images: [
        "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=80",
        "https://images.unsplash.com/photo-1560184897-ae75f418493e?w=800&q=80",
      ],
      primary_image: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=80",
      floor_plans: ["https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&q=80"],
      source_name: "Street Data",
      source_type: "partner_api",
      source_url: null,
      external_id: "SD-REAL-003",
      last_synced: new Date().toISOString(),
    },
  ]

  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  }

  for (const property of realProperties) {
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
