import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Apply rate limiting to API routes
  if (pathname.startsWith("/api/")) {
    let rateLimitConfig: { maxRequests: number; windowMs: number } = RATE_LIMITS.standard

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

  // Public routes that don't require authentication
  const publicAuthRoutes = ["/auth/login", "/auth/signup", "/auth/callback", "/auth/forgot-password", "/auth/reset-password"]
  const publicPages = ["/", "/privacy", "/data-request", "/faq", "/help"]
  const isPublicAuthRoute = publicAuthRoutes.some(route => pathname.startsWith(route))
  const isPublicPage = publicPages.includes(pathname)

  // Redirect unauthenticated users to login (except for public routes and pages)
  if (!user && !isPublicAuthRoute && !isPublicPage && pathname !== "/api" && !pathname.startsWith("/api/")) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages to the app
  if (user && isPublicAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/map"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
