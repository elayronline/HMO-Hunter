import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { requireAdmin } from "@/lib/api-auth"

/**
 * POST /api/add-sample-contacts
 *
 * Adds sample owner/contact data to properties for testing the UI
 * Requires admin authentication
 */
export async function POST() {
  // Require admin access for this endpoint
  const auth = await requireAdmin()
  if (!auth.authenticated) {
    return auth.response
  }

  const log: string[] = []
  const updated: string[] = []

  try {
    log.push("Fetching properties to add sample contact data...")

    // Get first 5 properties
    const { data: properties, error: fetchError } = await supabaseAdmin
      .from("properties")
      .select("id, address, postcode, city")
      .eq("is_stale", false)
      .limit(5)

    if (fetchError) {
      return NextResponse.json({
        success: false,
        error: fetchError.message,
        log
      }, { status: 500 })
    }

    if (!properties || properties.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No properties found",
        log
      })
    }

    log.push(`Found ${properties.length} properties`)

    // Sample owner data
    const sampleOwners = [
      {
        owner_name: "London Property Holdings Ltd",
        owner_type: "company",
        owner_contact_phone: "020 7123 4567",
        owner_contact_email: "enquiries@lph-properties.co.uk",
        owner_address: "45 Bishopsgate, London EC2N 3AR",
        company_name: "London Property Holdings Ltd",
        company_number: "12345678",
        company_status: "active",
        owner_enrichment_source: "sample_data"
      },
      {
        owner_name: "James Morrison",
        owner_type: "individual",
        owner_contact_phone: "07700 900123",
        owner_contact_email: "j.morrison@email.com",
        owner_address: "12 Maple Avenue, London N1 2AB",
        owner_enrichment_source: "sample_data"
      },
      {
        owner_name: "Metropolitan Housing Trust",
        owner_type: "company",
        owner_contact_phone: "0800 123 4567",
        owner_contact_email: "housing@met-trust.org",
        owner_address: "100 City Road, London EC1V 2NW",
        company_name: "Metropolitan Housing Trust",
        company_number: "87654321",
        company_status: "active",
        owner_enrichment_source: "sample_data"
      },
      {
        owner_name: "Sarah Williams",
        owner_type: "individual",
        owner_contact_phone: "07777 888999",
        owner_address: "28 Oak Street, London SE1 4QP",
        owner_enrichment_source: "sample_data"
      },
      {
        owner_name: "Capital Investments PLC",
        owner_type: "company",
        owner_contact_email: "info@capital-inv.com",
        owner_address: "Canary Wharf, London E14 5AB",
        company_name: "Capital Investments PLC",
        company_number: "11223344",
        company_status: "active",
        directors: [
          { name: "Robert Chen", role: "Director", appointed_on: "2019-03-15" },
          { name: "Emma Thompson", role: "Director", appointed_on: "2020-06-01" }
        ],
        owner_enrichment_source: "sample_data"
      }
    ]

    // Update each property with sample data
    for (let i = 0; i < properties.length; i++) {
      const property = properties[i]
      const sampleData = sampleOwners[i % sampleOwners.length]

      const { error: updateError } = await supabaseAdmin
        .from("properties")
        .update(sampleData)
        .eq("id", property.id)

      if (updateError) {
        log.push(`Failed to update ${property.address}: ${updateError.message}`)
      } else {
        log.push(`Updated ${property.address} with owner: ${sampleData.owner_name}`)
        updated.push(property.address)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Added sample contact data to ${updated.length} properties`,
      log,
      updated,
      instruction: "Refresh the page to see contact info on properties"
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
      log
    }, { status: 500 })
  }
}

/**
 * GET /api/add-sample-contacts
 * Returns documentation
 */
export async function GET() {
  return NextResponse.json({
    message: "POST to add sample owner/contact data to properties for UI testing",
    description: "This adds realistic sample data including phone numbers, emails, and company info",
    warning: "Only use for testing - will overwrite any existing owner data",
    usage: "POST /api/add-sample-contacts"
  })
}
