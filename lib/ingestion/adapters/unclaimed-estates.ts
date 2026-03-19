/**
 * Unclaimed Estates List (Bona Vacantia) Adapter
 *
 * Downloads the CSV of deceased persons whose estates have no known heir.
 * Properties in these estates may be acquirable.
 *
 * Source: https://www.gov.uk/government/statistical-data-sets/unclaimed-estates-list
 * CSV: https://assets.publishing.service.gov.uk/media/69b7d866fdbfc4d58fc8cf96/UnclaimedEstatesList.csv
 */

export interface UnclaimedEstate {
  bv_reference: string
  forename: string
  surname: string
  full_name: string
  date_of_death: string | null
  place_of_death: string
  city: string | null
  postcode: string | null
}

const CSV_URL = "https://assets.publishing.service.gov.uk/media/69b7d866fdbfc4d58fc8cf96/UnclaimedEstatesList.csv"

// Extract postcode from place of death
function extractPostcode(text: string): string | null {
  const match = text.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i)
  return match ? match[0].toUpperCase() : null
}

// Extract city from place of death
function extractCity(place: string): string | null {
  // Remove postcode if present
  const postcode = extractPostcode(place)
  let cleaned = postcode ? place.replace(postcode, "").trim() : place

  // Common patterns: "Town County", "Town, County", "Town"
  const parts = cleaned.split(/[,\s]+/).filter(Boolean)

  // Try to find a recognizable city/town — take the first significant word
  if (parts.length >= 2) {
    // If last part looks like a county/region, take the part before
    return parts.slice(0, -1).join(" ").trim() || parts[0]
  }
  return parts[0] || null
}

// Parse UK date format DD/MM/YYYY to ISO
function parseUKDate(dateStr: string): string | null {
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!match) return null
  const [, day, month, year] = match
  const date = new Date(`${year}-${month}-${day}`)
  if (isNaN(date.getTime())) return null
  return date.toISOString().split("T")[0]
}

export async function fetchUnclaimedEstates(): Promise<UnclaimedEstate[]> {
  try {
    const response = await fetch(CSV_URL)
    if (!response.ok) {
      console.error(`[UnclaimedEstates] Failed to fetch CSV: ${response.status}`)
      return []
    }

    const text = await response.text()
    const lines = text.split("\n").filter(line => line.trim())

    // Skip header row
    const estates: UnclaimedEstate[] = []

    for (let i = 1; i < lines.length; i++) {
      // CSV parsing — handle quoted fields
      const fields = parseCSVLine(lines[i])
      if (fields.length < 5) continue

      const [bvRef, forename, surname, dod, place] = fields.map(f => f.trim())

      if (!bvRef || !surname) continue

      estates.push({
        bv_reference: bvRef,
        forename: forename || "",
        surname,
        full_name: `${forename} ${surname}`.trim(),
        date_of_death: parseUKDate(dod),
        place_of_death: place || "",
        city: extractCity(place || ""),
        postcode: extractPostcode(place || ""),
      })
    }

    console.log(`[UnclaimedEstates] Parsed ${estates.length} records`)
    return estates
  } catch (err) {
    console.error("[UnclaimedEstates] Error:", err)
    return []
  }
}

// Simple CSV line parser handling quoted fields
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
