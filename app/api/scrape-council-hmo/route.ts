import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * POST /api/scrape-council-hmo
 *
 * Scrapes council HMO registers for licence holder contact details
 * Many councils publish licence holder name, phone, and email
 *
 * Body: {
 *   council?: string,  // Specific council to scrape
 *   limit?: number,    // Max properties to update
 * }
 */
export async function POST(request: Request) {
  const log: string[] = []
  const enriched: string[] = []
  const failed: string[] = []

  try {
    const body = await request.json().catch(() => ({}))
    const targetCouncil = body.council
    const limit = Math.min(body.limit || 20, 50)

    log.push("Starting council HMO register scraping...")

    // Get properties that need LICENCE HOLDER contact info (separate from title owner)
    const { data: properties, error: fetchError } = await supabaseAdmin
      .from("properties")
      .select("id, address, postcode, city, licensed_hmo")
      .eq("is_stale", false)
      .is("licence_holder_phone", null)
      .is("licence_holder_email", null)
      .limit(limit)

    if (fetchError) {
      return NextResponse.json({ success: false, error: fetchError.message, log }, { status: 500 })
    }

    if (!properties || properties.length === 0) {
      log.push("No properties need contact enrichment")
      return NextResponse.json({ success: true, message: "No properties to enrich", log })
    }

    log.push(`Found ${properties.length} properties to check`)

    // Group properties by postcode area to determine council
    for (const property of properties) {
      const council = getCouncilFromPostcode(property.postcode)
      if (targetCouncil && council !== targetCouncil) continue

      log.push(`Processing: ${property.address} (${council})`)

      try {
        const licenceData = await fetchCouncilHMOData(council, property.address, property.postcode)

        if (licenceData && (licenceData.contact_phone || licenceData.contact_email || licenceData.licence_holder_name)) {
          const updateData: Record<string, any> = {
            licensed_hmo: true,
          }

          // Store in LICENCE HOLDER fields (separate from title owner)
          if (licenceData.licence_holder_name) {
            updateData.licence_holder_name = licenceData.licence_holder_name
            log.push(`  Found licence holder: ${licenceData.licence_holder_name}`)
          }
          if (licenceData.contact_phone) {
            updateData.licence_holder_phone = licenceData.contact_phone
            log.push(`  Found licence holder phone: ${licenceData.contact_phone}`)
          }
          if (licenceData.contact_email) {
            updateData.licence_holder_email = licenceData.contact_email
            log.push(`  Found licence holder email: ${licenceData.contact_email}`)
          }
          if (licenceData.licence_holder_address) {
            updateData.licence_holder_address = licenceData.licence_holder_address
          }
          if (licenceData.licence_number) {
            updateData.licence_id = licenceData.licence_number
          }
          if (licenceData.licence_expiry) {
            updateData.licence_end_date = licenceData.licence_expiry
          }
          if (licenceData.max_occupants) {
            updateData.max_occupants = licenceData.max_occupants
          }

          const { error: updateError } = await supabaseAdmin
            .from("properties")
            .update(updateData)
            .eq("id", property.id)

          if (updateError) {
            log.push(`  Failed to save: ${updateError.message}`)
            failed.push(property.address)
          } else {
            enriched.push(property.address)
          }
        } else {
          log.push(`  No contact info found in ${council} register`)
          failed.push(property.address)
        }
      } catch (error) {
        log.push(`  Error: ${error}`)
        failed.push(property.address)
      }

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    log.push("")
    log.push(`Completed: ${enriched.length} enriched, ${failed.length} no data`)

    return NextResponse.json({
      success: true,
      message: `Found contact info for ${enriched.length} properties`,
      log,
      enriched,
      failed,
      summary: { enriched: enriched.length, failed: failed.length },
    })

  } catch (error) {
    log.push("Error: " + String(error))
    return NextResponse.json({ success: false, error: String(error), log }, { status: 500 })
  }
}

/**
 * Determine council from postcode
 */
function getCouncilFromPostcode(postcode: string): string {
  if (!postcode) return "unknown"
  const area = postcode.toUpperCase().split(" ")[0]

  // London postcodes
  if (area.startsWith("N7") || area.startsWith("N19") || area.startsWith("N4")) return "islington"
  if (area.startsWith("E2") || area.startsWith("E1") || area.startsWith("E3")) return "tower_hamlets"
  if (area.startsWith("E8") || area.startsWith("E5") || area.startsWith("N16")) return "hackney"
  if (area.startsWith("SE5") || area.startsWith("SE15") || area.startsWith("SE22")) return "southwark"
  if (area.startsWith("SW9") || area.startsWith("SW2")) return "lambeth"
  if (area.startsWith("NW5") || area.startsWith("NW1") || area.startsWith("NW3")) return "camden"
  if (area.startsWith("N1")) return "islington"
  if (area.startsWith("E17") || area.startsWith("E11")) return "waltham_forest"

  // Other cities
  if (area.startsWith("M1") || area.startsWith("M14") || area.startsWith("M13")) return "manchester"
  if (area.startsWith("B1") || area.startsWith("B29") || area.startsWith("B16")) return "birmingham"
  if (area.startsWith("LS")) return "leeds"
  if (area.startsWith("L1") || area.startsWith("L15") || area.startsWith("L7")) return "liverpool"
  if (area.startsWith("NE")) return "newcastle"
  if (area.startsWith("NG")) return "nottingham"
  if (area.startsWith("S1") || area.startsWith("S10") || area.startsWith("S11")) return "sheffield"
  if (area.startsWith("BS")) return "bristol"

  return "unknown"
}

/**
 * Fetch HMO licence data from council register
 * Each council has different APIs/websites
 */
async function fetchCouncilHMOData(
  council: string,
  address: string,
  postcode: string
): Promise<{
  licence_holder_name?: string
  licence_holder_address?: string
  contact_phone?: string
  contact_email?: string
  licence_number?: string
  licence_expiry?: string
  max_occupants?: number
} | null> {
  try {
    switch (council) {
      case "islington":
        return await fetchIslingtonHMO(address, postcode)
      case "tower_hamlets":
        return await fetchTowerHamletsHMO(address, postcode)
      case "hackney":
        return await fetchHackneyHMO(address, postcode)
      case "southwark":
        return await fetchSouthwarkHMO(address, postcode)
      case "lambeth":
        return await fetchLambethHMO(address, postcode)
      case "camden":
        return await fetchCamdenHMO(address, postcode)
      case "manchester":
        return await fetchManchesterHMO(address, postcode)
      case "birmingham":
        return await fetchBirminghamHMO(address, postcode)
      case "leeds":
        return await fetchLeedsHMO(address, postcode)
      default:
        return null
    }
  } catch (error) {
    console.error(`Error fetching ${council} HMO data:`, error)
    return null
  }
}

// Council-specific scrapers
// These fetch from public council HMO registers

async function fetchIslingtonHMO(address: string, postcode: string) {
  // Islington publishes HMO register as CSV/API
  // https://www.islington.gov.uk/housing/private-renting/hmo-licensing/public-register
  try {
    const searchUrl = `https://www.islington.gov.uk/api/hmo-register?postcode=${encodeURIComponent(postcode)}`
    const response = await fetch(searchUrl, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(5000)
    })

    if (!response.ok) return null

    const data = await response.json()
    if (!data.results || data.results.length === 0) return null

    // Find matching address
    const match = data.results.find((r: any) =>
      r.address?.toLowerCase().includes(address.toLowerCase().split(",")[0])
    )

    if (!match) return null

    return {
      licence_holder_name: match.licence_holder || match.licensee,
      contact_phone: match.contact_telephone || match.phone,
      contact_email: match.contact_email || match.email,
      licence_number: match.licence_number || match.reference,
      licence_expiry: match.expiry_date,
      max_occupants: match.max_occupancy ? parseInt(match.max_occupancy) : undefined,
    }
  } catch {
    return null
  }
}

async function fetchTowerHamletsHMO(address: string, postcode: string) {
  // Tower Hamlets has an open data portal
  try {
    const searchUrl = `https://opendata.towerhamlets.gov.uk/api/3/action/datastore_search?resource_id=hmo-register&q=${encodeURIComponent(postcode)}`
    const response = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) })

    if (!response.ok) return null

    const data = await response.json()
    if (!data.result?.records || data.result.records.length === 0) return null

    const match = data.result.records.find((r: any) =>
      r.address?.toLowerCase().includes(address.toLowerCase().split(",")[0])
    )

    if (!match) return null

    return {
      licence_holder_name: match.licence_holder,
      contact_phone: match.telephone,
      contact_email: match.email,
      licence_number: match.licence_ref,
      licence_expiry: match.expiry,
      max_occupants: match.max_persons ? parseInt(match.max_persons) : undefined,
    }
  } catch {
    return null
  }
}

async function fetchHackneyHMO(address: string, postcode: string) {
  // Hackney council HMO register
  try {
    const searchUrl = `https://hackney.gov.uk/api/hmo-register/search?postcode=${encodeURIComponent(postcode)}`
    const response = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) })

    if (!response.ok) return null

    const data = await response.json()
    if (!data.licences || data.licences.length === 0) return null

    const match = data.licences.find((r: any) =>
      r.property_address?.toLowerCase().includes(address.toLowerCase().split(",")[0])
    )

    if (!match) return null

    return {
      licence_holder_name: match.licence_holder_name,
      contact_phone: match.contact_number,
      contact_email: match.email_address,
      licence_number: match.licence_number,
      licence_expiry: match.expiry_date,
      max_occupants: match.maximum_occupancy ? parseInt(match.maximum_occupancy) : undefined,
    }
  } catch {
    return null
  }
}

async function fetchSouthwarkHMO(address: string, postcode: string) {
  try {
    // Southwark publishes via data.gov.uk
    const response = await fetch(
      `https://www.southwark.gov.uk/api/hmo/search?postcode=${encodeURIComponent(postcode)}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!response.ok) return null
    const data = await response.json()
    const match = data.results?.find((r: any) =>
      r.address?.toLowerCase().includes(address.toLowerCase().split(",")[0])
    )
    if (!match) return null
    return {
      licence_holder_name: match.licensee_name,
      contact_phone: match.phone,
      contact_email: match.email,
      licence_number: match.licence_ref,
      licence_expiry: match.expiry,
    }
  } catch {
    return null
  }
}

async function fetchLambethHMO(address: string, postcode: string) {
  try {
    const response = await fetch(
      `https://www.lambeth.gov.uk/api/hmo-register?postcode=${encodeURIComponent(postcode)}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!response.ok) return null
    const data = await response.json()
    const match = data.properties?.find((r: any) =>
      r.address?.toLowerCase().includes(address.toLowerCase().split(",")[0])
    )
    if (!match) return null
    return {
      licence_holder_name: match.holder,
      contact_phone: match.tel,
      contact_email: match.email,
      licence_number: match.licence_no,
    }
  } catch {
    return null
  }
}

async function fetchCamdenHMO(address: string, postcode: string) {
  try {
    const response = await fetch(
      `https://opendata.camden.gov.uk/api/views/hmo-register/rows.json?postcode=${encodeURIComponent(postcode)}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!response.ok) return null
    const data = await response.json()
    const match = data.data?.find((r: any[]) =>
      r[1]?.toLowerCase().includes(address.toLowerCase().split(",")[0])
    )
    if (!match) return null
    return {
      licence_holder_name: match[3],
      contact_phone: match[4],
      contact_email: match[5],
      licence_number: match[0],
    }
  } catch {
    return null
  }
}

async function fetchManchesterHMO(address: string, postcode: string) {
  try {
    const response = await fetch(
      `https://www.manchester.gov.uk/api/hmo/search?postcode=${encodeURIComponent(postcode)}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!response.ok) return null
    const data = await response.json()
    const match = data.licences?.find((r: any) =>
      r.address?.toLowerCase().includes(address.toLowerCase().split(",")[0])
    )
    if (!match) return null
    return {
      licence_holder_name: match.licence_holder,
      contact_phone: match.phone,
      contact_email: match.email,
    }
  } catch {
    return null
  }
}

async function fetchBirminghamHMO(address: string, postcode: string) {
  try {
    const response = await fetch(
      `https://www.birmingham.gov.uk/api/hmo-register?search=${encodeURIComponent(postcode)}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!response.ok) return null
    const data = await response.json()
    const match = data.results?.find((r: any) =>
      r.property_address?.toLowerCase().includes(address.toLowerCase().split(",")[0])
    )
    if (!match) return null
    return {
      licence_holder_name: match.licensee,
      contact_phone: match.contact_tel,
      contact_email: match.contact_email,
    }
  } catch {
    return null
  }
}

async function fetchLeedsHMO(address: string, postcode: string) {
  try {
    // Leeds City Council publishes HMO register
    const response = await fetch(
      `https://datamillnorth.org/api/3/action/datastore_search?resource_id=hmo-licences&q=${encodeURIComponent(postcode)}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!response.ok) return null
    const data = await response.json()
    const match = data.result?.records?.find((r: any) =>
      r.Address?.toLowerCase().includes(address.toLowerCase().split(",")[0])
    )
    if (!match) return null
    return {
      licence_holder_name: match["Licence Holder"],
      contact_phone: match["Contact Phone"],
      contact_email: match["Contact Email"],
      licence_number: match["Licence Number"],
      max_occupants: match["Max Occupants"] ? parseInt(match["Max Occupants"]) : undefined,
    }
  } catch {
    return null
  }
}

export async function GET() {
  return NextResponse.json({
    message: "POST to scrape council HMO registers for licence holder contact details",
    supportedCouncils: [
      "islington", "tower_hamlets", "hackney", "southwark", "lambeth", "camden",
      "manchester", "birmingham", "leeds"
    ],
    usage: {
      all: "POST with {}",
      specific: "POST with { council: 'islington' }",
      limited: "POST with { limit: 10 }",
    },
  })
}
