import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format UK phone numbers for display
 * Handles various input formats and returns consistently formatted output
 */
export function formatUKPhone(phone: string | null | undefined): string {
  if (!phone) return ""

  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, "")

  // Handle +44 prefix
  let digits = cleaned
  if (digits.startsWith("+44")) {
    digits = "0" + digits.slice(3)
  } else if (digits.startsWith("44") && digits.length > 10) {
    digits = "0" + digits.slice(2)
  }

  // Remove leading zeros beyond the first
  if (digits.startsWith("00")) {
    digits = digits.replace(/^0+/, "0")
  }

  // Format based on number type
  if (digits.length === 11) {
    if (digits.startsWith("02")) {
      // London/area codes: 020 1234 5678
      return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`
    } else if (digits.startsWith("07")) {
      // Mobile: 07123 456 789
      return `${digits.slice(0, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`
    } else if (digits.startsWith("01")) {
      // Area codes: 01onal format varies
      // Common pattern: 01onal 123456 or 0161 123 4567
      if (digits.charAt(2) === "1" || digits.charAt(2) === "2") {
        // 4-digit area codes like 0114, 0121
        return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
      } else {
        // 5-digit area codes like 01onal
        return `${digits.slice(0, 5)} ${digits.slice(5)}`
      }
    } else if (digits.startsWith("03") || digits.startsWith("08") || digits.startsWith("09")) {
      // Non-geographic: 0300 123 4567
      return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
    }
  }

  // If we can't determine format, return with basic spacing
  if (digits.length >= 10) {
    return `${digits.slice(0, 5)} ${digits.slice(5)}`
  }

  // Return original if too short
  return phone
}
