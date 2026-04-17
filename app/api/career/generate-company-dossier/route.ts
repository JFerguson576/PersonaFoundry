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

function buildSavedContent(payload: DossierPayload, sources: Array<{ title: string; url: string }>) {
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

    if (!candidateId || !companyName) {
      return NextResponse.json({ error: "candidate_id and company_name are required" }, { status: 400 })
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
      return NextResponse.json({ error: "Generate a career profile before creating a company dossier" }, { status: 400 })
    }

    const model = process.env.OPENAI_JOB_SEARCH_MODEL || process.env.OPENAI_MODEL || "gpt-5"

    const response = await openai.responses.create({
      model,
      reasoning: { effort: "medium" },
      tools: [{ type: "web_search" }],
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You are an elite company researcher and employer-brand analyst. Search the live web and build a practical company dossier for job application tailoring. Return JSON only.",
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

    if (!response.output_text?.trim()) {
      return NextResponse.json({ error: "Company research completed but no dossier content was returned. Please try again." }, { status: 502 })
    }

    const parsed = JSON.parse(response.output_text || "{}") as DossierPayload
    const usage = response.usage
    const sources = collectSources(response)
    const title = normalizeString(parsed.title) || `Company Dossier - ${companyName}`
    const content = buildSavedContent(parsed, sources)

    const { data: latestAsset } = await supabase
      .from("career_generated_assets")
      .select("version")
      .eq("candidate_id", candidateId)
      .eq("user_id", user.id)
      .eq("asset_type", "company_dossier")
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
          asset_type: "company_dossier",
          version: nextVersion,
          title,
          content,
          source_profile_id: profile.id,
        },
      ])
      .select("id, asset_type, version, title, content, created_at")
      .single()

    if (saveError) {
      return NextResponse.json({ error: `The dossier was generated but could not be saved: ${saveError.message}` }, { status: 400 })
    }

    await logUsageEvent(supabase, {
      userId: user.id,
      module: "career_advisor",
      eventType: "company_dossier_generated",
      candidateId,
      metadata: {
        company_name: companyName,
        job_title: jobTitle || null,
        source_count: sources.length,
      },
    })

    await logApiUsage(supabase, {
      userId: user.id,
      module: "career_advisor",
      feature: "company_dossier",
      model,
      status: "success",
      inputTokens: usage?.input_tokens ?? null,
      outputTokens: usage?.output_tokens ?? null,
      totalTokens: usage?.total_tokens ?? null,
      metadata: {
        candidate_id: candidateId,
        company_name: companyName,
        job_title: jobTitle || null,
        source_count: sources.length,
      },
    })

    return NextResponse.json({ asset: savedAsset })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
