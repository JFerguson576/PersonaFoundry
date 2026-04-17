import { NextResponse } from "next/server"
import { createAdminClient, getAdminCapabilities } from "@/lib/admin"
import { processCareerBackgroundJob, processCareerLiveJobRun } from "@/lib/career-background-jobs"
import { getRequestAuth } from "@/lib/supabase/auth"

type RecoverSummary = {
  scanned_background: number
  scanned_live: number
  recovered_background: number
  recovered_live: number
  skipped_background: number
  skipped_live: number
  errors: string[]
}

const DEFAULT_STALLED_MINUTES = 20

function parseMinutes(value: string | null) {
  const parsed = Number(value || "")
  if (!Number.isFinite(parsed) || parsed < 5 || parsed > 240) return DEFAULT_STALLED_MINUTES
  return Math.floor(parsed)
}

function isStalled(startedAt: string | null | undefined, cutoffMs: number) {
  if (!startedAt) return false
  const startedMs = new Date(startedAt).getTime()
  if (!Number.isFinite(startedMs)) return false
  return startedMs <= cutoffMs
}

export async function POST(request: Request) {
  try {
    const { user, errorMessage } = await getRequestAuth(request)
    if (!user) {
      return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
    }

    const capabilities = await getAdminCapabilities({ userId: user.id, email: user.email })
    if (!capabilities.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY in .env.local" }, { status: 500 })
    }

    const url = new URL(request.url)
    const thresholdMinutes = parseMinutes(url.searchParams.get("minutes"))
    const cutoffMs = Date.now() - thresholdMinutes * 60 * 1000
    const cutoffIso = new Date(cutoffMs).toISOString()

    const summary: RecoverSummary = {
      scanned_background: 0,
      scanned_live: 0,
      recovered_background: 0,
      recovered_live: 0,
      skipped_background: 0,
      skipped_live: 0,
      errors: [],
    }

    const [{ data: stalledBackground, error: stalledBackgroundError }, { data: stalledLive, error: stalledLiveError }] = await Promise.all([
      admin
        .from("career_background_jobs")
        .select("id, candidate_id, user_id, job_type, request_payload, started_at, created_at, status")
        .eq("status", "running")
        .lte("started_at", cutoffIso)
        .order("started_at", { ascending: true })
        .limit(120),
      admin
        .from("career_live_job_runs")
        .select("id, candidate_id, user_id, target_role, location, market_notes, started_at, created_at, status")
        .eq("status", "running")
        .lte("started_at", cutoffIso)
        .order("started_at", { ascending: true })
        .limit(120),
    ])

    if (stalledBackgroundError) {
      return NextResponse.json({ error: stalledBackgroundError.message }, { status: 400 })
    }
    if (stalledLiveError) {
      return NextResponse.json({ error: stalledLiveError.message }, { status: 400 })
    }

    summary.scanned_background = (stalledBackground ?? []).length
    summary.scanned_live = (stalledLive ?? []).length

    for (const job of stalledBackground ?? []) {
      if (!isStalled(job.started_at, cutoffMs)) {
        summary.skipped_background += 1
        continue
      }

      try {
        const { data: retryJob, error: retryError } = await admin
          .from("career_background_jobs")
          .insert([
            {
              candidate_id: job.candidate_id,
              user_id: job.user_id,
              job_type: job.job_type,
              request_payload: job.request_payload ?? {},
              status: "queued",
            },
          ])
          .select("id")
          .single()

        if (retryError || !retryJob?.id) {
          summary.errors.push(`Background ${job.id}: ${retryError?.message || "retry insert failed"}`)
          continue
        }

        await admin
          .from("career_background_jobs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: `Auto-recovered after ${thresholdMinutes}m stalled run. Requeued as ${retryJob.id}.`,
            result_summary: "auto_recovered_stalled_job",
          })
          .eq("id", job.id)
          .eq("status", "running")

        summary.recovered_background += 1
        void processCareerBackgroundJob(retryJob.id)
      } catch (error) {
        summary.errors.push(`Background ${job.id}: ${error instanceof Error ? error.message : "unknown error"}`)
      }
    }

    for (const run of stalledLive ?? []) {
      if (!isStalled(run.started_at, cutoffMs)) {
        summary.skipped_live += 1
        continue
      }

      try {
        const { data: retryRun, error: retryError } = await admin
          .from("career_live_job_runs")
          .insert([
            {
              candidate_id: run.candidate_id,
              user_id: run.user_id,
              target_role: run.target_role,
              location: run.location,
              market_notes: run.market_notes,
              status: "queued",
            },
          ])
          .select("id")
          .single()

        if (retryError || !retryRun?.id) {
          summary.errors.push(`Live run ${run.id}: ${retryError?.message || "retry insert failed"}`)
          continue
        }

        await admin
          .from("career_live_job_runs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: `Auto-recovered after ${thresholdMinutes}m stalled run. Requeued as ${retryRun.id}.`,
          })
          .eq("id", run.id)
          .eq("status", "running")

        summary.recovered_live += 1
        void processCareerLiveJobRun(retryRun.id)
      } catch (error) {
        summary.errors.push(`Live run ${run.id}: ${error instanceof Error ? error.message : "unknown error"}`)
      }
    }

    return NextResponse.json({
      threshold_minutes: thresholdMinutes,
      summary,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

