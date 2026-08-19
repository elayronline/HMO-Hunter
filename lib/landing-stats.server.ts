import { createServiceRoleClient } from "@/lib/supabase/server"
import type { LandingStats } from "@/lib/landing-stats"

/**
 * Counts the figures the landing page is allowed to quote.
 *
 * Server-only: it reaches `lib/supabase/server`, which imports `next/headers`.
 * Client components take the type and the formatter from `lib/landing-stats`
 * instead — importing this module from one breaks the build.
 *
 * When the count cannot be taken this returns null and the copy renders without
 * the number rather than with a zero. An absent figure is honest; a zero
 * presented as a measurement is not.
 */

const PAGE_SIZE = 1000

export async function getLandingStats(): Promise<LandingStats | null> {
  try {
    const supabase = createServiceRoleClient()

    const countOf = async (column?: string, value?: string) => {
      let query = supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
      if (column && value) query = query.eq(column, value)
      const { count, error } = await query
      if (error) throw error
      return count ?? 0
    }

    const [properties, inForce, noneFound, notEstablished, councilVerified] =
      await Promise.all([
        countOf(),
        countOf("article_4_status", "in_force"),
        countOf("article_4_status", "none_found"),
        countOf("article_4_status", "unknown"),
        countOf("article_4_source", "council-verified"),
      ])

    if (properties === 0) return null

    // Distinct councils has to be paged: the API caps a single response at
    // PAGE_SIZE rows, and stopping at the first page would undercount.
    const councilNames = new Set<string>()
    for (let from = 0; from < properties; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("properties")
        .select("article_4_council")
        .not("article_4_council", "is", null)
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw error
      if (!data?.length) break
      for (const row of data) {
        if (row.article_4_council) councilNames.add(row.article_4_council)
      }
    }

    return {
      properties,
      councils: councilNames.size,
      inForce,
      noneFound,
      notEstablished,
      councilVerified,
    }
  } catch {
    // The landing page must render whether or not the database answers.
    return null
  }
}
