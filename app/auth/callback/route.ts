import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const origin = requestUrl.origin
  const next = requestUrl.searchParams.get("next") || "/"

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
