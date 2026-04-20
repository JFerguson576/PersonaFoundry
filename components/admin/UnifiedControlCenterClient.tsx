"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { PlatformModuleNav } from "@/components/navigation/PlatformModuleNav"
import { getAuthHeaders } from "@/lib/career-client"
import { supabase } from "@/lib/supabase"

type AdminOverview = {
  permissions: {
    is_admin?: boolean
    is_superuser: boolean
  }
  totals: {
    total_users: number
    active_users: number
    total_candidates: number
    total_saved_profiles: number
    total_tokens: number
    estimated_cost_usd: number
  }
}

type JobsOverview = {
  summary: {
    background: { queued: number; running: number; failed: number; completed: number }
    live: { queued: number; running: number; failed: number; completed: number }
    failed_24h: number
  }
}

type MarketingOverview = {
  alerts: Array<{
    severity: "watch" | "critical" | "info" | string
    status: "open" | "acknowledged" | "resolved" | string
  }>
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

export function UnifiedControlCenterClient() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [admin, setAdmin] = useState<AdminOverview | null>(null)
  const [jobs, setJobs] = useState<JobsOverview | null>(null)
  const [marketing, setMarketing] = useState<MarketingOverview | null>(null)
  const [activePanel, setActivePanel] = useState<"operations" | "candidate" | "summary">("operations")

  const loadData = useCallback(async () => {
    setLoading(true)
    setMessage("")
    try {
      const headers = await getAuthHeaders()
      const [adminResponse, jobsResponse, marketingResponse] = await Promise.all([
        fetch("/api/admin/overview", { headers, cache: "no-store" }),
        fetch("/api/admin/jobs/overview", { headers, cache: "no-store" }),
        fetch("/api/admin/marketing/alerts", { headers, cache: "no-store" }),
      ])

      const [adminJson, jobsJson, marketingJson] = await Promise.all([
        adminResponse.json(),
        jobsResponse.json(),
        marketingResponse.json(),
      ])

      if (!adminResponse.ok) throw new Error(adminJson.error || "Could not load control center overview.")
      if (!jobsResponse.ok) throw new Error(jobsJson.error || "Could not load operations snapshot.")
      if (!marketingResponse.ok) throw new Error(marketingJson.error || "Could not load marketing snapshot.")

      setAdmin(adminJson as AdminOverview)
      setJobs(jobsJson as JobsOverview)
      setMarketing(marketingJson as MarketingOverview)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load control center.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    async function loadSessionAndData() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()
      setSession(currentSession)
      if (currentSession?.access_token) {
        await loadData()
      } else {
        setLoading(false)
      }
    }

    void loadSessionAndData()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })
    return () => subscription.unsubscribe()
  }, [loadData])

  const alertsSummary = useMemo(() => {
    const items = marketing?.alerts ?? []
    const open = items.filter((item) => item.status === "open").length
    const critical = items.filter((item) => item.status !== "resolved" && item.severity === "critical").length
    return { open, critical }
  }, [marketing])

  const runningJobs = useMemo(() => {
    if (!jobs) return 0
    return (jobs.summary.background.running ?? 0) + (jobs.summary.live.running ?? 0)
  }, [jobs])

  const queuedJobs = useMemo(() => {
    if (!jobs) return 0
    return (jobs.summary.background.queued ?? 0) + (jobs.summary.live.queued ?? 0)
  }, [jobs])

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f3f7fd_0%,#f8fafc_45%,#f1f5f9_100%)] text-neutral-900">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <PlatformModuleNav />

        {!session?.user ? (
          <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold text-[#0f172a]">Control Center</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Sign in first to access unified platform management dashboards.
            </p>
            <Link href="/platform" className="mt-4 inline-flex rounded-xl border border-[#0a66c2] bg-[#0a66c2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#004182]">
              Go to platform
            </Link>
          </section>
        ) : (
          <>
            <section className="rounded-[2rem] border border-[#d8e4f2] bg-[linear-gradient(135deg,#0f172a_0%,#1e3a8a_48%,#0a66c2_100%)] p-6 text-white shadow-lg shadow-sky-200/50">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100/90">Unified Control Center</p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight">One dashboard for platform operations</h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-sky-100/90">
                    This consolidates Admin, Operations, and Marketing views so you can monitor risk, growth, and workflow health from one place.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadData()}
                  disabled={loading}
                  className="rounded-xl border border-white/35 bg-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </section>

            {message ? (
              <section className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {message}
              </section>
            ) : null}

            <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Active users"
                value={formatNumber(admin?.totals.active_users ?? 0)}
                hint={`${formatNumber(admin?.totals.total_users ?? 0)} total accounts`}
                tone="info"
              />
              <MetricCard
                label="Candidate workspaces"
                value={formatNumber(admin?.totals.total_candidates ?? 0)}
                hint={`${formatNumber(admin?.totals.total_saved_profiles ?? 0)} profiles generated`}
                tone="success"
              />
              <MetricCard
                label="Token usage"
                value={formatNumber(admin?.totals.total_tokens ?? 0)}
                hint={`${formatMoney(admin?.totals.estimated_cost_usd ?? 0)} estimated cost`}
                tone="warning"
              />
              <MetricCard
                label="Critical alerts"
                value={formatNumber(alertsSummary.critical)}
                hint={`${formatNumber(alertsSummary.open)} open marketing alerts`}
                tone={alertsSummary.critical > 0 ? "danger" : "neutral"}
              />
            </section>

            <section className="mt-5 grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)]">
              <aside className="h-fit rounded-2xl border border-[#bfd2ed] bg-[linear-gradient(180deg,#f6faff_0%,#eaf2ff_100%)] p-3 shadow-[0_18px_36px_-28px_rgba(26,54,93,0.45)] xl:sticky xl:top-3">
                <details open className="rounded-xl border border-[#c7d8ee] bg-white">
                  <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#3d567d]">
                    Control sections
                  </summary>
                  <div className="px-2 pb-2 space-y-1">
                    <button
                      type="button"
                      onClick={() => setActivePanel("operations")}
                      className={`w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${
                        activePanel === "operations"
                          ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]"
                          : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"
                      }`}
                    >
                      Operations Hub
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePanel("candidate")}
                      className={`w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${
                        activePanel === "candidate"
                          ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]"
                          : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"
                      }`}
                    >
                      Candidate Management
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePanel("summary")}
                      className={`w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${
                        activePanel === "summary"
                          ? "border-[#8fb4ef] bg-[#eaf3ff] text-[#1f4f99]"
                          : "border-[#cbd8eb] bg-white text-[#36537d] hover:bg-[#f4f8ff]"
                      }`}
                    >
                      Control summary
                    </button>
                  </div>
                </details>
                <details open className="mt-2 rounded-xl border border-[#c7d8ee] bg-white">
                  <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#3d567d]">
                    Quick actions
                  </summary>
                  <div className="px-2 pb-2 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => void loadData()}
                      disabled={loading}
                      className="w-full rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading ? "Refreshing..." : "Refresh data"}
                    </button>
                    <Link href="/operations" className="block w-full rounded-full border border-[#cbd8eb] bg-white px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[#36537d] hover:bg-[#f4f8ff]">
                      Operations hub
                    </Link>
                    <Link href="/platform#modules" className="block w-full rounded-full border border-[#cbd8eb] bg-white px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[#36537d] hover:bg-[#f4f8ff]">
                      Main menu
                    </Link>
                  </div>
                </details>
              </aside>

              <div>
                {activePanel === "operations" ? (
                  <DashboardPanel
                    title="Operations Hub"
                    subtitle="Unified left-nav workspace for operations, admin controls, marketing engine, and candidate management."
                    tone="blue"
                    stats={[
                      { label: "Running jobs", value: formatNumber(runningJobs) },
                      { label: "Queued jobs", value: formatNumber(queuedJobs) },
                      { label: "Failed 24h", value: formatNumber(jobs?.summary.failed_24h ?? 0) },
                    ]}
                    ctaHref="/operations"
                    ctaLabel="Open Operations Hub"
                  />
                ) : null}
                {activePanel === "candidate" ? (
                  <DashboardPanel
                    title="Candidate Management"
                    subtitle="Control center view for workspace readiness, live role flow, and candidate progress signals."
                    tone="teal"
                    stats={[
                      { label: "Total workspaces", value: formatNumber(admin?.totals.total_candidates ?? 0) },
                      { label: "Profiles generated", value: formatNumber(admin?.totals.total_saved_profiles ?? 0) },
                    ]}
                    ctaHref="/career?view=control"
                    ctaLabel="Open Candidate Control"
                  />
                ) : null}
                {activePanel === "summary" ? (
                  <DashboardPanel
                    title="Control summary"
                    subtitle="Quick pulse card for alerts and spend. Full controls are now handled in Operations Hub."
                    tone="violet"
                    stats={[
                      { label: "Open alerts", value: formatNumber(alertsSummary.open) },
                      { label: "Critical alerts", value: formatNumber(alertsSummary.critical) },
                      { label: "Estimated cost", value: formatMoney(admin?.totals.estimated_cost_usd ?? 0) },
                    ]}
                    ctaHref="/operations"
                    ctaLabel="Go to Operations Hub"
                  />
                ) : null}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}

function MetricCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint: string
  tone: "info" | "success" | "warning" | "danger" | "neutral"
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-[linear-gradient(180deg,#f0fdf4_0%,#ecfdf5_100%)]"
      : tone === "warning"
      ? "border-amber-200 bg-[linear-gradient(180deg,#fffbeb_0%,#fef3c7_100%)]"
      : tone === "danger"
      ? "border-rose-200 bg-[linear-gradient(180deg,#fff1f2_0%,#ffe4e6_100%)]"
      : tone === "info"
      ? "border-sky-200 bg-[linear-gradient(180deg,#eff6ff_0%,#dbeafe_100%)]"
      : "border-neutral-200 bg-white"

  return (
    <article className={`rounded-2xl border px-4 py-3 shadow-sm ${toneClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-[#0f172a]">{value}</p>
      <p className="mt-1 text-xs text-neutral-600">{hint}</p>
    </article>
  )
}

function DashboardPanel({
  title,
  subtitle,
  stats,
  ctaHref,
  ctaLabel,
  tone,
}: {
  title: string
  subtitle: string
  stats: Array<{ label: string; value: string }>
  ctaHref: string
  ctaLabel: string
  tone: "blue" | "teal" | "violet"
}) {
  const toneClass =
    tone === "teal"
      ? "border-teal-200 bg-[linear-gradient(135deg,#f0fdfa_0%,#ecfeff_100%)]"
      : tone === "violet"
      ? "border-violet-200 bg-[linear-gradient(135deg,#f5f3ff_0%,#eef2ff_100%)]"
      : "border-sky-200 bg-[linear-gradient(135deg,#eff6ff_0%,#eef2ff_100%)]"

  return (
    <article className={`rounded-3xl border p-5 shadow-sm ${toneClass}`}>
      <h2 className="text-xl font-semibold text-[#0f172a]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-neutral-700">{subtitle}</p>
      <div className="mt-4 grid gap-2">
        {stats.map((stat) => (
          <div key={`${title}-${stat.label}`} className="rounded-xl border border-white/80 bg-white/80 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">{stat.label}</p>
            <p className="mt-0.5 text-xl font-semibold text-[#0f172a]">{stat.value}</p>
          </div>
        ))}
      </div>
      <Link href={ctaHref} className="mt-4 inline-flex rounded-xl border border-[#0a66c2] bg-[#0a66c2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#004182]">
        {ctaLabel}
      </Link>
    </article>
  )
}
