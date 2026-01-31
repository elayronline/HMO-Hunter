import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkResourceCap, deductCredits, updateResourceCount } from "@/lib/credits"
import { validateBody } from "@/lib/validation/api-validation"
import { savedSearchCreateSchema, savedSearchUpdateSchema } from "@/lib/validation/schemas"

// GET - List user's saved searches
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: searches, error } = await supabase
    .from("saved_searches")
    .select("*")
    .eq("user_id", user.id)
    .order("last_used_at", { ascending: false, nullsFirst: false })

  if (error) {
    console.error("[SavedSearches] Error fetching:", error)
    return NextResponse.json({ error: "Failed to fetch saved searches" }, { status: 500 })
  }

  return NextResponse.json(searches)
}

// POST - Create a new saved search
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Validate request body
  const validation = await validateBody(request, savedSearchCreateSchema)
  if (!validation.success) {
    return validation.error
  }

  const { name, filters } = validation.data

  try {

    // Check resource cap (10 saved searches max)
    const capCheck = await checkResourceCap(user.id, 'saved_searches')
    if (!capCheck.success) {
      return NextResponse.json({
        error: capCheck.error || "You've reached your saved searches limit (10)",
        limitReached: true,
        current: capCheck.current,
        limit: capCheck.limit,
      }, { status: 429 })
    }

    // Deduct 2 credits for saving a search
    const creditResult = await deductCredits(user.id, 'save_search')
    if (!creditResult.success) {
      return NextResponse.json({
        error: creditResult.error || "Insufficient credits",
        insufficientCredits: true,
        creditsRemaining: creditResult.credits_remaining,
        resetAt: creditResult.reset_at,
      }, { status: 429 })
    }

    const { data: search, error } = await supabase
      .from("saved_searches")
      .insert({
        user_id: user.id,
        name,
        filters,
      })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "A search with this name already exists" }, { status: 400 })
      }
      console.error("[SavedSearches] Error creating:", error)
      return NextResponse.json({ error: "Failed to create saved search" }, { status: 500 })
    }

    // Update resource count
    await updateResourceCount(user.id, 'saved_searches', 1)

    return NextResponse.json({
      ...search,
      creditsRemaining: creditResult.credits_remaining,
      warning: creditResult.warning,
    }, { status: 201 })
  } catch (error) {
    console.error("[SavedSearches] Error:", error)
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
}

// DELETE - Delete a saved search
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const searchId = searchParams.get("id")

  if (!searchId) {
    return NextResponse.json({ error: "Search ID required" }, { status: 400 })
  }

  const { error } = await supabase
    .from("saved_searches")
    .delete()
    .eq("id", searchId)
    .eq("user_id", user.id)

  if (error) {
    console.error("[SavedSearches] Error deleting:", error)
    return NextResponse.json({ error: "Failed to delete saved search" }, { status: 500 })
  }

  // Decrement resource count
  await updateResourceCount(user.id, 'saved_searches', -1)

  return NextResponse.json({ success: true })
}

// PATCH - Update last_used_at when loading a search
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "Search ID required" }, { status: 400 })
    }

    const { data: search, error } = await supabase
      .from("saved_searches")
      .update({
        last_used_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()

    // Increment use_count separately
    try {
      await supabase
        .from("saved_searches")
        .update({ use_count: (search?.use_count || 0) + 1 })
        .eq("id", id)
    } catch {
      // Ignore increment errors
    }

    if (error) {
      console.error("[SavedSearches] Error updating:", error)
      return NextResponse.json({ error: "Failed to update saved search" }, { status: 500 })
    }

    return NextResponse.json(search)
  } catch (error) {
    console.error("[SavedSearches] Error:", error)
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
}
