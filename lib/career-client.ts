import { supabase } from "@/lib/supabase"

export const CAREER_WORKSPACE_REFRESH_EVENT = "career-workspace-refresh"
export const CAREER_WORKSPACE_NAVIGATE_EVENT = "career-workspace-navigate"
export const CAREER_WORKSPACE_TARGET_EVENT = "career-workspace-target"

type CareerWorkspacePrefill = {
  companyName?: string
  location?: string
  roleFamily?: string
  notes?: string
  jobUrl?: string
  nextAction?: string
  status?: string
}

type CareerWorkspaceTargetDetail = {
  applicationId: string
}

export type CareerBackgroundJobType =
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

export async function getAuthHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }

  return headers
}

export function toCareerUserMessage(rawMessage: string | null | undefined, fallback = "Something went wrong. Please try again.") {
  const message = (rawMessage || "").trim()
  if (!message) return fallback

  const normalized = message.toLowerCase()

  if (
    normalized.includes("unauthorized") ||
    normalized.includes("jwt") ||
    normalized.includes("token") ||
    normalized.includes("session")
  ) {
    return "Your session has expired. Please sign in again and retry."
  }

  if (normalized.includes("violates row-level security") || normalized.includes("permission denied")) {
    return "This save action was blocked by permissions. Please refresh, sign in again, and retry."
  }

  if (normalized.includes("candidate not found")) {
    return "We could not find this candidate workspace. Go back to Career Intelligence and reopen the workspace."
  }

  return message
}

export function notifyCareerWorkspaceRefresh() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(CAREER_WORKSPACE_REFRESH_EVENT))
}

export function navigateCareerWorkspace(sectionKey: string, href: string, prefill?: CareerWorkspacePrefill) {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent(CAREER_WORKSPACE_NAVIGATE_EVENT, {
      detail: {
        sectionKey,
        href,
        prefill,
      },
    })
  )
}

export function setCareerWorkspaceTarget(applicationId: string) {
  if (typeof window === "undefined") return

  window.dispatchEvent(
    new CustomEvent<CareerWorkspaceTargetDetail>(CAREER_WORKSPACE_TARGET_EVENT, {
      detail: { applicationId },
    })
  )
}

export async function startCareerBackgroundJob(candidateId: string, jobType: CareerBackgroundJobType, payload: Record<string, unknown>) {
  const response = await fetch("/api/career/background-jobs", {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      candidate_id: candidateId,
      job_type: jobType,
      payload,
    }),
  })

  const json = await response.json()
  if (!response.ok) {
    throw new Error(json.error || "Failed to start background job")
  }

  notifyCareerWorkspaceRefresh()
  return json
}

export async function retryCareerBackgroundJob(jobId: string) {
  const response = await fetch(`/api/career/background-jobs/${jobId}`, {
    method: "POST",
    headers: await getAuthHeaders(),
  })

  const json = await response.json()
  if (!response.ok) {
    throw new Error(json.error || "Failed to retry background job")
  }

  notifyCareerWorkspaceRefresh()
  return json
}

export async function retryCareerLiveJobRun(runId: string) {
  const response = await fetch(`/api/career/live-job-search-runs/${runId}`, {
    method: "POST",
    headers: await getAuthHeaders(),
  })

  const json = await response.json()
  if (!response.ok) {
    throw new Error(json.error || "Failed to retry live job search")
  }

  notifyCareerWorkspaceRefresh()
  return json
}

export function careerBackgroundStartedMessage({
  label,
  destination,
  followUp,
}: {
  label: string
  destination?: string
  followUp?: string
}) {
  const parts = [`${label} started in the background.`]

  if (destination) {
    parts.push(`You can keep working while it runs, and the result will appear in ${destination}.`)
  } else {
    parts.push("You can keep working while it runs.")
  }

  if (followUp) {
    parts.push(followUp)
  }

  return parts.join(" ")
}

export function careerActionErrorMessage(actionLabel = "complete this step") {
  return `We couldn't ${actionLabel}. Please try again.`
}

export function getCareerMessageTone(message: string): "success" | "info" | "notice" | "progress" | "error" {
  const normalized = message.trim().toLowerCase()

  if (
    normalized.includes("couldn't") ||
    normalized.includes("failed") ||
    normalized.includes("error") ||
    normalized.includes("unauthor") ||
    normalized.includes("violates")
  ) {
    return "error"
  }

  if (normalized.includes("prefilled")) {
    return "notice"
  }

  if (normalized.includes("started in the background")) {
    return "progress"
  }

  if (
    normalized.includes("saved") ||
    normalized.includes("updated") ||
    normalized.includes("copied") ||
    normalized.includes("downloaded")
  ) {
    return "success"
  }

  return "info"
}
