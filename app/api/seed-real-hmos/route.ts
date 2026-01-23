import { NextResponse } from "next/server"
import { seedRealHMOs } from "@/app/actions/seed-real-hmos"

export const maxDuration = 300 // 5 minutes timeout for Vercel

export async function POST() {
  try {
    console.log("[API] Starting real HMO seed...")
    const result = await seedRealHMOs()
    console.log("[API] Seed complete:", result.message)
    return NextResponse.json(result)
  } catch (error) {
    console.error("[API] Seed real HMOs error:", error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Use POST to seed real HMO data from PropertyData API",
    cities: 31,
    source: "PropertyData National HMO Register"
  })
}
