import { NextResponse } from "next/server"
import { normalizeString } from "@/lib/career"
import { createAdminClient, getAdminCapabilities } from "@/lib/admin"
import { getRequestAuth } from "@/lib/supabase/auth"
import { createRouteClient } from "@/lib/supabase/route"
import { logUsageEvent } from "@/lib/telemetry"

function isMissingDeletedAtColumn(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false
  if (error.code === "42703") return true
  const message = (error.message || "").toLowerCase()
  return message.includes("deleted_at") && message.includes("does not exist")
}

export async function GET(req: Request) {
  try {
    const { user, accessToken, errorMessage } = await getRequestAuth(req)

    if (!user) {
      return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
    }

    const capabilities = await getAdminCapabilities({ userId: user.id, email: user.email })
    const canViewAllCandidates = capabilities.isAdmin
    const supabase = createRouteClient(accessToken ?? undefined)
    const admin = canViewAllCandidates ? createAdminClient() : null
    const dataClient = canViewAllCandidates && admin ? admin : supabase
    const url = new URL(req.url)
    const search = normalizeString(url.searchParams.get("q"))
    const ownerUserId = normalizeString(url.searchParams.get("user_id"))
    const scope = normalizeString(url.searchParams.get("scope"))
    const ownerPreviewUserId = normalizeString(url.searchParams.get("owner_user_id"))

    function buildCandidatesQuery(shouldFilterDeleted: boolean) {
      let query = dataClient
        .from("career_candidates")
        .select("id, full_name, city, primary_goal, created_at, user_id")

      if (shouldFilterDeleted) {
        query = query.is("deleted_at", null)
      }

      if (scope === "mine" || !canViewAllCandidates || !admin) {
        query = query.eq("user_id", user.id)
      } else if (scope === "owner_preview") {
        if (ownerPreviewUserId) {
          query = query.eq("user_id", ownerPreviewUserId)
        } else {
          query = query.eq("user_id", "__missing_owner_preview__")
        }
      } else if (ownerUserId) {
        query = query.eq("user_id", ownerUserId)
      }

      if (search) {
        const safeSearch = search.replaceAll(",", " ")
        query = query.or(
          `full_name.ilike.%${safeSearch}%,city.ilike.%${safeSearch}%,primary_goal.ilike.%${safeSearch}%`
        )
      }

      return query.order("created_at", { ascending: false }).limit(canViewAllCandidates && admin ? 500 : 200)
    }

    let { data: candidates, error } = await buildCandidatesQuery(true)

    if (isMissingDeletedAtColumn(error)) {
      const fallbackResult = await buildCandidatesQuery(false)
      candidates = fallbackResult.data
      error = fallbackResult.error
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const candidateIds = (candidates ?? []).map((candidate) => candidate.id)

    if (candidateIds.length === 0) {
      return NextResponse.json({ candidates: [] })
    }

    const [documentsResult, profilesResult, assetsResult, liveRunsResult, applicationsResult] = await Promise.all([
      canViewAllCandidates && admin
        ? admin.from("career_source_documents").select("candidate_id, source_type, created_at").in("candidate_id", candidateIds)
        : supabase.from("career_source_documents").select("candidate_id, source_type, created_at").in("candidate_id", candidateIds).eq("user_id", user.id),
      canViewAllCandidates && admin
        ? admin.from("career_candidate_profiles").select("candidate_id, created_at").in("candidate_id", candidateIds)
        : supabase.from("career_candidate_profiles").select("candidate_id, created_at").in("candidate_id", candidateIds).eq("user_id", user.id),
      canViewAllCandidates && admin
        ? admin.from("career_generated_assets").select("candidate_id, asset_type, created_at").in("candidate_id", candidateIds)
        : supabase.from("career_generated_assets").select("candidate_id, asset_type, created_at").in("candidate_id", candidateIds).eq("user_id", user.id),
      canViewAllCandidates && admin
        ? admin.from("career_live_job_runs").select("candidate_id, status, created_at").in("candidate_id", candidateIds)
        : supabase.from("career_live_job_runs").select("candidate_id, status, created_at").in("candidate_id", candidateIds).eq("user_id", user.id),
      canViewAllCandidates && admin
        ? admin.from("career_applications").select("candidate_id, status, follow_up_date, updated_at").in("candidate_id", candidateIds)
        : supabase.from("career_applications").select("candidate_id, status, follow_up_date, updated_at").in("candidate_id", candidateIds).eq("user_id", user.id),
    ])

    const documentCountByCandidate = new Map<string, number>()
    const profileCountByCandidate = new Map<string, number>()
    const assetCountByCandidate = new Map<string, number>()
    const liveSearchCountByCandidate = new Map<string, number>()
    const activeRunCountByCandidate = new Map<string, number>()
    const applicationCountByCandidate = new Map<string, number>()
    const activeApplicationCountByCandidate = new Map<string, number>()
    const overdueFollowUpCountByCandidate = new Map<string, number>()
    const dueTodayCountByCandidate = new Map<string, number>()
    const latestActivityByCandidate = new Map<string, string>()
    const sourceFlagsByCandidate = new Map<string, { hasCv: boolean; hasStrengths: boolean; hasSupportingProof: boolean }>()
    const todayKey = new Date().toISOString().slice(0, 10)

    function increment(map: Map<string, number>, key: string) {
      map.set(key, (map.get(key) ?? 0) + 1)
    }

    function registerActivity(candidateId: string, createdAt: string | null) {
      if (!createdAt) return
      const current = latestActivityByCandidate.get(candidateId)
      if (!current || new Date(createdAt).getTime() > new Date(current).getTime()) {
        latestActivityByCandidate.set(candidateId, createdAt)
      }
    }

    function getSourceFlags(candidateId: string) {
      const current = sourceFlagsByCandidate.get(candidateId)
      if (current) return current

      const next = { hasCv: false, hasStrengths: false, hasSupportingProof: false }
      sourceFlagsByCandidate.set(candidateId, next)
      return next
    }

    for (const document of documentsResult.data ?? []) {
      increment(documentCountByCandidate, document.candidate_id)
      const flags = getSourceFlags(document.candidate_id)
      const sourceType = normalizeString(document.source_type)
      if (sourceType === "cv") flags.hasCv = true
      if (sourceType === "gallup_strengths" || sourceType === "strengths") flags.hasStrengths = true
      if (["linkedin", "cover_letter", "achievement_story", "notes", "interview_reflection"].includes(sourceType)) {
        flags.hasSupportingProof = true
      }
      registerActivity(document.candidate_id, document.created_at)
    }

    for (const profile of profilesResult.data ?? []) {
      increment(profileCountByCandidate, profile.candidate_id)
      registerActivity(profile.candidate_id, profile.created_at)
    }

    for (const asset of assetsResult.data ?? []) {
      increment(assetCountByCandidate, asset.candidate_id)
      if (asset.asset_type === "live_job_search") {
        increment(liveSearchCountByCandidate, asset.candidate_id)
      }
      registerActivity(asset.candidate_id, asset.created_at)
    }

    for (const run of liveRunsResult.data ?? []) {
      if (run.status === "queued" || run.status === "running") {
        increment(activeRunCountByCandidate, run.candidate_id)
      }
      registerActivity(run.candidate_id, run.created_at)
    }

    for (const application of applicationsResult.data ?? []) {
      increment(applicationCountByCandidate, application.candidate_id)
      const status = application.status ?? ""
      const isActive = !["offer", "rejected", "archived"].includes(status)
      if (isActive) {
        increment(activeApplicationCountByCandidate, application.candidate_id)
        if (application.follow_up_date && application.follow_up_date < todayKey) {
          increment(overdueFollowUpCountByCandidate, application.candidate_id)
        }
        if (application.follow_up_date === todayKey) {
          increment(dueTodayCountByCandidate, application.candidate_id)
        }
      }
      registerActivity(application.candidate_id, application.updated_at)
    }

    const candidatesWithSummary = (candidates ?? []).map((candidate) => {
      const documentCount = documentCountByCandidate.get(candidate.id) ?? 0
      const profileCount = profileCountByCandidate.get(candidate.id) ?? 0
      const assetCount = assetCountByCandidate.get(candidate.id) ?? 0
      const liveSearchCount = liveSearchCountByCandidate.get(candidate.id) ?? 0
      const activeRunCount = activeRunCountByCandidate.get(candidate.id) ?? 0
      const applicationCount = applicationCountByCandidate.get(candidate.id) ?? 0
      const activeApplicationCount = activeApplicationCountByCandidate.get(candidate.id) ?? 0
      const overdueFollowUpCount = overdueFollowUpCountByCandidate.get(candidate.id) ?? 0
      const dueTodayCount = dueTodayCountByCandidate.get(candidate.id) ?? 0
      const sourceFlags = sourceFlagsByCandidate.get(candidate.id) ?? { hasCv: false, hasStrengths: false, hasSupportingProof: false }

      const sourceScore =
        (sourceFlags.hasCv ? 35 : Math.min(documentCount, 1) * 15) +
        (sourceFlags.hasStrengths ? 35 : 0) +
        (sourceFlags.hasSupportingProof || documentCount >= 3 ? 30 : documentCount >= 2 ? 15 : 0)
      const positioningScore = profileCount > 0 ? 100 : 0
      const executionScore = Math.min(assetCount, 6) / 6 * 100
      const marketScore =
        (activeApplicationCount > 0 ? 40 : applicationCount > 0 ? 20 : 0) +
        (liveSearchCount > 0 ? 30 : 0) +
        (assetCount > 0 ? 20 : 0) +
        (overdueFollowUpCount === 0 && dueTodayCount === 0 && applicationCount > 0 ? 10 : 0)
      const readinessScore = Math.round((sourceScore + positioningScore + executionScore + marketScore) / 4)

      return {
        ...candidate,
        document_count: documentCount,
        profile_count: profileCount,
        asset_count: assetCount,
        live_search_count: liveSearchCount,
        active_run_count: activeRunCount,
        application_count: applicationCount,
        active_application_count: activeApplicationCount,
        overdue_follow_up_count: overdueFollowUpCount,
        due_today_count: dueTodayCount,
        latest_activity_at: latestActivityByCandidate.get(candidate.id) ?? candidate.created_at,
        readiness_score: readinessScore,
      }
    })

    return NextResponse.json({ candidates: candidatesWithSummary })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { user, accessToken, errorMessage } = await getRequestAuth(req)

    if (!user) {
      return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
    }

    const supabase = createRouteClient(accessToken ?? undefined)

    const body = await req.json()
    const fullName = normalizeString(body?.full_name)
    const city = normalizeString(body?.city)
    const primaryGoal = normalizeString(body?.primary_goal) || "new_role"

    if (!fullName) {
      return NextResponse.json({ error: "full_name is required" }, { status: 400 })
    }

    const { data: candidate, error } = await supabase
      .from("career_candidates")
      .insert([
        {
          user_id: user.id,
          full_name: fullName,
          city: city || null,
          primary_goal: primaryGoal,
        },
      ])
      .select("id, full_name, city, primary_goal")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await logUsageEvent(supabase, {
      userId: user.id,
      module: "career_advisor",
      eventType: "candidate_created",
      candidateId: candidate.id,
      metadata: {
        city: candidate.city,
        primary_goal: candidate.primary_goal,
      },
    })

    return NextResponse.json({ candidate })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
