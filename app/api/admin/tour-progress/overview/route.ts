import { NextResponse } from "next/server"
import { createAdminClient, getAdminCapabilities } from "@/lib/admin"
import { getRequestAuth } from "@/lib/supabase/auth"

const TOUR_VERSION = "2026-04-20-v1"
const MODULES = ["career", "persona", "teamsync"] as const
type TourModule = (typeof MODULES)[number]

function isMissingTable(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false
  return error.code === "42P01" || (error.message || "").toLowerCase().includes("user_tour_progress")
}

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
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local to enable admin metrics." },
        { status: 500 }
      )
    }

    const [{ count: profileCount }, progressResult] = await Promise.all([
      admin.from("profiles").select("user_id", { count: "exact", head: true }),
      admin
        .from("user_tour_progress")
        .select("user_id, module, completed, updated_at")
        .eq("tour_version", TOUR_VERSION),
    ])

    if (progressResult.error) {
      if (isMissingTable(progressResult.error)) {
        return NextResponse.json({
          table_missing: true,
          tour_version: TOUR_VERSION,
          totals: {
            users: profileCount ?? 0,
            completed_all_modules: 0,
            completion_rate_percent: 0,
          },
          modules: MODULES.map((moduleName) => ({
            module: moduleName,
            completed_users: 0,
            completion_rate_percent: 0,
            recent_7d_completions: 0,
          })),
        })
      }
      return NextResponse.json({ error: progressResult.error.message }, { status: 400 })
    }

    const progressRows = progressResult.data ?? []
    const moduleUserSets: Record<TourModule, Set<string>> = {
      career: new Set<string>(),
      persona: new Set<string>(),
      teamsync: new Set<string>(),
    }
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    const recent7dByModule: Record<TourModule, number> = {
      career: 0,
      persona: 0,
      teamsync: 0,
    }

    for (const row of progressRows) {
      if (!row.completed) continue
      const moduleName = row.module as TourModule
      if (!MODULES.includes(moduleName)) continue
      if (typeof row.user_id === "string" && row.user_id.length > 0) {
        moduleUserSets[moduleName].add(row.user_id)
      }
      if (row.updated_at && new Date(row.updated_at).getTime() >= cutoff) {
        recent7dByModule[moduleName] += 1
      }
    }

    const usersAllModules = new Set<string>()
    for (const userId of moduleUserSets.career) {
      if (moduleUserSets.persona.has(userId) && moduleUserSets.teamsync.has(userId)) {
        usersAllModules.add(userId)
      }
    }

    const totalUsers = profileCount ?? 0
    const safePercent = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0)

    return NextResponse.json({
      table_missing: false,
      tour_version: TOUR_VERSION,
      totals: {
        users: totalUsers,
        completed_all_modules: usersAllModules.size,
        completion_rate_percent: safePercent(usersAllModules.size, totalUsers),
      },
      modules: MODULES.map((moduleName) => ({
        module: moduleName,
        completed_users: moduleUserSets[moduleName].size,
        completion_rate_percent: safePercent(moduleUserSets[moduleName].size, totalUsers),
        recent_7d_completions: recent7dByModule[moduleName],
      })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
