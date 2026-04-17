import { NextResponse } from "next/server"
import { normalizeString } from "@/lib/career"
import { processCareerLiveJobRun } from "@/lib/career-background-jobs"
import { getRequestAuth } from "@/lib/supabase/auth"
import { createRouteClient } from "@/lib/supabase/route"
import { logUsageEvent } from "@/lib/telemetry"

export async function POST(req: Request) {
  try {
    const { user, accessToken, errorMessage } = await getRequestAuth(req)
    if (!user) {
      return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
    }

    const supabase = createRouteClient(accessToken ?? undefined)
    const body = await req.json()
    const candidateId = normalizeString(body?.candidate_id)
    const targetRole = normalizeString(body?.target_role)
    const location = normalizeString(body?.location)
    const marketNotes = normalizeString(body?.market_notes)

    if (!candidateId || !targetRole) {
      return NextResponse.json({ error: "candidate_id and target_role are required" }, { status: 400 })
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

    const { data: run, error } = await supabase
      .from("career_live_job_runs")
      .insert([
        {
          candidate_id: candidateId,
          user_id: user.id,
          target_role: targetRole,
          location: location || null,
          market_notes: marketNotes || null,
          status: "queued",
        },
      ])
      .select("id, candidate_id, target_role, location, market_notes, status, created_at")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await logUsageEvent(supabase, {
      userId: user.id,
      module: "career_advisor",
      eventType: "live_job_search_started",
      candidateId,
      metadata: {
        run_id: run.id,
        target_role: targetRole,
        location: location || null,
      },
    })

    void processCareerLiveJobRun(run.id)

    return NextResponse.json({ run })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
