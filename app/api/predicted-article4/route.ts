import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  predictFutureArticle4Zones,
  predictionsToGeoJSON,
} from "@/lib/services/article4-prediction"
import type { Property } from "@/lib/types/database"

// Cache predictions for 1 hour (they don't change frequently)
let cachedPredictions: GeoJSON.FeatureCollection | null = null
let cachedArticle4Features: GeoJSON.Feature[] | null = null
let cacheTimestamp = 0
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour

export async function GET(request: Request) {
  try {
    // Check premium access via auth
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    // Check premium status (admin or standard_pro)
    const { data: credits } = await supabase
      .from("user_credits")
      .select("role")
      .eq("user_id", user.id)
      .single()

    // Allow admin and standard_pro users
    const isPremium = credits?.role === "admin" || credits?.role === "standard_pro"
    if (!isPremium) {
      return NextResponse.json(
        { error: "Premium feature - upgrade required", premium_required: true },
        { status: 403 }
      )
    }

    const now = Date.now()

    // Return cached data if still valid
    if (cachedPredictions && now - cacheTimestamp < CACHE_DURATION) {
      return NextResponse.json(cachedPredictions, {
        headers: {
          "Cache-Control": "private, max-age=3600",
          "X-Cache": "HIT",
        },
      })
    }

    // Fetch all properties for analysis
    const { data: properties, error: propError } = await supabase
      .from("properties")
      .select("*")
      .limit(5000)

    if (propError || !properties) {
      console.error("[PredictedArticle4] Failed to fetch properties:", propError)
      return NextResponse.json(
        { error: "Failed to fetch property data" },
        { status: 500 }
      )
    }

    // Fetch existing Article 4 GeoJSON for proximity analysis
    let article4Features: GeoJSON.Feature[] = []
    try {
      if (cachedArticle4Features) {
        article4Features = cachedArticle4Features
      } else {
        const article4Response = await fetch(
          new URL("/api/article4-data", request.url).toString()
        )
        if (article4Response.ok) {
          const article4Data = await article4Response.json()
          article4Features = article4Data?.features || []
          cachedArticle4Features = article4Features
        }
      }
    } catch (err) {
      console.warn("[PredictedArticle4] Could not fetch Article 4 data for proximity:", err)
    }

    // Run prediction engine
    const predictions = predictFutureArticle4Zones(
      properties as Property[],
      article4Features
    )

    const geojson = predictionsToGeoJSON(predictions)

    // Update cache
    cachedPredictions = geojson
    cacheTimestamp = now

    console.log(`[PredictedArticle4] Generated ${predictions.length} predicted zones`)

    return NextResponse.json(geojson, {
      headers: {
        "Cache-Control": "private, max-age=3600",
        "X-Cache": "MISS",
        "X-Zone-Count": String(predictions.length),
      },
    })
  } catch (error) {
    console.error("[PredictedArticle4] Error:", error)
    return NextResponse.json(
      { error: "Failed to generate predictions" },
      { status: 500 }
    )
  }
}
