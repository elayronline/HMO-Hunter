import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// Allowed internal redirect paths to prevent open redirect attacks
const ALLOWED_REDIRECTS = ["/map", "/saved", "/user-dashboard", "/admin", "/help", "/faq"]

function getSafeRedirect(next: string | null): string {
  if (!next) return "/map"
  // Must start with "/" and not "//" (protocol-relative URL)
  if (!next.startsWith("/") || next.startsWith("//")) return "/map"
  // Must be a known internal path
  const basePath = next.split("?")[0]
  if (ALLOWED_REDIRECTS.some(allowed => basePath === allowed || basePath.startsWith(allowed + "/"))) {
    return next
  }
  return "/map"
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const origin = requestUrl.origin
  const next = getSafeRedirect(requestUrl.searchParams.get("next"))

  if (code) {
    const supabase = await createClient()

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error.message)}`)
    }

    // Check if this is a password recovery flow
    if (data.session?.user?.recovery_sent_at) {
      return NextResponse.redirect(`${origin}/auth/reset-password`)
    }
  }

  // Check for type parameter (used by Supabase for different auth flows)
  const type = requestUrl.searchParams.get("type")
  if (type === "recovery") {
    return NextResponse.redirect(`${origin}/auth/reset-password`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
