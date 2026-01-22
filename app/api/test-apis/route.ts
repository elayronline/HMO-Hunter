import { NextResponse } from "next/server"
import { validateApiConfig, getApiStatus } from "@/lib/config/api-config"

/**
 * Test API connections
 * GET /api/test-apis
 */
export async function GET() {
  try {
    const validation = validateApiConfig()
    const status = getApiStatus()

    return NextResponse.json({
      success: validation.isValid,
      validation,
      status,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[v0] Error testing APIs:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to test API connections",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
