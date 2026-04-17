import { NextResponse } from "next/server"
import { createAdminClient, getAdminCapabilities } from "@/lib/admin"
import { getRequestAuth } from "@/lib/supabase/auth"
import { logUsageEvent } from "@/lib/telemetry"

type NotebookPayload = {
  title?: string
  note?: string
  status?: "open" | "in_progress" | "done"
  id?: string
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export async function GET(request: Request) {
  const { user, errorMessage } = await getRequestAuth(request)
  if (!user) {
    return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
  }

  const capabilities = await getAdminCapabilities({ userId: user.id, email: user.email })
  if (!capabilities.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 })
  }

  const { data, error } = await admin
    .from("admin_notebook_entries")
    .select("id, title, note, status, author_email, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ entries: data ?? [] })
}

export async function POST(request: Request) {
  const { user, errorMessage } = await getRequestAuth(request)
  if (!user) {
    return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
  }

  const capabilities = await getAdminCapabilities({ userId: user.id, email: user.email })
  if (!capabilities.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 })
  }

  let payload: NotebookPayload = {}
  try {
    payload = (await request.json()) as NotebookPayload
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 })
  }

  const note = text(payload.note)
  const title = text(payload.title)
  const status = payload.status === "in_progress" || payload.status === "done" ? payload.status : "open"

  if (!note) {
    return NextResponse.json({ error: "Note is required." }, { status: 400 })
  }

  const { data, error } = await admin
    .from("admin_notebook_entries")
    .insert([
      {
        author_user_id: user.id,
        author_email: user.email ?? null,
        title: title || null,
        note,
        status,
      },
    ])
    .select("id, title, note, status, author_email, created_at, updated_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await logUsageEvent(admin, {
    userId: user.id,
    module: "admin",
    eventType: "admin_notebook_entry_created",
    metadata: {
      note_length: note.length,
      title: title || null,
      status,
    },
  })

  return NextResponse.json({ entry: data })
}

export async function PATCH(request: Request) {
  const { user, errorMessage } = await getRequestAuth(request)
  if (!user) {
    return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
  }

  const capabilities = await getAdminCapabilities({ userId: user.id, email: user.email })
  if (!capabilities.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 })
  }

  let payload: NotebookPayload = {}
  try {
    payload = (await request.json()) as NotebookPayload
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 })
  }

  const id = text(payload.id)
  if (!id) {
    return NextResponse.json({ error: "Notebook entry id is required." }, { status: 400 })
  }

  const status = payload.status === "in_progress" || payload.status === "done" ? payload.status : "open"

  const { data, error } = await admin
    .from("admin_notebook_entries")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, title, note, status, author_email, created_at, updated_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await logUsageEvent(admin, {
    userId: user.id,
    module: "admin",
    eventType: "admin_notebook_entry_updated",
    metadata: {
      notebook_entry_id: id,
      status,
    },
  })

  return NextResponse.json({ entry: data })
}
