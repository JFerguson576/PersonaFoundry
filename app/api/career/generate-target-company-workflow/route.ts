import { NextResponse } from "next/server"
import OpenAI from "openai"
import { normalizeString } from "@/lib/career"
import { getRequestAuth } from "@/lib/supabase/auth"
import { createRouteClient } from "@/lib/supabase/route"
import { logApiUsage, logUsageEvent } from "@/lib/telemetry"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

type DossierPayload = {
  title?: string
  company_summary?: string
  culture_signals?: string[]
  key_messages?: string[]
  tone_of_voice?: string[]
  hiring_story?: string[]
  application_implications?: string[]
}

function stringify(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2)
}

function normalizeUrl(value: unknown) {
  const url = normalizeString(value)
  return /^https?:\/\//i.test(url) ? url : ""
}

function collectSources(response: OpenAI.Responses.Response) {
  const seen = new Set<string>()
  const links: Array<{ title: string; url: string }> = []

  for (const item of response.output ?? []) {
    if (item.type !== "web_search_call") continue
    const sources = (item as unknown as { action?: { sources?: Array<{ title?: string; url?: string }> } }).action?.sources ?? []
    for (const source of sources) {
      const url = normalizeUrl(source?.url)
      if (!url || seen.has(url)) continue
      seen.add(url)
      links.push({
        title: normalizeString(source?.title) || url,
        url,
      })
    }
  }

  return links
}

function buildSection(title: string, items: string[] | undefined) {
  if (!items || items.length === 0) return `${title}\nNo clear signals were identified.`
  return `${title}\n${items.map((item, index) => `${index + 1}. ${normalizeString(item)}`).filter(Boolean).join("\n")}`
}

function buildDossierContent(payload: DossierPayload, sources: Array<{ title: string; url: string }>) {
  const sourceLines =
    sources.length > 0 ? sources.map((source, index) => `${index + 1}. ${source.title}\n${source.url}`).join("\n\n") : "No source links were captured."

  return `Company summary
${normalizeString(payload.company_summary) || "No summary returned."}

${buildSection("Culture signals", payload.culture_signals)}

${buildSection("Key messages", payload.key_messages)}

${buildSection("Tone of voice", payload.tone_of_voice)}

${buildSection("Hiring story", payload.hiring_story)}

${buildSection("How the candidate should adapt language", payload.application_implications)}

Source links
${sourceLines}`
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
    const companyName = normalizeString(body?.company_name)
    const companyWebsite = normalizeString(body?.company_website)
    const jobTitle = normalizeString(body?.job_title)
    const jobDescription = normalizeString(body?.job_description)
    const dossierInfluence = ["low", "medium", "strong"].includes(normalizeString(body?.dossier_influence).toLowerCase())
      ? normalizeString(body?.dossier_influence).toLowerCase()
      : "medium"

    if (!candidateId || !companyName || !jobDescription) {
      return NextResponse.json({ error: "candidate_id, company_name, and job_description are required" }, { status: 400 })
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
      return NextResponse.json({ error: "Generate a career profile before running the target company workflow" }, { status: 400 })
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

    const webModel = process.env.OPENAI_JOB_SEARCH_MODEL || process.env.OPENAI_MODEL || "gpt-5"
    const writingModel = process.env.OPENAI_CAREER_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini"

    const dossierResponse = await openai.responses.create({
      model: webModel,
      reasoning: { effort: "medium" },
      tools: [{ type: "web_search" }],
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You are an elite company researcher and employer-brand analyst. Search the live web and build a practical company dossier for job application tailoring. Return JSON only.",
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
  "title": "string",
  "company_summary": "string",
  "culture_signals": ["string"],
  "key_messages": ["string"],
  "tone_of_voice": ["string"],
  "hiring_story": ["string"],
  "application_implications": ["string"]
}

Rules:
- Search the live web for current public information
- Prefer the company website, careers pages, leadership pages, about pages, and recent public articles
- Focus on practical application value, not generic corporate fluff
- Explain the language, tone, and messages the candidate should mirror
- Do not invent information

Candidate:
${stringify(candidate)}

Positioning pack:
${stringify(profile)}

Target company:
${stringify({
  company_name: companyName,
  company_website: companyWebsite,
  job_title: jobTitle,
  job_description: jobDescription,
})}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "company_dossier",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              company_summary: { type: "string" },
              culture_signals: { type: "array", items: { type: "string" } },
              key_messages: { type: "array", items: { type: "string" } },
              tone_of_voice: { type: "array", items: { type: "string" } },
              hiring_story: { type: "array", items: { type: "string" } },
              application_implications: { type: "array", items: { type: "string" } },
            },
            required: ["title", "company_summary", "culture_signals", "key_messages", "tone_of_voice", "hiring_story", "application_implications"],
          },
        },
      },
    })

    const dossierParsed = JSON.parse(dossierResponse.output_text || "{}") as DossierPayload
    const dossierSources = collectSources(dossierResponse)
    const dossierTitle = normalizeString(dossierParsed.title) || `Company Dossier - ${companyName}`
    const dossierContent = buildDossierContent(dossierParsed, dossierSources)

    const coverLetterResponse = await openai.responses.create({
      model: writingModel,
      reasoning: { effort: "medium" },
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You are an elite career strategist writing tailored cover letters. Write persuasively, specifically, and credibly. Return JSON only.",
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
- Use the dossier influence setting below

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
${stringify({ title: dossierTitle, content: dossierContent })}

Dossier settings:
${stringify({ use_company_dossier: true, dossier_influence: dossierInfluence })}

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

    const coverLetterParsed = JSON.parse(coverLetterResponse.output_text || "{}") as { title?: string; content?: string }
    const coverLetterTitle = normalizeString(coverLetterParsed.title) || `Cover Letter${jobTitle ? ` - ${jobTitle}` : ""}`
    const coverLetterContent = normalizeString(coverLetterParsed.content)

    const interviewPrepResponse = await openai.responses.create({
      model: writingModel,
      reasoning: { effort: "medium" },
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You are an elite interview coach. Build interview prep that is specific to the role, commercially sharp, practical to rehearse, and grounded in the candidate profile. Return JSON only.",
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

The content should be well-structured plain text with these sections:
1. Top questions to expect
2. What the interviewer is testing
3. Strong answer angles for this candidate
4. Likely weak spots or objections
5. Smart questions for the candidate to ask

Rules:
- Keep the prep role-specific
- Use bullet points where helpful
- Do not invent fake experience
- Use the candidate positioning, company dossier, and existing drafts as support
- Make it something the candidate can actually practice from

Candidate:
${stringify(candidate)}

Positioning pack:
${stringify(profile)}

Supporting materials:
${stringify({
  ...Object.fromEntries(latestByType),
  company_dossier: { title: dossierTitle, content: dossierContent },
  cover_letter: { title: coverLetterTitle, content: coverLetterContent },
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
          name: "interview_prep",
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

    const interviewParsed = JSON.parse(interviewPrepResponse.output_text || "{}") as { title?: string; content?: string }
    const interviewTitle = normalizeString(interviewParsed.title) || `Interview Prep${jobTitle ? ` - ${jobTitle}` : ""}`
    const interviewContent = normalizeString(interviewParsed.content)

    if (!dossierContent || !coverLetterContent || !interviewContent) {
      return NextResponse.json({ error: "The workflow did not return all required outputs" }, { status: 500 })
    }

    const { data: existingAssets } = await supabase
      .from("career_generated_assets")
      .select("asset_type, version")
      .eq("candidate_id", candidateId)
      .eq("user_id", user.id)
      .in("asset_type", ["company_dossier", "cover_letter", "interview_prep"])

    const nextVersionFor = (assetType: string) =>
      ((existingAssets ?? [])
        .filter((asset) => asset.asset_type === assetType)
        .reduce((max, asset) => Math.max(max, Number(asset.version) || 0), 0) || 0) + 1

    const rowsToInsert = [
      {
        candidate_id: candidateId,
        user_id: user.id,
        asset_type: "company_dossier",
        version: nextVersionFor("company_dossier"),
        title: dossierTitle,
        content: dossierContent,
        source_profile_id: profile.id,
      },
      {
        candidate_id: candidateId,
        user_id: user.id,
        asset_type: "cover_letter",
        version: nextVersionFor("cover_letter"),
        title: coverLetterTitle,
        content: coverLetterContent,
        source_profile_id: profile.id,
      },
      {
        candidate_id: candidateId,
        user_id: user.id,
        asset_type: "interview_prep",
        version: nextVersionFor("interview_prep"),
        title: interviewTitle,
        content: interviewContent,
        source_profile_id: profile.id,
      },
    ]

    const { data: savedAssets, error: saveError } = await supabase
      .from("career_generated_assets")
      .insert(rowsToInsert)
      .select("id, asset_type, version, title, content, created_at")

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 400 })
    }

    const totalInputTokens =
      (dossierResponse.usage?.input_tokens ?? 0) + (coverLetterResponse.usage?.input_tokens ?? 0) + (interviewPrepResponse.usage?.input_tokens ?? 0)
    const totalOutputTokens =
      (dossierResponse.usage?.output_tokens ?? 0) + (coverLetterResponse.usage?.output_tokens ?? 0) + (interviewPrepResponse.usage?.output_tokens ?? 0)
    const totalTokens =
      (dossierResponse.usage?.total_tokens ?? 0) + (coverLetterResponse.usage?.total_tokens ?? 0) + (interviewPrepResponse.usage?.total_tokens ?? 0)

    await logUsageEvent(supabase, {
      userId: user.id,
      module: "career_advisor",
      eventType: "target_company_workflow_generated",
      candidateId,
      metadata: {
        company_name: companyName,
        job_title: jobTitle || null,
        asset_count: savedAssets?.length ?? 0,
        dossier_influence: dossierInfluence,
      },
    })

    await logApiUsage(supabase, {
      userId: user.id,
      module: "career_advisor",
      feature: "target_company_workflow",
      model: `${webModel} + ${writingModel}`,
      status: "success",
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens,
      metadata: {
        candidate_id: candidateId,
        company_name: companyName,
        job_title: jobTitle || null,
        asset_count: savedAssets?.length ?? 0,
        dossier_influence: dossierInfluence,
      },
    })

    return NextResponse.json({
      assets: savedAssets ?? [],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
