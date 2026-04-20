import { NextResponse } from "next/server"
import { createAdminClient, getAdminCapabilities } from "@/lib/admin"
import { getRequestAuth } from "@/lib/supabase/auth"

function startOfWeekIsoDate(date: Date) {
  const copy = new Date(date)
  const day = copy.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setUTCDate(copy.getUTCDate() + diff)
  copy.setUTCHours(0, 0, 0, 0)
  return copy.toISOString().slice(0, 10)
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
    .from("mkt_budget_snapshots")
    .select(
      "id, week_start, collected_cash_7d, cash_on_hand, reserve_floor_amount, safe_budget_weekly, safe_budget_daily, reserve_status, formula_inputs, computed_by_email, computed_at"
    )
    .order("computed_at", { ascending: false })
    .limit(24)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({
    latest: data?.[0] ?? null,
    snapshots: data ?? [],
  })
}

export async function POST(request: Request) {
  const { user, errorMessage } = await getRequestAuth(request)
  if (!user) {
    return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
  }

  const capabilities = await getAdminCapabilities({ userId: user.id, email: user.email })
  if (!capabilities.isSuperuser) {
    return NextResponse.json({ error: "Superuser access required for budget recompute" }, { status: 403 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 })
  }

  const [{ data: policy, error: policyError }, { data: ledgerRows, error: ledgerError }] = await Promise.all([
    admin
      .from("mkt_policy_settings")
      .select("reserve_floor_amount, reinvestment_rate_pct, max_weekly_spend, payback_target_days, automation_mode")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("mkt_cash_ledger")
      .select("amount, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(500),
  ])

  if (policyError) {
    return NextResponse.json({ error: policyError.message }, { status: 400 })
  }
  if (ledgerError) {
    return NextResponse.json({ error: ledgerError.message }, { status: 400 })
  }
  if (!policy) {
    return NextResponse.json({ error: "Set policy first before recomputing budget." }, { status: 400 })
  }

  const now = new Date()
  const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000
  const cashOnHand = (ledgerRows ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0)
  const collectedCash7d = (ledgerRows ?? [])
    .filter((row) => {
      const occurred = row.occurred_at ? new Date(row.occurred_at).getTime() : 0
      return occurred >= sevenDaysAgo
    })
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0)

  const reserveFloor = Number(policy.reserve_floor_amount ?? 0)
  const reinvestmentRate = Math.min(1, Math.max(0, Number(policy.reinvestment_rate_pct ?? 0)))
  const maxWeeklySpend = Math.max(0, Number(policy.max_weekly_spend ?? 0))

  const byRevenue = Math.max(0, collectedCash7d * reinvestmentRate)
  const byReserve = Math.max(0, cashOnHand - reserveFloor)
  const safeWeeklyBudget = Math.max(0, Math.min(byRevenue, maxWeeklySpend || byRevenue, byReserve))
  const safeDailyBudget = safeWeeklyBudget / 7

  const reserveStatus =
    cashOnHand <= reserveFloor
      ? "critical"
      : cashOnHand <= reserveFloor * 1.15
      ? "watch"
      : "healthy"

  const weekStart = startOfWeekIsoDate(now)

  const { data: inserted, error: insertError } = await admin
    .from("mkt_budget_snapshots")
    .insert([
      {
        computed_by_user_id: user.id,
        computed_by_email: user.email ?? null,
        week_start: weekStart,
        collected_cash_7d: Number(collectedCash7d.toFixed(2)),
        cash_on_hand: Number(cashOnHand.toFixed(2)),
        reserve_floor_amount: Number(reserveFloor.toFixed(2)),
        safe_budget_weekly: Number(safeWeeklyBudget.toFixed(2)),
        safe_budget_daily: Number(safeDailyBudget.toFixed(2)),
        reserve_status: reserveStatus,
        formula_inputs: {
          reinvestment_rate_pct: reinvestmentRate,
          max_weekly_spend: maxWeeklySpend,
          by_revenue: Number(byRevenue.toFixed(2)),
          by_reserve: Number(byReserve.toFixed(2)),
          payback_target_days: Number(policy.payback_target_days ?? 120),
          automation_mode: policy.automation_mode ?? "manual",
        },
      },
    ])
    .select(
      "id, week_start, collected_cash_7d, cash_on_hand, reserve_floor_amount, safe_budget_weekly, safe_budget_daily, reserve_status, formula_inputs, computed_by_email, computed_at"
    )
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 })
  }

  return NextResponse.json({
    snapshot: inserted,
  })
}
