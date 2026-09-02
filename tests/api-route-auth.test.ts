import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

/**
 * Every API route states how it decides who may call it.
 *
 * `middleware.ts` redirects unauthenticated browsers to /auth/login, but line 77
 * deliberately exempts `/api/*` from that redirect — an API should answer 401,
 * not 302. The consequence is that an API route is public unless it says
 * otherwise, and 26 of 76 said nothing. Eleven of those wrote to the database
 * through the service-role key, and two deleted from it. `/api/refresh-data`
 * deleted properties and re-ran ingestion for anyone who sent a POST.
 *
 * This was not carelessness so much as an incomplete sweep: lib/admin-auth.ts
 * was written precisely because the enrich endpoints were publicly writable, and
 * it was applied to every route matching `/api/enrich-*`. The same class of route
 * outside that prefix was never revisited.
 *
 * A prefix sweep cannot catch the next one. A test over every route can.
 */

const API_DIR = join("app", "api")

/** Anything that proves the route made a decision about its caller. */
const GUARD_PATTERNS = [
  /requireAdmin/,          // lib/admin-auth.ts — x-admin-key, fails closed
  /requireAuth/,           // lib/api-auth.ts — Supabase session
  /CRON_SECRET/,           // Vercel cron bearer token
  /getUser\(\)/,           // inline session check
  /isAdmin\(/,             // lib/entitlements.ts — the tier source of truth
  /x-admin-key/,           // inline admin header check
  /stripe-signature|constructEvent/, // webhook signature verification
]

/**
 * Routes that are public on purpose. Each needs a reason, not just an entry.
 *
 * `gdpr/data-request` accepts data-subject requests from the public page
 * /data-request. A person exercising a right under UKGDPR Article 15 or 17 is
 * frequently NOT a user of the product — they are someone whose details appeared
 * in it — so requiring an account would defeat the endpoint's purpose. Its POST
 * validates requestType against an allowlist and inserts through a parameterised
 * client; its GET returns static documentation and no data.
 */
const INTENTIONALLY_PUBLIC = new Set(["gdpr/data-request"])

function routeFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...routeFiles(full))
    else if (entry === "route.ts") out.push(full)
  }
  return out
}

describe("every API route decides who may call it", () => {
  const routes = routeFiles(API_DIR)

  it("finds the route files", () => {
    expect(routes.length).toBeGreaterThan(50)
  })

  it("has no route without a guard, except those public on purpose", () => {
    const unguarded = routes
      .filter((f) => {
        const src = readFileSync(f, "utf8")
        return !GUARD_PATTERNS.some((p) => p.test(src))
      })
      .map((f) => f.replace(join(API_DIR, ""), "").replace(/^\/+/, "").replace("/route.ts", ""))
      .filter((name) => !INTENTIONALLY_PUBLIC.has(name))

    expect(unguarded).toEqual([])
  })

  /**
   * The stricter half of the rule. A route that only reads can reasonably be
   * public; one that writes through the service-role key bypasses RLS, so
   * "public" and "writes" together is never an accident worth keeping.
   */
  it("has no unguarded route that writes to the database", () => {
    const writingAndOpen = routes
      .filter((f) => {
        const src = readFileSync(f, "utf8")
        const guarded = GUARD_PATTERNS.some((p) => p.test(src))
        const writes = /\.(insert|update|upsert|delete)\(/.test(src)
        return !guarded && writes
      })
      .map((f) => f.replace(join(API_DIR, ""), "").replace(/^\/+/, "").replace("/route.ts", ""))
      .filter((name) => !INTENTIONALLY_PUBLIC.has(name))

    expect(writingAndOpen).toEqual([])
  })
})

/**
 * Redistribution filtering is not something a caller opts out of.
 *
 * /api/article4/council/[slug] served a licence-filtered payload by default and
 * the unfiltered one when the query string said `?internal=1`. Third-party
 * planning data carries redistribution terms the filter exists to honour, so the
 * switch that honoured them was operated by the person it was meant to restrain.
 */
describe("the Article 4 council payload is gated on a session, not a query string", () => {
  const src = readFileSync(join(API_DIR, "article4", "council", "[slug]", "route.ts"), "utf8")
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n")

  it("does not read the internal flag from the query string", () => {
    expect(code).not.toMatch(/searchParams\.get\(\s*["']internal["']\s*\)/)
  })

  it("derives it from an authenticated user", () => {
    expect(code).toMatch(/getUser\(\)/)
    expect(code).toMatch(/const internal = user != null/)
  })

  it("never lets the unfiltered payload into a shared cache", () => {
    expect(code).toMatch(/internal \? "private, no-store"/)
  })
})

/**
 * A route that calls another route has to carry the credential.
 *
 * /api/enrich-all and /api/enrich-all-images orchestrate their work by
 * HTTP-fetching this application's own enrichment routes, and sent only
 * Content-Type. Those routes are guarded, so every sub-call received 401 — or
 * 503 where ADMIN_API_KEY is unset — and the orchestrator reported zero
 * enriched with no error a reader could act on. It broke when admin-auth was
 * introduced to close the publicly-writable enrich endpoints, and stayed broken
 * because nothing tested it.
 *
 * /api/enrich-article4 failed identically against /api/article4-data and was
 * found only by running an enrichment by hand. The lesson is that guarding a
 * route and keeping its callers working are two different properties, and the
 * scan above only proves the first.
 */
describe("routes that call other routes forward their credential", () => {
  const ORCHESTRATORS = [
    join(API_DIR, "enrich-all", "route.ts"),
    join(API_DIR, "enrich-all-images", "route.ts"),
  ]

  for (const file of ORCHESTRATORS) {
    it(`${file} does not fetch a guarded route with bare headers`, () => {
      const src = readFileSync(file, "utf8")
      // The failing shape: a self-call whose only header is Content-Type.
      expect(src).not.toMatch(/headers:\s*\{\s*"Content-Type":\s*"application\/json"\s*\}[\s\S]{0,80}?\/api\//)
      expect(src).toMatch(/adminHeaders\(request\)/)
    })

    it(`${file} takes the key from the request, not the environment`, () => {
      const src = readFileSync(file, "utf8")
      // Reading process.env here would let the orchestrator act with more
      // authority than the caller that invoked it.
      expect(src).toMatch(/request\.headers\.get\("x-admin-key"\)/)
      expect(src).not.toMatch(/"x-admin-key":\s*process\.env/)
    })
  }
})
