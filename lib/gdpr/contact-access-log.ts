import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * The audit record of who looked at an owner's contact details.
 *
 * WHY THIS IS A FUNCTION AND NOT AN API CALL
 *
 * /api/track-contact recorded this by HTTP-fetching /api/gdpr/log-access, and
 * the call could not work in either of two ways.
 *
 * It sent no cookies, so the log endpoint's `supabase.auth.getUser()` returned
 * null and the row would have been written with `user_id: null`. An access log
 * that records that contact data was read but not who read it does not answer
 * the question a subject access request asks.
 *
 * And the URL was `${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/gdpr/log-access`.
 * That variable is set in no environment, so the string began with a slash —
 * not an absolute URL, which server-side fetch requires. It threw, into a catch
 * that only wrote to the console. contact_access_log held 0 rows.
 *
 * So the caller has the session and the request; it should write the row. The
 * endpoint stays for clients that post directly, and now shares this code
 * rather than reimplementing it.
 */

export const CONTACT_ACCESS_TYPES = ["view", "copy", "export", "call", "email"] as const
export type ContactAccessType = (typeof CONTACT_ACCESS_TYPES)[number]

export interface ContactAccessEntry {
  /** Null only for an unauthenticated caller. Never null from /api/track-contact. */
  userId: string | null
  propertyId: string
  ownerName?: string | null
  dataAccessed: string[]
  accessType: ContactAccessType
  ipAddress: string
  userAgent: string
}

/** The IP and agent of the request that actually read the data. */
export function requestMetadata(request: Request): { ipAddress: string; userAgent: string } {
  const forwardedFor = request.headers.get("x-forwarded-for")
  return {
    ipAddress: forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown",
    userAgent: request.headers.get("user-agent") || "unknown",
  }
}

/**
 * Writes the audit row. Returns the error rather than throwing, because a
 * failure here must not deny the reader data they are entitled to — but it must
 * not be swallowed either. The caller decides what to do; it may not decide to
 * ignore it silently, which is how this went unnoticed.
 */
export async function logContactAccess(entry: ContactAccessEntry): Promise<{ error: string | null }> {
  const { error } = await supabaseAdmin.from("contact_access_log").insert({
    user_id: entry.userId,
    property_id: entry.propertyId,
    owner_name: entry.ownerName ?? null,
    data_accessed: entry.dataAccessed,
    access_type: entry.accessType,
    ip_address: entry.ipAddress,
    user_agent: entry.userAgent,
  })
  return { error: error?.message ?? null }
}
