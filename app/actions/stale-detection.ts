"use server"

import { createClient } from "@/lib/supabase/server"

export async function detectStaleProperties() {
  const supabase = await createClient()
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data, error } = await supabase
    .from("properties")
    .update({
      is_stale: true,
      stale_marked_at: new Date().toISOString(),
    })
    .lt("last_seen_at", sevenDaysAgo.toISOString())
    .eq("is_stale", false)
    .select()

  if (error) {
    throw new Error(`Failed to detect stale properties: ${error.message}`)
  }

  return {
    marked_stale: data?.length || 0,
  }
}

export async function getPropertyFreshness(propertyId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("properties")
    .select("last_seen_at, last_ingested_at, is_stale, source_url, source_name")
    .eq("id", propertyId)
    .single()

  if (error || !data) {
    return null
  }

  const lastSeenDate = new Date(data.last_seen_at!)
  const now = new Date()
  const daysSinceLastSeen = Math.floor((now.getTime() - lastSeenDate.getTime()) / (1000 * 60 * 60 * 24))

  return {
    lastSeenAt: data.last_seen_at,
    lastIngestedAt: data.last_ingested_at,
    isStale: data.is_stale,
    daysSinceLastSeen,
    isFresh: daysSinceLastSeen <= 1,
    sourceUrl: data.source_url,
    sourceName: data.source_name,
  }
}
