import { NextResponse } from "next/server"
import { getRequestAuth } from "@/lib/supabase/auth"
import { createAdminClient, getAdminCapabilities } from "@/lib/admin"

type ModerationPayload = {
  post_id?: string
  status?: "pending" | "approved" | "hidden"
  is_featured?: boolean
}

export async function POST(request: Request) {
  const { user, errorMessage } = await getRequestAuth(request)

  if (!user) {
    return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
  }

  const capabilities = await getAdminCapabilities({ userId: user.id, email: user.email })
  if (!capabilities.isAdmin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 })
  }

  let payload: ModerationPayload = {}
  try {
    payload = (await request.json()) as ModerationPayload
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 })
  }

  if (!payload.post_id) {
    return NextResponse.json({ error: "post_id is required." }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (payload.status) {
    updates.status = payload.status
  }
  if (typeof payload.is_featured === "boolean") {
    updates.is_featured = payload.is_featured
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No moderation changes provided." }, { status: 400 })
  }

  const { data, error } = await admin
    .from("community_posts")
    .update(updates)
    .eq("id", payload.post_id)
    .select("id, status, is_featured, updated_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ post: data })
}
