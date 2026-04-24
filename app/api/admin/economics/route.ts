import { NextResponse } from "next/server"
import { createAdminClient, getAdminCapabilities } from "@/lib/admin"
import { getRequestAuth } from "@/lib/supabase/auth"

type BillingStatus = "trial" | "active" | "past_due" | "cancelled"
type PlanCode = string

type SubscriptionPayload = {
  user_id?: string
  email?: string
  plan_code?: PlanCode
  billing_status?: BillingStatus
  monthly_subscription_usd?: number
  monthly_api_budget_usd?: number | null
  notes?: string | null
}

type CostBucket = {
  api_cost_usd: number
  openai_api_cost_usd: number
  codex_api_cost_usd: number
}

type TrendPoint = {
  label: string
  revenue_usd: number
  api_cost_usd: number
  openai_api_cost_usd: number
  codex_api_cost_usd: number
  margin_usd: number
}

type RevenueLinePoint = {
  label: string
  revenue_usd: number
}

type RevenueLineSeries = {
  key: string
  label: string
  monthly_revenue_usd: number
  daily: RevenueLinePoint[]
  weekly: RevenueLinePoint[]
  monthly: RevenueLinePoint[]
}

const DEMO_WEEKLY_REVENUE_USD = 100
const DAYS_PER_MONTH = 30.4375
const WEEKS_PER_YEAR = 52
const MONTHS_PER_YEAR = 12

const MODULE_LABELS: Record<string, string> = {
  career_intelligence: "Career Intelligence",
  teamsync: "TeamSync",
  persona_foundry: "Persona Foundry",
  platform: "Platform",
}

const TIER_LABELS: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  premium: "Premium",
  practitioner: "Practitioner",
  recruiter: "Recruiter",
  enterprise: "Enterprise",
  custom: "Custom",
}

function toNumber(value: unknown) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function resolveProvider(provider: unknown, model: unknown) {
  const providerText = normalizeText(provider).toLowerCase()
  if (providerText === "codex") return "codex"
  if (providerText === "openai") return "openai"

  const modelText = normalizeText(model).toLowerCase()
  if (modelText.includes("codex")) return "codex"
  return "openai"
}

function inferModuleKey(planCode: string, notes: string | null) {
  const combined = `${normalizeText(planCode)} ${normalizeText(notes)}`.toLowerCase()
  if (combined.includes("teamsync") || combined.includes("team_sync")) return "teamsync"
  if (combined.includes("persona") || combined.includes("foundry")) return "persona_foundry"
  if (combined.includes("career") || combined.includes("candidate")) return "career_intelligence"
  return "platform"
}

function inferTierKey(planCode: string, notes: string | null) {
  const combined = `${normalizeText(planCode)} ${normalizeText(notes)}`.toLowerCase()
  if (combined.includes("practitioner")) return "practitioner"
  if (combined.includes("recruiter")) return "recruiter"
  if (combined.includes("enterprise")) return "enterprise"
  if (combined.includes("premium")) return "premium"
  if (combined.includes("starter")) return "starter"
  if (combined.includes("pro")) return "pro"
  if (combined.includes("free")) return "free"
  return "custom"
}

function monthWindow() {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
  return { startIso: start.toISOString(), monthLabel: start.toLocaleString("en-US", { month: "long", year: "numeric" }) }
}

function yearWindowStartIso() {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
  return start.toISOString()
}

function dayKeyFromIso(value: string) {
  return value.slice(0, 10)
}

function bucketForDay(dayBuckets: Map<string, CostBucket>, key: string) {
  const existing = dayBuckets.get(key)
  if (existing) return existing
  const bucket: CostBucket = {
    api_cost_usd: 0,
    openai_api_cost_usd: 0,
    codex_api_cost_usd: 0,
  }
  dayBuckets.set(key, bucket)
  return bucket
}

function toDayStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0))
}

function sumCostsForRange(dayBuckets: Map<string, CostBucket>, rangeStart: Date, rangeEnd: Date) {
  const totals: CostBucket = {
    api_cost_usd: 0,
    openai_api_cost_usd: 0,
    codex_api_cost_usd: 0,
  }
  const cursor = toDayStart(rangeStart)
  const end = toDayStart(rangeEnd)
  while (cursor.getTime() <= end.getTime()) {
    const key = dayKeyFromIso(cursor.toISOString())
    const bucket = dayBuckets.get(key)
    if (bucket) {
      totals.api_cost_usd += bucket.api_cost_usd
      totals.openai_api_cost_usd += bucket.openai_api_cost_usd
      totals.codex_api_cost_usd += bucket.codex_api_cost_usd
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return totals
}

function buildTrendSeries(dayBuckets: Map<string, CostBucket>, monthlyRevenueUsd: number, mode: "daily" | "weekly" | "monthly"): TrendPoint[] {
  const now = new Date()
  if (mode === "daily") {
    return Array.from({ length: 14 }, (_, index) => {
      const offset = 13 - index
      const day = toDayStart(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset, 0, 0, 0, 0)))
      const totals = sumCostsForRange(dayBuckets, day, day)
      const revenue = monthlyRevenueUsd / DAYS_PER_MONTH
      return {
        label: day.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        revenue_usd: Number(revenue.toFixed(2)),
        api_cost_usd: Number(totals.api_cost_usd.toFixed(4)),
        openai_api_cost_usd: Number(totals.openai_api_cost_usd.toFixed(4)),
        codex_api_cost_usd: Number(totals.codex_api_cost_usd.toFixed(4)),
        margin_usd: Number((revenue - totals.api_cost_usd).toFixed(4)),
      }
    })
  }

  if (mode === "weekly") {
    return Array.from({ length: 8 }, (_, index) => {
      const offset = 7 - index
      const end = toDayStart(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset * 7, 0, 0, 0, 0)))
      const start = toDayStart(new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - 6, 0, 0, 0, 0)))
      const totals = sumCostsForRange(dayBuckets, start, end)
      const revenue = (monthlyRevenueUsd * 12) / 52
      return {
        label: `Wk ${start.toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}`,
        revenue_usd: Number(revenue.toFixed(2)),
        api_cost_usd: Number(totals.api_cost_usd.toFixed(4)),
        openai_api_cost_usd: Number(totals.openai_api_cost_usd.toFixed(4)),
        codex_api_cost_usd: Number(totals.codex_api_cost_usd.toFixed(4)),
        margin_usd: Number((revenue - totals.api_cost_usd).toFixed(4)),
      }
    })
  }

  return Array.from({ length: 12 }, (_, index) => {
    const offset = 11 - index
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1, 0, 0, 0, 0))
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset + 1, 0, 0, 0, 0, 0))
    const totals = sumCostsForRange(dayBuckets, start, end)
    const revenue = monthlyRevenueUsd
    return {
      label: start.toLocaleDateString("en-US", { month: "short" }),
      revenue_usd: Number(revenue.toFixed(2)),
      api_cost_usd: Number(totals.api_cost_usd.toFixed(4)),
      openai_api_cost_usd: Number(totals.openai_api_cost_usd.toFixed(4)),
      codex_api_cost_usd: Number(totals.codex_api_cost_usd.toFixed(4)),
      margin_usd: Number((revenue - totals.api_cost_usd).toFixed(4)),
    }
  })
}

function buildRevenueSeries(monthlyRevenueUsd: number, mode: "daily" | "weekly" | "monthly"): RevenueLinePoint[] {
  const base = buildTrendSeries(new Map<string, CostBucket>(), monthlyRevenueUsd, mode)
  return base.map((point) => ({
    label: point.label,
    revenue_usd: point.revenue_usd,
  }))
}

function buildRevenueLineSeries(
  monthlyTotalsByKey: Map<string, number>,
  labels: Record<string, string>
): RevenueLineSeries[] {
  return [...monthlyTotalsByKey.entries()]
    .filter(([, monthlyRevenue]) => monthlyRevenue > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key, monthlyRevenue]) => ({
      key,
      label: labels[key] || key.replaceAll("_", " "),
      monthly_revenue_usd: Number(monthlyRevenue.toFixed(2)),
      daily: buildRevenueSeries(monthlyRevenue, "daily"),
      weekly: buildRevenueSeries(monthlyRevenue, "weekly"),
      monthly: buildRevenueSeries(monthlyRevenue, "monthly"),
    }))
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

  const { startIso, monthLabel } = monthWindow()
  const trendStartIso = yearWindowStartIso()
  const [apiLogsResult, subscriptionsResult, usersResponse] = await Promise.all([
    admin
      .from("api_usage_logs")
      .select("user_id, total_tokens, estimated_cost_usd, created_at, provider, model")
      .gte("created_at", trendStartIso)
      .order("created_at", { ascending: false })
      .limit(20000),
    admin
      .from("user_subscriptions")
      .select("user_id, plan_code, billing_status, monthly_subscription_usd, monthly_api_budget_usd, notes, updated_at"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])

  if (apiLogsResult.error) {
    return NextResponse.json({ error: apiLogsResult.error.message }, { status: 400 })
  }
  if (subscriptionsResult.error) {
    return NextResponse.json({ error: subscriptionsResult.error.message }, { status: 400 })
  }

  const users = usersResponse.data?.users ?? []
  const emailByUserId = new Map(users.map((item) => [item.id, item.email ?? null]))
  const nameByUserId = new Map(
    users.map((item) => {
      const metadata = (item.user_metadata ?? {}) as Record<string, unknown>
      const displayName =
        typeof metadata.full_name === "string"
          ? metadata.full_name
          : typeof metadata.name === "string"
            ? metadata.name
            : item.email ?? item.id
      return [item.id, displayName]
    })
  )

  const subscriptionByUserId = new Map(
    (subscriptionsResult.data ?? []).map((row) => [
      row.user_id,
      {
        plan_code: row.plan_code as PlanCode,
        billing_status: row.billing_status as BillingStatus,
        monthly_subscription_usd: toNumber(row.monthly_subscription_usd),
        monthly_api_budget_usd: row.monthly_api_budget_usd === null ? null : toNumber(row.monthly_api_budget_usd),
        notes: row.notes as string | null,
        updated_at: row.updated_at as string | null,
      },
    ])
  )

  const costByUserId = new Map<
    string,
    {
      api_requests: number
      total_tokens: number
      api_cost_usd: number
      openai_api_cost_usd: number
      codex_api_cost_usd: number
      last_activity_at: string | null
    }
  >()
  const costByDay = new Map<string, CostBucket>()

  for (const log of apiLogsResult.data ?? []) {
    if (!log.created_at) continue
    const provider = resolveProvider((log as Record<string, unknown>).provider, (log as Record<string, unknown>).model)
    const estimatedCost = Number(log.estimated_cost_usd ?? 0)
    const dayKey = dayKeyFromIso(log.created_at)
    const dayBucket = bucketForDay(costByDay, dayKey)
    dayBucket.api_cost_usd += estimatedCost
    if (provider === "codex") {
      dayBucket.codex_api_cost_usd += estimatedCost
    } else {
      dayBucket.openai_api_cost_usd += estimatedCost
    }

    if (!log.user_id) continue
    if (new Date(log.created_at).getTime() < new Date(startIso).getTime()) continue

    const current = costByUserId.get(log.user_id) ?? {
      api_requests: 0,
      total_tokens: 0,
      api_cost_usd: 0,
      openai_api_cost_usd: 0,
      codex_api_cost_usd: 0,
      last_activity_at: null,
    }
    current.api_requests += 1
    current.total_tokens += log.total_tokens ?? 0
    current.api_cost_usd += estimatedCost
    if (provider === "codex") {
      current.codex_api_cost_usd += estimatedCost
    } else {
      current.openai_api_cost_usd += estimatedCost
    }

    if (!current.last_activity_at || new Date(log.created_at).getTime() > new Date(current.last_activity_at).getTime()) {
      current.last_activity_at = log.created_at
    }
    costByUserId.set(log.user_id, current)
  }

  const allUserIds = new Set<string>([...subscriptionByUserId.keys(), ...costByUserId.keys()])
  const moduleRevenueMonthly = new Map<string, number>()
  const tierRevenueMonthly = new Map<string, number>()

  const rows = [...allUserIds].map((userId) => {
    const subscription = subscriptionByUserId.get(userId) ?? {
      plan_code: "free" as PlanCode,
      billing_status: "active" as BillingStatus,
      monthly_subscription_usd: 0,
      monthly_api_budget_usd: null,
      notes: null,
      updated_at: null,
    }
    const usage = costByUserId.get(userId) ?? {
      api_requests: 0,
      total_tokens: 0,
      api_cost_usd: 0,
      openai_api_cost_usd: 0,
      codex_api_cost_usd: 0,
      last_activity_at: null,
    }
    const seededMonthlyRevenueUsd = subscription.monthly_subscription_usd > 0
      ? subscription.monthly_subscription_usd
      : (DEMO_WEEKLY_REVENUE_USD * WEEKS_PER_YEAR) / MONTHS_PER_YEAR
    const revenue = seededMonthlyRevenueUsd
    const moduleKey = inferModuleKey(subscription.plan_code, subscription.notes)
    const tierKey = inferTierKey(subscription.plan_code, subscription.notes)
    moduleRevenueMonthly.set(moduleKey, (moduleRevenueMonthly.get(moduleKey) ?? 0) + revenue)
    tierRevenueMonthly.set(tierKey, (tierRevenueMonthly.get(tierKey) ?? 0) + revenue)
    const margin = revenue - usage.api_cost_usd
    const budget = subscription.monthly_api_budget_usd ?? revenue
    const budgetStatus = budget > 0 ? (usage.api_cost_usd > budget ? "over_budget" : usage.api_cost_usd > budget * 0.8 ? "watch" : "within") : "unbounded"
    const profitability = margin >= 0 ? "positive" : "negative"
    return {
      user_id: userId,
      user_email: emailByUserId.get(userId) ?? null,
      user_name: nameByUserId.get(userId) ?? emailByUserId.get(userId) ?? userId,
      plan_code: subscription.plan_code,
      module_key: moduleKey,
      tier_key: tierKey,
      billing_status: subscription.billing_status,
      monthly_subscription_usd: Number(revenue.toFixed(2)),
      monthly_api_budget_usd: subscription.monthly_api_budget_usd === null ? null : Number(subscription.monthly_api_budget_usd.toFixed(2)),
      monthly_api_cost_usd: Number(usage.api_cost_usd.toFixed(4)),
      monthly_openai_api_cost_usd: Number(usage.openai_api_cost_usd.toFixed(4)),
      monthly_codex_api_cost_usd: Number(usage.codex_api_cost_usd.toFixed(4)),
      monthly_api_requests: usage.api_requests,
      monthly_tokens: usage.total_tokens,
      monthly_margin_usd: Number(margin.toFixed(4)),
      budget_status: budgetStatus,
      profitability,
      notes: subscription.notes,
      subscription_updated_at: subscription.updated_at,
      last_activity_at: usage.last_activity_at,
    }
  })
    .sort((a, b) => a.monthly_margin_usd - b.monthly_margin_usd)

  const summary = rows.reduce(
    (acc, row) => {
      acc.total_revenue_usd += row.monthly_subscription_usd
      acc.total_api_cost_usd += row.monthly_api_cost_usd
      acc.total_openai_api_cost_usd += row.monthly_openai_api_cost_usd
      acc.total_codex_api_cost_usd += row.monthly_codex_api_cost_usd
      acc.total_margin_usd += row.monthly_margin_usd
      if (row.profitability === "negative") acc.unprofitable_users += 1
      if (row.budget_status === "over_budget") acc.over_budget_users += 1
      return acc
    },
    {
      users: rows.length,
      total_revenue_usd: 0,
      total_api_cost_usd: 0,
      total_openai_api_cost_usd: 0,
      total_codex_api_cost_usd: 0,
      total_margin_usd: 0,
      unprofitable_users: 0,
      over_budget_users: 0,
    }
  )

  const totalMonthlyRevenue = rows.reduce((sum, row) => sum + row.monthly_subscription_usd, 0)
  const trends = {
    daily: buildTrendSeries(costByDay, totalMonthlyRevenue, "daily"),
    weekly: buildTrendSeries(costByDay, totalMonthlyRevenue, "weekly"),
    monthly: buildTrendSeries(costByDay, totalMonthlyRevenue, "monthly"),
    module_lines: buildRevenueLineSeries(moduleRevenueMonthly, MODULE_LABELS),
    tier_lines: buildRevenueLineSeries(tierRevenueMonthly, TIER_LABELS),
    seeded_weekly_revenue_usd: DEMO_WEEKLY_REVENUE_USD,
  }

  return NextResponse.json({
    month_label: monthLabel,
    month_start: startIso,
    summary: {
      ...summary,
      total_revenue_usd: Number(summary.total_revenue_usd.toFixed(2)),
      total_api_cost_usd: Number(summary.total_api_cost_usd.toFixed(4)),
      total_openai_api_cost_usd: Number(summary.total_openai_api_cost_usd.toFixed(4)),
      total_codex_api_cost_usd: Number(summary.total_codex_api_cost_usd.toFixed(4)),
      total_margin_usd: Number(summary.total_margin_usd.toFixed(4)),
    },
    trends,
    users: rows,
  })
}

export async function PATCH(request: Request) {
  const { user, errorMessage } = await getRequestAuth(request)
  if (!user) {
    return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
  }

  const capabilities = await getAdminCapabilities({ userId: user.id, email: user.email })
  if (!capabilities.isSuperuser) {
    return NextResponse.json({ error: "Superuser access required" }, { status: 403 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 })
  }

  let payload: SubscriptionPayload = {}
  try {
    payload = (await request.json()) as SubscriptionPayload
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 })
  }

  let userId = normalizeText(payload.user_id)
  const email = normalizeText(payload.email).toLowerCase()

  if (!userId && email) {
    const usersResponse = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const match = (usersResponse.data?.users ?? []).find((candidate) => (candidate.email ?? "").toLowerCase() === email)
    userId = match?.id ?? ""
  }

  if (!userId) {
    return NextResponse.json({ error: "user_id or email is required." }, { status: 400 })
  }

  const planCode = normalizeText(payload.plan_code) || "free"
  const billingStatus = normalizeText(payload.billing_status) || "active"
  const monthlySubscriptionUsd = toNumber(payload.monthly_subscription_usd)
  const monthlyApiBudgetUsd = payload.monthly_api_budget_usd === null || payload.monthly_api_budget_usd === undefined
    ? null
    : toNumber(payload.monthly_api_budget_usd)

  const { data, error } = await admin
    .from("user_subscriptions")
    .upsert(
      [
        {
          user_id: userId,
          plan_code: planCode,
          billing_status: billingStatus,
          monthly_subscription_usd: monthlySubscriptionUsd,
          monthly_api_budget_usd: monthlyApiBudgetUsd,
          notes: normalizeText(payload.notes) || null,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "user_id" }
    )
    .select("user_id, plan_code, billing_status, monthly_subscription_usd, monthly_api_budget_usd, notes, updated_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ subscription: data })
}
