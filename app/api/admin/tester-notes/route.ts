import { NextResponse } from "next/server"
import { createAdminClient, getAdminCapabilities } from "@/lib/admin"
import { getRequestAuth } from "@/lib/supabase/auth"
import { logUsageEvent } from "@/lib/telemetry"

type AdminTesterNotePatchPayload = {
  id?: string
  status?: "open" | "in_review" | "resolved"
  severity?: "low" | "medium" | "high"
  admin_note?: string | null
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export async function GET(request: Request) {
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

  const url = new URL(request.url)
  const status = normalizeText(url.searchParams.get("status"))
  const module = normalizeText(url.searchParams.get("module"))

  let query = admin
    .from("tester_feedback_notes")
    .select(
      "id, user_id, user_email, note_type, severity, status, message, module, route_path, full_url, section_anchor, page_title, viewport_width, viewport_height, browser_tz, admin_note, reviewed_by_email, reviewed_at, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(300)

  if (status === "open" || status === "in_review" || status === "resolved") {
    query = query.eq("status", status)
  }
  if (module) {
    query = query.eq("module", module)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ notes: data ?? [] })
}

export async function PATCH(request: Request) {
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

  let payload: AdminTesterNotePatchPayload = {}
  try {
    payload = (await request.json()) as AdminTesterNotePatchPayload
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 })
  }

  const id = normalizeText(payload.id)
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 })
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    reviewed_at: new Date().toISOString(),
    reviewed_by_user_id: user.id,
    reviewed_by_email: user.email ?? null,
  }

  if (payload.status === "open" || payload.status === "in_review" || payload.status === "resolved") {
    updates.status = payload.status
  }
  if (payload.severity === "low" || payload.severity === "medium" || payload.severity === "high") {
    updates.severity = payload.severity
  }
  if (typeof payload.admin_note === "string") {
    updates.admin_note = payload.admin_note.trim() || null
  }

  const { data, error } = await admin
    .from("tester_feedback_notes")
    .update(updates)
    .eq("id", id)
    .select(
      "id, user_id, user_email, note_type, severity, status, message, module, route_path, full_url, section_anchor, page_title, viewport_width, viewport_height, browser_tz, admin_note, reviewed_by_email, reviewed_at, created_at, updated_at"
    )
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await logUsageEvent(admin, {
    userId: user.id,
    module: "admin",
    eventType: "tester_feedback_note_reviewed",
    metadata: {
      note_id: id,
      status: updates.status ?? null,
      severity: updates.severity ?? null,
    },
  })

  return NextResponse.json({ note: data })
}

