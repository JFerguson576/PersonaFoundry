import { NextResponse } from "next/server"
import { createAdminClient, getAdminCapabilities } from "@/lib/admin"
import { getRequestAuth } from "@/lib/supabase/auth"
import { createRouteClient } from "@/lib/supabase/route"

function isMissingDeletedAtColumn(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false
  if (error.code === "42703") return true
  const message = (error.message || "").toLowerCase()
  return message.includes("deleted_at") && message.includes("does not exist")
}

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(req: Request, context: RouteContext) {
  try {
    const { user, accessToken, errorMessage } = await getRequestAuth(req)

    if (!user) {
      return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
    }

    const currentUserId = user.id
    const capabilities = await getAdminCapabilities({ userId: user.id, email: user.email })
    const canViewAllCandidates = capabilities.isAdmin
    const { id } = await context.params
    const supabase = createRouteClient(accessToken ?? undefined)
    const admin = canViewAllCandidates ? createAdminClient() : null
    const dataClient = canViewAllCandidates && admin ? admin : supabase

    function buildCandidateQuery(shouldFilterDeleted: boolean) {
      let query = dataClient
        .from("career_candidates")
        .select("id, user_id, full_name, city, primary_goal, created_at")
        .eq("id", id)

      if (shouldFilterDeleted) {
        query = query.is("deleted_at", null)
      }

      if (!canViewAllCandidates || !admin) {
        query = query.eq("user_id", currentUserId)
      }

      return query.single()
    }

    let { data: candidate, error: candidateError } = await buildCandidateQuery(true)

    if (isMissingDeletedAtColumn(candidateError)) {
      const fallbackResult = await buildCandidateQuery(false)
      candidate = fallbackResult.data
      candidateError = fallbackResult.error
    }

    if (candidateError || !candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 })
    }

    let documentsQuery = dataClient
      .from("career_source_documents")
      .select("id, source_type, title, content_text, created_at")
      .eq("candidate_id", id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })

    if (!canViewAllCandidates || !admin) {
      documentsQuery = documentsQuery.eq("user_id", currentUserId)
    }

    const { data: documents, error: documentsError } = await documentsQuery

    if (documentsError) {
      return NextResponse.json({ error: documentsError.message }, { status: 400 })
    }

    let profilesQuery = dataClient
      .from("career_candidate_profiles")
      .select("id, profile_version, career_identity, market_positioning, seniority_level, core_strengths, signature_achievements, role_families, skills, risks_or_gaps, recommended_target_roles, created_at")
      .eq("candidate_id", id)
      .order("profile_version", { ascending: false })

    if (!canViewAllCandidates || !admin) {
      profilesQuery = profilesQuery.eq("user_id", currentUserId)
    }

    const { data: profiles, error: profilesError } = await profilesQuery

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 400 })
    }

    let assetsQuery = dataClient
      .from("career_generated_assets")
      .select("id, asset_type, version, title, content, created_at")
      .eq("candidate_id", id)
      .order("created_at", { ascending: false })

    if (!canViewAllCandidates || !admin) {
      assetsQuery = assetsQuery.eq("user_id", currentUserId)
    }

    const { data: assets, error: assetsError } = await assetsQuery

    if (assetsError) {
      return NextResponse.json({ error: assetsError.message }, { status: 400 })
    }

    let liveJobRunsQuery = dataClient
      .from("career_live_job_runs")
      .select("id, target_role, location, market_notes, status, error_message, result_asset_id, created_at, started_at, completed_at")
      .eq("candidate_id", id)
      .order("created_at", { ascending: false })

    if (!canViewAllCandidates || !admin) {
      liveJobRunsQuery = liveJobRunsQuery.eq("user_id", currentUserId)
    }

    const { data: liveJobRuns, error: liveJobRunsError } = await liveJobRunsQuery

    if (liveJobRunsError) {
      return NextResponse.json({ error: liveJobRunsError.message }, { status: 400 })
    }

    let backgroundJobsQuery = dataClient
      .from("career_background_jobs")
      .select("id, job_type, request_payload, status, result_summary, error_message, created_at, started_at, completed_at")
      .eq("candidate_id", id)
      .order("created_at", { ascending: false })

    if (!canViewAllCandidates || !admin) {
      backgroundJobsQuery = backgroundJobsQuery.eq("user_id", currentUserId)
    }

    const { data: backgroundJobs, error: backgroundJobsError } = await backgroundJobsQuery

    if (backgroundJobsError) {
      return NextResponse.json({ error: backgroundJobsError.message }, { status: 400 })
    }

    let applicationsQuery = dataClient
      .from("career_applications")
      .select("id, company_name, job_title, location, job_url, status, notes, next_action, follow_up_date, cover_letter_asset_id, company_dossier_asset_id, salary_analysis_asset_id, fit_analysis_asset_id, created_at, updated_at")
      .eq("candidate_id", id)
      .order("updated_at", { ascending: false })

    if (!canViewAllCandidates || !admin) {
      applicationsQuery = applicationsQuery.eq("user_id", currentUserId)
    }

    const { data: applications, error: applicationsError } = await applicationsQuery

    if (applicationsError) {
      return NextResponse.json({ error: applicationsError.message }, { status: 400 })
    }

    return NextResponse.json({
      candidate,
      documents: documents ?? [],
      profiles: profiles ?? [],
      assets: assets ?? [],
      liveJobRuns: liveJobRuns ?? [],
      backgroundJobs: backgroundJobs ?? [],
      applications: applications ?? [],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
