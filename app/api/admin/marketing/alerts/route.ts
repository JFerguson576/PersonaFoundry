import { NextResponse } from "next/server"
import { createAdminClient, getAdminCapabilities } from "@/lib/admin"
import { getRequestAuth } from "@/lib/supabase/auth"

type UpdateAlertPayload = {
  id?: string
  status?: "open" | "acknowledged" | "resolved"
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

async function checkAdmin(request: Request, options?: { requireSuperuser?: boolean }) {
  const { user, errorMessage } = await getRequestAuth(request)
  if (!user) {
    return { error: NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 }), user: null, admin: null }
  }

  const capabilities = await getAdminCapabilities({ userId: user.id, email: user.email })
  const requireSuperuser = options?.requireSuperuser === true
  if (requireSuperuser ? !capabilities.isSuperuser : !capabilities.isAdmin) {
    return {
      error: NextResponse.json(
        { error: requireSuperuser ? "Superuser access required" : "Admin access required" },
        { status: 403 }
      ),
      user: null,
      admin: null,
    }
  }

  const admin = createAdminClient()
  if (!admin) {
    return { error: NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 }), user: null, admin: null }
  }

  return { error: null, user, admin }
}

export async function GET(request: Request) {
  const auth = await checkAdmin(request)
  if (auth.error) return auth.error

  const { data, error } = await auth.admin
    .from("mkt_alerts")
    .select(
      "id, alert_type, severity, message, related_entity_type, related_entity_id, status, metadata_json, created_by_email, resolved_by_email, resolved_at, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ alerts: data ?? [] })
}

export async function PATCH(request: Request) {
  const auth = await checkAdmin(request, { requireSuperuser: true })
  if (auth.error) return auth.error

  let payload: UpdateAlertPayload = {}
  try {
    payload = (await request.json()) as UpdateAlertPayload
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 })
  }

  const id = text(payload.id)
  const status = payload.status
  if (!id || !status) {
    return NextResponse.json({ error: "id and status are required." }, { status: 400 })
  }

  const updates: Record<string, unknown> = { status }
  if (status === "resolved") {
    updates.resolved_at = new Date().toISOString()
    updates.resolved_by_user_id = auth.user.id
    updates.resolved_by_email = auth.user.email ?? null
  } else {
    updates.resolved_at = null
    updates.resolved_by_user_id = null
    updates.resolved_by_email = null
  }

  const { data, error } = await auth.admin
    .from("mkt_alerts")
    .update(updates)
    .eq("id", id)
    .select(
      "id, alert_type, severity, message, related_entity_type, related_entity_id, status, metadata_json, created_by_email, resolved_by_email, resolved_at, created_at, updated_at"
    )
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ alert: data })
}
