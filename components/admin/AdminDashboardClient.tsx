"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { getAuthHeaders } from "@/lib/career-client"
import { supabase } from "@/lib/supabase"
import type { AuthProviderStatus } from "@/lib/auth-provider-status"

const ADMIN_LAYOUT_PREFS_KEY = "personara-admin-layout-v1"

type OverviewResponse = {
  permissions: {
    is_admin?: boolean
    is_superuser: boolean
  }
  totals: {
    total_users: number
    active_users: number
    total_candidates: number
    deleted_candidates?: number
    candidates_created_today?: number
    failed_runs_24h?: number
    support_queue?: number
    total_saved_profiles: number
    total_api_requests: number
    total_tokens: number
    estimated_cost_usd: number
  }
  openai_org_usage: {
    rolling_7d: {
      available: boolean
      source: "openai_org_api" | "telemetry_only"
      window_days: number
      input_tokens: number
      output_tokens: number
      total_tokens: number
      total_requests: number
      total_cost_usd: number
      error?: string | null
    }
    daily: {
      available: boolean
      source: "openai_org_api" | "telemetry_only"
      window_days: number
      input_tokens: number
      output_tokens: number
      total_tokens: number
      total_requests: number
      total_cost_usd: number
      error?: string | null
    }
    monthly: {
      available: boolean
      source: "openai_org_api" | "telemetry_only"
      window_days: number
      input_tokens: number
      output_tokens: number
      total_tokens: number
      total_requests: number
      total_cost_usd: number
      error?: string | null
    }
  }
  budget: {
    openai_monthly_budget_usd: number | null
    source: "database" | "environment" | "unset"
  }
  events_by_type: { label: string; value: number }[]
  costs_by_feature: { feature: string; requests: number; tokens: number; cost: number }[]
  module_summary: { module: string; events: number; api_requests: number; tokens: number; cost: number }[]
  provider_breakdown: { provider: string; value: number }[]
  recent_activity: {
    id: string
    module: string
    event_type: string
    created_at: string
    metadata: Record<string, unknown>
  }[]
  recent_api_usage: {
    id: string
    feature: string
    model: string
    status: string
    total_tokens: number | null
    estimated_cost_usd: number | null
    created_at: string
  }[]
  recent_signups: {
    id: string
    name: string | null
    age: string | null
    email: string | null
    created_at: string | null
    last_sign_in_at: string | null
    providers: string[]
  }[]
  candidate_directory: {
    id: string
    user_id: string | null
    full_name: string | null
    city: string | null
    primary_goal: string | null
    created_at: string | null
    deleted_at?: string | null
    purge_after?: string | null
  }[]
}

type RoleAssignment = {
  user_id: string
  email: string | null
  roles: Array<"admin" | "support" | "superuser">
}

type AccessLevelAssignment = {
  user_id: string
  email: string | null
  access_level: "viewer" | "editor" | "manager"
}

type AdminNotebookEntry = {
  id: string
  title: string | null
  note: string
  status: "open" | "in_progress" | "done"
  author_email: string | null
  created_at: string | null
  updated_at: string | null
}

type CommunityModerationPost = {
  id: string
  user_id: string
  author_name: string | null
  post_type: "idea" | "success_story"
  title: string
  summary: string | null
  body: string
  impact_area: string | null
  status: "pending" | "approved" | "hidden"
  is_featured: boolean
  created_at: string
  updated_at: string
  upvotes: number
  comments: number
}

type TesterFeedbackNote = {
  id: string
  user_id: string
  user_email: string | null
  note_type: "bug" | "improvement" | "question"
  severity: "low" | "medium" | "high"
  status: "open" | "in_review" | "resolved"
  message: string
  module: string
  route_path: string
  full_url: string | null
  section_anchor: string | null
  page_title: string | null
  viewport_width: number | null
  viewport_height: number | null
  browser_tz: string | null
  admin_note: string | null
  reviewed_by_email: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

type TesterOutreachCampaign = {
  id: string
  sent_by_email: string | null
  audience_status: "all" | "open" | "in_review" | "resolved"
  audience_module: string | null
  recipient_count: number
  subject: string
  message: string
  created_at: string
}

type AdminEconomicsUserRow = {
  user_id: string
  user_email: string | null
  user_name: string
  plan_code: string
  billing_status: string
  monthly_subscription_usd: number
  monthly_api_budget_usd: number | null
  monthly_api_cost_usd: number
  monthly_api_requests: number
  monthly_tokens: number
  monthly_margin_usd: number
  budget_status: "within" | "watch" | "over_budget" | "unbounded"
  profitability: "positive" | "negative"
  notes: string | null
  subscription_updated_at: string | null
  last_activity_at: string | null
}

type AdminEconomicsResponse = {
  month_label: string
  month_start: string
  summary: {
    users: number
    total_revenue_usd: number
    total_api_cost_usd: number
    total_margin_usd: number
    unprofitable_users: number
    over_budget_users: number
  }
  users: AdminEconomicsUserRow[]
}

type AgentQualityResponse = {
  window_days: number
  summary: {
    feedback_count: number
    sessions_with_feedback: number
    helpful_percent: number
    needs_attention_percent: number
    unique_modules: number
  }
  by_module: {
    module: string
    feedback_count: number
    helpful: number
    needs_attention: number
    helpful_percent: number
  }[]
  hotspots: {
    module: string
    route_path: string
    needs_attention: number
    feedback_count: number
    needs_attention_percent: number
  }[]
  top_prompts: {
    prompt: string
    count: number
  }[]
  recent_notes: {
    module: string
    route_path: string
    note: string
    created_at: string
  }[]
}

export function AdminDashboardClient() {
  const siteOrigin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000")
  const platformUrl = `${siteOrigin.replace(/\/$/, "")}/platform`
  const careerIntelligenceUrl = `${siteOrigin.replace(/\/$/, "")}/career-intelligence`
  const [session, setSession] = useState<Session | null>(null)
  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [message, setMessage] = useState("")
  const [actionMessage, setActionMessage] = useState("")
  const [deletingCandidateId, setDeletingCandidateId] = useState("")
  const [budgetDraft, setBudgetDraft] = useState("")
  const [isSavingBudget, setIsSavingBudget] = useState(false)
  const [candidateSearch, setCandidateSearch] = useState("")
  const [ownerSearch, setOwnerSearch] = useState("")
  const [candidateFilter, setCandidateFilter] = useState("all")
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([])
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>([])
  const [accessLevelAssignments, setAccessLevelAssignments] = useState<AccessLevelAssignment[]>([])
  const [roleEmailDraft, setRoleEmailDraft] = useState("")
  const [roleDraft, setRoleDraft] = useState<"admin" | "support" | "superuser">("support")
  const [roleActionDraft, setRoleActionDraft] = useState<"grant" | "revoke">("grant")
  const [accessEmailDraft, setAccessEmailDraft] = useState("")
  const [accessLevelDraft, setAccessLevelDraft] = useState<"viewer" | "editor" | "manager">("editor")
  const [accessActionDraft, setAccessActionDraft] = useState<"assign" | "revoke">("assign")
  const [isUpdatingRoles, setIsUpdatingRoles] = useState(false)
  const [isUpdatingAccessLevels, setIsUpdatingAccessLevels] = useState(false)
  const [authProviderStatus, setAuthProviderStatus] = useState<AuthProviderStatus[]>([])
  const [notebookEntries, setNotebookEntries] = useState<AdminNotebookEntry[]>([])
  const [notebookTitleDraft, setNotebookTitleDraft] = useState("")
  const [notebookNoteDraft, setNotebookNoteDraft] = useState("")
  const [notebookStatusDraft, setNotebookStatusDraft] = useState<"open" | "in_progress" | "done">("open")
  const [isSavingNotebook, setIsSavingNotebook] = useState(false)
  const [communityPosts, setCommunityPosts] = useState<CommunityModerationPost[]>([])
  const [loadingCommunityPosts, setLoadingCommunityPosts] = useState(false)
  const [moderatingCommunityPostId, setModeratingCommunityPostId] = useState("")
  const [testerFeedbackNotes, setTesterFeedbackNotes] = useState<TesterFeedbackNote[]>([])
  const [loadingTesterFeedback, setLoadingTesterFeedback] = useState(false)
  const [reviewingTesterFeedbackId, setReviewingTesterFeedbackId] = useState("")
  const [testerFeedbackStatusFilter, setTesterFeedbackStatusFilter] = useState<"all" | "open" | "in_review" | "resolved">("all")
  const [testerFeedbackSeverityFilter, setTesterFeedbackSeverityFilter] = useState<"all" | "low" | "medium" | "high">("all")
  const [testerFeedbackModuleFilter, setTesterFeedbackModuleFilter] = useState("all")
  const [testerOutreachCampaigns, setTesterOutreachCampaigns] = useState<TesterOutreachCampaign[]>([])
  const [loadingTesterOutreachCampaigns, setLoadingTesterOutreachCampaigns] = useState(false)
  const [outreachStatusAudience, setOutreachStatusAudience] = useState<"all" | "open" | "in_review" | "resolved">("open")
  const [outreachModuleAudience, setOutreachModuleAudience] = useState("all")
  const [outreachSubjectDraft, setOutreachSubjectDraft] = useState("Thanks for testing Personara")
  const [outreachMessageDraft, setOutreachMessageDraft] = useState("")
  const [sendingOutreach, setSendingOutreach] = useState(false)
  const [economics, setEconomics] = useState<AdminEconomicsResponse | null>(null)
  const [loadingEconomics, setLoadingEconomics] = useState(false)
  const [agentQuality, setAgentQuality] = useState<AgentQualityResponse | null>(null)
  const [loadingAgentQuality, setLoadingAgentQuality] = useState(false)
  const [editingSubscriptionUserId, setEditingSubscriptionUserId] = useState("")
  const [subscriptionDraftRevenue, setSubscriptionDraftRevenue] = useState("")
  const [subscriptionDraftBudget, setSubscriptionDraftBudget] = useState("")
  const [savingSubscription, setSavingSubscription] = useState(false)
  const [activeSection, setActiveSection] = useState("dashboard-overview")
  const [activeAnchor, setActiveAnchor] = useState("#dashboard-overview")
  const [showWorkflowMap, setShowWorkflowMap] = useState(false)
  const [showAdvancedTools, setShowAdvancedTools] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    "dashboard-overview": false,
    "dashboard-help": false,
    "openai-usage": false,
    "unit-economics": false,
    "operating-signals": false,
    "acquisition-snapshot": false,
    "feature-activity": false,
    "api-usage-by-feature": false,
    "agent-quality": false,
    "recent-activity": false,
    "recent-api-calls": false,
    "access-control": false,
    "admin-notebook": false,
    "community-moderation": false,
    "tester-feedback": false,
    "candidate-workspace-manager": false,
  })
  const [toast, setToast] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(null)

  const showToast = useCallback((nextToast: { tone: "success" | "error" | "info"; message: string }) => {
    setToast(nextToast)
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        setToast((current) => (current?.message === nextToast.message ? null : current))
      }, 3200)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(ADMIN_LAYOUT_PREFS_KEY)
      if (!raw) {
        if (window.matchMedia("(max-width: 767px)").matches) {
          setCollapsedSections((current) => ({
            ...current,
            "dashboard-help": true,
            "openai-usage": true,
            "unit-economics": true,
            "operating-signals": true,
            "acquisition-snapshot": true,
            "feature-activity": true,
            "api-usage-by-feature": true,
            "recent-activity": true,
            "recent-api-calls": true,
            "access-control": true,
            "admin-notebook": true,
            "community-moderation": true,
            "tester-feedback": true,
            "candidate-workspace-manager": true,
          }))
        }
        return
      }
      const parsed = JSON.parse(raw) as {
        collapsedSections?: Record<string, boolean>
        candidateFilter?: string
        candidateSearch?: string
        ownerSearch?: string
        showAdvancedTools?: boolean
        testerFeedbackStatusFilter?: "all" | "open" | "in_review" | "resolved"
        testerFeedbackSeverityFilter?: "all" | "low" | "medium" | "high"
        testerFeedbackModuleFilter?: string
      }
      if (parsed.collapsedSections) {
        setCollapsedSections((current) => ({ ...current, ...parsed.collapsedSections }))
      }
      if (typeof parsed.candidateFilter === "string") setCandidateFilter(parsed.candidateFilter)
      if (typeof parsed.candidateSearch === "string") setCandidateSearch(parsed.candidateSearch)
      if (typeof parsed.ownerSearch === "string") setOwnerSearch(parsed.ownerSearch)
      if (typeof parsed.showAdvancedTools === "boolean") setShowAdvancedTools(parsed.showAdvancedTools)
      if (
        parsed.testerFeedbackStatusFilter === "all" ||
        parsed.testerFeedbackStatusFilter === "open" ||
        parsed.testerFeedbackStatusFilter === "in_review" ||
        parsed.testerFeedbackStatusFilter === "resolved"
      ) {
        setTesterFeedbackStatusFilter(parsed.testerFeedbackStatusFilter)
      }
      if (
        parsed.testerFeedbackSeverityFilter === "all" ||
        parsed.testerFeedbackSeverityFilter === "low" ||
        parsed.testerFeedbackSeverityFilter === "medium" ||
        parsed.testerFeedbackSeverityFilter === "high"
      ) {
        setTesterFeedbackSeverityFilter(parsed.testerFeedbackSeverityFilter)
      }
      if (typeof parsed.testerFeedbackModuleFilter === "string") {
        setTesterFeedbackModuleFilter(parsed.testerFeedbackModuleFilter)
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const payload = {
      collapsedSections,
      candidateFilter,
      candidateSearch,
      ownerSearch,
      showAdvancedTools,
      testerFeedbackStatusFilter,
      testerFeedbackSeverityFilter,
      testerFeedbackModuleFilter,
    }
    window.localStorage.setItem(ADMIN_LAYOUT_PREFS_KEY, JSON.stringify(payload))
  }, [
    candidateFilter,
    candidateSearch,
    collapsedSections,
    ownerSearch,
    showAdvancedTools,
    testerFeedbackStatusFilter,
    testerFeedbackSeverityFilter,
    testerFeedbackModuleFilter,
  ])

  const loadRoleAssignments = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/users/roles", {
        headers: await getAuthHeaders(),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to load role assignments")
      }
      setRoleAssignments((json.assignments ?? []) as RoleAssignment[])
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load role assignments"
      showToast({ tone: "error", message: errorMessage })
    }
  }, [showToast])

  const loadAccessLevelAssignments = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/users/access", {
        headers: await getAuthHeaders(),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to load access levels")
      }
      setAccessLevelAssignments((json.assignments ?? []) as AccessLevelAssignment[])
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load access levels"
      showToast({ tone: "error", message: errorMessage })
    }
  }, [showToast])

  const loadNotebookEntries = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/notebook", {
        headers: await getAuthHeaders(),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to load notebook entries")
      }
      setNotebookEntries((json.entries ?? []) as AdminNotebookEntry[])
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load notebook entries"
      showToast({ tone: "error", message: errorMessage })
    }
  }, [showToast])

  const loadCommunityPosts = useCallback(async () => {
    setLoadingCommunityPosts(true)
    try {
      const response = await fetch("/api/admin/community/posts", {
        headers: await getAuthHeaders(),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to load community moderation queue")
      }
      setCommunityPosts((json.posts ?? []) as CommunityModerationPost[])
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load community moderation queue"
      showToast({ tone: "error", message: errorMessage })
    } finally {
      setLoadingCommunityPosts(false)
    }
  }, [showToast])

  const loadTesterFeedbackNotes = useCallback(async () => {
    setLoadingTesterFeedback(true)
    try {
      const response = await fetch("/api/admin/tester-notes", {
        headers: await getAuthHeaders(),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to load tester notes")
      }
      setTesterFeedbackNotes((json.notes ?? []) as TesterFeedbackNote[])
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load tester notes"
      showToast({ tone: "error", message: errorMessage })
    } finally {
      setLoadingTesterFeedback(false)
    }
  }, [showToast])

  const loadTesterOutreachCampaigns = useCallback(async () => {
    setLoadingTesterOutreachCampaigns(true)
    try {
      const response = await fetch("/api/admin/tester-notes/outreach", {
        headers: await getAuthHeaders(),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to load tester outreach")
      }
      setTesterOutreachCampaigns((json.campaigns ?? []) as TesterOutreachCampaign[])
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load tester outreach"
      showToast({ tone: "error", message: errorMessage })
    } finally {
      setLoadingTesterOutreachCampaigns(false)
    }
  }, [showToast])

  const loadEconomics = useCallback(async () => {
    setLoadingEconomics(true)
    try {
      const response = await fetch("/api/admin/economics", {
        headers: await getAuthHeaders(),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to load unit economics")
      }
      setEconomics(json as AdminEconomicsResponse)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load unit economics"
      showToast({ tone: "error", message: errorMessage })
    } finally {
      setLoadingEconomics(false)
    }
  }, [showToast])

  const loadAgentQuality = useCallback(async () => {
    setLoadingAgentQuality(true)
    try {
      const response = await fetch("/api/admin/agent-quality", {
        headers: await getAuthHeaders(),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to load agent quality")
      }
      setAgentQuality(json as AgentQualityResponse)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load agent quality"
      showToast({ tone: "error", message: errorMessage })
    } finally {
      setLoadingAgentQuality(false)
    }
  }, [showToast])

  useEffect(() => {
    async function load() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

      setSession(currentSession)

      if (!currentSession?.access_token) {
        return
      }

      const response = await fetch("/api/admin/overview", {
        headers: await getAuthHeaders(),
      })
      const json = await response.json()

      if (!response.ok) {
        const errorMessage = json.error || "Failed to load admin dashboard"
        setMessage(errorMessage)
        showToast({ tone: "error", message: errorMessage })
        return
      }

      const nextOverview = json as OverviewResponse
      setOverview(nextOverview)
      setBudgetDraft(
        typeof nextOverview.budget.openai_monthly_budget_usd === "number"
          ? String(nextOverview.budget.openai_monthly_budget_usd)
          : ""
      )
      await loadNotebookEntries()
      await loadCommunityPosts()
      await loadTesterFeedbackNotes()
      await loadEconomics()
      await loadAgentQuality()
      if (nextOverview.permissions.is_superuser) {
        await loadTesterOutreachCampaigns()
        await loadRoleAssignments()
        await loadAccessLevelAssignments()
      }

      try {
        const providerStatusResponse = await fetch("/api/auth/provider-status")
        const providerStatusJson = await providerStatusResponse.json()
        setAuthProviderStatus(Array.isArray(providerStatusJson.providers) ? (providerStatusJson.providers as AuthProviderStatus[]) : [])
      } catch {}
    }

    void load()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => subscription.unsubscribe()
  }, [loadAccessLevelAssignments, loadAgentQuality, loadCommunityPosts, loadEconomics, loadNotebookEntries, loadRoleAssignments, loadTesterFeedbackNotes, loadTesterOutreachCampaigns, showToast])

  async function handleCommunityModeration(
    postId: string,
    updates: { status?: "pending" | "approved" | "hidden"; is_featured?: boolean }
  ) {
    setModeratingCommunityPostId(postId)
    try {
      const response = await fetch("/api/community/admin/moderate", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          post_id: postId,
          ...updates,
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to update community post")
      }
      await loadCommunityPosts()
      showToast({ tone: "success", message: "Community moderation update applied." })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update community post"
      showToast({ tone: "error", message: errorMessage })
    } finally {
      setModeratingCommunityPostId("")
    }
  }

  async function handleTesterFeedbackReview(
    noteId: string,
    updates: { status?: "open" | "in_review" | "resolved"; severity?: "low" | "medium" | "high"; admin_note?: string }
  ) {
    setReviewingTesterFeedbackId(noteId)
    try {
      const response = await fetch("/api/admin/tester-notes", {
        method: "PATCH",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: noteId,
          ...updates,
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to update tester note")
      }
      const updated = json.note as TesterFeedbackNote
      setTesterFeedbackNotes((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      showToast({ tone: "success", message: "Tester note updated." })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update tester note"
      showToast({ tone: "error", message: errorMessage })
    } finally {
      setReviewingTesterFeedbackId("")
    }
  }

  async function handleSendTesterOutreach() {
    if (!overview?.permissions.is_superuser) {
      showToast({ tone: "error", message: "Only superusers can send tester outreach emails." })
      return
    }

    if (!outreachSubjectDraft.trim() || !outreachMessageDraft.trim()) {
      showToast({ tone: "error", message: "Add both an outreach subject and message." })
      return
    }

    setSendingOutreach(true)
    try {
      const response = await fetch("/api/admin/tester-notes/outreach", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audience_status: outreachStatusAudience,
          audience_module: outreachModuleAudience === "all" ? "" : outreachModuleAudience,
          subject: outreachSubjectDraft.trim(),
          message: outreachMessageDraft.trim(),
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to send tester outreach")
      }
      await loadTesterOutreachCampaigns()
      showToast({
        tone: "success",
        message: `Outreach sent to ${json.recipients_sent ?? 0} testers (${json.recipients_attempted ?? 0} attempted).`,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send tester outreach"
      showToast({ tone: "error", message: errorMessage })
    } finally {
      setSendingOutreach(false)
    }
  }

  async function handleSaveSubscription(userId: string) {
    if (!overview?.permissions.is_superuser) {
      showToast({ tone: "error", message: "Only superusers can edit subscription values." })
      return
    }

    const revenue = Number(subscriptionDraftRevenue)
    if (!Number.isFinite(revenue) || revenue < 0) {
      showToast({ tone: "error", message: "Enter a valid monthly subscription amount." })
      return
    }
    const budget = subscriptionDraftBudget.trim().length === 0 ? null : Number(subscriptionDraftBudget)
    if (budget !== null && (!Number.isFinite(budget) || budget < 0)) {
      showToast({ tone: "error", message: "Enter a valid API budget or leave it blank." })
      return
    }

    setSavingSubscription(true)
    try {
      const response = await fetch("/api/admin/economics", {
        method: "PATCH",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          monthly_subscription_usd: revenue,
          monthly_api_budget_usd: budget,
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to save subscription settings")
      }
      setEditingSubscriptionUserId("")
      await loadEconomics()
      showToast({ tone: "success", message: "Subscription guardrail updated." })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save subscription settings"
      showToast({ tone: "error", message: errorMessage })
    } finally {
      setSavingSubscription(false)
    }
  }

  async function handleDeleteCandidate(candidateId: string, name: string | null) {
    const confirmation = window.prompt(`Type DELETE to archive candidate workspace${name ? ` for ${name}` : ""} for 7 days.`)
    if (confirmation !== "DELETE") {
      setActionMessage("Delete cancelled. Type DELETE exactly to confirm.")
      return
    }

    setDeletingCandidateId(candidateId)
    setActionMessage("")

    try {
      const response = await fetch(`/api/admin/candidates/${candidateId}`, {
        method: "DELETE",
        headers: await getAuthHeaders(),
      })
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || "Failed to delete candidate")
      }

      setOverview((current) =>
        current
          ? {
              ...current,
              totals: {
                ...current.totals,
                total_candidates: Math.max(0, current.totals.total_candidates - 1),
                deleted_candidates: (current.totals.deleted_candidates ?? 0) + 1,
              },
              candidate_directory: current.candidate_directory.map((candidate) =>
                candidate.id === candidateId
                  ? {
                      ...candidate,
                      deleted_at: new Date().toISOString(),
                    }
                  : candidate
              ),
            }
          : current
      )
      const successMessage = `Archived candidate workspace${name ? ` for ${name}` : ""} for 7 days.`
      setActionMessage(successMessage)
      showToast({ tone: "success", message: successMessage })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Something went wrong"
      setActionMessage(errorMessage)
      showToast({ tone: "error", message: errorMessage })
    } finally {
      setDeletingCandidateId("")
    }
  }

  async function handleRestoreCandidate(candidateId: string, name: string | null) {
    setDeletingCandidateId(candidateId)
    setActionMessage("")

    try {
      const response = await fetch(`/api/admin/candidates/${candidateId}/restore`, {
        method: "POST",
        headers: await getAuthHeaders(),
      })
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || "Failed to restore candidate")
      }

      setOverview((current) =>
        current
          ? {
              ...current,
              totals: {
                ...current.totals,
                total_candidates: current.totals.total_candidates + 1,
                deleted_candidates: Math.max(0, (current.totals.deleted_candidates ?? 0) - 1),
              },
              candidate_directory: current.candidate_directory.map((candidate) =>
                candidate.id === candidateId
                  ? {
                      ...candidate,
                      deleted_at: null,
                      purge_after: null,
                    }
                  : candidate
              ),
            }
          : current
      )
      const successMessage = `Restored candidate workspace${name ? ` for ${name}` : ""}.`
      setActionMessage(successMessage)
      showToast({ tone: "success", message: successMessage })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Something went wrong"
      setActionMessage(errorMessage)
      showToast({ tone: "error", message: errorMessage })
    } finally {
      setDeletingCandidateId("")
    }
  }

  async function handleBulkDeleteCandidates() {
    if (selectedCandidateIds.length === 0 || !overview) return

    const confirmed = window.confirm(`Archive ${selectedCandidateIds.length} selected candidate workspaces for 7 days?`)
    if (!confirmed) return

    setActionMessage("")
    setDeletingCandidateId("bulk")

    try {
      for (const candidateId of selectedCandidateIds) {
        const response = await fetch(`/api/admin/candidates/${candidateId}`, {
          method: "DELETE",
          headers: await getAuthHeaders(),
        })
        const json = await response.json()
        if (!response.ok) {
          throw new Error(json.error || `Failed to delete candidate ${candidateId}`)
        }
      }

      setOverview((current) =>
        current
          ? {
              ...current,
              totals: {
                ...current.totals,
                total_candidates: Math.max(0, current.totals.total_candidates - selectedCandidateIds.length),
                deleted_candidates: (current.totals.deleted_candidates ?? 0) + selectedCandidateIds.length,
              },
              candidate_directory: current.candidate_directory.map((candidate) =>
                selectedCandidateIds.includes(candidate.id)
                  ? {
                      ...candidate,
                      deleted_at: new Date().toISOString(),
                      purge_after: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    }
                  : candidate
              ),
            }
          : current
      )
      const successMessage = `Archived ${selectedCandidateIds.length} candidate workspaces for 7 days.`
      setActionMessage(successMessage)
      showToast({ tone: "success", message: successMessage })
      setSelectedCandidateIds([])
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Something went wrong"
      setActionMessage(errorMessage)
      showToast({ tone: "error", message: errorMessage })
    } finally {
      setDeletingCandidateId("")
    }
  }

  async function handleSaveBudget() {
    const parsedBudget = Number(budgetDraft)

    if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
      const errorMessage = "Enter a monthly budget greater than 0 before saving."
      setActionMessage(errorMessage)
      showToast({ tone: "error", message: errorMessage })
      return
    }

    setIsSavingBudget(true)
    setActionMessage("")

    try {
      const response = await fetch("/api/admin/settings/openai-budget", {
        method: "PATCH",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          openai_monthly_budget_usd: parsedBudget,
        }),
      })
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || "Failed to save budget")
      }

      setOverview((current) =>
        current
          ? {
              ...current,
              budget: {
                openai_monthly_budget_usd: json.openai_monthly_budget_usd,
                source: json.source,
              },
            }
          : current
      )
      setBudgetDraft(String(json.openai_monthly_budget_usd))
      const successMessage = `Monthly OpenAI budget saved at $${Number(json.openai_monthly_budget_usd).toFixed(2)}.`
      setActionMessage(successMessage)
      showToast({ tone: "success", message: successMessage })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Something went wrong"
      setActionMessage(errorMessage)
      showToast({ tone: "error", message: errorMessage })
    } finally {
      setIsSavingBudget(false)
    }
  }

  async function handleRoleAssignmentSubmit() {
    const normalizedEmail = roleEmailDraft.trim().toLowerCase()

    if (!normalizedEmail) {
      const errorMessage = "Enter a user email first."
      setActionMessage(errorMessage)
      showToast({ tone: "error", message: errorMessage })
      return
    }

    setIsUpdatingRoles(true)
    setActionMessage("")

    try {
      const response = await fetch("/api/admin/users/roles", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          role: roleDraft,
          action: roleActionDraft,
        }),
      })
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || "Failed to update role assignment")
      }

      await loadRoleAssignments()
      const successMessage =
        roleActionDraft === "grant"
          ? `Granted ${roleDraft} access to ${normalizedEmail}.`
          : `Removed ${roleDraft} access from ${normalizedEmail}.`
      setActionMessage(successMessage)
      showToast({ tone: "success", message: successMessage })
      setRoleEmailDraft("")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update role assignment"
      setActionMessage(errorMessage)
      showToast({ tone: "error", message: errorMessage })
    } finally {
      setIsUpdatingRoles(false)
    }
  }

  async function handleAccessLevelSubmit() {
    const normalizedEmail = accessEmailDraft.trim().toLowerCase()

    if (!normalizedEmail) {
      const errorMessage = "Enter a user email first."
      setActionMessage(errorMessage)
      showToast({ tone: "error", message: errorMessage })
      return
    }

    setIsUpdatingAccessLevels(true)
    setActionMessage("")

    try {
      const response = await fetch("/api/admin/users/access", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          access_level: accessLevelDraft,
          action: accessActionDraft,
        }),
      })
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || "Failed to update access level")
      }

      await loadAccessLevelAssignments()
      const successMessage =
        accessActionDraft === "assign"
          ? `Assigned ${accessLevelDraft} access to ${normalizedEmail}.`
          : `Removed access level from ${normalizedEmail}.`
      setActionMessage(successMessage)
      showToast({ tone: "success", message: successMessage })
      setAccessEmailDraft("")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update access level"
      setActionMessage(errorMessage)
      showToast({ tone: "error", message: errorMessage })
    } finally {
      setIsUpdatingAccessLevels(false)
    }
  }

  async function handleNotebookSubmit() {
    if (!notebookNoteDraft.trim()) {
      const errorMessage = "Add a note before saving."
      setActionMessage(errorMessage)
      showToast({ tone: "error", message: errorMessage })
      return
    }

    setIsSavingNotebook(true)
    setActionMessage("")

    try {
      const response = await fetch("/api/admin/notebook", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: notebookTitleDraft,
          note: notebookNoteDraft,
          status: notebookStatusDraft,
        }),
      })
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || "Failed to save notebook entry")
      }

      const entry = json.entry as AdminNotebookEntry
      setNotebookEntries((current) => [entry, ...current].slice(0, 100))
      setNotebookTitleDraft("")
      setNotebookNoteDraft("")
      setNotebookStatusDraft("open")
      const successMessage = "Notebook entry saved."
      setActionMessage(successMessage)
      showToast({ tone: "success", message: successMessage })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save notebook entry"
      setActionMessage(errorMessage)
      showToast({ tone: "error", message: errorMessage })
    } finally {
      setIsSavingNotebook(false)
    }
  }

  async function handleNotebookStatusUpdate(id: string, status: "open" | "in_progress" | "done") {
    try {
      const response = await fetch("/api/admin/notebook", {
        method: "PATCH",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, status }),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to update notebook entry")
      }
      const updated = json.entry as AdminNotebookEntry
      setNotebookEntries((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      showToast({ tone: "success", message: "Notebook entry updated." })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update notebook entry"
      showToast({ tone: "error", message: errorMessage })
    }
  }

  function toggleCandidateSelection(candidateId: string) {
    setSelectedCandidateIds((current) =>
      current.includes(candidateId) ? current.filter((id) => id !== candidateId) : [...current, candidateId]
    )
  }

  function toggleSection(sectionKey: string) {
    setCollapsedSections((current) => ({ ...current, [sectionKey]: !current[sectionKey] }))
  }

  function setAllSectionsCollapsed(collapsed: boolean) {
    setCollapsedSections((current) =>
      Object.keys(current).reduce<Record<string, boolean>>((next, key) => {
        next[key] = collapsed
        return next
      }, {})
    )
  }

  const openAndScroll = useCallback((sectionKey: string, href: string) => {
    setActiveSection(sectionKey)
    setActiveAnchor(href)
    setCollapsedSections((current) =>
      Object.keys(current).reduce<Record<string, boolean>>((next, key) => {
        next[key] = key !== sectionKey
        return next
      }, {})
    )

    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        const target = document.querySelector(href)
        if (target instanceof HTMLElement) {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              const stickyNav = document.querySelector('[data-sticky-nav="true"]')
              let stickyOffset = 172
              if (stickyNav instanceof HTMLElement) {
                const stickyTop = Number.parseFloat(window.getComputedStyle(stickyNav).top || "0")
                stickyOffset = Math.ceil(stickyNav.getBoundingClientRect().height + stickyTop + 20)
              }

              const top = window.scrollY + target.getBoundingClientRect().top - stickyOffset
              window.scrollTo({ top: Math.max(0, top), behavior: "smooth" })
              target.classList.add("ring-2", "ring-sky-300", "ring-offset-2", "transition-shadow", "duration-300")
              window.setTimeout(() => {
                target.classList.remove("ring-2", "ring-sky-300", "ring-offset-2", "transition-shadow", "duration-300")
              }, 1300)
            })
          })
        }
      }, 180)
    }
  }, [])

  const openOwnerWorkspace = useCallback(
    (owner: { userId: string; email: string | null; displayName: string }) => {
      setCandidateFilter("all")
      setCandidateSearch(owner.email || owner.userId || owner.displayName)
      openAndScroll("candidate-workspace-manager", "#candidate-workspace-manager")
      setActionMessage(`Filtered workspace manager for ${owner.displayName}.`)
      showToast({ tone: "info", message: `Showing candidate workspaces for ${owner.displayName}.` })
    },
    [openAndScroll, showToast]
  )

  const testerFeedbackModuleOptions = useMemo(
    () =>
      Array.from(new Set(testerFeedbackNotes.map((note) => note.module).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [testerFeedbackNotes]
  )

  const filteredTesterFeedbackNotes = useMemo(
    () =>
      testerFeedbackNotes.filter((note) => {
        if (testerFeedbackStatusFilter !== "all" && note.status !== testerFeedbackStatusFilter) return false
        if (testerFeedbackSeverityFilter !== "all" && note.severity !== testerFeedbackSeverityFilter) return false
        if (testerFeedbackModuleFilter !== "all" && note.module !== testerFeedbackModuleFilter) return false
        return true
      }),
    [testerFeedbackModuleFilter, testerFeedbackNotes, testerFeedbackSeverityFilter, testerFeedbackStatusFilter]
  )

  if (!session?.user) {
    return (
      <main className="min-h-screen bg-neutral-50 text-neutral-900">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold">Admin dashboard</h1>
            <p className="mt-2 text-sm text-neutral-600">Sign in on the main Persona Foundry page first, then reopen this admin dashboard.</p>
            <Link href="/" className="mt-4 inline-flex rounded-xl bg-black px-4 py-2 text-sm font-medium text-white">
              Go to homepage
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (message && !overview) {
    return (
      <main className="min-h-screen bg-neutral-50 text-neutral-900">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold">Admin dashboard</h1>
            <p className="mt-2 text-sm text-rose-700">{message}</p>
            <p className="mt-2 text-sm text-neutral-600">
              Make sure your email is listed in `ADMIN_EMAILS`, and add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` for full telemetry access.
            </p>
          </div>
        </div>
      </main>
    )
  }

  if (!overview) {
    return (
      <main className="min-h-screen bg-neutral-50 text-neutral-900">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm text-sm text-neutral-600">Loading admin dashboard...</div>
        </div>
      </main>
    )
  }

  const normalizedCandidateSearch = candidateSearch.trim().toLowerCase()
  const filteredCandidates = overview.candidate_directory.filter((candidate) => {
    const haystack = [candidate.full_name, candidate.city, candidate.primary_goal, candidate.user_id]
      .filter((value): value is string => Boolean(value))
      .join(" ")
      .toLowerCase()
    const matchesSearch = !normalizedCandidateSearch || haystack.includes(normalizedCandidateSearch)
    const matchesFilter =
      candidateFilter === "all" ||
      (candidateFilter === "active" && !candidate.deleted_at) ||
      (candidateFilter === "archived" && Boolean(candidate.deleted_at)) ||
      (candidateFilter === "ready" && candidate.full_name && candidate.primary_goal && candidate.city) ||
      (candidateFilter === "likely-test" && (!candidate.full_name || !candidate.primary_goal || !candidate.city)) ||
      (candidateFilter === "untitled" && !candidate.full_name) ||
      (candidateFilter === "goal-missing" && !candidate.primary_goal) ||
      (candidateFilter === "city-missing" && !candidate.city)
    return matchesSearch && matchesFilter
  })
  const ownerByUserId = new Map<string, OverviewResponse["recent_signups"][number]>()
  for (const signup of overview.recent_signups) {
    ownerByUserId.set(signup.id, signup)
  }
  const ownerStatsByUserId = new Map<
    string,
    {
      userId: string
      email: string | null
      displayName: string
      total: number
      active: number
      archived: number
      latestCreatedAt: string | null
      latestActiveCandidateId: string | null
    }
  >()
  for (const candidate of overview.candidate_directory) {
    if (!candidate.user_id) continue
    const owner = ownerByUserId.get(candidate.user_id)
    const current = ownerStatsByUserId.get(candidate.user_id) ?? {
      userId: candidate.user_id,
      email: owner?.email ?? null,
      displayName: owner?.name || owner?.email || candidate.user_id,
      total: 0,
      active: 0,
      archived: 0,
      latestCreatedAt: null,
      latestActiveCandidateId: null,
    }
    current.total += 1
    if (candidate.deleted_at) {
      current.archived += 1
    } else {
      current.active += 1
      if (candidate.created_at && (!current.latestCreatedAt || candidate.created_at >= current.latestCreatedAt)) {
        current.latestActiveCandidateId = candidate.id
      }
    }
    if (candidate.created_at && (!current.latestCreatedAt || candidate.created_at > current.latestCreatedAt)) {
      current.latestCreatedAt = candidate.created_at
    }
    ownerStatsByUserId.set(candidate.user_id, current)
  }
  const normalizedOwnerSearch = ownerSearch.trim().toLowerCase()
  const ownerDirectory = Array.from(ownerStatsByUserId.values())
    .filter((owner) => {
      if (!normalizedOwnerSearch) return true
      const haystack = [owner.displayName, owner.email, owner.userId].filter(Boolean).join(" ").toLowerCase()
      return haystack.includes(normalizedOwnerSearch)
    })
    .sort((a, b) => b.active - a.active || b.total - a.total || a.displayName.localeCompare(b.displayName))
  const accessLevelByUserId = new Map(
    accessLevelAssignments.map((assignment) => [assignment.user_id, assignment.access_level] as const)
  )
  const signupTrend = buildDailyTrend(
    overview.recent_signups.map((user) => ({ created_at: user.created_at })),
    () => 1
  )
  const apiRequestTrend = buildDailyTrend(
    overview.recent_api_usage.map((item) => ({ created_at: item.created_at })),
    () => 1
  )
  const apiCostTrend = buildDailyTrend(
    overview.recent_api_usage.map((item) => ({ created_at: item.created_at, estimated_cost_usd: item.estimated_cost_usd })),
    (item) => Number(item.estimated_cost_usd ?? 0)
  )
  const averageTokensPerRequest = safeDivision(overview.totals.total_tokens, overview.totals.total_api_requests)
  const costPerActiveUser = safeDivision(overview.totals.estimated_cost_usd, overview.totals.active_users)
  const openAIUsage7d = overview.openai_org_usage.rolling_7d
  const openAIUsageDaily = overview.openai_org_usage.daily
  const openAIUsageMonthly = overview.openai_org_usage.monthly
  const usageMismatch =
    openAIUsage7d.available &&
    (openAIUsage7d.total_tokens > overview.totals.total_tokens || openAIUsage7d.total_cost_usd > overview.totals.estimated_cost_usd)
  const averageDailyOpenAICost = openAIUsage7d.available ? safeDivision(openAIUsage7d.total_cost_usd, Math.max(openAIUsage7d.window_days, 1)) : 0
  const projected30DayOpenAICost = averageDailyOpenAICost * 30
  const averageDailyOpenAITokens = openAIUsage7d.available ? Math.round(safeDivision(openAIUsage7d.total_tokens, Math.max(openAIUsage7d.window_days, 1))) : 0
  const openAIMonthlyBudget = overview.budget.openai_monthly_budget_usd
  const monthlyBudgetUsedPercent = openAIMonthlyBudget ? safePercent(openAIUsageMonthly.total_cost_usd, openAIMonthlyBudget) : 0
  const projectedBudgetUsedPercent = openAIMonthlyBudget ? safePercent(projected30DayOpenAICost, openAIMonthlyBudget) : 0
  const remainingMonthlyBudget = openAIMonthlyBudget ? Math.max(0, openAIMonthlyBudget - openAIUsageMonthly.total_cost_usd) : null
  const projectedBudgetVariance = openAIMonthlyBudget ? projected30DayOpenAICost - openAIMonthlyBudget : null
  const budgetGuardrailTone =
    !openAIUsage7d.available || !openAIMonthlyBudget
      ? "neutral"
      : projected30DayOpenAICost >= openAIMonthlyBudget
        ? "warning"
        : projected30DayOpenAICost >= openAIMonthlyBudget * 0.75 || openAIUsageMonthly.total_cost_usd >= openAIMonthlyBudget * 0.75
          ? "info"
          : "success"
  const spendGuardrailTone =
    !openAIUsage7d.available
      ? "neutral"
      : openAIMonthlyBudget
        ? budgetGuardrailTone
      : projected30DayOpenAICost >= 25
        ? "warning"
        : projected30DayOpenAICost >= 10
          ? "info"
          : "success"
  const candidateWithGoalCount = overview.candidate_directory.filter((candidate) => Boolean(candidate.primary_goal)).length
  const candidateWithCityCount = overview.candidate_directory.filter((candidate) => Boolean(candidate.city)).length
  const namedCandidateCount = overview.candidate_directory.filter((candidate) => Boolean(candidate.full_name)).length
  const candidateProfileCompleteness = safePercent(candidateWithGoalCount + candidateWithCityCount + namedCandidateCount, Math.max(overview.candidate_directory.length * 3, 1))
  const candidateGoalCoverage = safePercent(candidateWithGoalCount, Math.max(overview.candidate_directory.length, 1))
  const candidateCityCoverage = safePercent(candidateWithCityCount, Math.max(overview.candidate_directory.length, 1))
  const candidateNameCoverage = safePercent(namedCandidateCount, Math.max(overview.candidate_directory.length, 1))
  const selectedCandidateNames = overview.candidate_directory
    .filter((candidate) => selectedCandidateIds.includes(candidate.id))
    .map((candidate) => candidate.full_name || "Untitled candidate")
    .slice(0, 3)
  const candidateQualityBuckets = {
    likelyReady: overview.candidate_directory.filter((candidate) => candidate.full_name && candidate.primary_goal && candidate.city).length,
    needsAttention: overview.candidate_directory.filter((candidate) => (candidate.full_name ? 0 : 1) + (candidate.primary_goal ? 0 : 1) + (candidate.city ? 0 : 1) === 1).length,
    likelyTest: overview.candidate_directory.filter((candidate) => !candidate.full_name || !candidate.primary_goal || !candidate.city).length,
  }
  const cleanupCandidateIds = filteredCandidates
    .filter((candidate) => {
      if (candidate.deleted_at) return false
      const missingFieldCount = Number(!candidate.full_name) + Number(!candidate.primary_goal) + Number(!candidate.city)
      return missingFieldCount >= 2
    })
    .map((candidate) => candidate.id)
  const selectedCandidates = overview.candidate_directory.filter((candidate) => selectedCandidateIds.includes(candidate.id))
  const selectedHighRiskCount = selectedCandidates.filter((candidate) => {
    const missingFieldCount = Number(!candidate.full_name) + Number(!candidate.primary_goal) + Number(!candidate.city)
    return missingFieldCount >= 2
  }).length
  const selectedNeedsReviewCount = selectedCandidates.filter((candidate) => {
    const missingFieldCount = Number(!candidate.full_name) + Number(!candidate.primary_goal) + Number(!candidate.city)
    return missingFieldCount === 1
  }).length
  const selectionTone =
    selectedCandidateIds.length === 0
      ? "border-neutral-200 bg-neutral-50"
      : selectedHighRiskCount === selectedCandidateIds.length
        ? "border-rose-200 bg-rose-50"
        : selectedHighRiskCount > 0 || selectedNeedsReviewCount > 0
          ? "border-amber-200 bg-amber-50"
          : "border-emerald-200 bg-emerald-50"
  const selectionHeadline =
    selectedCandidateIds.length === 0
      ? "No workspaces selected"
      : selectedHighRiskCount === selectedCandidateIds.length
        ? "Selection is mostly cleanup-safe"
        : selectedHighRiskCount > 0 || selectedNeedsReviewCount > 0
          ? "Selection includes mixed-quality records"
          : "Selection looks like active candidates"
  const selectionGuidance =
    selectedCandidateIds.length === 0
      ? "Use the quick actions panel to select likely test or stale records before deleting anything."
      : selectedHighRiskCount === selectedCandidateIds.length
        ? "These selected workspaces are missing multiple core fields and are the safest group to review for cleanup."
        : selectedHighRiskCount > 0 || selectedNeedsReviewCount > 0
          ? "Double-check this mixed selection before deleting because some records may still be recoverable."
          : "These records appear complete. Only delete them if you are intentionally clearing real candidate data."
  const failedApiCalls = overview.recent_api_usage.filter((item) => item.status.toLowerCase() !== "success")
  const costlyApiCalls = overview.recent_api_usage.filter((item) => Number(item.estimated_cost_usd ?? 0) >= 0.02)
  const topFeatureActivity = overview.events_by_type[0] ?? null
  const topApiCostFeature = [...overview.costs_by_feature].sort((a, b) => b.cost - a.cost)[0] ?? null
  const latestSignupDay = signupTrend[signupTrend.length - 1]?.value ?? 0
  const priorSignupDay = signupTrend[signupTrend.length - 2]?.value ?? 0
  const latestApiDay = apiRequestTrend[apiRequestTrend.length - 1]?.value ?? 0
  const priorApiDay = apiRequestTrend[apiRequestTrend.length - 2]?.value ?? 0
  const latestCostDay = apiCostTrend[apiCostTrend.length - 1]?.value ?? 0
  const priorCostDay = apiCostTrend[apiCostTrend.length - 2]?.value ?? 0
  const recentActivityModuleCounts = Object.entries(
    overview.recent_activity.reduce<Record<string, number>>((acc, item) => {
      const key = formatModuleName(item.module)
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
  const recentApiStatusCounts = [
    { label: "Successful", value: overview.recent_api_usage.filter((item) => item.status.toLowerCase() === "success").length, tone: "success" as const },
    { label: "Needs attention", value: failedApiCalls.length, tone: "danger" as const },
    { label: "Higher-cost", value: costlyApiCalls.length, tone: "warning" as const },
  ]
  const executiveAdminSignals = [
    {
      label: "Growth health",
      value: latestSignupDay >= priorSignupDay ? "Stable / rising" : "Softer today",
      detail:
        latestSignupDay >= priorSignupDay
          ? "Recent signup pace is holding or improving."
          : "Recent signup pace dipped versus the prior day.",
      tone: latestSignupDay >= priorSignupDay ? "success" as const : "warning" as const,
    },
    {
      label: "Usage pressure",
      value: latestApiDay >= priorApiDay ? "High activity" : "Cooling slightly",
      detail:
        latestApiDay >= priorApiDay
          ? "API request volume is holding or rising."
          : "API activity is slightly below the prior day.",
      tone: latestApiDay >= priorApiDay ? "info" as const : "neutral" as const,
    },
    {
      label: "Cost pressure",
      value: latestCostDay > priorCostDay ? "Rising cost" : "Stable cost",
      detail:
        latestCostDay > priorCostDay
          ? "Cost is climbing faster in the latest day."
          : "Cost is steady or easing versus the previous day.",
      tone: latestCostDay > priorCostDay ? "warning" as const : "success" as const,
    },
    {
      label: "Workspace hygiene",
      value: candidateQualityBuckets.likelyReady >= candidateQualityBuckets.likelyTest ? "Healthy" : "Needs cleanup",
      detail:
        candidateQualityBuckets.likelyReady >= candidateQualityBuckets.likelyTest
          ? "More candidate records look usable than incomplete."
          : "Incomplete or test-style candidate records are starting to dominate.",
      tone: candidateQualityBuckets.likelyReady >= candidateQualityBuckets.likelyTest ? "success" as const : "warning" as const,
    },
  ]
  const executiveHeadline =
    latestSignupDay >= priorSignupDay && latestApiDay >= priorApiDay && latestCostDay <= priorCostDay
      ? "Platform momentum is healthy and cost is under control."
      : latestCostDay > priorCostDay && latestApiDay >= priorApiDay
        ? "Usage is growing, but cost pressure needs closer monitoring."
        : candidateQualityBuckets.likelyReady < candidateQualityBuckets.likelyTest
          ? "Adoption is moving, but workspace cleanup now matters more."
          : "The platform is active, with a few watch-points worth reviewing."
  const executiveSubheadline =
    topApiCostFeature
      ? `${topApiCostFeature.feature} is currently the highest-cost workflow, while ${topFeatureActivity?.label || "recent activity"} is leading engagement.`
      : `${topFeatureActivity?.label || "Recent activity"} is leading engagement in the current sample.`
  const executiveSnapshotItems = [
    {
      label: "Growth",
      value: latestSignupDay >= priorSignupDay ? "Stable or rising" : "Softer today",
      toneClass: latestSignupDay >= priorSignupDay ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-950",
      href: "#acquisition-snapshot",
    },
    {
      label: "Usage",
      value: latestApiDay >= priorApiDay ? "Demand holding" : "Slight cooldown",
      toneClass: latestApiDay >= priorApiDay ? "border-sky-200 bg-sky-50 text-sky-950" : "border-neutral-200 bg-white text-neutral-900",
      href: "#recent-activity",
    },
    {
      label: "Cost",
      value: latestCostDay > priorCostDay ? "Pressure rising" : "Within range",
      toneClass: latestCostDay > priorCostDay ? "border-amber-200 bg-amber-50 text-amber-950" : "border-emerald-200 bg-emerald-50 text-emerald-900",
      href: "#api-usage-by-feature",
    },
    {
      label: "Cleanup",
      value: candidateQualityBuckets.likelyReady >= candidateQualityBuckets.likelyTest ? "Healthy mix" : "Needs attention",
      toneClass:
        candidateQualityBuckets.likelyReady >= candidateQualityBuckets.likelyTest
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-rose-200 bg-rose-50 text-rose-900",
      href: "#candidate-workspace-manager",
    },
  ]
  const executiveWatchlist = [
    failedApiCalls.length > 0
      ? {
          label: "API failures",
          value: `${failedApiCalls.length} recent failures`,
          detail: "Recent API calls are failing and may need investigation.",
          toneClass: "border-rose-200 bg-rose-50 text-rose-900",
          href: "#recent-api-calls",
        }
      : null,
    costlyApiCalls.length > 0
      ? {
          label: "Cost watch",
          value: `${costlyApiCalls.length} higher-cost calls`,
          detail: "Heavy workflows are appearing in the recent sample.",
          toneClass: "border-amber-200 bg-amber-50 text-amber-950",
          href: "#recent-api-calls",
        }
      : null,
    topApiCostFeature
      ? {
          label: "Highest-cost feature",
          value: topApiCostFeature.feature,
          detail: `$${topApiCostFeature.cost.toFixed(4)} estimated in the current sample.`,
          toneClass: "border-sky-200 bg-sky-50 text-sky-950",
          href: "#api-usage-by-feature",
        }
      : null,
    candidateQualityBuckets.likelyReady < candidateQualityBuckets.likelyTest
      ? {
          label: "Cleanup pressure",
          value: `${candidateQualityBuckets.likelyTest} likely stale records`,
          detail: "Incomplete candidate records are starting to outweigh healthy ones.",
          toneClass: "border-amber-200 bg-amber-50 text-amber-950",
          href: "#candidate-workspace-manager",
        }
      : null,
  ].filter((item): item is { label: string; value: string; detail: string; toneClass: string; href: string } => Boolean(item))
  const leadingAgentModule = agentQuality?.by_module?.[0] ?? null
  const agentHotspot = agentQuality?.hotspots?.[0] ?? null
  const agentPromptSamples = (agentQuality?.top_prompts ?? []).slice(0, 4)
  const agentRecentNotes = (agentQuality?.recent_notes ?? []).slice(0, 3)
  const agentQualityToneClass =
    (agentQuality?.summary.needs_attention_percent ?? 0) >= 40
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : (agentQuality?.summary.needs_attention_percent ?? 0) >= 20
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-emerald-200 bg-emerald-50 text-emerald-900"

  const quickLinks = [
    { sectionKey: "dashboard-overview", href: "#dashboard-overview", label: "1. Overview" },
    { sectionKey: "openai-usage", href: "#openai-usage", label: "2. OpenAI usage" },
    { sectionKey: "unit-economics", href: "#unit-economics", label: "3. Unit economics" },
    { sectionKey: "operating-signals", href: "#operating-signals", label: "4. Operating signals" },
    { sectionKey: "acquisition-snapshot", href: "#acquisition-snapshot", label: "5. Acquisition" },
    { sectionKey: "feature-activity", href: "#feature-activity", label: "6. Feature activity" },
    { sectionKey: "api-usage-by-feature", href: "#api-usage-by-feature", label: "7. API insights" },
    { sectionKey: "agent-quality", href: "#agent-quality", label: "8. Agent quality" },
    { sectionKey: "community-moderation", href: "#community-moderation", label: "9. Community moderation" },
    { sectionKey: "tester-feedback", href: "#tester-feedback", label: "10. Tester feedback" },
    { sectionKey: "access-control", href: "#access-control", label: "11. Access control" },
    { sectionKey: "admin-notebook", href: "#admin-notebook", label: "12. Notebook" },
    { sectionKey: "candidate-workspace-manager", href: "#candidate-workspace-manager", label: "13. Workspace manager" },
    { sectionKey: "dashboard-help", href: "#dashboard-help", label: "14. Help & to-do" },
  ]
  const sectionSubmenuLinks: Record<string, Array<{ label: string; sectionKey: string; href: string }>> = {
    "dashboard-overview": [
      { label: "Platform pulse", sectionKey: "dashboard-overview", href: "#dashboard-overview" },
      { label: "Executive watchlist", sectionKey: "dashboard-overview", href: "#dashboard-overview" },
    ],
    "dashboard-help": [
      { label: "How to read this dashboard", sectionKey: "dashboard-help", href: "#dashboard-help" },
    ],
    "openai-usage": [
      { label: "Daily and monthly", sectionKey: "openai-usage", href: "#openai-usage" },
      { label: "Budget guardrail", sectionKey: "openai-usage", href: "#openai-usage" },
    ],
    "unit-economics": [
      { label: "Revenue vs API cost", sectionKey: "unit-economics", href: "#unit-economics" },
      { label: "User margin watchlist", sectionKey: "unit-economics", href: "#unit-economics" },
    ],
    "operating-signals": [
      { label: "Operating ratios", sectionKey: "operating-signals", href: "#operating-signals" },
      { label: "Data quality", sectionKey: "operating-signals", href: "#operating-signals" },
      { label: "Superuser console", sectionKey: "operating-signals", href: "#operating-signals" },
    ],
    "acquisition-snapshot": [
      { label: "Acquisition snapshot", sectionKey: "acquisition-snapshot", href: "#acquisition-snapshot" },
      { label: "Recent signups", sectionKey: "acquisition-snapshot", href: "#recent-signups" },
    ],
    "feature-activity": [
      { label: "Feature activity", sectionKey: "feature-activity", href: "#recent-activity" },
      { label: "Activity trend", sectionKey: "feature-activity", href: "#feature-activity" },
    ],
    "api-usage-by-feature": [
      { label: "Module performance", sectionKey: "api-usage-by-feature", href: "#api-usage-by-feature" },
      { label: "Recent API calls", sectionKey: "api-usage-by-feature", href: "#recent-api-calls" },
    ],
    "agent-quality": [
      { label: "Helpfulness trend", sectionKey: "agent-quality", href: "#agent-quality" },
      { label: "Low-quality hotspots", sectionKey: "agent-quality", href: "#agent-quality" },
    ],
    "community-moderation": [
      { label: "Moderation queue", sectionKey: "community-moderation", href: "#community-moderation" },
      { label: "Featured highlights", sectionKey: "community-moderation", href: "#community-moderation" },
    ],
    "tester-feedback": [
      { label: "Open bugs and notes", sectionKey: "tester-feedback", href: "#tester-feedback" },
      { label: "Location context", sectionKey: "tester-feedback", href: "#tester-feedback" },
    ],
    "candidate-workspace-manager": [
      { label: "Workspace manager", sectionKey: "candidate-workspace-manager", href: "#candidate-workspace-manager" },
      { label: "Cleanup actions", sectionKey: "candidate-workspace-manager", href: "#candidate-workspace-manager" },
    ],
    "access-control": [
      { label: "Role assignments", sectionKey: "access-control", href: "#access-control" },
      { label: "Current admins", sectionKey: "access-control", href: "#access-control" },
    ],
    "admin-notebook": [
      { label: "New idea capture", sectionKey: "admin-notebook", href: "#admin-notebook" },
      { label: "Saved enhancements", sectionKey: "admin-notebook", href: "#admin-notebook" },
    ],
  }
  const activeSubmenuLinks = sectionSubmenuLinks[activeSection] ?? []
  const activeSectionLabel = quickLinks.find((link) => link.sectionKey === activeSection)?.label?.replace(/^\d+\.\s*/, "") || "Overview"
  const activeSubsectionLabel =
    activeSubmenuLinks.find((item) => item.href === activeAnchor)?.label ||
    activeSubmenuLinks[0]?.label ||
    "Overview"
  const workflowMapSections = quickLinks.map((link) => ({
    ...link,
    items: sectionSubmenuLinks[link.sectionKey] ?? [],
  }))
  const dashboardRailGroups = [
    {
      title: "Core",
      links: quickLinks.filter((link) =>
        ["dashboard-overview", "openai-usage", "unit-economics", "operating-signals"].includes(link.sectionKey)
      ),
    },
    {
      title: "Activity",
      links: quickLinks.filter((link) =>
        ["acquisition-snapshot", "feature-activity", "api-usage-by-feature", "agent-quality"].includes(link.sectionKey)
      ),
    },
    {
      title: "Control",
      links: quickLinks.filter((link) =>
        ["community-moderation", "tester-feedback", "access-control", "admin-notebook", "candidate-workspace-manager"].includes(link.sectionKey)
      ),
    },
    {
      title: "Help",
      links: quickLinks.filter((link) => ["dashboard-help"].includes(link.sectionKey)),
    },
  ]

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-7">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Link href="/" className="text-sm font-medium text-neutral-500 hover:text-neutral-900">
              Platform home
            </Link>
            <Link href="/control-center/marketing-engine" className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100 sm:text-[11px]">
              Marketing engine
            </Link>
            <Link href="/operations" className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100 sm:text-[11px]">
              Operations monitor
            </Link>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.reload()
                }
              }}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100 sm:text-[11px]"
            >
              Refresh data
            </button>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#0f172a] sm:text-[2.6rem]">Admin dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm text-neutral-600">
            Monitor adoption across Persona Generator and Career Intelligence, review user growth, and track AI usage and cost through a more visual operating dashboard.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside data-sticky-nav="true" className="h-fit rounded-2xl border border-[#d8e4f2] bg-[linear-gradient(180deg,#fcfdff_0%,#f4f8fc_100%)] p-3 shadow-sm xl:sticky xl:top-3">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5b6b7c]">Dashboard menu</div>
            <div className="mt-1 text-[11px] text-neutral-600">
              Current: <span className="font-semibold text-neutral-800">{activeSectionLabel}</span> /{" "}
              <span className="font-semibold text-neutral-800">{activeSubsectionLabel}</span>
            </div>
            <div className="mt-3 space-y-2">
              {dashboardRailGroups.map((group) => (
                <details key={`admin-rail-${group.title}`} open className="rounded-xl border border-neutral-200 bg-white">
                  <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-600">
                    {group.title}
                  </summary>
                  <div className="px-2 pb-2">
                    {group.links.map((link) => (
                      <button
                        key={`admin-rail-link-${link.sectionKey}`}
                        type="button"
                        onClick={() => openAndScroll(link.sectionKey, link.href)}
                        className={`mb-1 w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold transition ${
                          activeSection === link.sectionKey
                            ? "border-sky-300 bg-sky-100 text-sky-900"
                            : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
                        }`}
                      >
                        {link.label}
                      </button>
                    ))}
                  </div>
                </details>
              ))}
            </div>
            <details className="mt-2 rounded-xl border border-neutral-200 bg-white" open={showAdvancedTools}>
              <summary
                className="cursor-pointer list-none px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-600"
                onClick={(event) => {
                  event.preventDefault()
                  setShowAdvancedTools((current) => !current)
                }}
              >
                Advanced tools
              </summary>
              {showAdvancedTools ? (
                <div className="px-2 pb-2">
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAllSectionsCollapsed(true)}
                      className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                    >
                      Collapse all
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllSectionsCollapsed(false)}
                      className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                    >
                      Expand all
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowWorkflowMap((current) => !current)}
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                        showWorkflowMap ? "border-sky-300 bg-sky-50 text-sky-800" : "border-neutral-300 bg-white text-neutral-700"
                      }`}
                    >
                      {showWorkflowMap ? "Map on" : "Map off"}
                    </button>
                  </div>
                  {showWorkflowMap ? (
                    <div className="space-y-2">
                      {workflowMapSections.map((section) => (
                        <div key={`admin-rail-map-${section.sectionKey}`} className="rounded-lg border border-neutral-200 bg-neutral-50 p-2">
                          <button
                            type="button"
                            onClick={() => openAndScroll(section.sectionKey, section.href)}
                            className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-left text-[11px] font-semibold text-neutral-700 hover:bg-neutral-100"
                          >
                            {section.label}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </details>
          </aside>

          <div className="min-w-0">

          <section id="dashboard-overview" className="scroll-mt-24 mb-4 overflow-hidden rounded-[2rem] border border-[#d9e2ec] bg-[linear-gradient(135deg,#ffffff_0%,#eff6ff_34%,#eef2ff_100%)] p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#536471]">Overview</div>
            <button
              type="button"
              onClick={() => toggleSection("dashboard-overview")}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
            >
              {collapsedSections["dashboard-overview"] ? "Expand" : "Collapse"}
            </button>
          </div>
          {collapsedSections["dashboard-overview"] ? (
            <p className="text-sm text-neutral-600">Platform pulse and executive watchlist are collapsed.</p>
          ) : (
            <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[#536471]">Platform pulse</div>
              <h2 className="mt-2 text-[1.8rem] font-semibold tracking-tight text-[#0f172a]">A clearer operating view of growth, activity, and cost</h2>
              <p className="mt-2 text-sm leading-6 text-[#475569]">
                Use this view to spot adoption trends, understand where usage is concentrating, and keep the platform tidy by removing stale test workspaces when needed.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <PulseCard label="Activation rate" value={`${Math.round(safePercent(overview.totals.active_users, overview.totals.total_users))}%`} hint="Active users vs total users" />
              <PulseCard label="Cost per request" value={`$${safeDivision(overview.totals.estimated_cost_usd, overview.totals.total_api_requests).toFixed(4)}`} hint="Estimated AI cost per API request" />
            </div>
          </div>
          <div className="mt-4 grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-white/80 bg-white/80 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#536471]">Executive summary</div>
              <div className="mt-2 text-[1.9rem] font-semibold tracking-tight text-[#0f172a] leading-tight">{executiveHeadline}</div>
              <p className="mt-2 text-sm leading-6 text-[#475569]">{executiveSubheadline}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
              {executiveSnapshotItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className={`rounded-2xl border px-3 py-3 transition hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2] focus:ring-offset-2 ${item.toneClass}`}
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">{item.label}</div>
                  <div className="mt-1 text-lg font-semibold">{item.value}</div>
                  <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">Open section</div>
                </a>
              ))}
            </div>
          </div>
          <div className="mt-3">
            {executiveWatchlist.length === 0 ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                No immediate watchlist issues are standing out in the current sample.
              </div>
            ) : (
              <div className="grid gap-2 xl:grid-cols-4">
                {executiveWatchlist.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className={`rounded-2xl border px-3 py-3 transition hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2] focus:ring-offset-2 ${item.toneClass}`}
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">{item.label}</div>
                    <div className="mt-1 text-base font-semibold">{item.value}</div>
                    <div className="mt-1 text-sm leading-5 opacity-90">{item.detail}</div>
                    <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">Jump to section</div>
                  </a>
                ))}
              </div>
            )}
          </div>
            </>
          )}
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
          <MetricCard label="Total users" value={String(overview.totals.total_users)} />
          <MetricCard label="Active users" value={String(overview.totals.active_users)} />
          <MetricCard label="Candidates" value={String(overview.totals.total_candidates)} />
          <MetricCard label="Saved profiles" value={String(overview.totals.total_saved_profiles)} />
          <MetricCard label="API requests" value={String(overview.totals.total_api_requests)} />
          <MetricCard label="Tokens" value={overview.totals.total_tokens.toLocaleString()} />
          <MetricCard label="Est. cost (USD)" value={overview.totals.estimated_cost_usd.toFixed(4)} />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MiniSignalCard
            label="Candidates created today"
            value={String(overview.totals.candidates_created_today ?? 0)}
            hint="New workspaces opened since midnight"
          />
          <MiniSignalCard
            label="Support queue"
            value={String(overview.totals.support_queue ?? 0)}
            hint="Failed runs + failed API calls (last 24h)"
          />
          <MiniSignalCard
            label="Failed runs (24h)"
            value={String(overview.totals.failed_runs_24h ?? 0)}
            hint="Background + live job runs in failed state"
          />
          <MiniSignalCard
            label="Archived candidates"
            value={String(overview.totals.deleted_candidates ?? 0)}
            hint="Soft-deleted and restorable for 7 days"
          />
        </div>

          <section id="dashboard-help" className="scroll-mt-24 mt-4 rounded-3xl border border-[#d8e4f2] bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#536471]">Help and to-do</div>
            <button
              type="button"
              onClick={() => toggleSection("dashboard-help")}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
            >
              {collapsedSections["dashboard-help"] ? "Expand" : "Collapse"}
            </button>
          </div>
          {collapsedSections["dashboard-help"] ? (
            <p className="text-sm text-neutral-600">Help and next-action checklist is collapsed.</p>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <MiniSignalCard
                  label="Overview"
                  value="Business pulse"
                  hint="Read this first for user growth, API demand, and workspace quality signals."
                />
                <MiniSignalCard
                  label="OpenAI usage"
                  value="Cost control"
                  hint="Track daily/monthly spend and compare with your target budget guardrail."
                />
                <MiniSignalCard
                  label="Acquisition + activity"
                  value="Adoption health"
                  hint="See who is signing up, which providers they use, and where product engagement clusters."
                />
                <MiniSignalCard
                  label="Access + workspace manager"
                  value="Operations"
                  hint="Manage admin roles, ownership visibility, and archive/restore candidate workspaces safely."
                />
                <MiniSignalCard
                  label="To do now"
                  value="Run weekly admin sweep"
                  hint="Review alerts, access changes, and stale candidate cleanup each week."
                />
              </div>
              <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Auth diagnostics</div>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  {(authProviderStatus.length > 0 ? authProviderStatus : [
                    { key: "google", label: "Google", enabled: false, reason: "Status unavailable" },
                    { key: "facebook", label: "Facebook", enabled: false, reason: "Status unavailable" },
                    { key: "linkedin_oidc", label: "LinkedIn", enabled: false, reason: "Status unavailable" },
                  ]).map((provider) => (
                    <div key={`auth-${provider.key}`} className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-neutral-900">{provider.label}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                            provider.enabled
                              ? "border border-emerald-300 bg-emerald-50 text-emerald-700"
                              : "border border-amber-300 bg-amber-50 text-amber-800"
                          }`}
                        >
                          {provider.enabled ? "Enabled" : "Not configured"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">{provider.reason || "Ready to use."}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Auth setup checklist</div>
                  <ol className="mt-2 space-y-2 text-sm text-neutral-700">
                    <li>1. Supabase to Authentication to Providers: enable the provider and save client ID/secret.</li>
                    <li>
                      2. Provider app callback URL:
                      <span className="ml-1 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[12px]">
                        https://usqafbuamrfslltsfdsi.supabase.co/auth/v1/callback
                      </span>
                    </li>
                    <li>
                      3. Supabase to Authentication to URL Configuration: add
                      <span className="ml-1 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[12px]">
                        {platformUrl}
                      </span>
                      <span className="ml-1 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[12px]">
                        {careerIntelligenceUrl}
                      </span>
                    </li>
                    <li>
                      4. Keep env flags aligned with readiness in
                      <span className="ml-1 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[12px]">.env.local</span>
                      :
                      <span className="ml-1 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[12px]">NEXT_PUBLIC_AUTH_PROVIDER_*_ENABLED</span>
                    </li>
                    <li>5. Restart dev server after env changes and verify status is green in this panel.</li>
                  </ol>
                </div>
              </div>
            </>
          )}
        </section>

          <section id="openai-usage" className="scroll-mt-24 mt-4 rounded-3xl border border-sky-200 bg-[linear-gradient(180deg,#f8fbff_0%,#edf6ff_100%)] p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">OpenAI usage</div>
            <button
              type="button"
              onClick={() => toggleSection("openai-usage")}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
            >
              {collapsedSections["openai-usage"] ? "Expand" : "Collapse"}
            </button>
          </div>
          {collapsedSections["openai-usage"] ? (
            <p className="text-sm text-sky-950">Cost visibility, budget guardrails, and usage trend cards are collapsed.</p>
          ) : (
            <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Actual OpenAI usage</div>
              <h2 className="mt-2 text-xl font-semibold text-[#0f172a]">Daily and monthly OpenAI cost visibility</h2>
              <p className="mt-2 text-sm leading-6 text-sky-950">
                This panel uses OpenAI&apos;s organization usage and costs APIs when `OPENAI_ADMIN_KEY` is configured. The rest of the dashboard still shows Persona Foundry&apos;s own telemetry so you can compare the two.
              </p>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-white px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Source</div>
              <div className="mt-1 text-sm font-semibold text-sky-950">{openAIUsage7d.available ? "OpenAI org API" : "Telemetry fallback"}</div>
            </div>
          </div>

          {openAIUsage7d.available ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MiniSignalCard label="Today cost" value={`$${openAIUsageDaily.total_cost_usd.toFixed(4)}`} hint={`Actual OpenAI spend for the last ${openAIUsageDaily.window_days} day`} />
              <MiniSignalCard label="Today tokens" value={openAIUsageDaily.total_tokens.toLocaleString()} hint="Actual daily token usage" />
              <MiniSignalCard label="30-day cost" value={`$${openAIUsageMonthly.total_cost_usd.toFixed(4)}`} hint="Actual OpenAI spend for the last 30 days" />
              <MiniSignalCard label="30-day tokens" value={openAIUsageMonthly.total_tokens.toLocaleString()} hint="Actual monthly token usage" />
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
              {openAIUsage7d.error || "OpenAI organization usage is not available yet."} Add `OPENAI_ADMIN_KEY` to `.env.local` if you want this dashboard to show real OpenAI account usage.
            </div>
          )}

          {openAIUsage7d.available ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MiniSignalCard label="7-day cost" value={`$${openAIUsage7d.total_cost_usd.toFixed(4)}`} hint="Actual OpenAI spend for the last 7 days" />
              <MiniSignalCard label="7-day requests" value={openAIUsage7d.total_requests.toLocaleString()} hint="OpenAI-reported request count" />
              <MiniSignalCard label="7-day input tokens" value={openAIUsage7d.input_tokens.toLocaleString()} hint="Prompt tokens from OpenAI" />
              <MiniSignalCard label="7-day output tokens" value={openAIUsage7d.output_tokens.toLocaleString()} hint="Completion tokens from OpenAI" />
            </div>
          ) : null}

          {usageMismatch ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
              OpenAI is reporting more usage than Persona Foundry telemetry has recorded. That usually means some earlier requests happened before telemetry logging was enabled, or some runs were not written into `api_usage_logs`.
            </div>
          ) : null}

          <div className="mt-3 grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
            <section className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Spend control</div>
                  <h3 className="mt-2 text-lg font-semibold text-[#0f172a]">Budget-style view of OpenAI burn rate</h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">
                    Use these numbers to judge whether current usage patterns are sustainable before costs creep up unnoticed.
                  </p>
                </div>
                <div className={`rounded-2xl border px-4 py-3 ${
                  spendGuardrailTone === "warning"
                    ? "border-amber-200 bg-amber-50"
                    : spendGuardrailTone === "info"
                      ? "border-sky-200 bg-sky-50"
                      : spendGuardrailTone === "success"
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-neutral-200 bg-neutral-50"
                }`}>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Projected 30-day run rate</div>
                  <div className="mt-1 text-2xl font-semibold text-neutral-900">${projected30DayOpenAICost.toFixed(2)}</div>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <MiniSignalCard label="Daily burn" value={`$${averageDailyOpenAICost.toFixed(4)}`} hint="Average OpenAI spend per day from the last 7 days" />
                <MiniSignalCard label="Daily tokens" value={averageDailyOpenAITokens.toLocaleString()} hint="Average daily token usage from the last 7 days" />
                <MiniSignalCard label="Monthly burn" value={`$${openAIUsageMonthly.total_cost_usd.toFixed(4)}`} hint="Actual OpenAI spend over the last 30 days" />
              </div>
              <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Monthly budget guardrail</div>
                    <div className="mt-2 text-sm leading-6 text-neutral-600">
                      {openAIMonthlyBudget
                        ? "Compare actual OpenAI spend against your target and the current 30-day run rate so you can intervene early."
                        : "Add `OPENAI_MONTHLY_BUDGET_USD` to `.env.local` to turn on budget guardrails for this dashboard."}
                    </div>
                    <div className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                      Budget source: {overview.budget.source === "database" ? "Dashboard setting" : overview.budget.source === "environment" ? "Environment variable" : "Not set"}
                    </div>
                  </div>
                  {openAIMonthlyBudget ? (
                    <div
                      className={`rounded-2xl border px-4 py-3 ${
                        budgetGuardrailTone === "warning"
                          ? "border-amber-200 bg-amber-50"
                          : budgetGuardrailTone === "info"
                            ? "border-sky-200 bg-sky-50"
                            : budgetGuardrailTone === "success"
                              ? "border-emerald-200 bg-emerald-50"
                              : "border-neutral-200 bg-white"
                      }`}
                    >
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Budget status</div>
                      <div className="mt-1 text-lg font-semibold text-neutral-900">
                        {projected30DayOpenAICost >= openAIMonthlyBudget
                          ? "Projected to exceed target"
                          : projected30DayOpenAICost >= openAIMonthlyBudget * 0.75
                            ? "Approaching target"
                            : "On track"}
                      </div>
                    </div>
                  ) : null}
                </div>

                {openAIMonthlyBudget ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <MiniSignalCard label="Budget target" value={`$${openAIMonthlyBudget.toFixed(2)}`} hint="Configured monthly OpenAI budget" />
                    <MiniSignalCard label="Budget used" value={`${monthlyBudgetUsedPercent}%`} hint={`Actual monthly spend is $${openAIUsageMonthly.total_cost_usd.toFixed(2)}`} />
                    <MiniSignalCard
                      label="Projected usage"
                      value={`${projectedBudgetUsedPercent}%`}
                      hint={`Projected 30-day run rate is $${projected30DayOpenAICost.toFixed(2)}`}
                    />
                    <MiniSignalCard
                      label={projectedBudgetVariance !== null && projectedBudgetVariance > 0 ? "Projected overrun" : "Budget remaining"}
                      value={`$${Math.abs(projectedBudgetVariance !== null && projectedBudgetVariance > 0 ? projectedBudgetVariance : remainingMonthlyBudget ?? 0).toFixed(2)}`}
                      hint={
                        projectedBudgetVariance !== null && projectedBudgetVariance > 0
                          ? "Projected overspend versus your monthly target"
                          : "Remaining headroom before reaching the monthly target"
                      }
                    />
                  </div>
                ) : null}

                {overview.permissions.is_superuser ? (
                  <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="min-w-[220px] flex-1">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Change monthly budget</div>
                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          value={budgetDraft}
                          onChange={(event) => setBudgetDraft(event.target.value)}
                          className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/20"
                          placeholder="100.00"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void handleSaveBudget()}
                        disabled={isSavingBudget}
                        className="rounded-2xl bg-[#0a66c2] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#004182] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSavingBudget ? "Saving..." : "Save budget"}
                      </button>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-neutral-600">
                      Saving here overrides the `.env.local` value for the dashboard and lets you adjust budget without a restart.
                    </p>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Cost interpretation</div>
              <div className="mt-3 space-y-3 text-sm leading-6 text-neutral-700">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  Today&apos;s cost shows immediate spend pressure if a heavy workflow suddenly starts firing.
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  The 30-day cost shows what OpenAI has actually billed across the last month-long window.
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  The projected 30-day run rate estimates what this month could cost if the recent 7-day pattern keeps holding.
                </div>
              </div>
            </section>
          </div>
            </>
          )}
        </section>

        <section id="unit-economics" className="scroll-mt-24 mt-4 rounded-3xl border border-[#d8e4f2] bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#536471]">Unit economics</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadEconomics()}
                className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => toggleSection("unit-economics")}
                className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                {collapsedSections["unit-economics"] ? "Expand" : "Collapse"}
              </button>
            </div>
          </div>
          {collapsedSections["unit-economics"] ? (
            <p className="text-sm text-neutral-600">Per-user monthly revenue vs API cost guardrails are collapsed.</p>
          ) : loadingEconomics ? (
            <p className="text-sm text-neutral-600">Loading unit economics...</p>
          ) : economics ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <MiniSignalCard label="Month" value={economics.month_label} hint="Current reporting window" />
                <MiniSignalCard label="Revenue" value={`$${economics.summary.total_revenue_usd.toFixed(2)}`} hint="Monthly subscription value" />
                <MiniSignalCard label="API cost" value={`$${economics.summary.total_api_cost_usd.toFixed(4)}`} hint="Estimated monthly model spend" />
                <MiniSignalCard label="Net margin" value={`$${economics.summary.total_margin_usd.toFixed(4)}`} hint={`${economics.summary.unprofitable_users} unprofitable users`} />
              </div>
              <div className="mt-3 rounded-2xl border border-neutral-200 bg-white p-3">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-[0.12em] text-neutral-500">
                      <tr>
                        <th className="px-2 py-2">User</th>
                        <th className="px-2 py-2">Plan</th>
                        <th className="px-2 py-2">Revenue</th>
                        <th className="px-2 py-2">API cost</th>
                        <th className="px-2 py-2">Margin</th>
                        <th className="px-2 py-2">Budget status</th>
                        <th className="px-2 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {economics.users.slice(0, 30).map((row) => (
                        <tr key={`economics-${row.user_id}`} className="border-t border-neutral-200">
                          <td className="px-2 py-2">
                            <div className="font-semibold text-neutral-900">{row.user_name}</div>
                            <div className="text-xs text-neutral-500">{row.user_email || row.user_id}</div>
                          </td>
                          <td className="px-2 py-2">{row.plan_code}</td>
                          <td className="px-2 py-2">${row.monthly_subscription_usd.toFixed(2)}</td>
                          <td className="px-2 py-2">${row.monthly_api_cost_usd.toFixed(4)}</td>
                          <td className={`px-2 py-2 font-semibold ${row.monthly_margin_usd >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                            ${row.monthly_margin_usd.toFixed(4)}
                          </td>
                          <td className="px-2 py-2">
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                              row.budget_status === "over_budget"
                                ? "border-rose-300 bg-rose-50 text-rose-700"
                                : row.budget_status === "watch"
                                  ? "border-amber-300 bg-amber-50 text-amber-800"
                                  : "border-emerald-300 bg-emerald-50 text-emerald-700"
                            }`}>
                              {row.budget_status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            {overview.permissions.is_superuser ? (
                              editingSubscriptionUserId === row.user_id ? (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <input
                                    value={subscriptionDraftRevenue}
                                    onChange={(event) => setSubscriptionDraftRevenue(event.target.value)}
                                    className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-xs"
                                    placeholder="Revenue"
                                  />
                                  <input
                                    value={subscriptionDraftBudget}
                                    onChange={(event) => setSubscriptionDraftBudget(event.target.value)}
                                    className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-xs"
                                    placeholder="Budget"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => void handleSaveSubscription(row.user_id)}
                                    disabled={savingSubscription}
                                    className="rounded-md border border-[#0a66c2] bg-[#0a66c2] px-2 py-1 text-xs font-semibold text-white hover:bg-[#004182] disabled:opacity-60"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingSubscriptionUserId("")}
                                    className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSubscriptionUserId(row.user_id)
                                    setSubscriptionDraftRevenue(String(row.monthly_subscription_usd))
                                    setSubscriptionDraftBudget(row.monthly_api_budget_usd === null ? "" : String(row.monthly_api_budget_usd))
                                  }}
                                  className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
                                >
                                  Edit
                                </button>
                              )
                            ) : (
                              <span className="text-xs text-neutral-500">View only</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-neutral-600">Unit economics data not available yet.</p>
          )}
        </section>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {executiveAdminSignals.map((signal) => (
            <ExecutiveAdminSignalCard
              key={signal.label}
              label={signal.label}
              value={signal.value}
              detail={signal.detail}
              tone={signal.tone}
            />
          ))}
        </div>

          <section id="operating-signals" className="scroll-mt-24 mt-4 rounded-3xl border border-[#d8e4f2] bg-[linear-gradient(180deg,#ffffff_0%,#f7fafe_100%)] p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#536471]">Operating signals</div>
            <button
              type="button"
              onClick={() => toggleSection("operating-signals")}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
            >
              {collapsedSections["operating-signals"] ? "Expand" : "Collapse"}
            </button>
          </div>
          {collapsedSections["operating-signals"] ? (
            <p className="text-sm text-neutral-600">Efficiency, data quality, and superuser signal cards are collapsed.</p>
          ) : (
            <div className="grid gap-3 xl:grid-cols-3">
          <section className="rounded-3xl border border-[#d8e4f2] bg-[linear-gradient(180deg,#ffffff_0%,#f7fafe_100%)] p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Operating ratios</h2>
                <p className="mt-2 text-sm text-neutral-600">Fast signals for efficiency, engagement, and data quality.</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Data quality</div>
                <div className="mt-1 text-2xl font-semibold">{candidateProfileCompleteness}%</div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-1">
              <MiniSignalCard label="Tokens per request" value={averageTokensPerRequest.toFixed(0)} hint="Average model usage per API call" />
              <MiniSignalCard label="Cost per active user" value={`$${costPerActiveUser.toFixed(4)}`} hint="Estimated AI cost against currently active users" />
              <MiniSignalCard label="Profile completion" value={`${candidateProfileCompleteness}%`} hint="Based on name, city, and goal coverage" />
            </div>
          </section>

          <section className="rounded-3xl border border-[#d8e4f2] bg-[linear-gradient(180deg,#ffffff_0%,#f7fafe_100%)] p-4 shadow-sm">
            <h2 className="text-xl font-semibold">Candidate data quality</h2>
            <p className="mt-2 text-sm text-neutral-600">Shows how complete the current candidate directory is for core fields.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
              <RingStat label="Names present" value={candidateNameCoverage} hint={`${namedCandidateCount} of ${overview.candidate_directory.length} candidates`} tone="neutral" />
              <RingStat label="Goals present" value={candidateGoalCoverage} hint={`${candidateWithGoalCount} of ${overview.candidate_directory.length} candidates`} tone="success" />
              <RingStat label="Cities present" value={candidateCityCoverage} hint={`${candidateWithCityCount} of ${overview.candidate_directory.length} candidates`} tone="info" />
            </div>
          </section>

          <section className="rounded-3xl border border-[#d8e4f2] bg-[linear-gradient(180deg,#ffffff_0%,#f7fafe_100%)] p-4 shadow-sm">
            <h2 className="text-xl font-semibold">Superuser console</h2>
            <p className="mt-2 text-sm text-neutral-600">Keep the system tidy by tracking stale records and acting on selected candidate workspaces.</p>
            <div className="mt-4 space-y-3">
              <SnapshotRow label="Selected workspaces" value={String(selectedCandidateIds.length)} />
              <SnapshotRow label="Untitled candidates" value={String(overview.candidate_directory.filter((candidate) => !candidate.full_name).length)} />
              <SnapshotRow label="Missing goals" value={String(overview.candidate_directory.filter((candidate) => !candidate.primary_goal).length)} />
              <SnapshotRow label="Missing cities" value={String(overview.candidate_directory.filter((candidate) => !candidate.city).length)} />
            </div>
            <div className={`mt-4 rounded-2xl border p-4 text-sm text-neutral-700 ${selectionTone}`}>
              <div className="font-semibold text-neutral-900">{selectionHeadline}</div>
              <div className="mt-2">{selectionGuidance}</div>
              {selectedCandidateIds.length === 0 ? null : (
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
                  <span className="rounded-full bg-white px-3 py-1 text-rose-700">{selectedHighRiskCount} high-risk</span>
                  <span className="rounded-full bg-white px-3 py-1 text-amber-700">{selectedNeedsReviewCount} review-first</span>
                  <span className="rounded-full bg-white px-3 py-1 text-emerald-700">
                    {Math.max(0, selectedCandidateIds.length - selectedHighRiskCount - selectedNeedsReviewCount)} healthy
                  </span>
                </div>
              )}
              {selectedCandidateIds.length === 0 ? null : (
                <div className="mt-3 text-neutral-700">
                  Selected: {selectedCandidateNames.join(", ")}
                  {selectedCandidateIds.length > selectedCandidateNames.length ? ` and ${selectedCandidateIds.length - selectedCandidateNames.length} more.` : "."}
                </div>
              )}
            </div>
          </section>
            </div>
          )}
        </section>

        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          <section id="acquisition-snapshot" className="scroll-mt-24 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm h-full">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Acquisition</div>
              <button
                type="button"
                onClick={() => toggleSection("acquisition-snapshot")}
                className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                {collapsedSections["acquisition-snapshot"] ? "Expand" : "Collapse"}
              </button>
            </div>
            {collapsedSections["acquisition-snapshot"] ? (
              <p className="text-sm text-neutral-600">Signup and activation summary is collapsed.</p>
            ) : (
              <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Acquisition snapshot</h2>
                <p className="mt-2 text-sm text-neutral-600">A simple narrative layer for how adoption is moving.</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Current story</div>
                <div className="mt-1 text-sm font-semibold text-neutral-900">
                  {latestSignupDay >= priorSignupDay ? "Signup momentum holding" : "Signup pace softer today"}
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-3 text-sm text-neutral-700">
              <SnapshotRow label="User base" value={`${overview.totals.total_users} total users`} />
              <SnapshotRow label="Activation" value={`${overview.totals.active_users} users with tracked activity`} />
              <SnapshotRow label="Career usage" value={`${overview.totals.total_candidates} candidate workspaces created`} />
              <SnapshotRow label="AI footprint" value={`${overview.totals.total_api_requests} requests and ${overview.totals.total_tokens.toLocaleString()} tokens`} />
            </div>
            <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
              {latestSignupDay >= priorSignupDay
                ? "Recent signup momentum is stable or improving compared with the previous day in the current 7-day view."
                : "Recent signup momentum is softer than the previous day, so acquisition messaging or conversion points may need review."}
            </div>
              </>
            )}
          </section>

          <section id="feature-activity" className="scroll-mt-24 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm h-full">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Feature activity</div>
              <button
                type="button"
                onClick={() => toggleSection("feature-activity")}
                className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                {collapsedSections["feature-activity"] ? "Expand" : "Collapse"}
              </button>
            </div>
            {collapsedSections["feature-activity"] ? (
              <p className="text-sm text-neutral-600">Provider distribution is collapsed.</p>
            ) : (
              <>
            <h2 className="text-xl font-semibold">Signup providers</h2>
            <div className="mt-4 space-y-3">
              {overview.provider_breakdown.map((item) => (
                <BarRow
                  key={item.provider}
                  label={formatProvider(item.provider)}
                  value={item.value}
                  maxValue={Math.max(...overview.provider_breakdown.map((entry) => entry.value), 1)}
                />
              ))}
            </div>
              </>
            )}
          </section>

          <section id="api-usage-by-feature" className="scroll-mt-24 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm h-full">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">API insights</div>
              <button
                type="button"
                onClick={() => toggleSection("api-usage-by-feature")}
                className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                {collapsedSections["api-usage-by-feature"] ? "Expand" : "Collapse"}
              </button>
            </div>
            {collapsedSections["api-usage-by-feature"] ? (
              <p className="text-sm text-neutral-600">Module performance breakdown is collapsed.</p>
            ) : (
              <>
            <h2 className="text-xl font-semibold">Module performance</h2>
            <div className="mt-4 space-y-3">
              {overview.module_summary.map((item) => (
                <StackedMetricCard
                  key={item.module}
                  label={formatModuleName(item.module)}
                  value={`${item.api_requests} API calls`}
                  subvalue={`${item.events} events | ${item.tokens.toLocaleString()} tokens | $${item.cost.toFixed(4)}`}
                  percent={safePercent(item.api_requests, Math.max(...overview.module_summary.map((entry) => entry.api_requests), 1))}
                />
              ))}
            </div>
              </>
            )}
          </section>
        </div>

        <section id="agent-quality" className="scroll-mt-24 mt-4 rounded-3xl border border-[#d8e4f2] bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] p-3 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#536471]">Agent quality</div>
              <div className="mt-1 text-[11px] text-neutral-600">Experience Assistant quality in one compact view</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadAgentQuality()}
                className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => toggleSection("agent-quality")}
                className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                {collapsedSections["agent-quality"] ? "Expand" : "Collapse"}
              </button>
            </div>
          </div>
          {collapsedSections["agent-quality"] ? (
            <p className="text-sm text-neutral-600">Agent quality signals are collapsed.</p>
          ) : loadingAgentQuality ? (
            <p className="text-sm text-neutral-600">Loading agent quality signals...</p>
          ) : !agentQuality ? (
            <p className="text-sm text-neutral-600">Agent quality data is not available yet.</p>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <CompactStatChip label="Helpful" value={`${agentQuality.summary.helpful_percent}%`} toneClass="border-emerald-200 bg-emerald-50 text-emerald-900" />
                <CompactStatChip label="Needs attention" value={`${agentQuality.summary.needs_attention_percent}%`} toneClass="border-amber-200 bg-amber-50 text-amber-900" />
                <CompactStatChip label="Rated sessions" value={String(agentQuality.summary.sessions_with_feedback)} toneClass="border-sky-200 bg-sky-50 text-sky-900" />
                <CompactStatChip
                  label="Feedback entries"
                  value={`${agentQuality.summary.feedback_count} (${agentQuality.window_days}d)`}
                  toneClass="border-neutral-200 bg-neutral-50 text-neutral-800"
                />
              </div>

              <div className="mt-3 grid gap-3 xl:grid-cols-3">
                <div className={`rounded-2xl border p-4 ${agentQualityToneClass}`}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em]">Leading module</div>
                  <div className="mt-2 text-base font-semibold">{leadingAgentModule ? formatModuleName(leadingAgentModule.module) : "No module data"}</div>
                  <p className="mt-1 text-xs">
                    {leadingAgentModule
                      ? `${leadingAgentModule.feedback_count} ratings | ${leadingAgentModule.helpful_percent}% helpful`
                      : "No feedback has been captured yet."}
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em]">Top hotspot</div>
                  <div className="mt-2 text-base font-semibold">{agentHotspot ? formatModuleName(agentHotspot.module) : "No hotspot yet"}</div>
                  <p className="mt-1 text-xs">
                    {agentHotspot
                      ? `${agentHotspot.needs_attention} of ${agentHotspot.feedback_count} ratings need attention (${agentHotspot.needs_attention_percent}%).`
                      : "No low-quality clusters have appeared."}
                  </p>
                  {agentHotspot ? <p className="mt-1 text-[11px]">{agentHotspot.route_path}</p> : null}
                </div>
                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-950">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em]">Common asks</div>
                  <div className="mt-2 space-y-1 text-xs">
                    {agentPromptSamples.length === 0 ? (
                      <p>No prompt pattern data yet.</p>
                    ) : (
                      agentPromptSamples.map((item, index) => (
                        <p key={`agent-prompt-${index}`} className="truncate">
                          {item.count}x {item.prompt}
                        </p>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {false ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-950">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em]">Recent low-rating notes</div>
                  <div className="mt-2 space-y-2">
                    {agentRecentNotes.map((item, index) => (
                      <div key={`agent-note-${index}`} className="rounded-xl border border-rose-200 bg-white/80 px-3 py-2 text-sm">
                        <div className="font-semibold">{formatModuleName(item.module)} · {item.route_path}</div>
                        <div className="mt-1">{item.note}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-3 grid gap-3 xl:grid-cols-2">
                <details className="rounded-2xl border border-neutral-200 bg-white p-3" open>
                  <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
                    Module breakdown
                  </summary>
                  <div className="mt-2 space-y-2">
                    {(agentQuality.by_module ?? []).slice(0, 5).map((item) => (
                      <div key={`agent-module-${item.module}`} className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-xs">
                        <div className="font-semibold text-neutral-900">{formatModuleName(item.module)}</div>
                        <div className="mt-1 text-neutral-700">
                          {item.helpful_percent}% helpful | {item.feedback_count} ratings
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
                <details className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-rose-950" open={agentRecentNotes.length > 0}>
                  <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.14em]">Recent low-rating notes</summary>
                  {agentRecentNotes.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {agentRecentNotes.map((item, index) => (
                        <div key={`agent-note-${index}`} className="rounded-lg border border-rose-200 bg-white/80 px-2.5 py-2 text-xs">
                          <div className="font-semibold">{formatModuleName(item.module)} | {item.route_path}</div>
                          <div className="mt-1">{item.note}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs">No notes captured yet.</p>
                  )}
                </details>
              </div>
            </>
          )}
        </section>

        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <section id="recent-activity" className="scroll-mt-24 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Recent activity</h2>
                <p className="mt-2 text-sm text-neutral-600">Shows where user actions are concentrating right now.</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Top feature</div>
                <div className="mt-1 text-sm font-semibold text-neutral-900">
                  {topFeatureActivity ? `${topFeatureActivity.label} (${topFeatureActivity.value})` : "No events yet"}
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {overview.events_by_type.map((item) => (
                <BarRow
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  maxValue={Math.max(...overview.events_by_type.map((entry) => entry.value), 1)}
                />
              ))}
            </div>
          </section>

          <section id="recent-api-calls" className="scroll-mt-24 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Recent API calls</h2>
                <p className="mt-2 text-sm text-neutral-600">Highlights where model traffic and cost are clustering.</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Highest cost feature</div>
                <div className="mt-1 text-sm font-semibold text-neutral-900">
                  {topApiCostFeature ? `${topApiCostFeature.feature} ($${topApiCostFeature.cost.toFixed(4)})` : "No API cost yet"}
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {overview.costs_by_feature.map((item) => (
                <StackedMetricCard
                  key={item.feature}
                  label={item.feature}
                  value={`${item.requests} requests`}
                  subvalue={`${item.tokens.toLocaleString()} tokens | $${item.cost.toFixed(4)}`}
                  percent={safePercent(item.requests, Math.max(...overview.costs_by_feature.map((entry) => entry.requests), 1))}
                />
              ))}
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <ActionAlertCard
            title="Failed API calls"
            value={String(failedApiCalls.length)}
            description="Recent calls that did not complete successfully and may need investigation."
            tone={failedApiCalls.length > 0 ? "danger" : "success"}
            href="#recent-api-calls"
          />
          <ActionAlertCard
            title="Higher-cost API calls"
            value={String(costlyApiCalls.length)}
            description="Recent calls with unusually high estimated cost so you can spot heavy workflows quickly."
            tone={costlyApiCalls.length > 0 ? "warning" : "success"}
            href="#recent-api-calls"
          />
          <ActionAlertCard
            title="Most active feature"
            value={topFeatureActivity ? topFeatureActivity.label : "None"}
            description={topFeatureActivity ? `${topFeatureActivity.value} tracked events in the current sample.` : "No recent feature activity returned yet."}
            tone="info"
            href="#feature-activity"
          />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <TrendCard
            title="Signup trend"
            subtitle="Last 7 days"
            series={signupTrend}
            formatValue={(value) => `${value}`}
            summaryValue={`${latestSignupDay}`}
            summaryLabel={latestSignupDay >= priorSignupDay ? "Latest day signups holding or improving" : "Latest day signups softer than prior day"}
            tone={latestSignupDay >= priorSignupDay ? "success" : "warning"}
            insight={latestSignupDay >= priorSignupDay ? "Recent signup pace is holding or improving." : "Recent signup pace dipped versus the previous day."}
          />
          <TrendCard
            title="API request trend"
            subtitle="Last 7 days"
            series={apiRequestTrend}
            formatValue={(value) => `${value}`}
            summaryValue={`${latestApiDay}`}
            summaryLabel={latestApiDay >= priorApiDay ? "Demand is holding or rising" : "Usage has eased slightly"}
            tone={latestApiDay >= priorApiDay ? "info" : "neutral"}
            insight={latestApiDay >= priorApiDay ? "Product engagement is still active or rising." : "API usage cooled slightly in the latest day."}
          />
          <TrendCard
            title="Estimated cost trend"
            subtitle="Last 7 days"
            series={apiCostTrend}
            formatValue={(value) => `$${value.toFixed(4)}`}
            summaryValue={`$${latestCostDay.toFixed(4)}`}
            summaryLabel={latestCostDay > priorCostDay ? "Latest day cost is rising" : "Latest day cost is steady"}
            tone={latestCostDay > priorCostDay ? "warning" : "success"}
            insight={latestCostDay > priorCostDay ? "Cost is rising faster today, likely from heavier or more complex runs." : "Cost is steady or easing versus the previous day."}
          />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <section id="recent-signups" className="scroll-mt-24 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm xl:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Recent signups</h2>
                <p className="mt-2 text-sm text-neutral-600">
                  Shows recent authenticated users. Age is only displayed if you collect it in user metadata.
                </p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Tracked signups</div>
                <div className="mt-1 text-2xl font-semibold">{overview.recent_signups.length}</div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <MiniSignalCard label="Latest day signups" value={String(latestSignupDay)} hint="Most recent day in current trend window" />
              <MiniSignalCard label="Prior day signups" value={String(priorSignupDay)} hint="Previous day in current trend window" />
              <MiniSignalCard
                label="Signup direction"
                value={latestSignupDay >= priorSignupDay ? "Up / flat" : "Down"}
                hint="Quick read on whether acquisition momentum is improving"
              />
            </div>

            {overview.recent_signups.length === 0 ? (
              <p className="mt-4 text-sm text-neutral-500">No signup records returned yet.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2 text-sm">
                  <thead>
                    <tr className="text-left text-neutral-500">
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Email</th>
                      <th className="px-3 py-2 font-medium">Age</th>
                      <th className="px-3 py-2 font-medium">Providers</th>
                      <th className="px-3 py-2 font-medium">Signed up</th>
                      <th className="px-3 py-2 font-medium">Last sign-in</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recent_signups.map((user) => (
                      <tr key={user.id} className="rounded-2xl border border-neutral-200 bg-neutral-50">
                        <td className="rounded-l-2xl px-3 py-3 font-medium text-neutral-900">{user.name || "No name"}</td>
                        <td className="px-3 py-3 text-neutral-700">{user.email || "No email"}</td>
                        <td className="px-3 py-3 text-neutral-700">{user.age || "Not collected"}</td>
                        <td className="px-3 py-3 text-neutral-700">{user.providers.length > 0 ? user.providers.join(", ") : "Unknown"}</td>
                        <td className="px-3 py-3 text-neutral-700">{user.created_at ? new Date(user.created_at).toLocaleString() : "Unknown"}</td>
                        <td className="rounded-r-2xl px-3 py-3 text-neutral-700">{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "Unknown"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Recent activity</div>
              <button
                type="button"
                onClick={() => toggleSection("recent-activity")}
                className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                {collapsedSections["recent-activity"] ? "Expand" : "Collapse"}
              </button>
            </div>
            {collapsedSections["recent-activity"] ? (
              <p className="text-sm text-neutral-600">Latest platform event stream is collapsed.</p>
            ) : (
              <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Recent activity</h2>
                <p className="mt-2 text-sm text-neutral-600">Latest tracked user and system events across the platform.</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Events returned</div>
                <div className="mt-1 text-2xl font-semibold">{overview.recent_activity.length}</div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {recentActivityModuleCounts.length === 0 ? (
                <MiniSignalCard label="Activity mix" value="No data" hint="No recent module activity returned yet" />
              ) : (
                recentActivityModuleCounts.slice(0, 3).map((item) => (
                  <MiniSignalCard key={`activity-${item.label}`} label={item.label} value={String(item.value)} hint="Recent events in this module" />
                ))
              )}
            </div>
            {recentActivityModuleCounts.length > 0 ? (
              <div className="mt-4">
                <CompactBarPanel title="Where recent activity is clustering" items={recentActivityModuleCounts.slice(0, 4)} gradient="from-sky-500 to-indigo-500" />
              </div>
            ) : null}
            <div className="mt-4 space-y-3">
              {overview.recent_activity.map((item) => (
                <div key={item.id} className={`rounded-2xl border px-4 py-3 text-sm ${activityCardClass(item.event_type)}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{item.event_type}</span>
                    <span className="text-neutral-400">{new Date(item.created_at).toLocaleString()}</span>
                  </div>
                  <div className="mt-1 text-neutral-600">{item.module}</div>
                  <div className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
                    {formatModuleName(item.module)} activity
                  </div>
                </div>
              ))}
            </div>
              </>
            )}
          </section>

          <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Recent API calls</div>
              <button
                type="button"
                onClick={() => toggleSection("recent-api-calls")}
                className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                {collapsedSections["recent-api-calls"] ? "Expand" : "Collapse"}
              </button>
            </div>
            {collapsedSections["recent-api-calls"] ? (
              <p className="text-sm text-neutral-600">Recent model call diagnostics are collapsed.</p>
            ) : (
              <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Recent API calls</h2>
                <p className="mt-2 text-sm text-neutral-600">Use this to spot failed calls, expensive runs, and unusual model usage faster.</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Flagged calls</div>
                <div className="mt-1 text-2xl font-semibold">{failedApiCalls.length + costlyApiCalls.length}</div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {recentApiStatusCounts.map((item) => (
                <StatusMiniCard key={`api-${item.label}`} label={item.label} value={String(item.value)} tone={item.tone} />
              ))}
            </div>
            <div className="mt-4">
              <CompactBarPanel
                title="Most active API features in the recent sample"
                items={overview.costs_by_feature.slice(0, 4).map((item) => ({ label: item.feature, value: item.requests }))}
                gradient="from-emerald-500 to-sky-500"
              />
            </div>
            <div className="mt-4 space-y-3">
              {overview.recent_api_usage.map((item) => (
                <div key={item.id} className={`rounded-2xl border px-4 py-3 text-sm ${apiCallCardClass(item.status, Number(item.estimated_cost_usd ?? 0))}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{item.feature}</span>
                    <span className="text-neutral-400">{new Date(item.created_at).toLocaleString()}</span>
                  </div>
                  <div className="mt-1 text-neutral-600">
                    {item.model} | {item.status} | {(item.total_tokens ?? 0).toLocaleString()} tokens | ${Number(item.estimated_cost_usd ?? 0).toFixed(4)}
                  </div>
                  <div className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
                    {item.status.toLowerCase() !== "success"
                      ? "Needs attention"
                      : Number(item.estimated_cost_usd ?? 0) >= 0.02
                        ? "Higher-cost call"
                        : "Normal"}
                  </div>
                </div>
              ))}
            </div>
              </>
            )}
          </section>
        </div>

        <section
          id="community-moderation"
                className="mt-4 scroll-mt-24 rounded-3xl border border-[#d8e4f2] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-3 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#536471]">Community moderation</div>
            <button
              type="button"
              onClick={() => toggleSection("community-moderation")}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
            >
              {collapsedSections["community-moderation"] ? "Expand" : "Collapse"}
            </button>
          </div>
          {collapsedSections["community-moderation"] ? (
            <p className="text-sm text-neutral-600">Community moderation queue is collapsed.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-[1.25rem] font-semibold tracking-tight text-[#0f172a]">Community moderation queue</h2>
                  <p className="mt-2 text-sm text-neutral-600">
                    Review ideas and success stories, then feature or hide posts to keep Community helpful and on-brand.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <CompactStatChip label="Total posts" value={String(communityPosts.length)} toneClass="border-neutral-200 bg-neutral-50 text-neutral-800" />
                  <CompactStatChip label="Featured" value={String(communityPosts.filter((post) => post.is_featured).length)} toneClass="border-amber-200 bg-amber-50 text-amber-900" />
                  <CompactStatChip label="Hidden" value={String(communityPosts.filter((post) => post.status === "hidden").length)} toneClass="border-rose-200 bg-rose-50 text-rose-900" />
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
                {loadingCommunityPosts ? (
                  <p className="text-sm text-neutral-600">Loading moderation queue...</p>
                ) : communityPosts.length === 0 ? (
                  <p className="text-sm text-neutral-600">No community posts found yet.</p>
                ) : (
                  <div className="grid gap-3">
                    {communityPosts.slice(0, 80).map((post) => (
                      <div key={post.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="max-w-3xl">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                                {post.post_type === "idea" ? "Idea" : "Success story"}
                              </span>
                              <span className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                                {post.status}
                              </span>
                              {post.is_featured ? (
                                <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-800">
                                  Featured
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1.5 text-sm font-semibold text-neutral-900">{post.title}</div>
                            <div className="mt-1 text-xs text-neutral-600">{post.summary || post.body}</div>
                            <div className="mt-2 text-xs text-neutral-500">
                              {post.author_name || "Community member"} | {new Date(post.created_at).toLocaleString()} | Upvotes: {post.upvotes} | Comments: {post.comments}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/community?post=${post.id}`}
                              className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                            >
                              Open in Community
                            </Link>
                            <button
                              type="button"
                              onClick={() => void handleCommunityModeration(post.id, { is_featured: !post.is_featured })}
                              disabled={moderatingCommunityPostId === post.id}
                              className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {post.is_featured ? "Unfeature" : "Feature"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleCommunityModeration(post.id, { status: post.status === "hidden" ? "approved" : "hidden" })}
                              disabled={moderatingCommunityPostId === post.id}
                              className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {post.status === "hidden" ? "Unhide" : "Hide"}
                            </button>
                            {post.status !== "approved" ? (
                              <button
                                type="button"
                                onClick={() => void handleCommunityModeration(post.id, { status: "approved" })}
                                disabled={moderatingCommunityPostId === post.id}
                                className="rounded-full border border-[#0a66c2] bg-[#e8f3ff] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0a66c2] hover:bg-[#dcecff] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Approve
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        <section
          id="tester-feedback"
          className="mt-4 scroll-mt-24 rounded-3xl border border-[#d8e4f2] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-3 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#536471]">Tester feedback</div>
            <button
              type="button"
              onClick={() => toggleSection("tester-feedback")}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
            >
              {collapsedSections["tester-feedback"] ? "Expand" : "Collapse"}
            </button>
          </div>
          {collapsedSections["tester-feedback"] ? (
            <p className="text-sm text-neutral-600">Floating tester notes and bug triage are collapsed.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-[1.25rem] font-semibold tracking-tight text-[#0f172a]">Tester notes inbox</h2>
                  <p className="mt-2 text-sm text-neutral-600">
                    Notes submitted from the in-app feedback widget with route and section context for faster fixes.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <CompactStatChip label="Open" value={String(testerFeedbackNotes.filter((item) => item.status === "open").length)} toneClass="border-rose-200 bg-rose-50 text-rose-900" />
                  <CompactStatChip label="In review" value={String(testerFeedbackNotes.filter((item) => item.status === "in_review").length)} toneClass="border-amber-200 bg-amber-50 text-amber-900" />
                  <CompactStatChip label="Resolved" value={String(testerFeedbackNotes.filter((item) => item.status === "resolved").length)} toneClass="border-emerald-200 bg-emerald-50 text-emerald-900" />
                </div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
                <label className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
                  Status
                  <select
                    value={testerFeedbackStatusFilter}
                    onChange={(event) =>
                      setTesterFeedbackStatusFilter(event.target.value as "all" | "open" | "in_review" | "resolved")
                    }
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm font-medium normal-case text-neutral-800"
                  >
                    <option value="all">All statuses</option>
                    <option value="open">Open</option>
                    <option value="in_review">In review</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </label>
                <label className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
                  Severity
                  <select
                    value={testerFeedbackSeverityFilter}
                    onChange={(event) => setTesterFeedbackSeverityFilter(event.target.value as "all" | "low" | "medium" | "high")}
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm font-medium normal-case text-neutral-800"
                  >
                    <option value="all">All severities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>
                <label className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
                  Module
                  <select
                    value={testerFeedbackModuleFilter}
                    onChange={(event) => setTesterFeedbackModuleFilter(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm font-medium normal-case text-neutral-800"
                  >
                    <option value="all">All modules</option>
                    {testerFeedbackModuleOptions.map((option) => (
                      <option key={`tester-module-filter-${option}`} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="self-end rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700">
                  {filteredTesterFeedbackNotes.length} shown
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
                {loadingTesterFeedback ? (
                  <p className="text-sm text-neutral-600">Loading tester feedback...</p>
                ) : filteredTesterFeedbackNotes.length === 0 ? (
                  <p className="text-sm text-neutral-600">No tester feedback notes yet.</p>
                ) : (
                  <div className="grid gap-3">
                    {filteredTesterFeedbackNotes.slice(0, 120).map((note) => (
                      <div key={note.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="max-w-3xl">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                                {note.note_type}
                              </span>
                              <span className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                                {note.severity}
                              </span>
                              <span className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                                {note.status.replace("_", " ")}
                              </span>
                            </div>
                            <div className="mt-1.5 text-sm font-semibold text-neutral-900">{note.user_email || note.user_id}</div>
                            <div className="mt-1 text-xs text-neutral-700">{note.message}</div>
                            <div className="mt-2 text-xs text-neutral-500">
                              {note.module} | {note.route_path}
                              {note.section_anchor ? `#${note.section_anchor}` : ""} | {new Date(note.created_at).toLocaleString()}
                            </div>
                          </div>
                          <div className="flex min-w-[220px] flex-col gap-2">
                            <select
                              value={note.status}
                              onChange={(event) =>
                                void handleTesterFeedbackReview(note.id, {
                                  status: event.target.value as "open" | "in_review" | "resolved",
                                })
                              }
                              disabled={reviewingTesterFeedbackId === note.id}
                              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                            >
                              <option value="open">Open</option>
                              <option value="in_review">In review</option>
                              <option value="resolved">Resolved</option>
                            </select>
                            <select
                              value={note.severity}
                              onChange={(event) =>
                                void handleTesterFeedbackReview(note.id, {
                                  severity: event.target.value as "low" | "medium" | "high",
                                })
                              }
                              disabled={reviewingTesterFeedbackId === note.id}
                              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                            >
                              <option value="low">Low severity</option>
                              <option value="medium">Medium severity</option>
                              <option value="high">High severity</option>
                            </select>
                            {note.full_url ? (
                              <a
                                href={note.full_url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-xl border border-[#0a66c2] bg-[#e8f3ff] px-3 py-2 text-center text-sm font-medium text-[#0a66c2] hover:bg-[#dcecff]"
                              >
                                Open location
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {overview.permissions.is_superuser ? (
                <div className="mt-4 rounded-2xl border border-[#d8e4f2] bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-neutral-900">Send tester outreach email</h3>
                      <p className="mt-1 text-sm text-neutral-600">
                        Follow up with testers by audience (status/module) and keep campaign history.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadTesterOutreachCampaigns()}
                      className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                    >
                      Refresh campaigns
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
                      Audience status
                      <select
                        value={outreachStatusAudience}
                        onChange={(event) =>
                          setOutreachStatusAudience(event.target.value as "all" | "open" | "in_review" | "resolved")
                        }
                        className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium normal-case text-neutral-800"
                      >
                        <option value="open">Open notes</option>
                        <option value="in_review">In review notes</option>
                        <option value="resolved">Resolved notes</option>
                        <option value="all">All notes</option>
                      </select>
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
                      Audience module
                      <select
                        value={outreachModuleAudience}
                        onChange={(event) => setOutreachModuleAudience(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium normal-case text-neutral-800"
                      >
                        <option value="all">All modules</option>
                        {testerFeedbackModuleOptions.map((option) => (
                          <option key={`tester-outreach-module-${option}`} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-3 grid gap-3">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
                      Subject
                      <input
                        value={outreachSubjectDraft}
                        onChange={(event) => setOutreachSubjectDraft(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium normal-case text-neutral-800"
                        placeholder="Thanks for helping us improve Personara"
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
                      Message
                      <textarea
                        value={outreachMessageDraft}
                        onChange={(event) => setOutreachMessageDraft(event.target.value)}
                        className="mt-1 min-h-[100px] w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm normal-case text-neutral-800"
                        placeholder="Share updates, ask for more testing, or request a retest for a fixed issue."
                      />
                    </label>
                    <div>
                      <button
                        type="button"
                        onClick={() => void handleSendTesterOutreach()}
                        disabled={sendingOutreach}
                        className="rounded-xl border border-[#0a66c2] bg-[#0a66c2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#004182] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {sendingOutreach ? "Sending..." : "Send outreach"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
                      Recent outreach campaigns
                    </div>
                    {loadingTesterOutreachCampaigns ? (
                      <p className="mt-1 text-sm text-neutral-600">Loading campaigns...</p>
                    ) : testerOutreachCampaigns.length === 0 ? (
                      <p className="mt-1 text-sm text-neutral-600">No outreach campaigns yet.</p>
                    ) : (
                      <div className="mt-2 grid gap-2">
                        {testerOutreachCampaigns.slice(0, 8).map((campaign) => (
                          <div key={campaign.id} className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-sm font-semibold text-neutral-900">{campaign.subject}</div>
                              <div className="text-xs text-neutral-500">{new Date(campaign.created_at).toLocaleString()}</div>
                            </div>
                            <div className="mt-1 text-xs text-neutral-600">
                              {campaign.recipient_count} recipients | status {campaign.audience_status}
                              {campaign.audience_module ? ` | module ${campaign.audience_module}` : ""}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>

        <section
          id="access-control"
                className="mt-4 scroll-mt-24 rounded-3xl border border-[#d8e4f2] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#536471]">Access control</div>
            <button
              type="button"
              onClick={() => toggleSection("access-control")}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
            >
              {collapsedSections["access-control"] ? "Expand" : "Collapse"}
            </button>
          </div>
          {collapsedSections["access-control"] ? (
            <p className="text-sm text-neutral-600">Role assignment and permission controls are collapsed.</p>
          ) : (
            <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-[1.6rem] font-semibold tracking-tight text-[#0f172a]">User and role control center</h2>
              <p className="mt-2 text-sm text-neutral-600">
                Manage platform roles plus workflow access levels (viewer, editor, manager).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Active role assignments</div>
                <div className="mt-1 text-2xl font-semibold">{roleAssignments.length}</div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Access level assignments</div>
                <div className="mt-1 text-2xl font-semibold">{accessLevelAssignments.length}</div>
              </div>
            </div>
          </div>

          {!overview.permissions.is_superuser ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              Only superusers can change role assignments. You can still view overall dashboard analytics.
            </div>
          ) : (
            <>
              <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
                <div>
                  <label className="mb-1 block text-sm font-medium">User email</label>
                  <input
                    value={roleEmailDraft}
                    onChange={(event) => setRoleEmailDraft(event.target.value)}
                    className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                    placeholder="name@example.com"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Role</label>
                  <select
                    value={roleDraft}
                    onChange={(event) => setRoleDraft(event.target.value as "admin" | "support" | "superuser")}
                    className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="support">Support</option>
                    <option value="admin">Admin</option>
                    <option value="superuser">Superuser</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Action</label>
                  <select
                    value={roleActionDraft}
                    onChange={(event) => setRoleActionDraft(event.target.value as "grant" | "revoke")}
                    className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="grant">Grant role</option>
                    <option value="revoke">Revoke role</option>
                  </select>
                </div>
                <div className="md:self-end">
                  <button
                    type="button"
                    onClick={() => void handleRoleAssignmentSubmit()}
                    disabled={isUpdatingRoles}
                    className="w-full rounded-xl border border-[#0a66c2] bg-[#0a66c2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#004182] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isUpdatingRoles ? "Updating..." : "Apply"}
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
                <div>
                  <label className="mb-1 block text-sm font-medium">Access email</label>
                  <input
                    value={accessEmailDraft}
                    onChange={(event) => setAccessEmailDraft(event.target.value)}
                    className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                    placeholder="name@example.com"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Access level</label>
                  <select
                    value={accessLevelDraft}
                    onChange={(event) => setAccessLevelDraft(event.target.value as "viewer" | "editor" | "manager")}
                    className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="viewer">Viewer (read-only)</option>
                    <option value="editor">Editor (can update content)</option>
                    <option value="manager">Manager (can coordinate workflows)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Action</label>
                  <select
                    value={accessActionDraft}
                    onChange={(event) => setAccessActionDraft(event.target.value as "assign" | "revoke")}
                    className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="assign">Assign level</option>
                    <option value="revoke">Remove level</option>
                  </select>
                </div>
                <div className="md:self-end">
                  <button
                    type="button"
                    onClick={() => void handleAccessLevelSubmit()}
                    disabled={isUpdatingAccessLevels}
                    className="w-full rounded-xl border border-[#0a66c2] bg-[#0a66c2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#004182] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isUpdatingAccessLevels ? "Updating..." : "Apply"}
                  </button>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-4">
                {roleAssignments.length === 0 ? (
                  <p className="text-sm text-neutral-600">No database role assignments yet. Use the form above to add your first support/admin user.</p>
                ) : (
                  <div className="grid gap-2">
                    {roleAssignments.map((assignment) => (
                      <div key={assignment.user_id} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-neutral-900">{assignment.email || assignment.user_id}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {assignment.roles.map((role) => (
                              <span
                                key={`${assignment.user_id}-${role}`}
                                className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700"
                              >
                                {role}
                              </span>
                            ))}
                            {accessLevelByUserId.get(assignment.user_id) ? (
                              <span className="rounded-full border border-sky-300 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-sky-800">
                                {accessLevelByUserId.get(assignment.user_id)}
                              </span>
                            ) : (
                              <span className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                                no access level
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-neutral-500 break-all">User ID: {assignment.user_id}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-3 rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="text-sm font-semibold text-neutral-900">Access level directory</div>
                {accessLevelAssignments.length === 0 ? (
                  <p className="mt-2 text-sm text-neutral-600">No access level assignments yet.</p>
                ) : (
                  <div className="mt-3 grid gap-2">
                    {accessLevelAssignments.map((assignment) => (
                      <div key={`access-${assignment.user_id}`} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-neutral-900">{assignment.email || assignment.user_id}</div>
                          <span className="rounded-full border border-sky-300 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-sky-800">
                            {assignment.access_level}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900">Candidate ownership directory</h3>
                    <p className="mt-1 text-sm text-neutral-600">
                      Quickly find which signed-in users own candidate workspaces, then jump to those records.
                    </p>
                  </div>
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-right">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Owners</div>
                    <div className="mt-0.5 text-lg font-semibold text-neutral-900">{ownerDirectory.length}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="mb-1 block text-sm font-medium">Search owner</label>
                  <input
                    value={ownerSearch}
                    onChange={(event) => setOwnerSearch(event.target.value)}
                    className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                    placeholder="Search by name, email, or user ID"
                  />
                </div>
                {ownerDirectory.length === 0 ? (
                  <p className="mt-4 text-sm text-neutral-600">No owner records found for the current search.</p>
                ) : (
                  <div className="mt-4 grid gap-2">
                    {ownerDirectory.slice(0, 12).map((owner) => (
                      <div key={owner.userId} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-neutral-900">{owner.displayName}</div>
                            <div className="mt-1 text-xs text-neutral-500">{owner.email || owner.userId}</div>
                            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                              <span className="rounded-full border border-neutral-300 bg-white px-2 py-1">Total {owner.total}</span>
                              <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-1 text-emerald-700">Active {owner.active}</span>
                              <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-1 text-slate-700">Archived {owner.archived}</span>
                            </div>
                          </div>
                          <div className="flex min-w-[170px] flex-col gap-2">
                            {owner.latestActiveCandidateId ? (
                              <Link
                                href={`/career/${owner.latestActiveCandidateId}?view=owner-preview&owner=${encodeURIComponent(owner.userId)}`}
                                className="rounded-xl border border-[#0a66c2] bg-white px-3 py-2 text-center text-sm font-medium text-[#0a66c2] hover:bg-[#eef5fe]"
                              >
                                Open latest workspace
                              </Link>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => openOwnerWorkspace(owner)}
                              className="rounded-xl border border-[#0a66c2] bg-white px-3 py-2 text-sm font-medium text-[#0a66c2] hover:bg-[#eef5fe]"
                            >
                              Open workspaces
                            </button>
                            <Link
                              href={`/career?view=owner-preview&owner=${encodeURIComponent(owner.userId)}`}
                              className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-center text-sm font-medium text-sky-800 hover:bg-sky-100"
                            >
                              View as candidate
                            </Link>
                            <div className="text-[11px] text-neutral-500">
                              {owner.latestCreatedAt ? `Latest: ${new Date(owner.latestCreatedAt).toLocaleDateString()}` : "No created date"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {ownerDirectory.length > 12 ? (
                      <p className="text-xs text-neutral-500">Showing first 12 owners. Refine search to narrow the list.</p>
                    ) : null}
                  </div>
                )}
              </div>
            </>
          )}
            </>
          )}
        </section>

        <section
          id="admin-notebook"
                className="mt-4 scroll-mt-24 rounded-3xl border border-[#d8e4f2] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#536471]">Admin notebook</div>
            <button
              type="button"
              onClick={() => toggleSection("admin-notebook")}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
            >
              {collapsedSections["admin-notebook"] ? "Expand" : "Collapse"}
            </button>
          </div>
          {collapsedSections["admin-notebook"] ? (
            <p className="text-sm text-neutral-600">Enhancement notebook is collapsed.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-[1.6rem] font-semibold tracking-tight text-[#0f172a]">Future enhancement notebook</h2>
                  <p className="mt-2 text-sm text-neutral-600">
                    Capture product ideas as they occur, then track whether they are open, in progress, or done.
                  </p>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Saved ideas</div>
                  <div className="mt-1 text-2xl font-semibold">{notebookEntries.length}</div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                <div>
                  <label className="mb-1 block text-sm font-medium">Title (optional)</label>
                  <input
                    value={notebookTitleDraft}
                    onChange={(event) => setNotebookTitleDraft(event.target.value)}
                    className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                    placeholder="Recruiter matching insights panel"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Status</label>
                  <select
                    value={notebookStatusDraft}
                    onChange={(event) => setNotebookStatusDraft(event.target.value as "open" | "in_progress" | "done")}
                    className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              </div>

              <div className="mt-3">
                <label className="mb-1 block text-sm font-medium">Idea note</label>
                <textarea
                  value={notebookNoteDraft}
                  onChange={(event) => setNotebookNoteDraft(event.target.value)}
                  className="min-h-[120px] w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                  placeholder="Capture the enhancement idea, expected impact, and any implementation notes."
                />
              </div>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => void handleNotebookSubmit()}
                  disabled={isSavingNotebook || !notebookNoteDraft.trim()}
                  className="rounded-xl border border-[#0a66c2] bg-[#0a66c2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#004182] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingNotebook ? "Saving..." : "Save idea"}
                </button>
              </div>

              {notebookEntries.length === 0 ? (
                <p className="mt-4 text-sm text-neutral-600">No notebook entries yet. Save your first future enhancement above.</p>
              ) : (
                <div className="mt-4 grid gap-3">
                  {notebookEntries.slice(0, 30).map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-neutral-900">{entry.title || "Untitled idea"}</div>
                          <div className="mt-1 text-sm leading-6 text-neutral-700">{entry.note}</div>
                          <div className="mt-2 text-xs text-neutral-500">
                            {entry.author_email || "Unknown author"} | {entry.created_at ? new Date(entry.created_at).toLocaleString() : "Unknown date"}
                          </div>
                        </div>
                        <div className="min-w-[160px]">
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Status</label>
                          <select
                            value={entry.status}
                            onChange={(event) => void handleNotebookStatusUpdate(entry.id, event.target.value as "open" | "in_progress" | "done")}
                            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                          >
                            <option value="open">Open</option>
                            <option value="in_progress">In progress</option>
                            <option value="done">Done</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        <section
          id="candidate-workspace-manager"
                className="mt-4 scroll-mt-24 rounded-3xl border border-[#d8e4f2] bg-[linear-gradient(180deg,#ffffff_0%,#f7fafe_100%)] p-4 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#536471]">Workspace manager</div>
            <button
              type="button"
              onClick={() => toggleSection("candidate-workspace-manager")}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
            >
              {collapsedSections["candidate-workspace-manager"] ? "Expand" : "Collapse"}
            </button>
          </div>
          {collapsedSections["candidate-workspace-manager"] ? (
            <p className="text-sm text-neutral-600">Candidate search, cleanup and deletion controls are collapsed.</p>
          ) : (
            <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-[1.6rem] font-semibold tracking-tight text-[#0f172a]">Candidate workspace manager</h2>
              <p className="mt-2 text-sm text-neutral-600">
                Review existing candidate workspaces and remove old test profiles or stale data when needed.
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Candidate records</div>
              <div className="mt-1 text-2xl font-semibold">{filteredCandidates.length}</div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <TriageCard
              label="Likely ready"
              value={String(candidateQualityBuckets.likelyReady)}
              hint="Has name, city, and goal"
              tone="success"
            />
            <TriageCard
              label="Needs attention"
              value={String(candidateQualityBuckets.needsAttention)}
              hint="One core field is missing"
              tone="warning"
            />
            <TriageCard
              label="Likely test or stale"
              value={String(candidateQualityBuckets.likelyTest)}
              hint="One or more core fields missing"
              tone="danger"
            />
          </div>

          {actionMessage ? <p className="mt-4 text-sm text-neutral-700">{actionMessage}</p> : null}

          {!overview.permissions.is_superuser ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              Superuser deletion controls are hidden for this account. Add your email to `SUPERUSER_EMAILS` in `.env.local` to enable candidate cleanup.
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
            <div>
              <label className="mb-1 block text-sm font-medium">Search candidates</label>
              <input
                value={candidateSearch}
                onChange={(event) => setCandidateSearch(event.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                placeholder="Search by name, city, goal, or user ID"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Filter</label>
              <select
                value={candidateFilter}
                onChange={(event) => setCandidateFilter(event.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All candidates</option>
                <option value="active">Active only</option>
                <option value="archived">Archived only</option>
                <option value="ready">Ready profiles</option>
                <option value="likely-test">Likely test or stale</option>
                <option value="untitled">Untitled only</option>
                <option value="goal-missing">Goal missing</option>
                <option value="city-missing">City missing</option>
              </select>
            </div>
            {overview.permissions.is_superuser ? (
              <div className="md:self-end">
                <button
                  type="button"
                  onClick={() => void handleBulkDeleteCandidates()}
                  disabled={selectedCandidateIds.length === 0 || deletingCandidateId === "bulk"}
                  className="w-full rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingCandidateId === "bulk" ? "Archiving selected..." : `Archive selected (${selectedCandidateIds.length})`}
                </button>
              </div>
            ) : null}
          </div>

          {overview.permissions.is_superuser ? (
            <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
              <div className={`rounded-2xl border px-4 py-4 text-sm ${selectionTone}`}>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Deletion readiness</div>
                <div className="mt-2 text-lg font-semibold text-neutral-900">{selectionHeadline}</div>
                <div className="mt-2 text-neutral-700">{selectionGuidance}</div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCandidateIds(cleanupCandidateIds)}
                disabled={cleanupCandidateIds.length === 0 || deletingCandidateId === "bulk"}
                className="rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Select likely stale ({cleanupCandidateIds.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedCandidateIds([])}
                disabled={selectedCandidateIds.length === 0 || deletingCandidateId === "bulk"}
                className="rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear selection
              </button>
            </div>
          ) : null}

          {filteredCandidates.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-500">No candidate workspaces returned yet.</p>
          ) : (
            <div className="mt-4 grid gap-3">
              {filteredCandidates.map((candidate) => {
                const missingFields = [!candidate.full_name ? "name" : null, !candidate.city ? "city" : null, !candidate.primary_goal ? "goal" : null].filter(
                  (value): value is string => Boolean(value)
                )
                const toneClass =
                  candidate.deleted_at
                    ? "border-slate-300 bg-slate-50"
                    : missingFields.length >= 2
                    ? "border-rose-200 bg-rose-50"
                    : missingFields.length === 1
                      ? "border-amber-200 bg-amber-50"
                      : "border-emerald-200 bg-emerald-50"

                return (
                  <div key={candidate.id} className={`rounded-3xl border p-5 ${toneClass}`}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-semibold text-neutral-900">{candidate.full_name || "Untitled candidate"}</div>
                          <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                            {candidate.deleted_at
                              ? "Archived"
                              : missingFields.length === 0
                                ? "Ready"
                                : missingFields.length === 1
                                  ? "Needs attention"
                                  : "Likely test/stale"}
                          </span>
                        </div>
                        <div className="mt-2 grid gap-2 text-sm text-neutral-700 md:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">City</div>
                            <div className="mt-1">{candidate.city || "Missing"}</div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Primary goal</div>
                            <div className="mt-1">{candidate.primary_goal || "Missing"}</div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Created</div>
                            <div className="mt-1">{candidate.created_at ? new Date(candidate.created_at).toLocaleString() : "Unknown"}</div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Archive window</div>
                            <div className="mt-1">
                              {candidate.deleted_at
                                ? candidate.purge_after
                                  ? `Restorable until ${new Date(candidate.purge_after).toLocaleString()}`
                                  : "Archived"
                                : "Active"}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">User ID</div>
                            <div className="mt-1 break-all text-neutral-500">{candidate.user_id || "Unknown"}</div>
                          </div>
                        </div>
                        <div className="mt-3 text-sm text-neutral-600">
                          {candidate.deleted_at
                            ? "This workspace is archived and can be restored within the retention window."
                            : missingFields.length === 0
                            ? "This workspace looks complete enough to treat as a real candidate record."
                            : `Missing core fields: ${missingFields.join(", ")}.`}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                            {candidate.deleted_at
                              ? "Archived (7-day restore)"
                              : missingFields.length === 0
                                ? "Healthy record"
                                : missingFields.length === 1
                                  ? "Review before delete"
                                  : "High cleanup candidate"}
                          </span>
                          {!candidate.deleted_at ? missingFields.map((field) => (
                            <span
                              key={`${candidate.id}-${field}`}
                              className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-rose-700"
                            >
                              Missing {field}
                            </span>
                          )) : null}
                        </div>
                      </div>
                      <div className="flex min-w-[220px] flex-col gap-3">
                        {!candidate.deleted_at ? (
                          <Link
                            href={`/career/${candidate.id}${candidate.user_id ? `?view=owner-preview&owner=${encodeURIComponent(candidate.user_id)}` : ""}`}
                            className="rounded-xl border border-[#0a66c2] bg-white px-3 py-2 text-center text-sm font-medium text-[#0a66c2] hover:bg-[#eef5fe]"
                          >
                            Open workspace
                          </Link>
                        ) : null}
                        {!candidate.deleted_at && candidate.user_id ? (
                          <Link
                            href={`/career?view=owner-preview&owner=${encodeURIComponent(candidate.user_id)}`}
                            className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-center text-sm font-medium text-sky-800 hover:bg-sky-100"
                          >
                            View owner as candidate
                          </Link>
                        ) : null}
                        {overview.permissions.is_superuser && !candidate.deleted_at ? (
                          <label className="flex items-center gap-2 rounded-2xl border border-white/80 bg-white/80 px-3 py-2 text-sm text-neutral-700">
                            <input
                              type="checkbox"
                              checked={selectedCandidateIds.includes(candidate.id)}
                              onChange={() => toggleCandidateSelection(candidate.id)}
                              className="h-4 w-4 rounded border-neutral-300"
                            />
                            Select for bulk delete
                          </label>
                        ) : (
                          <div className="rounded-2xl border border-white/80 bg-white/80 px-3 py-2 text-sm text-neutral-500">View only</div>
                        )}
                        {overview.permissions.is_superuser && !candidate.deleted_at ? (
                          <button
                            type="button"
                            onClick={() => void handleDeleteCandidate(candidate.id, candidate.full_name)}
                            disabled={deletingCandidateId === candidate.id || deletingCandidateId === "bulk"}
                            className="rounded-xl border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingCandidateId === candidate.id ? "Archiving..." : "Archive candidate"}
                          </button>
                        ) : null}
                        {overview.permissions.is_superuser && candidate.deleted_at ? (
                          <button
                            type="button"
                            onClick={() => void handleRestoreCandidate(candidate.id, candidate.full_name)}
                            disabled={deletingCandidateId === candidate.id || deletingCandidateId === "bulk"}
                            className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingCandidateId === candidate.id ? "Restoring..." : "Restore candidate"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
            </>
          )}
        </section>
          </div>
        </div>
      </div>
      {toast ? (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 max-w-sm">
          <div
            className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-lg ${
              toast.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : toast.tone === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-900"
                  : "border-sky-200 bg-sky-50 text-sky-900"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm leading-6">{toast.message}</p>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="rounded-full border border-current/30 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] opacity-80 hover:opacity-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  )
}

function PulseCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-[#d9e2ec] bg-white/90 px-3 py-2.5 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-[#0f172a]">{value}</div>
      <div className="mt-1 text-xs text-[#475569]">{hint}</div>
    </div>
  )
}

function MiniSignalCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-neutral-900">{value}</div>
      <div className="mt-1 text-xs text-neutral-600">{hint}</div>
    </div>
  )
}

function CompactStatChip({ label, value, toneClass }: { label: string; value: string; toneClass: string }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${toneClass}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em]">{label}</div>
      <div className="mt-0.5 text-base font-semibold">{value}</div>
    </div>
  )
}

function ExecutiveAdminSignalCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: string
  detail: string
  tone: "success" | "warning" | "neutral" | "info"
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50"
        : tone === "info"
          ? "border-sky-200 bg-sky-50"
          : "border-neutral-200 bg-white"

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${toneClass}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-neutral-900">{value}</div>
      <div className="mt-1 text-xs leading-5 text-neutral-600">{detail}</div>
    </div>
  )
}

function RingStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: number
  hint: string
  tone: "neutral" | "success" | "info"
}) {
  const color =
    tone === "success"
      ? "#059669"
      : tone === "info"
        ? "#2563eb"
        : "#0f172a"

  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex items-center gap-4">
        <div
          className="grid h-16 w-16 place-items-center rounded-full"
          style={{
            background: `conic-gradient(${color} ${Math.max(0, Math.min(100, value))}%, #e5e7eb 0)`,
          }}
        >
          <div className="grid h-11 w-11 place-items-center rounded-full bg-white text-sm font-semibold text-neutral-900">
            {value}%
          </div>
        </div>
        <div>
          <div className="font-semibold text-neutral-900">{label}</div>
          <div className="mt-1 text-sm text-neutral-600">{hint}</div>
        </div>
      </div>
    </div>
  )
}

function TriageCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint: string
  tone: "success" | "warning" | "danger"
}) {
  const toneClass =
    tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800"

  return (
    <div className={`rounded-3xl border p-5 ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.16em]">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      <div className="mt-2 text-sm text-current/80">{hint}</div>
    </div>
  )
}

function ActionAlertCard({
  title,
  value,
  description,
  tone,
  href,
}: {
  title: string
  value: string
  description: string
  tone: "success" | "warning" | "danger" | "info"
  href?: string
}) {
  const toneClass =
    tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : tone === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-sky-200 bg-sky-50 text-sky-800"

  const content = (
    <>
      <div className="text-xs font-semibold uppercase tracking-[0.16em]">{title}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      <p className="mt-2 text-sm leading-6 text-current/80">{description}</p>
      {href ? <div className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-current/70">Open section</div> : null}
    </>
  )

  if (href) {
    return (
      <a
        href={href}
        className={`block rounded-3xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#0a66c2] focus:ring-offset-2 ${toneClass}`}
      >
        {content}
      </a>
    )
  }

  return <section className={`rounded-3xl border p-5 shadow-sm ${toneClass}`}>{content}</section>
}

function BarRow({ label, value, maxValue }: { label: string; value: number; maxValue: number }) {
  const width = safePercent(value, maxValue)
  return (
    <div className="rounded-2xl border border-neutral-200 px-4 py-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-neutral-900">{label}</span>
        <span className="font-semibold text-neutral-700">{value}</span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-neutral-200">
        <div className="h-full rounded-full bg-[linear-gradient(90deg,#0f172a_0%,#2563eb_100%)]" style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

function StackedMetricCard({
  label,
  value,
  subvalue,
  percent,
}: {
  label: string
  value: string
  subvalue: string
  percent: number
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-neutral-900">{label}</span>
        <span>{value}</span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-neutral-200">
        <div className="h-full rounded-full bg-[linear-gradient(90deg,#0f172a_0%,#14b8a6_100%)]" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-2 text-neutral-600">{subvalue}</div>
    </div>
  )
}

function StatusMiniCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: "success" | "warning" | "danger"
}) {
  const toneClass =
    tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800"

  return (
    <div className={`rounded-2xl border px-4 py-4 ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.16em]">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  )
}

function CompactBarPanel({
  title,
  items,
  gradient,
}: {
  title: string
  items: { label: string; value: number }[]
  gradient: string
}) {
  const maxValue = Math.max(...items.map((item) => item.value), 1)

  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">{title}</div>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <div className="text-sm text-neutral-500">No data in this sample yet.</div>
        ) : (
          items.map((item) => (
            <div key={`${title}-${item.label}`}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-neutral-900">{item.label}</span>
                <span className="font-semibold text-neutral-700">{item.value}</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white">
                <div className={`h-full rounded-full bg-gradient-to-r ${gradient}`} style={{ width: `${safePercent(item.value, maxValue)}%` }} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function TrendCard({
  title,
  subtitle,
  series,
  formatValue,
  summaryValue,
  summaryLabel,
  tone,
  insight,
}: {
  title: string
  subtitle: string
  series: { label: string; value: number }[]
  formatValue: (value: number) => string
  summaryValue: string
  summaryLabel: string
  tone: "success" | "warning" | "neutral" | "info"
  insight?: string
}) {
  const maxValue = Math.max(...series.map((item) => item.value), 1)
  const total = series.reduce((sum, item) => sum + item.value, 0)
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50"
        : tone === "info"
          ? "border-sky-200 bg-sky-50"
          : "border-neutral-200 bg-neutral-50"
  const accentClass =
    tone === "success"
      ? "text-emerald-900"
      : tone === "warning"
        ? "text-amber-950"
        : tone === "info"
          ? "text-sky-950"
          : "text-neutral-900"
  const barGradient =
    tone === "success"
      ? "bg-[linear-gradient(180deg,#10b981_0%,#065f46_100%)]"
      : tone === "warning"
        ? "bg-[linear-gradient(180deg,#f59e0b_0%,#92400e_100%)]"
        : tone === "info"
          ? "bg-[linear-gradient(180deg,#2563eb_0%,#0f172a_100%)]"
          : "bg-[linear-gradient(180deg,#94a3b8_0%,#334155_100%)]"

  return (
    <section className="rounded-3xl border border-[#d8e4f2] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-neutral-600">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Total</div>
          <div className="mt-1 text-2xl font-semibold">{formatValue(total)}</div>
        </div>
      </div>

      <div className={`mt-4 rounded-2xl border px-4 py-3 ${toneClass}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Latest day read</div>
            <div className={`mt-1 text-base font-semibold ${accentClass}`}>{summaryLabel}</div>
          </div>
          <div className={`text-xl font-semibold ${accentClass}`}>{summaryValue}</div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-7 items-end gap-3">
        {series.map((item) => (
          <div key={item.label} className="flex flex-col items-center gap-2">
            <div className="text-[11px] font-semibold text-neutral-500">{formatCompactValue(item.value)}</div>
            <div className="flex h-36 w-full items-end justify-center rounded-2xl bg-neutral-100 px-2 py-2">
              <div
                className={`w-full rounded-xl ${barGradient}`}
                style={{ height: `${Math.max(10, Math.round((item.value / maxValue) * 100))}%` }}
              />
            </div>
            <div className="text-xs font-medium text-neutral-600">{item.label}</div>
          </div>
        ))}
      </div>

      {insight ? <p className="mt-4 text-sm leading-6 text-neutral-600">{insight}</p> : null}
    </section>
  )
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3">
      <span className="text-neutral-500">{label}</span>
      <span className="font-semibold text-neutral-900">{value}</span>
    </div>
  )
}

function formatProvider(provider: string) {
  if (!provider) return "Unknown"
  return provider.charAt(0).toUpperCase() + provider.slice(1)
}

function formatModuleName(module: string) {
  if (!module) return "Unknown"
  return module
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function activityCardClass(eventType: string) {
  const normalized = eventType.toLowerCase()
  if (normalized.includes("failed") || normalized.includes("error")) {
    return "border-rose-200 bg-rose-50"
  }
  if (normalized.includes("generated") || normalized.includes("created")) {
    return "border-emerald-200 bg-emerald-50"
  }
  return "border-neutral-200 bg-neutral-50"
}

function apiCallCardClass(status: string, estimatedCostUsd: number) {
  if (status.toLowerCase() !== "success") {
    return "border-rose-200 bg-rose-50"
  }
  if (estimatedCostUsd >= 0.02) {
    return "border-amber-200 bg-amber-50"
  }
  return "border-neutral-200 bg-neutral-50"
}

function safePercent(value: number, total: number) {
  if (!total || total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)))
}

function safeDivision(value: number, total: number) {
  if (!total || total <= 0) return 0
  return value / total
}

function buildDailyTrend<T extends { created_at: string | null }>(
  items: T[],
  getValue: (item: T) => number
) {
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - (6 - index))
    return date
  })

  const totals = new Map(
    dates.map((date) => [date.toISOString().slice(0, 10), 0])
  )

  for (const item of items) {
    if (!item.created_at) continue
    const dateKey = new Date(item.created_at).toISOString().slice(0, 10)
    if (!totals.has(dateKey)) continue
    totals.set(dateKey, (totals.get(dateKey) ?? 0) + getValue(item))
  }

  return dates.map((date) => {
    const key = date.toISOString().slice(0, 10)
    return {
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      value: Number((totals.get(key) ?? 0).toFixed(4)),
    }
  })
}

function formatCompactValue(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  if (value === 0) return "0"
  if (value < 1) return value.toFixed(2)
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(2)
}
