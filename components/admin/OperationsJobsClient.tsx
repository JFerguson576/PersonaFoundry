"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { AdminTourCompletionPanel } from "@/components/admin/AdminTourCompletionPanel"
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

type TeamSyncOutreachQueueRow = {
  id: string
  user_id: string | null
  user_email: string
  user_name: string | null
  segment: string
  source: string
  status: string
  last_teamsync_event_at: string | null
  last_contacted_at: string | null
  next_action_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

type TeamSyncOutreachCampaignRow = {
  id: string
  created_by_email: string | null
  audience_status: string
  audience_segment: string
  support_name: string | null
  calendly_url: string | null
  subject: string
  message: string
  recipient_count: number
  sent_count: number
  status: string
  created_at: string
}

type TesterFeedbackOutreachCampaignRow = {
  id: string
  sent_by_email: string | null
  audience_status: string
  audience_module: string | null
  recipient_count: number
  subject: string
  message: string
  created_at: string
}

type TesterFeedbackNoteRow = {
  id: string
  status: "open" | "in_review" | "resolved"
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
  const [activePanel, setActivePanel] = useState<keyof typeof collapsedPanels>("controlCenter")
  const [runHealthMenuOpen, setRunHealthMenuOpen] = useState(true)
  const [marketingToolsMenuOpen, setMarketingToolsMenuOpen] = useState(false)
  const [navigationMenuOpen, setNavigationMenuOpen] = useState(true)
  const [candidateMenuOpen, setCandidateMenuOpen] = useState(true)
  const [quickActionsMenuOpen, setQuickActionsMenuOpen] = useState(true)
  const [candidateSearch, setCandidateSearch] = useState("")
  const [collapsedPanels, setCollapsedPanels] = useState({
    controlCenter: false,
    marketing: false,
    testerFeedback: false,
    digest: false,
    recovery: false,
    teamsyncOutreach: false,
    healthInbox: false,
    background: false,
    live: false,
  })
  const [teamsyncOutreachQueue, setTeamsyncOutreachQueue] = useState<TeamSyncOutreachQueueRow[]>([])
  const [teamsyncOutreachCampaigns, setTeamsyncOutreachCampaigns] = useState<TeamSyncOutreachCampaignRow[]>([])
  const [loadingTeamSyncOutreach, setLoadingTeamSyncOutreach] = useState(false)
  const [queueingTeamSyncOutreach, setQueueingTeamSyncOutreach] = useState(false)
  const [sendingTeamSyncOutreach, setSendingTeamSyncOutreach] = useState(false)
  const [teamsyncAudienceStatus, setTeamsyncAudienceStatus] = useState<"queued" | "contacted" | "responded">("queued")
  const [teamsyncAudienceSegment, setTeamsyncAudienceSegment] = useState("all")
  const [teamsyncOutreachSubject, setTeamsyncOutreachSubject] = useState("Personara TeamSync quick check-in")
  const [teamsyncOutreachMessage, setTeamsyncOutreachMessage] = useState(
    "I noticed that you logged into the Personara.ai TeamSync workspace.\n\nTypically we schedule a 15 minute call to better understand your needs. Do you have availability in the coming days?\n\nI have opened my calendar below. Please choose any time that works for you and I will work with your schedule."
  )
  const [teamsyncSupportName, setTeamsyncSupportName] = useState("Personara Support")
  const [teamsyncCalendlyUrl, setTeamsyncCalendlyUrl] = useState("")
  const [testerFeedbackNotes, setTesterFeedbackNotes] = useState<TesterFeedbackNoteRow[]>([])
  const [testerFeedbackCampaigns, setTesterFeedbackCampaigns] = useState<TesterFeedbackOutreachCampaignRow[]>([])
  const [loadingTesterFeedback, setLoadingTesterFeedback] = useState(false)
  const [sendingTesterFeedbackOutreach, setSendingTesterFeedbackOutreach] = useState(false)
  const [testerAudienceStatus, setTesterAudienceStatus] = useState<"all" | "open" | "in_review" | "resolved">("open")
  const [testerAudienceModule, setTesterAudienceModule] = useState("all")
  const [testerOutreachSubject, setTesterOutreachSubject] = useState("Personara tester follow-up")
  const [testerOutreachMessage, setTesterOutreachMessage] = useState(
    "I noticed you have been testing Personara.ai. Thank you.\n\nIf you have 15 minutes this week, I would love to learn what worked well and what should improve.\n\nPlease reply with a suitable time and we will align to your schedule."
  )
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
            controlCenter: false,
            marketing: true,
            testerFeedback: true,
            digest: false,
            recovery: true,
            teamsyncOutreach: true,
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

  const loadTeamSyncOutreach = useCallback(async () => {
    setLoadingTeamSyncOutreach(true)
    try {
      const response = await fetch("/api/admin/teamsync-outreach", {
        cache: "no-store",
        headers: await getAuthHeaders(),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to load TeamSync outreach")
      }
      setTeamsyncOutreachQueue((json.queue ?? []) as TeamSyncOutreachQueueRow[])
      setTeamsyncOutreachCampaigns((json.campaigns ?? []) as TeamSyncOutreachCampaignRow[])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load TeamSync outreach")
    } finally {
      setLoadingTeamSyncOutreach(false)
    }
  }, [])

  const loadTesterFeedback = useCallback(async () => {
    setLoadingTesterFeedback(true)
    try {
      const [notesResponse, campaignsResponse] = await Promise.all([
        fetch("/api/admin/tester-notes", {
          cache: "no-store",
          headers: await getAuthHeaders(),
        }),
        fetch("/api/admin/tester-notes/outreach", {
          cache: "no-store",
          headers: await getAuthHeaders(),
        }),
      ])

      const notesJson = await notesResponse.json()
      const campaignsJson = await campaignsResponse.json()

      if (!notesResponse.ok) {
        throw new Error(notesJson.error || "Failed to load tester notes")
      }
      if (!campaignsResponse.ok) {
        throw new Error(campaignsJson.error || "Failed to load tester outreach campaigns")
      }

      setTesterFeedbackNotes((notesJson.notes ?? []) as TesterFeedbackNoteRow[])
      setTesterFeedbackCampaigns((campaignsJson.campaigns ?? []) as TesterFeedbackOutreachCampaignRow[])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load tester feedback")
    } finally {
      setLoadingTesterFeedback(false)
    }
  }, [])

  const sendTesterFeedbackOutreach = useCallback(async () => {
    setSendingTesterFeedbackOutreach(true)
    setMessage("")
    try {
      const response = await fetch("/api/admin/tester-notes/outreach", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audience_status: testerAudienceStatus,
          audience_module: testerAudienceModule === "all" ? "" : testerAudienceModule,
          subject: testerOutreachSubject,
          message: testerOutreachMessage,
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Could not send tester outreach")
      }
      setMessage(`Tester outreach sent to ${json.recipients_sent ?? 0} users.`)
      await loadTesterFeedback()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send tester outreach")
    } finally {
      setSendingTesterFeedbackOutreach(false)
    }
  }, [loadTesterFeedback, testerAudienceModule, testerAudienceStatus, testerOutreachMessage, testerOutreachSubject])

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

  useEffect(() => {
    if (!overview?.permissions.is_superuser) return
    void loadTeamSyncOutreach()
    void loadTesterFeedback()
  }, [overview?.permissions.is_superuser, loadTeamSyncOutreach, loadTesterFeedback])

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

  const marketingSignals = useMemo(() => {
    const queued = teamsyncOutreachQueue.filter((row) => row.status === "queued").length
    const contacted = teamsyncOutreachQueue.filter((row) => row.status === "contacted").length
    const responded = teamsyncOutreachQueue.filter((row) => row.status === "responded").length
    const campaigns = teamsyncOutreachCampaigns.length
    return { queued, contacted, responded, campaigns }
  }, [teamsyncOutreachCampaigns, teamsyncOutreachQueue])

  const testerSignals = useMemo(() => {
    const open = testerFeedbackNotes.filter((row) => row.status === "open").length
    const inReview = testerFeedbackNotes.filter((row) => row.status === "in_review").length
    const resolved = testerFeedbackNotes.filter((row) => row.status === "resolved").length
    return {
      open,
      inReview,
      resolved,
      campaigns: testerFeedbackCampaigns.length,
    }
  }, [testerFeedbackCampaigns.length, testerFeedbackNotes])

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

  async function handleQueueTeamSyncOutreach() {
    setQueueingTeamSyncOutreach(true)
    setMessage("")
    try {
      const response = await fetch("/api/admin/teamsync-outreach", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          action: "queue_from_teamsync",
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to build TeamSync outreach queue")
      }
      const queued = Number(json.queued ?? 0)
      const skipped = Number(json.skipped ?? 0)
      setMessage(`TeamSync queue refreshed. ${queued} queued${skipped > 0 ? `, ${skipped} skipped` : ""}.`)
      await loadTeamSyncOutreach()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to build TeamSync outreach queue")
    } finally {
      setQueueingTeamSyncOutreach(false)
    }
  }

  async function handleSendTeamSyncOutreach() {
    setSendingTeamSyncOutreach(true)
    setMessage("")
    try {
      const response = await fetch("/api/admin/teamsync-outreach", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          action: "send_campaign",
          audience_status: teamsyncAudienceStatus,
          audience_segment: teamsyncAudienceSegment,
          subject: teamsyncOutreachSubject,
          message: teamsyncOutreachMessage,
          support_name: teamsyncSupportName,
          calendly_url: teamsyncCalendlyUrl,
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to send TeamSync outreach campaign")
      }
      const attempted = Number(json.recipients_attempted ?? 0)
      const sent = Number(json.recipients_sent ?? 0)
      const mode = json.delivery_mode === "draft_only" ? "draft mode (no email sent)" : "email mode"
      setMessage(`TeamSync campaign complete. ${sent}/${attempted} sent (${mode}).`)
      await loadTeamSyncOutreach()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to send TeamSync outreach campaign")
    } finally {
      setSendingTeamSyncOutreach(false)
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

  const isPanelVisible = useCallback(
    (panel: keyof typeof collapsedPanels) => activePanel === panel,
    [activePanel]
  )

  const quickCandidateShortcuts = useMemo(
    () =>
      candidateHealth
        .filter((row) => row?.id)
        .filter((row) => {
          const term = candidateSearch.trim().toLowerCase()
          if (!term) return true
          return `${row.full_name || ""} ${row.city || ""} ${row.primary_goal || ""}`.toLowerCase().includes(term)
        })
        .slice(0, 50)
        .map((row) => ({
          id: row.id,
          label: row.full_name?.trim() || "Untitled candidate",
          detail: row.city || row.primary_goal || "No city",
        })),
    [candidateHealth, candidateSearch]
  )

  return (
    <main className="min-h-screen bg-[#eef3fb] text-[#152238]">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        <PlatformModuleNav />
        {!session?.user ? (
          <section className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            Please sign in with an admin account to access Operations.
          </section>
        ) : null}

        {message ? (
          <section className="mt-4 rounded-2xl border border-[#c9d8ef] bg-[#f7fbff] px-4 py-3 text-sm text-[#1e365f]">
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
            <aside className="h-fit rounded-2xl border border-[#bfd2ed] bg-[linear-gradient(180deg,#f6faff_0%,#eaf2ff_100%)] p-3 shadow-[0_18px_36px_-28px_rgba(26,54,93,0.45)] xl:sticky xl:top-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2f4a73]">Operations menu</div>
              <Link
                href="/platform#modules"
                className="mt-2 inline-flex rounded-full border border-[#cbd8eb] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#36537d] hover:bg-[#f4f8ff]"
              >
                Back to platform
              </Link>
              <section className="mt-2 rounded-xl border border-[#c7d8ee] bg-white">
                <button
                  type="button"
                  onClick={() =>
                    setRunHealthMenuOpen((current) => !current)
                  }
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#3d567d]"
                  aria-expanded={runHealthMenuOpen}
                >
                  Run health
                    <span>{runHealthMenuOpen ? "-" : "+"}</span>
                </button>
                {runHealthMenuOpen ? <div className="px-2 pb-2">
                  <button type="button" onClick={() => focusPanel("controlCenter")} className={`mb-1 w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${activePanel === "controlCenter" ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]" : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"}`}>Control modules</button>
                  <button type="button" onClick={() => focusPanel("digest")} className={`mb-1 w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${activePanel === "digest" ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]" : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"}`}>Ops summary</button>
                  <button type="button" onClick={() => focusPanel("recovery")} className={`mb-1 w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${activePanel === "recovery" ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]" : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"}`}>Recovery queue</button>
                  <button type="button" onClick={() => focusPanel("healthInbox")} className={`mb-1 w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${activePanel === "healthInbox" ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]" : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"}`}>Candidate risk inbox</button>
                  <button type="button" onClick={() => focusPanel("background")} className={`mb-1 w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${activePanel === "background" ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]" : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"}`}>Background jobs</button>
                  <button type="button" onClick={() => focusPanel("live")} className={`w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${activePanel === "live" ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]" : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"}`}>Live job runs</button>
                </div> : null}
              </section>
              {overview.permissions.is_superuser ? (
                <section className="mt-2 rounded-xl border border-[#c7d8ee] bg-white">
                  <button
                    type="button"
                    onClick={() =>
                      setMarketingToolsMenuOpen((current) => !current)
                    }
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#3d567d]"
                    aria-expanded={marketingToolsMenuOpen}
                  >
                    Marketing tools
                      <span>{marketingToolsMenuOpen ? "-" : "+"}</span>
                  </button>
                  {marketingToolsMenuOpen ? <div className="px-2 pb-2">
                    <button
                      type="button"
                      onClick={() => focusPanel("marketing")}
                      className={`mb-1 w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${
                        activePanel === "marketing"
                          ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]"
                          : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"
                      }`}
                    >
                      Marketing overview
                    </button>
                    <button
                      type="button"
                      onClick={() => focusPanel("teamsyncOutreach")}
                      className={`w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${
                        activePanel === "teamsyncOutreach"
                          ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]"
                          : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"
                      }`}
                    >
                      TeamSync outreach
                    </button>
                    <button
                      type="button"
                      onClick={() => focusPanel("testerFeedback")}
                      className={`mb-1 w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${
                        activePanel === "testerFeedback"
                          ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]"
                          : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"
                      }`}
                    >
                      Tester outreach
                    </button>
                  </div> : null}
                </section>
              ) : null}
              <section className="mt-2 rounded-xl border border-[#c7d8ee] bg-white">
                <button
                  type="button"
                  onClick={() =>
                    setNavigationMenuOpen((current) => !current)
                  }
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#3d567d]"
                  aria-expanded={navigationMenuOpen}
                >
                  Navigation
                  <span>{navigationMenuOpen ? "-" : "+"}</span>
                </button>
                {navigationMenuOpen ? (
                  <div className="space-y-1.5 px-2 pb-2">
                    <Link href="/control-center" className="block w-full rounded-full border border-[#cbd8eb] bg-white px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[#36537d] hover:bg-[#f4f8ff]">Control center</Link>
                    <Link href="/admin" className="block w-full rounded-full border border-[#cbd8eb] bg-white px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[#36537d] hover:bg-[#f4f8ff]">Admin dashboard</Link>
                    <Link href="/career?view=control" className="block w-full rounded-full border border-[#cbd8eb] bg-white px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[#36537d] hover:bg-[#f4f8ff]">Candidate control</Link>
                    <Link href="/career?view=preview" className="block w-full rounded-full border border-[#cbd8eb] bg-white px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[#36537d] hover:bg-[#f4f8ff]">Candidate preview</Link>
                    <Link href="/persona-foundry" className="block w-full rounded-full border border-[#cbd8eb] bg-white px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[#36537d] hover:bg-[#f4f8ff]">Persona Foundry</Link>
                    <Link href="/teamsync" className="block w-full rounded-full border border-[#cbd8eb] bg-white px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[#36537d] hover:bg-[#f4f8ff]">TeamSync</Link>
                    <Link href="/control-center/marketing-engine" className="block w-full rounded-full border border-[#cbd8eb] bg-white px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[#36537d] hover:bg-[#f4f8ff]">Marketing engine</Link>
                    <Link href="/platform" className="block w-full rounded-full border border-[#cbd8eb] bg-white px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[#36537d] hover:bg-[#f4f8ff]">Open platform</Link>
                  </div>
                ) : null}
              </section>
              <section className="mt-2 rounded-xl border border-[#c7d8ee] bg-white">
                <button
                  type="button"
                  onClick={() =>
                    setCandidateMenuOpen((current) => !current)
                  }
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#3d567d]"
                  aria-expanded={candidateMenuOpen}
                >
                  Candidates
                  <span>{candidateMenuOpen ? "-" : "+"}</span>
                </button>
                {candidateMenuOpen ? (
                  <div className="px-2 pb-2">
                    <input
                      value={candidateSearch}
                      onChange={(event) => setCandidateSearch(event.target.value)}
                      className="mb-2 w-full rounded-lg border border-[#cbd8eb] bg-white px-2.5 py-1.5 text-xs text-[#163159]"
                      placeholder="Search candidates..."
                    />
                    <div className="max-h-56 space-y-1.5 overflow-y-auto pr-0.5">
                      {quickCandidateShortcuts.length > 0 ? quickCandidateShortcuts.map((candidate) => (
                        <Link
                          key={`quick-candidate-${candidate.id}`}
                          href={`/career/${candidate.id}`}
                          className="block w-full rounded-lg border border-[#cbd8eb] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#36537d] hover:bg-[#f4f8ff]"
                        >
                          <div className="truncate">{candidate.label}</div>
                          <div className="truncate text-[10px] font-medium uppercase tracking-[0.08em] text-[#5f769a]">{candidate.detail}</div>
                        </Link>
                      )) : (
                        <div className="rounded-lg border border-[#d8e4f2] bg-[#f7fbff] px-2.5 py-1.5 text-xs text-[#5f769a]">No candidates match this search.</div>
                      )}
                    </div>
                  </div>
                ) : null}
              </section>
              <section className="mt-2 rounded-xl border border-[#c7d8ee] bg-white">
                <button
                  type="button"
                  onClick={() =>
                    setQuickActionsMenuOpen((current) => !current)
                  }
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#3d567d]"
                  aria-expanded={quickActionsMenuOpen}
                >
                  Quick actions
                    <span>{quickActionsMenuOpen ? "-" : "+"}</span>
                </button>
                {quickActionsMenuOpen ? <div className="px-2 pb-2 space-y-1.5">
                  <button type="button" onClick={() => {
                    void loadOverview()
                    void loadCandidateHealth()
                    void loadHealthInboxState()
                    if (overview.permissions.is_superuser) {
                      void loadTeamSyncOutreach()
                      void loadTesterFeedback()
                    }
                  }} className="w-full rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100">{isRefreshing ? "Refreshing..." : "Refresh data"}</button>
                  <button type="button" onClick={() => void runStalledRecoverySweep(false)} disabled={isRecoveringStalled} className="w-full rounded-full border border-[#0a66c2] bg-[#e8f3ff] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0a66c2] hover:bg-[#dcecff] disabled:cursor-not-allowed disabled:opacity-60">{isRecoveringStalled ? "Recovering..." : "Recover stalled"}</button>
                </div> : null}
              </section>
            </aside>

            <div>
            <section id="operations-controlCenter" className={`mt-2 rounded-2xl border border-[#bfd2ed] bg-[linear-gradient(180deg,#ffffff_0%,#f6faff_100%)] p-2.5 shadow-[0_14px_30px_-26px_rgba(26,54,93,0.5)] ${isPanelVisible("controlCenter") ? "" : "hidden"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#3d567d]">Operations control</div>
                  <h2 className="mt-1 text-sm font-semibold text-[#142c4f]">Unified module controls in one workspace</h2>
                </div>
                <button
                  type="button"
                  onClick={() => togglePanel("controlCenter")}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  {collapsedPanels.controlCenter ? "Expand" : "Collapse"}
                </button>
              </div>
              {!collapsedPanels.controlCenter ? (
                <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  <button type="button" onClick={() => focusPanel("digest")} className="rounded-xl border border-[#cbd8eb] bg-white px-3 py-2 text-left hover:bg-[#f4f8ff]">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#3d567d]">Operations</div>
                    <div className="mt-0.5 text-sm font-semibold text-[#142c4f]">Ops summary</div>
                    <div className="mt-1 text-xs text-[#3d567d]">Health snapshot and run quality.</div>
                  </button>
                  <button type="button" onClick={() => focusPanel("healthInbox")} className="rounded-xl border border-[#cbd8eb] bg-white px-3 py-2 text-left hover:bg-[#f4f8ff]">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#3d567d]">Candidate management</div>
                    <div className="mt-0.5 text-sm font-semibold text-[#142c4f]">Risk inbox</div>
                    <div className="mt-1 text-xs text-[#3d567d]">Candidates needing intervention first.</div>
                  </button>
                  <button type="button" onClick={() => focusPanel("recovery")} className="rounded-xl border border-[#cbd8eb] bg-white px-3 py-2 text-left hover:bg-[#f4f8ff]">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#3d567d]">Recovery</div>
                    <div className="mt-0.5 text-sm font-semibold text-[#142c4f]">Stalled run recovery</div>
                    <div className="mt-1 text-xs text-[#3d567d]">Retry failed and stalled workloads.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => focusPanel(overview.permissions.is_superuser ? "marketing" : "live")}
                    className="rounded-xl border border-[#cbd8eb] bg-white px-3 py-2 text-left hover:bg-[#f4f8ff]"
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#3d567d]">
                      {overview.permissions.is_superuser ? "Marketing + outreach" : "Live search"}
                    </div>
                    <div className="mt-0.5 text-sm font-semibold text-[#142c4f]">
                      {overview.permissions.is_superuser ? "Marketing workspace" : "Live job runs"}
                    </div>
                    <div className="mt-1 text-xs text-[#3d567d]">
                      {overview.permissions.is_superuser ? "Campaign queue, analytics, and follow-up actions." : "Monitor live search activity."}
                    </div>
                  </button>
                </div>
              ) : null}
            </section>
            <section id="operations-marketing" className={`mt-2 rounded-2xl border border-[#bfd2ed] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-2.5 shadow-[0_14px_30px_-26px_rgba(26,54,93,0.5)] ${isPanelVisible("marketing") ? "" : "hidden"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#3d567d]">Marketing workspace</div>
                  <h2 className="mt-1 text-sm font-semibold text-[#142c4f]">Campaign and outreach controls in Operations</h2>
                </div>
                <button
                  type="button"
                  onClick={() => togglePanel("marketing")}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  {collapsedPanels.marketing ? "Expand" : "Collapse"}
                </button>
              </div>
              {!collapsedPanels.marketing ? (
                <>
                  <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                    <SnapshotStat label="Queued outreach" value={String(marketingSignals.queued)} />
                    <SnapshotStat label="Contacted" value={String(marketingSignals.contacted)} />
                    <SnapshotStat label="Responded" value={String(marketingSignals.responded)} />
                    <SnapshotStat label="Campaign logs" value={String(marketingSignals.campaigns)} />
                  </div>
                  <div className="mt-2 grid gap-2 md:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => focusPanel("teamsyncOutreach")}
                      className="rounded-xl border border-[#cbd8eb] bg-white px-3 py-2 text-left hover:bg-[#f4f8ff]"
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#3d567d]">Outreach queue</div>
                      <div className="mt-0.5 text-sm font-semibold text-[#142c4f]">TeamSync outreach</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => focusPanel("digest")}
                      className="rounded-xl border border-[#cbd8eb] bg-white px-3 py-2 text-left hover:bg-[#f4f8ff]"
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#3d567d]">Analytics</div>
                      <div className="mt-0.5 text-sm font-semibold text-[#142c4f]">Ops + marketing snapshot</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => focusPanel("teamsyncOutreach")}
                      className="rounded-xl border border-[#cbd8eb] bg-white px-3 py-2 text-left hover:bg-[#f4f8ff]"
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#3d567d]">Marketing console</div>
                      <div className="mt-0.5 text-sm font-semibold text-[#142c4f]">Coach outreach controls</div>
                    </button>
                  </div>
                </>
              ) : null}
            </section>
            <section id="operations-digest" className={`mt-3 rounded-2xl border border-[#bfd2ed] bg-[linear-gradient(180deg,#ffffff_0%,#f6faff_100%)] p-3 shadow-[0_14px_30px_-26px_rgba(26,54,93,0.5)] ${isPanelVisible("digest") ? "" : "hidden"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#3d567d]">Daily ops digest</div>
                  <h2 className="mt-1 text-sm font-semibold text-[#142c4f]">Operations health | {digest.dateLabel}</h2>
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
              <div className="mt-2 rounded-xl border border-[#d3dfee] bg-[#f6faff] px-3 py-2 text-xs text-[#2e4b74]">
                {digest.failedToday > 0
                  ? `${digest.failedToday} failures in the last 24h. Start with recovery activity and failed retries.`
                  : "No failures in the last 24h. Keep monitoring recovery and candidate health."}
              </div>
                </>
              ) : null}
            </section>
            <AdminTourCompletionPanel />

            <section id="operations-recovery" className={`mt-3 rounded-2xl border border-[#bfd2ed] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-3 shadow-[0_14px_30px_-26px_rgba(26,54,93,0.5)] ${isPanelVisible("recovery") ? "" : "hidden"}`}>
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

            {overview.permissions.is_superuser ? (
              <section id="operations-teamsyncOutreach" className={`mt-3 rounded-2xl border border-[#bfd2ed] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-3 shadow-[0_14px_30px_-26px_rgba(26,54,93,0.5)] ${isPanelVisible("teamsyncOutreach") ? "" : "hidden"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-[#142c4f]">TeamSync outreach</h2>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => togglePanel("teamsyncOutreach")}
                      className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                    >
                      {collapsedPanels.teamsyncOutreach ? "Expand" : "Collapse"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void loadTeamSyncOutreach()}
                      className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                    >
                      {loadingTeamSyncOutreach ? "Refreshing..." : "Refresh"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleQueueTeamSyncOutreach()}
                      disabled={queueingTeamSyncOutreach}
                      className="rounded-full border border-[#0a66c2] bg-[#e8f3ff] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0a66c2] hover:bg-[#dcecff] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {queueingTeamSyncOutreach ? "Building queue..." : "Build queue"}
                    </button>
                  </div>
                </div>
                {!collapsedPanels.teamsyncOutreach ? (
                  <>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <SnapshotStat label="Queue size" value={String(teamsyncOutreachQueue.length)} />
                      <SnapshotStat label="Queued" value={String(teamsyncOutreachQueue.filter((row) => row.status === "queued").length)} />
                      <SnapshotStat label="Contacted" value={String(teamsyncOutreachQueue.filter((row) => row.status === "contacted").length)} />
                      <SnapshotStat label="Responded" value={String(teamsyncOutreachQueue.filter((row) => row.status === "responded").length)} />
                    </div>
                    <div className="mt-3 rounded-xl border border-[#d0dff2] bg-[#f7fbff] p-3">
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#3d567d]">
                          Audience status
                          <select
                            value={teamsyncAudienceStatus}
                            onChange={(event) => setTeamsyncAudienceStatus(event.target.value as "queued" | "contacted" | "responded")}
                            className="mt-1 w-full rounded-lg border border-[#c2d3ea] bg-white px-2.5 py-1.5 text-sm font-medium text-[#163159]"
                          >
                            <option value="queued">Queued</option>
                            <option value="contacted">Contacted</option>
                            <option value="responded">Responded</option>
                          </select>
                        </label>
                        <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#3d567d]">
                          Segment
                          <select
                            value={teamsyncAudienceSegment}
                            onChange={(event) => setTeamsyncAudienceSegment(event.target.value)}
                            className="mt-1 w-full rounded-lg border border-[#c2d3ea] bg-white px-2.5 py-1.5 text-sm font-medium text-[#163159]"
                          >
                            <option value="all">All segments</option>
                            <option value="gallup_coach_or_exec">Gallup coaches / exec</option>
                            <option value="teamsync_user">TeamSync user</option>
                          </select>
                        </label>
                        <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#3d567d]">
                          Support name
                          <input
                            value={teamsyncSupportName}
                            onChange={(event) => setTeamsyncSupportName(event.target.value)}
                            className="mt-1 w-full rounded-lg border border-[#c2d3ea] bg-white px-2.5 py-1.5 text-sm font-medium text-[#163159]"
                            placeholder="Personara Support"
                          />
                        </label>
                      </div>
                      <label className="mt-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#3d567d]">
                        Calendly link
                        <input
                          value={teamsyncCalendlyUrl}
                          onChange={(event) => setTeamsyncCalendlyUrl(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-[#c2d3ea] bg-white px-2.5 py-1.5 text-sm font-medium text-[#163159]"
                          placeholder="https://calendly.com/your-team/intro"
                        />
                      </label>
                      <label className="mt-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#3d567d]">
                        Subject
                        <input
                          value={teamsyncOutreachSubject}
                          onChange={(event) => setTeamsyncOutreachSubject(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-[#c2d3ea] bg-white px-2.5 py-1.5 text-sm font-medium text-[#163159]"
                          placeholder="Campaign subject"
                        />
                      </label>
                      <label className="mt-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#3d567d]">
                        Message
                        <textarea
                          value={teamsyncOutreachMessage}
                          onChange={(event) => setTeamsyncOutreachMessage(event.target.value)}
                          className="mt-1 min-h-[120px] w-full rounded-lg border border-[#c2d3ea] bg-white px-2.5 py-2 text-sm font-medium text-[#163159]"
                        />
                      </label>
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => void handleSendTeamSyncOutreach()}
                          disabled={sendingTeamSyncOutreach}
                          className="rounded-full border border-[#0a66c2] bg-[#0a66c2] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#08529a] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {sendingTeamSyncOutreach ? "Sending..." : "Send campaign"}
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 xl:grid-cols-2">
                      <div className="rounded-xl border border-neutral-200 bg-white p-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Queue preview</div>
                        {teamsyncOutreachQueue.length === 0 ? (
                          <p className="mt-2 text-sm text-neutral-500">No TeamSync outreach queue rows yet.</p>
                        ) : (
                          <div className="mt-2 space-y-1.5">
                            {teamsyncOutreachQueue.slice(0, 24).map((row) => (
                              <div key={row.id} className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5">
                                <div className="flex flex-wrap items-center justify-between gap-1.5">
                                  <div className="text-sm font-semibold text-neutral-900">{row.user_name || row.user_email}</div>
                                  <span className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">{row.status}</span>
                                </div>
                                <div className="mt-0.5 text-xs text-neutral-600">{row.user_email} | {row.segment}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="rounded-xl border border-neutral-200 bg-white p-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Recent campaigns</div>
                        {teamsyncOutreachCampaigns.length === 0 ? (
                          <p className="mt-2 text-sm text-neutral-500">No TeamSync outreach campaigns yet.</p>
                        ) : (
                          <div className="mt-2 space-y-1.5">
                            {teamsyncOutreachCampaigns.slice(0, 16).map((campaign) => (
                              <div key={campaign.id} className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5">
                                <div className="flex flex-wrap items-center justify-between gap-1.5">
                                  <div className="text-sm font-semibold text-neutral-900">{campaign.subject}</div>
                                  <span className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">{campaign.status}</span>
                                </div>
                                <div className="mt-0.5 text-xs text-neutral-600">
                                  {campaign.sent_count}/{campaign.recipient_count} sent | {new Date(campaign.created_at).toLocaleString()}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : null}
              </section>
            ) : null}

            {overview.permissions.is_superuser ? (
              <section
                id="operations-testerFeedback"
                className={`mt-3 rounded-2xl border border-[#bfd2ed] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-3 shadow-[0_14px_30px_-26px_rgba(26,54,93,0.5)] ${isPanelVisible("testerFeedback") ? "" : "hidden"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-[#142c4f]">Tester outreach</h2>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => togglePanel("testerFeedback")}
                      className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                    >
                      {collapsedPanels.testerFeedback ? "Expand" : "Collapse"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void loadTesterFeedback()}
                      className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                    >
                      {loadingTesterFeedback ? "Refreshing..." : "Refresh"}
                    </button>
                  </div>
                </div>
                {!collapsedPanels.testerFeedback ? (
                  <>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <SnapshotStat label="Open notes" value={String(testerSignals.open)} />
                      <SnapshotStat label="In review" value={String(testerSignals.inReview)} />
                      <SnapshotStat label="Resolved" value={String(testerSignals.resolved)} />
                      <SnapshotStat label="Outreach campaigns" value={String(testerSignals.campaigns)} />
                    </div>
                    <div className="mt-3 rounded-xl border border-[#d0dff2] bg-[#f7fbff] p-3">
                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#3d567d]">
                          Audience status
                          <select
                            value={testerAudienceStatus}
                            onChange={(event) => setTesterAudienceStatus(event.target.value as "all" | "open" | "in_review" | "resolved")}
                            className="mt-1 w-full rounded-lg border border-[#c2d3ea] bg-white px-2.5 py-1.5 text-sm font-medium text-[#163159]"
                          >
                            <option value="all">All</option>
                            <option value="open">Open</option>
                            <option value="in_review">In review</option>
                            <option value="resolved">Resolved</option>
                          </select>
                        </label>
                        <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#3d567d]">
                          Module
                          <select
                            value={testerAudienceModule}
                            onChange={(event) => setTesterAudienceModule(event.target.value)}
                            className="mt-1 w-full rounded-lg border border-[#c2d3ea] bg-white px-2.5 py-1.5 text-sm font-medium text-[#163159]"
                          >
                            <option value="all">All modules</option>
                            <option value="career-intelligence">Career Intelligence</option>
                            <option value="persona-foundry">Persona Foundry</option>
                            <option value="teamsync">TeamSync</option>
                            <option value="platform">Platform</option>
                          </select>
                        </label>
                      </div>
                      <label className="mt-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#3d567d]">
                        Subject
                        <input
                          value={testerOutreachSubject}
                          onChange={(event) => setTesterOutreachSubject(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-[#c2d3ea] bg-white px-2.5 py-1.5 text-sm font-medium text-[#163159]"
                        />
                      </label>
                      <label className="mt-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#3d567d]">
                        Message
                        <textarea
                          value={testerOutreachMessage}
                          onChange={(event) => setTesterOutreachMessage(event.target.value)}
                          className="mt-1 min-h-[110px] w-full rounded-lg border border-[#c2d3ea] bg-white px-2.5 py-2 text-sm font-medium text-[#163159]"
                        />
                      </label>
                      <div className="mt-2 flex flex-wrap justify-end gap-2">
                        <Link
                          href="/admin#tester-feedback"
                          className="rounded-full border border-[#cbd8eb] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#36537d] hover:bg-[#f4f8ff]"
                        >
                          Open tester dashboard
                        </Link>
                        <button
                          type="button"
                          onClick={() => void sendTesterFeedbackOutreach()}
                          disabled={sendingTesterFeedbackOutreach}
                          className="rounded-full border border-[#0a66c2] bg-[#0a66c2] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#08529a] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {sendingTesterFeedbackOutreach ? "Sending..." : "Send outreach"}
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Recent outreach campaigns</div>
                      {testerFeedbackCampaigns.length === 0 ? (
                        <p className="mt-2 text-sm text-neutral-500">No tester outreach campaigns yet.</p>
                      ) : (
                        <div className="mt-2 space-y-1.5">
                          {testerFeedbackCampaigns.slice(0, 12).map((campaign) => (
                            <div key={campaign.id} className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5">
                              <div className="flex flex-wrap items-center justify-between gap-1.5">
                                <div className="text-sm font-semibold text-neutral-900">{campaign.subject}</div>
                                <span className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                                  {campaign.recipient_count} recipients
                                </span>
                              </div>
                              <div className="mt-0.5 text-xs text-neutral-600">
                                {campaign.audience_status} | {campaign.audience_module || "all modules"} | {new Date(campaign.created_at).toLocaleString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : null}
              </section>
            ) : null}

            <section id="operations-healthInbox" className={`mt-3 rounded-2xl border border-[#bfd2ed] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-3 shadow-[0_14px_30px_-26px_rgba(26,54,93,0.5)] ${isPanelVisible("healthInbox") ? "" : "hidden"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-[#142c4f]">Candidate health inbox</h2>
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

            <section id="operations-background" className={`mt-3 rounded-2xl border border-[#bfd2ed] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-3 shadow-[0_14px_30px_-26px_rgba(26,54,93,0.5)] ${isPanelVisible("background") ? "" : "hidden"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-[#142c4f]">Background jobs</h2>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(["all", "failed", "running", "queued", "completed"] as const).map((status) => (
                    <button
                      key={`background-filter-${status}`}
                      type="button"
                      onClick={() => setStatusFilter(status)}
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                        statusFilter === status ? "border-sky-300 bg-sky-50 text-sky-800" : "border-neutral-300 bg-white text-neutral-700"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => togglePanel("background")}
                    className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                  >
                    {collapsedPanels.background ? "Expand" : "Collapse"}
                  </button>
                </div>
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

            <section id="operations-live" className={`mt-3 rounded-2xl border border-[#bfd2ed] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-3 shadow-[0_14px_30px_-26px_rgba(26,54,93,0.5)] ${isPanelVisible("live") ? "" : "hidden"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-[#142c4f]">Live search runs</h2>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(["all", "failed", "running", "queued", "completed"] as const).map((status) => (
                    <button
                      key={`live-filter-${status}`}
                      type="button"
                      onClick={() => setStatusFilter(status)}
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                        statusFilter === status ? "border-sky-300 bg-sky-50 text-sky-800" : "border-neutral-300 bg-white text-neutral-700"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => togglePanel("live")}
                    className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                  >
                    {collapsedPanels.live ? "Expand" : "Collapse"}
                  </button>
                </div>
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

function SnapshotStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#cfdced] bg-[#f7fbff] px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4c668c]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[#132b4d]">{value}</div>
    </div>
  )
}
