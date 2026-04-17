export type CareerCandidateRow = {
  id: string
  full_name: string | null
  city: string | null
  primary_goal: string | null
}

export type CareerProfilePayload = {
  career_identity: string
  market_positioning: string
  seniority_level: string
  core_strengths: string[]
  signature_achievements: string[]
  role_families: string[]
  skills: string[]
  risks_or_gaps: string[]
  recommended_target_roles: string[]
}

export const coreCareerAssetTypes = [
  "cv_summary",
  "cv_experience",
  "linkedin_headline",
  "linkedin_about",
] as const

export const strategyCareerAssetTypes = [
  "executive_interview_playbook",
  "interview_training_pack",
  "job_hit_list",
] as const

export const careerAssetTypes = [
  ...coreCareerAssetTypes,
  "cover_letter",
  "interview_prep",
  "live_job_search",
  "deep_prospect_research",
  "company_dossier",
  "outreach_strategy",
  "recruiter_match_search",
  "salary_analysis",
  "application_fit_analysis",
  "course_recommendations",
  ...strategyCareerAssetTypes,
] as const

export type CareerAssetType = (typeof careerAssetTypes)[number]

export type CareerAssetPayload = {
  asset_type: CareerAssetType
  title: string
  content: string
}

export const emptyCareerProfile: CareerProfilePayload = {
  career_identity: "",
  market_positioning: "",
  seniority_level: "",
  core_strengths: [],
  signature_achievements: [],
  role_families: [],
  skills: [],
  risks_or_gaps: [],
  recommended_target_roles: [],
}

export function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
}

export function coerceCareerProfile(value: unknown): CareerProfilePayload {
  if (!value || typeof value !== "object") {
    return emptyCareerProfile
  }

  const record = value as Record<string, unknown>

  return {
    career_identity: normalizeString(record.career_identity),
    market_positioning: normalizeString(record.market_positioning),
    seniority_level: normalizeString(record.seniority_level),
    core_strengths: normalizeStringArray(record.core_strengths),
    signature_achievements: normalizeStringArray(record.signature_achievements),
    role_families: normalizeStringArray(record.role_families),
    skills: normalizeStringArray(record.skills),
    risks_or_gaps: normalizeStringArray(record.risks_or_gaps),
    recommended_target_roles: normalizeStringArray(record.recommended_target_roles),
  }
}

export function isCareerAssetType(value: unknown): value is CareerAssetType {
  return typeof value === "string" && careerAssetTypes.includes(value as CareerAssetType)
}
