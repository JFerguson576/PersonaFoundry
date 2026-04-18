import { NextResponse } from "next/server"
import { createRouteClient } from "@/lib/supabase/route"
import { getRequestAuth } from "@/lib/supabase/auth"

type SessionPayload = {
  module?: string
  route_path?: string
  context?: Record<string, unknown>
}

function normalizeText(value: unknown, fallback: string) {
  const parsed = typeof value === "string" ? value.trim() : ""
  return parsed || fallback
}

function isMissingTable(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false
  return error.code === "42P01" || (error.message || "").toLowerCase().includes("experience_agent_sessions")
}

export async function GET(request: Request) {
  const { user, accessToken, errorMessage } = await getRequestAuth(request)
  if (!user || !accessToken) {
    return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
  }

  const supabase = createRouteClient(accessToken)
  const url = new URL(request.url)
  const moduleName = normalizeText(url.searchParams.get("module"), "platform")
  const routePath = normalizeText(url.searchParams.get("route_path"), "/")

  const { data, error } = await supabase
    .from("experience_agent_sessions")
    .select("id, module, route_path, status, context, created_at, updated_at")
    .eq("user_id", user.id)
    .eq("module", moduleName)
    .eq("route_path", routePath)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ session: null, table_missing: true })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ session: data ?? null, table_missing: false })
}

export async function POST(request: Request) {
  const { user, accessToken, errorMessage } = await getRequestAuth(request)
  if (!user || !accessToken) {
    return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
  }

  let payload: SessionPayload = {}
  try {
    payload = (await request.json()) as SessionPayload
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 })
  }

  const moduleName = normalizeText(payload.module, "platform")
  const routePath = normalizeText(payload.route_path, "/")
  const context = payload.context && typeof payload.context === "object" ? payload.context : {}
  const supabase = createRouteClient(accessToken)

  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from("experience_agent_sessions")
    .insert([
      {
        user_id: user.id,
        module: moduleName,
        route_path: routePath,
        context,
        status: "active",
        updated_at: nowIso,
      },
    ])
    .select("id, module, route_path, status, context, created_at, updated_at")
    .single()

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ error: "Missing experience_agent_sessions table. Run supabase/experience_agent.sql." }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ session: data })
}

