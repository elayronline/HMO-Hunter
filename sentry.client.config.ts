import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 1.0, // Capture 100% of transactions in dev, reduce in production

  // Session Replay
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

  // Debug mode (disable in production)
  debug: false,

  // Environment
  environment: process.env.NODE_ENV,

  // Only send errors in production
  enabled: process.env.NODE_ENV === "production",

  // Ignore common non-actionable errors
  ignoreErrors: [
    // Browser extensions
    "top.GLOBALS",
    "originalCreateNotification",
    "canvas.contentDocument",
    "MyApp_RemoveAllHighlights",
    "http://tt.telecomia.com/jsweb",
    "jigsaw is not defined",
    "ComboSearch is not defined",
    "atomicFind",
    // Facebook
    "fb_xd_fragment",
    // Chrome extensions
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    // Network errors
    "Network request failed",
    "Failed to fetch",
    "Load failed",
    "NetworkError",
    // Cancelled requests
    "AbortError",
    "The operation was aborted",
    // Safari
    "The network connection was lost",
  ],

  // Filter out non-app code
  denyUrls: [
    // Chrome extensions
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    // Firefox extensions
    /^moz-extension:\/\//i,
    // Safari extensions
    /^safari-extension:\/\//i,
    // Third party scripts
    /googleapis\.com/i,
    /gstatic\.com/i,
    /google-analytics\.com/i,
    /googletagmanager\.com/i,
  ],

  integrations: [
    Sentry.replayIntegration({
      // Mask all text and inputs for privacy
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  // Before sending event, add user context
  beforeSend(event) {
    // Don't send events in development
    if (process.env.NODE_ENV !== "production") {
      return null
    }
    return event
  },
})
