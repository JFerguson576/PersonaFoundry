import { NextResponse } from "next/server"
import { createAdminClient, getAdminCapabilities } from "@/lib/admin"
import { getOpenAIOrganizationUsageSummary } from "@/lib/openai-organization-usage"
import { getRequestAuth } from "@/lib/supabase/auth"

export async function GET(req: Request) {
  try {
    const { user, errorMessage } = await getRequestAuth(req)

    if (!user) {
      return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
    }

    const capabilities = await getAdminCapabilities({ userId: user.id, email: user.email })

    if (!capabilities.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const admin = createAdminClient()

    if (!admin) {
      return NextResponse.json(
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local to enable the admin dashboard." },
        { status: 500 }
      )
    }

    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const [
      { count: totalSavedProfiles },
      { count: totalCandidates },
      { count: deletedCandidates },
      { count: candidatesCreatedToday },
      { count: failedBackgroundRuns24h },
      { count: failedLiveRuns24h },
      { count: failedApiCalls24h },
      { data: usageEvents },
      { data: apiLogs },
      { data: candidateRows },
      { data: adminSettingsRows },
      usersResponse,
      openaiOrgUsage7d,
      openaiOrgUsage1d,
      openaiOrgUsage30d,
    ] = await Promise.all([
      admin.from("profiles").select("user_id", { count: "exact", head: true }),
      admin.from("career_candidates").select("id", { count: "exact", head: true }).is("deleted_at", null),
      admin.from("career_candidates").select("id", { count: "exact", head: true }).not("deleted_at", "is", null),
      admin.from("career_candidates").select("id", { count: "exact", head: true }).is("deleted_at", null).gte("created_at", todayStart.toISOString()),
      admin.from("career_background_jobs").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", since24h.toISOString()),
      admin.from("career_live_job_runs").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", since24h.toISOString()),
      admin.from("api_usage_logs").select("id", { count: "exact", head: true }).neq("status", "success").gte("created_at", since24h.toISOString()),
      admin.from("usage_events").select("id, module, event_type, user_id, created_at, metadata").order("created_at", { ascending: false }).limit(100),
      admin.from("api_usage_logs").select("id, module, feature, model, status, input_tokens, output_tokens, total_tokens, estimated_cost_usd, created_at").order("created_at", { ascending: false }).limit(200),
      admin.from("career_candidates").select("id, user_id, full_name, city, primary_goal, created_at, deleted_at, purge_after").order("created_at", { ascending: false }).limit(250),
      admin.from("admin_settings").select("key, value_json").eq("key", "openai_monthly_budget_usd").limit(1),
      admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
      getOpenAIOrganizationUsageSummary(7),
      getOpenAIOrganizationUsageSummary(1),
      getOpenAIOrganizationUsageSummary(30),
    ])

    const events = usageEvents ?? []
    const logs = apiLogs ?? []
    const authUsers = usersResponse.data?.users ?? []

    const activeUsers = new Set(events.map((event) => event.user_id).filter(Boolean)).size
    const totalTokens = logs.reduce((sum, log) => sum + (log.total_tokens ?? 0), 0)
    const totalEstimatedCost = logs.reduce((sum, log) => sum + Number(log.estimated_cost_usd ?? 0), 0)

    const eventsByType = Object.entries(
      events.reduce<Record<string, number>>((accumulator, event) => {
        accumulator[event.event_type] = (accumulator[event.event_type] ?? 0) + 1
        return accumulator
      }, {})
    )
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value)

    const costsByFeature = Object.entries(
      logs.reduce<Record<string, { requests: number; tokens: number; cost: number }>>((accumulator, log) => {
        const current = accumulator[log.feature] ?? { requests: 0, tokens: 0, cost: 0 }
        current.requests += 1
        current.tokens += log.total_tokens ?? 0
        current.cost += Number(log.estimated_cost_usd ?? 0)
        accumulator[log.feature] = current
        return accumulator
      }, {})
    )
      .map(([feature, value]) => ({ feature, ...value }))
      .sort((left, right) => right.requests - left.requests)

    const moduleSummaryMap = new Map<string, { events: number; api_requests: number; tokens: number; cost: number }>()

    for (const event of events) {
      const current = moduleSummaryMap.get(event.module) ?? { events: 0, api_requests: 0, tokens: 0, cost: 0 }
      current.events += 1
      moduleSummaryMap.set(event.module, current)
    }

    for (const log of logs) {
      const current = moduleSummaryMap.get(log.module) ?? { events: 0, api_requests: 0, tokens: 0, cost: 0 }
      current.api_requests += 1
      current.tokens += log.total_tokens ?? 0
      current.cost += Number(log.estimated_cost_usd ?? 0)
      moduleSummaryMap.set(log.module, current)
    }

    const moduleSummary = [...moduleSummaryMap.entries()]
      .map(([module, value]) => ({ module, ...value }))
      .sort((left, right) => right.api_requests - left.api_requests)

    const signupUsers = authUsers
      .map((user) => {
        const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
        const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>
        const providerList = Array.isArray(appMetadata.providers)
          ? appMetadata.providers.filter((value): value is string => typeof value === "string")
          : []

        const derivedName =
          typeof metadata.full_name === "string"
            ? metadata.full_name
            : typeof metadata.name === "string"
            ? metadata.name
            : [metadata.first_name, metadata.last_name].filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(" ")

        return {
          id: user.id,
          name: derivedName || null,
          age: typeof metadata.age === "number" || typeof metadata.age === "string" ? String(metadata.age) : null,
          email: user.email ?? null,
          created_at: user.created_at ?? null,
          last_sign_in_at: user.last_sign_in_at ?? null,
          providers: providerList,
        }
      })
      .sort((left, right) => {
        const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0
        const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0
        return rightTime - leftTime
      })

    const providerBreakdown = Object.entries(
      signupUsers.reduce<Record<string, number>>((accumulator, user) => {
        if (user.providers.length === 0) {
          accumulator.unknown = (accumulator.unknown ?? 0) + 1
          return accumulator
        }

        for (const provider of user.providers) {
          accumulator[provider] = (accumulator[provider] ?? 0) + 1
        }
        return accumulator
      }, {})
    )
      .map(([provider, value]) => ({ provider, value }))
      .sort((left, right) => right.value - left.value)

    const candidateDirectory = (candidateRows ?? []).map((candidate) => ({
      id: candidate.id,
      user_id: candidate.user_id,
      full_name: candidate.full_name,
      city: candidate.city,
      primary_goal: candidate.primary_goal,
      created_at: candidate.created_at,
      deleted_at: candidate.deleted_at ?? null,
      purge_after: candidate.purge_after ?? null,
    }))

    const supportQueueCount = (failedBackgroundRuns24h ?? 0) + (failedLiveRuns24h ?? 0) + (failedApiCalls24h ?? 0)

    const persistedBudgetValue = adminSettingsRows?.[0]?.value_json && typeof adminSettingsRows[0].value_json === "object"
      ? Number((adminSettingsRows[0].value_json as { value?: unknown }).value ?? "")
      : Number.NaN
    const configuredMonthlyBudget = Number(process.env.OPENAI_MONTHLY_BUDGET_USD ?? "")
    const openAIMonthlyBudgetUsd =
      Number.isFinite(persistedBudgetValue) && persistedBudgetValue > 0
        ? persistedBudgetValue
        : Number.isFinite(configuredMonthlyBudget) && configuredMonthlyBudget > 0
          ? configuredMonthlyBudget
          : null
    const openAIBudgetSource =
      Number.isFinite(persistedBudgetValue) && persistedBudgetValue > 0
        ? "database"
        : Number.isFinite(configuredMonthlyBudget) && configuredMonthlyBudget > 0
          ? "environment"
          : "unset"

    return NextResponse.json({
      permissions: {
        is_admin: capabilities.isAdmin,
        is_superuser: capabilities.isSuperuser,
      },
      totals: {
        total_users: authUsers.length,
        active_users: activeUsers,
        total_candidates: totalCandidates ?? 0,
        deleted_candidates: deletedCandidates ?? 0,
        candidates_created_today: candidatesCreatedToday ?? 0,
        failed_runs_24h: (failedBackgroundRuns24h ?? 0) + (failedLiveRuns24h ?? 0),
        support_queue: supportQueueCount,
        total_saved_profiles: totalSavedProfiles ?? 0,
        total_api_requests: logs.length,
        total_tokens: totalTokens,
        estimated_cost_usd: Number(totalEstimatedCost.toFixed(6)),
      },
      openai_org_usage: {
        rolling_7d: openaiOrgUsage7d,
        daily: openaiOrgUsage1d,
        monthly: openaiOrgUsage30d,
      },
      budget: {
        openai_monthly_budget_usd: openAIMonthlyBudgetUsd,
        source: openAIBudgetSource,
      },
      events_by_type: eventsByType,
      costs_by_feature: costsByFeature,
      module_summary: moduleSummary,
      provider_breakdown: providerBreakdown,
      recent_activity: events.slice(0, 20),
      recent_api_usage: logs.slice(0, 20),
      recent_signups: signupUsers.slice(0, 50),
      candidate_directory: candidateDirectory,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
