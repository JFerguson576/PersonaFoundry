import { NextResponse } from "next/server"
import OpenAI from "openai"
import { getRequestAuth } from "@/lib/supabase/auth"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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
    const scenarioTitle = normalizeText(body?.scenario_title)
    const scenarioCategory = normalizeText(body?.scenario_category) || "Professional"
    const semanticLens = normalizeText(body?.semantic_lens)
    const userMessage = normalizeText(body?.user_message)
    const relationshipGoal = normalizeText(body?.relationship_goal)
    const sourceMember = body?.source_member as {
      name?: string
      role?: string
      strengths?: string
      summary?: string
    }
    const targetMember = body?.target_member as {
      name?: string
      role?: string
      strengths?: string
      summary?: string
    }

    if (!scenarioTitle || !userMessage || !targetMember?.name) {
      return NextResponse.json({ error: "scenario_title, user_message, and target_member.name are required" }, { status: 400 })
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
                "You are TeamSync Conversation Coach. Simulate realistic dialogue and provide psychologically-safe coaching in plain language. Return JSON only.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Run a roleplay and coaching pass.

Return JSON:
{
  "memberReply": "string",
  "coachFeedback": {
    "whatWorked": ["string"],
    "whatToAdjust": ["string"],
    "improvedRewrite": "string",
    "safetyScore": number
  }
}

Rules:
- Simulate the target member in a realistic but calm tone.
- Use strengths-informed communication tendencies without stereotyping.
- Coaching must be practical, kind, and specific.
- safetyScore must be 0-100.
- improvedRewrite should preserve intent while improving clarity and emotional safety.

Scenario: ${scenarioTitle}
Category: ${scenarioCategory}
Context lens: ${semanticLens || "Not provided"}
Relationship goal: ${relationshipGoal || "Keep trust high while being clear"}

Speaker profile:
${JSON.stringify(sourceMember ?? { name: "Facilitator", role: "Coordinator" }, null, 2)}

Target member:
${JSON.stringify(targetMember, null, 2)}

Opening message from speaker to target:
${userMessage}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "teamsync_conversation_coach",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              memberReply: { type: "string" },
              coachFeedback: {
                type: "object",
                additionalProperties: false,
                properties: {
                  whatWorked: { type: "array", items: { type: "string" } },
                  whatToAdjust: { type: "array", items: { type: "string" } },
                  improvedRewrite: { type: "string" },
                  safetyScore: { type: "number" },
                },
                required: ["whatWorked", "whatToAdjust", "improvedRewrite", "safetyScore"],
              },
            },
            required: ["memberReply", "coachFeedback"],
          },
        },
      },
    })

    const parsed = JSON.parse(response.output_text || "{}") as {
      memberReply?: string
      coachFeedback?: {
        whatWorked?: string[]
        whatToAdjust?: string[]
        improvedRewrite?: string
        safetyScore?: number
      }
    }

    if (!normalizeText(parsed.memberReply)) {
      return NextResponse.json({ error: "Model did not return valid conversation output" }, { status: 500 })
    }

    return NextResponse.json({
      result: {
        memberReply: normalizeText(parsed.memberReply),
        coachFeedback: {
          whatWorked: Array.isArray(parsed.coachFeedback?.whatWorked) ? parsed.coachFeedback?.whatWorked : [],
          whatToAdjust: Array.isArray(parsed.coachFeedback?.whatToAdjust) ? parsed.coachFeedback?.whatToAdjust : [],
          improvedRewrite: normalizeText(parsed.coachFeedback?.improvedRewrite),
          safetyScore: Number.isFinite(parsed.coachFeedback?.safetyScore) ? Math.max(0, Math.min(100, Number(parsed.coachFeedback?.safetyScore))) : 70,
        },
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
