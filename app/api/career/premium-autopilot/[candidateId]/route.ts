import { NextResponse } from "next/server"
import { normalizeString } from "@/lib/career"
import { processCareerBackgroundJob } from "@/lib/career-background-jobs"
import { computeNextRunAtIso, normalizeScheduleTimezone } from "@/lib/premium-autopilot"
import { getRequestAuth } from "@/lib/supabase/auth"
import { createRouteClient } from "@/lib/supabase/route"
import { logUsageEvent } from "@/lib/telemetry"

type RouteContext = {
  params: Promise<{
    candidateId: string
  }>
}

type RawSettingsRow = {
  id: string | null
  is_enabled: boolean | null
  schedule_weekday: number | null
  schedule_hour: number | null
  schedule_timezone: string | null
  target_role: string | null
  location: string | null
  market_notes: string | null
  company_name: string | null
  job_title: string | null
  job_description: string | null
  dossier_influence: string | null
  role_match_tightness: number | null
  last_run_at: string | null
  next_run_at: string | null
  created_at?: string | null
  updated_at?: string | null
}

function isMissingAutopilotTable(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false
  if (error.code === "42P01") return true
  const message = (error.message || "").toLowerCase()
  return message.includes("career_premium_autopilot_settings") && (message.includes("does not exist") || message.includes("schema cache"))
}

function missingTableResponse() {
  return NextResponse.json(
    {
      error:
        "Premium autopilot is not initialized yet. Run supabase/career_premium_autopilot.sql in Supabase SQL Editor, then retry.",
    },
    { status: 400 }
  )
}

function toInteger(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : fallback
}

function normalizeSettingsRow(row: RawSettingsRow | null | undefined) {
  return {
    id: row?.id ?? null,
    is_enabled: Boolean(row?.is_enabled),
    schedule_weekday: Math.max(0, Math.min(6, toInteger(row?.schedule_weekday, 1))),
    schedule_hour: Math.max(0, Math.min(23, toInteger(row?.schedule_hour, 9))),
    schedule_timezone: normalizeScheduleTimezone(normalizeString(row?.schedule_timezone) || "UTC"),
    target_role: normalizeString(row?.target_role),
    location: normalizeString(row?.location),
    market_notes: normalizeString(row?.market_notes),
    company_name: normalizeString(row?.company_name),
    job_title: normalizeString(row?.job_title),
    job_description: normalizeString(row?.job_description),
    dossier_influence: normalizeString(row?.dossier_influence) || "medium",
    role_match_tightness: Math.max(0, Math.min(100, toInteger(row?.role_match_tightness, 60))),
    last_run_at: row?.last_run_at ?? null,
    next_run_at: row?.next_run_at ?? null,
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
  }
}

async function getProfileTargetRole(params: {
  supabase: ReturnType<typeof createRouteClient>
  candidateId: string
  userId: string
}) {
  const { data } = await params.supabase
    .from("career_candidate_profiles")
    .select("recommended_target_roles, role_families")
    .eq("candidate_id", params.candidateId)
    .eq("user_id", params.userId)
    .order("profile_version", { ascending: false })
    .limit(1)
    .maybeSingle()

  const recommended = Array.isArray(data?.recommended_target_roles)
    ? data.recommended_target_roles.find((item) => typeof item === "string" && item.trim().length > 0)
    : null
  if (recommended && typeof recommended === "string") {
    return recommended.trim()
  }

  const roleFamily = Array.isArray(data?.role_families)
    ? data.role_families.find((item) => typeof item === "string" && item.trim().length > 0)
    : null
  return typeof roleFamily === "string" ? roleFamily.trim() : ""
}

export async function GET(request: Request, context: RouteContext) {
  const { user, accessToken, errorMessage } = await getRequestAuth(request)

  if (!user || !accessToken) {
    return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
  }

  const { candidateId } = await context.params
  const supabase = createRouteClient(accessToken)

  const { data: candidate } = await supabase
    .from("career_candidates")
    .select("id")
    .eq("id", candidateId)
    .eq("user_id", user.id)
    .single()

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found." }, { status: 404 })
  }

  const { data, error } = await supabase
    .from("career_premium_autopilot_settings")
    .select("*")
    .eq("candidate_id", candidateId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    if (isMissingAutopilotTable(error)) return missingTableResponse()
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ settings: normalizeSettingsRow((data ?? null) as RawSettingsRow | null) })
}

export async function PUT(request: Request, context: RouteContext) {
  const { user, accessToken, errorMessage } = await getRequestAuth(request)

  if (!user || !accessToken) {
    return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
  }

  const { candidateId } = await context.params
  const supabase = createRouteClient(accessToken)

  const { data: candidate } = await supabase
    .from("career_candidates")
    .select("id")
    .eq("id", candidateId)
    .eq("user_id", user.id)
    .single()

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found." }, { status: 404 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 })
  }

  const isEnabled = Boolean(body.is_enabled)
  const scheduleWeekday = Math.max(0, Math.min(6, toInteger(body.schedule_weekday, 1)))
  const scheduleHour = Math.max(0, Math.min(23, toInteger(body.schedule_hour, 9)))
  const scheduleTimezone = normalizeScheduleTimezone(normalizeString(body.schedule_timezone) || "UTC")
  const targetRole = normalizeString(body.target_role) || null
  const location = normalizeString(body.location) || null
  const marketNotes = normalizeString(body.market_notes) || null
  const companyName = normalizeString(body.company_name) || null
  const jobTitle = normalizeString(body.job_title) || null
  const jobDescription = normalizeString(body.job_description) || null
  const dossierInfluence = normalizeString(body.dossier_influence) || "medium"
  const roleMatchTightness = Math.max(0, Math.min(100, toInteger(body.role_match_tightness, 60)))

  let resolvedTargetRole = targetRole
  if (isEnabled && !resolvedTargetRole) {
    resolvedTargetRole = await getProfileTargetRole({ supabase, candidateId, userId: user.id })
  }

  if (isEnabled && !resolvedTargetRole) {
    return NextResponse.json({ error: "Target role is required. Add one or generate a candidate profile first." }, { status: 400 })
  }

  const nextRunAt = isEnabled
    ? computeNextRunAtIso({
        scheduleWeekday,
        scheduleHour,
        scheduleTimezone,
      })
    : null

  const upsertPayload = {
    candidate_id: candidateId,
    user_id: user.id,
    is_enabled: isEnabled,
    schedule_weekday: scheduleWeekday,
    schedule_hour: scheduleHour,
    schedule_timezone: scheduleTimezone,
    target_role: resolvedTargetRole || null,
    location,
    market_notes: marketNotes,
    company_name: companyName,
    job_title: jobTitle,
    job_description: jobDescription,
    dossier_influence: dossierInfluence,
    role_match_tightness: roleMatchTightness,
    next_run_at: nextRunAt,
  }

  const { data, error } = await supabase
    .from("career_premium_autopilot_settings")
    .upsert(upsertPayload, { onConflict: "candidate_id,user_id" })
    .select("*")
    .single()

  if (error) {
    if (isMissingAutopilotTable(error)) return missingTableResponse()
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await logUsageEvent(supabase, {
    userId: user.id,
    module: "career_advisor",
    eventType: "premium_autopilot_settings_saved",
    candidateId,
    metadata: {
      is_enabled: isEnabled,
      schedule_weekday: scheduleWeekday,
      schedule_hour: scheduleHour,
      has_company_context: Boolean(companyName || jobDescription),
      role_match_tightness: roleMatchTightness,
    },
  })

  return NextResponse.json({ settings: normalizeSettingsRow(data as RawSettingsRow) })
}

export async function POST(request: Request, context: RouteContext) {
  const { user, accessToken, errorMessage } = await getRequestAuth(request)

  if (!user || !accessToken) {
    return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
  }

  const { candidateId } = await context.params
  const supabase = createRouteClient(accessToken)

  const { data: candidate } = await supabase
    .from("career_candidates")
    .select("id")
    .eq("id", candidateId)
    .eq("user_id", user.id)
    .single()

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found." }, { status: 404 })
  }

  const { data: settings } = await supabase
    .from("career_premium_autopilot_settings")
    .select("*")
    .eq("candidate_id", candidateId)
    .eq("user_id", user.id)
    .maybeSingle()

  // If the table is missing, Supabase returns this as a query error on select in some environments.
  if (!settings) {
    const { error: tableCheckError } = await supabase
      .from("career_premium_autopilot_settings")
      .select("id")
      .limit(1)
    if (isMissingAutopilotTable(tableCheckError)) return missingTableResponse()
  }

  if (!settings) {
    return NextResponse.json({ error: "Save autopilot settings first." }, { status: 400 })
  }

  let targetRole = normalizeString(settings.target_role)
  if (!targetRole) {
    targetRole = await getProfileTargetRole({ supabase, candidateId, userId: user.id })
  }
  if (!targetRole) {
    return NextResponse.json({ error: "No target role found. Add one in Autopilot or generate your candidate profile first." }, { status: 400 })
  }

  const payload = {
    target_role: targetRole,
    location: settings.location,
    market_notes: settings.market_notes,
    company_name: settings.company_name,
    job_title: settings.job_title || settings.target_role,
    job_description: settings.job_description,
    dossier_influence: settings.dossier_influence || "medium",
    role_match_tightness: Math.max(0, Math.min(100, toInteger(settings.role_match_tightness, 60))),
    trigger_source: "manual_run",
  }

  const { data: job, error } = await supabase
    .from("career_background_jobs")
    .insert([
      {
        candidate_id: candidateId,
        user_id: user.id,
        job_type: "generate_premium_weekly_autopilot",
        request_payload: payload,
        status: "queued",
      },
    ])
    .select("id, candidate_id, job_type, status, created_at")
    .single()

  if (error) {
    if (isMissingAutopilotTable(error)) return missingTableResponse()
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await supabase
    .from("career_premium_autopilot_settings")
    .update({
      last_run_at: new Date().toISOString(),
      next_run_at: computeNextRunAtIso({
        scheduleWeekday: toInteger(settings.schedule_weekday, 1),
        scheduleHour: toInteger(settings.schedule_hour, 9),
        scheduleTimezone: normalizeScheduleTimezone(normalizeString(settings.schedule_timezone) || "UTC"),
      }),
    })
    .eq("candidate_id", candidateId)
    .eq("user_id", user.id)

  await logUsageEvent(supabase, {
    userId: user.id,
    module: "career_advisor",
    eventType: "premium_autopilot_manual_run_started",
    candidateId,
    metadata: { job_id: job.id, target_role: targetRole },
  })

  void processCareerBackgroundJob(job.id)

  return NextResponse.json({ job })
}
