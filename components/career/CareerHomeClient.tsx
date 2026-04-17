"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import type { Session } from "@supabase/supabase-js"
import { CareerCandidateForm } from "@/components/career/CareerCandidateForm"
import { getAuthHeaders } from "@/lib/career-client"
import { getAuthProviderLabel } from "@/lib/auth-provider"
import { supabase } from "@/lib/supabase"

type CandidateRow = {
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

export function CareerHomeClient() {
  const searchParams = useSearchParams()
  const requestedView = searchParams.get("view")
  const ownerPreviewUserId = searchParams.get("owner")
  const careerViewMode = requestedView === "preview" ? "preview" : requestedView === "owner-preview" ? "owner-preview" : "control"
  const isCandidatePreviewMode = careerViewMode === "preview"
  const isOwnerPreviewMode = careerViewMode === "owner-preview" && Boolean(ownerPreviewUserId)
  const [session, setSession] = useState<Session | null>(null)
  const [candidates, setCandidates] = useState<CandidateRow[]>([])
  const [message, setMessage] = useState("")
  const [activeSection, setActiveSection] = useState("career-overview")
  const [activeAnchor, setActiveAnchor] = useState("#career-overview")
  const [isFocusMode, setIsFocusMode] = useState(true)
  const [isMenuRolledUp, setIsMenuRolledUp] = useState(true)
  const [showWorkflowMap, setShowWorkflowMap] = useState(false)
  const [showAdvancedTools, setShowAdvancedTools] = useState(false)
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false)
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
    async function load() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

      setSession(currentSession)

      if (!currentSession?.access_token) {
        return
      }

      const candidatesUrl = isCandidatePreviewMode
        ? "/api/career/candidates?scope=mine"
        : isOwnerPreviewMode
          ? `/api/career/candidates?scope=owner_preview&owner_user_id=${encodeURIComponent(ownerPreviewUserId || "")}`
          : "/api/career/candidates"
      const response = await fetch(candidatesUrl, {
        cache: "no-store",
        headers: await getAuthHeaders(),
      })

      const json = await response.json()

      if (!response.ok) {
        const errorMessage = json.error || "Failed to load candidates"
        setMessage(errorMessage)
        showToast({ tone: "error", message: errorMessage })
        return
      }

      setCandidates((json.candidates ?? []) as CandidateRow[])
      setMessage("")
    }

    void load()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => subscription.unsubscribe()
  }, [isCandidatePreviewMode, isOwnerPreviewMode, ownerPreviewUserId, showToast])

  const totalProfiles = candidates.reduce((sum, candidate) => sum + candidate.profile_count, 0)
  const totalAssets = candidates.reduce((sum, candidate) => sum + candidate.asset_count, 0)
  const activeRuns = candidates.reduce((sum, candidate) => sum + candidate.active_run_count, 0)
  const overdueFollowUps = candidates.reduce((sum, candidate) => sum + candidate.overdue_follow_up_count, 0)
  const dueTodayFollowUps = candidates.reduce((sum, candidate) => sum + candidate.due_today_count, 0)
  const averageReadiness = candidates.length > 0 ? Math.round(candidates.reduce((sum, candidate) => sum + candidate.readiness_score, 0) / candidates.length) : 0
  const marketReadyCount = candidates.filter((candidate) => candidate.readiness_score >= 70).length
  const authProviderBadge = getAuthProviderLabel(session?.user)

  async function handleSwitchAccount() {
    setIsSwitchingAccount(true)
    await supabase.auth.signOut()
    if (typeof window !== "undefined") {
      window.location.href = "/platform"
    }
  }
  const openAndScroll = useCallback((sectionKey: string, href: string) => {
    setActiveSection(sectionKey)
    setActiveAnchor(href)
    if (sectionKey !== "career-overview" && isFocusMode) {
      setIsMenuRolledUp(true)
    }

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
  }, [isFocusMode])
  const quickLinks = [
    { sectionKey: "career-overview", href: "#career-overview", label: "1. Overview" },
    { sectionKey: "priority-signals", href: "#priority-signals", label: "2. Priority signals" },
    { sectionKey: "setup-workflow", href: "#setup-workflow", label: "3. Setup workflow" },
    { sectionKey: "feature-capabilities", href: "#feature-capabilities", label: "4. Capabilities" },
    { sectionKey: "create-workspace", href: "#create-workspace", label: "5. Create workspace" },
    { sectionKey: "workspace-library", href: "#workspace-library", label: "6. Existing workspaces" },
  ]
  const activeQuickLink = quickLinks.find((link) => link.sectionKey === activeSection) ?? quickLinks[0]
  const sectionSubmenuLinks: Record<string, Array<{ label: string; sectionKey: string; href: string }>> = {
    "career-overview": [
      { label: "Hero summary", sectionKey: "career-overview", href: "#career-overview" },
      { label: "Core metrics", sectionKey: "career-overview", href: "#career-overview" },
    ],
    "priority-signals": [
      { label: "Overdue follow-ups", sectionKey: "priority-signals", href: "#priority-signals" },
      { label: "Market readiness", sectionKey: "priority-signals", href: "#priority-signals" },
    ],
    "setup-workflow": [
      { label: "Prep checklist", sectionKey: "setup-workflow", href: "#setup-workflow" },
      { label: "Recommended flow", sectionKey: "setup-workflow", href: "#setup-workflow" },
    ],
    "feature-capabilities": [
      { label: "Positioning", sectionKey: "feature-capabilities", href: "#feature-capabilities" },
      { label: "Assets", sectionKey: "feature-capabilities", href: "#feature-capabilities" },
      { label: "Interview and market", sectionKey: "feature-capabilities", href: "#feature-capabilities" },
    ],
    "create-workspace": [
      { label: "Candidate form", sectionKey: "create-workspace", href: "#create-workspace" },
      { label: "Input requirements", sectionKey: "create-workspace", href: "#setup-workflow" },
    ],
    "workspace-library": [
      { label: "Workspace list", sectionKey: "workspace-library", href: "#workspace-library" },
      { label: "Readiness cards", sectionKey: "workspace-library", href: "#workspace-library" },
    ],
  }
  const activeSubmenuLinks = sectionSubmenuLinks[activeSection] ?? []
  const activeSectionLabel = quickLinks.find((link) => link.sectionKey === activeSection)?.label?.replace(/^\d+\.\s*/, "") || "Overview"
  const activeSubsectionLabel =
    activeSubmenuLinks.find((item) => item.href === activeAnchor)?.label ||
    activeSubmenuLinks[0]?.label ||
    "Overview"
  const hideSetupMenuInFocus = isFocusMode && activeSection !== "career-overview"
  const workflowMapSections = quickLinks.map((link) => ({
    ...link,
    items: sectionSubmenuLinks[link.sectionKey] ?? [],
  }))

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-neutral-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <section id="career-overview" className="scroll-mt-24 mb-8 overflow-hidden rounded-[2rem] border border-[#d9e2ec] bg-[linear-gradient(135deg,#ffffff_0%,#eff6ff_38%,#eef2ff_100%)] p-7 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[#536471]">Career Intelligence</div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                    isCandidatePreviewMode || isOwnerPreviewMode
                      ? "border-sky-300 bg-sky-50 text-sky-800"
                      : "border-indigo-300 bg-indigo-50 text-indigo-800"
                  }`}
                >
                  {isOwnerPreviewMode ? "Candidate preview mode (selected owner)" : isCandidatePreviewMode ? "Candidate preview mode" : "Control center mode"}
                </span>
                {authProviderBadge ? (
                  <span className="rounded-full border border-neutral-300 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                    {authProviderBadge} login
                  </span>
                ) : null}
                {session?.user ? (
                  <button
                    type="button"
                    onClick={() => void handleSwitchAccount()}
                    disabled={isSwitchingAccount}
                    className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSwitchingAccount ? "Switching..." : "Switch account"}
                  </button>
                ) : null}
              </div>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#0f172a]">Career Intelligence workspaces built for serious job outcomes</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-[#475569]">
                This is the separate Career Intelligence module inside Persona Foundry. It is designed to help users move from raw career material to sharper positioning, stronger applications, better interview performance, and live opportunity matching.
              </p>
              {isOwnerPreviewMode ? (
                <p className="mt-2 max-w-2xl text-xs font-medium text-sky-800">
                  You are previewing a selected candidate owner view from Admin. This helps validate the real user journey without leaving control center workflows.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/career?view=control"
                className={`rounded-xl border px-4 py-2 text-sm font-medium ${
                  isCandidatePreviewMode || isOwnerPreviewMode
                    ? "border-[#cbd5e1] bg-white text-[#0f172a] hover:bg-[#f8fafc]"
                    : "border-sky-300 bg-sky-50 text-sky-900"
                }`}
              >
                Control center view
              </Link>
              <Link
                href="/career?view=preview"
                className={`rounded-xl border px-4 py-2 text-sm font-medium ${
                  isCandidatePreviewMode
                    ? "border-sky-300 bg-sky-50 text-sky-900"
                    : "border-[#cbd5e1] bg-white text-[#0f172a] hover:bg-[#f8fafc]"
                }`}
              >
                Candidate view preview
              </Link>
              <Link href="/admin" className="rounded-xl border border-[#cbd5e1] bg-white px-4 py-2 text-sm font-medium text-[#0f172a] hover:bg-[#f8fafc]">
                Open admin dashboard
              </Link>
              <Link href="/career-test" className="rounded-xl border border-[#cbd5e1] bg-white px-4 py-2 text-sm font-medium text-[#0f172a] hover:bg-[#f8fafc]">
                Open raw test page
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Candidate workspaces" value={String(candidates.length)} hint="One workspace per person" />
            <MetricCard label="Profiles generated" value={String(totalProfiles)} hint="Professional narrative packs saved" />
            <MetricCard label="Saved outputs" value={String(totalAssets)} hint="CVs, cover letters, dossiers and more" />
            <MetricCard label="Average readiness" value={`${averageReadiness}%`} hint="How close workspaces are to market-ready" />
          </div>
        </section>

        {hideSetupMenuInFocus ? (
          <section data-sticky-nav="true" className="sticky top-3 z-30 mb-4 rounded-2xl border border-[#d8e4f2] bg-white px-3 py-2 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] text-neutral-600">
                Working in <span className="font-semibold text-neutral-900">{activeSectionLabel}</span> /{" "}
                <span className="font-semibold text-neutral-900">{activeSubsectionLabel}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsFocusMode(false)
                    setIsMenuRolledUp(false)
                  }}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  Show menu
                </button>
                <button
                  type="button"
                  onClick={() => setIsFocusMode(false)}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  Exit focus
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section data-sticky-nav="true" className="sticky top-3 z-30 mb-4 rounded-2xl border border-[#d8e4f2] bg-[linear-gradient(180deg,#fcfdff_0%,#f4f8fc_100%)] p-3 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5b6b7c]">Setup menu</div>
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Current: {activeQuickLink.label}</div>
                <button
                  type="button"
                  onClick={() => setIsMenuRolledUp((current) => !current)}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  {isMenuRolledUp ? "Expand menu" : "Roll up menu"}
                </button>
              </div>
            </div>
            {!isMenuRolledUp ? (
              <>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-600">
                  <span className="font-semibold text-neutral-700">Path:</span>
                  <button
                    type="button"
                    onClick={() => openAndScroll("setup-workflow", "#setup-workflow")}
                    className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 font-semibold text-neutral-700 hover:bg-neutral-100"
                  >
                    Setup
                  </button>
                  <span className="text-neutral-400">/</span>
                  <button
                    type="button"
                    onClick={() => openAndScroll(activeSection, activeQuickLink?.href || "#career-overview")}
                    className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 font-semibold text-neutral-700 hover:bg-neutral-100"
                  >
                    {activeSectionLabel}
                  </button>
                  <span className="text-neutral-400">/</span>
                  <button
                    type="button"
                    onClick={() => openAndScroll(activeSection, activeAnchor)}
                    className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 font-semibold text-neutral-700 hover:bg-neutral-100"
                  >
                    {activeSubsectionLabel}
                  </button>
                </div>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {quickLinks.map((link) => (
                    <button
                      key={`career-menu-${link.href}`}
                      type="button"
                      onClick={() => openAndScroll(link.sectionKey, link.href)}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        activeSection === link.sectionKey
                          ? "border-sky-300 bg-sky-100 text-sky-900"
                          : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
                      }`}
                    >
                      {link.label}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            <div className="mt-2 flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setIsFocusMode((current) => !current)}
                className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                {isFocusMode ? "Turn focus mode off" : "Turn focus mode on"}
              </button>
              <button
                type="button"
                onClick={() => setShowAdvancedTools((current) => !current)}
                className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                {showAdvancedTools ? "Hide advanced tools" : "Show advanced tools"}
              </button>
            </div>
            {showAdvancedTools ? (
              <div className="mt-2 rounded-xl border border-neutral-200 bg-white p-2.5">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowWorkflowMap((current) => !current)}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${
                      showWorkflowMap ? "border-sky-300 bg-sky-50 text-sky-800" : "border-neutral-300 bg-white text-neutral-700"
                    }`}
                  >
                    {showWorkflowMap ? "Map on" : "Map off"}
                  </button>
                </div>
                {activeSubmenuLinks.length > 0 ? (
                  <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                    {activeSubmenuLinks.map((item) => (
                      <button
                        key={`career-submenu-${item.sectionKey}-${item.href}-${item.label}`}
                        type="button"
                        onClick={() => openAndScroll(item.sectionKey, item.href)}
                        className="shrink-0 rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-100"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {showAdvancedTools && showWorkflowMap ? (
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {workflowMapSections.map((section) => (
                  <div key={`career-map-${section.sectionKey}`} className="rounded-xl border border-neutral-200 bg-white p-2.5">
                    <button
                      type="button"
                      onClick={() => openAndScroll(section.sectionKey, section.href)}
                      className={`w-full rounded-lg border px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] transition ${
                        activeSection === section.sectionKey
                          ? "border-sky-300 bg-sky-50 text-sky-900"
                          : "border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100"
                      }`}
                    >
                      {section.label}
                    </button>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {section.items.map((item) => (
                        <button
                          key={`career-map-item-${section.sectionKey}-${item.href}-${item.label}`}
                          type="button"
                          onClick={() => openAndScroll(item.sectionKey, item.href)}
                          className="rounded-full border border-neutral-300 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-100"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        )}

        <section id="priority-signals" className="scroll-mt-24 mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <UrgencyCard
            title="Overdue follow-ups"
            value={String(overdueFollowUps)}
            description="Applications that need attention now because their follow-up date has passed."
            tone={overdueFollowUps > 0 ? "danger" : "neutral"}
          />
          <UrgencyCard
            title="Due today"
            value={String(dueTodayFollowUps)}
            description="Applications with a follow-up scheduled for today."
            tone={dueTodayFollowUps > 0 ? "warning" : "neutral"}
          />
          <UrgencyCard
            title="Active applications"
            value={String(candidates.reduce((sum, candidate) => sum + candidate.active_application_count, 0))}
            description="Live roles still being actively pursued across all candidate workspaces."
            tone="neutral"
          />
          <UrgencyCard
            title="Market-ready workspaces"
            value={String(marketReadyCount)}
            description="Candidates with enough inputs, outputs, and execution activity to be considered ready to push harder into market action."
            tone={marketReadyCount > 0 ? "neutral" : "warning"}
          />
          <UrgencyCard
            title="Jobs running"
            value={String(activeRuns)}
            description="Background searches and generators still processing."
            tone={activeRuns > 0 ? "neutral" : "neutral"}
          />
        </section>

        {!session?.user ? (
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Sign in required</h2>
            <p className="mt-2 text-sm text-neutral-600">
              Sign in on the main Persona Foundry page first, then come back here to use Career Intelligence.
            </p>
            <Link href="/" className="mt-4 inline-flex rounded-xl bg-black px-4 py-2 text-sm font-medium text-white">
              Go to homepage
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <section id="setup-workflow" className="scroll-mt-24 rounded-[2rem] border border-[#d9e2ec] bg-white p-6 shadow-sm">
              <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748b]">Career Intelligence workflow</div>
                  <h2 className="mt-2 text-2xl font-semibold text-[#0f172a]">What users should prepare first</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-[#475569]">
                    The strongest results come from strong inputs. The Gallup Strengths report is the engine-room document because it improves voice, positioning, and fit across cover letters, dossiers, and interview answers.
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <GuideCard step="1" title="Current CV" description="Anchor chronology, experience, sector exposure, and scope before any rewriting begins." />
                    <GuideCard step="2" title="Gallup Strengths report" description="Use this to shape the user voice, the strengths story, and the role-fit narrative." />
                    <GuideCard step="3" title="LinkedIn and proof points" description="Bring in LinkedIn, old letters, metrics, recruiter notes, and recent wins." />
                    <GuideCard step="4" title="Target role or company" description="Once the positioning is strong, tailor it toward a role, employer, or market." />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl border border-[#dbeafe] bg-[#eff6ff] p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1d4ed8]">Recommended flow</div>
                    <ol className="mt-4 space-y-3 text-sm leading-6 text-[#1e3a8a]">
                      <li>1. Create the candidate workspace.</li>
                      <li>2. Load CV, Gallup Strengths, LinkedIn text, and other proof.</li>
                      <li>3. Generate the career positioning pack.</li>
                      <li>4. Create CV, LinkedIn, and tailored cover letter assets.</li>
                      <li>5. Generate employer dossiers and interview prep for specific targets.</li>
                      <li>6. Run live job search once the profile is strong enough to hit the market.</li>
                    </ol>
                  </div>

                  <div className="rounded-3xl border border-[#e2e8f0] bg-[#f8fafc] p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748b]">Why this matters</div>
                    <p className="mt-3 text-sm leading-6 text-[#475569]">
                      The goal is not just to generate content. The goal is to create a Career Intelligence workflow that feels structured, premium, and useful enough to live inside a larger professional platform.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section id="feature-capabilities" className="scroll-mt-24 grid gap-4 lg:grid-cols-3">
              <FeaturePanel
                title="Professional positioning"
                description="Turn raw career material into a sharper market narrative with strengths, seniority signals, and target-role direction."
              />
              <FeaturePanel
                title="Application assets"
                description="Generate CV drafts, cover letters, LinkedIn text, company dossiers, and strategic job-search documents."
              />
              <FeaturePanel
                title="Interview and market execution"
                description="Prepare for interviews, reflect after real interviews, and search live roles without losing work while jobs run in the background."
              />
            </section>

            <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <div id="create-workspace" className="scroll-mt-24">
                <CareerCandidateForm />
              </div>

              <section id="workspace-library" className="scroll-mt-24 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">Existing workspaces</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                      Open a candidate to continue their workflow. Each card shows how far through the process they are and whether background work is still running.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-right">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Total workspaces</div>
                    <div className="mt-1 text-2xl font-semibold">{candidates.length}</div>
                  </div>
                </div>

                {message ? <p className="mt-4 text-sm text-rose-700">{message}</p> : null}

                {candidates.length === 0 ? (
                  <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-sm text-neutral-600">
                    No Career Intelligence workspaces yet. Create the first candidate workspace to get started.
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    {candidates.map((candidate) => {
                      const stage = getCandidateStage(candidate)
                      return (
                        <Link
                          key={candidate.id}
                          href={`/career/${candidate.id}`}
                          className="block rounded-[1.5rem] border border-neutral-200 bg-neutral-50 px-5 py-5 transition hover:border-neutral-300 hover:bg-white"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-lg font-semibold text-neutral-900">{candidate.full_name || "Untitled candidate"}</div>
                                <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${stage.badgeClass}`}>
                                  {stage.label}
                                </span>
                                {candidate.overdue_follow_up_count > 0 ? (
                                  <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-rose-700">
                                    {candidate.overdue_follow_up_count} overdue
                                  </span>
                                ) : null}
                                {candidate.due_today_count > 0 ? (
                                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-amber-800">
                                    {candidate.due_today_count} due today
                                  </span>
                                ) : null}
                                {candidate.active_run_count > 0 ? (
                                  <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-sky-700">
                                    {candidate.active_run_count} running
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-2 text-sm text-neutral-600">
                                {[candidate.city || "No city", formatPrimaryGoal(candidate.primary_goal)].join(" | ")}
                              </div>
                              <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">{stage.description}</p>
                              <div className="mt-4">
                                <ReadinessBar score={candidate.readiness_score} />
                              </div>
                            </div>
                            <div className="text-right text-xs text-neutral-400">
                              <div>Created {candidate.created_at ? new Date(candidate.created_at).toLocaleDateString() : "Unknown"}</div>
                              <div className="mt-1">Updated {candidate.latest_activity_at ? new Date(candidate.latest_activity_at).toLocaleDateString() : "Unknown"}</div>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-4">
                            <WorkspaceStat label="Readiness" value={`${candidate.readiness_score}%`} />
                            <WorkspaceStat label="Inputs" value={String(candidate.document_count)} />
                            <WorkspaceStat label="Profiles" value={String(candidate.profile_count)} />
                            <WorkspaceStat label="Saved outputs" value={String(candidate.asset_count)} />
                            <WorkspaceStat label="Active roles" value={String(candidate.active_application_count)} />
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </section>
            </div>

          </div>
        )}
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

function GuideCard({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748b]">Step {step}</div>
      <div className="mt-2 font-semibold text-[#0f172a]">{title}</div>
      <p className="mt-2 text-sm leading-6 text-[#475569]">{description}</p>
    </div>
  )
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-3xl border border-[#d9e2ec] bg-white/90 p-5 shadow-sm backdrop-blur">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748b]">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-[#0f172a]">{value}</div>
      <div className="mt-2 text-sm text-[#475569]">{hint}</div>
    </div>
  )
}

function FeaturePanel({ title, description }: { title: string; description: string }) {
  return (
    <section className="rounded-3xl border border-[#d9e2ec] bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-[#0f172a]">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-[#475569]">{description}</p>
    </section>
  )
}

function WorkspaceStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-neutral-900">{value}</div>
    </div>
  )
}

function UrgencyCard({
  title,
  value,
  description,
  tone,
}: {
  title: string
  value: string
  description: string
  tone: "neutral" | "warning" | "danger"
}) {
  const toneClass =
    tone === "danger"
      ? "border-rose-200 bg-rose-50"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50"
        : "border-[#d9e2ec] bg-white"

  return (
    <section className={`rounded-3xl border p-5 shadow-sm ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748b]">{title}</div>
      <div className="mt-2 text-3xl font-semibold text-[#0f172a]">{value}</div>
      <p className="mt-2 text-sm leading-6 text-[#475569]">{description}</p>
    </section>
  )
}

function ReadinessBar({ score }: { score: number }) {
  const normalized = Math.max(0, Math.min(100, score))
  const toneClass =
    normalized >= 70 ? "bg-emerald-500" : normalized >= 40 ? "bg-amber-500" : "bg-neutral-400"

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
        <span>Market readiness</span>
        <span>{normalized}%</span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-neutral-200">
        <div className={`h-full rounded-full ${toneClass}`} style={{ width: `${normalized}%` }} />
      </div>
    </div>
  )
}

function getCandidateStage(candidate: CandidateRow) {
  if (candidate.active_run_count > 0) {
    return {
      label: "Processing",
      description: "Background work is running for this candidate, so new results may appear as soon as processing finishes.",
      badgeClass: "bg-sky-100 text-sky-700",
    }
  }

  if (candidate.asset_count > 0 || candidate.live_search_count > 0) {
    return {
      label: "Execution",
      description: "This workspace already has generated outputs and is ready for tailoring, interview work, and live opportunity matching.",
      badgeClass: "bg-emerald-100 text-emerald-700",
    }
  }

  if (candidate.profile_count > 0) {
    return {
      label: "Positioned",
      description: "The professional narrative exists. Next step is to build outward-facing assets such as CV, LinkedIn, and cover letters.",
      badgeClass: "bg-violet-100 text-violet-700",
    }
  }

  if (candidate.document_count > 0) {
    return {
      label: "Ready for profile",
      description: "Source material is loaded. The next high-value action is to generate the candidate positioning pack.",
      badgeClass: "bg-amber-100 text-amber-800",
    }
  }

  return {
    label: "Needs inputs",
    description: "This workspace has been created but still needs source material such as a CV, Gallup Strengths report, and LinkedIn text.",
    badgeClass: "bg-neutral-200 text-neutral-700",
  }
}

function formatPrimaryGoal(primaryGoal: string | null | undefined) {
  if (!primaryGoal) return "No goal set"
  return primaryGoal
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
