import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // Check if tables exist
  const checks = await Promise.all([
    supabase.from("price_alerts").select("id").limit(1),
    supabase.from("price_alert_history").select("id").limit(1),
    supabase.from("watched_properties").select("id").limit(1),
  ])

  return NextResponse.json({
    tablesExist: {
      price_alerts: !checks[0].error,
      price_alert_history: !checks[1].error,
      watched_properties: !checks[2].error,
    },
    errors: {
      price_alerts: checks[0].error?.message,
      price_alert_history: checks[1].error?.message,
      watched_properties: checks[2].error?.message,
    },
    instructions: "Run scripts/013_create_price_alerts_table.sql in Supabase SQL Editor"
  })
}
