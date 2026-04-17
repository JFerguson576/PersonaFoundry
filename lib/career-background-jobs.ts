import OpenAI from "openai"
import {
  coerceCareerProfile,
  coreCareerAssetTypes,
  isCareerAssetType,
  normalizeString,
  type CareerAssetPayload,
  type CareerAssetType,
} from "@/lib/career"
import { runLiveJobSearch } from "@/lib/career-live-jobs"
import { createAdminClient } from "@/lib/supabase/admin"
import { logApiUsage, logUsageEvent } from "@/lib/telemetry"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

type AdminClient = ReturnType<typeof createAdminClient>

type BackgroundJobType =
  | "generate_profile"
  | "generate_assets"
  | "generate_company_dossier"
  | "generate_outreach_strategy"
  | "generate_cover_letter"
  | "generate_interview_prep"
  | "generate_strategy_document"
  | "generate_target_company_workflow"
  | "generate_application_sprint"
  | "generate_deep_prospect_research"
  | "generate_recruiter_match_search"
  | "generate_salary_analysis"
  | "generate_course_recommendations"
  | "generate_application_fit_analysis"
  | "generate_premium_weekly_autopilot"

type BackgroundJobRow = {
  id: string
  candidate_id: string
  user_id: string
  job_type: BackgroundJobType
  request_payload: Record<string, unknown> | null
}

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

type SupportedStrategyAssetType = "executive_interview_playbook" | "interview_training_pack" | "job_hit_list"

function stringify(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2)
}

function buildCombinedText(documents: CareerDocumentRow[]) {
  return documents
    .map((doc) => `SOURCE TYPE: ${doc.source_type ?? ""}\nTITLE: ${doc.title ?? ""}\n\n${doc.content_text ?? ""}`.trim())
    .join("\n\n--------------------\n\n")
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

async function getCandidate(supabase: AdminClient, userId: string, candidateId: string) {
  const { data } = await supabase
    .from("career_candidates")
    .select("id, full_name, city, primary_goal")
    .eq("id", candidateId)
    .eq("user_id", userId)
    .single()

  if (!data) {
    throw new Error("Candidate not found")
  }

  return data
}

async function getLatestProfile(supabase: AdminClient, userId: string, candidateId: string) {
  const { data } = await supabase
    .from("career_candidate_profiles")
    .select("id, career_identity, market_positioning, seniority_level, core_strengths, signature_achievements, role_families, skills, risks_or_gaps, recommended_target_roles, profile_version")
    .eq("candidate_id", candidateId)
    .eq("user_id", userId)
    .order("profile_version", { ascending: false })
    .limit(1)
    .maybeSingle()

  return data as (CareerProfileRow & { profile_version?: number | null }) | null
}

async function getLatestGeneratedAssetsByType(
  supabase: AdminClient,
  userId: string,
  candidateId: string,
  assetTypes: string[]
) {
  const { data } = await supabase
    .from("career_generated_assets")
    .select("asset_type, title, content, created_at")
    .eq("candidate_id", candidateId)
    .eq("user_id", userId)
    .in("asset_type", assetTypes)
    .order("created_at", { ascending: false })

  const latestByType = new Map<string, { title: string | null; content: string | null }>()
  for (const asset of data ?? []) {
    if (!asset.asset_type || latestByType.has(asset.asset_type)) continue
    latestByType.set(asset.asset_type, { title: asset.title, content: asset.content })
  }

  return latestByType
}

async function getNextAssetVersion(supabase: AdminClient, userId: string, candidateId: string, assetType: string) {
  const { data } = await supabase
    .from("career_generated_assets")
    .select("version")
    .eq("candidate_id", candidateId)
    .eq("user_id", userId)
    .eq("asset_type", assetType)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()

  return typeof data?.version === "number" ? data.version + 1 : 1
}

async function saveSingleAsset(params: {
  supabase: AdminClient
  userId: string
  candidateId: string
  profileId: string
  assetType: CareerAssetType
  title: string
  content: string
}) {
  const nextVersion = await getNextAssetVersion(params.supabase, params.userId, params.candidateId, params.assetType)
  const { data, error } = await params.supabase
    .from("career_generated_assets")
    .insert([
      {
        candidate_id: params.candidateId,
        user_id: params.userId,
        asset_type: params.assetType,
        version: nextVersion,
        title: params.title,
        content: params.content,
        source_profile_id: params.profileId,
      },
    ])
    .select("id, asset_type, version, title, content, created_at")
    .single()

  if (error) throw new Error(error.message)
  return data
}

async function getLatestAssetIdForType(
  supabase: AdminClient,
  userId: string,
  candidateId: string,
  assetType: CareerAssetType,
  titleHint?: string
) {
  const { data } = await supabase
    .from("career_generated_assets")
    .select("id, title, created_at")
    .eq("candidate_id", candidateId)
    .eq("user_id", userId)
    .eq("asset_type", assetType)
    .order("created_at", { ascending: false })
    .limit(10)

  const normalizedHint = normalizeString(titleHint).toLowerCase()
  const match =
    (data ?? []).find((asset) => {
      if (!normalizedHint) return false
      return normalizeString(asset.title).toLowerCase().includes(normalizedHint)
    }) ??
    data?.[0] ??
    null

  return match?.id ?? null
}

async function upsertSprintApplication(params: {
  supabase: AdminClient
  userId: string
  candidateId: string
  companyName: string
  jobTitle: string
  location: string
  jobUrl: string
  notes: string
  coverLetterAssetId: string | null
  companyDossierAssetId: string | null
  salaryAnalysisAssetId: string | null
  fitAnalysisAssetId: string | null
}) {
  const {
    supabase,
    userId,
    candidateId,
    companyName,
    jobTitle,
    location,
    jobUrl,
    notes,
    coverLetterAssetId,
    companyDossierAssetId,
    salaryAnalysisAssetId,
    fitAnalysisAssetId,
  } = params

  const { data: existing } = await supabase
    .from("career_job_applications")
    .select("id")
    .eq("candidate_id", candidateId)
    .eq("user_id", userId)
    .eq("job_title", jobTitle)
    .eq("company_name", companyName || null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const payload = {
    candidate_id: candidateId,
    user_id: userId,
    company_name: companyName || null,
    job_title: jobTitle,
    location: location || null,
    job_url: jobUrl || null,
    status: "saved",
    notes: notes || null,
    cover_letter_asset_id: coverLetterAssetId,
    company_dossier_asset_id: companyDossierAssetId,
    salary_analysis_asset_id: salaryAnalysisAssetId,
    fit_analysis_asset_id: fitAnalysisAssetId,
  }

  if (existing?.id) {
    const { error } = await supabase
      .from("career_job_applications")
      .update(payload)
      .eq("id", existing.id)
      .eq("candidate_id", candidateId)
      .eq("user_id", userId)

    if (error) throw new Error(error.message)
    return existing.id
  }

  const { data: created, error } = await supabase
    .from("career_job_applications")
    .insert([payload])
    .select("id")
    .single()

  if (error) throw new Error(error.message)
  return created.id
}

async function runGenerateProfile(supabase: AdminClient, userId: string, candidateId: string) {
  const { data: documents } = await supabase
    .from("career_source_documents")
    .select("source_type, title, content_text")
    .eq("candidate_id", candidateId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })

  if (!documents || documents.length === 0) {
    throw new Error("No source documents found for this candidate")
  }

  const response = await openai.responses.create({
    model: process.env.OPENAI_CAREER_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini",
    reasoning: { effort: "medium" },
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: "You are an elite executive career strategist. Analyze candidate material and return only valid JSON with a commercially sharp repositioning. Be evidence-based, concise, and constructive." }],
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

Candidate material:
${buildCombinedText(documents as CareerDocumentRow[])}`,
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
          required: ["career_identity", "market_positioning", "seniority_level", "core_strengths", "signature_achievements", "role_families", "skills", "risks_or_gaps", "recommended_target_roles"],
        },
      },
    },
  })

  const profile = coerceCareerProfile(JSON.parse(response.output_text || "{}"))
  if (!profile.career_identity) {
    throw new Error("Model did not return a valid profile")
  }

  const latestProfile = await getLatestProfile(supabase, userId, candidateId)
  const nextVersion = typeof latestProfile?.profile_version === "number" ? latestProfile.profile_version + 1 : 1

  const { data, error } = await supabase
    .from("career_candidate_profiles")
    .insert([
      {
        candidate_id: candidateId,
        user_id: userId,
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

  if (error) throw new Error(error.message)

  await logUsageEvent(supabase, { userId, module: "career_advisor", eventType: "career_positioning_generated", candidateId, metadata: { profile_version: data.profile_version } })
  await logApiUsage(supabase, {
    userId,
    module: "career_advisor",
    feature: "career_positioning",
    model: process.env.OPENAI_CAREER_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini",
    status: "success",
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
    totalTokens: response.usage?.total_tokens ?? null,
    metadata: { candidate_id: candidateId },
  })

  return `Positioning version ${data.profile_version} generated`
}

async function runGenerateAssets(supabase: AdminClient, userId: string, candidateId: string) {
  const candidate = await getCandidate(supabase, userId, candidateId)
  const latestProfile = await getLatestProfile(supabase, userId, candidateId)
  if (!latestProfile) throw new Error("Generate a career profile before creating assets")

  const { data: documents } = await supabase
    .from("career_source_documents")
    .select("source_type, title, content_text")
    .eq("candidate_id", candidateId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })

  const response = await openai.responses.create({
    model: process.env.OPENAI_CAREER_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini",
    reasoning: { effort: "medium" },
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: "You are an expert executive career strategist and recruiter. Create practical, high-quality job-search assets based on the candidate profile and source material. Return only valid JSON." }],
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

Candidate:
${JSON.stringify(candidate, null, 2)}

Latest positioning pack:
${buildProfileContext(latestProfile)}

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
  if (assets.length === 0) throw new Error("Model did not return valid assets")

  const { data: currentAssets } = await supabase
    .from("career_generated_assets")
    .select("asset_type, version")
    .eq("candidate_id", candidateId)
    .eq("user_id", userId)

  const latestByType = new Map<CareerAssetType, number>()
  for (const asset of currentAssets ?? []) {
    if (!isCareerAssetType(asset.asset_type)) continue
    latestByType.set(asset.asset_type, Math.max(latestByType.get(asset.asset_type) ?? 0, Number(asset.version) || 0))
  }

  const rows = assets.map((asset) => ({
    candidate_id: candidateId,
    user_id: userId,
    asset_type: asset.asset_type,
    version: (latestByType.get(asset.asset_type) ?? 0) + 1,
    title: asset.title,
    content: asset.content,
    source_profile_id: latestProfile.id,
  }))

  const { data: savedAssets, error } = await supabase.from("career_generated_assets").insert(rows).select("id")
  if (error) throw new Error(error.message)

  await logUsageEvent(supabase, { userId, module: "career_advisor", eventType: "career_drafts_generated", candidateId, metadata: { asset_count: savedAssets?.length ?? 0 } })
  await logApiUsage(supabase, {
    userId,
    module: "career_advisor",
    feature: "career_drafts",
    model: process.env.OPENAI_CAREER_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini",
    status: "success",
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
    totalTokens: response.usage?.total_tokens ?? null,
    metadata: { candidate_id: candidateId, asset_count: savedAssets?.length ?? 0 },
  })

  return `${savedAssets?.length ?? assets.length} core drafts generated`
}

function normalizeDossierInfluence(value: unknown) {
  const normalized = normalizeString(value).toLowerCase()
  if (normalized === "low" || normalized === "medium" || normalized === "strong") return normalized
  return "medium"
}

function normalizeStrengthVoiceInfluence(value: unknown) {
  const normalized = normalizeString(value).toLowerCase()
  if (normalized === "low" || normalized === "medium" || normalized === "high" || normalized === "strong") {
    return normalized === "strong" ? "high" : normalized
  }
  return "medium"
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
      links.push({ title: normalizeString(source?.title) || url, url })
    }
  }
  return links
}

function buildSection(title: string, items: string[] | undefined) {
  if (!items || items.length === 0) return `${title}\nNo clear signals were identified.`
  return `${title}\n${items.map((item, index) => `${index + 1}. ${normalizeString(item)}`).filter(Boolean).join("\n")}`
}

function buildSavedDossierContent(payload: Record<string, unknown>, sources: Array<{ title: string; url: string }>) {
  const sourceLines = sources.length > 0 ? sources.map((s, i) => `${i + 1}. ${s.title}\n${s.url}`).join("\n\n") : "No source links were captured."
  return `Company summary
${normalizeString(payload.company_summary) || "No summary returned."}

${buildSection("Culture signals", payload.culture_signals as string[] | undefined)}

${buildSection("Key messages", payload.key_messages as string[] | undefined)}

${buildSection("Tone of voice", payload.tone_of_voice as string[] | undefined)}

${buildSection("Hiring story", payload.hiring_story as string[] | undefined)}

${buildSection("How the candidate should adapt language", payload.application_implications as string[] | undefined)}

Source links
${sourceLines}`
}

function appendSourceLinks(content: string, sources: Array<{ title: string; url: string }>) {
  const normalizedContent = normalizeString(content)
  const sourceLines = sources.length > 0 ? sources.map((s, i) => `${i + 1}. ${s.title}\n${s.url}`).join("\n\n") : "No source links were captured."

  return `${normalizedContent}

Source links
${sourceLines}`.trim()
}

async function runGenerateCompanyDossier(
  supabase: AdminClient,
  userId: string,
  candidateId: string,
  payload: Record<string, unknown>
) {
  const candidate = await getCandidate(supabase, userId, candidateId)
  const profile = await getLatestProfile(supabase, userId, candidateId)
  if (!profile) throw new Error("Generate a career profile before creating a company dossier")

  const companyName = normalizeString(payload.company_name)
  const companyWebsite = normalizeString(payload.company_website)
  const jobTitle = normalizeString(payload.job_title)
  const jobDescription = normalizeString(payload.job_description)
  if (!companyName) throw new Error("company_name is required")

  const model = process.env.OPENAI_JOB_SEARCH_MODEL || process.env.OPENAI_MODEL || "gpt-5"
  const response = await openai.responses.create({
    model,
    reasoning: { effort: "medium" },
    tools: [{ type: "web_search" }],
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: "You are an elite company researcher and employer-brand analyst. Search the live web and build a practical company dossier for job application tailoring. Return JSON only." }],
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

  if (!response.output_text?.trim()) throw new Error("Company research completed but no dossier content was returned. Please try again.")
  const parsed = JSON.parse(response.output_text) as Record<string, unknown>
  const title = normalizeString(parsed.title) || `Company Dossier - ${companyName}`
  const content = buildSavedDossierContent(parsed, collectSources(response))

  await saveSingleAsset({
    supabase,
    userId,
    candidateId,
    profileId: profile.id,
    assetType: "company_dossier",
    title,
    content,
  })

  await logUsageEvent(supabase, { userId, module: "career_advisor", eventType: "company_dossier_generated", candidateId, metadata: { company_name: companyName, job_title: jobTitle || null } })
  await logApiUsage(supabase, {
    userId,
    module: "career_advisor",
    feature: "company_dossier",
    model,
    status: "success",
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
    totalTokens: response.usage?.total_tokens ?? null,
    metadata: { candidate_id: candidateId, company_name: companyName },
  })

  return `Company dossier saved for ${companyName}`
}

async function runGenerateCoverLetter(supabase: AdminClient, userId: string, candidateId: string, payload: Record<string, unknown>) {
  const candidate = await getCandidate(supabase, userId, candidateId)
  const profile = await getLatestProfile(supabase, userId, candidateId)
  if (!profile) throw new Error("Generate a career profile before creating a cover letter")

  const jobTitle = normalizeString(payload.job_title)
  const companyName = normalizeString(payload.company_name)
  const jobDescription = normalizeString(payload.job_description)
  const useCompanyDossier = Boolean(payload.use_company_dossier)
  const dossierInfluence = normalizeDossierInfluence(payload.dossier_influence)
  const strengthVoiceInfluence = normalizeStrengthVoiceInfluence(payload.strength_voice_influence)
  if (!jobDescription) throw new Error("job_description is required")

  const latestByType = await getLatestGeneratedAssetsByType(supabase, userId, candidateId, ["cv_summary", "cv_experience", "linkedin_headline", "linkedin_about"])
  let companyDossier: { title: string | null; content: string | null } | null = null
  if (companyName && useCompanyDossier) {
    const { data: dossiers } = await supabase
      .from("career_generated_assets")
      .select("title, content, created_at")
      .eq("candidate_id", candidateId)
      .eq("user_id", userId)
      .eq("asset_type", "company_dossier")
      .order("created_at", { ascending: false })
      .limit(10)

    const match =
      (dossiers ?? []).find((asset) => normalizeString(asset.title).toLowerCase().includes(companyName.toLowerCase())) ??
      dossiers?.[0] ??
      null
    if (match) companyDossier = { title: match.title, content: match.content }
  }

  const response = await openai.responses.create({
    model: process.env.OPENAI_CAREER_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini",
    reasoning: { effort: "medium" },
    input: [
      { role: "system", content: [{ type: "input_text", text: "You are an elite career strategist writing tailored cover letters. Write persuasively, specifically, and credibly. Return JSON only." }] },
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

Candidate:
${stringify(candidate)}

Positioning pack:
${stringify(profile)}

Supporting rewrite assets:
${stringify(Object.fromEntries(latestByType))}

Company dossier:
${stringify(companyDossier)}

Dossier settings:
${stringify({ use_company_dossier: useCompanyDossier, dossier_influence: useCompanyDossier ? dossierInfluence : "off" })}

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
        schema: { type: "object", additionalProperties: false, properties: { title: { type: "string" }, content: { type: "string" } }, required: ["title", "content"] },
      },
    },
  })

  const parsed = JSON.parse(response.output_text || "{}") as { title?: string; content?: string }
  const title = normalizeString(parsed.title) || `Cover Letter${jobTitle ? ` - ${jobTitle}` : ""}`
  const content = normalizeString(parsed.content)
  if (!content) throw new Error("Model did not return a valid cover letter")

  await saveSingleAsset({ supabase, userId, candidateId, profileId: profile.id, assetType: "cover_letter", title, content })
  await logUsageEvent(supabase, {
    userId,
    module: "career_advisor",
    eventType: "cover_letter_generated",
    candidateId,
    metadata: {
      job_title: jobTitle || null,
      company_name: companyName || null,
      strength_voice_influence: strengthVoiceInfluence,
    },
  })
  await logApiUsage(supabase, {
    userId,
    module: "career_advisor",
    feature: "cover_letter",
    model: process.env.OPENAI_CAREER_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini",
    status: "success",
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
    totalTokens: response.usage?.total_tokens ?? null,
    metadata: {
      candidate_id: candidateId,
      job_title: jobTitle || null,
      company_name: companyName || null,
      strength_voice_influence: strengthVoiceInfluence,
    },
  })

  return `Cover letter saved${jobTitle ? ` for ${jobTitle}` : ""}`
}

async function runGenerateInterviewPrep(supabase: AdminClient, userId: string, candidateId: string, payload: Record<string, unknown>) {
  const candidate = await getCandidate(supabase, userId, candidateId)
  const profile = await getLatestProfile(supabase, userId, candidateId)
  if (!profile) throw new Error("Generate a career profile before creating interview prep")

  const jobTitle = normalizeString(payload.job_title)
  const companyName = normalizeString(payload.company_name)
  const jobDescription = normalizeString(payload.job_description)
  const strengthVoiceInfluence = normalizeStrengthVoiceInfluence(payload.strength_voice_influence)
  if (!jobDescription) throw new Error("job_description is required")

  const latestByType = await getLatestGeneratedAssetsByType(supabase, userId, candidateId, ["cv_summary", "cv_experience", "linkedin_headline", "linkedin_about", "cover_letter"])
  const { data: interviewReflections } = await supabase
    .from("career_source_documents")
    .select("title, content_text, created_at")
    .eq("candidate_id", candidateId)
    .eq("user_id", userId)
    .eq("source_type", "interview_reflection")
    .order("created_at", { ascending: false })
    .limit(5)

  const response = await openai.responses.create({
    model: process.env.OPENAI_CAREER_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini",
    reasoning: { effort: "medium" },
    input: [
      { role: "system", content: [{ type: "input_text", text: "You are an elite interview coach. Build interview prep that is specific to the role, commercially sharp, practical to rehearse, and grounded in the candidate profile. Return JSON only." }] },
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

Candidate:
${stringify(candidate)}

Positioning pack:
${stringify(profile)}

Supporting materials:
${stringify(Object.fromEntries(latestByType))}

Recent interview reflections:
${stringify(interviewReflections ?? [])}

Strength voice settings:
${stringify({
  strength_voice_influence: strengthVoiceInfluence,
  guidance:
    strengthVoiceInfluence === "low"
      ? "Use light strengths references and mostly neutral coaching language."
      : strengthVoiceInfluence === "high"
        ? "Strongly frame answer angles and coaching through Gallup strengths language."
        : "Use balanced strengths-aware coaching language.",
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
        schema: { type: "object", additionalProperties: false, properties: { title: { type: "string" }, content: { type: "string" } }, required: ["title", "content"] },
      },
    },
  })

  const parsed = JSON.parse(response.output_text || "{}") as { title?: string; content?: string }
  const title = normalizeString(parsed.title) || `Interview Prep${jobTitle ? ` - ${jobTitle}` : ""}`
  const content = normalizeString(parsed.content)
  if (!content) throw new Error("Model did not return valid interview prep")

  await saveSingleAsset({ supabase, userId, candidateId, profileId: profile.id, assetType: "interview_prep", title, content })
  await logUsageEvent(supabase, {
    userId,
    module: "career_advisor",
    eventType: "interview_prep_generated",
    candidateId,
    metadata: {
      job_title: jobTitle || null,
      company_name: companyName || null,
      strength_voice_influence: strengthVoiceInfluence,
    },
  })
  await logApiUsage(supabase, {
    userId,
    module: "career_advisor",
    feature: "interview_prep",
    model: process.env.OPENAI_CAREER_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini",
    status: "success",
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
    totalTokens: response.usage?.total_tokens ?? null,
    metadata: {
      candidate_id: candidateId,
      job_title: jobTitle || null,
      company_name: companyName || null,
      strength_voice_influence: strengthVoiceInfluence,
    },
  })
  return `Interview prep saved${jobTitle ? ` for ${jobTitle}` : ""}`
}

function buildStrategyPrompt(
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

${sharedContext}

Target role:
${stringify({ jobTitle: payload.jobTitle, companyName: payload.companyName, jobDescription: payload.jobDescription })}`
  }

  if (assetType === "interview_training_pack") {
    return `Return JSON in this shape:
{
  "title": "string",
  "content": "string"
}

${sharedContext}

Target role:
${stringify({ jobTitle: payload.jobTitle, companyName: payload.companyName, jobDescription: payload.jobDescription })}`
  }

  return `Return JSON in this shape:
{
  "title": "string",
  "content": "string"
}

${sharedContext}

Market targeting:
${stringify({
  targetRole: payload.jobTitle,
  targetLocation: payload.targetLocation,
  targetCompanies: payload.targetCompanies,
  marketNotes: payload.marketNotes,
})}`
}

function getDefaultStrategyTitle(assetType: SupportedStrategyAssetType, jobTitle: string, targetLocation: string) {
  if (assetType === "executive_interview_playbook") return `Executive Interview Playbook${jobTitle ? ` - ${jobTitle}` : ""}`
  if (assetType === "interview_training_pack") return `Interview Training Pack${jobTitle ? ` - ${jobTitle}` : ""}`
  return `Job Hit List${jobTitle ? ` - ${jobTitle}` : ""}${targetLocation ? ` (${targetLocation})` : ""}`
}

async function runGenerateStrategyDocument(supabase: AdminClient, userId: string, candidateId: string, payload: Record<string, unknown>) {
  const candidate = await getCandidate(supabase, userId, candidateId)
  const profile = await getLatestProfile(supabase, userId, candidateId)
  if (!profile) throw new Error("Generate a career profile before creating strategy documents")

  const assetType = normalizeString(payload.asset_type) as SupportedStrategyAssetType
  const supported: SupportedStrategyAssetType[] = ["executive_interview_playbook", "interview_training_pack", "job_hit_list"]
  if (!supported.includes(assetType)) throw new Error("Unsupported strategy document type")

  const jobTitle = normalizeString(payload.job_title)
  const companyName = normalizeString(payload.company_name)
  const jobDescription = normalizeString(payload.job_description)
  const targetLocation = normalizeString(payload.target_location)
  const targetCompanies = normalizeString(payload.target_companies)
  const marketNotes = normalizeString(payload.market_notes)
  if ((assetType === "executive_interview_playbook" || assetType === "interview_training_pack") && !jobDescription) {
    throw new Error("job_description is required for interview documents")
  }

  const latestByType = await getLatestGeneratedAssetsByType(supabase, userId, candidateId, ["cv_summary", "cv_experience", "linkedin_headline", "linkedin_about", "cover_letter", "interview_prep"])
  const response = await openai.responses.create({
    model: process.env.OPENAI_CAREER_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini",
    reasoning: { effort: "medium" },
    input: [
      { role: "system", content: [{ type: "input_text", text: "You are an elite executive career strategist. Create practical, well-structured career documents that a candidate can use immediately. Return JSON only." }] },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildStrategyPrompt(assetType, {
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
        schema: { type: "object", additionalProperties: false, properties: { title: { type: "string" }, content: { type: "string" } }, required: ["title", "content"] },
      },
    },
  })

  const parsed = JSON.parse(response.output_text || "{}") as { title?: string; content?: string }
  const title = normalizeString(parsed.title) || getDefaultStrategyTitle(assetType, jobTitle, targetLocation)
  const content = normalizeString(parsed.content)
  if (!content) throw new Error("Model did not return a valid strategy document")

  await saveSingleAsset({ supabase, userId, candidateId, profileId: profile.id, assetType: assetType as CareerAssetType, title, content })
  await logUsageEvent(supabase, { userId, module: "career_advisor", eventType: "strategy_document_generated", candidateId, metadata: { asset_type: assetType } })
  await logApiUsage(supabase, {
    userId,
    module: "career_advisor",
    feature: assetType,
    model: process.env.OPENAI_CAREER_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini",
    status: "success",
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
    totalTokens: response.usage?.total_tokens ?? null,
    metadata: { candidate_id: candidateId, asset_type: assetType },
  })
  return `${title} generated`
}

async function runTargetCompanyWorkflow(supabase: AdminClient, userId: string, candidateId: string, payload: Record<string, unknown>) {
  const companyName = normalizeString(payload.company_name)
  const companyWebsite = normalizeString(payload.company_website)
  const jobTitle = normalizeString(payload.job_title)
  const jobDescription = normalizeString(payload.job_description)
  const dossierInfluence = normalizeDossierInfluence(payload.dossier_influence)
  if (!companyName || !jobDescription) throw new Error("company_name and job_description are required")

  await runGenerateCompanyDossier(supabase, userId, candidateId, {
    company_name: companyName,
    company_website: companyWebsite,
    job_title: jobTitle,
    job_description: jobDescription,
  })
  await runGenerateCoverLetter(supabase, userId, candidateId, {
    job_title: jobTitle,
    company_name: companyName,
    job_description: jobDescription,
    use_company_dossier: true,
    dossier_influence: dossierInfluence,
  })
  await runGenerateInterviewPrep(supabase, userId, candidateId, {
    job_title: jobTitle,
    company_name: companyName,
    job_description: jobDescription,
  })

  return `Target company workflow completed for ${companyName}`
}

async function runApplicationSprint(
  supabase: AdminClient,
  userId: string,
  candidateId: string,
  payload: Record<string, unknown>
) {
  const companyName = normalizeString(payload.company_name)
  const companyWebsite = normalizeString(payload.company_website)
  const jobTitle = normalizeString(payload.job_title)
  const location = normalizeString(payload.location)
  const jobDescription = normalizeString(payload.job_description)
  const jobUrl = normalizeString(payload.job_url)
  const notes = normalizeString(payload.notes)
  const dossierInfluence = normalizeDossierInfluence(payload.dossier_influence)

  if (!jobTitle || !jobDescription) {
    throw new Error("job_title and job_description are required")
  }

  if (companyName) {
    await runGenerateCompanyDossier(supabase, userId, candidateId, {
      company_name: companyName,
      company_website: companyWebsite,
      job_title: jobTitle,
      job_description: jobDescription,
    })
  }

  await runGenerateApplicationFitAnalysis(supabase, userId, candidateId, {
    job_title: jobTitle,
    company_name: companyName,
    location,
    job_description: jobDescription,
    job_url: jobUrl,
    notes,
  })

  await runGenerateSalaryAnalysis(supabase, userId, candidateId, {
    job_title: jobTitle,
    company_name: companyName,
    location,
    job_description: jobDescription,
    job_url: jobUrl,
    notes,
    focus: "application_sprint",
  })

  await runGenerateCoverLetter(supabase, userId, candidateId, {
    job_title: jobTitle,
    company_name: companyName,
    job_description: jobDescription,
    use_company_dossier: Boolean(companyName),
    dossier_influence: dossierInfluence,
  })

  await runGenerateInterviewPrep(supabase, userId, candidateId, {
    job_title: jobTitle,
    company_name: companyName,
    job_description: jobDescription,
  })

  const normalizedCompanyHint = companyName || jobTitle
  const companyDossierAssetId = companyName
    ? await getLatestAssetIdForType(supabase, userId, candidateId, "company_dossier", normalizedCompanyHint)
    : null
  const coverLetterAssetId = await getLatestAssetIdForType(supabase, userId, candidateId, "cover_letter", jobTitle)
  const salaryAnalysisAssetId = await getLatestAssetIdForType(supabase, userId, candidateId, "salary_analysis", jobTitle)
  const fitAnalysisAssetId = await getLatestAssetIdForType(supabase, userId, candidateId, "application_fit_analysis", jobTitle)

  await upsertSprintApplication({
    supabase,
    userId,
    candidateId,
    companyName,
    jobTitle,
    location,
    jobUrl,
    notes,
    coverLetterAssetId,
    companyDossierAssetId,
    salaryAnalysisAssetId,
    fitAnalysisAssetId,
  })

  await logUsageEvent(supabase, {
    userId,
    module: "career_advisor",
    eventType: "application_sprint_completed",
    candidateId,
    metadata: {
      job_title: jobTitle,
      company_name: companyName || null,
      linked_cover_letter: Boolean(coverLetterAssetId),
      linked_dossier: Boolean(companyDossierAssetId),
      linked_salary_analysis: Boolean(salaryAnalysisAssetId),
      linked_fit_analysis: Boolean(fitAnalysisAssetId),
    },
  })

  return `Application sprint completed${jobTitle ? ` for ${jobTitle}` : ""}${companyName ? ` at ${companyName}` : ""}`
}

async function runGenerateDeepProspectResearch(
  supabase: AdminClient,
  userId: string,
  candidateId: string,
  payload: Record<string, unknown>
) {
  const candidate = await getCandidate(supabase, userId, candidateId)
  const profile = await getLatestProfile(supabase, userId, candidateId)
  if (!profile) throw new Error("Generate a career profile before creating deep prospect research")

  const location = normalizeString(payload.location) || normalizeString(candidate.city)
  const roleFamily = normalizeString(payload.role_family) || normalizeString(payload.target_role)
  const industryFocus = normalizeString(payload.industry_focus)
  const seniority = normalizeString(payload.seniority)
  const notes = normalizeString(payload.notes)

  if (!location) throw new Error("location is required")
  if (!roleFamily) throw new Error("role_family or target_role is required")

  const latestByType = await getLatestGeneratedAssetsByType(supabase, userId, candidateId, [
    "cv_summary",
    "cv_experience",
    "linkedin_headline",
    "linkedin_about",
    "company_dossier",
    "salary_analysis",
    "application_fit_analysis",
  ])

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
              "You are an elite market-mapping strategist. Search the live web for strong companies in a chosen location that may not currently advertise the exact role, but show signals they are likely to need a candidate like this. Return JSON only.",
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
  "market_summary": "string",
  "prospects": [
    {
      "company": "string",
      "location": "string",
      "why_promising": "string",
      "growth_signals": ["string"],
      "likely_need": "string",
      "suggested_angle": "string",
      "website": "string"
    }
  ],
  "next_moves": ["string"]
}

Rules:
- Focus on real companies that appear to be growing, investing, hiring adjacent talent, expanding, transforming, or entering markets
- Do not require an advertised opening for the exact role
- Return 5 to 8 high-signal target companies when possible
- Keep each suggested_angle practical and specific
- Do not invent companies or signals

Candidate:
${stringify(candidate)}

Positioning pack:
${stringify(profile)}

Supporting assets:
${stringify(Object.fromEntries(latestByType))}

Prospect research brief:
${stringify({
  location,
  role_family: roleFamily,
  industry_focus: industryFocus,
  seniority,
  notes,
})}`,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "deep_prospect_research",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            market_summary: { type: "string" },
            prospects: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  company: { type: "string" },
                  location: { type: "string" },
                  why_promising: { type: "string" },
                  growth_signals: { type: "array", items: { type: "string" } },
                  likely_need: { type: "string" },
                  suggested_angle: { type: "string" },
                  website: { type: "string" },
                },
                required: ["company", "location", "why_promising", "growth_signals", "likely_need", "suggested_angle", "website"],
              },
            },
            next_moves: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["title", "market_summary", "prospects", "next_moves"],
        },
      },
    },
  })

  const parsed = JSON.parse(response.output_text || "{}") as {
    title?: string
    market_summary?: string
    prospects?: Array<{
      company?: string
      location?: string
      why_promising?: string
      growth_signals?: string[]
      likely_need?: string
      suggested_angle?: string
      website?: string
    }>
    next_moves?: string[]
  }

  const prospects =
    parsed.prospects?.map((prospect, index) => {
      const growthSignals = Array.isArray(prospect.growth_signals)
        ? prospect.growth_signals.map((item) => normalizeString(item)).filter(Boolean)
        : []
      return [
        `${index + 1}. ${normalizeString(prospect.company) || "Untitled company"}${normalizeString(prospect.location) ? ` | ${normalizeString(prospect.location)}` : ""}`,
        normalizeString(prospect.why_promising) ? `Why promising: ${normalizeString(prospect.why_promising)}` : "",
        growthSignals.length > 0 ? `Growth signals: ${growthSignals.join("; ")}` : "",
        normalizeString(prospect.likely_need) ? `Likely need: ${normalizeString(prospect.likely_need)}` : "",
        normalizeString(prospect.suggested_angle) ? `Suggested approach: ${normalizeString(prospect.suggested_angle)}` : "",
        normalizeUrl(prospect.website) ? `Website: ${normalizeUrl(prospect.website)}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    }) ?? []

  const nextMoves =
    parsed.next_moves && parsed.next_moves.length > 0
      ? parsed.next_moves.map((step, index) => `${index + 1}. ${normalizeString(step)}`).filter(Boolean).join("\n")
      : "1. Shortlist the highest-signal companies and create dossiers for the best targets."

  const content = `Market summary
${normalizeString(parsed.market_summary) || "No market summary returned."}

Best prospect companies
${prospects.length > 0 ? prospects.join("\n\n") : "No strong prospect companies were returned."}

Recommended next moves
${nextMoves}

Source links
${collectSources(response).map((source, index) => `${index + 1}. ${source.title}\n${source.url}`).join("\n\n") || "No source links were captured."}`.trim()

  const title = normalizeString(parsed.title) || `Deep Prospect Research - ${roleFamily} in ${location}`
  if (!normalizeString(content)) throw new Error("Model did not return valid deep prospect research")

  await saveSingleAsset({
    supabase,
    userId,
    candidateId,
    profileId: profile.id,
    assetType: "deep_prospect_research",
    title,
    content,
  })

  await logUsageEvent(supabase, {
    userId,
    module: "career_advisor",
    eventType: "deep_prospect_research_generated",
    candidateId,
    metadata: { location, role_family: roleFamily, industry_focus: industryFocus || null, seniority: seniority || null },
  })
  await logApiUsage(supabase, {
    userId,
    module: "career_advisor",
    feature: "deep_prospect_research",
    model,
    status: "success",
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
    totalTokens: response.usage?.total_tokens ?? null,
    metadata: { candidate_id: candidateId, location, role_family: roleFamily, industry_focus: industryFocus || null, seniority: seniority || null },
  })

  return `Deep prospect research saved for ${roleFamily} in ${location}`
}

async function runGenerateRecruiterMatchSearch(
  supabase: AdminClient,
  userId: string,
  candidateId: string,
  payload: Record<string, unknown>
) {
  const candidate = await getCandidate(supabase, userId, candidateId)
  const profile = await getLatestProfile(supabase, userId, candidateId)
  if (!profile) throw new Error("Generate a career profile before creating recruiter match search")

  const jobTitle = normalizeString(payload.job_title) || normalizeString(payload.role_family)
  const location = normalizeString(payload.location) || normalizeString(candidate.city)
  const companyName = normalizeString(payload.company_name)
  const specialty = normalizeString(payload.specialty)
  const notes = normalizeString(payload.notes)

  if (!jobTitle) throw new Error("job_title or role_family is required")

  const latestByType = await getLatestGeneratedAssetsByType(supabase, userId, candidateId, [
    "cv_summary",
    "linkedin_about",
    "company_dossier",
    "deep_prospect_research",
    "outreach_strategy",
  ])

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
              "You are an executive recruiter-market researcher. Search the live web and identify recruiter channels, search firms, talent partners, and practical recruiter-access routes relevant to the candidate's target role and market. Return JSON only.",
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

The content must be practical and structured with these sections:
- Recruiter market snapshot
- Best-fit recruiter types
- Search firms or recruiter signals to prioritise
- How the candidate should position themselves to recruiters
- Warm approach ideas
- Risks and filters
- Recommended next move this week

Rules:
- Focus on relevance and practicality, not invented direct contacts
- Use the candidate positioning and target market
- If company_name is supplied, include recruiter routes relevant to that company or adjacent market
- Distinguish retained search from volume recruiters when useful

Candidate:
${stringify(candidate)}

Positioning pack:
${stringify(profile)}

Relevant saved assets:
${stringify(Object.fromEntries(latestByType))}

Recruiter search brief:
${stringify({
  job_title: jobTitle,
  location,
  company_name: companyName,
  specialty,
  notes,
})}`,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "recruiter_match_search",
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
  const title =
    normalizeString(parsed.title) ||
    `Recruiter Match Search - ${jobTitle}${location ? ` - ${location}` : ""}`
  const content = appendSourceLinks(parsed.content || "", collectSources(response))
  if (!normalizeString(content)) throw new Error("Model did not return valid recruiter match search")

  await saveSingleAsset({
    supabase,
    userId,
    candidateId,
    profileId: profile.id,
    assetType: "recruiter_match_search",
    title,
    content,
  })

  await logUsageEvent(supabase, {
    userId,
    module: "career_advisor",
    eventType: "recruiter_match_search_generated",
    candidateId,
    metadata: { job_title: jobTitle, location: location || null, company_name: companyName || null, specialty: specialty || null },
  })
  await logApiUsage(supabase, {
    userId,
    module: "career_advisor",
    feature: "recruiter_match_search",
    model,
    status: "success",
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
    totalTokens: response.usage?.total_tokens ?? null,
    metadata: { candidate_id: candidateId, job_title: jobTitle, location: location || null, company_name: companyName || null, specialty: specialty || null },
  })

  return `Recruiter match search saved for ${jobTitle}${location ? ` in ${location}` : ""}`
}

async function runGenerateSalaryAnalysis(
  supabase: AdminClient,
  userId: string,
  candidateId: string,
  payload: Record<string, unknown>
) {
  const candidate = await getCandidate(supabase, userId, candidateId)
  const profile = await getLatestProfile(supabase, userId, candidateId)
  if (!profile) throw new Error("Generate a career profile before creating salary analysis")

  const jobTitle = normalizeString(payload.job_title)
  const companyName = normalizeString(payload.company_name)
  const location = normalizeString(payload.location) || normalizeString(candidate.city)
  const jobDescription = normalizeString(payload.job_description)
  const jobUrl = normalizeString(payload.job_url)
  const notes = normalizeString(payload.notes)
  const focus = normalizeString(payload.focus)

  if (!jobTitle) throw new Error("job_title is required")

  const latestByType = await getLatestGeneratedAssetsByType(supabase, userId, candidateId, [
    "cv_summary",
    "cv_experience",
    "linkedin_headline",
    "linkedin_about",
    "company_dossier",
  ])

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
              "You are an executive compensation strategist. Search the live web and produce a grounded salary analysis for the role. Use current market evidence, avoid fake precision, and return JSON only.",
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

The content should be practical and structured with these sections:
- Salary snapshot
- Likely compensation range
- What drives the range up or down
- Negotiation angles
- Risks and caveats
- Recommended next move

Rules:
- Use plain English
- Reference the likely market, seniority, and location assumptions
- Mention when a number is approximate or depends on bonus/equity
- If evidence is mixed, say so clearly

Candidate:
${stringify(candidate)}

Positioning pack:
${stringify(profile)}

Supporting assets:
${stringify(Object.fromEntries(latestByType))}

Target opportunity:
${stringify({
  job_title: jobTitle,
  company_name: companyName,
  location,
  job_description: jobDescription,
  job_url: jobUrl,
  notes,
  focus,
})}`,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "salary_analysis",
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
  const title = normalizeString(parsed.title) || `Salary Analysis${jobTitle ? ` - ${jobTitle}` : ""}`
  const content = appendSourceLinks(parsed.content || "", collectSources(response))
  if (!normalizeString(content)) throw new Error("Model did not return a valid salary analysis")

  await saveSingleAsset({
    supabase,
    userId,
    candidateId,
    profileId: profile.id,
    assetType: "salary_analysis",
    title,
    content,
  })

  await logUsageEvent(supabase, {
    userId,
    module: "career_advisor",
    eventType: "salary_analysis_generated",
    candidateId,
    metadata: { job_title: jobTitle, company_name: companyName || null, location: location || null },
  })
  await logApiUsage(supabase, {
    userId,
    module: "career_advisor",
    feature: "salary_analysis",
    model,
    status: "success",
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
    totalTokens: response.usage?.total_tokens ?? null,
    metadata: { candidate_id: candidateId, job_title: jobTitle, company_name: companyName || null, location: location || null },
  })

  return `Salary analysis saved${jobTitle ? ` for ${jobTitle}` : ""}`
}

async function runGenerateOutreachStrategy(
  supabase: AdminClient,
  userId: string,
  candidateId: string,
  payload: Record<string, unknown>
) {
  const candidate = await getCandidate(supabase, userId, candidateId)
  const profile = await getLatestProfile(supabase, userId, candidateId)
  if (!profile) throw new Error("Generate a career profile before creating outreach strategy")

  const companyName = normalizeString(payload.company_name)
  const location = normalizeString(payload.location) || normalizeString(candidate.city)
  const jobTitle = normalizeString(payload.job_title)
  const contactObjective = normalizeString(payload.contact_objective)
  const notes = normalizeString(payload.notes)

  if (!companyName) throw new Error("company_name is required")

  const latestByType = await getLatestGeneratedAssetsByType(supabase, userId, candidateId, [
    "company_dossier",
    "deep_prospect_research",
    "cover_letter",
    "application_fit_analysis",
  ])

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
              "You are an executive outreach strategist. Build a practical company-specific outreach plan for a high-value candidate targeting decision-makers or warm introduction paths. Search the live web when useful and return JSON only.",
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

The content must be practical and structured with these sections:
- Why this company now
- Likely contact paths
- Warm introduction angles
- Messaging themes
- First outreach note
- Follow-up plan
- Risks and what to avoid

Rules:
- Keep it commercially sharp and specific
- Use the candidate's positioning and strengths
- If evidence is uncertain, say so directly
- Prefer realistic contact paths over invented names
- The first outreach note should be short enough to send

Candidate:
${stringify(candidate)}

Positioning pack:
${stringify(profile)}

Relevant saved assets:
${stringify(Object.fromEntries(latestByType))}

Outreach brief:
${stringify({
  company_name: companyName,
  location,
  job_title: jobTitle,
  contact_objective: contactObjective,
  notes,
})}`,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "outreach_strategy",
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
  const title =
    normalizeString(parsed.title) ||
    `Outreach Strategy - ${companyName}${jobTitle ? ` - ${jobTitle}` : ""}`
  const content = appendSourceLinks(parsed.content || "", collectSources(response))
  if (!normalizeString(content)) throw new Error("Model did not return valid outreach strategy")

  await saveSingleAsset({
    supabase,
    userId,
    candidateId,
    profileId: profile.id,
    assetType: "outreach_strategy",
    title,
    content,
  })

  await logUsageEvent(supabase, {
    userId,
    module: "career_advisor",
    eventType: "outreach_strategy_generated",
    candidateId,
    metadata: {
      company_name: companyName,
      job_title: jobTitle || null,
      location: location || null,
      contact_objective: contactObjective || null,
    },
  })
  await logApiUsage(supabase, {
    userId,
    module: "career_advisor",
    feature: "outreach_strategy",
    model,
    status: "success",
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
    totalTokens: response.usage?.total_tokens ?? null,
    metadata: {
      candidate_id: candidateId,
      company_name: companyName,
      job_title: jobTitle || null,
      location: location || null,
      contact_objective: contactObjective || null,
    },
  })

  return `Outreach strategy saved for ${companyName}`
}

async function runGenerateCourseRecommendations(
  supabase: AdminClient,
  userId: string,
  candidateId: string,
  payload: Record<string, unknown>
) {
  const candidate = await getCandidate(supabase, userId, candidateId)
  const profile = await getLatestProfile(supabase, userId, candidateId)
  if (!profile) throw new Error("Generate a career profile before creating course recommendations")

  const targetRole = normalizeString(payload.target_role)
  const focusArea = normalizeString(payload.focus_area)
  const learningGoal = normalizeString(payload.learning_goal)
  const notes = normalizeString(payload.notes)

  const { data: documents } = await supabase
    .from("career_source_documents")
    .select("source_type, title, content_text")
    .eq("candidate_id", candidateId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("source_type", ["cv", "gallup_strengths", "strengths", "linkedin", "notes"])
    .order("created_at", { ascending: true })

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
              "You are an executive learning strategist. Search the live web and recommend courses or certifications that fit the candidate's CV, Gallup strengths, and target direction. Return JSON only.",
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

The content should be practical and structured with these sections:
- Learning objective
- Best-fit courses and certifications
- Why each recommendation fits this candidate
- Time and effort guidance
- Best first step this month

Rules:
- Prioritize credible providers
- Prefer recommendations that strengthen the candidate's likely role path
- Use Gallup strengths when explaining fit
- Keep the list tight and high signal

Candidate:
${stringify(candidate)}

Positioning pack:
${stringify(profile)}

Relevant source material:
${buildDocumentContext((documents ?? []) as CareerDocumentRow[])}

Course search brief:
${stringify({
  target_role: targetRole,
  focus_area: focusArea,
  learning_goal: learningGoal,
  notes,
})}`,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "course_recommendations",
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
  const title = normalizeString(parsed.title) || `Course Recommendations${targetRole ? ` - ${targetRole}` : ""}`
  const content = appendSourceLinks(parsed.content || "", collectSources(response))
  if (!normalizeString(content)) throw new Error("Model did not return valid course recommendations")

  await saveSingleAsset({
    supabase,
    userId,
    candidateId,
    profileId: profile.id,
    assetType: "course_recommendations",
    title,
    content,
  })

  await logUsageEvent(supabase, {
    userId,
    module: "career_advisor",
    eventType: "course_recommendations_generated",
    candidateId,
    metadata: { target_role: targetRole || null, focus_area: focusArea || null },
  })
  await logApiUsage(supabase, {
    userId,
    module: "career_advisor",
    feature: "course_recommendations",
    model,
    status: "success",
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
    totalTokens: response.usage?.total_tokens ?? null,
    metadata: { candidate_id: candidateId, target_role: targetRole || null, focus_area: focusArea || null },
  })

  return `Course recommendations saved${targetRole ? ` for ${targetRole}` : ""}`
}

async function runGenerateApplicationFitAnalysis(
  supabase: AdminClient,
  userId: string,
  candidateId: string,
  payload: Record<string, unknown>
) {
  const candidate = await getCandidate(supabase, userId, candidateId)
  const profile = await getLatestProfile(supabase, userId, candidateId)
  if (!profile) throw new Error("Generate a career profile before creating fit analysis")

  const jobTitle = normalizeString(payload.job_title)
  const companyName = normalizeString(payload.company_name)
  const location = normalizeString(payload.location)
  const jobDescription = normalizeString(payload.job_description)
  const jobUrl = normalizeString(payload.job_url)
  const notes = normalizeString(payload.notes)

  if (!jobTitle) throw new Error("job_title is required")
  if (!jobDescription) throw new Error("job_description is required")

  const latestByType = await getLatestGeneratedAssetsByType(supabase, userId, candidateId, [
    "cv_summary",
    "cv_experience",
    "linkedin_headline",
    "linkedin_about",
    "cover_letter",
    "company_dossier",
    "interview_prep",
  ])

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
              "You are an executive recruiter and career strategist. Assess how strongly a candidate fits a role based on evidence, and return JSON only. Be commercially sharp, realistic, and specific.",
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
  "score": 0,
  "content": "string"
}

Rules:
- score must be an integer from 0 to 100
- explain the score with evidence, not vague praise
- the content must include these sections:
  - Fit score
  - Why this role matches
  - Likely gaps or risks
  - How to improve the match before applying
  - Recommended next move

Candidate:
${stringify(candidate)}

Positioning pack:
${stringify(profile)}

Supporting assets:
${stringify(Object.fromEntries(latestByType))}

Target role:
${stringify({
  job_title: jobTitle,
  company_name: companyName,
  location,
  job_description: jobDescription,
  job_url: jobUrl,
  notes,
})}`,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "application_fit_analysis",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            score: { type: "integer", minimum: 0, maximum: 100 },
            content: { type: "string" },
          },
          required: ["title", "score", "content"],
        },
      },
    },
  })

  const parsed = JSON.parse(response.output_text || "{}") as { title?: string; score?: number; content?: string }
  const score = typeof parsed.score === "number" ? Math.max(0, Math.min(100, Math.round(parsed.score))) : null
  const title = normalizeString(parsed.title) || `Fit Analysis${jobTitle ? ` - ${jobTitle}` : ""}`
  const content = `${score !== null ? `Fit score\n${score}/100\n\n` : ""}${normalizeString(parsed.content)}`
  if (!normalizeString(content)) throw new Error("Model did not return valid fit analysis")

  await saveSingleAsset({
    supabase,
    userId,
    candidateId,
    profileId: profile.id,
    assetType: "application_fit_analysis",
    title,
    content,
  })

  await logUsageEvent(supabase, {
    userId,
    module: "career_advisor",
    eventType: "application_fit_analysis_generated",
    candidateId,
    metadata: { job_title: jobTitle, company_name: companyName || null, fit_score: score },
  })
  await logApiUsage(supabase, {
    userId,
    module: "career_advisor",
    feature: "application_fit_analysis",
    model: process.env.OPENAI_CAREER_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini",
    status: "success",
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
    totalTokens: response.usage?.total_tokens ?? null,
    metadata: { candidate_id: candidateId, job_title: jobTitle, company_name: companyName || null, fit_score: score },
  })

  return `Fit analysis saved${jobTitle ? ` for ${jobTitle}` : ""}`
}

async function runGeneratePremiumWeeklyAutopilot(
  supabase: AdminClient,
  userId: string,
  candidateId: string,
  payload: Record<string, unknown>
) {
  const targetRole = normalizeString(payload.target_role)
  const location = normalizeString(payload.location)
  const marketNotes = normalizeString(payload.market_notes)
  const companyName = normalizeString(payload.company_name)
  const jobTitle = normalizeString(payload.job_title) || targetRole
  const jobDescription = normalizeString(payload.job_description)
  const dossierInfluence = normalizeString(payload.dossier_influence) || "medium"

  if (!targetRole) {
    throw new Error("Premium autopilot requires target_role")
  }

  const liveResult = await runLiveJobSearch({
    supabase,
    userId,
    candidateId,
    targetRole,
    location,
    marketNotes,
  })

  const completedSteps: string[] = ["live search"]

  if (companyName) {
    await runGenerateCompanyDossier(supabase, userId, candidateId, {
      company_name: companyName,
      job_title: jobTitle,
      location,
      job_description: jobDescription,
    })
    completedSteps.push("company dossier")
  }

  if (jobDescription) {
    await runGenerateCoverLetter(supabase, userId, candidateId, {
      company_name: companyName,
      job_title: jobTitle,
      job_description: jobDescription,
      use_company_dossier: Boolean(companyName),
      dossier_influence: dossierInfluence,
      strength_voice_influence: "medium",
    })
    completedSteps.push("cover letter draft")
  }

  await logUsageEvent(supabase, {
    userId,
    module: "career_advisor",
    eventType: "premium_autopilot_pipeline_completed",
    candidateId,
    metadata: {
      target_role: targetRole,
      location: location || null,
      completed_steps: completedSteps,
      live_search_asset_id: liveResult.asset.id,
    },
  })

  return `Premium autopilot completed (${completedSteps.join(", ")})`
}

export async function processCareerBackgroundJob(jobId: string) {
  const supabase = createAdminClient()
  const { data: job } = await supabase
    .from("career_background_jobs")
    .select("id, candidate_id, user_id, job_type, request_payload")
    .eq("id", jobId)
    .single()

  if (!job) return

  await supabase
    .from("career_background_jobs")
    .update({ status: "running", started_at: new Date().toISOString(), error_message: null })
    .eq("id", jobId)
    .eq("status", "queued")

  const currentJob = job as BackgroundJobRow
  try {
    let resultSummary = ""
    switch (currentJob.job_type) {
      case "generate_profile":
        resultSummary = await runGenerateProfile(supabase, currentJob.user_id, currentJob.candidate_id)
        break
      case "generate_assets":
        resultSummary = await runGenerateAssets(supabase, currentJob.user_id, currentJob.candidate_id)
        break
      case "generate_company_dossier":
        resultSummary = await runGenerateCompanyDossier(supabase, currentJob.user_id, currentJob.candidate_id, currentJob.request_payload ?? {})
        break
      case "generate_outreach_strategy":
        resultSummary = await runGenerateOutreachStrategy(supabase, currentJob.user_id, currentJob.candidate_id, currentJob.request_payload ?? {})
        break
      case "generate_cover_letter":
        resultSummary = await runGenerateCoverLetter(supabase, currentJob.user_id, currentJob.candidate_id, currentJob.request_payload ?? {})
        break
      case "generate_interview_prep":
        resultSummary = await runGenerateInterviewPrep(supabase, currentJob.user_id, currentJob.candidate_id, currentJob.request_payload ?? {})
        break
      case "generate_strategy_document":
        resultSummary = await runGenerateStrategyDocument(supabase, currentJob.user_id, currentJob.candidate_id, currentJob.request_payload ?? {})
        break
      case "generate_target_company_workflow":
        resultSummary = await runTargetCompanyWorkflow(supabase, currentJob.user_id, currentJob.candidate_id, currentJob.request_payload ?? {})
        break
      case "generate_application_sprint":
        resultSummary = await runApplicationSprint(supabase, currentJob.user_id, currentJob.candidate_id, currentJob.request_payload ?? {})
        break
      case "generate_deep_prospect_research":
        resultSummary = await runGenerateDeepProspectResearch(supabase, currentJob.user_id, currentJob.candidate_id, currentJob.request_payload ?? {})
        break
      case "generate_recruiter_match_search":
        resultSummary = await runGenerateRecruiterMatchSearch(supabase, currentJob.user_id, currentJob.candidate_id, currentJob.request_payload ?? {})
        break
      case "generate_salary_analysis":
        resultSummary = await runGenerateSalaryAnalysis(supabase, currentJob.user_id, currentJob.candidate_id, currentJob.request_payload ?? {})
        break
      case "generate_course_recommendations":
        resultSummary = await runGenerateCourseRecommendations(supabase, currentJob.user_id, currentJob.candidate_id, currentJob.request_payload ?? {})
        break
      case "generate_application_fit_analysis":
        resultSummary = await runGenerateApplicationFitAnalysis(supabase, currentJob.user_id, currentJob.candidate_id, currentJob.request_payload ?? {})
        break
      case "generate_premium_weekly_autopilot":
        resultSummary = await runGeneratePremiumWeeklyAutopilot(supabase, currentJob.user_id, currentJob.candidate_id, currentJob.request_payload ?? {})
        break
      default:
        throw new Error("Unsupported background job type")
    }

    await supabase
      .from("career_background_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        result_summary: resultSummary,
        error_message: null,
      })
      .eq("id", jobId)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    await supabase
      .from("career_background_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", jobId)
  }
}

export async function processCareerLiveJobRun(runId: string) {
  const supabase = createAdminClient()
  const { data: run } = await supabase
    .from("career_live_job_runs")
    .select("id, candidate_id, user_id, target_role, location, market_notes, status")
    .eq("id", runId)
    .single()

  if (!run || run.status !== "queued") return

  await supabase
    .from("career_live_job_runs")
    .update({ status: "running", started_at: new Date().toISOString(), error_message: null })
    .eq("id", runId)

  try {
    const result = await runLiveJobSearch({
      supabase,
      userId: run.user_id,
      candidateId: run.candidate_id,
      targetRole: run.target_role,
      location: run.location || "",
      marketNotes: run.market_notes || "",
    })

    await supabase
      .from("career_live_job_runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        result_asset_id: result.asset.id,
        error_message: null,
      })
      .eq("id", runId)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    await supabase
      .from("career_live_job_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", runId)
  }
}
