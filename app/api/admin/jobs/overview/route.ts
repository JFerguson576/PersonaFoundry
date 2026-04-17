import { NextResponse } from "next/server"
import { createAdminClient, getAdminCapabilities } from "@/lib/admin"
import { getRequestAuth } from "@/lib/supabase/auth"

type JobSummary = {
  total: number
  queued: number
  running: number
  failed: number
  completed: number
}

function summarizeStatuses(items: Array<{ status: string | null }>): JobSummary {
  const summary: JobSummary = {
    total: items.length,
    queued: 0,
    running: 0,
    failed: 0,
    completed: 0,
  }

  for (const item of items) {
    const status = (item.status || "").toLowerCase()
    if (status === "queued") summary.queued += 1
    else if (status === "running") summary.running += 1
    else if (status === "failed") summary.failed += 1
    else if (status === "completed") summary.completed += 1
  }

  return summary
}

export async function GET(req: Request) {
  try {
    const { user, errorMessage } = await getRequestAuth(req)
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

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const [
      { data: backgroundJobs, error: backgroundError },
      { data: liveRuns, error: liveError },
      { count: bgFailed24h },
      { count: liveFailed24h },
    ] = await Promise.all([
      admin
        .from("career_background_jobs")
        .select("id, candidate_id, user_id, job_type, status, created_at, started_at, completed_at, error_message, result_summary")
        .order("created_at", { ascending: false })
        .limit(160),
      admin
        .from("career_live_job_runs")
        .select("id, candidate_id, user_id, target_role, location, status, created_at, started_at, completed_at, error_message, result_asset_id")
        .order("created_at", { ascending: false })
        .limit(160),
      admin.from("career_background_jobs").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", since24h),
      admin.from("career_live_job_runs").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", since24h),
    ])

    if (backgroundError) {
      return NextResponse.json({ error: backgroundError.message }, { status: 400 })
    }
    if (liveError) {
      return NextResponse.json({ error: liveError.message }, { status: 400 })
    }

    const candidateIds = [
      ...(backgroundJobs ?? []).map((job) => job.candidate_id).filter(Boolean),
      ...(liveRuns ?? []).map((run) => run.candidate_id).filter(Boolean),
    ]

    const uniqueCandidateIds = [...new Set(candidateIds)]
    let candidateLookup = new Map<string, { full_name: string | null; city: string | null }>()

    if (uniqueCandidateIds.length > 0) {
      const { data: candidates } = await admin
        .from("career_candidates")
        .select("id, full_name, city")
        .in("id", uniqueCandidateIds)
        .limit(500)

      candidateLookup = new Map(
        (candidates ?? []).map((candidate) => [candidate.id, { full_name: candidate.full_name, city: candidate.city }])
      )
    }

    const backgroundWithCandidate = (backgroundJobs ?? []).map((job) => {
      const candidate = candidateLookup.get(job.candidate_id)
      return {
        ...job,
        candidate_name: candidate?.full_name ?? null,
        candidate_city: candidate?.city ?? null,
      }
    })

    const liveWithCandidate = (liveRuns ?? []).map((run) => {
      const candidate = candidateLookup.get(run.candidate_id)
      return {
        ...run,
        candidate_name: candidate?.full_name ?? null,
        candidate_city: candidate?.city ?? null,
      }
    })

    return NextResponse.json({
      permissions: {
        is_admin: capabilities.isAdmin,
        is_superuser: capabilities.isSuperuser,
      },
      summary: {
        background: summarizeStatuses(backgroundWithCandidate),
        live: summarizeStatuses(liveWithCandidate),
        failed_24h: (bgFailed24h ?? 0) + (liveFailed24h ?? 0),
      },
      background_jobs: backgroundWithCandidate,
      live_runs: liveWithCandidate,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

