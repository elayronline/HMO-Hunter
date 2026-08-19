import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { datedChanges } from "@/lib/dashboard/attention"
import {
  savedAlerts,
  SAVED_HORIZON_DAYS,
  type CommencingDirection,
  type SavedRow,
} from "@/lib/dashboard/saved-alerts"

/**
 * The dashboard answers two questions and no others: what has changed on the
 * listings you saved, and which restrictions arrive in the next six months.
 *
 * It used to also carry licence lists across the whole estate and four coverage
 * counts. Those describe the dataset rather than the reader's work, and they
 * read the same every morning — the map already shows what exists.
 *
 * Read through the cookie-scoped client, not the service role: saved listings
 * belong to one person, and row-level security is what keeps it that way.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const now = new Date()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 })
    }

    // Directions commencing inside the window. Confirmation deadlines are a
    // different event — a restriction that may lapse rather than arrive — and
    // are deliberately not shown here.
    const upcomingDirections: CommencingDirection[] = datedChanges(now)
      .filter((change) => change.kind === "commences" && change.daysAway <= SAVED_HORIZON_DAYS)
      .map((change) => ({
        council: change.council,
        date: change.date,
        daysAway: change.daysAway,
        extent: change.detail,
      }))

    const { data: saved } = await supabase
      .from("saved_properties")
      .select(
        "property:properties(id,address,postcode,article_4_council,licence_status,hmo_licence_expiry)"
      )
      .eq("user_id", user.id)

    const rows: SavedRow[] = (saved ?? [])
      .map((entry: { property: SavedRow | SavedRow[] | null }) =>
        Array.isArray(entry.property) ? entry.property[0] : entry.property
      )
      .filter((property): property is SavedRow => Boolean(property))

    return NextResponse.json({
      savedCount: rows.length,
      alerts: savedAlerts(rows, upcomingDirections, now),
      upcomingDirections,
      horizonDays: SAVED_HORIZON_DAYS,
      generatedAt: now.toISOString(),
    })
  } catch (error) {
    console.error("[Dashboard] Error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
