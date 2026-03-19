import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const source = searchParams.get("source")
  const city = searchParams.get("city")
  const status = searchParams.get("status") || "new"
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200)
  const offset = parseInt(searchParams.get("offset") || "0", 10)

  let query = supabase
    .from("off_market_leads")
    .select("*", { count: "exact" })

  if (source && source !== "all") {
    query = query.eq("source", source)
  }

  if (city) {
    query = query.ilike("city", `%${city}%`)
  }

  if (status && status !== "all") {
    query = query.eq("status", status)
  }

  const { data, error, count } = await query
    .order("opportunity_score", { ascending: false })
    .order("ingested_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error("[OffMarket Leads] Error:", error)
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 })
  }

  // Get summary counts by source
  const { data: summaryData } = await supabase
    .from("off_market_leads")
    .select("source")

  const summary: Record<string, number> = {}
  if (summaryData) {
    for (const row of summaryData) {
      summary[row.source] = (summary[row.source] || 0) + 1
    }
  }

  return NextResponse.json({
    leads: data || [],
    total: count || 0,
    summary,
  })
}

// Update lead status (contacted, in_pipeline, dismissed)
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { id, status, notes } = body as { id: string; status: string; notes?: string }

  if (!id || !status) {
    return NextResponse.json({ error: "ID and status required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("off_market_leads")
    .update({ status, notes, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    console.error("[OffMarket Leads] Update error:", error)
    return NextResponse.json({ error: "Failed to update lead" }, { status: 500 })
  }

  return NextResponse.json(data)
}
