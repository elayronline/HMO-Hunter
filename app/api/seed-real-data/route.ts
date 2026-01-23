import { NextResponse } from "next/server"
import { clearAndSeedRealData, getPropertyCount } from "@/app/actions/seed-real-data"

export const dynamic = "force-dynamic"

export async function POST() {
  try {
    const result = await clearAndSeedRealData()

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
        propertiesAdded: 0,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const count = await getPropertyCount()

    return NextResponse.json({
      propertyCount: count,
      message: `Database contains ${count} properties`,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
