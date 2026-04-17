import { NextResponse } from "next/server"
import { createAdminClient, getAdminCapabilities } from "@/lib/admin"
import { getRequestAuth } from "@/lib/supabase/auth"

type InboxStatePayload = {
  candidate_id?: string
  reviewed_at?: string | null
  snoozed_until?: string | null
}

function isMissingTableError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false
  if (error.code === "42P01") return true
  return (error.message || "").toLowerCase().includes("admin_candidate_health_inbox")
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
    .from("admin_candidate_health_inbox")
    .select("candidate_id, reviewed_at, snoozed_until, updated_by_user_id, updated_by_email, updated_at")
    .order("updated_at", { ascending: false })
    .limit(500)

  if (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json({ states: [], table_missing: true })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ states: data ?? [], table_missing: false })
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

  let payload: InboxStatePayload = {}
  try {
    payload = (await request.json()) as InboxStatePayload
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 })
  }

  const candidateId = (payload.candidate_id || "").trim()
  if (!candidateId) {
    return NextResponse.json({ error: "candidate_id is required." }, { status: 400 })
  }

  const reviewedAt = payload.reviewed_at ? new Date(payload.reviewed_at).toISOString() : null
  const snoozedUntil = payload.snoozed_until ? new Date(payload.snoozed_until).toISOString() : null

  const { data, error } = await admin
    .from("admin_candidate_health_inbox")
    .upsert(
      [
        {
          candidate_id: candidateId,
          reviewed_at: reviewedAt,
          snoozed_until: snoozedUntil,
          updated_by_user_id: user.id,
          updated_by_email: user.email ?? null,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "candidate_id" }
    )
    .select("candidate_id, reviewed_at, snoozed_until, updated_by_user_id, updated_by_email, updated_at")
    .single()

  if (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json(
        { error: "Missing table admin_candidate_health_inbox. Run supabase/admin_candidate_health_inbox.sql first." },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ state: data })
}

export async function DELETE(request: Request) {
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

  const url = new URL(request.url)
  const candidateId = (url.searchParams.get("candidate_id") || "").trim()
  if (!candidateId) {
    return NextResponse.json({ error: "candidate_id is required." }, { status: 400 })
  }

  const { error } = await admin
    .from("admin_candidate_health_inbox")
    .delete()
    .eq("candidate_id", candidateId)

  if (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json(
        { error: "Missing table admin_candidate_health_inbox. Run supabase/admin_candidate_health_inbox.sql first." },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

