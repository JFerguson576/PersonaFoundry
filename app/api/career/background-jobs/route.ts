import { NextResponse } from "next/server"
import { normalizeString } from "@/lib/career"
import { processCareerBackgroundJob } from "@/lib/career-background-jobs"
import { getRequestAuth } from "@/lib/supabase/auth"
import { createRouteClient } from "@/lib/supabase/route"
import { logUsageEvent } from "@/lib/telemetry"

const supportedJobTypes = new Set([
  "generate_profile",
  "generate_assets",
  "generate_company_dossier",
  "generate_outreach_strategy",
  "generate_cover_letter",
  "generate_interview_prep",
  "generate_strategy_document",
  "generate_target_company_workflow",
  "generate_application_sprint",
  "generate_deep_prospect_research",
  "generate_recruiter_match_search",
  "generate_salary_analysis",
  "generate_course_recommendations",
  "generate_application_fit_analysis",
  "generate_premium_weekly_autopilot",
])

export async function POST(req: Request) {
  try {
    const { user, accessToken, errorMessage } = await getRequestAuth(req)
    if (!user) {
      return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
    }

    const supabase = createRouteClient(accessToken ?? undefined)
    const body = await req.json()
    const candidateId = normalizeString(body?.candidate_id)
    const jobType = normalizeString(body?.job_type)
    const payload = body?.payload && typeof body.payload === "object" ? body.payload as Record<string, unknown> : {}

    if (!candidateId || !jobType) {
      return NextResponse.json({ error: "candidate_id and job_type are required" }, { status: 400 })
    }

    if (!supportedJobTypes.has(jobType)) {
      return NextResponse.json({ error: "Unsupported background job type" }, { status: 400 })
    }

    const { data: candidate } = await supabase
      .from("career_candidates")
      .select("id")
      .eq("id", candidateId)
      .eq("user_id", user.id)
      .single()

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 })
    }

    const { data: job, error } = await supabase
      .from("career_background_jobs")
      .insert([
        {
          candidate_id: candidateId,
          user_id: user.id,
          job_type: jobType,
          request_payload: payload,
          status: "queued",
        },
      ])
      .select("id, candidate_id, job_type, status, created_at")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await logUsageEvent(supabase, {
      userId: user.id,
      module: "career_advisor",
      eventType: "background_job_started",
      candidateId,
      metadata: {
        job_id: job.id,
        job_type: jobType,
      },
    })

    void processCareerBackgroundJob(job.id)

    return NextResponse.json({ job })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
