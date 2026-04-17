import { NextResponse } from "next/server"
import OpenAI from "openai"
import { normalizeString } from "@/lib/career"
import { getRequestAuth } from "@/lib/supabase/auth"
import { createRouteClient } from "@/lib/supabase/route"
import { logApiUsage, logUsageEvent } from "@/lib/telemetry"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

function stringify(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2)
}

function normalizeDossierInfluence(value: unknown) {
  const normalized = normalizeString(value).toLowerCase()
  if (normalized === "low" || normalized === "medium" || normalized === "strong") {
    return normalized
  }
  return "medium"
}

function normalizeStrengthVoiceInfluence(value: unknown) {
  const normalized = normalizeString(value).toLowerCase()
  if (normalized === "low" || normalized === "medium" || normalized === "high" || normalized === "strong") {
    return normalized === "strong" ? "high" : normalized
  }
  return "medium"
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
    const jobTitle = normalizeString(body?.job_title)
    const companyName = normalizeString(body?.company_name)
    const jobDescription = normalizeString(body?.job_description)
    const useCompanyDossier = Boolean(body?.use_company_dossier)
    const dossierInfluence = normalizeDossierInfluence(body?.dossier_influence)
    const strengthVoiceInfluence = normalizeStrengthVoiceInfluence(body?.strength_voice_influence)

    if (!candidateId || !jobDescription) {
      return NextResponse.json({ error: "candidate_id and job_description are required" }, { status: 400 })
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
      return NextResponse.json({ error: "Generate a career profile before creating a cover letter" }, { status: 400 })
    }

    const { data: supportingAssets } = await supabase
      .from("career_generated_assets")
      .select("asset_type, title, content")
      .eq("candidate_id", candidateId)
      .eq("user_id", user.id)
      .in("asset_type", ["cv_summary", "cv_experience", "linkedin_headline", "linkedin_about"])
      .order("created_at", { ascending: false })

    const latestByType = new Map<string, { title: string | null; content: string | null }>()
    for (const asset of supportingAssets ?? []) {
      if (!asset.asset_type || latestByType.has(asset.asset_type)) continue
      latestByType.set(asset.asset_type, { title: asset.title, content: asset.content })
    }

    let companyDossier: { title: string | null; content: string | null } | null = null

    if (companyName && useCompanyDossier) {
      const { data: dossierAssets } = await supabase
        .from("career_generated_assets")
        .select("title, content, created_at")
        .eq("candidate_id", candidateId)
        .eq("user_id", user.id)
        .eq("asset_type", "company_dossier")
        .order("created_at", { ascending: false })
        .limit(10)

      const matchingDossier =
        (dossierAssets ?? []).find((asset) => normalizeString(asset.title).toLowerCase().includes(companyName.toLowerCase())) ?? dossierAssets?.[0] ?? null

      if (matchingDossier) {
        companyDossier = {
          title: matchingDossier.title,
          content: matchingDossier.content,
        }
      }
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
                "You are an elite career strategist writing tailored cover letters. Write persuasively, specifically, and credibly. Return JSON only.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Return JSON in this shape:
{
  "title": "string",
  "content": "string"
}

Rules:
- Use first person
- Make the letter tailored to the role and company
- Keep it concise, polished, and commercially strong
- Avoid generic filler
- Do not invent false experience
- If a company dossier is provided, follow the requested dossier influence level

Dossier influence guidance:
- low: borrow only a light amount of tone and wording from the dossier
- medium: clearly align to the company's language while keeping the candidate's natural voice
- strong: strongly mirror the company's public language, themes, and tone without sounding fake

Candidate:
${stringify(candidate)}

Positioning pack:
${stringify(profile)}

Supporting rewrite assets:
${stringify(Object.fromEntries(latestByType))}

Company dossier:
${stringify(companyDossier)}

Dossier settings:
${stringify({
  use_company_dossier: useCompanyDossier,
  dossier_influence: useCompanyDossier ? dossierInfluence : "off",
})}

Strength voice settings:
${stringify({
  strength_voice_influence: strengthVoiceInfluence,
  guidance:
    strengthVoiceInfluence === "low"
      ? "Use only light strengths language cues."
      : strengthVoiceInfluence === "high"
        ? "Strongly foreground Gallup strengths voice and signature style while staying credible."
        : "Balance strengths voice with neutral professional polish.",
})}

Target role:
${stringify({ jobTitle, companyName, jobDescription })}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "cover_letter",
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
    const title = normalizeString(parsed.title) || `Cover Letter${jobTitle ? ` - ${jobTitle}` : ""}`
    const content = normalizeString(parsed.content)

    if (!content) {
      return NextResponse.json({ error: "Model did not return a valid cover letter" }, { status: 500 })
    }

    const { data: latestAsset } = await supabase
      .from("career_generated_assets")
      .select("version")
      .eq("candidate_id", candidateId)
      .eq("user_id", user.id)
      .eq("asset_type", "cover_letter")
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
          asset_type: "cover_letter",
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
      eventType: "cover_letter_generated",
      candidateId,
      metadata: {
        job_title: jobTitle || null,
        company_name: companyName || null,
        use_company_dossier: useCompanyDossier,
        dossier_influence: useCompanyDossier ? dossierInfluence : null,
        strength_voice_influence: strengthVoiceInfluence,
      },
    })

    await logApiUsage(supabase, {
      userId: user.id,
      module: "career_advisor",
      feature: "cover_letter",
      model: process.env.OPENAI_CAREER_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini",
      status: "success",
      inputTokens: usage?.input_tokens ?? null,
      outputTokens: usage?.output_tokens ?? null,
      totalTokens: usage?.total_tokens ?? null,
      metadata: {
        candidate_id: candidateId,
        job_title: jobTitle || null,
        company_name: companyName || null,
        use_company_dossier: useCompanyDossier,
        dossier_influence: useCompanyDossier ? dossierInfluence : null,
        strength_voice_influence: strengthVoiceInfluence,
      },
    })

    return NextResponse.json({ asset: savedAsset })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
