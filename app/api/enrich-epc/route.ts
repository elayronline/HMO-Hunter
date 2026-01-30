import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

interface EPCCertificate {
  "lmk-key": string
  address1: string
  address2?: string
  address3?: string
  postcode: string
  "building-reference-number"?: string
  "current-energy-rating": string
  "potential-energy-rating": string
  "current-energy-efficiency": number
  "potential-energy-efficiency": number
  "property-type": string
  "built-form": string
  "inspection-date": string
  "lodgement-date": string
  "lodgement-datetime": string
  "total-floor-area": number
  "floor-level"?: string
  "floor-height"?: number
  "number-habitable-rooms"?: number
  "number-heated-rooms"?: number
  "main-heating-controls"?: string
  "low-energy-lighting"?: number
  "uprn"?: string
  "local-authority"?: string
  "constituency"?: string
}

interface EPCSearchResponse {
  "column-names": string[]
  rows: EPCCertificate[]
}

interface GovUKCertificate {
  address: string
  certificateId: string
  url: string
}

/**
 * Fetch certificate IDs from gov.uk website for a postcode
 * This is needed because the EPC API lmk-key differs from gov.uk certificate IDs
 */
async function fetchGovUKCertificates(postcode: string): Promise<GovUKCertificate[]> {
  try {
    const encodedPostcode = encodeURIComponent(postcode.trim())
    const url = `https://find-energy-certificate.service.gov.uk/find-a-certificate/search-by-postcode?postcode=${encodedPostcode}`

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; HMO-Hunter/1.0)",
        "Accept": "text/html",
      },
    })

    if (!response.ok) {
      console.error(`[EPC] Gov.uk fetch error: ${response.status}`)
      return []
    }

    const html = await response.text()

    // Parse certificate links from the HTML
    // Format: <a href="/energy-certificate/XXXX">\n  Address\n</a>
    // Note: The address is on a separate line, so we use [\s\S] to match across lines
    const certificates: GovUKCertificate[] = []
    const regex = /href="\/energy-certificate\/(\d{4}-\d{4}-\d{4}-\d{4}-\d{4})"[^>]*>[\s\n]*([^<]+)/g
    let match

    while ((match = regex.exec(html)) !== null) {
      const certificateId = match[1].trim()
      const address = match[2].trim()

      if (address && certificateId) {
        certificates.push({
          address,
          certificateId,
          url: `https://find-energy-certificate.service.gov.uk/energy-certificate/${certificateId}`,
        })
      }
    }

    return certificates
  } catch (error) {
    console.error("[EPC] Gov.uk fetch error:", error)
    return []
  }
}

/**
 * Find matching gov.uk certificate for a property address
 * Returns the direct certificate URL if found, null otherwise
 */
function findMatchingGovUKCertificate(
  propertyAddress: string,
  certificates: GovUKCertificate[]
): GovUKCertificate | null {
  if (!certificates.length) return null

  // Common street suffix variations - normalize to full form
  const STREET_SUFFIXES: Record<string, string> = {
    "rd": "road", "road": "road",
    "st": "street", "street": "street",
    "ave": "avenue", "avenue": "avenue",
    "dr": "drive", "drive": "drive",
    "ln": "lane", "lane": "lane",
    "cl": "close", "close": "close",
    "ct": "court", "court": "court",
    "pl": "place", "place": "place",
    "ter": "terrace", "terrace": "terrace",
    "cres": "crescent", "crescent": "crescent",
    "gdns": "gardens", "gardens": "gardens",
    "gr": "grove", "grove": "grove",
    "pk": "park", "park": "park",
    "way": "way", "walk": "walk",
    "sq": "square", "square": "square",
    "mews": "mews", "row": "row", "hill": "hill",
    "rise": "rise", "view": "view", "villas": "villas",
  }

  // Normalize address for comparison
  const normalize = (addr: string) =>
    addr.toLowerCase()
      .replace(/[,.']/g, "")
      .replace(/\s+/g, " ")
      .trim()

  // Normalize street suffixes
  const normalizeStreetSuffix = (addr: string) => {
    let result = addr
    for (const [abbrev, full] of Object.entries(STREET_SUFFIXES)) {
      result = result.replace(new RegExp(`\\b${abbrev}\\b`, "gi"), full)
    }
    return result
  }

  // Remove garbage prefixes
  const removeGarbagePrefixes = (addr: string): string => {
    let cleaned = addr.replace(/^[a-z]{2,6}\d{5,}/i, "").trim()
    cleaned = cleaned.replace(/^\d+[a-z]+,?\s*\d*[a-z]*,?\s*/i, "").trim()
    cleaned = cleaned.replace(/^[A-Z]{1,3}-\d+\s*/i, "").trim()
    cleaned = cleaned.replace(/^plot\s+[a-z0-9.]+\s+/i, "").trim()
    cleaned = cleaned.replace(/^ph\s+\d+\s*[a-z]*\s+/i, "").trim()
    return cleaned
  }

  // Fix hyphenated numbers
  const fixHyphenatedNumbers = (addr: string): string => {
    return addr.replace(/(\d+)-([a-z])/gi, "$1 $2")
  }

  // Extract first number from range
  const extractFirstFromRange = (addr: string): string => {
    return addr.replace(/(\d+)-\d+/g, "$1")
  }

  // Fix concatenated words
  const fixConcatenatedWords = (addr: string): string => {
    let result = addr.replace(/([a-z])([A-Z])/g, "$1 $2")
    const cities = ["london", "liverpool", "manchester", "birmingham", "leeds", "sheffield", "bristol", "nottingham", "leicester", "oxford", "cambridge", "reading", "southampton", "portsmouth", "brighton", "glasgow", "edinburgh", "cardiff", "newcastle"]
    for (const city of cities) {
      const pattern = new RegExp(`([a-z])(${city})`, "gi")
      result = result.replace(pattern, "$1 $2")
    }
    return result
  }

  // Clean duplicates from address
  const cleanAddress = (addr: string) => {
    let cleaned = fixConcatenatedWords(addr)
    cleaned = normalize(cleaned)
    cleaned = removeGarbagePrefixes(cleaned)
    cleaned = fixHyphenatedNumbers(cleaned)
    cleaned = extractFirstFromRange(cleaned)

    // Remove duplicate multi-word segments
    let words = cleaned.split(" ")

    // Check if first half equals second half
    if (words.length >= 4 && words.length % 2 === 0) {
      const mid = words.length / 2
      const firstHalf = words.slice(0, mid).join(" ")
      const secondHalf = words.slice(mid).join(" ")
      if (firstHalf === secondHalf) {
        words = words.slice(0, mid)
        cleaned = words.join(" ")
      }
    }

    for (let len = Math.min(4, Math.floor(words.length / 2)); len >= 2; len--) {
      for (let i = 0; i <= words.length - len * 2; i++) {
        const seg1 = words.slice(i, i + len).join(" ")
        const seg2 = words.slice(i + len, i + len * 2).join(" ")
        if (seg1 === seg2) {
          words.splice(i + len, len)
          cleaned = words.join(" ")
          break
        }
      }
    }

    // Remove duplicate single words
    const parts = cleaned.split(" ")
    const seen = new Set<string>()
    const deduped: string[] = []
    for (const part of parts) {
      if (!seen.has(part) || /^\d+[a-z]?$/.test(part)) {
        deduped.push(part)
        seen.add(part)
      }
    }
    return deduped.join(" ")
  }

  const normalizedProperty = normalizeStreetSuffix(cleanAddress(propertyAddress))

  // Extract all numbers
  const extractNumbers = (addr: string): string[] => {
    const matches = addr.match(/\d+[a-z]?/gi) || []
    return matches.map(m => m.toLowerCase())
  }

  // Extract flat number
  const extractFlat = (addr: string): string | null => {
    const patterns = [
      /\bflat\s+([a-z0-9]+)/i,
      /\bapartment\s+([a-z0-9]+)/i,
      /\bunit\s+([a-z0-9]+)/i,
      /^([a-z])\s+[a-z]+\s+(?:road|street|avenue|drive|lane|close|court|place|terrace|crescent|gardens|grove|park|way|walk|square)/i,
    ]
    for (const pattern of patterns) {
      const match = normalize(addr).match(pattern)
      if (match) return match[1].toLowerCase()
    }
    return null
  }

  const propertyNumbers = extractNumbers(normalizedProperty)
  const propertyFlat = extractFlat(propertyAddress)
  const propertyWords = normalizedProperty.split(" ").filter(w => w.length > 2)

  let bestMatch: { cert: GovUKCertificate; score: number } | null = null

  for (const cert of certificates) {
    const normalizedCert = normalizeStreetSuffix(cleanAddress(cert.address))
    const certNumbers = extractNumbers(normalizedCert)
    const certFlat = extractFlat(cert.address)
    const certWords = normalizedCert.split(" ").filter(w => w.length > 2)

    let score = 0

    // Exact match
    if (normalizedCert === normalizedProperty) {
      score = 100
    }
    // One contains the other
    else if (normalizedCert.includes(normalizedProperty) || normalizedProperty.includes(normalizedCert)) {
      score = 90
    }
    // Number match + word overlap
    else if (propertyNumbers.length > 0 && certNumbers.length > 0) {
      const hasMatchingNumber = propertyNumbers.some(n => certNumbers.includes(n))
      if (hasMatchingNumber) {
        const commonWords = propertyWords.filter(w => certWords.includes(w))
        if (commonWords.length >= 2) {
          score = 80
          if (propertyFlat && certFlat && propertyFlat === certFlat) {
            score = 85
          }
        } else if (commonWords.length >= 1) {
          score = 70
        }
      }
    }
    // Street-only match (no number in property)
    else if (propertyNumbers.length === 0) {
      const commonWords = propertyWords.filter(w => certWords.includes(w))
      const overlap = commonWords.length / Math.max(propertyWords.length, 1)
      if (overlap >= 0.4 && commonWords.length >= 1) {
        score = 65
      }
    }

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { cert, score }
    }
  }

  // Lower threshold to catch more matches
  return bestMatch && bestMatch.score >= 65 ? bestMatch.cert : null
}

/**
 * Search EPC certificates by postcode
 */
async function searchEPCByPostcode(postcode: string, apiKey: string, email: string): Promise<EPCCertificate[]> {
  try {
    // Create Basic Auth header
    const credentials = Buffer.from(`${email}:${apiKey}`).toString("base64")

    const response = await fetch(
      `https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${encodeURIComponent(postcode)}&size=100`,
      {
        headers: {
          "Accept": "application/json",
          "Authorization": `Basic ${credentials}`,
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[EPC] API error: ${response.status} - ${errorText}`)
      return []
    }

    const data: EPCSearchResponse = await response.json()
    return data.rows || []
  } catch (error) {
    console.error("[EPC] Search error:", error)
    return []
  }
}

/**
 * Get EPC certificate by LMK key
 */
async function getEPCCertificate(lmkKey: string, apiKey: string, email: string): Promise<EPCCertificate | null> {
  try {
    const credentials = Buffer.from(`${email}:${apiKey}`).toString("base64")

    const response = await fetch(
      `https://epc.opendatacommunities.org/api/v1/domestic/certificate/${lmkKey}`,
      {
        headers: {
          "Accept": "application/json",
          "Authorization": `Basic ${credentials}`,
        },
      }
    )

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data.rows?.[0] || null
  } catch (error) {
    console.error("[EPC] Certificate fetch error:", error)
    return null
  }
}

/**
 * Convert EPC rating letter to numeric value
 */
function epcRatingToNumeric(rating: string): number {
  const ratings: Record<string, number> = {
    "A": 92, "B": 81, "C": 69, "D": 55, "E": 39, "F": 21, "G": 1
  }
  return ratings[rating?.toUpperCase()] || 0
}


/**
 * Match property address to EPC certificate from API data
 * Improved matching with fuzzy logic for partial addresses
 */
function findMatchingCertificate(
  address: string,
  certificates: EPCCertificate[]
): EPCCertificate | null {
  if (!certificates.length) return null

  // Common street suffix variations - normalize to full form for comparison
  const STREET_SUFFIXES: Record<string, string> = {
    "rd": "road", "road": "road",
    "st": "street", "street": "street",
    "ave": "avenue", "avenue": "avenue",
    "dr": "drive", "drive": "drive",
    "ln": "lane", "lane": "lane",
    "cl": "close", "close": "close",
    "ct": "court", "court": "court",
    "pl": "place", "place": "place",
    "ter": "terrace", "terrace": "terrace",
    "cres": "crescent", "crescent": "crescent",
    "gdns": "gardens", "gardens": "gardens",
    "gr": "grove", "grove": "grove",
    "pk": "park", "park": "park",
    "way": "way",
    "walk": "walk",
    "sq": "square", "square": "square",
    "mews": "mews",
    "row": "row",
    "hill": "hill",
    "rise": "rise",
    "view": "view",
    "villas": "villas",
  }

  // Normalize address for comparison
  const normalizeAddress = (addr: string) =>
    addr.toLowerCase()
      .replace(/[,.']/g, "")
      .replace(/\s+/g, " ")
      .trim()

  // Normalize street suffixes to full form
  const normalizeStreetSuffix = (addr: string) => {
    let result = addr
    for (const [abbrev, full] of Object.entries(STREET_SUFFIXES)) {
      result = result.replace(new RegExp(`\\b${abbrev}\\b`, "gi"), full)
    }
    return result
  }

  // Remove garbage prefixes (e.g., "chpk3422050", "SL-", alphanumeric codes)
  const removeGarbagePrefixes = (addr: string): string => {
    // Remove alphanumeric codes at start (e.g., "chpk3422050 Windsor Road")
    let cleaned = addr.replace(/^[a-z]{2,6}\d{5,}/i, "").trim()
    // Remove alphanumeric garbage like "62874836sdhh, 9823566s8dsg"
    cleaned = cleaned.replace(/^\d+[a-z]+,?\s*\d*[a-z]*,?\s*/i, "").trim()
    // Remove "SL-" or similar prefixes
    cleaned = cleaned.replace(/^[A-Z]{1,3}-\d+\s*/i, "").trim()
    // Remove "Plot X.XX.XX" prefixes but keep the address
    cleaned = cleaned.replace(/^plot\s+[a-z0-9.]+\s+/i, "").trim()
    // Remove "PH XXXX" or "PH XXXX XXX" penthouse prefixes
    cleaned = cleaned.replace(/^ph\s+\d+\s*[a-z]*\s+/i, "").trim()
    return cleaned
  }

  // Fix hyphenated numbers (e.g., "169-Kensington" -> "169 Kensington")
  const fixHyphenatedNumbers = (addr: string): string => {
    // "169-Kensington" -> "169 Kensington"
    return addr.replace(/(\d+)-([a-z])/gi, "$1 $2")
  }

  // Extract first number from a range (e.g., "4401-4414" -> "4401")
  const extractFirstFromRange = (addr: string): string => {
    return addr.replace(/(\d+)-\d+/g, "$1")
  }

  // Fix concatenated words (e.g., "RoadLiverpool" -> "Road Liverpool")
  const fixConcatenatedWords = (addr: string): string => {
    // Add space between lowercase-uppercase transitions
    let result = addr.replace(/([a-z])([A-Z])/g, "$1 $2")
    // Add space between word and city names that got concatenated
    const cities = ["london", "liverpool", "manchester", "birmingham", "leeds", "sheffield", "bristol", "nottingham", "leicester", "oxford", "cambridge", "reading", "southampton", "portsmouth", "brighton", "glasgow", "edinburgh", "cardiff", "newcastle"]
    for (const city of cities) {
      const pattern = new RegExp(`([a-z])(${city})`, "gi")
      result = result.replace(pattern, "$1 $2")
    }
    return result
  }

  // Clean property address - remove duplicates, noise, prefixes
  const cleanPropertyAddress = (addr: string) => {
    // Fix concatenated words BEFORE normalizing (preserves case info)
    let cleaned = fixConcatenatedWords(addr)

    cleaned = normalizeAddress(cleaned)

    // Remove garbage prefixes first
    cleaned = removeGarbagePrefixes(cleaned)

    // Fix hyphenated numbers
    cleaned = fixHyphenatedNumbers(cleaned)

    // Extract first number from ranges
    cleaned = extractFirstFromRange(cleaned)

    // Remove duplicate multi-word segments (e.g., "One Hyde Park One Hyde Park" -> "One Hyde Park")
    // Also handles "Beach Road Beach Road" -> "Beach Road"
    let words = cleaned.split(" ")

    // First check if the entire first half equals the second half
    if (words.length >= 4 && words.length % 2 === 0) {
      const mid = words.length / 2
      const firstHalf = words.slice(0, mid).join(" ")
      const secondHalf = words.slice(mid).join(" ")
      if (firstHalf === secondHalf) {
        words = words.slice(0, mid)
        cleaned = words.join(" ")
      }
    }

    // Then check for partial duplicates at any position
    for (let len = Math.min(4, Math.floor(words.length / 2)); len >= 2; len--) {
      for (let i = 0; i <= words.length - len * 2; i++) {
        const seg1 = words.slice(i, i + len).join(" ")
        const seg2 = words.slice(i + len, i + len * 2).join(" ")
        if (seg1 === seg2) {
          // Remove the duplicate
          words.splice(i + len, len)
          cleaned = words.join(" ")
          break
        }
      }
    }

    // Remove duplicate single words (except numbers)
    const parts = cleaned.split(" ")
    const seen = new Set<string>()
    const deduped: string[] = []
    for (const part of parts) {
      if (!seen.has(part) || /^\d+[a-z]?$/.test(part)) {
        deduped.push(part)
        seen.add(part)
      }
    }
    cleaned = deduped.join(" ")

    // Remove common noise words
    cleaned = cleaned
      .replace(/\b(the|at|in|of)\b/g, "")
      .replace(/\s+/g, " ")
      .trim()

    return cleaned
  }

  // Extract all numbers from address
  const extractNumbers = (addr: string): string[] => {
    const matches = addr.match(/\d+[a-z]?/gi) || []
    return matches.map(m => m.toLowerCase())
  }

  // Extract street name (words before/after numbers, excluding city)
  const extractStreetName = (addr: string): string | null => {
    const normalized = normalizeAddress(addr)
    // Try to find street name patterns
    const streetSuffixPattern = "road|street|avenue|drive|lane|close|court|place|terrace|crescent|gardens|grove|park|way|walk|square|mews|row|hill|rise|view|villas|rd|st|ave|dr|ln|cl|ct|pl|ter|cres|gdns|gr|pk|sq"
    const patterns = [
      new RegExp(`\\d+[a-z]?\\s+([a-z]+\\s+(?:${streetSuffixPattern}))`, "i"),
      new RegExp(`\\d+[a-z]?\\s+([a-z]+(?:\\s+[a-z]+)?)`, "i"),
      new RegExp(`([a-z]+\\s+(?:${streetSuffixPattern}))`, "i"),
    ]

    for (const pattern of patterns) {
      const match = normalized.match(pattern)
      if (match) return normalizeStreetSuffix(match[1])
    }
    return null
  }

  // Extract flat/apartment number - including letter-only flats
  const extractFlatNumber = (addr: string): string | null => {
    const normalized = normalizeAddress(addr)
    const patterns = [
      /\bflat\s+([a-z0-9]+)/i,
      /\bapartment\s+([a-z0-9]+)/i,
      /\bapt\s+([a-z0-9]+)/i,
      /\bunit\s+([a-z0-9]+)/i,
      /\broom\s+([a-z0-9]+)/i,
      // "A Skipworth Street" - single letter at start before street name
      /^([a-z])\s+[a-z]+\s+(?:road|street|avenue|drive|lane|close|court|place|terrace|crescent|gardens|grove|park|way|walk|square|rd|st|ave|dr|ln|cl|ct|pl|ter|cres|gdns|gr|pk|sq)/i,
    ]
    for (const pattern of patterns) {
      const match = normalized.match(pattern)
      if (match) return match[1].toLowerCase()
    }
    return null
  }

  // Calculate word overlap score
  const wordOverlapScore = (words1: string[], words2: string[]): number => {
    const set1 = new Set(words1.filter(w => w.length > 2))
    const set2 = new Set(words2.filter(w => w.length > 2))
    const intersection = [...set1].filter(w => set2.has(w))
    const union = new Set([...set1, ...set2])
    return union.size > 0 ? intersection.length / union.size : 0
  }

  // Check if two street names match (accounting for variations)
  const streetsMatch = (s1: string | null, s2: string | null): boolean => {
    if (!s1 || !s2) return false
    const norm1 = normalizeStreetSuffix(s1)
    const norm2 = normalizeStreetSuffix(s2)
    return norm1 === norm2 || norm1.includes(norm2) || norm2.includes(norm1)
  }

  const propertyAddr = cleanPropertyAddress(address)
  const propertyNormalized = normalizeStreetSuffix(propertyAddr)
  const propertyNumbers = extractNumbers(propertyAddr)
  const propertyStreet = extractStreetName(propertyAddr)
  const propertyFlat = extractFlatNumber(propertyAddr)
  const propertyWords = propertyNormalized.split(" ").filter(w => w.length > 2)

  let bestMatch: { cert: EPCCertificate; score: number } | null = null

  for (const cert of certificates) {
    const certAddr = normalizeAddress(
      [cert.address1, cert.address2, cert.address3].filter(Boolean).join(" ")
    )
    const certNormalized = normalizeStreetSuffix(certAddr)
    const certNumbers = extractNumbers(certAddr)
    const certStreet = extractStreetName(certAddr)
    const certFlat = extractFlatNumber(certAddr)
    const certWords = certNormalized.split(" ").filter(w => w.length > 2)

    let score = 0

    // Strategy 1: Exact match after normalization (100 points)
    if (certNormalized === propertyNormalized) {
      score = 100
    }
    // Strategy 2: One contains the other (90 points)
    else if (certNormalized.includes(propertyNormalized) ||
             propertyNormalized.includes(certNormalized)) {
      score = 90
    }
    // Strategy 3: Same building number + street name match (85 points)
    else if (propertyNumbers.length > 0 && certNumbers.length > 0) {
      const hasMatchingNumber = propertyNumbers.some(n => certNumbers.includes(n))
      const hasMatchingStreet = streetsMatch(propertyStreet, certStreet)

      if (hasMatchingNumber && hasMatchingStreet) {
        score = 85
        // Bonus for flat number match
        if (propertyFlat && certFlat && propertyFlat === certFlat) {
          score = 88
        }
      }
      // Strategy 4: Same number + high word overlap (75 points)
      else if (hasMatchingNumber) {
        const overlap = wordOverlapScore(propertyWords, certWords)
        if (overlap >= 0.5) {
          score = 75 + Math.round(overlap * 10)
        } else if (overlap >= 0.3) {
          score = 65 + Math.round(overlap * 10)
        }
      }
    }
    // Strategy 5: Street-only match (no number in property) - use word overlap
    else if (propertyNumbers.length === 0) {
      const overlap = wordOverlapScore(propertyWords, certWords)
      // If street names match, give high score even with low overlap
      if (streetsMatch(propertyStreet, certStreet)) {
        score = Math.max(70, 60 + Math.round(overlap * 15))
      } else if (overlap >= 0.5) {
        score = 60 + Math.round(overlap * 15)
      }
    }
    // Strategy 6: High word overlap regardless of numbers (55 points)
    else {
      const overlap = wordOverlapScore(propertyWords, certWords)
      if (overlap >= 0.6) {
        score = 55 + Math.round(overlap * 10)
      }
    }

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { cert, score }
    }
  }

  // Lower threshold to 55 to catch more matches
  return bestMatch && bestMatch.score >= 55 ? bestMatch.cert : null
}

/**
 * POST /api/enrich-epc
 *
 * Enriches properties with EPC data including floor area and certificate links
 */
export async function POST(request: Request) {
  const log: string[] = []
  const updated: string[] = []
  const failed: string[] = []

  try {
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(body.limit || 20, 100)
    const city = body.city
    const propertyId = body.propertyId
    const reset = body.reset === true  // Clear existing URLs and re-fetch

    const apiKey = process.env.EPC_API_KEY
    const email = process.env.EPC_API_EMAIL

    if (!apiKey || !email) {
      return NextResponse.json({
        success: false,
        error: "EPC API credentials not configured",
        setupRequired: true,
        instructions: [
          "1. Register at https://epc.opendatacommunities.org/login",
          "2. Accept the terms and get your API key",
          "3. Add to .env.local:",
          "   EPC_API_KEY=your_api_key",
          "   EPC_API_EMAIL=your_registered_email",
        ],
        log,
      }, { status: 400 })
    }

    log.push("Starting EPC data enrichment...")

    // If reset mode, clear existing "not_available" URLs for re-validation
    if (reset) {
      log.push("Reset mode: clearing 'not_available' entries for re-validation...")
      const { error: resetError, count } = await supabaseAdmin
        .from("properties")
        .update({ epc_certificate_url: null })
        .eq("is_stale", false)
        .eq("epc_certificate_url", "not_available")

      if (resetError) {
        log.push(`  Warning: Reset failed: ${resetError.message}`)
      } else {
        log.push(`  Cleared ${count || 0} entries for re-validation`)
      }
    }

    // Fetch properties needing EPC data
    let query = supabaseAdmin
      .from("properties")
      .select("id, address, postcode, city, epc_rating, epc_certificate_url, gross_internal_area_sqm")
      .eq("is_stale", false)

    if (propertyId) {
      query = query.eq("id", propertyId)
    } else {
      if (city) {
        query = query.eq("city", city)
      }
      // Get properties without valid EPC URL
      // Normal mode: only process properties without any EPC data
      query = query.is("epc_certificate_url", null)
      query = query.limit(limit)
    }

    const { data: properties, error: fetchError } = await query

    if (fetchError) {
      return NextResponse.json({
        success: false,
        error: fetchError.message,
        log,
      }, { status: 500 })
    }

    if (!properties || properties.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No properties found needing EPC data",
        log,
        updated: [],
        failed: [],
      })
    }

    log.push(`Found ${properties.length} properties to enrich`)

    // Group by postcode for efficiency
    const postcodeGroups = new Map<string, typeof properties>()
    for (const property of properties) {
      const pc = property.postcode?.toUpperCase().replace(/\s+/g, " ").trim()
      if (pc) {
        if (!postcodeGroups.has(pc)) {
          postcodeGroups.set(pc, [])
        }
        postcodeGroups.get(pc)!.push(property)
      }
    }

    log.push(`Grouped into ${postcodeGroups.size} postcodes`)

    // Track floor plan stats
    const withFloorPlan: string[] = []
    const noFloorPlan: string[] = []

    // Process each postcode
    for (const [postcode, props] of postcodeGroups) {
      try {
        log.push(`Searching EPC for postcode: ${postcode}`)

        // Fetch EPC data from API
        const certificates = await searchEPCByPostcode(postcode, apiKey, email)

        if (certificates.length === 0) {
          log.push(`  No EPC certificates found for ${postcode}`)
          // Mark properties as checked but no floor plan available
          for (const property of props) {
            const { error: updateError } = await supabaseAdmin
              .from("properties")
              .update({
                epc_certificate_url: "not_available",
              })
              .eq("id", property.id)

            if (!updateError) {
              noFloorPlan.push(property.address)
            }
            failed.push(property.address)
          }
          continue
        }

        log.push(`  Found ${certificates.length} EPC certificates from API`)

        // Fetch gov.uk certificates to get direct floor plan URLs
        const govUKCerts = await fetchGovUKCertificates(postcode)
        log.push(`  Found ${govUKCerts.length} certificates on gov.uk`)

        // Match each property to a certificate
        for (const property of props) {
          const matchedCert = findMatchingCertificate(property.address, certificates)

          if (matchedCert) {
            const epcRating = matchedCert["current-energy-rating"]?.toUpperCase() as "A" | "B" | "C" | "D" | "E" | "F" | "G"
            const floorArea = matchedCert["total-floor-area"]

            // Determine floor area band
            let floorAreaBand: "under_90" | "90_120" | "120_plus" | null = null
            if (floorArea) {
              if (floorArea < 90) {
                floorAreaBand = "under_90"
              } else if (floorArea <= 120) {
                floorAreaBand = "90_120"
              } else {
                floorAreaBand = "120_plus"
              }
            }

            // Find matching gov.uk certificate for direct floor plan link
            const govUKMatch = findMatchingGovUKCertificate(property.address, govUKCerts)
            const certificateUrl = govUKMatch?.url || "not_available"

            if (govUKMatch) {
              withFloorPlan.push(property.address)
              log.push(`  Found floor plan: ${property.address} -> ${govUKMatch.certificateId}`)
            } else {
              noFloorPlan.push(property.address)
              log.push(`  No floor plan match on gov.uk for: ${property.address}`)
            }

            // Update property - including UPRN for Kamma compliance checks
            const { error: updateError } = await supabaseAdmin
              .from("properties")
              .update({
                epc_rating: epcRating,
                epc_rating_numeric: epcRatingToNumeric(epcRating),
                epc_certificate_url: certificateUrl,
                epc_expiry_date: matchedCert["lodgement-date"]
                  ? new Date(new Date(matchedCert["lodgement-date"]).getTime() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
                  : null,
                // Save UPRN from EPC data - enables Kamma compliance checks
                ...(matchedCert.uprn && { uprn: matchedCert.uprn }),
                // Update floor area if not already set
                ...((!property.gross_internal_area_sqm && floorArea) && {
                  gross_internal_area_sqm: Math.round(floorArea),
                  floor_area_band: floorAreaBand,
                }),
                room_count: matchedCert["number-habitable-rooms"] || null,
              })
              .eq("id", property.id)

            if (updateError) {
              log.push(`  Failed to update ${property.address}: ${updateError.message}`)
              failed.push(property.address)
            } else {
              const uprnNote = matchedCert.uprn ? `, UPRN: ${matchedCert.uprn}` : ""
              log.push(`  Updated: ${property.address} (EPC ${epcRating}, ${floorArea}sqm${uprnNote})`)
              updated.push(property.address)
            }
          } else {
            log.push(`  No matching EPC certificate for: ${property.address}`)
            // Mark as checked but no data available
            await supabaseAdmin
              .from("properties")
              .update({ epc_certificate_url: "not_available" })
              .eq("id", property.id)
            noFloorPlan.push(property.address)
            failed.push(property.address)
          }
        }

        // Rate limit - be nice to both APIs
        await new Promise(resolve => setTimeout(resolve, 1500))

      } catch (error) {
        log.push(`  Error processing ${postcode}: ${error}`)
        props.forEach(p => failed.push(p.address))
      }
    }

    log.push("")
    log.push(`Completed: ${updated.length} enriched, ${failed.length} failed`)
    log.push(`Floor plans: ${withFloorPlan.length} available, ${noFloorPlan.length} not available`)

    return NextResponse.json({
      success: true,
      message: `Enriched ${updated.length} properties with EPC data`,
      log,
      updated,
      failed,
      floorPlans: {
        available: withFloorPlan,
        notAvailable: noFloorPlan,
      },
      summary: {
        processed: properties.length,
        enriched: updated.length,
        failed: failed.length,
        floorPlansFound: withFloorPlan.length,
        floorPlansNotFound: noFloorPlan.length,
      },
    })

  } catch (error) {
    log.push("Error: " + String(error))
    return NextResponse.json({
      success: false,
      error: String(error),
      log,
    }, { status: 500 })
  }
}

/**
 * GET /api/enrich-epc
 */
export async function GET() {
  const apiKey = process.env.EPC_API_KEY
  const email = process.env.EPC_API_EMAIL
  const hasCredentials = !!apiKey && !!email

  // Check how many properties need EPC data
  const { data: properties } = await supabaseAdmin
    .from("properties")
    .select("id, epc_certificate_url")
    .eq("is_stale", false)
    .limit(500)

  const withEPC = properties?.filter(p => p.epc_certificate_url).length || 0
  const totalProperties = properties?.length || 0
  const needsEPC = totalProperties - withEPC

  return NextResponse.json({
    message: "POST to enrich properties with EPC data from the official UK register",
    description: "Fetches EPC rating, floor area, and certificate URL (for viewing floor plan)",
    configuration: {
      epcApiCredentials: hasCredentials ? "Configured" : "NOT CONFIGURED",
    },
    stats: {
      totalProperties,
      withEPC,
      needsEPC,
    },
    usage: {
      method: "POST",
      body: {
        limit: "Number of properties to process (default 20, max 100)",
        city: "Filter by city name",
        propertyId: "Enrich a specific property by ID",
      },
    },
    dataProvided: {
      epc_rating: "Energy rating A-G",
      epc_rating_numeric: "Numeric score 1-100",
      epc_certificate_url: "Link to view certificate (includes floor plan)",
      epc_expiry_date: "Certificate expiry date",
      gross_internal_area_sqm: "Floor area from EPC",
      room_count: "Number of habitable rooms",
    },
    floorPlanNote: "The EPC certificate URL links to the official certificate page where users can view and print the floor plan diagram",
    setupInstructions: !hasCredentials ? [
      "1. Register at https://epc.opendatacommunities.org/login",
      "2. Accept the Open Government Licence terms",
      "3. Your API key will be shown in your account footer",
      "4. Add to .env.local:",
      "   EPC_API_KEY=your_api_key",
      "   EPC_API_EMAIL=your_registered_email",
    ] : null,
  })
}
