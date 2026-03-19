import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { validateBody } from "@/lib/validation/api-validation"
import { d2vTemplateCreateSchema } from "@/lib/validation/schemas"

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: templates, error } = await supabase
    .from("d2v_templates")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[D2V Templates] Error fetching:", error)
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 })
  }

  return NextResponse.json(templates)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const validation = await validateBody(request, d2vTemplateCreateSchema)
  if (!validation.success) {
    return validation.error
  }

  const { name, subject, body, channel } = validation.data

  // Extract placeholders from body
  const placeholderRegex = /\{\{(\w+)\}\}/g
  const placeholders: string[] = []
  let match
  while ((match = placeholderRegex.exec(body)) !== null) {
    if (!placeholders.includes(`{{${match[1]}}}`)) {
      placeholders.push(`{{${match[1]}}}`)
    }
  }

  const { data: template, error } = await supabase
    .from("d2v_templates")
    .insert({
      user_id: user.id,
      name,
      subject,
      body,
      channel,
      placeholders,
    })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Template name already exists" }, { status: 409 })
    }
    console.error("[D2V Templates] Error creating:", error)
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 })
  }

  return NextResponse.json(template, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const templateId = request.nextUrl.searchParams.get("id")
  if (!templateId) {
    return NextResponse.json({ error: "Template ID required" }, { status: 400 })
  }

  const { error } = await supabase
    .from("d2v_templates")
    .delete()
    .eq("id", templateId)
    .eq("user_id", user.id)

  if (error) {
    console.error("[D2V Templates] Error deleting:", error)
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
