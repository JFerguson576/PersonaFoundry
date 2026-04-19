"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { PlatformModuleNav } from "@/components/navigation/PlatformModuleNav"
import { getAuthHeaders } from "@/lib/career-client"
import { supabase } from "@/lib/supabase"

type JobStatus = "queued" | "running" | "failed" | "completed" | string

type BackgroundJobRow = {
  id: string
  candidate_id: string
  user_id: string
  job_type: string
  status: JobStatus
  created_at: string | null
  started_at: string | null
  completed_at: string | null
  error_message: string | null
  result_summary: string | null
  candidate_name: string | null
  candidate_city: string | null
}

type LiveRunRow = {
  id: string
  candidate_id: string
  user_id: string
  target_role: string | null
  location: string | null
  status: JobStatus
  created_at: string | null
  started_at: string | null
  completed_at: string | null
  error_message: string | null
  result_asset_id: string | null
  candidate_name: string | null
  candidate_city: string | null
}

type OverviewResponse = {
  permissions: {
    is_admin: boolean
    is_superuser: boolean
  }
  summary: {
    background: { total: number; queued: number; running: number; failed: number; completed: number }
    live: { total: number; queued: number; running: number; failed: number; completed: number }
    failed_24h: number
  }
  background_jobs: BackgroundJobRow[]
  live_runs: LiveRunRow[]
}

type CandidateHealthRow = {
  id: string
  full_name: string | null
  city: string | null
  primary_goal: string | null
  created_at: string | null
  document_count: number
  profile_count: number
  asset_count: number
  live_search_count: number
  active_run_count: number
  application_count: number
  active_application_count: number
  overdue_follow_up_count: number
  due_today_count: number
  latest_activity_at: string | null
  readiness_score: number
}

type CandidateHealthItem = {
  candidate: CandidateHealthRow
  riskScore: number
  reasons: string[]
  tone: "danger" | "warning" | "neutral"
}

type HealthInboxState = {
  candidate_id: string
  reviewed_at: string | null
  snoozed_until: string | null
  updated_by_user_id?: string | null
  updated_by_email?: string | null
  updated_at?: string | null
}

type RecoverySweepLog = {
  ranAt: string
  auto: boolean
  thresholdMinutes: number
  recovered: number
  scanned: number
  errors: number
  errorDetails?: string[]
}

function toneForStatus(status: string) {
  if (status === "failed") return "border-rose-300 bg-rose-50 text-rose-800"
  if (status === "running") return "border-sky-300 bg-sky-50 text-sky-800"
  if (status === "queued") return "border-amber-300 bg-amber-50 text-amber-800"
  return "border-emerald-300 bg-emerald-50 text-emerald-800"
}

function formatDate(value: string | null) {
  if (!value) return "N/A"
  return new Date(value).toLocaleString()
}

export function OperationsJobsClient() {
  const STALLED_THRESHOLD_MINUTES = 20
  const RECOVERY_LOG_KEY = "personara-operations-recovery-log-v1"
  const OPERATIONS_LAYOUT_PREFS_KEY = "personara-operations-layout-v1"
  const [session, setSession] = useState<Session | null>(null)
  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [message, setMessage] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "failed" | "running" | "queued" | "completed">("all")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [retryingKey, setRetryingKey] = useState("")
  const [candidateHealth, setCandidateHealth] = useState<CandidateHealthRow[]>([])
  const [healthInboxState, setHealthInboxState] = useState<Record<string, HealthInboxState>>({})
  const [showDismissedHealthItems, setShowDismissedHealthItems] = useState(false)
  const [healthInboxTableMissing, setHealthInboxTableMissing] = useState(false)
  const [isRecoveringStalled, setIsRecoveringStalled] = useState(false)
  const [recoveryLogs, setRecoveryLogs] = useState<RecoverySweepLog[]>([])
  const [showRecoveryHistory, setShowRecoveryHistory] = useState(false)
  const [activePanel, setActivePanel] = useState<keyof typeof collapsedPanels>("digest")
  const [collapsedPanels, setCollapsedPanels] = useState({
    digest: false,
    recovery: false,
    filters: false,
    healthInbox: false,
    background: false,
    live: false,
  })
  const hasRunAutoRecovery = useRef(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(RECOVERY_LOG_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        setRecoveryLogs(parsed.filter((entry) => entry?.ranAt))
      } else if (parsed?.ranAt) {
        // Backward compatibility with old single-log storage.
        setRecoveryLogs([parsed as RecoverySweepLog])
      }
    } catch {}
  }, [RECOVERY_LOG_KEY])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(OPERATIONS_LAYOUT_PREFS_KEY)
      if (!raw) {
        if (window.matchMedia("(max-width: 767px)").matches) {
          setCollapsedPanels({
            digest: false,
            recovery: true,
            filters: false,
            healthInbox: true,
            background: true,
            live: true,
          })
        }
        return
      }
      const parsed = JSON.parse(raw) as { collapsedPanels?: Partial<typeof collapsedPanels> }
      if (parsed.collapsedPanels) {
        setCollapsedPanels((current) => ({ ...current, ...parsed.collapsedPanels }))
      }
    } catch {}
  }, [OPERATIONS_LAYOUT_PREFS_KEY])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(RECOVERY_LOG_KEY, JSON.stringify(recoveryLogs))
  }, [RECOVERY_LOG_KEY, recoveryLogs])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(OPERATIONS_LAYOUT_PREFS_KEY, JSON.stringify({ collapsedPanels }))
  }, [OPERATIONS_LAYOUT_PREFS_KEY, collapsedPanels])

  const loadOverview = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const response = await fetch("/api/admin/jobs/overview", {
        cache: "no-store",
        headers: await getAuthHeaders(),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to load jobs monitor")
      }
      setOverview(json as OverviewResponse)
      setMessage("")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load jobs monitor")
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  const loadCandidateHealth = useCallback(async () => {
    try {
      const response = await fetch("/api/career/candidates", {
        cache: "no-store",
        headers: await getAuthHeaders(),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to load candidate health")
      }
      setCandidateHealth((json.candidates ?? []) as CandidateHealthRow[])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load candidate health")
    }
  }, [])

  const loadHealthInboxState = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/health-inbox", {
        cache: "no-store",
        headers: await getAuthHeaders(),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to load health inbox state")
      }

      const rows = (json.states ?? []) as HealthInboxState[]
      const mapped = rows.reduce<Record<string, HealthInboxState>>((acc, row) => {
        acc[row.candidate_id] = row
        return acc
      }, {})
      setHealthInboxState(mapped)
      setHealthInboxTableMissing(Boolean(json.table_missing))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load health inbox state")
    }
  }, [])

  useEffect(() => {
    async function load() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()
      setSession(currentSession)
      if (currentSession?.access_token) {
        await loadOverview()
        await loadCandidateHealth()
        await loadHealthInboxState()
      }
    }

    void load()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })
    return () => subscription.unsubscribe()
  }, [loadCandidateHealth, loadHealthInboxState, loadOverview])

  const filteredBackground = useMemo(() => {
    if (!overview) return []
    if (statusFilter === "all") return overview.background_jobs
    return overview.background_jobs.filter((job) => job.status === statusFilter)
  }, [overview, statusFilter])

  const filteredLiveRuns = useMemo(() => {
    if (!overview) return []
    if (statusFilter === "all") return overview.live_runs
    return overview.live_runs.filter((run) => run.status === statusFilter)
  }, [overview, statusFilter])

  const candidateHealthInbox = useMemo<CandidateHealthItem[]>(() => {
    const now = Date.now()
    const withRisk = candidateHealth.map((candidate) => {
      const reasons: string[] = []
      let riskScore = 0

      if (candidate.readiness_score < 40) {
        riskScore += 35
        reasons.push("Low readiness score")
      } else if (candidate.readiness_score < 60) {
        riskScore += 20
        reasons.push("Readiness still mid-stage")
      }

      if (candidate.profile_count === 0) {
        riskScore += 30
        reasons.push("No profile generated")
      }

      if (candidate.document_count < 2) {
        riskScore += 20
        reasons.push("Source pack is thin")
      }

      if (candidate.overdue_follow_up_count > 0) {
        riskScore += 30
        reasons.push(`${candidate.overdue_follow_up_count} overdue follow-up${candidate.overdue_follow_up_count > 1 ? "s" : ""}`)
      }

      if (candidate.active_run_count > 0) {
        riskScore += 8
        reasons.push("Background jobs still running")
      }

      if (candidate.latest_activity_at) {
        const ageMs = now - new Date(candidate.latest_activity_at).getTime()
        const days = Math.floor(ageMs / (24 * 60 * 60 * 1000))
        if (days >= 14) {
          riskScore += 22
          reasons.push(`No activity for ${days} days`)
        }
      } else {
        riskScore += 12
        reasons.push("No activity timestamp")
      }

      const tone: "danger" | "warning" | "neutral" = riskScore >= 60 ? "danger" : riskScore >= 30 ? "warning" : "neutral"
      return { candidate, riskScore, reasons, tone }
    })
    return withRisk
      .filter((item) => {
        const state = healthInboxState[item.candidate.id]
        if (!state) return true
        const nowIso = new Date().toISOString()
        const snoozedUntil = state.snoozed_until
        const reviewedAt = state.reviewed_at
        const reviewedUntil = reviewedAt ? new Date(new Date(reviewedAt).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString() : null
        const isDismissed =
          (snoozedUntil ? snoozedUntil > nowIso : false) || (reviewedUntil ? reviewedUntil > nowIso : false)
        return showDismissedHealthItems ? true : !isDismissed
      })
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 16)
  }, [candidateHealth, healthInboxState, showDismissedHealthItems])

  const digest = useMemo(() => {
    const now = new Date()
    const last24hCutoff = now.getTime() - 24 * 60 * 60 * 1000
    const backgroundJobs = overview?.background_jobs ?? []
    const liveRuns = overview?.live_runs ?? []
    const allRunsToday = [...backgroundJobs, ...liveRuns].filter((item) => {
      if (!item.created_at) return false
      return new Date(item.created_at).getTime() >= last24hCutoff
    })

    const completedToday = allRunsToday.filter((item) => item.status === "completed").length
    const failedToday = allRunsToday.filter((item) => item.status === "failed").length
    const runningNow = (overview?.summary.background.running ?? 0) + (overview?.summary.live.running ?? 0)
    const queuedNow = (overview?.summary.background.queued ?? 0) + (overview?.summary.live.queued ?? 0)

    const highRiskCount = candidateHealthInbox.filter((item) => item.riskScore >= 60).length
    const mediumRiskCount = candidateHealthInbox.filter((item) => item.riskScore >= 30 && item.riskScore < 60).length

    const topBackgroundFailure = backgroundJobs
      .filter((job) => job.status === "failed")
      .reduce<Record<string, number>>((acc, job) => {
        acc[job.job_type] = (acc[job.job_type] ?? 0) + 1
        return acc
      }, {})
    const topBackgroundFailureEntry = Object.entries(topBackgroundFailure).sort((a, b) => b[1] - a[1])[0] ?? null

    const completionRate = allRunsToday.length > 0 ? Math.round((completedToday / allRunsToday.length) * 100) : 100
    const overallTone: "healthy" | "attention" | "critical" =
      failedToday >= 6 || highRiskCount >= 8 ? "critical" : failedToday >= 2 || highRiskCount >= 3 ? "attention" : "healthy"

    return {
      dateLabel: now.toLocaleDateString(),
      completionRate,
      failedToday,
      completedToday,
      totalToday: allRunsToday.length,
      runningNow,
      queuedNow,
      highRiskCount,
      mediumRiskCount,
      topBackgroundFailureEntry,
      overallTone,
    }
  }, [candidateHealthInbox, overview])

  const stalledRunningCount = useMemo(() => {
    if (!overview) return 0
    const cutoff = Date.now() - STALLED_THRESHOLD_MINUTES * 60 * 1000
    const isStalledRunning = (item: { status: string; started_at: string | null }) =>
      item.status === "running" && item.started_at && new Date(item.started_at).getTime() <= cutoff

    const backgroundStalled = overview.background_jobs.filter(isStalledRunning).length
    const liveStalled = overview.live_runs.filter(isStalledRunning).length
    return backgroundStalled + liveStalled
  }, [overview, STALLED_THRESHOLD_MINUTES])

  const runStalledRecoverySweep = useCallback(async (auto = false) => {
    setIsRecoveringStalled(true)
    try {
      const response = await fetch(`/api/admin/jobs/recover-stalled?minutes=${STALLED_THRESHOLD_MINUTES}`, {
        method: "POST",
        headers: await getAuthHeaders(),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to run stalled recovery")
      }

      const recovered = (json.summary?.recovered_background ?? 0) + (json.summary?.recovered_live ?? 0)
      const scanned = (json.summary?.scanned_background ?? 0) + (json.summary?.scanned_live ?? 0)
      const errorDetails = (json.summary?.errors ?? []) as string[]
      const errors = Number(errorDetails.length)
      const nextLog: RecoverySweepLog = {
        ranAt: new Date().toISOString(),
        auto,
        thresholdMinutes: STALLED_THRESHOLD_MINUTES,
        recovered,
        scanned,
        errors,
        errorDetails: errorDetails.slice(0, 8),
      }
      setRecoveryLogs((current) => [nextLog, ...current].slice(0, 12))

      if (errors > 0) {
        setMessage(
          `${auto ? "Auto-recovery" : "Recovery sweep"} completed with ${errors} error${errors > 1 ? "s" : ""}.`
        )
      } else if (recovered > 0) {
        setMessage(`${auto ? "Auto-recovery" : "Recovery sweep"} requeued ${recovered} stalled jobs from ${scanned} scanned.`)
      } else {
        setMessage(`${auto ? "Auto-recovery" : "Recovery sweep"} found no stalled jobs.`)
      }
      await loadOverview()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to run stalled recovery")
    } finally {
      setIsRecoveringStalled(false)
    }
  }, [STALLED_THRESHOLD_MINUTES, loadOverview])

  useEffect(() => {
    if (!overview) return
    if (hasRunAutoRecovery.current) return
    if (stalledRunningCount <= 0) return
    hasRunAutoRecovery.current = true
    void runStalledRecoverySweep(true)
  }, [overview, runStalledRecoverySweep, stalledRunningCount])

  async function upsertHealthItemState(candidateId: string, payload: { reviewedAt?: string | null; snoozedUntil?: string | null }) {
    const response = await fetch("/api/admin/health-inbox", {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        candidate_id: candidateId,
        reviewed_at: payload.reviewedAt ?? null,
        snoozed_until: payload.snoozedUntil ?? null,
      }),
    })
    const json = await response.json()
    if (!response.ok) {
      throw new Error(json.error || "Failed to update health inbox state")
    }
    const row = json.state as HealthInboxState
    setHealthInboxState((current) => ({ ...current, [candidateId]: row }))
  }

  async function markHealthItemReviewed(candidateId: string) {
    try {
      await upsertHealthItemState(candidateId, { reviewedAt: new Date().toISOString() })
      setMessage("Marked as reviewed.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to mark reviewed")
    }
  }

  async function snoozeHealthItem(candidateId: string, days: number) {
    try {
      const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      await upsertHealthItemState(candidateId, { snoozedUntil: until })
      setMessage(`Snoozed for ${days} days.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to snooze")
    }
  }

  async function clearHealthItemState(candidateId: string) {
    try {
      const response = await fetch(`/api/admin/health-inbox?candidate_id=${encodeURIComponent(candidateId)}`, {
        method: "DELETE",
        headers: await getAuthHeaders(),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to reset state")
      }
      setHealthInboxState((current) => {
        const next = { ...current }
        delete next[candidateId]
        return next
      })
      setMessage("Health state reset.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to reset state")
    }
  }

  async function retryBackgroundJob(jobId: string) {
    setRetryingKey(`bg-${jobId}`)
    setMessage("")
    try {
      const response = await fetch(`/api/admin/jobs/background/${jobId}/retry`, {
        method: "POST",
        headers: await getAuthHeaders(),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to retry background job")
      }
      setMessage("Background job queued again.")
      await loadOverview()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to retry background job")
    } finally {
      setRetryingKey("")
    }
  }

  async function retryLiveRun(runId: string) {
    setRetryingKey(`live-${runId}`)
    setMessage("")
    try {
      const response = await fetch(`/api/admin/jobs/live/${runId}/retry`, {
        method: "POST",
        headers: await getAuthHeaders(),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to retry live job run")
      }
      setMessage("Live job run queued again.")
      await loadOverview()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to retry live job run")
    } finally {
      setRetryingKey("")
    }
  }

  function togglePanel(panel: keyof typeof collapsedPanels) {
    setCollapsedPanels((current) => ({ ...current, [panel]: !current[panel] }))
  }

  function focusPanel(panel: keyof typeof collapsedPanels) {
    setActivePanel(panel)
    setCollapsedPanels((current) =>
      Object.keys(current).reduce<typeof current>((next, key) => {
        next[key as keyof typeof current] = key !== panel
        return next
      }, { ...current })
    )
    if (typeof window !== "undefined") {
      const target = document.getElementById(`operations-${panel}`)
      if (target) {
        window.setTimeout(() => {
          target.scrollIntoView({ behavior: "smooth", block: "start" })
        }, 80)
      }
    }
  }

  function setAllPanelsCollapsed(nextValue: boolean) {
    setCollapsedPanels({
      digest: nextValue,
      recovery: nextValue,
      filters: nextValue,
      healthInbox: nextValue,
      background: nextValue,
      live: nextValue,
    })
  }
  const isPanelVisible = useCallback(
    (panel: keyof typeof collapsedPanels) => activePanel === panel,
    [activePanel]
  )

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-neutral-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <PlatformModuleNav />
        {!session?.user ? (
          <section className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            Please sign in with an admin account to access Operations.
          </section>
        ) : null}

        {message ? (
          <section className="mt-4 rounded-2xl border border-[#d8e4f2] bg-white px-4 py-3 text-sm text-neutral-700">
            {message}
          </section>
        ) : null}
        {healthInboxTableMissing ? (
          <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Health inbox persistence table is missing. Run <code>supabase/admin_candidate_health_inbox.sql</code> to enable shared reviewed/snoozed state across admins.
          </section>
        ) : null}

        {overview ? (
          <div className="mt-3 grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)]">
            <aside className="h-fit rounded-2xl border border-[#d8e4f2] bg-[linear-gradient(180deg,#fcfdff_0%,#f4f8fc_100%)] p-3 shadow-sm xl:sticky xl:top-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5b6b7c]">Operations menu</div>
              <details open className="mt-2 rounded-xl border border-neutral-200 bg-white">
                <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-600">
                  Workflow
                </summary>
                <div className="px-2 pb-2">
                  <button type="button" onClick={() => focusPanel("digest")} className={`mb-1 w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${activePanel === "digest" ? "border-sky-300 bg-sky-50 text-sky-800" : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"}`}>Daily digest</button>
                  <button type="button" onClick={() => focusPanel("recovery")} className={`mb-1 w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${activePanel === "recovery" ? "border-sky-300 bg-sky-50 text-sky-800" : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"}`}>Recovery activity</button>
                  <button type="button" onClick={() => focusPanel("filters")} className={`mb-1 w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${activePanel === "filters" ? "border-sky-300 bg-sky-50 text-sky-800" : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"}`}>Status filters</button>
                  <button type="button" onClick={() => focusPanel("healthInbox")} className={`mb-1 w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${activePanel === "healthInbox" ? "border-sky-300 bg-sky-50 text-sky-800" : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"}`}>Candidate health</button>
                  <button type="button" onClick={() => focusPanel("background")} className={`mb-1 w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${activePanel === "background" ? "border-sky-300 bg-sky-50 text-sky-800" : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"}`}>Background jobs</button>
                  <button type="button" onClick={() => focusPanel("live")} className={`w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${activePanel === "live" ? "border-sky-300 bg-sky-50 text-sky-800" : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"}`}>Live search runs</button>
                </div>
              </details>
              <details open className="mt-2 rounded-xl border border-neutral-200 bg-white">
                <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-600">
                  Actions
                </summary>
                <div className="px-2 pb-2 space-y-1.5">
                  <button type="button" onClick={() => {
                    void loadOverview()
                    void loadCandidateHealth()
                    void loadHealthInboxState()
                  }} className="w-full rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100">{isRefreshing ? "Refreshing..." : "Refresh data"}</button>
                  <button type="button" onClick={() => void runStalledRecoverySweep(false)} disabled={isRecoveringStalled} className="w-full rounded-full border border-[#0a66c2] bg-[#e8f3ff] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0a66c2] hover:bg-[#dcecff] disabled:cursor-not-allowed disabled:opacity-60">{isRecoveringStalled ? "Recovering..." : "Recover stalled"}</button>
                  <Link href="/admin" className="block w-full rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100">Back to control center</Link>
                </div>
              </details>
            </aside>

            <div>
            <section id="operations-digest" className={`mt-3 rounded-2xl border border-[#d8e4f2] bg-white p-3 shadow-sm ${isPanelVisible("digest") ? "" : "hidden"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Daily ops digest</div>
                  <h2 className="mt-1 text-sm font-semibold text-[#0f172a]">Operations health | {digest.dateLabel}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                      digest.overallTone === "critical"
                        ? "border-rose-300 bg-rose-50 text-rose-800"
                        : digest.overallTone === "attention"
                          ? "border-amber-300 bg-amber-50 text-amber-800"
                          : "border-emerald-300 bg-emerald-50 text-emerald-800"
                    }`}
                  >
                    {digest.overallTone === "critical" ? "Needs immediate attention" : digest.overallTone === "attention" ? "Watch closely" : "Operating smoothly"}
                  </span>
                  <button
                    type="button"
                    onClick={() => togglePanel("digest")}
                    className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                  >
                    {collapsedPanels.digest ? "Expand" : "Collapse"}
                  </button>
                </div>
              </div>
              {!collapsedPanels.digest ? (
                <>
              <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                <SnapshotStat label="Completion 24h" value={`${digest.completionRate}%`} />
                <SnapshotStat label="Runs today" value={`${digest.completedToday}/${digest.totalToday}`} />
                <SnapshotStat label="Failures 24h" value={String(overview.summary.failed_24h)} />
                <SnapshotStat label={`Stalled ${STALLED_THRESHOLD_MINUTES}m+`} value={String(stalledRunningCount)} />
              </div>
              <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
                {digest.failedToday > 0
                  ? `${digest.failedToday} failures in the last 24h. Start with recovery activity and failed retries.`
                  : "No failures in the last 24h. Keep monitoring recovery and candidate health."}
              </div>
                </>
              ) : null}
            </section>

            <section id="operations-recovery" className={`mt-3 rounded-2xl border border-[#d8e4f2] bg-white p-3 shadow-sm ${isPanelVisible("recovery") ? "" : "hidden"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-600">Recovery activity</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => togglePanel("recovery")}
                    className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                  >
                    {collapsedPanels.recovery ? "Expand" : "Collapse"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRecoveryHistory((current) => !current)}
                    className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                  >
                    {showRecoveryHistory ? "Hide history" : "Show history"}
                  </button>
                  {recoveryLogs.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setRecoveryLogs([])}
                      className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                    >
                      Clear log
                    </button>
                  ) : null}
                </div>
              </div>
              {!collapsedPanels.recovery ? recoveryLogs.length === 0 ? (
                <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
                  No recovery sweeps recorded yet.
                </div>
              ) : (
                <>
                  <div className="mt-2 text-xs text-neutral-500">
                    Last run: {new Date(recoveryLogs[0].ranAt).toLocaleString()}
                  </div>
                  <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                    <SnapshotStat label="Mode" value={recoveryLogs[0].auto ? "Auto" : "Manual"} />
                    <SnapshotStat label="Threshold" value={`${recoveryLogs[0].thresholdMinutes} min`} />
                    <SnapshotStat label="Scanned" value={String(recoveryLogs[0].scanned)} />
                    <SnapshotStat label="Recovered" value={String(recoveryLogs[0].recovered)} />
                    <SnapshotStat label="Errors" value={String(recoveryLogs[0].errors)} />
                  </div>
                  {showRecoveryHistory ? (
                    <div className="mt-3 space-y-2">
                      {recoveryLogs.slice(0, 8).map((log, index) => (
                        <div key={`${log.ranAt}-${index}`} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs font-semibold text-neutral-900">
                              {new Date(log.ranAt).toLocaleString()} | {log.auto ? "Auto" : "Manual"} | {log.recovered} recovered / {log.scanned} scanned
                            </div>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                                log.errors > 0 ? "border-rose-300 bg-rose-50 text-rose-700" : "border-emerald-300 bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {log.errors > 0 ? `${log.errors} errors` : "No errors"}
                            </span>
                          </div>
                          {log.errorDetails && log.errorDetails.length > 0 ? (
                            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-rose-700">
                              {log.errorDetails.slice(0, 3).map((detail) => (
                                <li key={`${log.ranAt}-${detail}`}>{detail}</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}
            </section>

            <section id="operations-filters" className={`mt-3 rounded-2xl border border-[#d8e4f2] bg-white p-3 shadow-sm ${isPanelVisible("filters") ? "" : "hidden"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Filter by status</div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => togglePanel("filters")}
                    className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                  >
                    {collapsedPanels.filters ? "Expand" : "Collapse"}
                  </button>
                  {!collapsedPanels.filters ? (
                    <>
                  {(["all", "failed", "running", "queued", "completed"] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setStatusFilter(status)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${
                        statusFilter === status ? "border-sky-300 bg-sky-50 text-sky-800" : "border-neutral-300 bg-white text-neutral-700"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                    </>
                  ) : null}
                </div>
              </div>
            </section>

            <section id="operations-healthInbox" className={`mt-3 rounded-2xl border border-[#d8e4f2] bg-white p-3 shadow-sm ${isPanelVisible("healthInbox") ? "" : "hidden"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-[#0f172a]">Candidate health inbox</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => togglePanel("healthInbox")}
                    className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                  >
                    {collapsedPanels.healthInbox ? "Expand" : "Collapse"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDismissedHealthItems((current) => !current)}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                      showDismissedHealthItems ? "border-sky-300 bg-sky-50 text-sky-800" : "border-neutral-300 bg-white text-neutral-700"
                    }`}
                  >
                    {showDismissedHealthItems ? "Hide dismissed" : "Show dismissed"}
                  </button>
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
                    Top {candidateHealthInbox.length} attention items
                  </div>
                </div>
              </div>
              {!collapsedPanels.healthInbox ? (
                <div className="mt-3 space-y-2">
                {candidateHealthInbox.length === 0 ? (
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">No candidate health alerts yet.</div>
                ) : null}
                {candidateHealthInbox.map((item) => (
                  <div
                    key={`health-${item.candidate.id}`}
                    className={`rounded-xl border px-3 py-2.5 ${
                      item.tone === "danger"
                        ? "border-rose-200 bg-rose-50"
                        : item.tone === "warning"
                          ? "border-amber-200 bg-amber-50"
                          : "border-neutral-200 bg-neutral-50"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <div className="text-sm font-semibold text-neutral-900">{item.candidate.full_name || "Untitled candidate"}</div>
                          <span className="rounded-full border border-white/80 bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                            Risk {item.riskScore}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-neutral-600">
                          {item.candidate.city || "No city"} | {item.candidate.primary_goal || "No goal"} | Readiness {item.candidate.readiness_score}%
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {item.reasons.slice(0, 3).map((reason) => (
                            <span key={`${item.candidate.id}-${reason}`} className="rounded-full border border-white/80 bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-neutral-700">
                              {reason}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Link href={`/career/${item.candidate.id}`} className="rounded-full border border-[#0a66c2] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0a66c2] hover:bg-[#eef5fe]">
                          Open workspace
                        </Link>
                        <button
                          type="button"
                          onClick={() => void markHealthItemReviewed(item.candidate.id)}
                          className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-100"
                        >
                          Mark reviewed
                        </button>
                        <button
                          type="button"
                          onClick={() => void snoozeHealthItem(item.candidate.id, 7)}
                          className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-100"
                        >
                          Snooze 7d
                        </button>
                        <button
                          type="button"
                          onClick={() => void clearHealthItemState(item.candidate.id)}
                          className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-100"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              ) : null}
            </section>

            <section id="operations-background" className={`mt-3 rounded-2xl border border-[#d8e4f2] bg-white p-3 shadow-sm ${isPanelVisible("background") ? "" : "hidden"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-[#0f172a]">Background jobs</h2>
                <button
                  type="button"
                  onClick={() => togglePanel("background")}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  {collapsedPanels.background ? "Expand" : "Collapse"}
                </button>
              </div>
              {!collapsedPanels.background ? (
                <div className="mt-3 space-y-2">
                {filteredBackground.length === 0 ? (
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">No jobs in this filter.</div>
                ) : null}
                {filteredBackground.map((job) => (
                  <div key={job.id} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold text-neutral-900">{job.job_type.replaceAll("_", " ")}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${toneForStatus(job.status)}`}>{job.status}</span>
                        </div>
                        <div className="mt-1 text-xs text-neutral-600">
                          Candidate: {job.candidate_name || "Unknown"} {job.candidate_city ? `| ${job.candidate_city}` : ""} | Created: {formatDate(job.created_at)}
                        </div>
                        {job.error_message ? <div className="mt-1 text-xs text-rose-700">Error: {job.error_message}</div> : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link href={`/career/${job.candidate_id}`} className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-100">
                          Open candidate
                        </Link>
                        {job.status === "failed" ? (
                          <button
                            type="button"
                            onClick={() => void retryBackgroundJob(job.id)}
                            disabled={retryingKey === `bg-${job.id}`}
                            className="rounded-full border border-[#0a66c2] bg-[#e8f3ff] px-2.5 py-1 text-[11px] font-semibold text-[#0a66c2] hover:bg-[#dcecff] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {retryingKey === `bg-${job.id}` ? "Retrying..." : "Retry"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              ) : null}
            </section>

            <section id="operations-live" className={`mt-3 rounded-2xl border border-[#d8e4f2] bg-white p-3 shadow-sm ${isPanelVisible("live") ? "" : "hidden"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-[#0f172a]">Live search runs</h2>
                <button
                  type="button"
                  onClick={() => togglePanel("live")}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  {collapsedPanels.live ? "Expand" : "Collapse"}
                </button>
              </div>
              {!collapsedPanels.live ? (
                <div className="mt-3 space-y-2">
                {filteredLiveRuns.length === 0 ? (
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">No live runs in this filter.</div>
                ) : null}
                {filteredLiveRuns.map((run) => (
                  <div key={run.id} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold text-neutral-900">{run.target_role || "Untitled role search"}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${toneForStatus(run.status)}`}>{run.status}</span>
                        </div>
                        <div className="mt-1 text-xs text-neutral-600">
                          Candidate: {run.candidate_name || "Unknown"} {run.candidate_city ? `| ${run.candidate_city}` : ""} | Location: {run.location || "Not set"}
                        </div>
                        <div className="mt-1 text-xs text-neutral-500">
                          Started: {formatDate(run.started_at)} | Completed: {formatDate(run.completed_at)}
                        </div>
                        {run.error_message ? <div className="mt-1 text-xs text-rose-700">Error: {run.error_message}</div> : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link href={`/career/${run.candidate_id}`} className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-100">
                          Open candidate
                        </Link>
                        {run.status === "failed" ? (
                          <button
                            type="button"
                            onClick={() => void retryLiveRun(run.id)}
                            disabled={retryingKey === `live-${run.id}`}
                            className="rounded-full border border-[#0a66c2] bg-[#e8f3ff] px-2.5 py-1 text-[11px] font-semibold text-[#0a66c2] hover:bg-[#dcecff] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {retryingKey === `live-${run.id}` ? "Retrying..." : "Retry"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              ) : null}
            </section>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  )
}

function MetricCard({ label, value, tone = "normal" }: { label: string; value: string; tone?: "normal" | "danger" }) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 shadow-sm ${
        tone === "danger"
          ? "border-rose-200 bg-[linear-gradient(180deg,#fff1f2_0%,#ffe4e6_100%)]"
          : "border-[#d8e4f2] bg-[linear-gradient(180deg,#ffffff_0%,#eff6ff_100%)]"
      }`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone === "danger" ? "text-rose-700" : "text-[#0f172a]"}`}>{value}</div>
    </div>
  )
}

function SnapshotStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-neutral-900">{value}</div>
    </div>
  )
}
