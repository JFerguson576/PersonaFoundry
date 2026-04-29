"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { AdminTourCompletionPanel } from "@/components/admin/AdminTourCompletionPanel"
import { PlatformModuleNav } from "@/components/navigation/PlatformModuleNav"
import { getAuthHeaders } from "@/lib/career-client"
import { scrollToElementWithOffset } from "@/lib/scroll"
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

type CandidateArchiveRow = {
  id: string
  user_id: string | null
  full_name: string | null
  city: string | null
  primary_goal: string | null
  created_at: string | null
  deleted_at: string | null
  purge_after: string | null
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

type SecurityWriteRouteAuditItem = {
  route: string
  method: "POST" | "PATCH" | "DELETE"
  access: "superuser" | "admin"
  area: "marketing" | "operations" | "users" | "workspace"
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
  user_id: string | null
  user_email: string | null
  note_type: string | null
  severity: "low" | "medium" | "high"
  status: "open" | "in_review" | "resolved"
  message: string | null
  module: string | null
  route_path: string | null
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
  updated_at: string | null
}

function routeFromFullUrl(value: string | null) {
  if (!value) return ""
  try {
    const url = new URL(value)
    return `${url.pathname}${url.hash}`
  } catch {
    return value
  }
}

function testerFeedbackRouteLabel(note: TesterFeedbackNoteRow) {
  const route = note.route_path || routeFromFullUrl(note.full_url)
  const anchor = note.section_anchor ? `#${note.section_anchor}` : ""
  return route ? `${route}${route.includes("#") ? "" : anchor}` : note.module || "Unknown location"
}

function testerFeedbackPageKey(note: TesterFeedbackNoteRow) {
  return `${note.module || "unknown"}|${testerFeedbackRouteLabel(note)}`
}

function testerSeverityToneClass(severity: TesterFeedbackNoteRow["severity"]) {
  if (severity === "high") return "border-rose-200 bg-rose-50 text-rose-800"
  if (severity === "medium") return "border-amber-200 bg-amber-50 text-amber-800"
  return "border-sky-200 bg-sky-50 text-sky-800"
}

function testerStatusToneClass(status: TesterFeedbackNoteRow["status"]) {
  if (status === "resolved") return "border-emerald-200 bg-emerald-50 text-emerald-800"
  if (status === "in_review") return "border-amber-200 bg-amber-50 text-amber-800"
  return "border-rose-200 bg-rose-50 text-rose-800"
}

type RevenueLinePoint = {
  label: string
  revenue_usd: number
}

type RevenueLineSeries = {
  key: string
  label: string
  monthly_revenue_usd: number
  daily: RevenueLinePoint[]
  weekly: RevenueLinePoint[]
  monthly: RevenueLinePoint[]
}

type OperationsEconomicsResponse = {
  month_label: string
  summary: {
    total_revenue_usd: number
    total_api_cost_usd: number
    total_openai_api_cost_usd: number
    total_codex_api_cost_usd: number
    total_codex_development_cost_usd: number
    codex_development_cost_source: string
    codex_development_cost_source_error: string | null
    total_combined_ai_spend_usd: number
    total_margin_usd: number
    total_margin_after_codex_development_usd: number
    unprofitable_users: number
    over_budget_users: number
  }
  trends?: {
    daily: {
      label: string
      revenue_usd: number
      api_cost_usd: number
      openai_api_cost_usd: number
      codex_api_cost_usd: number
      margin_usd: number
    }[]
    weekly: {
      label: string
      revenue_usd: number
      api_cost_usd: number
      openai_api_cost_usd: number
      codex_api_cost_usd: number
      margin_usd: number
    }[]
    monthly: {
      label: string
      revenue_usd: number
      api_cost_usd: number
      openai_api_cost_usd: number
      codex_api_cost_usd: number
      margin_usd: number
    }[]
    codex_spend?: {
      hour: { label: string; codex_spend_usd: number }[]
      day: { label: string; codex_spend_usd: number }[]
      week: { label: string; codex_spend_usd: number }[]
      month: { label: string; codex_spend_usd: number }[]
    }
    module_lines?: RevenueLineSeries[]
    tier_lines?: RevenueLineSeries[]
    seeded_weekly_revenue_usd?: number
  }
  users: {
    user_id: string
    user_email: string | null
    user_name: string
    plan_code: string
    billing_status: string
    monthly_subscription_usd: number
    monthly_api_budget_usd: number | null
    monthly_api_cost_usd: number
    monthly_openai_api_cost_usd: number
    monthly_codex_api_cost_usd: number
    monthly_api_requests: number
    monthly_tokens: number
    monthly_margin_usd: number
    budget_status: "over_budget" | "watch" | "within" | "unbounded" | string
    profitability: "positive" | "negative" | string
    notes: string | null
    last_activity_at: string | null
  }[]
}

type EconomicsDraft = {
  subscription: string
  budget: string
  notes: string
}

type SecurityAuditResponse = {
  routes: SecurityWriteRouteAuditItem[]
  summary: {
    total_write_routes: number
    superuser_protected_count: number
    admin_write_count: number
    coverage_pct: number
  }
}

type RecoverySummaryPayload = {
  recovered_background?: number
  recovered_live?: number
  scanned_background?: number
  scanned_live?: number
  errors?: string[]
}

async function parseApiJson(response: Response, context: string) {
  const raw = await response.text()
  if (!raw) return {}
  const contentType = (response.headers.get("content-type") || "").toLowerCase()
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      throw new Error(`Invalid JSON from ${context}.`)
    }
  }
  if (raw.trimStart().startsWith("<")) {
    throw new Error(`Unexpected non-JSON response from ${context}. Please refresh and sign in again.`)
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    throw new Error(`Unexpected response format from ${context}.`)
  }
}

function readApiError(json: Record<string, unknown>, fallback: string) {
  const error = json.error
  return typeof error === "string" && error.trim().length > 0 ? error : fallback
}

type CodexBacklogItem = {
  id: string
  priority: "P0" | "P1" | "P2"
  status: "planned" | "ready_for_codex" | "in_progress" | "blocked" | "completed"
  title: string
  owner: string
  target: string
  notes: string
}

type BacklogAsset = {
  label: string
  href: string
  type?: "doc" | "pdf" | "md" | "xlsx" | "image"
}

type BacklogAssetDraft = {
  label: string
  href: string
  type: "doc" | "pdf" | "md" | "xlsx" | "image"
}

type BacklogItemDraft = {
  title: string
  priority: CodexBacklogItem["priority"]
  status: CodexBacklogItem["status"]
  owner: string
  target: string
  notes: string
}

type ExecutionBacklogState = {
  order: string[]
  archivedIds: string[]
  deletedIds: string[]
  statusOverrides: Record<string, CodexBacklogItem["status"]>
  customItems?: CodexBacklogItem[]
}

type OperationsMenuGroup =
  | "runHealth"
  | "marketingTools"
  | "testerFeedback"
  | "candidateManagement"
  | "financials"
  | "executionRoadmap"
  | "contentLibrary"
  | "quickActions"

type ContentLibraryItem = {
  id: string
  title: string
  href: string
  type: "doc" | "pdf" | "md" | "xlsx" | "image" | "video" | "audio"
  section: "career" | "persona" | "teamsync" | "operations" | "platform"
  notes?: string
  created_at: string
}

type ContentLibraryDraft = {
  title: string
  href: string
  type: ContentLibraryItem["type"]
  section: ContentLibraryItem["section"]
  notes: string
}

function inferContentLibraryType(fileName: string): ContentLibraryItem["type"] {
  const lower = fileName.toLowerCase()
  if (lower.endsWith(".pdf")) return "pdf"
  if (lower.endsWith(".md")) return "md"
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) return "xlsx"
  if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp") || lower.endsWith(".gif")) {
    return "image"
  }
  if (lower.endsWith(".mp4") || lower.endsWith(".mov") || lower.endsWith(".webm")) return "video"
  if (lower.endsWith(".mp3") || lower.endsWith(".wav") || lower.endsWith(".m4a")) return "audio"
  return "doc"
}

function titleFromFileName(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "").trim()
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

function formatUsd(value: number) {
  return `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatCodexSourceError(value: string | null | undefined) {
  if (!value) return ""
  const text = String(value)
  const normalized = text.toLowerCase()
  if (normalized.includes("invalid openai_admin_key") || normalized.includes("incorrect api key") || normalized.includes("invalid_api_key")) {
    return "OpenAI admin key is invalid or does not have organization cost access."
  }
  if (text.length > 160) return `${text.slice(0, 160)}...`
  return text
}

const CODEX_EXECUTION_BACKLOG: CodexBacklogItem[] = [
  {
    id: "p0-operations-dashboard-handover",
    priority: "P0",
    status: "planned",
    title: "Implement Operations dashboard handover pack",
    owner: "Platform + Operations",
    target: "2 weeks",
    notes:
      "Merged seed tasks CORE-1, CORE-2, and CORE-3. Implement the Operations dashboard handover pack end-to-end: data model and APIs, status workflow, section modules, Codex execution flow, and seeded backlog import from the provided spec bundle.",
  },
  {
    id: "p0-onboarding",
    priority: "P0",
    status: "in_progress",
    title: "Reduce first-session onboarding drop-off",
    owner: "Product + UX",
    target: "2 weeks",
    notes: "Unify setup flow, remove duplicate prompts, and enforce a single path to first value in Career and TeamSync.",
  },
  {
    id: "p0-margin-guardrail",
    priority: "P0",
    status: "planned",
    title: "Enforce margin guardrails per user",
    owner: "Operations + Data",
    target: "2 weeks",
    notes: "Track revenue vs model spend by user and auto-throttle premium automations when account margin is negative.",
  },
  {
    id: "p0-security-audit",
    priority: "P0",
    status: "in_progress",
    title: "Security + authorization hardening pass",
    owner: "Platform",
    target: "3 weeks",
    notes: "Complete route-by-route auth review, key rotation runbook, audit logs baseline, and incident response checklist.",
  },
  {
    id: "p0-legal-policies-rollout",
    priority: "P0",
    status: "planned",
    title: "Publish Terms + Privacy with legal sign-off",
    owner: "Legal + Platform",
    target: "1 week",
    notes:
      "Add Terms of Use and Privacy Policy documents into the platform, complete lawyer review/sign-off, and configure privacy@personara.ai as the primary privacy/compliance contact email across legal pages and platform email templates.",
  },
  {
    id: "p0-codex-cost-observability",
    priority: "P0",
    status: "planned",
    title: "Add Codex API cost visibility to operations",
    owner: "Platform + Finance Ops",
    target: "2 weeks",
    notes:
      "Merged seed task RC-1. Track Codex/API usage as a first-class cost line in Financials, expose daily + monthly totals, add threshold alerts, and roll costs into margin guardrails and revenue-vs-expense monitoring.",
  },
  {
    id: "p0-codex-usage-automatic-control",
    priority: "P0",
    status: "planned",
    title: "Set up CODEX API usage automatic control (tomorrow morning)",
    owner: "Platform + Finance Ops",
    target: "Start tomorrow AM",
    notes:
      "Implement automatic CODEX usage controls: per-user and global spend caps, alert thresholds, guardrail actions when thresholds are crossed, and clear daily/monthly tracking inside Operations Financials.",
  },
  {
    id: "p0-north-star-kpi",
    priority: "P0",
    status: "planned",
    title: "North-star KPI tile and trend",
    owner: "Operations + Data",
    target: "2 weeks",
    notes:
      "Imported seed task NS-1. Add the north-star metric tile, daily/weekly trend line, and KPI context so weekly operators can see the highest-value action signal at a glance.",
  },
  {
    id: "p0-funnel-control",
    priority: "P0",
    status: "planned",
    title: "Conversion funnel taxonomy + drop-off dashboard",
    owner: "Growth + Data",
    target: "3 weeks",
    notes:
      "Merged seed tasks FC-1 and FC-2. Validate core funnel events, then show visit-to-paid conversion, drop-off percentages, and the biggest blocker to action each review cycle.",
  },
  {
    id: "p0-ai-flow-registry",
    priority: "P0",
    status: "planned",
    title: "Create AI flow registry",
    owner: "Product + AI",
    target: "2 weeks",
    notes:
      "Imported seed task AQ-1. Record production AI flows with owners, output contracts, fallback behavior, latency expectations, and quality-control status.",
  },
  {
    id: "p1-growth-loop",
    priority: "P1",
    status: "planned",
    title: "Referral + discount attribution engine",
    owner: "Growth",
    target: "3 weeks",
    notes: "Issue one-time share codes, track redemptions and conversions, and report top referral contributors.",
  },
  {
    id: "p1-prompt-versioning-rollback",
    priority: "P1",
    status: "planned",
    title: "Add prompt versioning and rollback",
    owner: "Product + AI",
    target: "3 weeks",
    notes:
      "Imported seed task AQ-2. Give each AI flow an active prompt version, prompt history, rollback action, and visible release notes for prompt changes.",
  },
  {
    id: "p1-retention-next-best-action-dashboard",
    priority: "P1",
    status: "planned",
    title: "Weekly next-best-action dashboard",
    owner: "Product + Retention",
    target: "3 weeks",
    notes:
      "Imported seed task RE-1. Surface weekly action plans for active users, track completion, and connect the signal to retention experiments.",
  },
  {
    id: "p1-pricing-packaging-matrix",
    priority: "P1",
    status: "planned",
    title: "Pricing plan matrix editor",
    owner: "Product + Finance Ops",
    target: "3 weeks",
    notes:
      "Imported seed task PP-1. Add an editable Starter/Pro/Reseller/White-label plan matrix with feature limits and entitlement mapping.",
  },
  {
    id: "p1-gtm-pipeline-board",
    priority: "P1",
    status: "planned",
    title: "GTM pipeline board",
    owner: "Growth + Sales Ops",
    target: "3 weeks",
    notes:
      "Imported seed task GTM-1. Add lead stages, conversion counts, and editable pipeline movement for new, qualified, demo, pilot, won, and lost leads.",
  },
  {
    id: "p1-outreach",
    priority: "P1",
    status: "planned",
    title: "TeamSync coach outreach automation",
    owner: "Marketing Ops",
    target: "3 weeks",
    notes: "Queue high-intent TeamSync users, send campaign templates, and track reply/booked call outcomes.",
  },
  {
    id: "p1-outreach-queue-from-practitioner-data",
    priority: "P1",
    status: "planned",
    title: "Build outreach queue directly from practitioner dataset",
    owner: "Marketing Ops + Platform",
    target: "2 weeks",
    notes:
      "Wire the NZ practitioner outreach spreadsheet into queue generation so Operations can parse rows, validate email fields, segment by profile, and create campaign-ready outreach batches without manual copy/paste.",
  },
  {
    id: "p1-ads-console",
    priority: "P1",
    status: "planned",
    title: "Ad campaign manager integration",
    owner: "Marketing Ops",
    target: "2 weeks",
    notes: "Embed LinkedIn/Google/Meta campaign console within Operations and surface spend + lead signals.",
  },
  {
    id: "p1-enterprise-outreach-functionality",
    priority: "P1",
    status: "planned",
    title: "Enterprise outreach program functionality",
    owner: "Marketing Ops + Platform",
    target: "4 weeks",
    notes:
      "Add recipient email verification, dynamic personalization, enterprise templates, send scheduling/throttling, suppression controls, compliance-safe unsubscribe handling, and full conversion/ROI analytics.",
  },
  {
    id: "p1-content-library-cms",
    priority: "P1",
    status: "planned",
    title: "Content Library (CMS) in Operations",
    owner: "Platform + Content Ops",
    target: "3 weeks",
    notes:
      "Add a CMS-style Operations section to create/edit/delete Resources items, support docs/images/video/audio, manage draft/published/archive states, and keep a reusable media asset library for future content.",
  },
  {
    id: "p1-content-library-save-delete-filepicker",
    priority: "P1",
    status: "planned",
    title: "Content Library save/delete + file-system picker",
    owner: "Platform + Content Ops",
    target: "2 weeks",
    notes:
      "Add explicit save/update/delete actions for content items and wire the add-content flow to a native file-system picker for uploads (instead of manual path entry), with clear success/error states and permission-safe handling.",
  },
  {
    id: "p1-context-aware-agent",
    priority: "P1",
    status: "planned",
    title: "Context-aware agent guidance",
    owner: "Product + AI",
    target: "2 weeks",
    notes: "Make agent responses module + section aware, adapt quick prompts by page context, and surface next-best-action guidance from live workflow state.",
  },
  {
    id: "p1-gallup-practitioner-management",
    priority: "P1",
    status: "planned",
    title: "Create Gallup Practitioner management module",
    owner: "Marketing Ops + Platform",
    target: "4 weeks",
    notes:
      "Build practitioner CRM + channel workflows: import practitioner lists, segment by ICP/tier/region, track outreach lifecycle, manage templates and campaigns, and report conversion from first contact to active subscription referrals.",
  },
  {
    id: "p1-compliance-retention-deletion",
    priority: "P1",
    status: "planned",
    title: "Compliance retention/deletion controls",
    owner: "Compliance + Platform",
    target: "4 weeks",
    notes:
      "Imported seed task CT-1. Add policy records, delete-request tracking, and audit-friendly status reporting for retention and deletion workflows.",
  },
  {
    id: "p1-teamsync-addon-practitioner-plan",
    priority: "P1",
    status: "planned",
    title: "Create TeamSync add-on plan for practitioners",
    owner: "Product + TeamSync + Marketing Ops",
    target: "3 weeks",
    notes:
      "Define the practitioner add-on package: capability scope, pricing model, onboarding flow, enablement assets, rollout milestones, and success metrics so coaches can adopt TeamSync faster and scale client delivery.",
  },
  {
    id: "p1-teamsync-planning-pack-integration",
    priority: "P1",
    status: "planned",
    title: "Integrate TeamSync planning pack into Operations roadmap",
    owner: "Product + Operations",
    target: "1 week",
    notes:
      "Load and track the TeamSync planning pack docs in Operations To-Do execution: FUTURE_PATHWAY.md, CODEX_JIRA_BACKLOG_TOKEN_OPTIMIZED_2026-04-24.md, TEAMSYNC_FUNCTIONALITY_IMPLEMENTATION_GUIDE_2026-04-24.md, and CODEX_HANDOFF_TEAMSYNC_2026-04-24.md. Keep progress checkpoints tied to these source documents.",
  },
  {
    id: "p1-due-diligence-resources",
    priority: "P1",
    status: "planned",
    title: "Due Diligence Resources module + weekly system review",
    owner: "Platform + Operations + Finance",
    target: "6 weeks",
    notes:
      "Add an Operations menu item (Due Diligence Resources) that generates investment/sale-ready diligence packs: system architecture and feature inventory, business model narrative, capability evidence, risk/control posture, and optional financial attachments. Include weekly cron-based platform review updates, right-panel report rendering, DOC/PDF download, clear component visuals/diagrams, and a document library for future diligence artifacts (e.g., financial reports, security and compliance packs).",
  },
  {
    id: "p2-enterprise-accounts",
    priority: "P2",
    status: "planned",
    title: "Organization accounts + role matrix",
    owner: "Platform",
    target: "6 weeks",
    notes: "Add org workspaces with owner/admin/member roles and enforce access controls across modules.",
  },
  {
    id: "p2-audit",
    priority: "P2",
    status: "planned",
    title: "Enterprise audit and governance reporting",
    owner: "Platform + Compliance",
    target: "6 weeks",
    notes: "Publish exportable audit timelines, policy states, and governance summaries for enterprise buyers.",
  },
  {
    id: "p2-experiment-lifecycle-tracker",
    priority: "P2",
    status: "planned",
    title: "Experiment lifecycle tracker",
    owner: "Product + Growth",
    target: "5 weeks",
    notes:
      "Imported seed task EL-1. Track experiments through planned, running, analyzing, adopted, and killed states with hypothesis, outcome, and decision notes.",
  },
  {
    id: "p2-weekly-rhythm-workflow",
    priority: "P2",
    status: "planned",
    title: "Weekly rhythm workflow",
    owner: "Operations",
    target: "4 weeks",
    notes:
      "Imported seed task WR-1. Add Monday metrics, Wednesday checkpoint, and Friday decisions workflow with recurring checklists and logged outcomes.",
  },
]

const OPERATIONS_SEED_ASSETS: BacklogAsset[] = [
  { label: "Operations Tasks Seed", href: "/docs/operations/operations-tasks-seed.json", type: "md" },
  { label: "Detailed Operations Spec", href: "/docs/operations/operations-dashboard-detailed-codex-spec.md", type: "md" },
  { label: "Operational Menu Playbook", href: "/docs/operations/operational-menu-codex-playbook.md", type: "md" },
]

const EXECUTION_BACKLOG_ASSETS: Record<string, BacklogAsset[]> = {
  "p0-operations-dashboard-handover": [
    { label: "Operations Handover", href: "/docs/operations/codex-handover-operations-dashboard.md", type: "md" },
    { label: "Detailed Operations Spec", href: "/docs/operations/operations-dashboard-detailed-codex-spec.md", type: "md" },
    { label: "Operational Menu Playbook", href: "/docs/operations/operational-menu-codex-playbook.md", type: "md" },
    { label: "Operations Tasks Seed", href: "/docs/operations/operations-tasks-seed.json", type: "md" },
  ],
  "p0-north-star-kpi": OPERATIONS_SEED_ASSETS,
  "p0-funnel-control": OPERATIONS_SEED_ASSETS,
  "p0-ai-flow-registry": OPERATIONS_SEED_ASSETS,
  "p1-prompt-versioning-rollback": OPERATIONS_SEED_ASSETS,
  "p1-retention-next-best-action-dashboard": OPERATIONS_SEED_ASSETS,
  "p1-pricing-packaging-matrix": OPERATIONS_SEED_ASSETS,
  "p1-gtm-pipeline-board": OPERATIONS_SEED_ASSETS,
  "p1-compliance-retention-deletion": OPERATIONS_SEED_ASSETS,
  "p2-experiment-lifecycle-tracker": OPERATIONS_SEED_ASSETS,
  "p2-weekly-rhythm-workflow": OPERATIONS_SEED_ASSETS,
  "p0-codex-cost-observability": [
    { label: "Operations Tasks Seed", href: "/docs/operations/operations-tasks-seed.json", type: "md" },
    { label: "Detailed Operations Spec", href: "/docs/operations/operations-dashboard-detailed-codex-spec.md", type: "md" },
  ],
  "p1-teamsync-planning-pack-integration": [
    { label: "Future Pathway", href: "/docs/future-pathway.md", type: "md" },
    { label: "Codex Jira Backlog", href: "/docs/codex-jira-backlog-token-optimized-2026-04-24.md", type: "md" },
    { label: "TeamSync Implementation Guide", href: "/docs/teamsync-functionality-implementation-guide-2026-04-24.md", type: "md" },
    { label: "Codex TeamSync Handoff", href: "/docs/codex-handoff-teamsync-2026-04-24.md", type: "md" },
  ],
  "p1-outreach-queue-from-practitioner-data": [
    { label: "NZ Practitioner Prospect Matrix", href: "/docs/outreach/nz_gallup_practitioner_outreach_codex.xlsx", type: "xlsx" },
  ],
  "p1-content-library-cms": [{ label: "Primary To-Do Archive", href: "/docs/todo.md", type: "md" }],
  "p1-due-diligence-resources": [{ label: "Enterprise SaaS Delivery Review", href: "/docs/Personara_Enterprise_SaaS_Delivery_Review.docx", type: "doc" }],
  "p0-legal-policies-rollout": [{ label: "Moat Plan + Legal To-Do", href: "/docs/personara-moat-plan-todo.docx", type: "doc" }],
}

const EMPTY_BACKLOG_ITEM_DRAFT: BacklogItemDraft = {
  title: "",
  priority: "P1",
  status: "planned",
  owner: "",
  target: "",
  notes: "",
}

function createCustomBacklogId(title: string, existingIds: Set<string>) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
  const baseId = `custom-${slug || "roadmap-item"}`
  let nextId = baseId
  let counter = 2

  while (existingIds.has(nextId)) {
    nextId = `${baseId}-${counter}`
    counter += 1
  }

  return nextId
}

function normalizeCustomBacklogItems(value: unknown): CodexBacklogItem[] {
  if (!Array.isArray(value)) return []

  return value
    .filter((item): item is Partial<CodexBacklogItem> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : "",
      priority: item.priority === "P0" || item.priority === "P1" || item.priority === "P2" ? item.priority : "P1",
      status:
        item.status === "planned" ||
        item.status === "ready_for_codex" ||
        item.status === "in_progress" ||
        item.status === "blocked" ||
        item.status === "completed"
          ? item.status
          : "planned",
      title: typeof item.title === "string" ? item.title.trim() : "",
      owner: typeof item.owner === "string" && item.owner.trim() ? item.owner.trim() : "Operations",
      target: typeof item.target === "string" && item.target.trim() ? item.target.trim() : "TBD",
      notes:
        typeof item.notes === "string" && item.notes.trim()
          ? item.notes.trim()
          : "Custom backlog item added from the Operations dashboard.",
    }))
    .filter((item) => item.id.length > 0 && item.title.length > 0)
}

export function OperationsJobsClient() {
  const STALLED_THRESHOLD_MINUTES = 20
  const RECOVERY_LOG_KEY = "personara-operations-recovery-log-v1"
  const OPERATIONS_LAYOUT_PREFS_KEY = "personara-operations-layout-v1"
  const EXECUTION_BACKLOG_ASSETS_KEY = "personara-operations-execution-assets-v1"
  const EXECUTION_BACKLOG_STATE_KEY = "personara-operations-execution-state-v1"
  const CONTENT_LIBRARY_ITEMS_KEY = "personara-operations-content-library-v1"
  const [session, setSession] = useState<Session | null>(null)
  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [message, setMessage] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "failed" | "running" | "queued" | "completed">("all")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [retryingKey, setRetryingKey] = useState("")
  const [candidateHealth, setCandidateHealth] = useState<CandidateHealthRow[]>([])
  const [candidateArchive, setCandidateArchive] = useState<CandidateArchiveRow[]>([])
  const [candidateArchiveFilter, setCandidateArchiveFilter] = useState<"active" | "archived" | "all">("active")
  const [candidateArchiveSearch, setCandidateArchiveSearch] = useState("")
  const [candidateArchiveActionId, setCandidateArchiveActionId] = useState("")
  const [healthInboxState, setHealthInboxState] = useState<Record<string, HealthInboxState>>({})
  const [showDismissedHealthItems, setShowDismissedHealthItems] = useState(false)
  const [healthInboxTableMissing, setHealthInboxTableMissing] = useState(false)
  const [isRecoveringStalled, setIsRecoveringStalled] = useState(false)
  const [recoveryLogs, setRecoveryLogs] = useState<RecoverySweepLog[]>([])
  const [showRecoveryHistory, setShowRecoveryHistory] = useState(false)
  const [activePanel, setActivePanel] = useState<keyof typeof collapsedPanels>("digest")
  const [runHealthMenuOpen, setRunHealthMenuOpen] = useState(false)
  const [marketingToolsMenuOpen, setMarketingToolsMenuOpen] = useState(false)
  const [testerFeedbackMenuOpen, setTesterFeedbackMenuOpen] = useState(false)
  const [candidateMenuOpen, setCandidateMenuOpen] = useState(false)
  const [financialMenuOpen, setFinancialMenuOpen] = useState(false)
  const [quickActionsMenuOpen, setQuickActionsMenuOpen] = useState(false)
  const [executionRoadmapMenuOpen, setExecutionRoadmapMenuOpen] = useState(false)
  const [contentLibraryMenuOpen, setContentLibraryMenuOpen] = useState(false)
  const [activeFinancialView, setActiveFinancialView] = useState<"api" | "marketing" | "revenue">("api")
  const [activeFinancialRange, setActiveFinancialRange] = useState<"daily" | "weekly" | "monthly">("weekly")
  const [activeCodexSpendRange, setActiveCodexSpendRange] = useState<"hour" | "day" | "week" | "month">("day")
  const [activeFinancialRevenueLines, setActiveFinancialRevenueLines] = useState<"total" | "module" | "tier">("total")
  const [activeMarketingView, setActiveMarketingView] = useState<
    "overview" | "teamsync_outreach" | "tester_outreach" | "analytics" | "campaign_manager" | "practitioner_outreach_data"
  >("overview")
  const [collapsedPanels, setCollapsedPanels] = useState({
    controlCenter: false,
    candidateArchive: false,
    marketing: false,
    testerFeedback: false,
    digest: false,
    recovery: false,
    teamsyncOutreach: false,
    healthInbox: false,
    background: false,
    live: false,
    financials: false,
    executionBacklog: false,
    contentLibrary: false,
    securityAudit: false,
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
  const [economics, setEconomics] = useState<OperationsEconomicsResponse | null>(null)
  const [securityAudit, setSecurityAudit] = useState<SecurityAuditResponse | null>(null)
  const [loadingSecurityAudit, setLoadingSecurityAudit] = useState(false)
  const [securityAuditError, setSecurityAuditError] = useState("")
  const [loadingEconomics, setLoadingEconomics] = useState(false)
  const [economicsDrafts, setEconomicsDrafts] = useState<Record<string, EconomicsDraft>>({})
  const [savingEconomicsUserId, setSavingEconomicsUserId] = useState("")
  const [loadingTesterFeedback, setLoadingTesterFeedback] = useState(false)
  const [sendingTesterFeedbackOutreach, setSendingTesterFeedbackOutreach] = useState(false)
  const [reviewingTesterFeedbackId, setReviewingTesterFeedbackId] = useState("")
  const [deletingTesterFeedbackIds, setDeletingTesterFeedbackIds] = useState<string[]>([])
  const [testerAudienceStatus, setTesterAudienceStatus] = useState<"all" | "open" | "in_review" | "resolved">("open")
  const [testerAudienceModule, setTesterAudienceModule] = useState("all")
  const [testerOutreachSubject, setTesterOutreachSubject] = useState("Personara tester follow-up")
  const [testerOutreachMessage, setTesterOutreachMessage] = useState(
    "I noticed you have been testing Personara.ai. Thank you.\n\nIf you have 15 minutes this week, I would love to learn what worked well and what should improve.\n\nPlease reply with a suitable time and we will align to your schedule."
  )
  const [executionBacklogCustomAssets, setExecutionBacklogCustomAssets] = useState<Record<string, BacklogAsset[]>>({})
  const [backlogAssetDrafts, setBacklogAssetDrafts] = useState<Record<string, BacklogAssetDraft>>({})
  const [executionBacklogCustomItems, setExecutionBacklogCustomItems] = useState<CodexBacklogItem[]>([])
  const [backlogItemDraft, setBacklogItemDraft] = useState<BacklogItemDraft>(EMPTY_BACKLOG_ITEM_DRAFT)
  const [executionBacklogOrder, setExecutionBacklogOrder] = useState<string[]>(CODEX_EXECUTION_BACKLOG.map((item) => item.id))
  const [executionBacklogArchivedIds, setExecutionBacklogArchivedIds] = useState<string[]>([])
  const [executionBacklogDeletedIds, setExecutionBacklogDeletedIds] = useState<string[]>([])
  const [executionBacklogStatusOverrides, setExecutionBacklogStatusOverrides] = useState<Record<string, CodexBacklogItem["status"]>>({})
  const [showArchivedBacklog, setShowArchivedBacklog] = useState(false)
  const [contentLibraryItems, setContentLibraryItems] = useState<ContentLibraryItem[]>([])
  const [contentLibraryDraft, setContentLibraryDraft] = useState<ContentLibraryDraft>({
    title: "",
    href: "",
    type: "doc",
    section: "operations",
    notes: "",
  })
  const [contentLibrarySelectedFileName, setContentLibrarySelectedFileName] = useState("")
  const [loadingContentLibraryFile, setLoadingContentLibraryFile] = useState(false)
  const contentLibraryFileInputRef = useRef<HTMLInputElement | null>(null)
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
            candidateArchive: true,
            marketing: true,
            testerFeedback: true,
            digest: false,
            recovery: true,
            teamsyncOutreach: true,
            healthInbox: true,
            background: true,
            live: true,
            financials: true,
            executionBacklog: false,
            contentLibrary: false,
            securityAudit: false,
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
    try {
      const raw = window.localStorage.getItem(EXECUTION_BACKLOG_ASSETS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Record<string, BacklogAsset[]>
      if (parsed && typeof parsed === "object") {
        setExecutionBacklogCustomAssets(parsed)
      }
    } catch {}
  }, [EXECUTION_BACKLOG_ASSETS_KEY])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(EXECUTION_BACKLOG_STATE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<ExecutionBacklogState>
      if (Array.isArray(parsed.order)) {
        setExecutionBacklogOrder(parsed.order.filter((id): id is string => typeof id === "string" && id.length > 0))
      }
      if (Array.isArray(parsed.archivedIds)) {
        setExecutionBacklogArchivedIds(parsed.archivedIds.filter((id): id is string => typeof id === "string" && id.length > 0))
      }
      if (Array.isArray(parsed.deletedIds)) {
        setExecutionBacklogDeletedIds(parsed.deletedIds.filter((id): id is string => typeof id === "string" && id.length > 0))
      }
      if (parsed.statusOverrides && typeof parsed.statusOverrides === "object") {
        setExecutionBacklogStatusOverrides(parsed.statusOverrides as Record<string, CodexBacklogItem["status"]>)
      }
      if (Array.isArray(parsed.customItems)) {
        setExecutionBacklogCustomItems(normalizeCustomBacklogItems(parsed.customItems))
      }
    } catch {}
  }, [EXECUTION_BACKLOG_STATE_KEY])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(CONTENT_LIBRARY_ITEMS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as ContentLibraryItem[]
      if (Array.isArray(parsed)) {
        setContentLibraryItems(
          parsed.filter(
            (item) =>
              item &&
              typeof item.id === "string" &&
              typeof item.title === "string" &&
              typeof item.href === "string" &&
              typeof item.type === "string" &&
              typeof item.section === "string"
          )
        )
      }
    } catch {}
  }, [CONTENT_LIBRARY_ITEMS_KEY])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(RECOVERY_LOG_KEY, JSON.stringify(recoveryLogs))
  }, [RECOVERY_LOG_KEY, recoveryLogs])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(OPERATIONS_LAYOUT_PREFS_KEY, JSON.stringify({ collapsedPanels }))
  }, [OPERATIONS_LAYOUT_PREFS_KEY, collapsedPanels])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(EXECUTION_BACKLOG_ASSETS_KEY, JSON.stringify(executionBacklogCustomAssets))
  }, [EXECUTION_BACKLOG_ASSETS_KEY, executionBacklogCustomAssets])

  useEffect(() => {
    if (typeof window === "undefined") return
    const payload: ExecutionBacklogState = {
      order: executionBacklogOrder,
      archivedIds: executionBacklogArchivedIds,
      deletedIds: executionBacklogDeletedIds,
      statusOverrides: executionBacklogStatusOverrides,
      customItems: executionBacklogCustomItems,
    }
    window.localStorage.setItem(EXECUTION_BACKLOG_STATE_KEY, JSON.stringify(payload))
  }, [
    EXECUTION_BACKLOG_STATE_KEY,
    executionBacklogOrder,
    executionBacklogArchivedIds,
    executionBacklogDeletedIds,
    executionBacklogStatusOverrides,
    executionBacklogCustomItems,
  ])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(CONTENT_LIBRARY_ITEMS_KEY, JSON.stringify(contentLibraryItems))
  }, [CONTENT_LIBRARY_ITEMS_KEY, contentLibraryItems])

  const allExecutionBacklogItems = useMemo(() => {
    const byId = new Map<string, CodexBacklogItem>()
    for (const item of CODEX_EXECUTION_BACKLOG) {
      byId.set(item.id, item)
    }
    for (const item of executionBacklogCustomItems) {
      if (!byId.has(item.id)) {
        byId.set(item.id, item)
      }
    }
    return [...byId.values()]
  }, [executionBacklogCustomItems])

  function updateBacklogItemDraft(patch: Partial<BacklogItemDraft>) {
    setBacklogItemDraft((current) => ({ ...current, ...patch }))
  }

  function addBacklogItem() {
    const title = backlogItemDraft.title.trim()
    if (!title) {
      setMessage("Add a backlog item title before saving.")
      return
    }

    const existingIds = new Set(allExecutionBacklogItems.map((item) => item.id))
    const item: CodexBacklogItem = {
      id: createCustomBacklogId(title, existingIds),
      priority: backlogItemDraft.priority,
      status: backlogItemDraft.status,
      title,
      owner: backlogItemDraft.owner.trim() || "Operations",
      target: backlogItemDraft.target.trim() || "TBD",
      notes: backlogItemDraft.notes.trim() || "Custom backlog item added from the Operations dashboard.",
    }

    setExecutionBacklogCustomItems((current) => [...current, item])
    setExecutionBacklogOrder((current) => {
      if (current.includes(item.id)) return current
      return current.length > 0 ? [...current, item.id] : [...allExecutionBacklogItems.map((backlogItem) => backlogItem.id), item.id]
    })
    setBacklogItemDraft(EMPTY_BACKLOG_ITEM_DRAFT)
    setMessage("Backlog item added.")
  }

  function updateBacklogAssetDraft(itemId: string, patch: Partial<BacklogAssetDraft>) {
    setBacklogAssetDrafts((current) => ({
      ...current,
      [itemId]: {
        label: current[itemId]?.label ?? "",
        href: current[itemId]?.href ?? "",
        type: current[itemId]?.type ?? "doc",
        ...patch,
      },
    }))
  }

  function addBacklogAsset(itemId: string) {
    const draft = backlogAssetDrafts[itemId]
    if (!draft?.label?.trim() || !draft?.href?.trim()) {
      setMessage("Add both a file label and a file path before saving.")
      return
    }

    const cleaned: BacklogAsset = {
      label: draft.label.trim(),
      href: draft.href.trim(),
      type: draft.type,
    }

    setExecutionBacklogCustomAssets((current) => {
      const existing = current[itemId] ?? []
      return { ...current, [itemId]: [...existing, cleaned] }
    })
    setBacklogAssetDrafts((current) => ({ ...current, [itemId]: { label: "", href: "", type: draft.type } }))
    setMessage("File reference added to roadmap item.")
  }

  function removeBacklogAsset(itemId: string, assetIndex: number) {
    setExecutionBacklogCustomAssets((current) => {
      const existing = current[itemId] ?? []
      const next = existing.filter((_, index) => index !== assetIndex)
      if (next.length === 0) {
        const cloned = { ...current }
        delete cloned[itemId]
        return cloned
      }
      return { ...current, [itemId]: next }
    })
    setMessage("File reference removed.")
  }

  function archiveBacklogItem(itemId: string) {
    setExecutionBacklogArchivedIds((current) => (current.includes(itemId) ? current : [...current, itemId]))
    setMessage("Roadmap item archived.")
  }

  function unarchiveBacklogItem(itemId: string) {
    setExecutionBacklogArchivedIds((current) => current.filter((id) => id !== itemId))
    setMessage("Roadmap item restored from archive.")
  }

  function deleteBacklogItem(itemId: string) {
    setExecutionBacklogDeletedIds((current) => (current.includes(itemId) ? current : [...current, itemId]))
    setExecutionBacklogArchivedIds((current) => current.filter((id) => id !== itemId))
    setMessage("Roadmap item deleted.")
  }

  function moveBacklogItem(itemId: string, direction: "up" | "down") {
    setExecutionBacklogOrder((current) => {
      const ids = current.length > 0 ? [...current] : allExecutionBacklogItems.map((item) => item.id)
      const index = ids.indexOf(itemId)
      if (index === -1) return ids
      const swapWith = direction === "up" ? index - 1 : index + 1
      if (swapWith < 0 || swapWith >= ids.length) return ids
      const [moved] = ids.splice(index, 1)
      ids.splice(swapWith, 0, moved)
      return ids
    })
  }

  async function runBacklogItemInCodex(item: CodexBacklogItem, assets: BacklogAsset[]) {
    const prompt = [
      `Execute roadmap item: ${item.title}`,
      `Priority: ${item.priority}`,
      `Owner: ${item.owner}`,
      `Target: ${item.target}`,
      `Status: ${item.status}`,
      `Notes: ${item.notes}`,
      assets.length > 0
        ? `Attached files:\n${assets.map((asset) => `- ${asset.label}: ${asset.href}`).join("\n")}`
        : "Attached files: none",
      "Deliverables: implementation, validation, and a short completion report with risks + next steps.",
    ].join("\n\n")

    try {
      await navigator.clipboard.writeText(prompt)
      setExecutionBacklogStatusOverrides((current) => ({ ...current, [item.id]: "ready_for_codex" }))
      setMessage("Codex brief copied. Paste it into Codex to start the work, then mark this item in progress.")
    } catch {
      setExecutionBacklogStatusOverrides((current) => ({ ...current, [item.id]: "ready_for_codex" }))
      setMessage("Codex brief prepared. Clipboard access failed in this browser session, so copy the item details manually before marking it in progress.")
    }
  }

  const orderedBacklogItems = useMemo(() => {
    const allIds = allExecutionBacklogItems.map((item) => item.id)
    const ids = executionBacklogOrder.length > 0 ? executionBacklogOrder : allIds
    const idSet = new Set(ids)
    const completedOrder = [...ids, ...allIds.filter((id) => !idSet.has(id))]
    const byId = new Map(allExecutionBacklogItems.map((item) => [item.id, item]))

    return completedOrder
      .map((id) => byId.get(id))
      .filter((item): item is CodexBacklogItem => Boolean(item))
      .filter((item) => !executionBacklogDeletedIds.includes(item.id))
      .filter((item) => (showArchivedBacklog ? true : !executionBacklogArchivedIds.includes(item.id)))
      .map((item) => ({
        ...item,
        status: executionBacklogStatusOverrides[item.id] ?? item.status,
      }))
  }, [
    allExecutionBacklogItems,
    executionBacklogOrder,
    executionBacklogDeletedIds,
    showArchivedBacklog,
    executionBacklogArchivedIds,
    executionBacklogStatusOverrides,
  ])

  const loadOverview = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const response = await fetch("/api/admin/jobs/overview", {
        cache: "no-store",
        headers: await getAuthHeaders(),
      })
      const json = await parseApiJson(response, "jobs overview")
      if (!response.ok) {
        throw new Error(readApiError(json, "Failed to load jobs monitor"))
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
      const json = await parseApiJson(response, "candidate health")
      if (!response.ok) {
        throw new Error(readApiError(json, "Failed to load candidate health"))
      }
      setCandidateHealth((json.candidates ?? []) as CandidateHealthRow[])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load candidate health")
    }
  }, [])

  const loadCandidateArchive = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/overview", {
        cache: "no-store",
        headers: await getAuthHeaders(),
      })
      const json = await parseApiJson(response, "candidate archive")
      if (!response.ok) {
        throw new Error(readApiError(json, "Failed to load candidate archive"))
      }
      setCandidateArchive((json.candidate_directory ?? []) as CandidateArchiveRow[])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load candidate archive")
    }
  }, [])

  const loadHealthInboxState = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/health-inbox", {
        cache: "no-store",
        headers: await getAuthHeaders(),
      })
      const json = await parseApiJson(response, "health inbox")
      if (!response.ok) {
        throw new Error(readApiError(json, "Failed to load health inbox state"))
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
      const json = await parseApiJson(response, "TeamSync outreach")
      if (!response.ok) {
        throw new Error(readApiError(json, "Failed to load TeamSync outreach"))
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

      const notesJson = await parseApiJson(notesResponse, "tester notes")
      const campaignsJson = await parseApiJson(campaignsResponse, "tester outreach campaigns")

      if (!notesResponse.ok) {
        throw new Error(readApiError(notesJson, "Failed to load tester notes"))
      }
      if (!campaignsResponse.ok) {
        throw new Error(readApiError(campaignsJson, "Failed to load tester outreach campaigns"))
      }

      setTesterFeedbackNotes((notesJson.notes ?? []) as TesterFeedbackNoteRow[])
      setTesterFeedbackCampaigns((campaignsJson.campaigns ?? []) as TesterFeedbackOutreachCampaignRow[])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load tester feedback")
    } finally {
      setLoadingTesterFeedback(false)
    }
  }, [])

  const loadEconomics = useCallback(async () => {
    setLoadingEconomics(true)
    try {
      const response = await fetch("/api/admin/economics", {
        cache: "no-store",
        headers: await getAuthHeaders(),
      })
      const json = await parseApiJson(response, "financial summary")
      if (!response.ok) {
        throw new Error(readApiError(json, "Failed to load financial summary"))
      }
      setEconomics(json as OperationsEconomicsResponse)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load financial summary")
    } finally {
      setLoadingEconomics(false)
    }
  }, [])

  const loadSecurityAudit = useCallback(async () => {
    setLoadingSecurityAudit(true)
    setSecurityAuditError("")
    try {
      const response = await fetch("/api/admin/security-audit", {
        cache: "no-store",
        headers: await getAuthHeaders(),
      })
      const json = await parseApiJson(response, "security audit")
      if (!response.ok) {
        throw new Error(readApiError(json, "Failed to load security audit"))
      }
      setSecurityAudit(json as SecurityAuditResponse)
    } catch (error) {
      setSecurityAudit(null)
      setSecurityAuditError(error instanceof Error ? error.message : "Failed to load security audit")
    } finally {
      setLoadingSecurityAudit(false)
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
      const json = await parseApiJson(response, "send tester outreach")
      if (!response.ok) {
        throw new Error(readApiError(json, "Could not send tester outreach"))
      }
      setMessage(`Tester outreach sent to ${json.recipients_sent ?? 0} users.`)
      await loadTesterFeedback()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send tester outreach")
    } finally {
      setSendingTesterFeedbackOutreach(false)
    }
  }, [loadTesterFeedback, testerAudienceModule, testerAudienceStatus, testerOutreachMessage, testerOutreachSubject])

  async function updateTesterFeedbackNote(
    noteId: string,
    updates: { status?: TesterFeedbackNoteRow["status"]; severity?: TesterFeedbackNoteRow["severity"] }
  ) {
    setReviewingTesterFeedbackId(noteId)
    setMessage("")
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
      const json = await parseApiJson(response, "update tester note")
      if (!response.ok) {
        throw new Error(readApiError(json, "Could not update tester note"))
      }
      const updated = json.note as TesterFeedbackNoteRow
      setTesterFeedbackNotes((current) => current.map((note) => (note.id === updated.id ? updated : note)))
      setMessage("Tester feedback note updated.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update tester note")
    } finally {
      setReviewingTesterFeedbackId("")
    }
  }

  async function deleteResolvedTesterFeedbackNotes(notes: TesterFeedbackNoteRow[], label: string) {
    const resolvedIds = notes.filter((note) => note.status === "resolved").map((note) => note.id)
    if (resolvedIds.length === 0) {
      setMessage("No resolved tester feedback notes selected for deletion.")
      return
    }

    const confirmed = window.confirm(
      `Delete ${resolvedIds.length} resolved tester feedback note${resolvedIds.length === 1 ? "" : "s"} from ${label}? Open and in-review notes will be kept.`
    )
    if (!confirmed) return

    setDeletingTesterFeedbackIds(resolvedIds)
    setMessage("")
    try {
      const response = await fetch("/api/admin/tester-notes", {
        method: "DELETE",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: resolvedIds }),
      })
      const json = await parseApiJson(response, "delete resolved tester notes")
      if (!response.ok) {
        throw new Error(readApiError(json, "Could not delete resolved tester notes"))
      }

      const deletedIds = new Set((json.deleted_ids ?? []) as string[])
      setTesterFeedbackNotes((current) => current.filter((note) => !deletedIds.has(note.id)))
      setMessage(
        `Deleted ${json.deleted_count ?? deletedIds.size} resolved tester feedback note${(json.deleted_count ?? deletedIds.size) === 1 ? "" : "s"}.`
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete resolved tester notes")
    } finally {
      setDeletingTesterFeedbackIds([])
    }
  }

  async function pushTesterFeedbackToCodex(label: string, notes: TesterFeedbackNoteRow[]) {
    const activeNotes = notes.filter((note) => note.status !== "resolved")
    const notesForPrompt = activeNotes.length > 0 ? activeNotes : notes
    const prompt = [
      `Review and fix tester feedback for: ${label}`,
      "Context: These notes came from the public in-app Tester Feedback widget and should be turned into a small, focused CODEX change.",
      "Instructions: inspect the relevant route/components, merge duplicate issues, implement the safest high-impact fix, run npm.cmd run build, and report the diff summary.",
      "",
      ...notesForPrompt.slice(0, 20).map((note, index) =>
        [
          `Feedback ${index + 1}`,
          `Route: ${testerFeedbackRouteLabel(note)}`,
          `Module: ${note.module || "unknown"}`,
          `Status: ${note.status}`,
          `Severity: ${note.severity}`,
          `Tester: ${note.user_email || note.user_id || "unknown"}`,
          `Message: ${note.message || "No message"}`,
        ].join("\n")
      ),
    ].join("\n\n")

    try {
      await navigator.clipboard.writeText(prompt)
      setMessage("Tester feedback Codex handoff copied to clipboard.")
    } catch {
      setMessage("Tester feedback Codex handoff prepared. Clipboard access failed in this browser session.")
    }
  }

  useEffect(() => {
    async function load() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()
      setSession(currentSession)
      if (currentSession?.access_token) {
        await loadOverview()
        await loadCandidateHealth()
        await loadCandidateArchive()
        await loadHealthInboxState()
        await loadEconomics()
        await loadSecurityAudit()
      }
    }

    void load()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })
    return () => subscription.unsubscribe()
  }, [loadCandidateArchive, loadCandidateHealth, loadEconomics, loadHealthInboxState, loadOverview, loadSecurityAudit])

  useEffect(() => {
    if (!overview?.permissions.is_superuser) return
    void loadTeamSyncOutreach()
    void loadTesterFeedback()
  }, [overview?.permissions.is_superuser, loadTeamSyncOutreach, loadTesterFeedback])

  useEffect(() => {
    if (!economics?.users?.length) return
    setEconomicsDrafts((current) => {
      const next = { ...current }
      for (const row of economics.users) {
        if (next[row.user_id]) continue
        next[row.user_id] = {
          subscription: String(row.monthly_subscription_usd ?? 0),
          budget: row.monthly_api_budget_usd === null ? "" : String(row.monthly_api_budget_usd),
          notes: row.notes ?? "",
        }
      }
      return next
    })
  }, [economics])

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

  const candidateArchiveCounts = useMemo(() => {
    const archived = candidateArchive.filter((candidate) => Boolean(candidate.deleted_at)).length
    return {
      active: candidateArchive.length - archived,
      archived,
      total: candidateArchive.length,
    }
  }, [candidateArchive])

  const filteredCandidateArchive = useMemo(() => {
    const query = candidateArchiveSearch.trim().toLowerCase()
    return candidateArchive.filter((candidate) => {
      const isArchived = Boolean(candidate.deleted_at)
      if (candidateArchiveFilter === "active" && isArchived) return false
      if (candidateArchiveFilter === "archived" && !isArchived) return false
      if (!query) return true

      const haystack = [
        candidate.full_name,
        candidate.city,
        candidate.primary_goal,
        candidate.user_id,
        candidate.id,
      ]
        .filter((value): value is string => Boolean(value))
        .join(" ")
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [candidateArchive, candidateArchiveFilter, candidateArchiveSearch])

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
    const high = testerFeedbackNotes.filter((row) => row.severity === "high").length
    return {
      open,
      inReview,
      resolved,
      high,
      campaigns: testerFeedbackCampaigns.length,
    }
  }, [testerFeedbackCampaigns.length, testerFeedbackNotes])

  const testerFeedbackPageGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string
        label: string
        route: string
        module: string
        notes: TesterFeedbackNoteRow[]
        open: number
        inReview: number
        resolved: number
        high: number
        latestAt: number
      }
    >()

    for (const note of testerFeedbackNotes) {
      const key = testerFeedbackPageKey(note)
      const route = testerFeedbackRouteLabel(note)
      const current =
        groups.get(key) ??
        {
          key,
          label: note.page_title || route,
          route,
          module: note.module || "Unknown module",
          notes: [],
          open: 0,
          inReview: 0,
          resolved: 0,
          high: 0,
          latestAt: 0,
        }
      current.notes.push(note)
      if (note.status === "open") current.open += 1
      if (note.status === "in_review") current.inReview += 1
      if (note.status === "resolved") current.resolved += 1
      if (note.severity === "high") current.high += 1
      current.latestAt = Math.max(current.latestAt, Date.parse(note.created_at || "") || 0)
      groups.set(key, current)
    }

    return Array.from(groups.values()).sort((a, b) => {
      const aActive = a.open + a.inReview
      const bActive = b.open + b.inReview
      if (a.high !== b.high) return b.high - a.high
      if (aActive !== bActive) return bActive - aActive
      return b.latestAt - a.latestAt
    })
  }, [testerFeedbackNotes])

  const stalledRunningCount = useMemo(() => {
    if (!overview) return 0
    const cutoff = Date.now() - STALLED_THRESHOLD_MINUTES * 60 * 1000
    const isStalledRunning = (item: { status: string; started_at: string | null }) =>
      item.status === "running" && item.started_at && new Date(item.started_at).getTime() <= cutoff

    const backgroundStalled = overview.background_jobs.filter(isStalledRunning).length
    const liveStalled = overview.live_runs.filter(isStalledRunning).length
    return backgroundStalled + liveStalled
  }, [overview, STALLED_THRESHOLD_MINUTES])

  const financialGuardrail = useMemo(() => {
    if (!economics) return null
    const revenue = Number(economics.summary.total_revenue_usd || 0)
    const spend = Number(economics.summary.total_api_cost_usd || 0)
    const margin = Number(economics.summary.total_margin_usd || 0)
    const overBudgetUsers = Number(economics.summary.over_budget_users || 0)
    const unprofitableUsers = Number(economics.summary.unprofitable_users || 0)
    const apiCostRatio = revenue > 0 ? spend / revenue : spend > 0 ? 1 : 0

    if (margin < 0 || unprofitableUsers > 0 || apiCostRatio >= 1) {
      return {
        toneClass: "border-rose-300 bg-rose-50 text-rose-900",
        label: "Loss-making",
        guidance: "Immediate action: throttle high-cost automations and review unprofitable accounts.",
      }
    }
    if (apiCostRatio >= 0.65 || overBudgetUsers > 0) {
      return {
        toneClass: "border-amber-300 bg-amber-50 text-amber-900",
        label: "Watch closely",
        guidance: "Tighten spend caps and monitor premium runs before margins slip.",
      }
    }
    return {
      toneClass: "border-emerald-300 bg-emerald-50 text-emerald-900",
      label: "Healthy",
      guidance: "Margins are in range. Keep weekly spend monitoring active.",
    }
  }, [economics])

  const securityAuditSummary = useMemo(() => {
    const routes = securityAudit?.routes ?? []
    const summary = securityAudit?.summary
    const adminWriteRoutes = routes.filter((item) => item.access === "admin")
    const superuserProtectedCount = summary?.superuser_protected_count ?? routes.filter((item) => item.access === "superuser").length
    const totalWriteRoutes = summary?.total_write_routes ?? routes.length

    return {
      totalWriteRoutes,
      superuserProtectedCount,
      adminWriteCount: summary?.admin_write_count ?? adminWriteRoutes.length,
      adminWriteRoutes,
      coveragePct:
        summary?.coverage_pct ?? Math.round((superuserProtectedCount / Math.max(totalWriteRoutes, 1)) * 100),
    }
  }, [securityAudit])

  const economicsRows = useMemo(() => economics?.users ?? [], [economics])
  const financialTrendSeries = useMemo(() => {
    if (!economics?.trends) return []
    if (activeFinancialRange === "daily") return economics.trends.daily
    if (activeFinancialRange === "monthly") return economics.trends.monthly
    return economics.trends.weekly
  }, [economics, activeFinancialRange])
  const moduleRevenueTrendSeries = useMemo(() => {
    const rows = economics?.trends?.module_lines ?? []
    return rows.map((series) => ({
      key: series.key,
      label: series.label,
      points:
        activeFinancialRange === "daily"
          ? series.daily
          : activeFinancialRange === "monthly"
            ? series.monthly
            : series.weekly,
    }))
  }, [economics, activeFinancialRange])
  const tierRevenueTrendSeries = useMemo(() => {
    const rows = economics?.trends?.tier_lines ?? []
    return rows.map((series) => ({
      key: series.key,
      label: series.label,
      points:
        activeFinancialRange === "daily"
          ? series.daily
          : activeFinancialRange === "monthly"
            ? series.monthly
            : series.weekly,
    }))
  }, [economics, activeFinancialRange])
  const visibleRevenueTrendSeries = useMemo(() => {
    if (activeFinancialRevenueLines === "module") return moduleRevenueTrendSeries
    if (activeFinancialRevenueLines === "tier") return tierRevenueTrendSeries
    return []
  }, [activeFinancialRevenueLines, moduleRevenueTrendSeries, tierRevenueTrendSeries])
  const codexSpendTrendSeries = useMemo(() => {
    const codexSeries = economics?.trends?.codex_spend
    if (!codexSeries) return []
    if (activeCodexSpendRange === "hour") return codexSeries.hour
    if (activeCodexSpendRange === "week") return codexSeries.week
    if (activeCodexSpendRange === "month") return codexSeries.month
    return codexSeries.day
  }, [economics, activeCodexSpendRange])
  const seededWeeklyRevenue = useMemo(() => Number(economics?.trends?.seeded_weekly_revenue_usd || 100), [economics])
  const negativeMarginRows = useMemo(
    () => economicsRows.filter((row) => row.profitability === "negative"),
    [economicsRows]
  )
  const overBudgetRows = useMemo(
    () => economicsRows.filter((row) => row.budget_status === "over_budget"),
    [economicsRows]
  )
  const watchBudgetRows = useMemo(
    () => economicsRows.filter((row) => row.budget_status === "watch"),
    [economicsRows]
  )

  async function saveEconomicsDraft(userId: string) {
    if (!overview?.permissions.is_superuser) return
    const draft = economicsDrafts[userId]
    if (!draft) return

    setSavingEconomicsUserId(userId)
    setMessage("")
    try {
      const subscription = Number(draft.subscription)
      if (!Number.isFinite(subscription) || subscription < 0) {
        throw new Error("Monthly subscription must be a valid number.")
      }

      const budgetRaw = draft.budget.trim()
      const budget = budgetRaw.length === 0 ? null : Number(budgetRaw)
      if (budget !== null && (!Number.isFinite(budget) || budget < 0)) {
        throw new Error("Monthly API budget must be blank or a valid positive number.")
      }

      const response = await fetch("/api/admin/economics", {
        method: "PATCH",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          monthly_subscription_usd: subscription,
          monthly_api_budget_usd: budget,
          notes: draft.notes || null,
        }),
      })
      const json = await parseApiJson(response, "save financial settings")
      if (!response.ok) {
        throw new Error(readApiError(json, "Could not save user economics settings"))
      }
      setMessage("User financial settings updated.")
      await loadEconomics()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save user financial settings")
    } finally {
      setSavingEconomicsUserId("")
    }
  }

  const runStalledRecoverySweep = useCallback(async (auto = false) => {
    setIsRecoveringStalled(true)
    try {
      const response = await fetch(`/api/admin/jobs/recover-stalled?minutes=${STALLED_THRESHOLD_MINUTES}`, {
        method: "POST",
        headers: await getAuthHeaders(),
      })
      const json = await parseApiJson(response, "recover stalled jobs")
      if (!response.ok) {
        throw new Error(readApiError(json, "Failed to run stalled recovery"))
      }
      const summary = (json.summary ?? {}) as RecoverySummaryPayload
      const recovered = Number(summary.recovered_background ?? 0) + Number(summary.recovered_live ?? 0)
      const scanned = Number(summary.scanned_background ?? 0) + Number(summary.scanned_live ?? 0)
      const errorDetails = Array.isArray(summary.errors) ? summary.errors : []
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
    const json = await parseApiJson(response, "update health inbox")
    if (!response.ok) {
      throw new Error(readApiError(json, "Failed to update health inbox state"))
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
      const json = await parseApiJson(response, "reset health inbox")
      if (!response.ok) {
        throw new Error(readApiError(json, "Failed to reset state"))
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
      const json = await parseApiJson(response, "queue TeamSync outreach")
      if (!response.ok) {
        throw new Error(readApiError(json, "Failed to build TeamSync outreach queue"))
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
      const json = await parseApiJson(response, "send TeamSync outreach")
      if (!response.ok) {
        throw new Error(readApiError(json, "Failed to send TeamSync outreach campaign"))
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
      const json = await parseApiJson(response, "retry background job")
      if (!response.ok) {
        throw new Error(readApiError(json, "Failed to retry background job"))
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
      const json = await parseApiJson(response, "retry live run")
      if (!response.ok) {
        throw new Error(readApiError(json, "Failed to retry live job run"))
      }
      setMessage("Live job run queued again.")
      await loadOverview()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to retry live job run")
    } finally {
      setRetryingKey("")
    }
  }

  async function archiveCandidate(candidate: CandidateArchiveRow) {
    if (candidate.deleted_at) return
    const name = candidate.full_name || candidate.id
    const confirmation = window.prompt(
      `Type ARCHIVE to archive candidate workspace${name ? ` for ${name}` : ""}. This is reversible during the retention window.`
    )
    if (confirmation !== "ARCHIVE") {
      setMessage("Candidate archive cancelled.")
      return
    }

    setCandidateArchiveActionId(candidate.id)
    setMessage("")

    try {
      const response = await fetch(`/api/admin/candidates/${candidate.id}`, {
        method: "DELETE",
        headers: await getAuthHeaders(),
      })
      const json = await parseApiJson(response, "archive candidate")
      if (!response.ok) {
        throw new Error(readApiError(json, "Failed to archive candidate"))
      }
      setMessage(`Candidate archived: ${name}`)
      await Promise.all([loadCandidateArchive(), loadCandidateHealth()])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to archive candidate")
    } finally {
      setCandidateArchiveActionId("")
    }
  }

  async function restoreCandidate(candidate: CandidateArchiveRow) {
    if (!candidate.deleted_at) return
    const name = candidate.full_name || candidate.id
    setCandidateArchiveActionId(candidate.id)
    setMessage("")

    try {
      const response = await fetch(`/api/admin/candidates/${candidate.id}/restore`, {
        method: "POST",
        headers: await getAuthHeaders(),
      })
      const json = await parseApiJson(response, "restore candidate")
      if (!response.ok) {
        throw new Error(readApiError(json, "Failed to restore candidate"))
      }
      setMessage(`Candidate restored: ${name}`)
      await Promise.all([loadCandidateArchive(), loadCandidateHealth()])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to restore candidate")
    } finally {
      setCandidateArchiveActionId("")
    }
  }

  function togglePanel(panel: keyof typeof collapsedPanels) {
    setCollapsedPanels((current) => ({ ...current, [panel]: !current[panel] }))
  }

  function toggleOperationsMenu(group: OperationsMenuGroup) {
    const current = {
      runHealth: runHealthMenuOpen,
      marketingTools: marketingToolsMenuOpen,
      testerFeedback: testerFeedbackMenuOpen,
      candidateManagement: candidateMenuOpen,
      financials: financialMenuOpen,
      executionRoadmap: executionRoadmapMenuOpen,
      contentLibrary: contentLibraryMenuOpen,
      quickActions: quickActionsMenuOpen,
    }
    const nextOpen = !current[group]
    setRunHealthMenuOpen(group === "runHealth" ? nextOpen : false)
    setMarketingToolsMenuOpen(group === "marketingTools" ? nextOpen : false)
    setTesterFeedbackMenuOpen(group === "testerFeedback" ? nextOpen : false)
    setCandidateMenuOpen(group === "candidateManagement" ? nextOpen : false)
    setFinancialMenuOpen(group === "financials" ? nextOpen : false)
    setExecutionRoadmapMenuOpen(group === "executionRoadmap" ? nextOpen : false)
    setContentLibraryMenuOpen(group === "contentLibrary" ? nextOpen : false)
    setQuickActionsMenuOpen(group === "quickActions" ? nextOpen : false)
  }

  function addContentLibraryItem() {
    const title = contentLibraryDraft.title.trim()
    const href = contentLibraryDraft.href.trim()
    if (!title || !href) {
      setMessage("Content Library: add a title and either choose a file or enter a file path/link.")
      return
    }
    const item: ContentLibraryItem = {
      id: crypto.randomUUID(),
      title,
      href,
      type: contentLibraryDraft.type,
      section: contentLibraryDraft.section,
      notes: contentLibraryDraft.notes.trim() || undefined,
      created_at: new Date().toISOString(),
    }
    setContentLibraryItems((current) => [item, ...current])
    setContentLibraryDraft({
      title: "",
      href: "",
      type: contentLibraryDraft.type,
      section: contentLibraryDraft.section,
      notes: "",
    })
    setContentLibrarySelectedFileName("")
    setMessage("Content Library item added.")
  }

  function removeContentLibraryItem(id: string) {
    setContentLibraryItems((current) => current.filter((item) => item.id !== id))
  }

  function openContentLibraryFilePicker() {
    contentLibraryFileInputRef.current?.click()
  }

  async function onContentLibraryFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setLoadingContentLibraryFile(true)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "")
        reader.onerror = () => reject(new Error("Could not read the selected file."))
        reader.readAsDataURL(file)
      })
      if (!dataUrl) {
        throw new Error("Selected file could not be converted for upload.")
      }
      const nextType = inferContentLibraryType(file.name)
      setContentLibraryDraft((current) => ({
        ...current,
        title: current.title.trim().length > 0 ? current.title : titleFromFileName(file.name),
        href: dataUrl,
        type: nextType,
      }))
      setContentLibrarySelectedFileName(file.name)
      setMessage(`Content Library: ${file.name} selected. Click Add content to save it.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not process selected file.")
    } finally {
      setLoadingContentLibraryFile(false)
      if (event.currentTarget) {
        event.currentTarget.value = ""
      }
    }
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
          scrollToElementWithOffset(target)
        }, 80)
      }
    }
  }

  const isPanelVisible = useCallback(
    (panel: keyof typeof collapsedPanels) => activePanel === panel,
    [activePanel]
  )
  const campaignManagerUrl = process.env.NEXT_PUBLIC_AD_CAMPAIGN_MANAGER_URL?.trim() || ""
  const practitionerOutreachDataUrl = "/docs/outreach/nz_gallup_practitioner_outreach_codex.xlsx"

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
                className="mt-2 inline-flex rounded-full border border-[#cbd8eb] bg-white px-2.5 py-1 text-xs font-semibold text-[#36537d] hover:bg-[#f4f8ff]"
              >
                Back to platform
              </Link>
              {overview.permissions.is_superuser ? (
                <section className="mt-2 rounded-xl border border-[#c7d8ee] bg-white">
                  <button
                    type="button"
                    onClick={() => toggleOperationsMenu("marketingTools")}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#3d567d]"
                    aria-expanded={marketingToolsMenuOpen}
                  >
                    Marketing engine
                    <span>{marketingToolsMenuOpen ? "-" : "+"}</span>
                  </button>
                  {marketingToolsMenuOpen ? <div className="px-2 pb-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMarketingView("overview")
                        focusPanel("marketing")
                      }}
                      className={`mb-1 w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${
                        activePanel === "marketing" && activeMarketingView === "overview"
                          ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]"
                          : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"
                      }`}
                    >
                      Marketing overview
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMarketingView("teamsync_outreach")
                        focusPanel("teamsyncOutreach")
                      }}
                      className={`mb-1 w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${
                        activePanel === "teamsyncOutreach" || (activePanel === "marketing" && activeMarketingView === "teamsync_outreach")
                          ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]"
                          : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"
                      }`}
                    >
                      TeamSync outreach
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMarketingView("analytics")
                        setActiveFinancialView("marketing")
                        focusPanel("financials")
                      }}
                      className={`mb-1 w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${
                        activePanel === "financials" && activeFinancialView === "marketing"
                          ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]"
                          : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"
                      }`}
                    >
                      Marketing analytics
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMarketingView("campaign_manager")
                        focusPanel("marketing")
                      }}
                      className={`w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${
                        activePanel === "marketing" && activeMarketingView === "campaign_manager"
                          ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]"
                          : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"
                      }`}
                    >
                      Ad campaign manager
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMarketingView("practitioner_outreach_data")
                        focusPanel("marketing")
                      }}
                      className={`mt-1 w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${
                        activePanel === "marketing" && activeMarketingView === "practitioner_outreach_data"
                          ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]"
                          : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"
                      }`}
                    >
                      Practitioner outreach data
                    </button>
                  </div> : null}
                </section>
              ) : null}
              {overview.permissions.is_superuser ? (
                <section className="mt-2 rounded-xl border border-[#c7d8ee] bg-white">
                  <button
                    type="button"
                    onClick={() => toggleOperationsMenu("testerFeedback")}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#3d567d]"
                    aria-expanded={testerFeedbackMenuOpen}
                  >
                    Tester feedback
                    <span>{testerFeedbackMenuOpen ? "-" : "+"}</span>
                  </button>
                  {testerFeedbackMenuOpen ? (
                    <div className="px-2 pb-2">
                      <button
                        type="button"
                        onClick={() => focusPanel("testerFeedback")}
                        className={`mb-1 w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${
                          activePanel === "testerFeedback"
                            ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]"
                            : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"
                        }`}
                      >
                        Feedback command center
                      </button>
                      <button
                        type="button"
                        onClick={() => void pushTesterFeedbackToCodex("All active tester feedback", testerFeedbackNotes)}
                        className="w-full rounded-lg border border-[#cbd8eb] bg-white px-2.5 py-1.5 text-left text-xs font-semibold text-[#36537d] hover:bg-[#f4f8ff]"
                      >
                        Push active feedback to Codex
                      </button>
                    </div>
                  ) : null}
                </section>
              ) : null}
              <section className="mt-2 rounded-xl border border-[#c7d8ee] bg-white">
                <button
                  type="button"
                  onClick={() => toggleOperationsMenu("candidateManagement")}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#3d567d]"
                  aria-expanded={candidateMenuOpen}
                >
                  Candidate management
                  <span>{candidateMenuOpen ? "-" : "+"}</span>
                </button>
                {candidateMenuOpen ? (
                  <div className="px-2 pb-2">
                    <button type="button" onClick={() => focusPanel("controlCenter")} className={`mb-1 w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${activePanel === "controlCenter" ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]" : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"}`}>Candidate control</button>
                    <button type="button" onClick={() => focusPanel("candidateArchive")} className={`mb-1 flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${activePanel === "candidateArchive" ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]" : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"}`}>
                      <span>Candidate archive</span>
                      <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-[#5f7595]">{candidateArchiveCounts.archived}</span>
                    </button>
                    <button type="button" onClick={() => focusPanel("live")} className={`mb-1 w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${activePanel === "live" ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]" : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"}`}>Candidate preview</button>
                    <button type="button" onClick={() => focusPanel("digest")} className={`mb-1 w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${activePanel === "digest" ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]" : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"}`}>Onboarding completion</button>
                    <button type="button" onClick={() => focusPanel("healthInbox")} className={`mb-1 w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${activePanel === "healthInbox" ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]" : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"}`}>Candidate risk inbox</button>
                    <button type="button" onClick={() => focusPanel("background")} className={`mb-1 w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${activePanel === "background" ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]" : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"}`}>Background jobs</button>
                    <button type="button" onClick={() => focusPanel("live")} className={`w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${activePanel === "live" ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]" : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"}`}>Live candidates</button>
                  </div>
                ) : null}
              </section>
              <section className="mt-2 rounded-xl border border-[#c7d8ee] bg-white">
                <button
                  type="button"
                  onClick={() => toggleOperationsMenu("runHealth")}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#3d567d]"
                  aria-expanded={runHealthMenuOpen}
                >
                  System health
                  <span>{runHealthMenuOpen ? "-" : "+"}</span>
                </button>
                {runHealthMenuOpen ? <div className="px-2 pb-2">
                  <button type="button" onClick={() => focusPanel("digest")} className={`mb-1 w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${activePanel === "digest" ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]" : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"}`}>Ops summary</button>
                  <button type="button" onClick={() => focusPanel("recovery")} className={`mb-1 w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${activePanel === "recovery" ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]" : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"}`}>Recovery queue</button>
                  <button type="button" onClick={() => { setStatusFilter("failed"); focusPanel("background") }} className={`mb-1 w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${(activePanel === "background" && statusFilter === "failed") ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]" : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"}`}>API issues</button>
                  <button type="button" onClick={() => focusPanel("live")} className={`w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${activePanel === "live" ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]" : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"}`}>Live candidates</button>
                </div> : null}
              </section>
              <section className="mt-2 rounded-xl border border-[#c7d8ee] bg-white">
                <button
                  type="button"
                  onClick={() => toggleOperationsMenu("financials")}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#3d567d]"
                  aria-expanded={financialMenuOpen}
                >
                  Financials
                  <span>{financialMenuOpen ? "-" : "+"}</span>
                </button>
                {financialMenuOpen ? <div className="px-2 pb-2">
                  <button type="button" onClick={() => { setActiveFinancialView("api"); focusPanel("financials") }} className={`mb-1 w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${(activePanel === "financials" && activeFinancialView === "api") ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]" : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"}`}>API spend</button>
                  <button type="button" onClick={() => { setActiveFinancialView("marketing"); focusPanel("financials") }} className={`mb-1 w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${(activePanel === "financials" && activeFinancialView === "marketing") ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]" : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"}`}>Marketing spend summary</button>
                  <button type="button" onClick={() => { setActiveFinancialView("revenue"); focusPanel("financials") }} className={`w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${(activePanel === "financials" && activeFinancialView === "revenue") ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]" : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"}`}>Customer revenue analytics</button>
                </div> : null}
              </section>
              <section className="mt-2 rounded-xl border border-[#c7d8ee] bg-white">
                <button
                  type="button"
                  onClick={() => toggleOperationsMenu("executionRoadmap")}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#3d567d]"
                  aria-expanded={executionRoadmapMenuOpen}
                >
                  Execution roadmap
                  <span>{executionRoadmapMenuOpen ? "-" : "+"}</span>
                </button>
                {executionRoadmapMenuOpen ? <div className="px-2 pb-2">
                  <button type="button" onClick={() => focusPanel("executionBacklog")} className={`mb-1 w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${activePanel === "executionBacklog" ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]" : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"}`}>Prioritized Codex backlog</button>
                  <button type="button" onClick={() => focusPanel("securityAudit")} className={`w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${activePanel === "securityAudit" ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]" : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"}`}>Security hardening audit</button>
                </div> : null}
              </section>
              <section className="mt-2 rounded-xl border border-[#c7d8ee] bg-white">
                <button
                  type="button"
                  onClick={() => toggleOperationsMenu("contentLibrary")}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#3d567d]"
                  aria-expanded={contentLibraryMenuOpen}
                >
                  Site content
                  <span>{contentLibraryMenuOpen ? "-" : "+"}</span>
                </button>
                {contentLibraryMenuOpen ? (
                  <div className="px-2 pb-2">
                    <button
                      type="button"
                      onClick={() => focusPanel("contentLibrary")}
                      className={`w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${
                        activePanel === "contentLibrary"
                          ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]"
                          : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"
                      }`}
                    >
                      Content library
                    </button>
                  </div>
                ) : null}
              </section>
              <section className="mt-2 rounded-xl border border-[#c7d8ee] bg-white">
                <button
                  type="button"
                  onClick={() => toggleOperationsMenu("quickActions")}
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
                    void loadCandidateArchive()
                    void loadHealthInboxState()
                    void loadEconomics()
                    void loadSecurityAudit()
                    if (overview.permissions.is_superuser) {
                      void loadTeamSyncOutreach()
                      void loadTesterFeedback()
                    }
                  }} className="w-full rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-100">{isRefreshing ? "Refreshing..." : "Refresh data"}</button>
                  <button type="button" onClick={() => void runStalledRecoverySweep(false)} disabled={isRecoveringStalled} className="w-full rounded-full border border-[#0a66c2] bg-[#e8f3ff] px-2.5 py-1 text-xs font-semibold text-[#0a66c2] hover:bg-[#dcecff] disabled:cursor-not-allowed disabled:opacity-60">{isRecoveringStalled ? "Recovering..." : "Recover stalled jobs"}</button>
                </div> : null}
              </section>
            </aside>

            <div>
            <section id="operations-controlCenter" className={`mt-2 rounded-2xl border border-[#bfd2ed] bg-[linear-gradient(180deg,#ffffff_0%,#f6faff_100%)] p-2.5 shadow-[0_14px_30px_-26px_rgba(26,54,93,0.5)] ${isPanelVisible("controlCenter") ? "" : "hidden"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#3d567d]">Admin dashboard</div>
                  <h2 className="mt-1 text-sm font-semibold text-[#142c4f]">Unified operations and candidate management</h2>
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
                      {overview.permissions.is_superuser ? "Marketing + outreach" : "Live candidates"}
                    </div>
                    <div className="mt-0.5 text-sm font-semibold text-[#142c4f]">
                      {overview.permissions.is_superuser ? "Marketing workspace" : "Live candidates"}
                    </div>
                    <div className="mt-1 text-xs text-[#3d567d]">
                      {overview.permissions.is_superuser ? "Campaign queue, analytics, and follow-up actions." : "Monitor active candidate opportunities."}
                    </div>
                  </button>
                </div>
              ) : null}
            </section>
            <section id="operations-candidateArchive" className={`mt-2 rounded-2xl border border-[#bfd2ed] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-2.5 shadow-[0_14px_30px_-26px_rgba(26,54,93,0.5)] ${isPanelVisible("candidateArchive") ? "" : "hidden"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#3d567d]">Candidate management</div>
                  <h2 className="mt-1 text-sm font-semibold text-[#142c4f]">Candidate archive and restore</h2>
                  <p className="mt-1 text-xs text-[#4c668c]">
                    Archive removes a candidate from the active workspace list without hard-deleting it. Superusers can restore records during the retention window.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void loadCandidateArchive()}
                    className="rounded-full border border-[#cbd8eb] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#36537d] hover:bg-[#f4f8ff]"
                  >
                    Refresh archive
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePanel("candidateArchive")}
                    className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                  >
                    {collapsedPanels.candidateArchive ? "Expand" : "Collapse"}
                  </button>
                </div>
              </div>
              {!collapsedPanels.candidateArchive ? (
                <div className="mt-2 space-y-2">
                  <div className="grid gap-2 md:grid-cols-3">
                    <SnapshotStat label="Active candidates" value={String(candidateArchiveCounts.active)} />
                    <SnapshotStat label="Archived candidates" value={String(candidateArchiveCounts.archived)} />
                    <SnapshotStat label="Showing" value={String(filteredCandidateArchive.length)} />
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Use this for cleanup, duplicate workspaces, and tester records that should leave the live flow. It is a soft archive, not a permanent purge.
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={candidateArchiveSearch}
                      onChange={(event) => setCandidateArchiveSearch(event.target.value)}
                      placeholder="Search name, city, goal, user id..."
                      className="min-w-[220px] flex-1 rounded-xl border border-[#cbd8eb] bg-white px-3 py-2 text-sm text-[#142c4f] outline-none focus:border-[#8fb4ef]"
                    />
                    {(["active", "archived", "all"] as const).map((filter) => (
                      <button
                        key={`candidate-archive-filter-${filter}`}
                        type="button"
                        onClick={() => setCandidateArchiveFilter(filter)}
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                          candidateArchiveFilter === filter
                            ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]"
                            : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                  {!overview.permissions.is_superuser ? (
                    <div className="rounded-xl border border-[#cbd8eb] bg-[#f7fbff] px-3 py-2 text-xs text-[#36537d]">
                      Superuser access is required to archive or restore candidate records. Admins can still inspect the directory.
                    </div>
                  ) : null}
                  <div className="space-y-1.5">
                    {filteredCandidateArchive.length === 0 ? (
                      <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
                        No candidate records match this view.
                      </div>
                    ) : null}
                    {filteredCandidateArchive.map((candidate) => {
                      const isArchived = Boolean(candidate.deleted_at)
                      const name = candidate.full_name || "Untitled candidate"
                      return (
                        <div key={candidate.id} className={`rounded-xl border px-3 py-2 ${isArchived ? "border-amber-200 bg-amber-50" : "border-[#d7e4f5] bg-white"}`}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-sm font-semibold text-[#142c4f]">{name}</span>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${isArchived ? "border-amber-200 bg-white text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
                                  {isArchived ? "Archived" : "Active"}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-[#4c668c]">
                                {candidate.primary_goal || "No goal set"} {candidate.city ? `| ${candidate.city}` : ""}
                              </div>
                              <div className="mt-1 text-[11px] text-[#6b7f9f]">
                                Created: {formatDate(candidate.created_at)}
                                {isArchived ? ` | Archived: ${formatDate(candidate.deleted_at)} | Restore by: ${formatDate(candidate.purge_after)}` : ""}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Link
                                href={`/career/${candidate.id}`}
                                className="rounded-full border border-[#cbd8eb] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#36537d] hover:bg-[#f4f8ff]"
                              >
                                Open workspace
                              </Link>
                              {overview.permissions.is_superuser && isArchived ? (
                                <button
                                  type="button"
                                  onClick={() => void restoreCandidate(candidate)}
                                  disabled={candidateArchiveActionId === candidate.id}
                                  className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {candidateArchiveActionId === candidate.id ? "Restoring..." : "Restore"}
                                </button>
                              ) : null}
                              {overview.permissions.is_superuser && !isArchived ? (
                                <button
                                  type="button"
                                  onClick={() => void archiveCandidate(candidate)}
                                  disabled={candidateArchiveActionId === candidate.id}
                                  className="rounded-full border border-rose-300 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {candidateArchiveActionId === candidate.id ? "Archiving..." : "Archive"}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
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
                  <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
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
                      onClick={() => {
                        setActiveMarketingView("analytics")
                        setActiveFinancialView("marketing")
                        focusPanel("financials")
                      }}
                      className="rounded-xl border border-[#cbd8eb] bg-white px-3 py-2 text-left hover:bg-[#f4f8ff]"
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#3d567d]">Analytics</div>
                      <div className="mt-0.5 text-sm font-semibold text-[#142c4f]">Marketing analytics</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMarketingView("campaign_manager")
                        focusPanel("marketing")
                      }}
                      className="rounded-xl border border-[#cbd8eb] bg-white px-3 py-2 text-left hover:bg-[#f4f8ff]"
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#3d567d]">Campaign manager</div>
                      <div className="mt-0.5 text-sm font-semibold text-[#142c4f]">LinkedIn, Google, and Meta spend console</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMarketingView("practitioner_outreach_data")
                        focusPanel("marketing")
                      }}
                      className="rounded-xl border border-[#cbd8eb] bg-white px-3 py-2 text-left hover:bg-[#f4f8ff]"
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#3d567d]">Outreach data</div>
                      <div className="mt-0.5 text-sm font-semibold text-[#142c4f]">NZ practitioner source file</div>
                    </button>
                  </div>
                  {activeMarketingView === "practitioner_outreach_data" ? (
                    <div className="mt-2 rounded-xl border border-[#d3dfee] bg-white px-3 py-2">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#3d567d]">Practitioner outreach dataset</div>
                      <h3 className="mt-1 text-sm font-semibold text-[#142c4f]">NZ Gallup practitioner outreach sheet</h3>
                      <p className="mt-1 text-xs text-[#3d567d]">
                        Use this list as the base source for TeamSync practitioner outreach queue building and campaign targeting.
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <a
                          href={practitionerOutreachDataUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded-full border border-[#8fb4ef] bg-[#eaf3ff] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#1f4f99]"
                        >
                          Open sheet
                        </a>
                        <a
                          href={practitionerOutreachDataUrl}
                          download
                          className="inline-flex rounded-full border border-[#cbd8eb] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#36537d] hover:bg-[#f4f8ff]"
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  ) : null}
                  {activeMarketingView === "campaign_manager" ? (
                    campaignManagerUrl ? (
                      <div className="mt-2 overflow-hidden rounded-xl border border-[#cbd8eb] bg-white">
                        <div className="border-b border-[#e2eaf6] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#3d567d]">
                          Ad campaign manager
                        </div>
                        <iframe
                          src={campaignManagerUrl}
                          title="Ad campaign manager"
                          className="h-[560px] w-full bg-white"
                        />
                      </div>
                    ) : (
                      <div className="mt-2 rounded-xl border border-[#d3dfee] bg-[#f6faff] px-3 py-2 text-xs text-[#2e4b74]">
                        <div>
                          Set <code>NEXT_PUBLIC_AD_CAMPAIGN_MANAGER_URL</code> to load your external ad spend console (LinkedIn/Google/Meta) inside Operations.
                        </div>
                        <div className="mt-2">
                          <Link
                            href="/control-center/marketing-engine"
                            className="inline-flex rounded-full border border-[#cbd8eb] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#36537d] hover:bg-[#f4f8ff]"
                          >
                            Open full internal marketing tools
                          </Link>
                        </div>
                      </div>
                    )
                  ) : null}
                </>
              ) : null}
            </section>
            <section id="operations-financials" className={`mt-2 rounded-2xl border border-[#bfd2ed] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-2.5 shadow-[0_14px_30px_-26px_rgba(26,54,93,0.5)] ${isPanelVisible("financials") ? "" : "hidden"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#3d567d]">Financials</div>
                  <h2 className="mt-1 text-sm font-semibold text-[#142c4f]">
                    API + revenue summary{economics?.month_label ? ` | ${economics.month_label}` : ""}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => togglePanel("financials")}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  {collapsedPanels.financials ? "Expand" : "Collapse"}
                </button>
              </div>
              {!collapsedPanels.financials ? (
                loadingEconomics ? (
                  <div className="mt-2 rounded-xl border border-[#d3dfee] bg-[#f6faff] px-3 py-2 text-sm text-[#2e4b74]">
                    Loading financial snapshot...
                  </div>
                ) : economics ? (
                  <>
                    <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-9">
                      <SnapshotStat
                        label="Customer revenue"
                        value={formatUsd(Number(economics.summary.total_revenue_usd || 0))}
                      />
                      <SnapshotStat
                        label="API spend (in-app total)"
                        value={formatUsd(Number(economics.summary.total_api_cost_usd || 0))}
                      />
                      <SnapshotStat
                        label="OpenAI spend (in-app usage)"
                        value={formatUsd(Number(economics.summary.total_openai_api_cost_usd || 0))}
                      />
                      <SnapshotStat
                        label="Codex spend (in-app Codex logs)"
                        value={formatUsd(Number(economics.summary.total_codex_api_cost_usd || 0))}
                      />
                      <SnapshotStat
                        label="Codex development charges"
                        value={formatUsd(Number(economics.summary.total_codex_development_cost_usd || 0))}
                      />
                      <SnapshotStat
                        label="Total AI spend (in-app + Codex dev)"
                        value={formatUsd(Number(economics.summary.total_combined_ai_spend_usd || 0))}
                      />
                      <SnapshotStat
                        label="Margin (in-app only)"
                        value={formatUsd(Number(economics.summary.total_margin_usd || 0))}
                      />
                      <SnapshotStat
                        label="Margin (after Codex dev)"
                        value={formatUsd(Number(economics.summary.total_margin_after_codex_development_usd || 0))}
                      />
                      <SnapshotStat label="Over budget users" value={String(economics.summary.over_budget_users || 0)} />
                      <SnapshotStat label="Unprofitable users" value={String(economics.summary.unprofitable_users || 0)} />
                    </div>
                    {financialGuardrail ? (
                      <div className={`mt-2 rounded-xl border px-3 py-2 text-xs ${financialGuardrail.toneClass}`}>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em]">Margin guardrail: {financialGuardrail.label}</div>
                        <div className="mt-1">{financialGuardrail.guidance}</div>
                      </div>
                    ) : null}
                    <div className="mt-2 rounded-xl border border-[#d3dfee] bg-[#f6faff] px-3 py-2 text-xs text-[#2e4b74]">
                      Use this panel to keep API and outreach spend below subscription revenue.
                    </div>
                    <div className="mt-2 rounded-xl border border-[#d3dfee] bg-white px-3 py-2 text-[11px] text-[#486387]">
                      <span className="font-semibold uppercase tracking-[0.08em] text-[#304e79]">Pricing source</span>: OpenAI PAYG model rates.{" "}
                      <span className="font-semibold">Codex development charges</span> are now tracked automatically from OpenAI org spend.
                      <div className="mt-1">
                        Environment keys used: <code className="rounded bg-[#eef4ff] px-1 py-0.5">OPENAI_PRICE_{"{MODEL}"}_INPUT_PER_1M</code>{" "}
                        and <code className="rounded bg-[#eef4ff] px-1 py-0.5">OPENAI_PRICE_{"{MODEL}"}_OUTPUT_PER_1M</code>, plus{" "}
                        <code className="rounded bg-[#eef4ff] px-1 py-0.5">OPENAI_ADMIN_KEY</code>.
                      </div>
                      <div className="mt-1 text-[10px] text-[#5a7399]">
                        Codex source: <span className="font-semibold">{economics.summary.codex_development_cost_source || "unknown"}</span>
                        {economics.summary.codex_development_cost_source_error ? (
                          <span className="ml-1 text-rose-700">({formatCodexSourceError(economics.summary.codex_development_cost_source_error)})</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-2 rounded-xl border border-[#d3dfee] bg-white px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4a6388]">Revenue vs spend trend</div>
                          <div className="mt-0.5 text-xs text-[#4a6388]">
                            Seeded baseline includes <span className="font-semibold">{formatUsd(seededWeeklyRevenue)}</span> per week revenue while live billing data ramps up.
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setActiveFinancialRange("daily")}
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                              activeFinancialRange === "daily"
                                ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]"
                                : "border-[#cbd8eb] bg-white text-[#36537d]"
                            }`}
                          >
                            Daily
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveFinancialRange("weekly")}
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                              activeFinancialRange === "weekly"
                                ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]"
                                : "border-[#cbd8eb] bg-white text-[#36537d]"
                            }`}
                          >
                            Weekly
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveFinancialRange("monthly")}
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                              activeFinancialRange === "monthly"
                                ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]"
                                : "border-[#cbd8eb] bg-white text-[#36537d]"
                            }`}
                          >
                            Monthly
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setActiveFinancialRevenueLines("total")}
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                            activeFinancialRevenueLines === "total"
                              ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]"
                              : "border-[#cbd8eb] bg-white text-[#36537d]"
                          }`}
                        >
                          Total revenue line
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveFinancialRevenueLines("module")}
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                            activeFinancialRevenueLines === "module"
                              ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]"
                              : "border-[#cbd8eb] bg-white text-[#36537d]"
                          }`}
                        >
                          Module lines
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveFinancialRevenueLines("tier")}
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                            activeFinancialRevenueLines === "tier"
                              ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]"
                              : "border-[#cbd8eb] bg-white text-[#36537d]"
                          }`}
                        >
                          Tier lines
                        </button>
                      </div>
                      <FinancialTrendChart
                        points={financialTrendSeries}
                        label={activeFinancialRange}
                        revenueSeries={visibleRevenueTrendSeries}
                        revenueMode={activeFinancialRevenueLines}
                      />
                      <div className="mt-2 rounded-xl border border-[#dbe6f4] bg-[#fafdff] px-2.5 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4a6388]">Codex spend trend</div>
                            <div className="mt-0.5 text-xs text-[#4a6388]">Day/week/month include in-app Codex logs plus auto development delta from org costs.</div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setActiveCodexSpendRange("hour")}
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                                activeCodexSpendRange === "hour"
                                  ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]"
                                  : "border-[#cbd8eb] bg-white text-[#36537d]"
                              }`}
                            >
                              Hour
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveCodexSpendRange("day")}
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                                activeCodexSpendRange === "day"
                                  ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]"
                                  : "border-[#cbd8eb] bg-white text-[#36537d]"
                              }`}
                            >
                              Day
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveCodexSpendRange("week")}
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                                activeCodexSpendRange === "week"
                                  ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]"
                                  : "border-[#cbd8eb] bg-white text-[#36537d]"
                              }`}
                            >
                              Week
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveCodexSpendRange("month")}
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                                activeCodexSpendRange === "month"
                                  ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]"
                                  : "border-[#cbd8eb] bg-white text-[#36537d]"
                              }`}
                            >
                              Month
                            </button>
                          </div>
                        </div>
                        <CodexSpendTrendChart points={codexSpendTrendSeries} label={activeCodexSpendRange} />
                      </div>
                    </div>
                    <div className="mt-2 rounded-xl border border-[#d3dfee] bg-white px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setActiveFinancialView("api")}
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                            activeFinancialView === "api"
                              ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]"
                              : "border-[#cbd8eb] bg-white text-[#36537d]"
                          }`}
                        >
                          API spend
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveFinancialView("marketing")}
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                            activeFinancialView === "marketing"
                              ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]"
                              : "border-[#cbd8eb] bg-white text-[#36537d]"
                          }`}
                        >
                          Marketing spend
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveFinancialView("revenue")}
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                            activeFinancialView === "revenue"
                              ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]"
                              : "border-[#cbd8eb] bg-white text-[#36537d]"
                          }`}
                        >
                          Revenue + margin
                        </button>
                      </div>
                      {activeFinancialView === "api" ? (
                        <div className="mt-2 text-xs text-[#36537d]">
                          <p>
                            OpenAI spend (in-app usage):{" "}
                            <span className="font-semibold">
                              {formatUsd(Number(economics.summary.total_openai_api_cost_usd || 0))}
                            </span>
                          </p>
                          <p className="mt-1">
                            Codex spend (in-app logs):{" "}
                            <span className="font-semibold">
                              {formatUsd(Number(economics.summary.total_codex_api_cost_usd || 0))}
                            </span>
                          </p>
                          <p className="mt-1">
                            Codex development charges:{" "}
                            <span className="font-semibold">
                              {formatUsd(Number(economics.summary.total_codex_development_cost_usd || 0))}
                            </span>
                          </p>
                          <p className="mt-1">
                            Total AI spend (in-app + Codex dev):{" "}
                            <span className="font-semibold">
                              {formatUsd(Number(economics.summary.total_combined_ai_spend_usd || 0))}
                            </span>
                          </p>
                          <p>Users currently over API budget: <span className="font-semibold">{overBudgetRows.length}</span></p>
                          <p className="mt-1">Users in watch range (80%+ budget): <span className="font-semibold">{watchBudgetRows.length}</span></p>
                        </div>
                      ) : null}
                      {activeFinancialView === "marketing" ? (
                        <div className="mt-2 text-xs text-[#36537d]">
                          <p>TeamSync outreach queued: <span className="font-semibold">{marketingSignals.queued}</span></p>
                          <p className="mt-1">Campaign logs this cycle: <span className="font-semibold">{marketingSignals.campaigns}</span></p>
                        </div>
                      ) : null}
                      {activeFinancialView === "revenue" ? (
                        <div className="mt-2 text-xs text-[#36537d]">
                          <p>Users with negative margin: <span className="font-semibold">{negativeMarginRows.length}</span></p>
                          <p className="mt-1">Total margin this month: <span className="font-semibold">{formatUsd(Number(economics.summary.total_margin_usd || 0))}</span></p>
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {economicsRows.slice(0, 20).map((row) => {
                        const draft = economicsDrafts[row.user_id] ?? {
                          subscription: String(row.monthly_subscription_usd ?? 0),
                          budget: row.monthly_api_budget_usd === null ? "" : String(row.monthly_api_budget_usd),
                          notes: row.notes ?? "",
                        }
                        const statusTone =
                          row.profitability === "negative"
                            ? "border-rose-300 bg-rose-50 text-rose-800"
                            : row.budget_status === "over_budget"
                              ? "border-amber-300 bg-amber-50 text-amber-800"
                              : "border-emerald-300 bg-emerald-50 text-emerald-800"
                        return (
                          <div key={row.user_id} className="rounded-xl border border-[#d8e4f2] bg-[#f8fbff] px-3 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-[#142c4f]">{row.user_name}</div>
                                <div className="text-[11px] text-[#4a6388]">{row.user_email || row.user_id}</div>
                              </div>
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusTone}`}>
                                {row.profitability === "negative" ? "Negative margin" : row.budget_status.replace("_", " ")}
                              </span>
                            </div>
                            <div className="mt-1.5 grid gap-1.5 md:grid-cols-3">
                              <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4a6388]">
                                Subscription (USD/mo)
                                <input
                                  value={draft.subscription}
                                  onChange={(event) =>
                                    setEconomicsDrafts((current) => ({
                                      ...current,
                                      [row.user_id]: { ...draft, subscription: event.target.value },
                                    }))
                                  }
                                  className="mt-1 w-full rounded-lg border border-[#c2d3ea] bg-white px-2 py-1 text-xs font-medium text-[#163159]"
                                />
                              </label>
                              <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4a6388]">
                                API budget (USD/mo)
                                <input
                                  value={draft.budget}
                                  onChange={(event) =>
                                    setEconomicsDrafts((current) => ({
                                      ...current,
                                      [row.user_id]: { ...draft, budget: event.target.value },
                                    }))
                                  }
                                  placeholder="blank = unbounded"
                                  className="mt-1 w-full rounded-lg border border-[#c2d3ea] bg-white px-2 py-1 text-xs font-medium text-[#163159]"
                                />
                              </label>
                              <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4a6388]">
                                Notes
                                <input
                                  value={draft.notes}
                                  onChange={(event) =>
                                    setEconomicsDrafts((current) => ({
                                      ...current,
                                      [row.user_id]: { ...draft, notes: event.target.value },
                                    }))
                                  }
                                  className="mt-1 w-full rounded-lg border border-[#c2d3ea] bg-white px-2 py-1 text-xs font-medium text-[#163159]"
                                />
                              </label>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#4a6388]">
                              <span>
                                Cost: <span className="font-semibold">{formatUsd(row.monthly_api_cost_usd)}</span> | Margin:{" "}
                                <span className="font-semibold">{formatUsd(row.monthly_margin_usd)}</span>
                              </span>
                              <span>
                                OpenAI: <span className="font-semibold">{formatUsd(row.monthly_openai_api_cost_usd || 0)}</span> | Codex:{" "}
                                <span className="font-semibold">{formatUsd(row.monthly_codex_api_cost_usd || 0)}</span>
                              </span>
                              {overview.permissions.is_superuser ? (
                                <button
                                  type="button"
                                  onClick={() => void saveEconomicsDraft(row.user_id)}
                                  disabled={savingEconomicsUserId === row.user_id}
                                  className="rounded-full border border-[#0a66c2] bg-[#e8f3ff] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0a66c2] hover:bg-[#dcecff] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {savingEconomicsUserId === row.user_id ? "Saving..." : "Save guardrail"}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <div className="mt-2 rounded-xl border border-[#d3dfee] bg-[#f6faff] px-3 py-2 text-sm text-[#2e4b74]">
                    No financial data yet.
                  </div>
                )
              ) : null}
            </section>
            <section id="operations-executionBacklog" className={`mt-2 rounded-2xl border border-[#bfd2ed] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-2.5 shadow-[0_14px_30px_-26px_rgba(26,54,93,0.5)] ${isPanelVisible("executionBacklog") ? "" : "hidden"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#3d567d]">Execution roadmap</div>
                  <h2 className="mt-1 text-sm font-semibold text-[#142c4f]">Prioritized Codex action backlog</h2>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const target = document.getElementById("operations-add-backlog-item")
                      if (target) scrollToElementWithOffset(target)
                    }}
                    className="rounded-full border border-[#0a66c2] bg-[#e8f3ff] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0a66c2] hover:bg-[#dcecff]"
                  >
                    New backlog item
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePanel("executionBacklog")}
                    className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                  >
                    {collapsedPanels.executionBacklog ? "Expand" : "Collapse"}
                  </button>
                </div>
              </div>
              {!collapsedPanels.executionBacklog ? (
                <>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#d3dfee] bg-[#f6faff] px-3 py-2 text-xs text-[#2e4b74]">
                    <p>This list converts the enterprise review into an execution sequence. Work P0 top to bottom before expanding P1/P2.</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const target = document.getElementById("operations-add-backlog-item")
                          if (target) scrollToElementWithOffset(target)
                        }}
                        className="rounded-full border border-[#0a66c2] bg-[#e8f3ff] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0a66c2] hover:bg-[#dcecff]"
                      >
                        Add backlog item
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowArchivedBacklog((current) => !current)}
                        className="rounded-full border border-[#b7cce9] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#244a7b] hover:bg-[#edf4ff]"
                      >
                        {showArchivedBacklog ? "Hide archived" : "Show archived"}
                      </button>
                    </div>
                  </div>
                  <div id="operations-add-backlog-item" className="mt-2 rounded-xl border border-[#d3dfee] bg-white px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4b678e]">Add backlog item</div>
                        <p className="mt-0.5 text-xs text-[#587396]">Add a Codex-ready item directly into this prioritized menu.</p>
                      </div>
                      <button
                        type="button"
                        onClick={addBacklogItem}
                        className="rounded-full border border-[#9dbbe3] bg-[#eaf4ff] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#1e4f93] hover:bg-[#deedff]"
                      >
                        Add item
                      </button>
                    </div>
                    <div className="mt-2 grid gap-1.5 md:grid-cols-[1fr_100px_130px]">
                      <input
                        value={backlogItemDraft.title}
                        onChange={(event) => updateBacklogItemDraft({ title: event.target.value })}
                        placeholder="Backlog item title"
                        className="rounded-md border border-[#c6d6eb] bg-white px-2 py-1.5 text-xs text-[#1d3c67]"
                      />
                      <select
                        value={backlogItemDraft.priority}
                        onChange={(event) => updateBacklogItemDraft({ priority: event.target.value as BacklogItemDraft["priority"] })}
                        className="rounded-md border border-[#c6d6eb] bg-white px-2 py-1.5 text-xs text-[#1d3c67]"
                      >
                        <option value="P0">P0</option>
                        <option value="P1">P1</option>
                        <option value="P2">P2</option>
                      </select>
                      <select
                        value={backlogItemDraft.status}
                        onChange={(event) => updateBacklogItemDraft({ status: event.target.value as BacklogItemDraft["status"] })}
                        className="rounded-md border border-[#c6d6eb] bg-white px-2 py-1.5 text-xs text-[#1d3c67]"
                      >
                        <option value="planned">Planned</option>
                        <option value="ready_for_codex">Ready for Codex</option>
                        <option value="in_progress">In progress</option>
                        <option value="blocked">Blocked</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                    <div className="mt-1.5 grid gap-1.5 md:grid-cols-2">
                      <input
                        value={backlogItemDraft.owner}
                        onChange={(event) => updateBacklogItemDraft({ owner: event.target.value })}
                        placeholder="Owner, e.g. Platform + Ops"
                        className="rounded-md border border-[#c6d6eb] bg-white px-2 py-1.5 text-xs text-[#1d3c67]"
                      />
                      <input
                        value={backlogItemDraft.target}
                        onChange={(event) => updateBacklogItemDraft({ target: event.target.value })}
                        placeholder="Target, e.g. 2 weeks"
                        className="rounded-md border border-[#c6d6eb] bg-white px-2 py-1.5 text-xs text-[#1d3c67]"
                      />
                    </div>
                    <textarea
                      value={backlogItemDraft.notes}
                      onChange={(event) => updateBacklogItemDraft({ notes: event.target.value })}
                      placeholder="Codex execution notes, definition of done, or source context"
                      rows={3}
                      className="mt-1.5 min-h-20 w-full rounded-md border border-[#c6d6eb] bg-white px-2 py-1.5 text-xs text-[#1d3c67]"
                    />
                  </div>
                  <div className="mt-2 space-y-2">
                    {orderedBacklogItems.length === 0 ? (
                      <div className="rounded-xl border border-[#d3dfee] bg-[#f6faff] px-3 py-2 text-xs text-[#2e4b74]">
                        No roadmap items in this view.
                      </div>
                    ) : null}
                    {orderedBacklogItems.map((item, itemIndex) => (
                      <article key={item.id} className="rounded-xl border border-[#cbd8eb] bg-white px-3 py-2">
                        {(() => {
                          const coreAssets = EXECUTION_BACKLOG_ASSETS[item.id] ?? []
                          const customAssets = executionBacklogCustomAssets[item.id] ?? []
                          const allAssets = [...coreAssets, ...customAssets]
                          const draft = backlogAssetDrafts[item.id] ?? { label: "", href: "", type: "doc" as const }
                          return (
                            <>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                            item.priority === "P0"
                              ? "border-rose-300 bg-rose-50 text-rose-700"
                              : item.priority === "P1"
                              ? "border-amber-300 bg-amber-50 text-amber-700"
                              : "border-sky-300 bg-sky-50 text-sky-700"
                          }`}>
                            {item.priority}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                              item.status === "in_progress"
                                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                : item.status === "ready_for_codex"
                                ? "border-violet-300 bg-violet-50 text-violet-700"
                                : item.status === "completed"
                                ? "border-sky-300 bg-sky-50 text-sky-700"
                                : item.status === "blocked"
                                ? "border-rose-300 bg-rose-50 text-rose-700"
                                : "border-neutral-300 bg-neutral-50 text-neutral-600"
                            }`}
                          >
                            {item.status === "ready_for_codex" ? "ready for Codex" : item.status.replace("_", " ")}
                          </span>
                          <h3 className="text-sm font-semibold text-[#142c4f]">{item.title}</h3>
                          <div className="ml-auto flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => moveBacklogItem(item.id, "up")}
                              disabled={itemIndex === 0}
                              className="rounded-full border border-[#c6d6eb] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#315784] hover:bg-[#f1f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Move up
                            </button>
                            <button
                              type="button"
                              onClick={() => moveBacklogItem(item.id, "down")}
                              disabled={itemIndex === orderedBacklogItems.length - 1}
                              className="rounded-full border border-[#c6d6eb] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#315784] hover:bg-[#f1f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Move down
                            </button>
                            <button
                              type="button"
                              onClick={() => void runBacklogItemInCodex(item, allAssets)}
                              className="rounded-full border border-[#9ec1ee] bg-[#e8f3ff] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#1c4d92] hover:bg-[#ddecff]"
                            >
                              Copy Codex brief
                            </button>
                            {item.status === "ready_for_codex" ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setExecutionBacklogStatusOverrides((current) => ({ ...current, [item.id]: "in_progress" }))
                                  setMessage("Roadmap item marked in progress.")
                                }}
                                className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700 hover:bg-emerald-100"
                              >
                                Mark in progress
                              </button>
                            ) : null}
                            {item.status === "in_progress" ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setExecutionBacklogStatusOverrides((current) => ({ ...current, [item.id]: "completed" }))
                                  setMessage("Roadmap item marked complete.")
                                }}
                                className="rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-700 hover:bg-sky-100"
                              >
                                Mark complete
                              </button>
                            ) : null}
                            {executionBacklogArchivedIds.includes(item.id) ? (
                              <button
                                type="button"
                                onClick={() => unarchiveBacklogItem(item.id)}
                                className="rounded-full border border-[#d2dce9] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#415f85] hover:bg-[#f6f9ff]"
                              >
                                Unarchive
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => archiveBacklogItem(item.id)}
                                className="rounded-full border border-[#d2dce9] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#415f85] hover:bg-[#f6f9ff]"
                              >
                                Archive
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => deleteBacklogItem(item.id)}
                              className="rounded-full border border-[#e7c1c9] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a23d55] hover:bg-[#fff3f6]"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-[#36537d]">{item.notes}</p>
                        <div className="mt-1.5 text-[11px] text-[#4a6388]">
                          Owner: <span className="font-semibold">{item.owner}</span> | Target: <span className="font-semibold">{item.target}</span>
                        </div>
                        <div className="mt-2 rounded-lg border border-[#d8e4f2] bg-[#f7fbff] px-2.5 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4b678e]">Attached files</div>
                            <div className="text-[10px] text-[#59749a]">{allAssets.length} linked</div>
                          </div>
                          {allAssets.length > 0 ? (
                            <div className="mt-1.5 space-y-1">
                              {allAssets.map((asset, assetIndex) => (
                                <div key={`${item.id}-asset-${assetIndex}-${asset.href}`} className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border border-[#d2deef] bg-white px-2 py-1.5">
                                  <div className="min-w-0">
                                    <div className="truncate text-xs font-semibold text-[#17355e]">{asset.label}</div>
                                    <div className="truncate text-[11px] text-[#5e779a]">{asset.href}</div>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Link
                                      href={asset.href}
                                      target="_blank"
                                      className="rounded-full border border-[#c6d6eb] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#2c4f7c] hover:bg-[#f3f8ff]"
                                    >
                                      View
                                    </Link>
                                    <a
                                      href={asset.href}
                                      download
                                      className="rounded-full border border-[#c6d6eb] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#2c4f7c] hover:bg-[#f3f8ff]"
                                    >
                                      Download
                                    </a>
                                    {assetIndex >= coreAssets.length ? (
                                      <button
                                        type="button"
                                        onClick={() => removeBacklogAsset(item.id, assetIndex - coreAssets.length)}
                                        className="rounded-full border border-[#e7c1c9] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a23d55] hover:bg-[#fff3f6]"
                                      >
                                        Remove
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1.5 text-[11px] text-[#587396]">No files attached yet.</p>
                          )}

                          <div className="mt-2 grid gap-1.5 md:grid-cols-[1fr_1.2fr_120px_auto]">
                            <input
                              value={draft.label}
                              onChange={(event) => updateBacklogAssetDraft(item.id, { label: event.target.value })}
                              placeholder="File label"
                              className="rounded-md border border-[#c6d6eb] bg-white px-2 py-1.5 text-xs text-[#1d3c67]"
                            />
                            <input
                              value={draft.href}
                              onChange={(event) => updateBacklogAssetDraft(item.id, { href: event.target.value })}
                              placeholder="/docs/new-file.docx or /resources/library/id"
                              className="rounded-md border border-[#c6d6eb] bg-white px-2 py-1.5 text-xs text-[#1d3c67]"
                            />
                            <select
                              value={draft.type}
                              onChange={(event) => updateBacklogAssetDraft(item.id, { type: event.target.value as BacklogAssetDraft["type"] })}
                              className="rounded-md border border-[#c6d6eb] bg-white px-2 py-1.5 text-xs text-[#1d3c67]"
                            >
                              <option value="doc">DOC</option>
                              <option value="pdf">PDF</option>
                              <option value="md">MD</option>
                              <option value="xlsx">XLSX</option>
                              <option value="image">IMAGE</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => addBacklogAsset(item.id)}
                              className="rounded-full border border-[#9dbbe3] bg-[#eaf4ff] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#1e4f93] hover:bg-[#deedff]"
                            >
                              Add file
                            </button>
                          </div>
                        </div>
                            </>
                          )
                        })()}
                      </article>
                    ))}
                  </div>
                </>
              ) : null}
            </section>
            <section id="operations-contentLibrary" className={`mt-2 rounded-2xl border border-[#bfd2ed] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-2.5 shadow-[0_14px_30px_-26px_rgba(26,54,93,0.5)] ${isPanelVisible("contentLibrary") ? "" : "hidden"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#3d567d]">Site content</div>
                  <h2 className="mt-1 text-sm font-semibold text-[#142c4f]">Content Library manager</h2>
                </div>
                <button
                  type="button"
                  onClick={() => togglePanel("contentLibrary")}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  {collapsedPanels.contentLibrary ? "Expand" : "Collapse"}
                </button>
              </div>
              {!collapsedPanels.contentLibrary ? (
                <>
                  <div className="mt-2 rounded-xl border border-[#d8e4f2] bg-[#f7fbff] px-3 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4a6388]">Add item</div>
                    <div className="mt-1.5 grid gap-1.5 md:grid-cols-2">
                      <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4a6388]">
                        Title
                        <input
                          value={contentLibraryDraft.title}
                          onChange={(event) =>
                            setContentLibraryDraft((current) => ({ ...current, title: event.target.value }))
                          }
                          placeholder="Career Intelligence Blueprint"
                          className="mt-1 w-full rounded-lg border border-[#c2d3ea] bg-white px-2 py-1 text-xs text-[#163159]"
                        />
                      </label>
                      <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4a6388]">
                        File path or URL
                        <input
                          value={contentLibraryDraft.href}
                          onChange={(event) =>
                            setContentLibraryDraft((current) => ({ ...current, href: event.target.value }))
                          }
                          placeholder="Choose a file below, or enter /docs/file.pdf or https://..."
                          className="mt-1 w-full rounded-lg border border-[#c2d3ea] bg-white px-2 py-1 text-xs text-[#163159]"
                        />
                      </label>
                    </div>
                    <div className="mt-1.5 rounded-lg border border-[#cfe0f4] bg-white px-2 py-1.5">
                      <input
                        ref={contentLibraryFileInputRef}
                        type="file"
                        className="hidden"
                        onChange={onContentLibraryFilePicked}
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4a6388]">
                            Upload from computer
                          </div>
                          <div className="mt-0.5 text-xs text-[#2e4b74]">
                            {contentLibrarySelectedFileName
                              ? `Selected: ${contentLibrarySelectedFileName}`
                              : "Select a local file to auto-fill title, type, and file link."}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={openContentLibraryFilePicker}
                          disabled={loadingContentLibraryFile}
                          className="rounded-full border border-[#0a66c2] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0a66c2] hover:bg-[#edf5ff] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {loadingContentLibraryFile ? "Reading file..." : "Choose file"}
                        </button>
                      </div>
                    </div>
                    <div className="mt-1.5 grid gap-1.5 md:grid-cols-[150px_180px_1fr_auto]">
                      <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4a6388]">
                        Type
                        <select
                          value={contentLibraryDraft.type}
                          onChange={(event) =>
                            setContentLibraryDraft((current) => ({
                              ...current,
                              type: event.target.value as ContentLibraryItem["type"],
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-[#c2d3ea] bg-white px-2 py-1 text-xs text-[#163159]"
                        >
                          <option value="doc">DOC</option>
                          <option value="pdf">PDF</option>
                          <option value="md">MD</option>
                          <option value="xlsx">XLSX</option>
                          <option value="image">IMAGE</option>
                          <option value="video">VIDEO</option>
                          <option value="audio">AUDIO</option>
                        </select>
                      </label>
                      <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4a6388]">
                        Section
                        <select
                          value={contentLibraryDraft.section}
                          onChange={(event) =>
                            setContentLibraryDraft((current) => ({
                              ...current,
                              section: event.target.value as ContentLibraryItem["section"],
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-[#c2d3ea] bg-white px-2 py-1 text-xs text-[#163159]"
                        >
                          <option value="career">Career</option>
                          <option value="persona">Persona</option>
                          <option value="teamsync">TeamSync</option>
                          <option value="operations">Operations</option>
                          <option value="platform">Platform</option>
                        </select>
                      </label>
                      <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4a6388]">
                        Notes
                        <input
                          value={contentLibraryDraft.notes}
                          onChange={(event) =>
                            setContentLibraryDraft((current) => ({ ...current, notes: event.target.value }))
                          }
                          placeholder="Optional note"
                          className="mt-1 w-full rounded-lg border border-[#c2d3ea] bg-white px-2 py-1 text-xs text-[#163159]"
                        />
                      </label>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={addContentLibraryItem}
                          className="rounded-full border border-[#0a66c2] bg-[#e8f3ff] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0a66c2] hover:bg-[#dcecff]"
                        >
                          Add content
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 space-y-1.5">
                    {contentLibraryItems.length === 0 ? (
                      <div className="rounded-xl border border-[#d3dfee] bg-[#f6faff] px-3 py-2 text-xs text-[#2e4b74]">
                        No content items yet.
                      </div>
                    ) : null}
                    {contentLibraryItems.map((item) => (
                      <div key={item.id} className="rounded-xl border border-[#d8e4f2] bg-white px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-[#142c4f]">{item.title}</div>
                            <div className="truncate text-[11px] text-[#4a6388]">{item.href}</div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-full border border-[#cbd8eb] bg-[#f8fbff] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#456189]">
                              {item.section}
                            </span>
                            <span className="rounded-full border border-[#cbd8eb] bg-[#f8fbff] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#456189]">
                              {item.type}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeContentLibraryItem(item.id)}
                              className="rounded-full border border-[#e7c1c9] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a23d55] hover:bg-[#fff3f6]"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        {item.notes ? <p className="mt-1 text-xs text-[#36537d]">{item.notes}</p> : null}
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </section>
            <section id="operations-securityAudit" className={`mt-2 rounded-2xl border border-[#bfd2ed] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-2.5 shadow-[0_14px_30px_-26px_rgba(26,54,93,0.5)] ${isPanelVisible("securityAudit") ? "" : "hidden"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#3d567d]">Security hardening</div>
                  <h2 className="mt-1 text-sm font-semibold text-[#142c4f]">Write-route authorization audit</h2>
                </div>
                <button
                  type="button"
                  onClick={() => togglePanel("securityAudit")}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  {collapsedPanels.securityAudit ? "Expand" : "Collapse"}
                </button>
              </div>
              {!collapsedPanels.securityAudit ? (
                <>
                  {loadingSecurityAudit ? (
                    <div className="mt-2 rounded-xl border border-[#d3dfee] bg-[#f6faff] px-3 py-2 text-sm text-[#2e4b74]">
                      Loading security audit...
                    </div>
                  ) : securityAudit ? (
                    <>
                      <div className="mt-2 grid gap-2 md:grid-cols-4">
                        <SnapshotStat label="Write routes audited" value={String(securityAuditSummary.totalWriteRoutes)} />
                        <SnapshotStat label="Superuser-protected" value={String(securityAuditSummary.superuserProtectedCount)} />
                        <SnapshotStat label="Admin-write remaining" value={String(securityAuditSummary.adminWriteCount)} />
                        <SnapshotStat label="Protection coverage" value={`${securityAuditSummary.coveragePct}%`} />
                      </div>
                      <div
                        className={`mt-2 rounded-xl border px-3 py-2 text-xs ${
                          securityAuditSummary.adminWriteCount > 0
                            ? "border-amber-300 bg-amber-50 text-amber-900"
                            : "border-emerald-300 bg-emerald-50 text-emerald-900"
                        }`}
                      >
                        {securityAuditSummary.adminWriteCount > 0
                          ? `There are ${securityAuditSummary.adminWriteCount} admin-write endpoints still open for operational flexibility. Keep monitoring and promote to superuser as needed.`
                          : "All tracked write endpoints are superuser protected."}
                      </div>
                      <div className="mt-2 rounded-xl border border-[#d3dfee] bg-white px-3 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4a6388]">Remaining admin-write endpoints</div>
                        {securityAuditSummary.adminWriteRoutes.length === 0 ? (
                          <div className="mt-1.5 text-xs text-[#36537d]">No admin-write endpoints remain in the tracked list.</div>
                        ) : (
                          <div className="mt-1.5 space-y-1.5">
                            {securityAuditSummary.adminWriteRoutes.map((item) => (
                              <div key={`${item.method}-${item.route}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-[#d8e4f2] bg-[#f8fbff] px-2 py-1.5 text-xs text-[#25426c]">
                                <span className="rounded-full border border-[#b8c9df] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]">
                                  {item.method}
                                </span>
                                <span className="font-mono text-[11px]">{item.route}</span>
                                <span className="rounded-full border border-[#cbd8eb] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4a6388]">
                                  {item.area}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="mt-2 rounded-xl border border-[#d3dfee] bg-[#f6faff] px-3 py-2 text-sm text-[#2e4b74]">
                      {securityAuditError || "Security audit data is unavailable right now."}
                    </div>
                  )}
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
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#3d567d]">Tester feedback operations</div>
                    <h2 className="mt-1 text-lg font-semibold text-[#142c4f]">Feedback command center</h2>
                    <p className="mt-0.5 text-xs text-[#48658d]">
                      Review tester notes by page, email the right testers, and push clear handoffs into Codex.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void deleteResolvedTesterFeedbackNotes(testerFeedbackNotes, "all loaded tester feedback")}
                      disabled={testerSignals.resolved === 0 || deletingTesterFeedbackIds.length > 0}
                      className="rounded-full border border-rose-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingTesterFeedbackIds.length > 0 ? "Deleting..." : `Delete resolved ${testerSignals.resolved}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => void pushTesterFeedbackToCodex("All active tester feedback", testerFeedbackNotes)}
                      className="rounded-full border border-[#0a66c2] bg-[#e8f3ff] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0a66c2] hover:bg-[#dcecff]"
                    >
                      Push active to Codex
                    </button>
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
                      <SnapshotStat label="High severity" value={String(testerSignals.high)} />
                      <SnapshotStat label="Pages reporting" value={String(testerFeedbackPageGroups.length)} />
                    </div>
                    <div className="mt-3 rounded-xl border border-[#d0dff2] bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#3d567d]">Feedback grouped by page</div>
                          <p className="mt-0.5 text-xs text-[#587396]">Automatically grouped from route, anchor, page title, and module context.</p>
                        </div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#587396]">
                          {testerFeedbackNotes.length} notes loaded
                        </div>
                      </div>
                      {loadingTesterFeedback ? (
                        <p className="mt-2 text-sm text-[#48658d]">Loading tester feedback...</p>
                      ) : testerFeedbackPageGroups.length === 0 ? (
                        <div className="mt-2 rounded-xl border border-[#d3dfee] bg-[#f6faff] px-3 py-2 text-sm text-[#48658d]">
                          No tester feedback has been submitted yet.
                        </div>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {testerFeedbackPageGroups.map((group) => (
                            <article key={group.key} className="rounded-xl border border-[#d3dfee] bg-[#f8fbff] p-2.5">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <h3 className="text-sm font-semibold text-[#142c4f]">{group.label}</h3>
                                    <span className="rounded-full border border-[#cbd8eb] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#36537d]">
                                      {group.notes.length} note{group.notes.length === 1 ? "" : "s"}
                                    </span>
                                    {group.high > 0 ? (
                                      <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-rose-800">
                                        {group.high} high
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="mt-1 text-xs text-[#587396]">{group.module} | {group.route}</div>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => void pushTesterFeedbackToCodex(group.label, group.notes)}
                                    className="rounded-full border border-[#0a66c2] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0a66c2] hover:bg-[#e8f3ff]"
                                  >
                                    Push page to Codex
                                  </button>
                                  {group.resolved > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => void deleteResolvedTesterFeedbackNotes(group.notes, group.label)}
                                      disabled={deletingTesterFeedbackIds.length > 0}
                                      className="rounded-full border border-rose-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Delete resolved {group.resolved}
                                    </button>
                                  ) : null}
                                  {group.notes[0]?.full_url ? (
                                    <a
                                      href={group.notes[0].full_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="rounded-full border border-[#cbd8eb] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#36537d] hover:bg-[#f4f8ff]"
                                    >
                                      Open page
                                    </a>
                                  ) : null}
                                </div>
                              </div>
                              <div className="mt-2 grid gap-1.5">
                                {group.notes.map((note) => (
                                  <div key={note.id} className="rounded-lg border border-[#d8e4f2] bg-white px-2.5 py-2">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${testerStatusToneClass(note.status)}`}>
                                            {note.status.replace("_", " ")}
                                          </span>
                                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${testerSeverityToneClass(note.severity)}`}>
                                            {note.severity}
                                          </span>
                                          <span className="text-[11px] text-[#637b9e]">
                                            {new Date(note.created_at).toLocaleString()}
                                          </span>
                                        </div>
                                        <p className="mt-1 text-sm text-[#18365f]">{note.message || "No message supplied."}</p>
                                        <div className="mt-1 text-[11px] text-[#637b9e]">
                                          {note.user_email || note.user_id || "Unknown tester"}
                                          {note.viewport_width && note.viewport_height ? ` | ${note.viewport_width}x${note.viewport_height}` : ""}
                                        </div>
                                      </div>
                                      <div className="grid min-w-[190px] gap-1.5">
                                        <select
                                          value={note.status}
                                          onChange={(event) => void updateTesterFeedbackNote(note.id, { status: event.target.value as TesterFeedbackNoteRow["status"] })}
                                          disabled={reviewingTesterFeedbackId === note.id}
                                          className="rounded-lg border border-[#c2d3ea] bg-white px-2 py-1 text-xs font-medium text-[#163159]"
                                        >
                                          <option value="open">Open</option>
                                          <option value="in_review">In review</option>
                                          <option value="resolved">Resolved</option>
                                        </select>
                                        <select
                                          value={note.severity}
                                          onChange={(event) => void updateTesterFeedbackNote(note.id, { severity: event.target.value as TesterFeedbackNoteRow["severity"] })}
                                          disabled={reviewingTesterFeedbackId === note.id}
                                          className="rounded-lg border border-[#c2d3ea] bg-white px-2 py-1 text-xs font-medium text-[#163159]"
                                        >
                                          <option value="low">Low severity</option>
                                          <option value="medium">Medium severity</option>
                                          <option value="high">High severity</option>
                                        </select>
                                        {note.status === "resolved" ? (
                                          <button
                                            type="button"
                                            onClick={() => void deleteResolvedTesterFeedbackNotes([note], "this resolved note")}
                                            disabled={deletingTesterFeedbackIds.includes(note.id)}
                                            className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                                          >
                                            {deletingTesterFeedbackIds.includes(note.id) ? "Deleting..." : "Delete resolved"}
                                          </button>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="mt-3 rounded-xl border border-[#d0dff2] bg-[#f7fbff] p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#3d567d]">Email testers</div>
                          <p className="mt-0.5 text-xs text-[#587396]">Send follow-up, retest, or release-note emails to testers filtered by note status and module.</p>
                        </div>
                        <span className="rounded-full border border-[#cbd8eb] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#36537d]">
                          {testerSignals.campaigns} campaigns
                        </span>
                      </div>
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
                <h2 className="text-lg font-semibold text-[#142c4f]">Live candidates</h2>
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
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">No live candidates in this filter.</div>
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

function FinancialTrendChart({
  points,
  label,
  revenueSeries,
  revenueMode,
}: {
  points: {
    label: string
    revenue_usd: number
    api_cost_usd: number
    openai_api_cost_usd: number
    codex_api_cost_usd: number
    margin_usd: number
  }[]
  label: "daily" | "weekly" | "monthly"
  revenueSeries?: { key: string; label: string; points: { label: string; revenue_usd: number }[] }[]
  revenueMode?: "total" | "module" | "tier"
}) {
  const width = 760
  const height = 220
  const padding = { top: 16, right: 20, bottom: 38, left: 46 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom

  const safePoints = points.length > 0 ? points : [{ label: "-", revenue_usd: 0, api_cost_usd: 0, openai_api_cost_usd: 0, codex_api_cost_usd: 0, margin_usd: 0 }]
  const xAt = (index: number) =>
    safePoints.length <= 1 ? padding.left + innerWidth / 2 : padding.left + (index / (safePoints.length - 1)) * innerWidth

  const normalizedRevenueSeries =
    revenueMode && revenueMode !== "total" ? revenueSeries ?? [] : []

  const revenueValues =
    normalizedRevenueSeries.length > 0
      ? normalizedRevenueSeries.flatMap((series) => series.points.map((point) => point.revenue_usd))
      : safePoints.map((point) => point.revenue_usd)
  const allValues = [...revenueValues, ...safePoints.map((point) => point.api_cost_usd), ...safePoints.map((point) => point.margin_usd), 0]
  const maxValue = Math.max(...allValues, 1)
  const yAt = (value: number) => padding.top + innerHeight - (value / maxValue) * innerHeight

  const revenuePath =
    normalizedRevenueSeries.length === 0
      ? safePoints.map((point, index) => `${index === 0 ? "M" : "L"} ${xAt(index)} ${yAt(point.revenue_usd)}`).join(" ")
      : ""
  const apiPath = safePoints.map((point, index) => `${index === 0 ? "M" : "L"} ${xAt(index)} ${yAt(point.api_cost_usd)}`).join(" ")
  const marginPath = safePoints.map((point, index) => `${index === 0 ? "M" : "L"} ${xAt(index)} ${yAt(point.margin_usd)}`).join(" ")
  const seriesPalette = ["#2563eb", "#7c3aed", "#0f766e", "#ea580c", "#dc2626", "#334155", "#16a34a", "#be185d"]

  return (
    <div className="mt-2 rounded-xl border border-[#dbe6f4] bg-[#fafdff] px-2.5 py-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full">
        <rect x={0} y={0} width={width} height={height} fill="transparent" />

        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const value = maxValue * fraction
          const y = yAt(value)
          return (
            <g key={`grid-${fraction}`}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e6eef9" strokeWidth={1} />
              <text x={8} y={y + 4} fontSize={10} fill="#5d769c">
                {Math.round(value)}
              </text>
            </g>
          )
        })}

        {normalizedRevenueSeries.length > 0
          ? normalizedRevenueSeries.map((series, seriesIndex) => {
              const seriesPath = series.points
                .map((point, index) => `${index === 0 ? "M" : "L"} ${xAt(index)} ${yAt(point.revenue_usd)}`)
                .join(" ")
              const stroke = seriesPalette[seriesIndex % seriesPalette.length]
              return <path key={`series-${series.key}`} d={seriesPath} fill="none" stroke={stroke} strokeWidth={2.2} />
            })
          : <path d={revenuePath} fill="none" stroke="#2563eb" strokeWidth={2.5} />}

        <path d={apiPath} fill="none" stroke="#dc2626" strokeWidth={2} strokeDasharray="5 4" />
        <path d={marginPath} fill="none" stroke="#16a34a" strokeWidth={2} strokeDasharray="8 4" />

        {safePoints.map((point, index) => (
          <text key={`x-${point.label}-${index}`} x={xAt(index)} y={height - 10} textAnchor="middle" fontSize={10} fill="#4a6388">
            {point.label}
          </text>
        ))}
      </svg>

      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#3f5b84]">
        <span className="rounded-full border border-[#cbd8eb] bg-white px-2 py-0.5">{label} trend</span>
        {normalizedRevenueSeries.length === 0 ? (
          <span className="rounded-full border border-[#cbd8eb] bg-white px-2 py-0.5 text-[#1f4f99]">Revenue (total)</span>
        ) : (
          normalizedRevenueSeries.slice(0, 6).map((series, index) => (
            <span key={`legend-${series.key}`} className="rounded-full border border-[#cbd8eb] bg-white px-2 py-0.5">
              <span style={{ color: seriesPalette[index % seriesPalette.length] }}>{series.label}</span>
            </span>
          ))
        )}
        <span className="rounded-full border border-[#f2cccc] bg-[#fff5f5] px-2 py-0.5 text-[#a12626]">API cost</span>
        <span className="rounded-full border border-[#ccebd8] bg-[#f2fff6] px-2 py-0.5 text-[#1d7f4b]">Margin</span>
      </div>
    </div>
  )
}

function CodexSpendTrendChart({
  points,
  label,
}: {
  points: { label: string; codex_spend_usd: number }[]
  label: "hour" | "day" | "week" | "month"
}) {
  const width = 760
  const height = 190
  const padding = { top: 12, right: 20, bottom: 34, left: 46 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom

  const safePoints = points.length > 0 ? points : [{ label: "-", codex_spend_usd: 0 }]
  const xAt = (index: number) =>
    safePoints.length <= 1 ? padding.left + innerWidth / 2 : padding.left + (index / (safePoints.length - 1)) * innerWidth
  const maxValue = Math.max(...safePoints.map((point) => point.codex_spend_usd), 1)
  const yAt = (value: number) => padding.top + innerHeight - (value / maxValue) * innerHeight
  const spendPath = safePoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xAt(index)} ${yAt(point.codex_spend_usd)}`)
    .join(" ")
  const filledPath = `${spendPath} L ${xAt(safePoints.length - 1)} ${padding.top + innerHeight} L ${xAt(0)} ${padding.top + innerHeight} Z`

  return (
    <div className="mt-2 rounded-xl border border-[#dbe6f4] bg-white px-2.5 py-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[190px] w-full">
        <rect x={0} y={0} width={width} height={height} fill="transparent" />

        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const value = maxValue * fraction
          const y = yAt(value)
          return (
            <g key={`codex-grid-${fraction}`}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e6eef9" strokeWidth={1} />
              <text x={8} y={y + 4} fontSize={10} fill="#5d769c">
                {value.toFixed(2)}
              </text>
            </g>
          )
        })}

        <path d={filledPath} fill="#e8f3ff" />
        <path d={spendPath} fill="none" stroke="#0a66c2" strokeWidth={2.4} />

        {safePoints.map((point, index) => (
          <text
            key={`codex-x-${point.label}-${index}`}
            x={xAt(index)}
            y={height - 10}
            textAnchor="middle"
            fontSize={10}
            fill="#4a6388"
          >
            {point.label}
          </text>
        ))}
      </svg>

      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#3f5b84]">
        <span className="rounded-full border border-[#cbd8eb] bg-white px-2 py-0.5">{label} zoom</span>
        <span className="rounded-full border border-[#cbd8eb] bg-white px-2 py-0.5 text-[#1f4f99]">
          Codex spend
        </span>
      </div>
    </div>
  )
}
