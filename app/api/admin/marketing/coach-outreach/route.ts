import { NextResponse } from "next/server"
import { createAdminClient, getAdminCapabilities } from "@/lib/admin"
import { getRequestAuth } from "@/lib/supabase/auth"

type CoachLeadPayload = {
  id?: string
  full_name?: string
  business_name?: string
  email?: string
  country?: string
  segment?: string
  source?: string
  stage?: string
  next_action_at?: string | null
  notes?: string | null
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

async function checkAdmin(request: Request) {
  const { user, errorMessage } = await getRequestAuth(request)
  if (!user) {
    return { error: NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 }), user: null, admin: null }
  }

  const capabilities = await getAdminCapabilities({ userId: user.id, email: user.email })
  if (!capabilities.isAdmin) {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }), user: null, admin: null }
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

  const [{ data: leads, error: leadsError }, { data: templates, error: templatesError }, { data: touchpoints, error: touchpointsError }] =
    await Promise.all([
      auth.admin
        .from("mkt_coach_leads")
        .select("id, owner_email, full_name, business_name, email, country, segment, source, stage, next_action_at, notes, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(250),
      auth.admin
        .from("mkt_coach_templates")
        .select("id, template_name, segment, channel, subject, body, active, created_by_email, created_at, updated_at")
        .eq("active", true)
        .order("updated_at", { ascending: false })
        .limit(50),
      auth.admin
        .from("mkt_coach_touchpoints")
        .select("id, coach_lead_id, actor_email, channel, touch_type, outcome, note, occurred_at")
        .order("occurred_at", { ascending: false })
        .limit(200),
    ])

  if (leadsError) return NextResponse.json({ error: leadsError.message }, { status: 400 })
  if (templatesError) return NextResponse.json({ error: templatesError.message }, { status: 400 })
  if (touchpointsError) return NextResponse.json({ error: touchpointsError.message }, { status: 400 })

  return NextResponse.json({
    leads: leads ?? [],
    templates: templates ?? [],
    touchpoints: touchpoints ?? [],
  })
}

export async function POST(request: Request) {
  const auth = await checkAdmin(request)
  if (auth.error) return auth.error

  let payload: CoachLeadPayload = {}
  try {
    payload = (await request.json()) as CoachLeadPayload
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 })
  }

  const fullName = text(payload.full_name)
  const email = text(payload.email).toLowerCase()
  const segment = text(payload.segment) || "independent_coach"
  const source = text(payload.source) || "manual"
  const stage = text(payload.stage) || "identified"

  if (!fullName) {
    return NextResponse.json({ error: "Lead full name is required." }, { status: 400 })
  }
  if (!email) {
    return NextResponse.json({ error: "Lead email is required." }, { status: 400 })
  }

  const { data, error } = await auth.admin
    .from("mkt_coach_leads")
    .insert([
      {
        owner_user_id: auth.user.id,
        owner_email: auth.user.email ?? null,
        full_name: fullName,
        business_name: text(payload.business_name) || null,
        email,
        country: text(payload.country) || null,
        segment,
        source,
        stage,
        next_action_at: payload.next_action_at ? payload.next_action_at : null,
        notes: text(payload.notes) || null,
      },
    ])
    .select("id, owner_email, full_name, business_name, email, country, segment, source, stage, next_action_at, notes, created_at, updated_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ lead: data })
}

export async function PATCH(request: Request) {
  const auth = await checkAdmin(request)
  if (auth.error) return auth.error

  let payload: CoachLeadPayload = {}
  try {
    payload = (await request.json()) as CoachLeadPayload
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 })
  }

  const id = text(payload.id)
  if (!id) {
    return NextResponse.json({ error: "Lead id is required." }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (payload.full_name !== undefined) updates.full_name = text(payload.full_name)
  if (payload.business_name !== undefined) updates.business_name = text(payload.business_name) || null
  if (payload.email !== undefined) updates.email = text(payload.email).toLowerCase() || null
  if (payload.country !== undefined) updates.country = text(payload.country) || null
  if (payload.segment !== undefined) updates.segment = text(payload.segment) || "independent_coach"
  if (payload.source !== undefined) updates.source = text(payload.source) || "manual"
  if (payload.stage !== undefined) updates.stage = text(payload.stage) || "identified"
  if (payload.next_action_at !== undefined) updates.next_action_at = payload.next_action_at || null
  if (payload.notes !== undefined) updates.notes = text(payload.notes) || null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided." }, { status: 400 })
  }

  const { data, error } = await auth.admin
    .from("mkt_coach_leads")
    .update(updates)
    .eq("id", id)
    .select("id, owner_email, full_name, business_name, email, country, segment, source, stage, next_action_at, notes, created_at, updated_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ lead: data })
}

