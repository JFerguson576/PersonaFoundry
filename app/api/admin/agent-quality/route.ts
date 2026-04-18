import { NextResponse } from "next/server"
import { createAdminClient, getAdminCapabilities } from "@/lib/admin"
import { getRequestAuth } from "@/lib/supabase/auth"

type AgentFeedbackRow = {
  session_id: string
  rating: "up" | "down"
  note: string | null
  created_at: string
}

type AgentSessionRow = {
  id: string
  module: string
  route_path: string
}

type AgentMessageRow = {
  session_id: string
  role: "user" | "assistant" | "system"
  message: string
}

function isMissingTable(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false
  return (
    error.code === "42P01" ||
    (error.message || "").toLowerCase().includes("experience_agent_feedback") ||
    (error.message || "").toLowerCase().includes("experience_agent_sessions") ||
    (error.message || "").toLowerCase().includes("experience_agent_messages")
  )
}

function normalizePrompt(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase()
}

function safePercent(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0
  return Number(((value / total) * 100).toFixed(1))
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

  const now = new Date()
  const start30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const feedbackResult = await admin
    .from("experience_agent_feedback")
    .select("session_id, rating, note, created_at")
    .gte("created_at", start30d)
    .order("created_at", { ascending: false })
    .limit(10000)

  if (feedbackResult.error) {
    if (isMissingTable(feedbackResult.error)) {
      return NextResponse.json(
        { error: "Agent quality tables are missing. Run supabase/experience_agent.sql and supabase/experience_agent_feedback.sql." },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: feedbackResult.error.message }, { status: 400 })
  }

  const feedbackRows = (feedbackResult.data ?? []) as AgentFeedbackRow[]
  if (feedbackRows.length === 0) {
    return NextResponse.json({
      window_days: 30,
      summary: {
        feedback_count: 0,
        sessions_with_feedback: 0,
        helpful_percent: 0,
        needs_attention_percent: 0,
        unique_modules: 0,
      },
      by_module: [],
      hotspots: [],
      top_prompts: [],
      recent_notes: [],
    })
  }

  const sessionIds = [...new Set(feedbackRows.map((row) => row.session_id))]
  const sessionsResult = await admin.from("experience_agent_sessions").select("id, module, route_path").in("id", sessionIds)
  if (sessionsResult.error) {
    if (isMissingTable(sessionsResult.error)) {
      return NextResponse.json(
        { error: "Agent quality tables are missing. Run supabase/experience_agent.sql and supabase/experience_agent_feedback.sql." },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: sessionsResult.error.message }, { status: 400 })
  }

  const messagesResult = await admin
    .from("experience_agent_messages")
    .select("session_id, role, message")
    .in("session_id", sessionIds)
    .eq("role", "user")
    .order("created_at", { ascending: false })
    .limit(5000)
  if (messagesResult.error) {
    if (isMissingTable(messagesResult.error)) {
      return NextResponse.json(
        { error: "Agent quality tables are missing. Run supabase/experience_agent.sql and supabase/experience_agent_feedback.sql." },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: messagesResult.error.message }, { status: 400 })
  }

  const sessionsById = new Map((sessionsResult.data as AgentSessionRow[] | null | undefined)?.map((row) => [row.id, row]) ?? [])
  const moduleCounters = new Map<string, { up: number; down: number; total: number }>()
  const hotspotCounters = new Map<string, { module: string; route_path: string; down: number; total: number }>()

  let up = 0
  let down = 0
  for (const row of feedbackRows) {
    const session = sessionsById.get(row.session_id)
    const moduleName = session?.module || "platform"
    const routePath = session?.route_path || "/"
    const moduleStats = moduleCounters.get(moduleName) ?? { up: 0, down: 0, total: 0 }
    moduleStats.total += 1
    if (row.rating === "up") {
      moduleStats.up += 1
      up += 1
    } else {
      moduleStats.down += 1
      down += 1
    }
    moduleCounters.set(moduleName, moduleStats)

    const hotspotKey = `${moduleName}::${routePath}`
    const hotspot = hotspotCounters.get(hotspotKey) ?? { module: moduleName, route_path: routePath, down: 0, total: 0 }
    hotspot.total += 1
    if (row.rating === "down") hotspot.down += 1
    hotspotCounters.set(hotspotKey, hotspot)
  }

  const prompts = (messagesResult.data as AgentMessageRow[] | null | undefined) ?? []
  const promptCounts = new Map<string, { prompt: string; count: number }>()
  for (const row of prompts) {
    const normalized = normalizePrompt(row.message)
    if (!normalized) continue
    const current = promptCounts.get(normalized) ?? { prompt: row.message.trim(), count: 0 }
    current.count += 1
    promptCounts.set(normalized, current)
  }

  const byModule = [...moduleCounters.entries()]
    .map(([module, value]) => ({
      module,
      feedback_count: value.total,
      helpful: value.up,
      needs_attention: value.down,
      helpful_percent: safePercent(value.up, value.total),
    }))
    .sort((a, b) => b.feedback_count - a.feedback_count)

  const hotspots = [...hotspotCounters.values()]
    .filter((item) => item.down > 0)
    .map((item) => ({
      module: item.module,
      route_path: item.route_path,
      needs_attention: item.down,
      feedback_count: item.total,
      needs_attention_percent: safePercent(item.down, item.total),
    }))
    .sort((a, b) => (b.needs_attention === a.needs_attention ? b.feedback_count - a.feedback_count : b.needs_attention - a.needs_attention))
    .slice(0, 8)

  const topPrompts = [...promptCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((item) => ({ prompt: item.prompt, count: item.count }))

  const recentNotes = feedbackRows
    .filter((row) => row.rating === "down" && typeof row.note === "string" && row.note.trim().length > 0)
    .slice(0, 6)
    .map((row) => {
      const session = sessionsById.get(row.session_id)
      return {
        module: session?.module || "platform",
        route_path: session?.route_path || "/",
        note: row.note?.trim() || "",
        created_at: row.created_at,
      }
    })

  return NextResponse.json({
    window_days: 30,
    summary: {
      feedback_count: feedbackRows.length,
      sessions_with_feedback: sessionIds.length,
      helpful_percent: safePercent(up, feedbackRows.length),
      needs_attention_percent: safePercent(down, feedbackRows.length),
      unique_modules: moduleCounters.size,
    },
    by_module: byModule,
    hotspots,
    top_prompts: topPrompts,
    recent_notes: recentNotes,
  })
}
