import { NextResponse } from "next/server"
import { seedAllCities } from "@/app/actions/seed-all-cities"

export async function POST() {
  try {
    const result = await seedAllCities()
    return NextResponse.json(result)
  } catch (error) {
    console.error("[API] Seed all cities error:", error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ message: "Use POST to seed all cities" })
}
