import { NextResponse } from "next/server"
import { normalizeString } from "@/lib/career"
import { getRequestAuth } from "@/lib/supabase/auth"
import { createRouteClient } from "@/lib/supabase/route"
import { logUsageEvent } from "@/lib/telemetry"

type RouteContext = {
  params: Promise<{
    candidateId: string
  }>
}

function isMissingReviewQueueTable(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false
  if (error.code === "42P01") return true
  const message = (error.message || "").toLowerCase()
  return message.includes("career_premium_autopilot_review_queue") && (message.includes("does not exist") || message.includes("schema cache"))
}

function missingReviewQueueResponse() {
  return NextResponse.json(
    {
      error:
        "Premium Autopilot review queue is not initialized yet. Run supabase/career_premium_autopilot_review_queue.sql in Supabase SQL Editor, then retry.",
    },
    { status: 400 }
  )
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
    .from("career_premium_autopilot_review_queue")
    .select(
      "id, trigger_source, target_role, company_name, job_title, location, job_url, live_search_asset_id, company_dossier_asset_id, cover_letter_asset_id, status, review_notes, reviewed_at, reviewed_by, created_at"
    )
    .eq("candidate_id", candidateId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) {
    if (isMissingReviewQueueTable(error)) return missingReviewQueueResponse()
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ queue: data ?? [] })
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

  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 })
  }

  const queueId = normalizeString(body.queue_id)
  const action = normalizeString(body.action)
  const reviewNotes = normalizeString(body.review_notes) || null

  if (!queueId) {
    return NextResponse.json({ error: "queue_id is required." }, { status: 400 })
  }
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be approve or reject." }, { status: 400 })
  }

  const { data: queueRow, error: queueError } = await supabase
    .from("career_premium_autopilot_review_queue")
    .select("*")
    .eq("id", queueId)
    .eq("candidate_id", candidateId)
    .eq("user_id", user.id)
    .single()

  if (queueError) {
    if (isMissingReviewQueueTable(queueError)) return missingReviewQueueResponse()
    return NextResponse.json({ error: queueError.message }, { status: 400 })
  }

  const nextStatus = action === "approve" ? "approved" : "rejected"
  const nowIso = new Date().toISOString()

  const { error: updateError } = await supabase
    .from("career_premium_autopilot_review_queue")
    .update({
      status: nextStatus,
      review_notes: reviewNotes,
      reviewed_at: nowIso,
      reviewed_by: user.id,
      updated_at: nowIso,
    })
    .eq("id", queueId)
    .eq("candidate_id", candidateId)
    .eq("user_id", user.id)

  if (updateError) {
    if (isMissingReviewQueueTable(updateError)) return missingReviewQueueResponse()
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  if (action === "approve") {
    const companyName = normalizeString(queueRow.company_name)
    const jobTitle = normalizeString(queueRow.job_title)
    if (companyName && jobTitle) {
      const { data: existingApplication } = await supabase
        .from("career_applications")
        .select("id")
        .eq("candidate_id", candidateId)
        .eq("user_id", user.id)
        .eq("company_name", companyName)
        .eq("job_title", jobTitle)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingApplication?.id) {
        await supabase
          .from("career_applications")
          .update({
            status: "targeting",
            next_action: "Review approved autopilot pack and apply",
            notes: reviewNotes || "Approved from premium autopilot review queue.",
            cover_letter_asset_id: queueRow.cover_letter_asset_id || null,
            company_dossier_asset_id: queueRow.company_dossier_asset_id || null,
          })
          .eq("id", existingApplication.id)
          .eq("candidate_id", candidateId)
          .eq("user_id", user.id)
      } else {
        await supabase.from("career_applications").insert([
          {
            candidate_id: candidateId,
            user_id: user.id,
            company_name: companyName,
            job_title: jobTitle,
            location: normalizeString(queueRow.location) || null,
            job_url: normalizeString(queueRow.job_url) || null,
            status: "targeting",
            next_action: "Review approved autopilot pack and apply",
            notes: reviewNotes || "Approved from premium autopilot review queue.",
            cover_letter_asset_id: queueRow.cover_letter_asset_id || null,
            company_dossier_asset_id: queueRow.company_dossier_asset_id || null,
          },
        ])
      }
    }
  }

  await logUsageEvent(supabase, {
    userId: user.id,
    module: "career_advisor",
    eventType: action === "approve" ? "premium_autopilot_queue_approved" : "premium_autopilot_queue_rejected",
    candidateId,
    metadata: {
      queue_id: queueId,
      company_name: normalizeString(queueRow.company_name) || null,
      job_title: normalizeString(queueRow.job_title) || null,
    },
  })

  return NextResponse.json({ success: true, status: nextStatus })
}

