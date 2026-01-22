"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function saveProperty(propertyId: string, notes?: string) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { error: "You must be logged in to save properties" }
    }

    const { data, error } = await supabase
      .from("saved_properties")
      .insert({
        user_id: user.id,
        property_id: propertyId,
        notes: notes || null,
      })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        return { error: "Property is already saved" }
      }
      return { error: error.message }
    }

    revalidatePath("/")
    return { data }
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return { error: "Request was cancelled" }
    }
    return { error: "An unexpected error occurred" }
  }
}

export async function unsaveProperty(propertyId: string) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { error: "You must be logged in to unsave properties" }
    }

    const { error } = await supabase
      .from("saved_properties")
      .delete()
      .eq("user_id", user.id)
      .eq("property_id", propertyId)

    if (error) {
      return { error: error.message }
    }

    revalidatePath("/")
    return { success: true }
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return { error: "Request was cancelled" }
    }
    return { error: "An unexpected error occurred" }
  }
}

export async function getSavedProperties() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { data: [] }
    }

    const { data, error } = await supabase
      .from("saved_properties")
      .select(`
        id,
        notes,
        created_at,
        property:properties (*)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      return { error: error.message, data: [] }
    }

    return { data }
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return { data: [] }
    }
    return { data: [] }
  }
}

export async function isPropertySaved(propertyId: string): Promise<boolean> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return false
    }

    const { data } = await supabase
      .from("saved_properties")
      .select("id")
      .eq("user_id", user.id)
      .eq("property_id", propertyId)
      .single()

    return !!data
  } catch (error: any) {
    // Silently fail for AbortErrors or any other errors
    return false
  }
}
