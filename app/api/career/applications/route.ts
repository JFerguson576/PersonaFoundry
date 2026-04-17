import { NextResponse } from "next/server"
import { normalizeString } from "@/lib/career"
import { getRequestAuth } from "@/lib/supabase/auth"
import { createRouteClient } from "@/lib/supabase/route"
import { logUsageEvent } from "@/lib/telemetry"

const allowedStatuses = new Set([
  "targeting",
  "shortlisted",
  "applied",
  "interviewing",
  "final_round",
  "offer",
  "on_hold",
  "rejected",
  "archived",
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
    const companyName = normalizeString(body?.company_name)
    const jobTitle = normalizeString(body?.job_title)
    const location = normalizeString(body?.location)
    const jobUrl = normalizeString(body?.job_url)
    const notes = normalizeString(body?.notes)
    const nextAction = normalizeString(body?.next_action)
    const followUpDate = normalizeString(body?.follow_up_date)
    const coverLetterAssetId = normalizeString(body?.cover_letter_asset_id)
    const companyDossierAssetId = normalizeString(body?.company_dossier_asset_id)
    const salaryAnalysisAssetId = normalizeString(body?.salary_analysis_asset_id)
    const fitAnalysisAssetId = normalizeString(body?.fit_analysis_asset_id)
    const status = normalizeString(body?.status) || "targeting"

    if (!candidateId || !companyName || !jobTitle) {
      return NextResponse.json({ error: "candidate_id, company_name, and job_title are required" }, { status: 400 })
    }

    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ error: "status is invalid" }, { status: 400 })
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

    const { data: application, error } = await supabase
      .from("career_applications")
      .insert([
        {
          candidate_id: candidateId,
          user_id: user.id,
          company_name: companyName,
          job_title: jobTitle,
          location: location || null,
          job_url: jobUrl || null,
          status,
          notes: notes || null,
          next_action: nextAction || null,
          follow_up_date: followUpDate || null,
          cover_letter_asset_id: coverLetterAssetId || null,
          company_dossier_asset_id: companyDossierAssetId || null,
          salary_analysis_asset_id: salaryAnalysisAssetId || null,
          fit_analysis_asset_id: fitAnalysisAssetId || null,
        },
      ])
      .select("id, company_name, job_title, location, job_url, status, notes, next_action, follow_up_date, cover_letter_asset_id, company_dossier_asset_id, salary_analysis_asset_id, fit_analysis_asset_id, created_at, updated_at")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await logUsageEvent(supabase, {
      userId: user.id,
      module: "career_advisor",
      eventType: "application_tracker_entry_created",
      candidateId,
      metadata: {
        application_id: application.id,
        company_name: companyName,
        job_title: jobTitle,
        status,
      },
    })

    return NextResponse.json({ application })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
