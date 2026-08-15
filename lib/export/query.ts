import { getProperties } from "@/app/actions/properties"
import { inSegment, type CategorisableProperty, type Segment } from "@/lib/properties/category"
import type { Property, PropertyFilters } from "@/lib/types/database"

/**
 * What an export contains, and where it comes from.
 *
 * Both export routes used to build their own Supabase query. They selected
 * nine columns that do not exist on the table — hmo_licence_number,
 * hmo_licence_start, hmo_licence_end, hmo_max_occupants, epc_floor_area,
 * owner_company_name, owner_company_number, licence_holder_company and
 * gross_yield — so PostgREST answered 42703 and every export in the product's
 * history returned "Failed to fetch properties", after taking the credits.
 *
 * They also filtered differently from the map: no sourcing categories, no
 * Article 4, no EPC, no licence type, no segment, no postcode, and a strict
 * purchase_price range that dropped all 455 unpriced off-market rows — the
 * off-market stock being the thing the platform exists to surface. So even
 * once it ran, it would have handed back a different set from the screen.
 *
 * Both problems have one cause: a second query. There is one now, and it is
 * the map's own getProperties().
 */
export async function propertiesForExport(
  filters: Partial<PropertyFilters> | undefined,
  segment: Segment | undefined,
  propertyIds: string[] | undefined
): Promise<Property[]> {
  const rows = await getProperties(filters ?? {})
  // An explicit selection wins: the user ticked those properties.
  if (propertyIds && propertyIds.length > 0) {
    const wanted = new Set(propertyIds)
    return rows.filter((p) => wanted.has(p.id))
  }
  if (!segment || segment === "all") return rows
  return rows.filter((p) =>
    inSegment(p as CategorisableProperty & { article_4_area?: boolean | null }, segment)
  )
}
