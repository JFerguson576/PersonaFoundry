"use client"

import Link from "next/link"
import Image from "next/image"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import type { Session } from "@supabase/supabase-js"
import { PlatformModuleNav } from "@/components/navigation/PlatformModuleNav"
import { getAuthHeaders } from "@/lib/career-client"
import { supabase } from "@/lib/supabase"

type Policy = {
  id: string | null
  reserve_floor_amount: number
  reinvestment_rate_pct: number
  max_weekly_spend: number
  payback_target_days: number
  automation_mode: "manual" | "approval_gated"
  updated_by_email?: string | null
  updated_at?: string | null
}

type CashLedgerEntry = {
  id: string
  source: string
  event_type: string
  amount: number
  note: string | null
  occurred_at: string
  entered_by_email: string | null
}

type BudgetSnapshot = {
  id: string
  week_start: string
  collected_cash_7d: number
  cash_on_hand: number
  reserve_floor_amount: number
  safe_budget_weekly: number
  safe_budget_daily: number
  reserve_status: "healthy" | "watch" | "critical" | string
  computed_by_email: string | null
  computed_at: string
}

type Campaign = {
  id: string
  name: string
  channel: string
  status: string
  offer_label: string | null
  landing_url: string | null
  daily_budget: number
  targeting_notes: string | null
  owner_email: string | null
  created_at: string
  updated_at: string
}

type Recommendation = {
  id: string
  entity_type: string
  entity_id: string | null
  recommendation_type: string
  reason_codes_json: string[]
  metric_snapshot_json: Record<string, unknown>
  proposed_change_json: Record<string, unknown>
  status: string
  created_by_email: string | null
  approved_by_email: string | null
  approved_at: string | null
  applied_at: string | null
  rejected_at: string | null
  rejection_note: string | null
  created_at: string
  updated_at: string
}

type RecommendationApproval = {
  id: string
  recommendation_id: string
  decision: string
  decision_note: string | null
  requested_by_email: string | null
  assigned_to_email: string | null
  decided_at: string | null
  created_at: string
  updated_at: string
}

type RecommendationAudit = {
  id: string
  actor_email: string | null
  action_type: string
  entity_type: string
  entity_id: string
  metadata_json: Record<string, unknown>
  created_at: string
}

type MarketingAlert = {
  id: string
  alert_type: string
  severity: "watch" | "critical" | "info" | string
  message: string
  related_entity_type: string | null
  related_entity_id: string | null
  status: "open" | "acknowledged" | "resolved" | string
  metadata_json: Record<string, unknown>
  created_by_email: string | null
  resolved_by_email: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

type IntegrationHealth = {
  key: string
  label: string
  status: "connected" | "partial" | "not_configured" | string
  detail: string
}

const INTEGRATION_SETUP_GUIDES: Record<
  string,
  {
    envVars: string[]
    docsUrl: string
    quickNote: string
  }
> = {
  supabase: {
    envVars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
    docsUrl: "/help",
    quickNote: "Core platform data/auth service keys.",
  },
  stripe: {
    envVars: ["STRIPE_SECRET_KEY"],
    docsUrl: "https://stripe.com/docs/keys",
    quickNote: "Needed for billing and cash event sync.",
  },
  posthog: {
    envVars: ["NEXT_PUBLIC_POSTHOG_KEY or POSTHOG_API_KEY"],
    docsUrl: "https://posthog.com/docs",
    quickNote: "Needed for product and acquisition telemetry.",
  },
  resend: {
    envVars: ["RESEND_API_KEY", "CONTACT_FROM_EMAIL (recommended)", "MARKETING_ALERT_TO_EMAIL (optional)"],
    docsUrl: "https://resend.com/docs",
    quickNote: "Needed for critical alert email delivery.",
  },
  google_ads: {
    envVars: ["GOOGLE_ADS_DEVELOPER_TOKEN"],
    docsUrl: "https://developers.google.com/google-ads/api/docs/first-call/overview",
    quickNote: "Reporting adapter can be enabled after this token.",
  },
  meta: {
    envVars: ["FACEBOOK_APP_ID or FACEBOOK_CLIENT_ID"],
    docsUrl: "https://developers.facebook.com/docs/marketing-api",
    quickNote: "Meta marketing adapter setup.",
  },
  linkedin: {
    envVars: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
    docsUrl: "https://learn.microsoft.com/linkedin/marketing/",
    quickNote: "LinkedIn marketing adapter setup.",
  },
}

function formatMoney(value: number | null | undefined) {
  const amount = Number(value ?? 0)
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount)
}

function toneForReserve(status: string) {
  if (status === "critical") return "border-rose-200 bg-rose-50 text-rose-800"
  if (status === "watch") return "border-amber-200 bg-amber-50 text-amber-800"
  return "border-emerald-200 bg-emerald-50 text-emerald-800"
}

export function MarketingEngineClient() {
  const MARKETING_LAYOUT_PREFS_KEY = "personara-marketing-layout-v1"
  const panelDefaults = {
    playbooks: false,
    recommendations: false,
    alerts: false,
    integrations: true,
    checklist: true,
    blueprint: true,
    campaigns: false,
    policy: true,
    ledger: false,
  } as const

  const [session, setSession] = useState<Session | null>(null)
  const [message, setMessage] = useState("")
  const [isBusy, setIsBusy] = useState(false)
  const [isSavingPolicy, setIsSavingPolicy] = useState(false)
  const [isSavingLedger, setIsSavingLedger] = useState(false)
  const [isRecomputing, setIsRecomputing] = useState(false)
  const [isValidatingEnv, setIsValidatingEnv] = useState(false)
  const [isRunningPlaybook, setIsRunningPlaybook] = useState("")
  const [showBlueprintModal, setShowBlueprintModal] = useState(false)
  const [collapsedPanels, setCollapsedPanels] = useState<Record<keyof typeof panelDefaults, boolean>>(panelDefaults)

  const [policy, setPolicy] = useState<Policy | null>(null)
  const [policyDraft, setPolicyDraft] = useState({
    reserve_floor_amount: "2000",
    reinvestment_rate_pct: "0.3",
    max_weekly_spend: "1200",
    payback_target_days: "120",
    automation_mode: "manual" as "manual" | "approval_gated",
  })

  const [ledger, setLedger] = useState<CashLedgerEntry[]>([])
  const [ledgerTotals, setLedgerTotals] = useState({ cash_on_hand: 0, cash_collected_7d: 0 })
  const [ledgerDraft, setLedgerDraft] = useState({
    source: "manual",
    event_type: "invoice_paid",
    amount: "",
    note: "",
  })

  const [latestSnapshot, setLatestSnapshot] = useState<BudgetSnapshot | null>(null)
  const [snapshotHistory, setSnapshotHistory] = useState<BudgetSnapshot[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isSavingCampaign, setIsSavingCampaign] = useState(false)
  const [campaignDraft, setCampaignDraft] = useState({
    name: "",
    channel: "google_ads",
    status: "draft",
    offer_label: "",
    landing_url: "",
    daily_budget: "",
    targeting_notes: "",
  })
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [approvals, setApprovals] = useState<RecommendationApproval[]>([])
  const [recommendationAudit, setRecommendationAudit] = useState<RecommendationAudit[]>([])
  const [alerts, setAlerts] = useState<MarketingAlert[]>([])
  const [integrationsHealth, setIntegrationsHealth] = useState<IntegrationHealth[]>([])
  const [integrationsCheckedAt, setIntegrationsCheckedAt] = useState<string | null>(null)
  const [copiedEnvTemplateKey, setCopiedEnvTemplateKey] = useState("")
  const [isSavingRecommendation, setIsSavingRecommendation] = useState(false)
  const [isProcessingRecommendation, setIsProcessingRecommendation] = useState("")
  const [isUpdatingAlert, setIsUpdatingAlert] = useState("")
  const [recommendationDraft, setRecommendationDraft] = useState({
    campaign_id: "",
    recommendation_type: "increase_budget",
    reason_codes: "high intent traffic, good conversion trend",
    proposed_daily_budget: "",
    proposed_status: "",
    metric_snapshot: "",
  })

  const loadAll = useCallback(async () => {
    setIsBusy(true)
    try {
      const [policyResponse, ledgerResponse, budgetResponse, campaignsResponse, recommendationsResponse, alertsResponse, integrationsResponse] = await Promise.all([
        fetch("/api/admin/marketing/policy", { headers: await getAuthHeaders(), cache: "no-store" }),
        fetch("/api/admin/marketing/cash-ledger", { headers: await getAuthHeaders(), cache: "no-store" }),
        fetch("/api/admin/marketing/budget/recompute", { headers: await getAuthHeaders(), cache: "no-store" }),
        fetch("/api/admin/marketing/campaigns", { headers: await getAuthHeaders(), cache: "no-store" }),
        fetch("/api/admin/marketing/recommendations", { headers: await getAuthHeaders(), cache: "no-store" }),
        fetch("/api/admin/marketing/alerts", { headers: await getAuthHeaders(), cache: "no-store" }),
        fetch("/api/admin/marketing/integrations/health", { headers: await getAuthHeaders(), cache: "no-store" }),
      ])

      const [policyJson, ledgerJson, budgetJson, campaignsJson, recommendationsJson, alertsJson, integrationsJson] = await Promise.all([
        policyResponse.json(),
        ledgerResponse.json(),
        budgetResponse.json(),
        campaignsResponse.json(),
        recommendationsResponse.json(),
        alertsResponse.json(),
        integrationsResponse.json(),
      ])

      if (!policyResponse.ok) throw new Error(policyJson.error || "Failed to load policy")
      if (!ledgerResponse.ok) throw new Error(ledgerJson.error || "Failed to load cash ledger")
      if (!budgetResponse.ok) throw new Error(budgetJson.error || "Failed to load budget snapshots")
      if (!campaignsResponse.ok) throw new Error(campaignsJson.error || "Failed to load campaigns")
      if (!recommendationsResponse.ok) throw new Error(recommendationsJson.error || "Failed to load recommendations")
      if (!alertsResponse.ok) throw new Error(alertsJson.error || "Failed to load alerts")
      if (!integrationsResponse.ok) throw new Error(integrationsJson.error || "Failed to load integrations health")

      const nextPolicy = policyJson.policy as Policy
      setPolicy(nextPolicy)
      setPolicyDraft({
        reserve_floor_amount: String(nextPolicy.reserve_floor_amount ?? 0),
        reinvestment_rate_pct: String(nextPolicy.reinvestment_rate_pct ?? 0.3),
        max_weekly_spend: String(nextPolicy.max_weekly_spend ?? 0),
        payback_target_days: String(nextPolicy.payback_target_days ?? 120),
        automation_mode: nextPolicy.automation_mode ?? "manual",
      })

      setLedger((ledgerJson.ledger ?? []) as CashLedgerEntry[])
      setLedgerTotals({
        cash_on_hand: Number(ledgerJson.totals?.cash_on_hand ?? 0),
        cash_collected_7d: Number(ledgerJson.totals?.cash_collected_7d ?? 0),
      })

      const snapshots = (budgetJson.snapshots ?? []) as BudgetSnapshot[]
      setLatestSnapshot((budgetJson.latest as BudgetSnapshot | null) ?? snapshots[0] ?? null)
      setSnapshotHistory(snapshots)
      setCampaigns((campaignsJson.campaigns ?? []) as Campaign[])
      const loadedRecommendations = (recommendationsJson.recommendations ?? []) as Recommendation[]
      setRecommendations(loadedRecommendations)
      setApprovals((recommendationsJson.approvals ?? []) as RecommendationApproval[])
      setRecommendationAudit((recommendationsJson.audit ?? []) as RecommendationAudit[])
      setAlerts((alertsJson.alerts ?? []) as MarketingAlert[])
      setIntegrationsHealth((integrationsJson.integrations ?? []) as IntegrationHealth[])
      setIntegrationsCheckedAt((integrationsJson.checked_at as string | undefined) ?? null)
      setMessage("")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load marketing engine")
    } finally {
      setIsBusy(false)
    }
  }, [])

  useEffect(() => {
    async function load() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()
      setSession(currentSession)
      if (currentSession?.access_token) {
        await loadAll()
      }
    }
    void load()
  }, [loadAll])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(MARKETING_LAYOUT_PREFS_KEY)
      if (!raw) {
        if (window.matchMedia("(max-width: 767px)").matches) {
          setCollapsedPanels({
            playbooks: false,
            recommendations: true,
            alerts: false,
            integrations: true,
            checklist: true,
            blueprint: true,
            campaigns: true,
            policy: true,
            ledger: true,
          })
        }
        return
      }
      const parsed = JSON.parse(raw) as { collapsedPanels?: Partial<Record<keyof typeof panelDefaults, boolean>> }
      if (parsed.collapsedPanels) {
        setCollapsedPanels((current) => ({ ...current, ...parsed.collapsedPanels }))
      }
    } catch {}
  }, [MARKETING_LAYOUT_PREFS_KEY])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(MARKETING_LAYOUT_PREFS_KEY, JSON.stringify({ collapsedPanels }))
  }, [MARKETING_LAYOUT_PREFS_KEY, collapsedPanels])

  const reserveStateLabel = useMemo(() => {
    if (!latestSnapshot) return "Not computed"
    return latestSnapshot.reserve_status === "critical"
      ? "Critical"
      : latestSnapshot.reserve_status === "watch"
      ? "Watch"
      : "Healthy"
  }, [latestSnapshot])

  const openAlertCount = useMemo(() => alerts.filter((alert) => alert.status === "open").length, [alerts])
  const criticalAlertCount = useMemo(
    () => alerts.filter((alert) => alert.status !== "resolved" && alert.severity === "critical").length,
    [alerts]
  )
  const integrationSetupQueue = useMemo(
    () => integrationsHealth.filter((integration) => integration.status !== "connected"),
    [integrationsHealth]
  )
  const missingEnvTemplate = useMemo(() => {
    const lines: string[] = []
    for (const integration of integrationSetupQueue) {
      const guide = INTEGRATION_SETUP_GUIDES[integration.key]
      if (!guide) continue
      for (const item of guide.envVars) {
        if (item.includes(" or ")) {
          const [first] = item.split(" or ")
          lines.push(`${first}=`)
        } else {
          lines.push(`${item}=`)
        }
      }
    }
    return [...new Set(lines)].join("\n")
  }, [integrationSetupQueue])

  useEffect(() => {
    if (!campaigns.length) return
    setRecommendationDraft((current) =>
      current.campaign_id ? current : { ...current, campaign_id: campaigns[0].id }
    )
  }, [campaigns])

  async function savePolicy() {
    setIsSavingPolicy(true)
    try {
      const response = await fetch("/api/admin/marketing/policy", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reserve_floor_amount: Number(policyDraft.reserve_floor_amount),
          reinvestment_rate_pct: Number(policyDraft.reinvestment_rate_pct),
          max_weekly_spend: Number(policyDraft.max_weekly_spend),
          payback_target_days: Number(policyDraft.payback_target_days),
          automation_mode: policyDraft.automation_mode,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to save policy")
      setPolicy(json.policy as Policy)
      setMessage("Policy saved.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save policy")
    } finally {
      setIsSavingPolicy(false)
    }
  }

  async function addLedgerEntry() {
    setIsSavingLedger(true)
    try {
      const response = await fetch("/api/admin/marketing/cash-ledger", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: ledgerDraft.source,
          event_type: ledgerDraft.event_type,
          amount: Number(ledgerDraft.amount),
          note: ledgerDraft.note || null,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to add cash entry")
      setLedgerDraft((current) => ({ ...current, amount: "", note: "" }))
      setMessage("Cash ledger entry saved.")
      await loadAll()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to add cash entry")
    } finally {
      setIsSavingLedger(false)
    }
  }

  async function recomputeBudget() {
    setIsRecomputing(true)
    try {
      const response = await fetch("/api/admin/marketing/budget/recompute", {
        method: "POST",
        headers: await getAuthHeaders(),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to recompute budget")
      setLatestSnapshot(json.snapshot as BudgetSnapshot)
      setMessage("Safe budget recomputed.")
      await loadAll()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to recompute budget")
    } finally {
      setIsRecomputing(false)
    }
  }

  async function createCampaign() {
    setIsSavingCampaign(true)
    try {
      const response = await fetch("/api/admin/marketing/campaigns", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: campaignDraft.name,
          channel: campaignDraft.channel,
          status: campaignDraft.status,
          offer_label: campaignDraft.offer_label,
          landing_url: campaignDraft.landing_url,
          daily_budget: Number(campaignDraft.daily_budget || 0),
          targeting_notes: campaignDraft.targeting_notes,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to create campaign")
      setCampaignDraft({
        name: "",
        channel: "google_ads",
        status: "draft",
        offer_label: "",
        landing_url: "",
        daily_budget: "",
        targeting_notes: "",
      })
      setMessage("Campaign saved.")
      await loadAll()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create campaign")
    } finally {
      setIsSavingCampaign(false)
    }
  }

  async function updateCampaignStatus(campaignId: string, status: string) {
    try {
      const response = await fetch("/api/admin/marketing/campaigns", {
        method: "PATCH",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: campaignId, status }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to update campaign")
      setCampaigns((current) => current.map((campaign) => (campaign.id === campaignId ? ({ ...campaign, status } as Campaign) : campaign)))
      setMessage("Campaign status updated.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update campaign")
    }
  }

  async function createRecommendation() {
    if (!recommendationDraft.campaign_id) {
      setMessage("Select a campaign first.")
      return
    }

    setIsSavingRecommendation(true)
    try {
      const reasonCodes = recommendationDraft.reason_codes
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)

      const metricSnapshot =
        recommendationDraft.metric_snapshot.trim().length > 0
          ? { notes: recommendationDraft.metric_snapshot.trim() }
          : {}

      const proposedChange: Record<string, unknown> = {}
      if (recommendationDraft.proposed_daily_budget.trim().length > 0) {
        const budget = Number(recommendationDraft.proposed_daily_budget)
        if (Number.isFinite(budget) && budget >= 0) {
          proposedChange.daily_budget = budget
        }
      }
      if (recommendationDraft.proposed_status.trim().length > 0) {
        proposedChange.status = recommendationDraft.proposed_status.trim()
      }

      const response = await fetch("/api/admin/marketing/recommendations", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entity_type: "campaign",
          entity_id: recommendationDraft.campaign_id,
          recommendation_type: recommendationDraft.recommendation_type,
          reason_codes: reasonCodes,
          metric_snapshot: metricSnapshot,
          proposed_change: proposedChange,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to create recommendation")
      setRecommendationDraft((current) => ({
        ...current,
        recommendation_type: "increase_budget",
        reason_codes: "high intent traffic, good conversion trend",
        proposed_daily_budget: "",
        proposed_status: "",
        metric_snapshot: "",
      }))
      setMessage("Recommendation created and queued for approval.")
      await loadAll()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create recommendation")
    } finally {
      setIsSavingRecommendation(false)
    }
  }

  async function processRecommendationAction(id: string, action: "approve" | "reject" | "apply", rejectionNote?: string) {
    setIsProcessingRecommendation(`${id}:${action}`)
    try {
      const response = await fetch("/api/admin/marketing/recommendations", {
        method: "PATCH",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          action,
          rejection_note: rejectionNote || null,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || `Failed to ${action} recommendation`)
      setMessage(`Recommendation ${action}d.`)
      await loadAll()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Failed to ${action} recommendation`)
    } finally {
      setIsProcessingRecommendation("")
    }
  }

  async function updateAlertStatus(alertId: string, status: "open" | "acknowledged" | "resolved") {
    setIsUpdatingAlert(`${alertId}:${status}`)
    try {
      const response = await fetch("/api/admin/marketing/alerts", {
        method: "PATCH",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: alertId,
          status,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to update alert")
      setAlerts((current) => current.map((alert) => (alert.id === alertId ? ({ ...alert, ...json.alert } as MarketingAlert) : alert)))
      setMessage(`Alert marked ${status}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update alert")
    } finally {
      setIsUpdatingAlert("")
    }
  }

  async function copyTemplate(template: string, key: string) {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(template)
      }
      setCopiedEnvTemplateKey(key)
      window.setTimeout(() => {
        setCopiedEnvTemplateKey((current) => (current === key ? "" : current))
      }, 2000)
    } catch {
      setMessage("Could not copy automatically. You can still copy the template text manually.")
    }
  }

  async function validateEnvSetup() {
    setIsValidatingEnv(true)
    try {
      await loadAll()
      setMessage("Integration health validated against current environment.")
    } catch {
      setMessage("Could not validate integration setup right now.")
    } finally {
      setIsValidatingEnv(false)
    }
  }

  async function runPlaybook(action: "recompute_budget" | "recover_stalled_jobs" | "refresh_engine" | "review_critical_alerts") {
    setIsRunningPlaybook(action)
    try {
      if (action === "recompute_budget") {
        await recomputeBudget()
        setMessage("Playbook complete: budget recomputed.")
        return
      }

      if (action === "recover_stalled_jobs") {
        const response = await fetch("/api/admin/jobs/recover-stalled?minutes=20", {
          method: "POST",
          headers: await getAuthHeaders(),
        })
        const json = await response.json()
        if (!response.ok) {
          throw new Error(json.error || "Failed to recover stalled jobs")
        }
        const recovered = Number(json.summary?.recovered_background ?? 0) + Number(json.summary?.recovered_live ?? 0)
        await loadAll()
        setMessage(`Playbook complete: recovered ${recovered} stalled job${recovered === 1 ? "" : "s"}.`)
        return
      }

      if (action === "refresh_engine") {
        await loadAll()
        setMessage("Playbook complete: engine refreshed.")
        return
      }

      if (action === "review_critical_alerts") {
        if (typeof window !== "undefined") {
          const target = document.querySelector("#alerts-policy-risk")
          if (target instanceof HTMLElement) {
            target.scrollIntoView({ behavior: "smooth", block: "start" })
            target.classList.add("ring-2", "ring-rose-300", "ring-offset-2")
            window.setTimeout(() => {
              target.classList.remove("ring-2", "ring-rose-300", "ring-offset-2")
            }, 1400)
          }
        }
        setMessage("Playbook complete: jumped to critical alerts.")
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Playbook failed.")
    } finally {
      setIsRunningPlaybook("")
    }
  }

  function togglePanel(panel: keyof typeof panelDefaults) {
    setCollapsedPanels((current) => ({ ...current, [panel]: !current[panel] }))
  }

  function focusPanel(panel: keyof typeof panelDefaults) {
    setCollapsedPanels((current) =>
      Object.keys(current).reduce<typeof current>((next, key) => {
        next[key as keyof typeof current] = key !== panel
        return next
      }, { ...current })
    )
  }

  function setAllPanelsCollapsed(nextValue: boolean) {
    setCollapsedPanels({
      playbooks: nextValue,
      recommendations: nextValue,
      alerts: nextValue,
      integrations: nextValue,
      checklist: nextValue,
      blueprint: nextValue,
      campaigns: nextValue,
      policy: nextValue,
      ledger: nextValue,
    })
  }

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-neutral-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <PlatformModuleNav />
        <section className="rounded-[2rem] border border-[#d9e2ec] bg-[linear-gradient(135deg,#ffffff_0%,#eef6ff_40%,#f5f8ff_100%)] p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5b6b7c]">Control Center</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0f172a]">Marketing Engine</h1>
              <p className="mt-2 max-w-3xl text-sm text-[#475569]">
                Free-tier MVP: set policy, log cash, and compute safe-to-spend budgets with audit-friendly controls.
              </p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
              <button
                type="button"
                onClick={() => setAllPanelsCollapsed(true)}
                className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 sm:text-sm"
              >
                Collapse all sections
              </button>
              <button
                type="button"
                onClick={() => setAllPanelsCollapsed(false)}
                className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 sm:text-sm"
              >
                Expand all sections
              </button>
              <button
                type="button"
                onClick={() => void loadAll()}
                className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 sm:text-sm"
              >
                {isBusy ? "Refreshing..." : "Refresh data"}
              </button>
              <Link
                href="/admin"
                className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 sm:text-sm"
              >
                Back to control center
              </Link>
            </div>
          </div>
        </section>

        {!session?.user ? (
          <section className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            Please sign in with an admin account to access the Marketing Engine.
          </section>
        ) : null}

        {message ? (
          <section className="mt-4 rounded-2xl border border-[#d8e4f2] bg-white px-4 py-3 text-sm text-neutral-700">{message}</section>
        ) : null}

        <div className="mt-4 grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-[#d8e4f2] bg-[linear-gradient(180deg,#fcfdff_0%,#f4f8fc_100%)] p-3 shadow-sm xl:sticky xl:top-3">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5b6b7c]">Marketing menu</div>
            <details open className="mt-2 rounded-xl border border-neutral-200 bg-white">
              <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-600">
                Core sections
              </summary>
              <div className="px-2 pb-2">
                <button type="button" onClick={() => focusPanel("playbooks")} className="mb-1 w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-left text-xs font-semibold text-neutral-700 hover:bg-neutral-100">Playbooks</button>
                <button type="button" onClick={() => focusPanel("recommendations")} className="mb-1 w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-left text-xs font-semibold text-neutral-700 hover:bg-neutral-100">Recommendations</button>
                <button type="button" onClick={() => focusPanel("alerts")} className="mb-1 w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-left text-xs font-semibold text-neutral-700 hover:bg-neutral-100">Alerts</button>
                <button type="button" onClick={() => focusPanel("integrations")} className="mb-1 w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-left text-xs font-semibold text-neutral-700 hover:bg-neutral-100">Integrations</button>
                <button type="button" onClick={() => focusPanel("campaigns")} className="mb-1 w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-left text-xs font-semibold text-neutral-700 hover:bg-neutral-100">Campaigns</button>
                <button type="button" onClick={() => focusPanel("policy")} className="mb-1 w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-left text-xs font-semibold text-neutral-700 hover:bg-neutral-100">Policy</button>
                <button type="button" onClick={() => focusPanel("ledger")} className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-left text-xs font-semibold text-neutral-700 hover:bg-neutral-100">Cash & budget</button>
              </div>
            </details>
            <details open className="mt-2 rounded-xl border border-neutral-200 bg-white">
              <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-600">
                Actions
              </summary>
              <div className="px-2 pb-2 space-y-1.5">
                <button type="button" onClick={() => setAllPanelsCollapsed(true)} className="w-full rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100">Collapse all</button>
                <button type="button" onClick={() => setAllPanelsCollapsed(false)} className="w-full rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100">Expand all</button>
                <button type="button" onClick={() => void loadAll()} className="w-full rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100">{isBusy ? "Refreshing..." : "Refresh"}</button>
              </div>
            </details>
          </aside>

          <div>
        <section className="mt-0 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Cash on hand" value={formatMoney(ledgerTotals.cash_on_hand)} />
          <MetricCard label="Collected cash (7d)" value={formatMoney(ledgerTotals.cash_collected_7d)} />
          <MetricCard label="Safe weekly budget" value={formatMoney(latestSnapshot?.safe_budget_weekly ?? 0)} />
          <MetricCard label="Reserve state" value={reserveStateLabel} tone={latestSnapshot?.reserve_status === "critical" ? "danger" : "normal"} />
        </section>

        <section className="mt-3 rounded-2xl border border-[#d8e4f2] bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-[#0f172a]">Playbooks</h2>
            <div className="flex items-center gap-2">
              <div className="text-xs text-neutral-500">One-click operations</div>
              <button
                type="button"
                onClick={() => togglePanel("playbooks")}
                className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                {collapsedPanels.playbooks ? "Expand" : "Collapse"}
              </button>
            </div>
          </div>
          {!collapsedPanels.playbooks ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <button
              type="button"
              onClick={() => void runPlaybook("recompute_budget")}
              disabled={isRunningPlaybook.length > 0}
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-left text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRunningPlaybook === "recompute_budget" ? "Running..." : "Recompute budgets"}
            </button>
            <button
              type="button"
              onClick={() => void runPlaybook("recover_stalled_jobs")}
              disabled={isRunningPlaybook.length > 0}
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-left text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRunningPlaybook === "recover_stalled_jobs" ? "Running..." : "Recover stalled jobs"}
            </button>
            <button
              type="button"
              onClick={() => void runPlaybook("review_critical_alerts")}
              disabled={isRunningPlaybook.length > 0}
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-left text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRunningPlaybook === "review_critical_alerts" ? "Running..." : "Review critical alerts"}
            </button>
            <button
              type="button"
              onClick={() => void runPlaybook("refresh_engine")}
              disabled={isRunningPlaybook.length > 0}
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-left text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRunningPlaybook === "refresh_engine" ? "Running..." : "Refresh engine"}
            </button>
            </div>
          ) : null}
        </section>

        <section className="mt-3 rounded-2xl border border-[#d8e4f2] bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-[#0f172a]">Recommendations and approvals</h2>
            <div className="flex items-center gap-2">
              <div className="text-xs text-neutral-500">
                {recommendations.filter((item) => item.status === "proposed").length} proposed |{" "}
                {recommendations.filter((item) => item.status === "approved").length} approved
              </div>
              <button
                type="button"
                onClick={() => togglePanel("recommendations")}
                className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                {collapsedPanels.recommendations ? "Expand" : "Collapse"}
              </button>
            </div>
          </div>
          {!collapsedPanels.recommendations ? (
            <>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Campaign">
              <select
                value={recommendationDraft.campaign_id}
                onChange={(event) => setRecommendationDraft((current) => ({ ...current, campaign_id: event.target.value }))}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="">Select campaign</option>
                {campaigns.map((campaign) => (
                  <option key={`rec-campaign-${campaign.id}`} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Recommendation type">
              <select
                value={recommendationDraft.recommendation_type}
                onChange={(event) => setRecommendationDraft((current) => ({ ...current, recommendation_type: event.target.value }))}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="increase_budget">Increase budget</option>
                <option value="decrease_budget">Decrease budget</option>
                <option value="hold_budget">Hold budget</option>
                <option value="pause_campaign">Pause campaign</option>
                <option value="refresh_creative">Refresh creative</option>
              </select>
            </Field>
            <Field label="Proposed daily budget (optional)">
              <input
                value={recommendationDraft.proposed_daily_budget}
                onChange={(event) => setRecommendationDraft((current) => ({ ...current, proposed_daily_budget: event.target.value }))}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                placeholder="120"
              />
            </Field>
            <Field label="Proposed status (optional)">
              <select
                value={recommendationDraft.proposed_status}
                onChange={(event) => setRecommendationDraft((current) => ({ ...current, proposed_status: event.target.value }))}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="">No status change</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
            </Field>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field label="Reason codes (comma separated)">
              <input
                value={recommendationDraft.reason_codes}
                onChange={(event) => setRecommendationDraft((current) => ({ ...current, reason_codes: event.target.value }))}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                placeholder="payback improving, high quality leads"
              />
            </Field>
            <Field label="Metric snapshot notes">
              <input
                value={recommendationDraft.metric_snapshot}
                onChange={(event) => setRecommendationDraft((current) => ({ ...current, metric_snapshot: event.target.value }))}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                placeholder="CVR up 18%, CPA down 12% week over week"
              />
            </Field>
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => void createRecommendation()}
              disabled={isSavingRecommendation || !recommendationDraft.campaign_id}
              className="rounded-xl border border-[#0a66c2] bg-[#0a66c2] px-3 py-2 text-sm font-semibold text-white hover:bg-[#004182] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingRecommendation ? "Saving..." : "Create recommendation"}
            </button>
          </div>

          <div className="mt-3 max-h-[280px] overflow-auto rounded-xl border border-neutral-200">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-[0.08em] text-neutral-500">
                <tr>
                  <th className="px-3 py-2 text-left">Recommendation</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Proposed change</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {recommendations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-neutral-500">
                      No recommendations yet.
                    </td>
                  </tr>
                ) : null}
                {recommendations.map((recommendation) => {
                  const linkedCampaign = campaigns.find((campaign) => campaign.id === recommendation.entity_id)
                  const runningAction = isProcessingRecommendation.startsWith(`${recommendation.id}:`)
                  return (
                    <tr key={recommendation.id}>
                      <td className="px-3 py-2 text-neutral-800">
                        <div className="font-semibold">{recommendation.recommendation_type.replaceAll("_", " ")}</div>
                        <div className="text-xs text-neutral-500">
                          {linkedCampaign?.name || recommendation.entity_id || "No linked campaign"} | {new Date(recommendation.created_at).toLocaleString()}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {(recommendation.reason_codes_json ?? []).slice(0, 3).map((code) => (
                            <span key={`${recommendation.id}-${code}`} className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                              {code}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                            recommendation.status === "applied"
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                              : recommendation.status === "approved"
                              ? "border-sky-300 bg-sky-50 text-sky-800"
                              : recommendation.status === "rejected"
                              ? "border-rose-300 bg-rose-50 text-rose-800"
                              : "border-amber-300 bg-amber-50 text-amber-800"
                          }`}
                        >
                          {recommendation.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-neutral-700">
                        {Object.keys(recommendation.proposed_change_json || {}).length === 0
                          ? "No direct change"
                          : JSON.stringify(recommendation.proposed_change_json)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {recommendation.status === "proposed" ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void processRecommendationAction(recommendation.id, "approve")}
                                disabled={runningAction}
                                className="rounded-lg border border-sky-300 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => void processRecommendationAction(recommendation.id, "reject", "Not aligned with current cash policy")}
                                disabled={runningAction}
                                className="rounded-lg border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Reject
                              </button>
                            </>
                          ) : null}
                          {recommendation.status === "approved" ? (
                            <button
                              type="button"
                              onClick={() => void processRecommendationAction(recommendation.id, "apply")}
                              disabled={runningAction}
                              className="rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Apply
                            </button>
                          ) : null}
                          {runningAction ? <span className="text-xs text-neutral-500">Working...</span> : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Approval history</div>
              <div className="mt-2 max-h-[130px] space-y-1.5 overflow-auto">
                {approvals.slice(0, 8).map((item) => (
                  <div key={item.id} className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700">
                    {item.decision} | {item.requested_by_email || "Unknown"} |{" "}
                    {item.decided_at ? new Date(item.decided_at).toLocaleString() : "Pending"}
                  </div>
                ))}
                {approvals.length === 0 ? <div className="text-xs text-neutral-500">No approval records yet.</div> : null}
              </div>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Audit trail</div>
              <div className="mt-2 max-h-[130px] space-y-1.5 overflow-auto">
                {recommendationAudit.slice(0, 8).map((item) => (
                  <div key={item.id} className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700">
                    {item.action_type.replaceAll("_", " ")} | {item.actor_email || "Unknown"} | {new Date(item.created_at).toLocaleString()}
                  </div>
                ))}
                {recommendationAudit.length === 0 ? <div className="text-xs text-neutral-500">No audit events yet.</div> : null}
              </div>
            </div>
          </div>
            </>
          ) : null}
        </section>

        <section id="alerts-policy-risk" className="mt-3 rounded-2xl border border-[#d8e4f2] bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-[#0f172a]">Alerts and policy risk</h2>
            <div className="flex items-center gap-2">
              <div className="text-xs text-neutral-500">
                Open: {openAlertCount} | Critical: {criticalAlertCount}
              </div>
              <button
                type="button"
                onClick={() => togglePanel("alerts")}
                className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                {collapsedPanels.alerts ? "Expand" : "Collapse"}
              </button>
            </div>
          </div>
          {!collapsedPanels.alerts ? (
            <div className="mt-3 max-h-[280px] overflow-auto rounded-xl border border-neutral-200">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-[0.08em] text-neutral-500">
                <tr>
                  <th className="px-3 py-2 text-left">Alert</th>
                  <th className="px-3 py-2 text-left">Severity</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {alerts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-neutral-500">
                      No alerts yet.
                    </td>
                  </tr>
                ) : null}
                {alerts.map((alert) => (
                  <tr key={alert.id}>
                    <td className="px-3 py-2 text-neutral-800">
                      <div className="font-semibold">{alert.alert_type.replaceAll("_", " ")}</div>
                      <div className="text-xs text-neutral-600">{alert.message}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                            alert.metadata_json?.email_sent === true
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                              : alert.severity === "critical"
                              ? "border-amber-300 bg-amber-50 text-amber-800"
                              : "border-neutral-300 bg-neutral-50 text-neutral-700"
                          }`}
                        >
                          {alert.metadata_json?.email_sent === true
                            ? "Email sent"
                            : alert.severity === "critical"
                            ? `Email pending${alert.metadata_json?.email_reason ? ` (${String(alert.metadata_json.email_reason)})` : ""}`
                            : "Email not required"}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-500">{new Date(alert.created_at).toLocaleString()}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                          alert.severity === "critical"
                            ? "border-rose-300 bg-rose-50 text-rose-800"
                            : alert.severity === "watch"
                            ? "border-amber-300 bg-amber-50 text-amber-800"
                            : "border-sky-300 bg-sky-50 text-sky-800"
                        }`}
                      >
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                          alert.status === "resolved"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                            : alert.status === "acknowledged"
                            ? "border-sky-300 bg-sky-50 text-sky-800"
                            : "border-amber-300 bg-amber-50 text-amber-800"
                        }`}
                      >
                        {alert.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {alert.status === "open" ? (
                          <button
                            type="button"
                            onClick={() => void updateAlertStatus(alert.id, "acknowledged")}
                            disabled={isUpdatingAlert === `${alert.id}:acknowledged`}
                            className="rounded-lg border border-sky-300 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Ack
                          </button>
                        ) : null}
                        {alert.status !== "resolved" ? (
                          <button
                            type="button"
                            onClick={() => void updateAlertStatus(alert.id, "resolved")}
                            disabled={isUpdatingAlert === `${alert.id}:resolved`}
                            className="rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Resolve
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void updateAlertStatus(alert.id, "open")}
                            disabled={isUpdatingAlert === `${alert.id}:open`}
                            className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Reopen
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          ) : null}
        </section>

        <section className="mt-3 rounded-2xl border border-[#d8e4f2] bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-[#0f172a]">Integrations health</h2>
            <div className="flex items-center gap-2">
              <div className="text-xs text-neutral-500">
                {integrationsCheckedAt ? `Checked ${new Date(integrationsCheckedAt).toLocaleString()}` : "Not checked yet"}
              </div>
              <button
                type="button"
                onClick={() => togglePanel("integrations")}
                className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                {collapsedPanels.integrations ? "Expand" : "Collapse"}
              </button>
            </div>
          </div>
          {!collapsedPanels.integrations ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {integrationsHealth.length === 0 ? (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
                No integration status available.
              </div>
            ) : null}
            {integrationsHealth.map((integration) => (
              <div key={integration.key} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-neutral-900">{integration.label}</div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                      integration.status === "connected"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : integration.status === "partial"
                        ? "border-amber-300 bg-amber-50 text-amber-800"
                        : "border-neutral-300 bg-white text-neutral-700"
                    }`}
                  >
                    {integration.status === "not_configured" ? "Not configured" : integration.status}
                  </span>
                </div>
                <div className="mt-1 text-xs text-neutral-600">{integration.detail}</div>
              </div>
            ))}
            </div>
          ) : null}
        </section>

        <section className="mt-3 rounded-2xl border border-[#d8e4f2] bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-[#0f172a]">Setup checklist</h2>
            <div className="flex items-center gap-2">
              <div className="text-xs text-neutral-500">
                {integrationSetupQueue.length === 0 ? "All integrations connected" : `${integrationSetupQueue.length} setup item(s)`}
              </div>
              <button
                type="button"
                onClick={() => togglePanel("checklist")}
                className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                {collapsedPanels.checklist ? "Expand" : "Collapse"}
              </button>
            </div>
          </div>
          {!collapsedPanels.checklist ? (
            <>
          {integrationSetupQueue.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void copyTemplate(missingEnvTemplate, "all-missing")}
                className="rounded-lg border border-[#0a66c2] bg-[#e8f3ff] px-2.5 py-1 text-xs font-semibold text-[#0a66c2] hover:bg-[#dcecff]"
              >
                {copiedEnvTemplateKey === "all-missing" ? "Copied all missing env vars" : "Copy all missing env vars"}
              </button>
              <button
                type="button"
                onClick={() => void validateEnvSetup()}
                disabled={isValidatingEnv}
                className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isValidatingEnv ? "Validating..." : "Validate env setup"}
              </button>
              <code className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-[10px] text-neutral-700">Paste into .env.local</code>
            </div>
          ) : null}
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {integrationSetupQueue.length === 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                Nice work. Everything in this checklist is configured.
              </div>
            ) : null}
            {integrationSetupQueue.map((integration) => {
              const guide = INTEGRATION_SETUP_GUIDES[integration.key]
              return (
                <div key={`setup-${integration.key}`} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-neutral-900">{integration.label}</div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                        integration.status === "partial"
                          ? "border-amber-300 bg-amber-50 text-amber-800"
                          : "border-neutral-300 bg-white text-neutral-700"
                      }`}
                    >
                      {integration.status === "partial" ? "Partial" : "Missing"}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-neutral-600">{guide?.quickNote || "Setup required."}</div>
                  {guide ? (
                    <>
                      <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Env vars</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {guide.envVars.map((item) => (
                          <code key={`${integration.key}-${item}`} className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-[10px] text-neutral-700">
                            {item}
                          </code>
                        ))}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            void copyTemplate(
                              guide.envVars
                                .map((item) => {
                                  if (item.includes(" or ")) {
                                    const [first] = item.split(" or ")
                                    return `${first}=`
                                  }
                                  return `${item}=`
                                })
                                .join("\n"),
                              `guide-${integration.key}`
                            )
                          }
                          className="inline-flex rounded-lg border border-[#0a66c2] bg-[#e8f3ff] px-2.5 py-1 text-xs font-semibold text-[#0a66c2] hover:bg-[#dcecff]"
                        >
                          {copiedEnvTemplateKey === `guide-${integration.key}` ? "Copied template" : "Copy env template"}
                        </button>
                        <a
                          href={guide.docsUrl}
                          target={guide.docsUrl.startsWith("http") ? "_blank" : undefined}
                          rel={guide.docsUrl.startsWith("http") ? "noreferrer" : undefined}
                          className="inline-flex rounded-lg border border-[#0a66c2] bg-white px-2.5 py-1 text-xs font-semibold text-[#0a66c2] hover:bg-[#eef5fe]"
                        >
                          Open setup guide
                        </a>
                      </div>
                    </>
                  ) : null}
                </div>
              )
            })}
          </div>
            </>
          ) : null}
        </section>

        <section className="mt-3 rounded-2xl border border-[#d8e4f2] bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-end">
            <button
              type="button"
              onClick={() => togglePanel("blueprint")}
              className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
            >
              {collapsedPanels.blueprint ? "Expand" : "Collapse"}
            </button>
          </div>
          {!collapsedPanels.blueprint ? (
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Overview blueprint</div>
              <h2 className="mt-1 text-lg font-semibold text-[#0f172a]">Customer-Funded Growth Engine</h2>
              <p className="mt-1 text-sm text-neutral-600">
                This visual explains the full operating loop behind the marketing engine.
              </p>
              <button
                type="button"
                onClick={() => setShowBlueprintModal(true)}
                className="mt-2 rounded-xl border border-[#0a66c2] bg-[#e8f3ff] px-3 py-2 text-sm font-semibold text-[#0a66c2] hover:bg-[#dcecff]"
              >
                Expand image
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowBlueprintModal(true)}
              className="block w-full max-w-[320px] overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 text-left hover:border-[#b7d4f3]"
            >
              <Image
                src="/marketing/customer-funded-growth-engine.jpeg"
                alt="Customer-funded growth engine blueprint"
                width={1365}
                height={768}
                className="h-auto w-full object-cover"
                priority={false}
              />
            </button>
            </div>
          ) : null}
        </section>

        <section className="mt-3 rounded-2xl border border-[#d8e4f2] bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-[#0f172a]">Campaign workspace</h2>
            <div className="flex items-center gap-2">
              <div className="text-xs text-neutral-500">Campaigns: {campaigns.length}</div>
              <button
                type="button"
                onClick={() => togglePanel("campaigns")}
                className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                {collapsedPanels.campaigns ? "Expand" : "Collapse"}
              </button>
            </div>
          </div>
          {!collapsedPanels.campaigns ? (
            <>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Campaign name">
              <input
                value={campaignDraft.name}
                onChange={(event) => setCampaignDraft((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                placeholder="Q2 SMB pilot push"
              />
            </Field>
            <Field label="Channel">
              <select
                value={campaignDraft.channel}
                onChange={(event) => setCampaignDraft((current) => ({ ...current, channel: event.target.value }))}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="google_ads">Google Ads</option>
                <option value="meta">Meta</option>
                <option value="linkedin">LinkedIn</option>
                <option value="partner">Partner</option>
                <option value="founder_outbound">Founder outbound</option>
                <option value="manual">Manual</option>
              </select>
            </Field>
            <Field label="Status">
              <select
                value={campaignDraft.status}
                onChange={(event) => setCampaignDraft((current) => ({ ...current, status: event.target.value }))}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
            </Field>
            <Field label="Daily budget (USD)">
              <input
                value={campaignDraft.daily_budget}
                onChange={(event) => setCampaignDraft((current) => ({ ...current, daily_budget: event.target.value }))}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                placeholder="80"
              />
            </Field>
            <Field label="Offer label">
              <input
                value={campaignDraft.offer_label}
                onChange={(event) => setCampaignDraft((current) => ({ ...current, offer_label: event.target.value }))}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                placeholder="Annual prepay"
              />
            </Field>
            <Field label="Landing URL">
              <input
                value={campaignDraft.landing_url}
                onChange={(event) => setCampaignDraft((current) => ({ ...current, landing_url: event.target.value }))}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                placeholder="https://..."
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Targeting notes">
                <input
                  value={campaignDraft.targeting_notes}
                  onChange={(event) => setCampaignDraft((current) => ({ ...current, targeting_notes: event.target.value }))}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                  placeholder="Executive SMB owners, AU/NZ, high-intent problem-aware"
                />
              </Field>
            </div>
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => void createCampaign()}
              disabled={isSavingCampaign || !campaignDraft.name.trim()}
              className="rounded-xl border border-[#0a66c2] bg-[#0a66c2] px-3 py-2 text-sm font-semibold text-white hover:bg-[#004182] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingCampaign ? "Saving..." : "Create campaign"}
            </button>
          </div>
          <div className="mt-3 max-h-[280px] overflow-auto rounded-xl border border-neutral-200">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-[0.08em] text-neutral-500">
                <tr>
                  <th className="px-3 py-2 text-left">Campaign</th>
                  <th className="px-3 py-2 text-left">Channel</th>
                  <th className="px-3 py-2 text-left">Budget</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-neutral-500">
                      No campaigns yet.
                    </td>
                  </tr>
                ) : null}
                {campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td className="px-3 py-2 text-neutral-800">
                      <div className="font-semibold">{campaign.name}</div>
                      <div className="text-xs text-neutral-500">{campaign.offer_label || "No offer"} {campaign.landing_url ? `| ${campaign.landing_url}` : ""}</div>
                    </td>
                    <td className="px-3 py-2 text-neutral-700">{campaign.channel.replaceAll("_", " ")}</td>
                    <td className="px-3 py-2 text-neutral-700">{formatMoney(campaign.daily_budget)}/day</td>
                    <td className="px-3 py-2">
                      <select
                        value={campaign.status}
                        onChange={(event) => void updateCampaignStatus(campaign.id, event.target.value)}
                        className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs"
                      >
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="completed">Completed</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-500">{new Date(campaign.updated_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            </>
          ) : null}
        </section>

        <section className="mt-3 rounded-2xl border border-[#d8e4f2] bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-[#0f172a]">Policy settings</h2>
            <div className="flex items-center gap-2">
              {policy?.updated_at ? (
                <div className="text-xs text-neutral-500">
                  Updated {new Date(policy.updated_at).toLocaleString()} {policy.updated_by_email ? `by ${policy.updated_by_email}` : ""}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => togglePanel("policy")}
                className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                {collapsedPanels.policy ? "Expand" : "Collapse"}
              </button>
            </div>
          </div>
          {!collapsedPanels.policy ? (
            <>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Field label="Reserve floor (USD)">
              <input
                value={policyDraft.reserve_floor_amount}
                onChange={(event) => setPolicyDraft((current) => ({ ...current, reserve_floor_amount: event.target.value }))}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Reinvestment rate (0-1)">
              <input
                value={policyDraft.reinvestment_rate_pct}
                onChange={(event) => setPolicyDraft((current) => ({ ...current, reinvestment_rate_pct: event.target.value }))}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Max weekly spend (USD)">
              <input
                value={policyDraft.max_weekly_spend}
                onChange={(event) => setPolicyDraft((current) => ({ ...current, max_weekly_spend: event.target.value }))}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Payback target days">
              <input
                value={policyDraft.payback_target_days}
                onChange={(event) => setPolicyDraft((current) => ({ ...current, payback_target_days: event.target.value }))}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Automation mode">
              <select
                value={policyDraft.automation_mode}
                onChange={(event) =>
                  setPolicyDraft((current) => ({ ...current, automation_mode: event.target.value as "manual" | "approval_gated" }))
                }
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="manual">Manual</option>
                <option value="approval_gated">Approval gated</option>
              </select>
            </Field>
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => void savePolicy()}
              disabled={isSavingPolicy}
              className="rounded-xl border border-[#0a66c2] bg-[#0a66c2] px-3 py-2 text-sm font-semibold text-white hover:bg-[#004182] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingPolicy ? "Saving..." : "Save policy"}
            </button>
          </div>
            </>
          ) : null}
        </section>

        <section className="mt-3 rounded-2xl border border-[#d8e4f2] bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-[#0f172a]">Cash and budget snapshots</h2>
            <button
              type="button"
              onClick={() => togglePanel("ledger")}
              className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
            >
              {collapsedPanels.ledger ? "Expand" : "Collapse"}
            </button>
          </div>
          {!collapsedPanels.ledger ? (
            <div className="mt-3 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-[#d8e4f2] bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-[#0f172a]">Cash ledger</h2>
              <div className="text-xs text-neutral-500">Recent entries: {ledger.length}</div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Source">
                <select
                  value={ledgerDraft.source}
                  onChange={(event) => setLedgerDraft((current) => ({ ...current, source: event.target.value }))}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                >
                  <option value="manual">Manual</option>
                  <option value="stripe">Stripe</option>
                </select>
              </Field>
              <Field label="Event type">
                <select
                  value={ledgerDraft.event_type}
                  onChange={(event) => setLedgerDraft((current) => ({ ...current, event_type: event.target.value }))}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                >
                  <option value="invoice_paid">Invoice paid</option>
                  <option value="subscription_renewed">Subscription renewed</option>
                  <option value="refund">Refund</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </Field>
              <Field label="Amount (USD)">
                <input
                  value={ledgerDraft.amount}
                  onChange={(event) => setLedgerDraft((current) => ({ ...current, amount: event.target.value }))}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                  placeholder="e.g. 1200 or -200"
                />
              </Field>
              <Field label="Note">
                <input
                  value={ledgerDraft.note}
                  onChange={(event) => setLedgerDraft((current) => ({ ...current, note: event.target.value }))}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                  placeholder="Optional"
                />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void addLedgerEntry()}
                disabled={isSavingLedger}
                className="rounded-xl border border-[#0a66c2] bg-[#0a66c2] px-3 py-2 text-sm font-semibold text-white hover:bg-[#004182] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingLedger ? "Saving..." : "Add cash entry"}
              </button>
              <button
                type="button"
                onClick={() => void recomputeBudget()}
                disabled={isRecomputing}
                className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRecomputing ? "Recomputing..." : "Recompute safe budget"}
              </button>
            </div>
            <div className="mt-3 max-h-[280px] overflow-auto rounded-xl border border-neutral-200">
              <table className="min-w-full divide-y divide-neutral-200 text-sm">
                <thead className="bg-neutral-50 text-xs uppercase tracking-[0.08em] text-neutral-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Amount</th>
                    <th className="px-3 py-2 text-left">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {ledger.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-3 text-neutral-500">
                        No cash ledger entries yet.
                      </td>
                    </tr>
                  ) : null}
                  {ledger.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-3 py-2 text-neutral-700">{new Date(entry.occurred_at).toLocaleString()}</td>
                      <td className="px-3 py-2 text-neutral-700">{entry.event_type.replaceAll("_", " ")}</td>
                      <td className={`px-3 py-2 font-semibold ${entry.amount < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                        {formatMoney(entry.amount)}
                      </td>
                      <td className="px-3 py-2 text-neutral-600">{entry.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-[#d8e4f2] bg-white p-3 shadow-sm">
            <h2 className="text-lg font-semibold text-[#0f172a]">Latest budget snapshot</h2>
            {!latestSnapshot ? (
              <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
                Recompute budget to create your first snapshot.
              </div>
            ) : (
              <>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <SnapshotStat label="Week start" value={latestSnapshot.week_start} />
                  <SnapshotStat label="Computed" value={new Date(latestSnapshot.computed_at).toLocaleString()} />
                  <SnapshotStat label="Collected 7d" value={formatMoney(latestSnapshot.collected_cash_7d)} />
                  <SnapshotStat label="Cash on hand" value={formatMoney(latestSnapshot.cash_on_hand)} />
                  <SnapshotStat label="Safe weekly" value={formatMoney(latestSnapshot.safe_budget_weekly)} />
                  <SnapshotStat label="Safe daily" value={formatMoney(latestSnapshot.safe_budget_daily)} />
                </div>
                <div className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${toneForReserve(latestSnapshot.reserve_status)}`}>
                  Reserve state: {latestSnapshot.reserve_status}
                </div>
              </>
            )}
            <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">History</div>
              <div className="mt-2 max-h-[180px] space-y-1.5 overflow-auto">
                {snapshotHistory.slice(0, 8).map((snapshot) => (
                  <div key={snapshot.id} className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-700">
                    {new Date(snapshot.computed_at).toLocaleString()} | {formatMoney(snapshot.safe_budget_weekly)} weekly | {snapshot.reserve_status}
                  </div>
                ))}
                {snapshotHistory.length === 0 ? <div className="text-xs text-neutral-500">No snapshots yet.</div> : null}
              </div>
            </div>
          </div>
            </div>
          ) : null}
        </section>
          </div>
        </div>
      </div>
      {showBlueprintModal ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-6xl rounded-2xl border border-[#d8e4f2] bg-white p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-[#0f172a]">Customer-Funded Growth Engine Blueprint</div>
              <button
                type="button"
                onClick={() => setShowBlueprintModal(false)}
                className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                Close
              </button>
            </div>
            <div className="max-h-[82vh] overflow-auto rounded-xl border border-neutral-200 bg-neutral-50">
              <Image
                src="/marketing/customer-funded-growth-engine.jpeg"
                alt="Customer-funded growth engine blueprint expanded"
                width={1365}
                height={768}
                className="h-auto w-full object-contain"
                priority={false}
              />
            </div>
          </div>
        </div>
      ) : null}
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">{label}</label>
      {children}
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
