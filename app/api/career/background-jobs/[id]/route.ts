import { NextResponse } from "next/server"
import { processCareerBackgroundJob } from "@/lib/career-background-jobs"
import { getRequestAuth } from "@/lib/supabase/auth"
import { createRouteClient } from "@/lib/supabase/route"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const { user, accessToken, errorMessage } = await getRequestAuth(req)
    if (!user) {
      return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
    }

    const { id } = await context.params
    const supabase = createRouteClient(accessToken ?? undefined)

    const { data: job } = await supabase
      .from("career_background_jobs")
      .select("id, candidate_id, user_id, job_type, request_payload")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (!job) {
      return NextResponse.json({ error: "Background job not found" }, { status: 404 })
    }

    const { data: retryJob, error } = await supabase
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
      .select("id, status, created_at")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    void processCareerBackgroundJob(retryJob.id)

    return NextResponse.json({ job: retryJob })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
