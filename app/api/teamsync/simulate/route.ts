import { NextResponse } from "next/server"
import OpenAI from "openai"
import { getRequestAuth } from "@/lib/supabase/auth"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

type MemberInput = {
  name?: string
  role?: string
  strengths?: string
}

type RoleReaction = {
  audience: string
  likelyResponse: string
  supportAction: string
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") return ""
  return value.trim()
}

function normalizeCompanyUrl(value: unknown) {
  const raw = normalizeText(value)
  if (!raw) return ""
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const parsed = new URL(withProtocol)
    if (!/^https?:$/.test(parsed.protocol)) return ""
    return parsed.toString()
  } catch {
    return ""
  }
}

async function fetchCompanyContextSnapshot(companyUrl: string) {
  if (!companyUrl) return ""
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6500)
  try {
    const response = await fetch(companyUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Personara-TeamSync/1.0 (+https://www.personara.ai)",
      },
    })
    if (!response.ok) return ""
    const html = await response.text()
    if (!html) return ""
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const metaDescriptionMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i)
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 1800)
    const title = normalizeText(titleMatch?.[1])
    const description = normalizeText(metaDescriptionMatch?.[1])
    return [title ? `Title: ${title}` : "", description ? `Description: ${description}` : "", text ? `Page summary: ${text}` : ""]
      .filter(Boolean)
      .join("\n")
  } catch {
    return ""
  } finally {
    clearTimeout(timeout)
  }
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 })
    }

    const { user, errorMessage } = await getRequestAuth(req)
    if (!user) {
      return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const groupName = normalizeText(body?.group_name) || "Team"
    const scenarioTitle = normalizeText(body?.scenario_title)
    const scenarioCategory = normalizeText(body?.scenario_category) || "Professional"
    const desiredOutcome = normalizeText(body?.desired_outcome)
    const companyContextEnabled = Boolean(body?.company_context_enabled)
    const companyContextInfluence = normalizeText(body?.company_context_influence).toLowerCase()
    const companyUrl = companyContextEnabled ? normalizeCompanyUrl(body?.company_url) : ""
    const pressureLevel = Number.isFinite(body?.pressure_level) ? Math.max(1, Math.min(5, Number(body.pressure_level))) : 3
    const members = Array.isArray(body?.members) ? (body.members as MemberInput[]) : []

    if (!scenarioTitle) {
      return NextResponse.json({ error: "scenario_title is required" }, { status: 400 })
    }

    if (members.length < 2) {
      return NextResponse.json({ error: "At least two members are required" }, { status: 400 })
    }

    const companySnapshot = companyUrl ? await fetchCompanyContextSnapshot(companyUrl) : ""
    const contextInfluenceLabel =
      companyContextInfluence === "high" ? "High" : companyContextInfluence === "low" ? "Low" : "Medium"

    const response = await openai.responses.create({
      model: process.env.OPENAI_CAREER_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini",
      reasoning: { effort: "medium" },
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You are TeamSync, an expert in Gallup-strengths team dynamics. Return clear plain-language guidance for non-technical users. Return JSON only.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Build a scenario simulation in accessible language.

Return JSON:
{
  "groupSummary": "string",
  "semanticLens": "string",
  "companyContextSummary": "string",
  "likelyBehaviors": ["string"],
  "roleReactions": [
    {
      "audience": "string",
      "likelyResponse": "string",
      "supportAction": "string"
    }
  ],
  "risks": ["string"],
  "adjustments": ["string"],
  "actions": ["string"]
}

Rules:
- Use concise, supportive language.
- Focus on practical group behavior, not personality labels.
- Each list item must be specific and immediately usable.
- Avoid jargon.
- Use the scenario, pressure level, and desired outcome.
- Weave semantic intelligence from the scenario context (for example grief, conflict, performance pressure, change, uncertainty).
- If the scenario implies bereavement or family loss, include role-based likely responses for children, grandchildren, and primary adults where relevant.
- Tie each role response to strengths patterns and provide one actionable support behavior.
- Keep roleReactions between 2 and 6 items.
- Ensure roleReactions are member-specific where possible (use names from Members list when you can).
- Avoid repeating near-identical support advice across all members.
- Gallup strengths remain the primary behavioral signal.
- If company context is supplied, use it only as an external environment overlay (industry pressure, language tone, governance context).
- Keep company-context summary to 1-2 concise sentences and avoid speculative claims.

Group name: ${groupName}
Scenario category: ${scenarioCategory}
Scenario title: ${scenarioTitle}
Pressure level: ${pressureLevel}/5
Desired outcome: ${desiredOutcome || "Not provided"}
Company context enabled: ${companyContextEnabled ? "Yes" : "No"}
Company context influence: ${contextInfluenceLabel}
Company URL: ${companyUrl || "Not provided"}
Company snapshot (public): ${companySnapshot || "Not available"}

Members:
${JSON.stringify(members, null, 2)}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "teamsync_simulation",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              groupSummary: { type: "string" },
              semanticLens: { type: "string" },
              companyContextSummary: { type: "string" },
              likelyBehaviors: { type: "array", items: { type: "string" } },
              roleReactions: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    audience: { type: "string" },
                    likelyResponse: { type: "string" },
                    supportAction: { type: "string" },
                  },
                  required: ["audience", "likelyResponse", "supportAction"],
                },
              },
              risks: { type: "array", items: { type: "string" } },
              adjustments: { type: "array", items: { type: "string" } },
              actions: { type: "array", items: { type: "string" } },
            },
            required: ["groupSummary", "semanticLens", "companyContextSummary", "likelyBehaviors", "roleReactions", "risks", "adjustments", "actions"],
          },
        },
      },
    })

    const parsed = JSON.parse(response.output_text || "{}") as {
      groupSummary?: string
      semanticLens?: string
      companyContextSummary?: string
      likelyBehaviors?: string[]
      roleReactions?: RoleReaction[]
      risks?: string[]
      adjustments?: string[]
      actions?: string[]
    }

    if (!normalizeText(parsed.groupSummary)) {
      return NextResponse.json({ error: "Model did not return a valid simulation" }, { status: 500 })
    }

    return NextResponse.json({
      result: {
        groupSummary: normalizeText(parsed.groupSummary),
        semanticLens: normalizeText(parsed.semanticLens),
        companyContextSummary: normalizeText(parsed.companyContextSummary),
        likelyBehaviors: Array.isArray(parsed.likelyBehaviors) ? parsed.likelyBehaviors : [],
        roleReactions: Array.isArray(parsed.roleReactions) ? parsed.roleReactions : [],
        risks: Array.isArray(parsed.risks) ? parsed.risks : [],
        adjustments: Array.isArray(parsed.adjustments) ? parsed.adjustments : [],
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
