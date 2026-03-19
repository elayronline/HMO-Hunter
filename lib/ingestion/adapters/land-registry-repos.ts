/**
 * Land Registry Price Paid - Repossession Filter Adapter
 *
 * Downloads monthly Price Paid updates and filters for Category B
 * (includes repossessions, buy-to-lets, power of sale transfers).
 * Cross-references with below-market pricing to identify likely repossessions.
 *
 * Source: https://landregistry.data.gov.uk/
 * Monthly CSV: https://price-paid-data.publicdata.landregistry.gov.uk/pp-monthly-update-new-version.csv
 */

export interface LandRegistryRepossession {
  transaction_id: string
  price: number
  date_of_transfer: string
  postcode: string
  property_type: string   // D, S, T, F, O
  old_new: string         // Y=new, N=established
  duration: string        // F=freehold, L=leasehold
  paon: string            // House number/name
  saon: string            // Flat number
  street: string
  locality: string
  town_city: string
  district: string
  county: string
  ppd_category: string    // A=standard, B=additional (repos etc.)
  record_status: string   // A=addition, C=change, D=delete
  full_address: string
}

const MONTHLY_CSV_URL = "https://price-paid-data.publicdata.landregistry.gov.uk/pp-monthly-update-new-version.csv"

export async function fetchLandRegistryRepossessions(): Promise<LandRegistryRepossession[]> {
  try {
    const response = await fetch(MONTHLY_CSV_URL)
    if (!response.ok) {
      console.error(`[LandRegistry Repos] Failed to fetch CSV: ${response.status}`)
      return []
    }

    const text = await response.text()
    const lines = text.split("\n").filter(line => line.trim())

    const repos: LandRegistryRepossession[] = []

    for (const line of lines) {
      const fields = parseCSVLine(line)
      if (fields.length < 16) continue

      const [
        transactionId, price, dateOfTransfer, postcode,
        propertyType, oldNew, duration, paon, saon,
        street, locality, townCity, district, county,
        ppdCategory, recordStatus,
      ] = fields.map(f => f.trim().replace(/^"|"$/g, ""))

      // Only Category B (includes repossessions)
      if (ppdCategory !== "B") continue

      // Skip deletions
      if (recordStatus === "D") continue

      const priceNum = parseInt(price, 10)
      if (isNaN(priceNum) || priceNum <= 0) continue

      // Build full address
      const addressParts = [saon, paon, street, locality, townCity, county, postcode]
        .filter(Boolean)
        .join(", ")

      repos.push({
        transaction_id: transactionId,
        price: priceNum,
        date_of_transfer: dateOfTransfer,
        postcode: postcode || "",
        property_type: propertyType,
        old_new: oldNew,
        duration,
        paon: paon || "",
        saon: saon || "",
        street: street || "",
        locality: locality || "",
        town_city: townCity || "",
        district: district || "",
        county: county || "",
        ppd_category: ppdCategory,
        record_status: recordStatus,
        full_address: addressParts,
      })
    }

    console.log(`[LandRegistry Repos] Found ${repos.length} Category B transactions`)
    return repos
  } catch (err) {
    console.error("[LandRegistry Repos] Error:", err)
    return []
  }
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === "," && !inQuotes) {
      fields.push(current)
      current = ""
    } else {
      current += char
    }
  }
  fields.push(current)
  return fields
}
