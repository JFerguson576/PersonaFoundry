import { NextResponse } from "next/server"
import { createRouteClient } from "@/lib/supabase/route"
import { getRequestAuth } from "@/lib/supabase/auth"

type AgentRespondPayload = {
  session_id?: string
  module?: string
  route_path?: string
  message?: string
  context?: Record<string, unknown>
}

type OpenAIResponseContent = { type?: string; text?: string }
type OpenAIResponseItem = { content?: OpenAIResponseContent[] }
type OpenAIResponseEnvelope = { output_text?: string; output?: OpenAIResponseItem[]; error?: { message?: string } }

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function extractOutputText(data: OpenAIResponseEnvelope) {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text.trim()
  const parts: string[] = []
  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") parts.push(content.text)
    }
  }
  return parts.join("\n").trim()
}

function buildAgentInstructions(moduleName: string, routePath: string, context: Record<string, unknown>) {
  const contextPreview = JSON.stringify(context).slice(0, 2000)
  return `
You are Personara's in-app Experience Agent.
Your role is to make complex workflows feel simple, clear, and action-oriented.

Current module: ${moduleName}
Current route: ${routePath}
Context: ${contextPreview}

Rules:
- Be concise, warm, and practical.
- Give the user the next best 1-3 actions.
- If user seems blocked, suggest the smallest unblock action first.
- Do not invent backend state; state uncertainty clearly.
- Use plain language, not technical jargon.
`.trim()
}

function isMissingTable(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false
  return error.code === "42P01" || (error.message || "").toLowerCase().includes("experience_agent_")
}

export async function POST(request: Request) {
  const { user, accessToken, errorMessage } = await getRequestAuth(request)
  if (!user || !accessToken) {
    return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
  }

  let payload: AgentRespondPayload = {}
  try {
    payload = (await request.json()) as AgentRespondPayload
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 })
  }

  const sessionId = normalizeText(payload.session_id)
  const moduleName = normalizeText(payload.module) || "platform"
  const routePath = normalizeText(payload.route_path) || "/"
  const userMessage = normalizeText(payload.message)
  const context = payload.context && typeof payload.context === "object" ? payload.context : {}

  if (!sessionId || !userMessage) {
    return NextResponse.json({ error: "session_id and message are required." }, { status: 400 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_EXPERIENCE_AGENT_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini"
  if (!apiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY." }, { status: 500 })
  }

  const supabase = createRouteClient(accessToken)
  const nowIso = new Date().toISOString()
  const sessionCheck = await supabase
    .from("experience_agent_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle()
  if (sessionCheck.error) {
    if (isMissingTable(sessionCheck.error)) {
      return NextResponse.json({ error: "Missing experience agent tables. Run supabase/experience_agent.sql." }, { status: 400 })
    }
    return NextResponse.json({ error: sessionCheck.error.message }, { status: 400 })
  }
  if (!sessionCheck.data) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 })
  }

  await supabase.from("experience_agent_messages").insert([
    {
      session_id: sessionId,
      user_id: user.id,
      role: "user",
      message: userMessage,
      metadata: { module: moduleName, route_path: routePath },
    },
  ])

  const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions: buildAgentInstructions(moduleName, routePath, context),
      input: userMessage,
      max_output_tokens: 500,
    }),
  })

  const raw = await openaiResponse.text()
  let data: OpenAIResponseEnvelope = {}
  try {
    data = JSON.parse(raw) as OpenAIResponseEnvelope
  } catch {
    data = { error: { message: "Invalid model response." } }
  }

  if (!openaiResponse.ok) {
    return NextResponse.json({ error: data.error?.message || "Agent response failed." }, { status: 502 })
  }

  const assistantMessage = extractOutputText(data) || "I can help with this. Try the next smallest step and I’ll guide you from there."

  const [{ data: insertedMessage, error: assistantInsertError }] = await Promise.all([
    supabase
      .from("experience_agent_messages")
      .insert([
        {
          session_id: sessionId,
          user_id: user.id,
          role: "assistant",
          message: assistantMessage,
          metadata: { model },
        },
      ])
      .select("id")
      .single(),
    supabase
      .from("experience_agent_sessions")
      .update({ updated_at: nowIso, context })
      .eq("id", sessionId)
      .eq("user_id", user.id),
  ])

  if (assistantInsertError) {
    return NextResponse.json({ error: assistantInsertError.message }, { status: 400 })
  }

  return NextResponse.json({ message: assistantMessage, message_id: insertedMessage?.id ?? null })
}
