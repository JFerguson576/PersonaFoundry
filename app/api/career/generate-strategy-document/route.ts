import { NextResponse } from "next/server"
import OpenAI from "openai"
import { normalizeString, type CareerAssetType } from "@/lib/career"
import { getRequestAuth } from "@/lib/supabase/auth"
import { createRouteClient } from "@/lib/supabase/route"
import { logApiUsage, logUsageEvent } from "@/lib/telemetry"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const supportedStrategyAssetTypes = ["executive_interview_playbook", "interview_training_pack", "job_hit_list"] as const

type SupportedStrategyAssetType = (typeof supportedStrategyAssetTypes)[number]

function stringify(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2)
}

function isSupportedStrategyAssetType(value: string): value is SupportedStrategyAssetType {
  return supportedStrategyAssetTypes.includes(value as SupportedStrategyAssetType)
}

function buildPrompt(
  assetType: SupportedStrategyAssetType,
  payload: {
    candidate: unknown
    profile: unknown
    supportingAssets: Record<string, { title: string | null; content: string | null }>
    jobTitle: string
    companyName: string
    jobDescription: string
    targetLocation: string
    targetCompanies: string
    marketNotes: string
  }
) {
  const sharedContext = `Candidate:
${stringify(payload.candidate)}

Positioning pack:
${stringify(payload.profile)}

Supporting assets:
${stringify(payload.supportingAssets)}`

  if (assetType === "executive_interview_playbook") {
    return `Return JSON in this shape:
{
  "title": "string",
  "content": "string"
}

Create a polished executive interview playbook in plain text with these sections:
1. Positioning statement
2. What I do best
3. Interview story bank
4. Interview question bank
5. 90-day plan summary
6. Executive language prompts
7. Follow-up note template
8. Self-check before any interview

Rules:
- Make it specific to the target role
- Keep the tone commercially strong and credible
- Give the candidate language they can actually use
- Do not invent fake experience

${sharedContext}

Target role:
${stringify({
  jobTitle: payload.jobTitle,
  companyName: payload.companyName,
  jobDescription: payload.jobDescription,
})}`
  }

  if (assetType === "interview_training_pack") {
    return `Return JSON in this shape:
{
  "title": "string",
  "content": "string"
}

Create a practical interview training pack in plain text with these sections:
1. Core story framework
2. Five core stories to master
3. Sample answer to "Tell me about your leadership style"
4. High-probability questions
5. Daily drill
6. Final strategic note

Rules:
- Make it role-specific and easy to rehearse from
- Emphasize storytelling, confidence, and answer structure
- Include daily practice prompts the candidate can use immediately
- Do not invent fake experience

${sharedContext}

Target role:
${stringify({
  jobTitle: payload.jobTitle,
  companyName: payload.companyName,
  jobDescription: payload.jobDescription,
})}`
  }

  return `Return JSON in this shape:
{
  "title": "string",
  "content": "string"
}

Create a targeted job search hit list in plain text with these sections:
1. Search focus
2. Priority target companies or employer types
3. Role titles to pursue
4. Outreach angles
5. Weekly activity plan
6. Tracking checklist

Rules:
- This is a strategic pursuit list, not a live web scrape
- If company names or market notes are provided, incorporate them
- Focus on realistic roles for this candidate
- Keep it practical and action-oriented

${sharedContext}

Market targeting:
${stringify({
  targetRole: payload.jobTitle,
  targetLocation: payload.targetLocation,
  targetCompanies: payload.targetCompanies,
  marketNotes: payload.marketNotes,
})}`
}

function getDefaultTitle(assetType: SupportedStrategyAssetType, jobTitle: string, targetLocation: string) {
  if (assetType === "executive_interview_playbook") {
    return `Executive Interview Playbook${jobTitle ? ` - ${jobTitle}` : ""}`
  }

  if (assetType === "interview_training_pack") {
    return `Interview Training Pack${jobTitle ? ` - ${jobTitle}` : ""}`
  }

  return `Job Hit List${jobTitle ? ` - ${jobTitle}` : ""}${targetLocation ? ` (${targetLocation})` : ""}`
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
    const assetType = normalizeString(body?.asset_type)
    const jobTitle = normalizeString(body?.job_title)
    const companyName = normalizeString(body?.company_name)
    const jobDescription = normalizeString(body?.job_description)
    const targetLocation = normalizeString(body?.target_location)
    const targetCompanies = normalizeString(body?.target_companies)
    const marketNotes = normalizeString(body?.market_notes)

    if (!candidateId || !assetType) {
      return NextResponse.json({ error: "candidate_id and asset_type are required" }, { status: 400 })
    }

    if (!isSupportedStrategyAssetType(assetType)) {
      return NextResponse.json({ error: "Unsupported strategy document type" }, { status: 400 })
    }

    if ((assetType === "executive_interview_playbook" || assetType === "interview_training_pack") && !jobDescription) {
      return NextResponse.json({ error: "job_description is required for interview documents" }, { status: 400 })
    }

    if (assetType === "job_hit_list" && !jobTitle && !targetCompanies && !marketNotes) {
      return NextResponse.json({ error: "Add a target role, company list, or market notes for the hit list" }, { status: 400 })
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

    const { data: profile } = await supabase
      .from("career_candidate_profiles")
      .select("id, career_identity, market_positioning, seniority_level, core_strengths, signature_achievements, role_families, skills, risks_or_gaps, recommended_target_roles")
      .eq("candidate_id", candidateId)
      .eq("user_id", user.id)
      .order("profile_version", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: "Generate a career profile before creating strategy documents" }, { status: 400 })
    }

    const { data: supportingAssets } = await supabase
      .from("career_generated_assets")
      .select("asset_type, title, content")
      .eq("candidate_id", candidateId)
      .eq("user_id", user.id)
      .in("asset_type", ["cv_summary", "cv_experience", "linkedin_headline", "linkedin_about", "cover_letter", "interview_prep"])
      .order("created_at", { ascending: false })

    const latestByType = new Map<string, { title: string | null; content: string | null }>()
    for (const asset of supportingAssets ?? []) {
      if (!asset.asset_type || latestByType.has(asset.asset_type)) continue
      latestByType.set(asset.asset_type, { title: asset.title, content: asset.content })
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
                "You are an elite executive career strategist. Create practical, well-structured career documents that a candidate can use immediately. Return JSON only.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildPrompt(assetType, {
                candidate,
                profile,
                supportingAssets: Object.fromEntries(latestByType),
                jobTitle,
                companyName,
                jobDescription,
                targetLocation,
                targetCompanies,
                marketNotes,
              }),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "career_strategy_document",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              content: { type: "string" },
            },
            required: ["title", "content"],
          },
        },
      },
    })

    const parsed = JSON.parse(response.output_text || "{}") as { title?: string; content?: string }
    const usage = response.usage
    const title = normalizeString(parsed.title) || getDefaultTitle(assetType, jobTitle, targetLocation)
    const content = normalizeString(parsed.content)

    if (!content) {
      return NextResponse.json({ error: "Model did not return a valid strategy document" }, { status: 500 })
    }

    const { data: latestAsset } = await supabase
      .from("career_generated_assets")
      .select("version")
      .eq("candidate_id", candidateId)
      .eq("user_id", user.id)
      .eq("asset_type", assetType)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextVersion = typeof latestAsset?.version === "number" ? latestAsset.version + 1 : 1

    const { data: savedAsset, error: saveError } = await supabase
      .from("career_generated_assets")
      .insert([
        {
          candidate_id: candidateId,
          user_id: user.id,
          asset_type: assetType as CareerAssetType,
          version: nextVersion,
          title,
          content,
          source_profile_id: profile.id,
        },
      ])
      .select("id, asset_type, version, title, content, created_at")
      .single()

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 400 })
    }

    await logUsageEvent(supabase, {
      userId: user.id,
      module: "career_advisor",
      eventType: "strategy_document_generated",
      candidateId,
      metadata: {
        asset_type: assetType,
        job_title: jobTitle || null,
        company_name: companyName || null,
        target_location: targetLocation || null,
      },
    })

    await logApiUsage(supabase, {
      userId: user.id,
      module: "career_advisor",
      feature: assetType,
      model: process.env.OPENAI_CAREER_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini",
      status: "success",
      inputTokens: usage?.input_tokens ?? null,
      outputTokens: usage?.output_tokens ?? null,
      totalTokens: usage?.total_tokens ?? null,
      metadata: {
        candidate_id: candidateId,
        asset_type: assetType,
        job_title: jobTitle || null,
        company_name: companyName || null,
        target_location: targetLocation || null,
      },
    })

    return NextResponse.json({ asset: savedAsset })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
