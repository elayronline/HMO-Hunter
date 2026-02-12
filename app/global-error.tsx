"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8fafc",
          padding: "1rem",
          fontFamily: "system-ui, -apple-system, sans-serif"
        }}>
          <div style={{ maxWidth: "28rem", textAlign: "center" }}>
            <div style={{
              backgroundColor: "#fee2e2",
              padding: "1rem",
              borderRadius: "9999px",
              width: "4rem",
              height: "4rem",
              margin: "0 auto 1.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#dc2626"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            </div>

            <h1 style={{
              fontSize: "1.5rem",
              fontWeight: "bold",
              color: "#0f172a",
              marginBottom: "0.5rem"
            }}>
              Something went wrong
            </h1>

            <p style={{
              color: "#475569",
              marginBottom: "1.5rem"
            }}>
              A critical error occurred. Please refresh the page or try again later.
            </p>

            {error.digest && (
              <p style={{
                fontSize: "0.75rem",
                color: "#94a3b8",
                marginBottom: "1.5rem",
                fontFamily: "monospace"
              }}>
                Error ID: {error.digest}
              </p>
            )}

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button
                onClick={reset}
                style={{
                  backgroundColor: "#0d9488",
                  color: "white",
                  padding: "0.5rem 1rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  fontWeight: "500",
                  cursor: "pointer"
                }}
              >
                Try Again
              </button>

              <button
                onClick={() => window.location.href = "/map"}
                style={{
                  backgroundColor: "white",
                  color: "#0f172a",
                  padding: "0.5rem 1rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #e2e8f0",
                  fontWeight: "500",
                  cursor: "pointer"
                }}
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
