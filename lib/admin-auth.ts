import { NextResponse } from "next/server"

/**
 * Shared guard for the endpoints that write to the properties table.
 *
 * `middleware.ts` rate-limits `/api/*` but deliberately exempts it from the auth
 * redirect (line 78), so before this existed every `/api/enrich-*` route was a
 * publicly callable POST that wrote to the database through the service-role
 * key — RLS bypassed, from the open internet, on the deployed site. Rate
 * limiting bounds how fast that can be done, not whether it can be done at all.
 *
 * Two properties matter here:
 *
 *  1. **Fail closed.** With `ADMIN_API_KEY` unset the guard rejects everything.
 *     The alternative — treating "no key configured" as "no key required" —
 *     turns a missing environment variable into an open door, which is exactly
 *     how this endpoint was reachable in the first place.
 *
 *  2. **Constant-time comparison.** `===` on a secret returns as soon as two
 *     bytes differ, which leaks its length and prefix to anyone who can time
 *     the response. Written by hand rather than with `crypto.timingSafeEqual`
 *     so it behaves the same whichever runtime a route ends up on.
 */
function secureCompare(a: string, b: string): boolean {
  // Length is not secret — it is observable from the header — but comparing
  // unequal lengths byte-by-byte would read past the end of the shorter string.
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

/**
 * Returns a 401/503 response when the caller is not an admin, or `null` when the
 * request may proceed. Call it as the first statement in the handler:
 *
 *     const denied = requireAdmin(request)
 *     if (denied) return denied
 */
export function requireAdmin(request: Request): NextResponse | null {
  const configured = process.env.ADMIN_API_KEY

  if (!configured) {
    // 503 rather than 401: the caller has done nothing wrong and no key would
    // help them. This is a deployment that has not been finished.
    return NextResponse.json(
      { error: "Admin API key is not configured on this deployment" },
      { status: 503 }
    )
  }

  const presented = request.headers.get("x-admin-key")
  if (!presented || !secureCompare(presented, configured)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return null
}
