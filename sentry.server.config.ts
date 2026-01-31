import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 1.0,

  // Debug mode (disable in production)
  debug: false,

  // Environment
  environment: process.env.NODE_ENV,

  // Only send errors in production
  enabled: process.env.NODE_ENV === "production",

  // Ignore common non-actionable errors
  ignoreErrors: [
    "NEXT_NOT_FOUND",
    "NEXT_REDIRECT",
    "AbortError",
    "The operation was aborted",
    "Failed to fetch",
    "Load failed",
  ],

  // Tag errors for easier filtering and alerting
  beforeSend(event, hint) {
    if (process.env.NODE_ENV !== "production") {
      return null
    }

    // Add custom tags for alerting
    const error = hint.originalException as Error | undefined

    // Tag critical errors (auth, credits, database)
    if (error?.message) {
      if (error.message.includes("auth") || error.message.includes("Unauthorized")) {
        event.tags = { ...event.tags, category: "auth", severity: "high" }
      } else if (error.message.includes("credits") || error.message.includes("Insufficient")) {
        event.tags = { ...event.tags, category: "credits", severity: "medium" }
      } else if (error.message.includes("database") || error.message.includes("supabase")) {
        event.tags = { ...event.tags, category: "database", severity: "critical" }
      } else if (error.message.includes("rate limit") || error.message.includes("429")) {
        event.tags = { ...event.tags, category: "rate_limit", severity: "low" }
      }
    }

    // Tag by URL pattern
    const url = event.request?.url || ""
    if (url.includes("/api/admin")) {
      event.tags = { ...event.tags, area: "admin" }
    } else if (url.includes("/api/enrich")) {
      event.tags = { ...event.tags, area: "enrichment" }
    } else if (url.includes("/api/export")) {
      event.tags = { ...event.tags, area: "export" }
    }

    return event
  },
})

// Export for use in API routes to capture specific events
export function captureApiError(error: Error, context: Record<string, unknown>) {
  Sentry.captureException(error, {
    extra: context,
    tags: { source: "api" }
  })
}
