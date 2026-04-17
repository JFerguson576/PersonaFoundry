import { NextResponse } from "next/server"
import { processCareerLiveJobRun } from "@/lib/career-background-jobs"
import { createAdminClient, getAdminCapabilities } from "@/lib/admin"
import { getRequestAuth } from "@/lib/supabase/auth"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function POST(req: Request, context: RouteContext) {
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

    const { id } = await context.params
    const { data: run } = await admin
      .from("career_live_job_runs")
      .select("id, candidate_id, user_id, target_role, location, market_notes")
      .eq("id", id)
      .single()

    if (!run) {
      return NextResponse.json({ error: "Live job search run not found" }, { status: 404 })
    }

    const { data: retryRun, error } = await admin
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
      .select("id, candidate_id, status, created_at")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    void processCareerLiveJobRun(retryRun.id)
    return NextResponse.json({ run: retryRun })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

