"use client"

import { useEffect, useMemo, useState } from "react"
import { getAuthHeaders } from "@/lib/career-client"

type TourModuleMetric = {
  module: "career" | "persona" | "teamsync"
  completed_users: number
  completion_rate_percent: number
  recent_7d_completions: number
}

type TourOverview = {
  table_missing: boolean
  tour_version: string
  totals: {
    users: number
    completed_all_modules: number
    completion_rate_percent: number
  }
  modules: TourModuleMetric[]
}

const moduleLabels: Record<TourModuleMetric["module"], string> = {
  career: "Career",
  persona: "Persona",
  teamsync: "TeamSync",
}

export function AdminTourCompletionPanel({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<TourOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError("")
      try {
        const response = await fetch("/api/admin/tour-progress/overview", {
          cache: "no-store",
          headers: await getAuthHeaders(),
        })
        const json = (await response.json()) as TourOverview & { error?: string }
        if (!response.ok) {
          throw new Error(json.error || "Failed to load walkthrough completion")
        }
        if (!cancelled) {
          setData(json)
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "Failed to load walkthrough completion")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const modules = useMemo(() => data?.modules ?? [], [data])

  return (
    <section className={`rounded-2xl border border-[#bfd2ed] bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] p-3 shadow-[0_14px_30px_-26px_rgba(26,54,93,0.5)] ${compact ? "" : "mt-3"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4c668c]">Onboarding completion</div>
          <h3 className="mt-1 text-sm font-semibold text-[#142c4f]">Product walkthrough health</h3>
        </div>
        {loading ? (
          <span className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
            Loading
          </span>
        ) : data ? (
          <span className="rounded-full border border-sky-300 bg-sky-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-800">
            {data.totals.completion_rate_percent}% all modules
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</div>
      ) : null}

      {!error && data?.table_missing ? (
        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Walkthrough tracking table is missing. Run <code>supabase/user_tour_progress.sql</code>.
        </div>
      ) : null}

      {!error && data && !data.table_missing ? (
        <>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <MiniStat label="Tracked users" value={String(data.totals.users)} />
            <MiniStat label="Completed all modules" value={String(data.totals.completed_all_modules)} />
            <MiniStat label="Completion rate" value={`${data.totals.completion_rate_percent}%`} />
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {modules.map((moduleRow) => (
              <div key={`tour-module-${moduleRow.module}`} className="rounded-xl border border-[#d1deef] bg-white px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5d7392]">{moduleLabels[moduleRow.module]}</div>
                <div className="mt-1 text-sm font-semibold text-[#142c4f]">
                  {moduleRow.completion_rate_percent}% ({moduleRow.completed_users})
                </div>
                <div className="mt-1 text-[11px] text-[#5b6b7c]">{moduleRow.recent_7d_completions} completions in last 7 days</div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </section>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#d1deef] bg-white px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5d7392]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[#142c4f]">{value}</div>
    </div>
  )
}
