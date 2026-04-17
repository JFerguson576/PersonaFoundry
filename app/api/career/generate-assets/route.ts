import { NextResponse } from "next/server"
import OpenAI from "openai"
import { coreCareerAssetTypes, isCareerAssetType, normalizeString, type CareerAssetPayload, type CareerAssetType } from "@/lib/career"
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

type CareerProfileRow = {
  id: string
  career_identity: string | null
  market_positioning: string | null
  seniority_level: string | null
  core_strengths: string[] | null
  signature_achievements: string[] | null
  role_families: string[] | null
  skills: string[] | null
  risks_or_gaps: string[] | null
  recommended_target_roles: string[] | null
}

function buildDocumentContext(documents: CareerDocumentRow[]) {
  return documents
    .map((doc) => `SOURCE TYPE: ${doc.source_type ?? ""}\nTITLE: ${doc.title ?? ""}\n${doc.content_text ?? ""}`.trim())
    .join("\n\n--------------------\n\n")
}

function buildProfileContext(profile: CareerProfileRow) {
  return JSON.stringify(
    {
      career_identity: profile.career_identity,
      market_positioning: profile.market_positioning,
      seniority_level: profile.seniority_level,
      core_strengths: profile.core_strengths ?? [],
      signature_achievements: profile.signature_achievements ?? [],
      role_families: profile.role_families ?? [],
      skills: profile.skills ?? [],
      risks_or_gaps: profile.risks_or_gaps ?? [],
      recommended_target_roles: profile.recommended_target_roles ?? [],
    },
    null,
    2
  )
}

function coerceAssets(value: unknown): CareerAssetPayload[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null

      const record = item as Record<string, unknown>
      const assetType = record.asset_type

      if (!isCareerAssetType(assetType)) return null

      return {
        asset_type: assetType,
        title: normalizeString(record.title),
        content: normalizeString(record.content),
      }
    })
    .filter((item): item is CareerAssetPayload => Boolean(item?.title && item.content))
}

async function getNextVersions(supabase: ReturnType<typeof createRouteClient>, userId: string, candidateId: string) {
  const { data } = await supabase
    .from("career_generated_assets")
    .select("asset_type, version")
    .eq("candidate_id", candidateId)
    .eq("user_id", userId)

  const latestByType = new Map<CareerAssetType, number>()

  for (const asset of data ?? []) {
    if (!isCareerAssetType(asset.asset_type)) continue
    const current = latestByType.get(asset.asset_type) ?? 0
    latestByType.set(asset.asset_type, Math.max(current, Number(asset.version) || 0))
  }

  return latestByType
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

    const { data: candidate } = await supabase
      .from("career_candidates")
      .select("id, full_name, city, primary_goal")
      .eq("id", candidateId)
      .eq("user_id", user.id)
      .single()

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 })
    }

    const { data: latestProfile } = await supabase
      .from("career_candidate_profiles")
      .select("id, career_identity, market_positioning, seniority_level, core_strengths, signature_achievements, role_families, skills, risks_or_gaps, recommended_target_roles")
      .eq("candidate_id", candidateId)
      .eq("user_id", user.id)
      .order("profile_version", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!latestProfile) {
      return NextResponse.json({ error: "Generate a career profile before creating assets" }, { status: 400 })
    }

    const { data: documents } = await supabase
      .from("career_source_documents")
      .select("source_type, title, content_text")
      .eq("candidate_id", candidateId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true })

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
                "You are an expert executive career strategist and recruiter. Create practical, high-quality job-search assets based on the candidate profile and source material. Return only valid JSON.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Return a JSON object in this exact shape:
{
  "assets": [
    {
      "asset_type": "cv_summary" | "cv_experience" | "linkedin_headline" | "linkedin_about",
      "title": "string",
      "content": "string"
    }
  ]
}

The assets array must contain exactly these four asset types, in any order:
${JSON.stringify(coreCareerAssetTypes)}

Writing rules:
- CV summary: 3 to 5 lines, punchy and commercially credible
- CV experience: 5 to 7 bullet points that shift from responsibilities to outcomes, scale, ownership, and value
- LinkedIn headline: concise, keyword-rich, no fluff
- LinkedIn about: first person, confident, polished, readable, and aligned to the market positioning
- Use the positioning pack as the source of truth
- Do not invent implausible achievements

Candidate:
${JSON.stringify(candidate, null, 2)}

Latest positioning pack:
${buildProfileContext(latestProfile as CareerProfileRow)}

Source material:
${buildDocumentContext((documents ?? []) as CareerDocumentRow[])}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "career_assets",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              assets: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    asset_type: { type: "string", enum: [...coreCareerAssetTypes] },
                    title: { type: "string" },
                    content: { type: "string" },
                  },
                  required: ["asset_type", "title", "content"],
                },
              },
            },
            required: ["assets"],
          },
        },
      },
    })

    const parsed = JSON.parse(response.output_text || "{}") as { assets?: unknown }
    const assets = coerceAssets(parsed.assets)
    const usage = response.usage

    if (assets.length === 0) {
      return NextResponse.json({ error: "Model did not return valid assets" }, { status: 500 })
    }

    const latestByType = await getNextVersions(supabase, user.id, candidateId)

    const rowsToInsert = assets.map((asset) => ({
      candidate_id: candidateId,
      user_id: user.id,
      asset_type: asset.asset_type,
      version: (latestByType.get(asset.asset_type) ?? 0) + 1,
      title: asset.title,
      content: asset.content,
      source_profile_id: latestProfile.id,
    }))

    const { data: savedAssets, error: saveError } = await supabase
      .from("career_generated_assets")
      .insert(rowsToInsert)
      .select("id, asset_type, version, title, content, created_at")

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 400 })
    }

    await logUsageEvent(supabase, {
      userId: user.id,
      module: "career_advisor",
      eventType: "career_drafts_generated",
      candidateId,
      metadata: {
        asset_count: savedAssets?.length ?? 0,
      },
    })

    await logApiUsage(supabase, {
      userId: user.id,
      module: "career_advisor",
      feature: "career_drafts",
      model: process.env.OPENAI_CAREER_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini",
      status: "success",
      inputTokens: usage?.input_tokens ?? null,
      outputTokens: usage?.output_tokens ?? null,
      totalTokens: usage?.total_tokens ?? null,
      metadata: {
        candidate_id: candidateId,
        asset_count: savedAssets?.length ?? 0,
      },
    })

    return NextResponse.json({ assets: savedAssets ?? [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
