import { NextResponse } from "next/server"
import { createRouteClient } from "@/lib/supabase/route"
import { getRequestAuth } from "@/lib/supabase/auth"

type AgentFeedbackPayload = {
  session_id?: string
  message_id?: string | null
  rating?: "up" | "down"
  note?: string | null
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function isMissingTable(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false
  return error.code === "42P01" || (error.message || "").toLowerCase().includes("experience_agent_feedback")
}

export async function POST(request: Request) {
  const { user, accessToken, errorMessage } = await getRequestAuth(request)
  if (!user || !accessToken) {
    return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
  }

  let payload: AgentFeedbackPayload = {}
  try {
    payload = (await request.json()) as AgentFeedbackPayload
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 })
  }

  const sessionId = normalizeText(payload.session_id)
  const rating = payload.rating === "down" ? "down" : payload.rating === "up" ? "up" : ""
  if (!sessionId || !rating) {
    return NextResponse.json({ error: "session_id and rating are required." }, { status: 400 })
  }

  const supabase = createRouteClient(accessToken)

  const sessionResult = await supabase
    .from("experience_agent_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle()
  if (sessionResult.error) {
    if (isMissingTable(sessionResult.error)) {
      return NextResponse.json({ error: "Missing experience agent tables. Run supabase/experience_agent.sql and supabase/experience_agent_feedback.sql." }, { status: 400 })
    }
    return NextResponse.json({ error: sessionResult.error.message }, { status: 400 })
  }
  if (!sessionResult.data) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 })
  }

  const { data, error } = await supabase
    .from("experience_agent_feedback")
    .insert([
      {
        session_id: sessionId,
        message_id: normalizeText(payload.message_id) || null,
        user_id: user.id,
        rating,
        note: normalizeText(payload.note) || null,
      },
    ])
    .select("id, session_id, message_id, rating, note, created_at")
    .single()

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ error: "Missing table experience_agent_feedback. Run supabase/experience_agent_feedback.sql." }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ feedback: data })
}

