import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/admin"
import { processCareerBackgroundJob } from "@/lib/career-background-jobs"
import { computeNextRunAtIso, normalizeScheduleTimezone } from "@/lib/premium-autopilot"

function hasCronAccess(request: Request) {
  const configuredSecret = process.env.PREMIUM_AUTOPILOT_CRON_SECRET
  if (!configuredSecret) return false

  const headerSecret = request.headers.get("x-cron-secret") || ""
  const bearer = request.headers.get("authorization") || ""
  const bearerSecret = bearer.toLowerCase().startsWith("bearer ") ? bearer.slice(7).trim() : ""

  return headerSecret === configuredSecret || bearerSecret === configuredSecret
}

export async function POST(request: Request) {
  if (!hasCronAccess(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 })
  }

  const now = new Date()
  const nowIso = now.toISOString()

  const { data: dueRows, error } = await admin
    .from("career_premium_autopilot_settings")
    .select("*")
    .eq("is_enabled", true)
    .or(`next_run_at.is.null,next_run_at.lte.${nowIso}`)
    .order("updated_at", { ascending: true })
    .limit(30)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const summary = {
    scanned: (dueRows ?? []).length,
    queued: 0,
    skipped: 0,
    errors: [] as string[],
  }

  for (const row of dueRows ?? []) {
    const candidateId = row.candidate_id
    const userId = row.user_id
    let targetRole = (row.target_role || "").trim()

    if (!targetRole) {
      const { data: profile } = await admin
        .from("career_candidate_profiles")
        .select("recommended_target_roles, role_families")
        .eq("candidate_id", candidateId)
        .eq("user_id", userId)
        .order("profile_version", { ascending: false })
        .limit(1)
        .maybeSingle()

      const recommended = Array.isArray(profile?.recommended_target_roles)
        ? profile.recommended_target_roles.find((item) => typeof item === "string" && item.trim().length > 0)
        : null
      const roleFamily = Array.isArray(profile?.role_families)
        ? profile.role_families.find((item) => typeof item === "string" && item.trim().length > 0)
        : null
      targetRole = typeof recommended === "string"
        ? recommended.trim()
        : typeof roleFamily === "string"
          ? roleFamily.trim()
          : ""
    }

    if (!candidateId || !userId || !targetRole) {
      summary.skipped += 1
      continue
    }

    const { data: existingJob } = await admin
      .from("career_background_jobs")
      .select("id")
      .eq("candidate_id", candidateId)
      .eq("user_id", userId)
      .eq("job_type", "generate_premium_weekly_autopilot")
      .in("status", ["queued", "running"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingJob?.id) {
      summary.skipped += 1
      continue
    }

    const payload = {
      target_role: row.target_role,
      location: row.location,
      market_notes: row.market_notes,
      company_name: row.company_name,
      job_title: row.job_title || row.target_role,
      job_description: row.job_description,
      dossier_influence: row.dossier_influence || "medium",
      role_match_tightness: Number(row.role_match_tightness ?? 60),
      auto_research_from_matches: row.auto_research_from_matches !== false,
      auto_generate_cover_letters: row.auto_generate_cover_letters !== false,
      trigger_source: "scheduled_run",
    }

    const { data: job, error: insertError } = await admin
      .from("career_background_jobs")
      .insert([
        {
          candidate_id: candidateId,
          user_id: userId,
          job_type: "generate_premium_weekly_autopilot",
          request_payload: payload,
          status: "queued",
        },
      ])
      .select("id")
      .single()

    if (insertError || !job?.id) {
      summary.errors.push(insertError?.message || `Failed to queue autopilot for candidate ${candidateId}`)
      continue
    }

    const nextRunAt = computeNextRunAtIso({
      scheduleWeekday: Number(row.schedule_weekday ?? 1),
      scheduleHour: Number(row.schedule_hour ?? 9),
      scheduleTimezone: normalizeScheduleTimezone((row.schedule_timezone || "UTC") as string),
      fromDate: new Date(now.getTime() + 60_000),
    })

    await admin
      .from("career_premium_autopilot_settings")
      .update({
        last_run_at: nowIso,
        next_run_at: nextRunAt,
      })
      .eq("candidate_id", candidateId)
      .eq("user_id", userId)

    summary.queued += 1
    void processCareerBackgroundJob(job.id)
  }

  return NextResponse.json({
    ...summary,
    ran_at: nowIso,
  })
}
