import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const maxDuration = 300

/**
 * POST /api/setup-database
 *
 * Seeds sample properties across UK cities with proper coordinates.
 * Uses admin client to bypass RLS.
 */
export async function POST() {
  try {
    const supabase = supabaseAdmin

    console.log("[Setup] Seeding sample properties...")

    // Sample properties with proper coordinates - using only base columns
    // hmo_status can be: "Licensed HMO", "Standard HMO", "Potential HMO"
    const sampleProperties = [
      // London - Potential HMOs (opportunities)
      { title: "Investment Property - Stratford", address: "45 Stratford High Street", postcode: "E15 2PJ", city: "London", latitude: 51.5423, longitude: -0.0034, purchase_price: 385000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 5, bathrooms: 2, is_stale: false },
      { title: "HMO Opportunity - Lewisham", address: "123 Lewisham Way", postcode: "SE14 6PP", city: "London", latitude: 51.4647, longitude: -0.0205, purchase_price: 425000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 6, bathrooms: 2, is_stale: false },
      { title: "Value Add - Croydon", address: "78 Croydon High Street", postcode: "CR0 1NA", city: "London", latitude: 51.3727, longitude: -0.0988, purchase_price: 320000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 4, bathrooms: 2, is_stale: false },
      { title: "Investment - Barking", address: "56 Ripple Road", postcode: "IG11 7PL", city: "London", latitude: 51.5363, longitude: 0.0811, purchase_price: 295000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 4, bathrooms: 1, is_stale: false },
      { title: "Opportunity - Woolwich", address: "34 Woolwich High Street", postcode: "SE18 6DN", city: "London", latitude: 51.4906, longitude: 0.0655, purchase_price: 340000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 5, bathrooms: 2, is_stale: false },
      // London - Licensed HMOs (existing)
      { title: "Licensed HMO - Camden", address: "89 Camden High Street", postcode: "NW1 7JY", city: "London", latitude: 51.5392, longitude: -0.1426, price_pcm: 4200, listing_type: "rent", property_type: "House", hmo_status: "Licensed HMO", bedrooms: 7, bathrooms: 2, is_stale: false },
      { title: "Licensed HMO - Islington", address: "88 Upper Street", postcode: "N1 0NP", city: "London", latitude: 51.5416, longitude: -0.1030, price_pcm: 4300, listing_type: "rent", property_type: "House", hmo_status: "Licensed HMO", bedrooms: 7, bathrooms: 3, is_stale: false },
      { title: "Licensed HMO - Southwark", address: "201 Borough High Street", postcode: "SE1 1JA", city: "London", latitude: 51.5012, longitude: -0.0919, price_pcm: 3900, listing_type: "rent", property_type: "Flat", hmo_status: "Licensed HMO", bedrooms: 5, bathrooms: 2, is_stale: false },
      { title: "Licensed HMO - Hackney", address: "167 Mare Street", postcode: "E8 3RH", city: "London", latitude: 51.5456, longitude: -0.0553, price_pcm: 4000, listing_type: "rent", property_type: "Flat", hmo_status: "Licensed HMO", bedrooms: 6, bathrooms: 2, is_stale: false },

      // Manchester
      { title: "HMO Ready - Fallowfield", address: "45 Wilmslow Road", postcode: "M14 6XQ", city: "Manchester", latitude: 53.4488, longitude: -2.2187, purchase_price: 185000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 5, bathrooms: 2, is_stale: false },
      { title: "Investment - Rusholme", address: "123 Wilmslow Road", postcode: "M14 5LW", city: "Manchester", latitude: 53.4555, longitude: -2.2176, purchase_price: 195000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 6, bathrooms: 2, is_stale: false },
      { title: "Value Add - Longsight", address: "78 Stockport Road", postcode: "M12 4AA", city: "Manchester", latitude: 53.4627, longitude: -2.2039, purchase_price: 155000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 4, bathrooms: 1, is_stale: false },
      { title: "Licensed HMO - Withington", address: "56 Burton Road", postcode: "M20 3EB", city: "Manchester", latitude: 53.4315, longitude: -2.2276, price_pcm: 2800, listing_type: "rent", property_type: "House", hmo_status: "Licensed HMO", bedrooms: 5, bathrooms: 2, is_stale: false },
      { title: "Opportunity - Moss Side", address: "92 Princess Road", postcode: "M14 4TH", city: "Manchester", latitude: 53.4521, longitude: -2.2438, purchase_price: 165000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 5, bathrooms: 2, is_stale: false },

      // Birmingham
      { title: "Licensed HMO - Selly Oak", address: "45 Bristol Road", postcode: "B29 6BD", city: "Birmingham", latitude: 52.4398, longitude: -1.9356, price_pcm: 2400, listing_type: "rent", property_type: "House", hmo_status: "Licensed HMO", bedrooms: 6, bathrooms: 2, is_stale: false },
      { title: "HMO Ready - Erdington", address: "123 High Street Erdington", postcode: "B23 6RH", city: "Birmingham", latitude: 52.5262, longitude: -1.8406, purchase_price: 165000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 5, bathrooms: 2, is_stale: false },
      { title: "Value Add - Handsworth", address: "56 Soho Road", postcode: "B21 9DP", city: "Birmingham", latitude: 52.5087, longitude: -1.9366, purchase_price: 145000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 4, bathrooms: 1, is_stale: false },
      { title: "Opportunity - Aston", address: "78 Lichfield Road", postcode: "B6 5RU", city: "Birmingham", latitude: 52.5009, longitude: -1.8816, purchase_price: 155000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 5, bathrooms: 2, is_stale: false },

      // Leeds
      { title: "HMO Ready - Hyde Park", address: "34 Hyde Park Road", postcode: "LS6 1AG", city: "Leeds", latitude: 53.8176, longitude: -1.5582, purchase_price: 175000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 5, bathrooms: 2, is_stale: false },
      { title: "Investment - Headingley", address: "89 Otley Road", postcode: "LS6 3PX", city: "Leeds", latitude: 53.8263, longitude: -1.5758, purchase_price: 195000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 6, bathrooms: 2, is_stale: false },
      { title: "Value Add - Burley", address: "67 Burley Road", postcode: "LS3 1JP", city: "Leeds", latitude: 53.8019, longitude: -1.5765, purchase_price: 140000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 4, bathrooms: 1, is_stale: false },
      { title: "Licensed HMO - Woodhouse", address: "23 Woodhouse Lane", postcode: "LS2 3ED", city: "Leeds", latitude: 53.8070, longitude: -1.5531, price_pcm: 2600, listing_type: "rent", property_type: "House", hmo_status: "Licensed HMO", bedrooms: 6, bathrooms: 2, is_stale: false },

      // Bristol
      { title: "Licensed HMO - Clifton", address: "45 Whiteladies Road", postcode: "BS8 2NT", city: "Bristol", latitude: 51.4629, longitude: -2.6141, price_pcm: 3200, listing_type: "rent", property_type: "House", hmo_status: "Licensed HMO", bedrooms: 6, bathrooms: 2, is_stale: false },
      { title: "HMO Ready - Fishponds", address: "123 Fishponds Road", postcode: "BS16 3DL", city: "Bristol", latitude: 51.4817, longitude: -2.5280, purchase_price: 265000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 5, bathrooms: 2, is_stale: false },
      { title: "Value Add - Easton", address: "56 Stapleton Road", postcode: "BS5 0QR", city: "Bristol", latitude: 51.4657, longitude: -2.5574, purchase_price: 235000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 4, bathrooms: 2, is_stale: false },
      { title: "Opportunity - St Pauls", address: "78 City Road", postcode: "BS2 8TP", city: "Bristol", latitude: 51.4620, longitude: -2.5780, purchase_price: 245000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 5, bathrooms: 2, is_stale: false },

      // Liverpool
      { title: "HMO Ready - Wavertree", address: "45 Picton Road", postcode: "L15 4LG", city: "Liverpool", latitude: 53.4014, longitude: -2.9276, purchase_price: 115000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 5, bathrooms: 2, is_stale: false },
      { title: "Investment - Kensington", address: "78 Edge Lane", postcode: "L7 9JH", city: "Liverpool", latitude: 53.4088, longitude: -2.9358, purchase_price: 98000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 4, bathrooms: 1, is_stale: false },
      { title: "Value Add - Anfield", address: "34 Walton Breck Road", postcode: "L4 0RE", city: "Liverpool", latitude: 53.4296, longitude: -2.9594, purchase_price: 85000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 4, bathrooms: 1, is_stale: false },
      { title: "Licensed HMO - Toxteth", address: "56 Lodge Lane", postcode: "L8 0QF", city: "Liverpool", latitude: 53.3886, longitude: -2.9536, price_pcm: 2200, listing_type: "rent", property_type: "House", hmo_status: "Licensed HMO", bedrooms: 5, bathrooms: 2, is_stale: false },

      // Sheffield
      { title: "HMO Ready - Ecclesall", address: "45 Ecclesall Road", postcode: "S11 8PR", city: "Sheffield", latitude: 53.3698, longitude: -1.4916, purchase_price: 175000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 5, bathrooms: 2, is_stale: false },
      { title: "Value Add - Crookes", address: "78 Crookes Road", postcode: "S10 1UE", city: "Sheffield", latitude: 53.3908, longitude: -1.5103, purchase_price: 155000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 4, bathrooms: 2, is_stale: false },
      { title: "Opportunity - Hunters Bar", address: "23 Sharrow Vale Road", postcode: "S11 8ZA", city: "Sheffield", latitude: 53.3673, longitude: -1.4988, purchase_price: 185000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 5, bathrooms: 2, is_stale: false },

      // Nottingham
      { title: "HMO Ready - Lenton", address: "34 Derby Road", postcode: "NG7 2GW", city: "Nottingham", latitude: 52.9479, longitude: -1.1800, purchase_price: 165000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 5, bathrooms: 2, is_stale: false },
      { title: "Investment - Radford", address: "56 Ilkeston Road", postcode: "NG7 3FX", city: "Nottingham", latitude: 52.9591, longitude: -1.1876, purchase_price: 145000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 4, bathrooms: 1, is_stale: false },
      { title: "Licensed HMO - Sherwood", address: "78 Mansfield Road", postcode: "NG5 2EJ", city: "Nottingham", latitude: 52.9732, longitude: -1.1500, price_pcm: 2400, listing_type: "rent", property_type: "House", hmo_status: "Licensed HMO", bedrooms: 5, bathrooms: 2, is_stale: false },

      // Portsmouth
      { title: "HMO Ready - Southsea", address: "45 Albert Road", postcode: "PO5 2SE", city: "Portsmouth", latitude: 50.7835, longitude: -1.0817, purchase_price: 215000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 5, bathrooms: 2, is_stale: false },
      { title: "Value Add - Milton", address: "78 Milton Road", postcode: "PO4 8PR", city: "Portsmouth", latitude: 50.8011, longitude: -1.0621, purchase_price: 185000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 4, bathrooms: 1, is_stale: false },
      { title: "Licensed HMO - Fratton", address: "56 Fratton Road", postcode: "PO1 5BN", city: "Portsmouth", latitude: 50.7963, longitude: -1.0749, price_pcm: 2600, listing_type: "rent", property_type: "House", hmo_status: "Licensed HMO", bedrooms: 5, bathrooms: 2, is_stale: false },

      // Reading
      { title: "HMO Ready - East Reading", address: "45 London Road", postcode: "RG1 5AU", city: "Reading", latitude: 51.4565, longitude: -0.9683, purchase_price: 285000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 5, bathrooms: 2, is_stale: false },
      { title: "Licensed HMO - West Reading", address: "78 Oxford Road", postcode: "RG30 1AP", city: "Reading", latitude: 51.4541, longitude: -1.0066, price_pcm: 3400, listing_type: "rent", property_type: "House", hmo_status: "Licensed HMO", bedrooms: 6, bathrooms: 2, is_stale: false },

      // Newcastle
      { title: "HMO Ready - Fenham", address: "45 Fenham Hall Drive", postcode: "NE4 9XD", city: "Newcastle", latitude: 54.9816, longitude: -1.6517, purchase_price: 135000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 5, bathrooms: 2, is_stale: false },
      { title: "Licensed HMO - Jesmond", address: "78 Osborne Road", postcode: "NE2 2AP", city: "Newcastle", latitude: 54.9892, longitude: -1.6019, price_pcm: 2800, listing_type: "rent", property_type: "House", hmo_status: "Licensed HMO", bedrooms: 6, bathrooms: 2, is_stale: false },
      { title: "Value Add - Heaton", address: "34 Chillingham Road", postcode: "NE6 5LN", city: "Newcastle", latitude: 54.9812, longitude: -1.5784, purchase_price: 125000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 4, bathrooms: 1, is_stale: false },
      { title: "Opportunity - Benwell", address: "56 Adelaide Terrace", postcode: "NE4 8BR", city: "Newcastle", latitude: 54.9724, longitude: -1.6648, purchase_price: 115000, listing_type: "purchase", property_type: "House", hmo_status: "Potential HMO", bedrooms: 5, bathrooms: 2, is_stale: false },
    ]

    let inserted = 0
    let updated = 0
    const errors: string[] = []

    for (const property of sampleProperties) {
      // Check if property already exists
      const { data: existing } = await supabase
        .from("properties")
        .select("id")
        .eq("address", property.address)
        .eq("postcode", property.postcode)
        .maybeSingle()

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("properties")
          .update(property)
          .eq("id", existing.id)

        if (error) {
          errors.push(`Update ${property.address}: ${error.message}`)
        } else {
          updated++
        }
      } else {
        // Insert new
        const { error } = await supabase.from("properties").insert(property)

        if (error) {
          errors.push(`Insert ${property.address}: ${error.message}`)
        } else {
          inserted++
        }
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      message: `Database setup complete: ${inserted} inserted, ${updated} updated`,
      inserted,
      updated,
      total: sampleProperties.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error("[Setup] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Use POST to set up the database with sample properties",
    description: "This will seed sample properties across multiple UK cities with proper coordinates",
    cities: ["London", "Manchester", "Birmingham", "Leeds", "Bristol", "Liverpool", "Sheffield", "Nottingham", "Portsmouth", "Reading", "Newcastle"],
  })
}
