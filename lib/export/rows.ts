import {
  categorise,
  licenceExpiry,
  licenceReference,
  LICENCE_LABELS,
  MARKET_LABELS,
  type CategorisableProperty,
} from "@/lib/properties/category"
import type { Property } from "@/lib/types/database"

/**
 * The columns. Every one is read from a column that exists and holds a
 * published value.
 *
 * Deliberately absent:
 *   Deal Score, Gross Yield — the deal score and the yield calculator were
 *     removed from the product; gross_yield is not even a column.
 *   LHA Weekly/Monthly Rate — headers with no values behind them. They sat in
 *     the header row with nothing in the data row, so Source URL printed under
 *     "LHA Weekly Rate" and every column after position 21 was mislabelled.
 *   Licence Number, Licence Start, Max Occupants — the seeded columns. See
 *     licenceExpiry() in lib/properties/category.ts.
 */
const COLUMNS: { header: string; value: (p: Property) => string | number | null }[] = [
  { header: "Address", value: (p) => p.address },
  { header: "Postcode", value: (p) => p.postcode },
  { header: "City", value: (p) => p.city },
  { header: "Status", value: (p) => MARKET_LABELS[categorise(p as CategorisableProperty).market] },
  // Asking price, and only that. A property nobody is selling has no price,
  // and printing an estimate in this column would read as one.
  { header: "Asking price (£)", value: (p) => p.purchase_price ?? null },
  { header: "Bedrooms", value: (p) => p.bedrooms },
  { header: "Bathrooms", value: (p) => p.bathrooms },
  { header: "Floor area (m²)", value: (p) => p.gross_internal_area_sqm ?? null },
  { header: "Property type", value: (p) => p.property_type },
  {
    header: "Licence state",
    value: (p) => LICENCE_LABELS[categorise(p as CategorisableProperty).licence],
  },
  { header: "Licence reference", value: (p) => licenceReference(p) },
  { header: "Licence expiry", value: (p) => licenceExpiry(p) },
  { header: "EPC rating", value: (p) => p.epc_rating },
  // The force state, not a stored boolean, and "unknown" is a real answer:
  // most councils publish no boundary data at all.
  { header: "Article 4 status", value: (p) => p.article_4_status },
  { header: "Article 4 council", value: (p) => p.article_4_council },
  { header: "Owner name", value: (p) => p.owner_name },
  { header: "Owner company", value: (p) => p.company_name },
  { header: "Company number", value: (p) => p.company_number },
  { header: "Licence holder", value: (p) => p.licence_holder_name },
  { header: "Source", value: (p) => p.source_name },
  { header: "Source URL", value: (p) => p.source_url },
]

export const EXPORT_HEADERS = COLUMNS.map((c) => c.header)

export function exportRow(property: Property): (string | number | null)[] {
  return COLUMNS.map((c) => c.value(property))
}

function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return ""
  const escaped = String(value).replace(/"/g, '""')
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped
}

export function toCsv(properties: Property[]): string {
  return [
    EXPORT_HEADERS.join(","),
    ...properties.map((p) => exportRow(p).map(escapeCsvValue).join(",")),
  ].join("\n")
}
