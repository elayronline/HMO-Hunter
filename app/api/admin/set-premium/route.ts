import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// Admin endpoint to set user premium status
// Protected by ADMIN_API_KEY environment variable
export async function POST(request: Request) {
  try {
    // Check admin API key
    const adminKey = request.headers.get("x-admin-key")
    if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { email, is_premium } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    // Use service role key to access admin API
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Find user by email
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers()

    if (listError) {
      console.error("Error listing users:", listError)
      return NextResponse.json({ error: "Failed to list users" }, { status: 500 })
    }

    const user = users.users.find(u => u.email === email)

    if (!user) {
      return NextResponse.json({ error: `User not found: ${email}` }, { status: 404 })
    }

    // Update user metadata
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        is_premium: is_premium ?? true
      }
    })

    if (error) {
      console.error("Error updating user:", error)
      return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        is_premium: data.user.user_metadata?.is_premium
      }
    })
  } catch (error) {
    console.error("Admin set-premium error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET endpoint to list all users and their premium status
export async function GET(request: Request) {
  try {
    // Check admin API key
    const adminKey = request.headers.get("x-admin-key")
    if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers()

    if (error) {
      console.error("Error listing users:", error)
      return NextResponse.json({ error: "Failed to list users" }, { status: 500 })
    }

    const userList = users.users.map(u => ({
      id: u.id,
      email: u.email,
      is_premium: u.user_metadata?.is_premium ?? false,
      created_at: u.created_at
    }))

    return NextResponse.json({
      total: userList.length,
      premium_count: userList.filter(u => u.is_premium).length,
      users: userList
    })
  } catch (error) {
    console.error("Admin list users error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
