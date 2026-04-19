import { NextResponse } from "next/server"
import { getRequestAuth } from "@/lib/supabase/auth"

type ResourceResult = {
  title: string
  url: string
  reason: string
}

type ScenarioExampleResult = {
  title: string
  url: string
  note: string
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") return ""
  return value.trim()
}

function normalizeUrl(value: unknown) {
  const raw = normalizeText(value)
  if (!raw) return ""
  try {
    const parsed = new URL(raw)
    if (!["http:", "https:"].includes(parsed.protocol)) return ""
    return parsed.toString()
  } catch {
    return ""
  }
}

function extractOutputText(data: Record<string, unknown>) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim()
  }
  const output = Array.isArray(data.output) ? data.output : []
  const chunks: string[] = []
  output.forEach((item) => {
    const node = item as Record<string, unknown>
    const content = Array.isArray(node.content) ? node.content : []
    content.forEach((part) => {
      const piece = part as Record<string, unknown>
      if (piece.type === "output_text" && typeof piece.text === "string") {
        chunks.push(piece.text)
      }
    })
  })
  return chunks.join("\n").trim()
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 })
    }

    const { user, errorMessage } = await getRequestAuth(req)
    if (!user) {
      return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const scenarioTitle = normalizeText(body?.scenario_title)
    const scenarioCategory = normalizeText(body?.scenario_category) || "Professional"
    const semanticLens = normalizeText(body?.semantic_lens)
    const risks = Array.isArray(body?.risks) ? body.risks.map((item: unknown) => normalizeText(item)).filter(Boolean) : []
    const actions = Array.isArray(body?.actions) ? body.actions.map((item: unknown) => normalizeText(item)).filter(Boolean) : []
    const roleReactions = Array.isArray(body?.role_reactions)
      ? body.role_reactions
          .map((item: unknown) => {
            const row = item as Record<string, unknown>
            return {
              audience: normalizeText(row?.audience),
              likelyResponse: normalizeText(row?.likelyResponse),
            }
          })
      .filter((row: { audience: string; likelyResponse: string }) => row.audience || row.likelyResponse)
      : []

    if (!scenarioTitle) {
      return NextResponse.json({ error: "scenario_title is required" }, { status: 400 })
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_CAREER_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini",
        tools: [{ type: "web_search_preview" }],
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  "You are a trusted support-research assistant. Find practical, reputable online support resources. Prioritize established organizations, public services, and well-known educational sources. Return JSON only.",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Find exactly 5 online resources for this TeamSync scenario.

Return JSON:
{
  "resources": [
    {
      "title": "string",
      "url": "https://...",
      "reason": "string"
    }
  ],
  "examples": [
    {
      "title": "string",
      "url": "https://...",
      "note": "string"
    }
  ]
}

Rules:
- Provide exactly 5 items.
- Provide exactly 3 comparable examples.
- Each url must be direct and publicly accessible.
- Keep reason to one sentence and tie it to this scenario's needs.
- Keep note to one sentence and summarize what happened / why it is similar.
- Prioritize quality and practical support.
- Avoid duplicate domains when possible.
- Prefer real organizations, real teams, or real people with credible reporting.

Scenario title: ${scenarioTitle}
Scenario category: ${scenarioCategory}
Scenario context: ${semanticLens || "Not provided"}
Risks: ${risks.join(" | ") || "Not provided"}
Role reactions: ${JSON.stringify(roleReactions)}
Actions planned: ${actions.join(" | ") || "Not provided"}`,
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "teamsync_resource_links",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                resources: {
                  type: "array",
                  minItems: 5,
                  maxItems: 5,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      title: { type: "string" },
                      url: { type: "string" },
                      reason: { type: "string" },
                    },
                    required: ["title", "url", "reason"],
                  },
                },
                examples: {
                  type: "array",
                  minItems: 3,
                  maxItems: 3,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      title: { type: "string" },
                      url: { type: "string" },
                      note: { type: "string" },
                    },
                    required: ["title", "url", "note"],
                  },
                },
              },
              required: ["resources", "examples"],
            },
          },
        },
      }),
    })

    const raw = await response.text()
    let data: Record<string, unknown> = {}
    try {
      data = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: "Resource search returned invalid JSON." }, { status: 500 })
    }

    if (!response.ok) {
      const errorMessage = ((data.error as Record<string, unknown> | undefined)?.message as string) || "Resource search failed."
      return NextResponse.json({ error: errorMessage }, { status: response.status })
    }

    const outputText = extractOutputText(data)

    if (!outputText.trim()) {
      return NextResponse.json({ error: "Resource search returned empty output." }, { status: 500 })
    }

    let parsed: { resources?: ResourceResult[]; examples?: ScenarioExampleResult[] } = {}
    try {
      parsed = JSON.parse(outputText) as { resources?: ResourceResult[] }
    } catch {
      return NextResponse.json({ error: "Resource search returned invalid structured output." }, { status: 500 })
    }

    const unique = new Set<string>()
    const resources = (Array.isArray(parsed.resources) ? parsed.resources : [])
      .map((item) => ({
        title: normalizeText(item.title),
        url: normalizeUrl(item.url),
        reason: normalizeText(item.reason),
      }))
      .filter((item) => item.title && item.url)
      .filter((item) => {
        if (unique.has(item.url)) return false
        unique.add(item.url)
        return true
      })
      .slice(0, 5)

    const exampleUnique = new Set<string>()
    const examples = (Array.isArray(parsed.examples) ? parsed.examples : [])
      .map((item) => ({
        title: normalizeText(item.title),
        url: normalizeUrl(item.url),
        note: normalizeText(item.note),
      }))
      .filter((item) => item.title && item.url)
      .filter((item) => {
        if (exampleUnique.has(item.url)) return false
        exampleUnique.add(item.url)
        return true
      })
      .slice(0, 3)

    return NextResponse.json({ resources, examples })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
