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
    const pressureLevel = Number.isFinite(body?.pressure_level) ? Math.max(1, Math.min(5, Number(body.pressure_level))) : 3
    const members = Array.isArray(body?.members) ? (body.members as MemberInput[]) : []

    if (!scenarioTitle) {
      return NextResponse.json({ error: "scenario_title is required" }, { status: 400 })
    }

    if (members.length < 2) {
      return NextResponse.json({ error: "At least two members are required" }, { status: 400 })
    }

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

Group name: ${groupName}
Scenario category: ${scenarioCategory}
Scenario title: ${scenarioTitle}
Pressure level: ${pressureLevel}/5
Desired outcome: ${desiredOutcome || "Not provided"}

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
            required: ["groupSummary", "semanticLens", "likelyBehaviors", "roleReactions", "risks", "adjustments", "actions"],
          },
        },
      },
    })

    const parsed = JSON.parse(response.output_text || "{}") as {
      groupSummary?: string
      semanticLens?: string
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
