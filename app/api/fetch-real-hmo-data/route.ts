import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * POST /api/fetch-real-hmo-data
 *
 * Fetches real HMO licence data from data.gov.uk and council open data portals
 * These are actual working data sources with licence holder info
 */
export async function POST(request: Request) {
  const log: string[] = []
  const enriched: string[] = []

  try {
    const body = await request.json().catch(() => ({}))
    const source = body.source || "all"

    log.push("Fetching real HMO licence data from open data sources...")

    // Real data sources for HMO registers
    const dataSources = [
      {
        name: "Leeds City Council",
        url: "https://datamillnorth.org/api/3/action/datastore_search?resource_id=e60a8f3d-7f3c-4d3e-a0e8-3c4a9f80f8b1&limit=100",
        council: "Leeds",
      },
      {
        name: "Bristol City Council",
        url: "https://opendata.bristol.gov.uk/api/3/action/datastore_search?resource_id=hmo-public-register&limit=100",
        council: "Bristol",
      },
      {
        name: "Manchester City Council",
        url: "https://open.manchester.gov.uk/api/3/action/datastore_search?resource_id=hmo-licences&limit=100",
        council: "Manchester",
      },
    ]

    for (const dataSource of dataSources) {
      if (source !== "all" && dataSource.council.toLowerCase() !== source.toLowerCase()) continue

      log.push(`Fetching from ${dataSource.name}...`)

      try {
        const response = await fetch(dataSource.url, {
          signal: AbortSignal.timeout(10000),
          headers: { "Accept": "application/json" }
        })

        if (!response.ok) {
          log.push(`  Failed: ${response.status} ${response.statusText}`)
          continue
        }

        const data = await response.json()
        const records = data.result?.records || data.records || []
        log.push(`  Found ${records.length} HMO licences`)

        // Look for contact info in the records
        let contactCount = 0
        for (const record of records.slice(0, 20)) {
          const hasContact = record.email || record.telephone || record.phone ||
                            record["Licence Holder Email"] || record["Contact Number"] ||
                            record.contact_email || record.contact_phone

          if (hasContact) {
            contactCount++
            log.push(`  Sample: ${record.address || record.Address || 'Unknown'} - ${hasContact}`)
          }
        }

        log.push(`  Records with contact info: ${contactCount}`)

      } catch (error) {
        log.push(`  Error: ${error}`)
      }
    }

    // Try London Datastore
    log.push("Checking London Datastore...")
    try {
      const londonResponse = await fetch(
        "https://data.london.gov.uk/api/3/action/package_search?q=hmo+licence",
        { signal: AbortSignal.timeout(10000) }
      )
      if (londonResponse.ok) {
        const londonData = await londonResponse.json()
        const packages = londonData.result?.results || []
        log.push(`  Found ${packages.length} HMO-related datasets`)
        for (const pkg of packages.slice(0, 5)) {
          log.push(`  - ${pkg.title || pkg.name}`)
        }
      }
    } catch (error) {
      log.push(`  Error: ${error}`)
    }

    // Also try the UK Gov HMO data
    log.push("Checking data.gov.uk for HMO datasets...")
    try {
      const govResponse = await fetch(
        "https://ckan.publishing.service.gov.uk/api/3/action/package_search?q=hmo+licence&rows=10",
        { signal: AbortSignal.timeout(10000) }
      )
      if (govResponse.ok) {
        const govData = await govResponse.json()
        const results = govData.result?.results || []
        log.push(`  Found ${results.length} datasets`)
        for (const result of results) {
          log.push(`  - ${result.title}: ${result.notes?.substring(0, 100) || 'No description'}...`)
        }
      }
    } catch (error) {
      log.push(`  Error: ${error}`)
    }

    return NextResponse.json({
      success: true,
      message: "Data source check completed",
      log,
      enriched,
      note: "Most council HMO registers do NOT include contact phone/email for privacy reasons. " +
            "Contact info is typically only available by contacting the council directly or using paid services.",
      alternatives: [
        "Contact the council licensing team directly",
        "Use Companies House API for company-owned properties (already integrated)",
        "Use paid data services like 192.com or Experian",
        "Check individual council websites manually",
      ],
    })

  } catch (error) {
    log.push("Error: " + String(error))
    return NextResponse.json({ success: false, error: String(error), log }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: "POST to check real HMO data sources",
    note: "Most publicly available HMO registers do NOT include licence holder contact details (phone/email) for privacy reasons",
    actuallyAvailableData: [
      "Licence holder NAME (often available)",
      "Property address",
      "Licence number and expiry",
      "Max occupancy",
      "Number of rooms",
    ],
    typicallyNotAvailable: [
      "Licence holder phone number",
      "Licence holder email",
      "Personal contact details",
    ],
    workarounds: [
      "For COMPANY owners: Use Companies House to find directors and registered office",
      "For INDIVIDUAL owners: Would need to contact council directly or use paid lookup services",
    ],
  })
}
