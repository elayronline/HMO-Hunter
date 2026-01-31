import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { User } from "@supabase/supabase-js"

export type AuthResult =
  | { authenticated: true; user: User }
  | { authenticated: false; response: NextResponse }

/**
 * Verify authentication for API routes
 * Returns the user if authenticated, or an error response if not
 */
export async function requireAuth(): Promise<AuthResult> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      authenticated: false,
      response: NextResponse.json(
        { error: "Unauthorized - Please log in" },
        { status: 401 }
      )
    }
  }

  return { authenticated: true, user }
}

/**
 * Require admin/premium user for sensitive operations
 * Checks user_metadata.is_admin flag
 */
export async function requireAdmin(): Promise<AuthResult> {
  const result = await requireAuth()

  if (!result.authenticated) {
    return result
  }

  const isAdmin = result.user.user_metadata?.is_admin === true

  if (!isAdmin) {
    return {
      authenticated: false,
      response: NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      )
    }
  }

  return result
}
