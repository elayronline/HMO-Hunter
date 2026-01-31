import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Apply rate limiting to API routes
  if (pathname.startsWith("/api/")) {
    let rateLimitConfig = RATE_LIMITS.standard

    // Stricter limits for sensitive endpoints
    if (pathname.includes("/auth/")) {
      rateLimitConfig = RATE_LIMITS.auth
    } else if (pathname.includes("/enrich")) {
      rateLimitConfig = RATE_LIMITS.enrichment
    } else if (pathname.includes("/admin")) {
      rateLimitConfig = RATE_LIMITS.admin
    }

    const rateLimitResponse = checkRateLimit(request, {
      ...rateLimitConfig,
      keyPrefix: pathname
    })

    if (rateLimitResponse) {
      return rateLimitResponse
    }
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  const code = request.nextUrl.searchParams.get("code")
  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect /properties route - redirect to login if not authenticated
  if (!user && request.nextUrl.pathname === "/properties") {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
