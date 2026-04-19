import { NextResponse } from "next/server"
import { createRouteClient } from "@/lib/supabase/route"
import { getRequestAuth } from "@/lib/supabase/auth"
import { logUsageEvent } from "@/lib/telemetry"

type TesterNotePayload = {
  note_type?: "bug" | "improvement" | "question"
  severity?: "low" | "medium" | "high"
  message?: string
  module?: string
  route_path?: string
  full_url?: string | null
  section_anchor?: string | null
  page_title?: string | null
  viewport_width?: number | null
  viewport_height?: number | null
  browser_tz?: string | null
  metadata?: Record<string, unknown>
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export async function GET(request: Request) {
  const { user, accessToken, errorMessage } = await getRequestAuth(request)
  if (!user || !accessToken) {
    return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
  }

  const supabase = createRouteClient(accessToken)
  const { data, error } = await supabase
    .from("tester_feedback_notes")
    .select("id, note_type, severity, status, message, module, route_path, section_anchor, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ notes: data ?? [] })
}

export async function POST(request: Request) {
  const { user, accessToken, errorMessage } = await getRequestAuth(request)
  if (!user || !accessToken) {
    return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
  }

  let payload: TesterNotePayload = {}
  try {
    payload = (await request.json()) as TesterNotePayload
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 })
  }

  const message = asText(payload.message)
  if (message.length < 6) {
    return NextResponse.json({ error: "Please enter more detail (at least 6 characters)." }, { status: 400 })
  }

  const noteType = payload.note_type === "bug" || payload.note_type === "question" ? payload.note_type : "improvement"
  const severity = payload.severity === "low" || payload.severity === "high" ? payload.severity : "medium"
  const moduleKey = asText(payload.module) || "platform"
  const routePath = asText(payload.route_path) || "/"

  const supabase = createRouteClient(accessToken)

  const insertPayload = {
    user_id: user.id,
    user_email: user.email ?? null,
    note_type: noteType,
    severity,
    message,
    module: moduleKey,
    route_path: routePath,
    full_url: asText(payload.full_url) || null,
    section_anchor: asText(payload.section_anchor) || null,
    page_title: asText(payload.page_title) || null,
    viewport_width: Number.isFinite(payload.viewport_width) ? Number(payload.viewport_width) : null,
    viewport_height: Number.isFinite(payload.viewport_height) ? Number(payload.viewport_height) : null,
    browser_tz: asText(payload.browser_tz) || null,
    metadata: payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {},
  }

  const { data, error } = await supabase
    .from("tester_feedback_notes")
    .insert([insertPayload])
    .select("id, note_type, severity, status, message, module, route_path, section_anchor, created_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await logUsageEvent(supabase, {
    userId: user.id,
    module: "platform",
    eventType: "tester_feedback_note_created",
    metadata: {
      note_id: data.id,
      note_type: noteType,
      severity,
      module: moduleKey,
      route_path: routePath,
      section_anchor: insertPayload.section_anchor,
    },
  })

  return NextResponse.json({ note: data })
}
