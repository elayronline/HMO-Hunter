/**
 * CSRF Protection (Edge Runtime Compatible)
 *
 * Uses the Double-Submit Cookie pattern for stateless CSRF protection.
 * Uses Web Crypto API (available in Edge Runtime) instead of Node.js crypto.
 */

import { NextRequest, NextResponse } from "next/server"

const CSRF_COOKIE_NAME = "csrf-token"
const CSRF_HEADER_NAME = "x-csrf-token"
const CSRF_TOKEN_LENGTH = 32 // 256 bits of entropy

// Methods that require CSRF validation
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

// API routes exempt from CSRF (cron jobs, webhooks use Bearer auth)
const CSRF_EXEMPT_PATHS = [
  "/api/cron/",
  "/api/send-notifications",
  "/api/fix-listing-types",
  "/api/payments/webhook",
]

/**
 * Generate a CSRF token using Web Crypto API (edge-safe)
 */
export function generateCSRFToken(): string {
  const bytes = new Uint8Array(CSRF_TOKEN_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Validate CSRF token on mutating requests.
 * Returns null if valid, or an error response if invalid.
 */
export function validateCSRF(request: NextRequest): NextResponse | null {
  const method = request.method
  const pathname = request.nextUrl.pathname

  // Skip non-mutating methods
  if (!MUTATING_METHODS.has(method)) return null

  // Skip non-API routes
  if (!pathname.startsWith("/api/")) return null

  // Skip exempt paths (cron, webhooks)
  if (CSRF_EXEMPT_PATHS.some(p => pathname.startsWith(p))) return null

  // Get token from cookie and header
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value
  const headerToken = request.headers.get(CSRF_HEADER_NAME)

  // If no cookie set yet, skip validation (first request — token will be set in response)
  if (!cookieToken) return null

  // Validate: header must match cookie
  if (!headerToken || headerToken !== cookieToken) {
    return NextResponse.json(
      { error: "CSRF token validation failed" },
      { status: 403 }
    )
  }

  return null
}

/**
 * Ensure CSRF cookie is set on every response.
 * If no cookie exists, generate and set one.
 */
export function ensureCSRFCookie(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  const existingToken = request.cookies.get(CSRF_COOKIE_NAME)?.value

  if (!existingToken) {
    const token = generateCSRFToken()
    response.cookies.set(CSRF_COOKIE_NAME, token, {
      httpOnly: false,  // Client JS needs to read this
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    })
  }

  return response
}
