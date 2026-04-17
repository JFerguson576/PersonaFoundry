import { NextResponse } from "next/server"
import { getRequestAuth } from "@/lib/supabase/auth"

type IncomingRun = {
  scenarioTitle?: string
  scenarioCategory?: string
  pressureLevel?: number
  groupSummary?: string
  semanticLens?: string
  risks?: string[]
  actions?: string[]
  memberSupportPriorities?: Array<{
    memberName?: string
    level?: string
    score?: number
    supportMove?: string
  }>
}

function text(value: unknown) {
  if (typeof value !== "string") return ""
  return value.trim()
}

export async function POST(req: Request) {
  try {
    const { user, errorMessage } = await getRequestAuth(req)
    if (!user) {
      return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
    }

    const webhook = process.env.TEAMSYNC_SLACK_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL
    if (!webhook) {
      return NextResponse.json(
        { error: "Missing Slack webhook. Set TEAMSYNC_SLACK_WEBHOOK_URL in .env.local." },
        { status: 500 }
      )
    }

    const body = (await req.json()) as {
      groupName?: string
      run?: IncomingRun
    }

    const groupName = text(body?.groupName) || "Group"
    const run = body?.run ?? {}
    const scenarioTitle = text(run.scenarioTitle)
    const scenarioCategory = text(run.scenarioCategory) || "Professional"
    const groupSummary = text(run.groupSummary)
    const topRisk = Array.isArray(run.risks) ? text(run.risks[0]) : ""
    const topAction = Array.isArray(run.actions) ? text(run.actions[0]) : ""
    const topSupport = Array.isArray(run.memberSupportPriorities) ? run.memberSupportPriorities[0] : null
    const supportLine =
      topSupport && text(topSupport.memberName)
        ? `${text(topSupport.memberName)} (${text(topSupport.level) || "medium"}, score ${Number.isFinite(topSupport.score) ? topSupport.score : 0}) - ${text(topSupport.supportMove) || "No move listed"}`
        : "No member support priority generated yet."

    if (!scenarioTitle) {
      return NextResponse.json({ error: "Missing run/scenario data to send." }, { status: 400 })
    }

    const message = [
      `*TeamSync Update* - ${groupName}`,
      `Scenario: *${scenarioTitle}* (${scenarioCategory}, pressure ${Number.isFinite(run.pressureLevel) ? run.pressureLevel : 3}/5)`,
      `Summary: ${groupSummary || "No summary provided."}`,
      `Top risk: ${topRisk || "No major risk flagged."}`,
      `Top action: ${topAction || "No action listed."}`,
      `Support first: ${supportLine}`,
      run.semanticLens ? `Lens: ${text(run.semanticLens)}` : "",
    ]
      .filter(Boolean)
      .join("\n")

    const slackResponse = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: message,
      }),
    })

    if (!slackResponse.ok) {
      const detail = await slackResponse.text()
      return NextResponse.json(
        { error: `Slack rejected message (${slackResponse.status}). ${detail.slice(0, 300)}` },
        { status: 400 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

