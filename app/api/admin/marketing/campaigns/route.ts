import { NextResponse } from "next/server"
import { createAdminClient, getAdminCapabilities } from "@/lib/admin"
import { getRequestAuth } from "@/lib/supabase/auth"

type CampaignPayload = {
  id?: string
  name?: string
  channel?: string
  status?: string
  offer_label?: string
  landing_url?: string
  daily_budget?: number
  targeting_notes?: string
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function numeric(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
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

  const { data, error } = await auth.admin
    .from("mkt_campaigns")
    .select("id, name, channel, status, offer_label, landing_url, daily_budget, targeting_notes, owner_email, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ campaigns: data ?? [] })
}

export async function POST(request: Request) {
  const auth = await checkAdmin(request)
  if (auth.error) return auth.error

  let payload: CampaignPayload = {}
  try {
    payload = (await request.json()) as CampaignPayload
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 })
  }

  const name = text(payload.name)
  if (!name) {
    return NextResponse.json({ error: "Campaign name is required." }, { status: 400 })
  }

  const status = text(payload.status) || "draft"
  const channel = text(payload.channel) || "manual"
  const offerLabel = text(payload.offer_label) || null
  const landingUrl = text(payload.landing_url) || null
  const targetingNotes = text(payload.targeting_notes) || null
  const dailyBudget = Math.max(0, numeric(payload.daily_budget, 0))

  const { data, error } = await auth.admin
    .from("mkt_campaigns")
    .insert([
      {
        owner_user_id: auth.user.id,
        owner_email: auth.user.email ?? null,
        name,
        channel,
        status,
        offer_label: offerLabel,
        landing_url: landingUrl,
        daily_budget: dailyBudget,
        targeting_notes: targetingNotes,
      },
    ])
    .select("id, name, channel, status, offer_label, landing_url, daily_budget, targeting_notes, owner_email, created_at, updated_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ campaign: data })
}

export async function PATCH(request: Request) {
  const auth = await checkAdmin(request)
  if (auth.error) return auth.error

  let payload: CampaignPayload = {}
  try {
    payload = (await request.json()) as CampaignPayload
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 })
  }

  const id = text(payload.id)
  if (!id) {
    return NextResponse.json({ error: "Campaign id is required." }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (payload.name !== undefined) updates.name = text(payload.name)
  if (payload.channel !== undefined) updates.channel = text(payload.channel) || "manual"
  if (payload.status !== undefined) updates.status = text(payload.status) || "draft"
  if (payload.offer_label !== undefined) updates.offer_label = text(payload.offer_label) || null
  if (payload.landing_url !== undefined) updates.landing_url = text(payload.landing_url) || null
  if (payload.targeting_notes !== undefined) updates.targeting_notes = text(payload.targeting_notes) || null
  if (payload.daily_budget !== undefined) updates.daily_budget = Math.max(0, numeric(payload.daily_budget, 0))

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided." }, { status: 400 })
  }

  const { data, error } = await auth.admin
    .from("mkt_campaigns")
    .update(updates)
    .eq("id", id)
    .select("id, name, channel, status, offer_label, landing_url, daily_budget, targeting_notes, owner_email, created_at, updated_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ campaign: data })
}
