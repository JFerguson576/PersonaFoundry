import { NextResponse } from "next/server"
import OpenAI from "openai"
import { coerceCareerProfile, normalizeString } from "@/lib/career"
import { getRequestAuth } from "@/lib/supabase/auth"
import { createRouteClient } from "@/lib/supabase/route"
import { logApiUsage, logUsageEvent } from "@/lib/telemetry"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

type CareerDocumentRow = {
  source_type: string | null
  title: string | null
  content_text: string | null
}

function buildCombinedText(documents: CareerDocumentRow[]) {
  return documents
    .map((doc) => {
      return `SOURCE TYPE: ${doc.source_type ?? ""}\nTITLE: ${doc.title ?? ""}\n\n${doc.content_text ?? ""}`.trim()
    })
    .join("\n\n--------------------\n\n")
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 })
    }

    const { user, accessToken, errorMessage } = await getRequestAuth(req)

    if (!user) {
      return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
    }

    const supabase = createRouteClient(accessToken ?? undefined)

    const body = await req.json()
    const candidateId = normalizeString(body?.candidate_id)

    if (!candidateId) {
      return NextResponse.json({ error: "candidate_id is required" }, { status: 400 })
    }

    const { data: candidate, error: candidateError } = await supabase
      .from("career_candidates")
      .select("id")
      .eq("id", candidateId)
      .eq("user_id", user.id)
      .single()

    if (candidateError || !candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 })
    }

    const { data: documents, error: docsError } = await supabase
      .from("career_source_documents")
      .select("source_type, title, content_text")
      .eq("candidate_id", candidateId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true })

    if (docsError) {
      return NextResponse.json({ error: docsError.message }, { status: 400 })
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({ error: "No source documents found for this candidate" }, { status: 400 })
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
                "You are an elite executive career strategist. Analyze candidate material and return only valid JSON with a commercially sharp repositioning. Be evidence-based, concise, and constructive.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Return JSON in this exact shape:
{
  "career_identity": "string",
  "market_positioning": "string",
  "seniority_level": "string",
  "core_strengths": ["string"],
  "signature_achievements": ["string"],
  "role_families": ["string"],
  "skills": ["string"],
  "risks_or_gaps": ["string"],
  "recommended_target_roles": ["string"]
}

Guidelines:
- career_identity should reposition the person clearly and commercially
- market_positioning should explain how they should be seen in the market
- seniority_level should be a practical level such as Manager, Senior Manager, Head of, Director, or Executive
- strengths and achievements should be concise and evidence-based where possible
- risks_or_gaps should be constructive, not harsh
- recommended_target_roles should be realistic and useful

Candidate material:
${buildCombinedText(documents)}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "career_profile",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              career_identity: { type: "string" },
              market_positioning: { type: "string" },
              seniority_level: { type: "string" },
              core_strengths: { type: "array", items: { type: "string" } },
              signature_achievements: { type: "array", items: { type: "string" } },
              role_families: { type: "array", items: { type: "string" } },
              skills: { type: "array", items: { type: "string" } },
              risks_or_gaps: { type: "array", items: { type: "string" } },
              recommended_target_roles: { type: "array", items: { type: "string" } },
            },
            required: [
              "career_identity",
              "market_positioning",
              "seniority_level",
              "core_strengths",
              "signature_achievements",
              "role_families",
              "skills",
              "risks_or_gaps",
              "recommended_target_roles",
            ],
          },
        },
      },
    })

    const profile = coerceCareerProfile(JSON.parse(response.output_text || "{}"))
    const usage = response.usage

    if (!profile.career_identity) {
      return NextResponse.json({ error: "Model did not return a valid profile" }, { status: 500 })
    }

    const { data: latestProfile } = await supabase
      .from("career_candidate_profiles")
      .select("profile_version")
      .eq("candidate_id", candidateId)
      .eq("user_id", user.id)
      .order("profile_version", { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextVersion = typeof latestProfile?.profile_version === "number" ? latestProfile.profile_version + 1 : 1

    const { data: savedProfile, error: saveError } = await supabase
      .from("career_candidate_profiles")
      .insert([
        {
          candidate_id: candidateId,
          user_id: user.id,
          profile_version: nextVersion,
          career_identity: profile.career_identity,
          market_positioning: profile.market_positioning,
          seniority_level: profile.seniority_level,
          core_strengths: profile.core_strengths,
          signature_achievements: profile.signature_achievements,
          role_families: profile.role_families,
          skills: profile.skills,
          risks_or_gaps: profile.risks_or_gaps,
          recommended_target_roles: profile.recommended_target_roles,
        },
      ])
      .select()
      .single()

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 400 })
    }

    await logUsageEvent(supabase, {
      userId: user.id,
      module: "career_advisor",
      eventType: "career_positioning_generated",
      candidateId,
      metadata: {
        profile_version: savedProfile.profile_version,
      },
    })

    await logApiUsage(supabase, {
      userId: user.id,
      module: "career_advisor",
      feature: "career_positioning",
      model: process.env.OPENAI_CAREER_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini",
      status: "success",
      inputTokens: usage?.input_tokens ?? null,
      outputTokens: usage?.output_tokens ?? null,
      totalTokens: usage?.total_tokens ?? null,
      metadata: {
        candidate_id: candidateId,
      },
    })

    return NextResponse.json({ profile: savedProfile })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
