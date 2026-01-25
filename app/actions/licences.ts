"use server"

import { createClient } from "@/lib/supabase/server"
import type { PropertyLicence, LicenceType } from "@/lib/types/licences"

/**
 * Fetch all active licence types
 */
export async function getLicenceTypes(): Promise<LicenceType[]> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("licence_types")
      .select("*")
      .eq("is_active", true)
      .order("display_order")

    if (error) {
      console.error("Error fetching licence types:", error)
      return []
    }

    return data || []
  } catch {
    return []
  }
}

/**
 * Fetch licences for a specific property
 */
export async function getPropertyLicences(propertyId: string): Promise<PropertyLicence[]> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("property_licences")
      .select(`
        *,
        licence_types (
          name,
          description,
          display_order
        )
      `)
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching property licences:", error)
      return []
    }

    // Flatten the joined data
    return (data || []).map((l: any) => ({
      ...l,
      licence_type_name: l.licence_types?.name,
      licence_type_description: l.licence_types?.description,
      display_order: l.licence_types?.display_order,
      licence_types: undefined,
    }))
  } catch {
    return []
  }
}

/**
 * Fetch licences for multiple properties at once
 */
export async function getPropertiesLicences(propertyIds: string[]): Promise<Record<string, PropertyLicence[]>> {
  if (propertyIds.length === 0) return {}

  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("property_licences")
      .select(`
        *,
        licence_types (
          name,
          description,
          display_order
        )
      `)
      .in("property_id", propertyIds)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching properties licences:", error)
      return {}
    }

    // Group by property ID
    const grouped: Record<string, PropertyLicence[]> = {}
    for (const licence of data || []) {
      const l: PropertyLicence = {
        ...licence,
        licence_type_name: licence.licence_types?.name,
        licence_type_description: licence.licence_types?.description,
        display_order: licence.licence_types?.display_order,
      }
      if (!grouped[licence.property_id]) {
        grouped[licence.property_id] = []
      }
      grouped[licence.property_id].push(l)
    }

    return grouped
  } catch {
    return {}
  }
}

/**
 * Get licence type counts across all properties
 */
export async function getLicenceTypeCounts(): Promise<Record<string, number>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("property_licences")
      .select("licence_type_code")
      .eq("status", "active")

    if (error) {
      console.error("Error fetching licence counts:", error)
      return {}
    }

    // Count by type
    const counts: Record<string, number> = {}
    for (const licence of data || []) {
      counts[licence.licence_type_code] = (counts[licence.licence_type_code] || 0) + 1
    }

    return counts
  } catch {
    return {}
  }
}

/**
 * Save user licence filter preferences
 */
export async function saveUserLicencePreferences(preferences: {
  enabled_licence_types: string[]
  show_expired: boolean
  show_unknown: boolean
  highlight_expiring_days?: number
}): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return false

    const { error } = await supabase
      .from("user_licence_preferences")
      .upsert({
        user_id: user.id,
        enabled_licence_types: preferences.enabled_licence_types,
        show_expired: preferences.show_expired,
        show_unknown: preferences.show_unknown,
        highlight_expiring_days: preferences.highlight_expiring_days || 90,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id",
      })

    if (error) {
      console.error("Error saving licence preferences:", error)
      return false
    }

    return true
  } catch {
    return false
  }
}

/**
 * Get user licence filter preferences
 */
export async function getUserLicencePreferences(): Promise<{
  enabled_licence_types: string[]
  show_expired: boolean
  show_unknown: boolean
  highlight_expiring_days: number
} | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const { data, error } = await supabase
      .from("user_licence_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (error || !data) return null

    return {
      enabled_licence_types: data.enabled_licence_types,
      show_expired: data.show_expired,
      show_unknown: data.show_unknown,
      highlight_expiring_days: data.highlight_expiring_days,
    }
  } catch {
    return null
  }
}
