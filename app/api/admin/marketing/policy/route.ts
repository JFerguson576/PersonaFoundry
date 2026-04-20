import { NextResponse } from "next/server"
import { createAdminClient, getAdminCapabilities } from "@/lib/admin"
import { getRequestAuth } from "@/lib/supabase/auth"

type PolicyPayload = {
  reserve_floor_amount?: number
  reinvestment_rate_pct?: number
  max_weekly_spend?: number
  payback_target_days?: number
  automation_mode?: "manual" | "approval_gated"
}

function numeric(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
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
    .from("mkt_policy_settings")
    .select(
      "id, reserve_floor_amount, reinvestment_rate_pct, max_weekly_spend, payback_target_days, automation_mode, updated_by_email, updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({
    policy: data ?? {
      id: null,
      reserve_floor_amount: 0,
      reinvestment_rate_pct: 0.3,
      max_weekly_spend: 0,
      payback_target_days: 120,
      automation_mode: "manual",
      updated_by_email: null,
      updated_at: null,
    },
  })
}

export async function POST(request: Request) {
  const { user, errorMessage } = await getRequestAuth(request)
  if (!user) {
    return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
  }

  const capabilities = await getAdminCapabilities({ userId: user.id, email: user.email })
  if (!capabilities.isSuperuser) {
    return NextResponse.json({ error: "Superuser access required for policy changes" }, { status: 403 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 })
  }

  let payload: PolicyPayload
  try {
    payload = (await request.json()) as PolicyPayload
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 })
  }

  const reserveFloor = Math.max(0, numeric(payload.reserve_floor_amount, 0))
  const reinvestmentRate = Math.min(1, Math.max(0, numeric(payload.reinvestment_rate_pct, 0.3)))
  const maxWeeklySpend = Math.max(0, numeric(payload.max_weekly_spend, 0))
  const paybackTargetDays = Math.max(7, Math.min(365, Math.round(numeric(payload.payback_target_days, 120))))
  const automationMode = payload.automation_mode === "approval_gated" ? "approval_gated" : "manual"

  const { data: existing, error: existingError } = await admin
    .from("mkt_policy_settings")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 400 })
  }

  let saved
  if (existing?.id) {
    const { data, error } = await admin
      .from("mkt_policy_settings")
      .update({
        reserve_floor_amount: reserveFloor,
        reinvestment_rate_pct: reinvestmentRate,
        max_weekly_spend: maxWeeklySpend,
        payback_target_days: paybackTargetDays,
        automation_mode: automationMode,
        updated_by_user_id: user.id,
        updated_by_email: user.email ?? null,
      })
      .eq("id", existing.id)
      .select(
        "id, reserve_floor_amount, reinvestment_rate_pct, max_weekly_spend, payback_target_days, automation_mode, updated_by_email, updated_at"
      )
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    saved = data
  } else {
    const { data, error } = await admin
      .from("mkt_policy_settings")
      .insert([
        {
          reserve_floor_amount: reserveFloor,
          reinvestment_rate_pct: reinvestmentRate,
          max_weekly_spend: maxWeeklySpend,
          payback_target_days: paybackTargetDays,
          automation_mode: automationMode,
          updated_by_user_id: user.id,
          updated_by_email: user.email ?? null,
        },
      ])
      .select(
        "id, reserve_floor_amount, reinvestment_rate_pct, max_weekly_spend, payback_target_days, automation_mode, updated_by_email, updated_at"
      )
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    saved = data
  }

  return NextResponse.json({ policy: saved })
}
