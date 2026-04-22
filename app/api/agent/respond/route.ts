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

function readContextString(context: Record<string, unknown>, key: string) {
  const value = context[key]
  return typeof value === "string" ? value.trim() : ""
}

function readContextList(context: Record<string, unknown>, key: string) {
  const value = context[key]
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8)
}

function readWorkflowSignal(context: Record<string, unknown>) {
  const raw = context.workflow_signal
  if (!raw || typeof raw !== "object") {
    return {
      activeStepLabel: "",
      totalSteps: 0,
      completedSteps: 0,
      visibleSteps: [] as string[],
    }
  }
  const payload = raw as Record<string, unknown>
  const activeStepLabel = typeof payload.active_step_label === "string" ? payload.active_step_label.trim() : ""
  const totalSteps = typeof payload.total_steps === "number" ? payload.total_steps : 0
  const completedSteps = typeof payload.completed_steps === "number" ? payload.completed_steps : 0
  const visibleSteps = Array.isArray(payload.visible_steps)
    ? payload.visible_steps.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 8)
    : []

  return { activeStepLabel, totalSteps, completedSteps, visibleSteps }
}

function modulePlaybook(moduleName: string) {
  switch (moduleName) {
    case "career-intelligence":
      return "Focus on one next step only: load sources, generate profile, create assets, then follow-up actions."
    case "persona-foundry":
      return "Focus on baseline first, then tune voice sliders, run a quick test prompt, and export once style is stable."
    case "teamsync":
      return "Focus on loading members first, then scenario setup, run simulation, and extract decision-ready insights."
    case "control-center":
      return "Focus on highest-risk signal first: margin pressure, failed runs, or unresolved tester feedback."
    default:
      return "Focus on one immediate step, then two follow-up actions."
  }
}

function inferAgentMode(moduleName: string, routePath: string, visibleSections: string[], visibleActions: string[]) {
  const route = routePath.toLowerCase()
  const moduleSlug = moduleName.toLowerCase()
  const sectionBlob = visibleSections.join(" ").toLowerCase()
  const actionBlob = visibleActions.join(" ").toLowerCase()

  const isOperations =
    route.includes("/operations") ||
    route.includes("/control-center") ||
    moduleSlug.includes("control-center") ||
    sectionBlob.includes("operations menu") ||
    sectionBlob.includes("financials") ||
    sectionBlob.includes("candidate management") ||
    sectionBlob.includes("system health") ||
    actionBlob.includes("recover stalled")

  if (isOperations) {
    return {
      mode: "operations-control",
      responseStyle:
        "Use an operator tone: prioritize immediate platform risk first, then cost/health second, then next action. Anchor actions to left-nav section names so users can click directly.",
      sectionPriority: "Risk/alerts -> system health -> financials -> outreach execution",
    }
  }

  const isPublic =
    route === "/" ||
    route.startsWith("/platform") ||
    route.startsWith("/pricing") ||
    route.startsWith("/about") ||
    route.startsWith("/resources") ||
    route.startsWith("/contact")

  if (isPublic) {
    return {
      mode: "public-navigation",
      responseStyle:
        "Use onboarding tone: help the user choose a module quickly and take one clear first action. Keep explanations short and confidence-building.",
      sectionPriority: "Module choice -> first action -> help route",
    }
  }

  return {
    mode: "module-workflow",
    responseStyle:
      "Use workflow coaching tone: orient to current step, remove friction, and keep momentum through one next action at a time.",
    sectionPriority: "Current step -> next step -> unblock path",
  }
}

function buildAgentInstructions(moduleName: string, routePath: string, context: Record<string, unknown>) {
  const contextPreview = JSON.stringify(context).slice(0, 2000)
  const pageTitle = readContextString(context, "page_title")
  const sectionAnchor = readContextString(context, "section_anchor")
  const visibleSections = readContextList(context, "visible_sections")
  const visibleActions = readContextList(context, "visible_actions")
  const agentMode = inferAgentMode(moduleName, routePath, visibleSections, visibleActions)
  const workflowSignal = readWorkflowSignal(context)
  const workflowProgressLabel =
    workflowSignal.totalSteps > 0 ? `${workflowSignal.completedSteps}/${workflowSignal.totalSteps}` : "unknown"
  const quickSectionHints = visibleSections.length > 0 ? visibleSections.join(" | ") : "none detected"
  const quickActionHints = visibleActions.length > 0 ? visibleActions.join(" | ") : "none detected"
  const quickWorkflowHints = workflowSignal.visibleSteps.length > 0 ? workflowSignal.visibleSteps.join(" | ") : "none detected"

  return `
You are Personara's in-app Experience Agent.
Your role is to make complex workflows feel simple, clear, and action-oriented.

Current module: ${moduleName}
Current route: ${routePath}
Agent mode: ${agentMode.mode}
Current page title: ${pageTitle || "unknown"}
Current section anchor: ${sectionAnchor || "none"}
Visible sections: ${quickSectionHints}
Visible actions: ${quickActionHints}
Workflow active step: ${workflowSignal.activeStepLabel || "none detected"}
Workflow progress: ${workflowProgressLabel}
Visible workflow steps: ${quickWorkflowHints}
Module playbook: ${modulePlaybook(moduleName)}
Mode response style: ${agentMode.responseStyle}
Mode priority order: ${agentMode.sectionPriority}
Context: ${contextPreview}

Rules:
- Be concise, warm, and practical.
- Give the user the next best 1-3 actions for the active section first.
- When workflow step data exists, anchor advice to the active step and immediate next step.
- If user seems blocked, suggest the smallest unblock action first.
- Do not invent backend state; state uncertainty clearly.
- Use plain language, not technical jargon.
- Prefer action labels that match visible page actions when possible.
- If agent mode is operations-control, start with risk/cost/throughput and name the exact left-nav section to open.
- Format with:
  1) "Do this now"
  2) "Then"
  3) "If blocked"
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
      return NextResponse.json(
        {
          error: "Missing experience agent tables. Run supabase/experience_agent.sql.",
          table_missing: true,
        },
        { status: 400 }
      )
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
    if (isMissingTable(assistantInsertError)) {
      return NextResponse.json(
        {
          error: "Missing experience agent tables. Run supabase/experience_agent.sql.",
          table_missing: true,
        },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: assistantInsertError.message }, { status: 400 })
  }

  return NextResponse.json({ message: assistantMessage, message_id: insertedMessage?.id ?? null })
}
