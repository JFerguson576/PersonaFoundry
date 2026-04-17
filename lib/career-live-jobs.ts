import OpenAI from "openai"
import { normalizeString } from "@/lib/career"
import { logApiUsage, logUsageEvent } from "@/lib/telemetry"
import type { createRouteClient } from "@/lib/supabase/route"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

type Opportunity = {
  title?: string
  company?: string
  location?: string
  why_fit?: string
  apply_url?: string
}

type SearchPayload = {
  title?: string
  search_summary?: string
  opportunities?: Opportunity[]
  next_steps?: string[]
}

type SupabaseLike = ReturnType<typeof createRouteClient>

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

function buildSavedContent(payload: SearchPayload, sources: Array<{ title: string; url: string }>) {
  const opportunityLines =
    payload.opportunities && payload.opportunities.length > 0
      ? payload.opportunities
          .map((job, index) => {
            const header = `${index + 1}. ${normalizeString(job.title) || "Untitled role"}${normalizeString(job.company) ? ` | ${normalizeString(job.company)}` : ""}${normalizeString(job.location) ? ` | ${normalizeString(job.location)}` : ""}`
            const whyFit = normalizeString(job.why_fit)
            const applyUrl = normalizeUrl(job.apply_url)

            return [header, whyFit ? `Why it fits: ${whyFit}` : "", applyUrl ? `Apply: ${applyUrl}` : ""].filter(Boolean).join("\n")
          })
          .join("\n\n")
      : "No strong live opportunities were returned."

  const nextSteps =
    payload.next_steps && payload.next_steps.length > 0
      ? payload.next_steps.map((step, index) => `${index + 1}. ${normalizeString(step)}`).filter(Boolean).join("\n")
      : "1. Refine the role title or location and run another search."

  const sourceLines =
    sources.length > 0
      ? sources.map((source, index) => `${index + 1}. ${source.title}\n${source.url}`).join("\n\n")
      : "No source links were captured."

  return `Search summary
${normalizeString(payload.search_summary) || "Live search completed."}

Best-fit live opportunities
${opportunityLines}

Recommended next steps
${nextSteps}

Source links
${sourceLines}`
}

export async function runLiveJobSearch(params: {
  supabase: SupabaseLike
  userId: string
  candidateId: string
  targetRole: string
  location?: string
  marketNotes?: string
}) {
  const { supabase, userId, candidateId, targetRole, location = "", marketNotes = "" } = params

  const { data: candidateRow } = await supabase
    .from("career_candidates")
    .select("id, full_name, city, primary_goal")
    .eq("id", candidateId)
    .eq("user_id", userId)
    .single()

  if (!candidateRow) {
    throw new Error("Candidate not found")
  }
  const candidate = candidateRow as {
    id: string
    full_name?: string
    city?: string
    primary_goal?: string
  }

  const { data: profileRow } = await supabase
    .from("career_candidate_profiles")
    .select("id, career_identity, market_positioning, seniority_level, core_strengths, signature_achievements, role_families, skills, risks_or_gaps, recommended_target_roles")
    .eq("candidate_id", candidateId)
    .eq("user_id", userId)
    .order("profile_version", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!profileRow) {
    throw new Error("Generate a career profile before running live job search")
  }
  const profile = profileRow as {
    id: string
    [key: string]: unknown
  }

  const { data: supportingAssets } = await supabase
    .from("career_generated_assets")
    .select("asset_type, title, content")
    .eq("candidate_id", candidateId)
    .eq("user_id", userId)
    .in("asset_type", ["cv_summary", "cv_experience", "linkedin_headline", "linkedin_about", "cover_letter", "interview_prep"])
    .order("created_at", { ascending: false })

  const latestByType = new Map<string, { title: string | null; content: string | null }>()
  const supportingAssetRows = (supportingAssets ?? []) as Array<{
    asset_type?: string
    title?: string | null
    content?: string | null
  }>

  for (const asset of supportingAssetRows) {
    if (!asset.asset_type || latestByType.has(asset.asset_type)) continue
    latestByType.set(asset.asset_type, { title: asset.title, content: asset.content })
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
              "You are an expert executive recruiter. Search the live web for current public job listings that genuinely fit the candidate and return JSON only.",
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
  "search_summary": "string",
  "opportunities": [
    {
      "title": "string",
      "company": "string",
      "location": "string",
      "why_fit": "string",
      "apply_url": "string"
    }
  ],
  "next_steps": ["string"]
}

Search for current public job listings, not generic company pages.

Rules:
- Focus on best-fit roles only
- Prefer current listings with an application or view-job URL
- Return 5 to 8 opportunities when possible
- Keep why_fit concise and grounded in the candidate profile
- Use the target role and location as the main search anchor
- Do not invent listings

Candidate:
${stringify(candidate)}

Positioning pack:
${stringify(profile)}

Supporting assets:
${stringify(Object.fromEntries(latestByType))}

Search target:
${stringify({
  target_role: targetRole,
  location,
  market_notes: marketNotes,
})}`,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "live_job_search",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            search_summary: { type: "string" },
            opportunities: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  title: { type: "string" },
                  company: { type: "string" },
                  location: { type: "string" },
                  why_fit: { type: "string" },
                  apply_url: { type: "string" },
                },
                required: ["title", "company", "location", "why_fit", "apply_url"],
              },
            },
            next_steps: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["title", "search_summary", "opportunities", "next_steps"],
        },
      },
    },
  })

  const parsed = JSON.parse(response.output_text || "{}") as SearchPayload
  const usage = response.usage
  const sources = collectSources(response)
  const title = normalizeString(parsed.title) || `Live Job Search - ${targetRole}`
  const content = buildSavedContent(parsed, sources)

  const { data: latestAssetRow } = await supabase
    .from("career_generated_assets")
    .select("version")
    .eq("candidate_id", candidateId)
    .eq("user_id", userId)
    .eq("asset_type", "live_job_search")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()

  const latestAsset = latestAssetRow as { version?: unknown } | null
  const nextVersion = typeof latestAsset?.version === "number" ? latestAsset.version + 1 : 1

  const { data: savedAsset, error: saveError } = await supabase
    .from("career_generated_assets")
    .insert([
      {
        candidate_id: candidateId,
        user_id: userId,
        asset_type: "live_job_search",
        version: nextVersion,
        title,
        content,
        source_profile_id: profile.id,
      },
    ])
    .select("id, asset_type, version, title, content, created_at")
    .single()

  if (saveError) {
    throw new Error(saveError.message)
  }

  await logUsageEvent(supabase, {
    userId,
    module: "career_advisor",
    eventType: "live_job_search_generated",
    candidateId,
    metadata: {
      target_role: targetRole,
      location: location || null,
      source_count: sources.length,
    },
  })

  await logApiUsage(supabase, {
    userId,
    module: "career_advisor",
    feature: "live_job_search",
    model,
    status: "success",
    inputTokens: usage?.input_tokens ?? null,
    outputTokens: usage?.output_tokens ?? null,
    totalTokens: usage?.total_tokens ?? null,
    metadata: {
      candidate_id: candidateId,
      target_role: targetRole,
      location: location || null,
      source_count: sources.length,
    },
  })

  return {
    asset: savedAsset,
    sourceCount: sources.length,
  }
}
