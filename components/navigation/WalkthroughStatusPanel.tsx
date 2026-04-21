"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

type TourModule = "career" | "persona" | "teamsync"

type ModuleStatus = {
  key: TourModule
  label: string
  relaunchHref: string
  completed: boolean | null
}

const MODULES: Array<Pick<ModuleStatus, "key" | "label" | "relaunchHref">> = [
  { key: "career", label: "Career Intelligence", relaunchHref: "/career?tour=1" },
  { key: "persona", label: "Persona Foundry", relaunchHref: "/persona-foundry?tour=1" },
  { key: "teamsync", label: "TeamSync", relaunchHref: "/teamsync?tour=1" },
]

export function WalkthroughStatusPanel() {
  const [statuses, setStatuses] = useState<ModuleStatus[]>(
    MODULES.map((moduleItem) => ({ ...moduleItem, completed: null }))
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadStatuses() {
      const nextStatuses: ModuleStatus[] = []
      for (const moduleItem of MODULES) {
        try {
          const response = await fetch(`/api/user/tour-progress?module=${moduleItem.key}`, { cache: "no-store" })
          if (!response.ok) {
            nextStatuses.push({ ...moduleItem, completed: null })
            continue
          }
          const payload = (await response.json()) as { completed?: boolean | null; table_missing?: boolean }
          if (payload.table_missing) {
            nextStatuses.push({ ...moduleItem, completed: null })
            continue
          }
          nextStatuses.push({ ...moduleItem, completed: payload.completed === true })
        } catch {
          nextStatuses.push({ ...moduleItem, completed: null })
        }
      }

      if (cancelled) return
      setStatuses(nextStatuses)
      setLoading(false)
    }

    void loadStatuses()
    return () => {
      cancelled = true
    }
  }, [])

  const completeCount = useMemo(
    () => statuses.filter((statusItem) => statusItem.completed === true).length,
    [statuses]
  )

  function getStatusCopy(status: ModuleStatus["completed"]) {
    if (status === true) {
      return {
        label: "Tour complete",
        meaning: "This module walkthrough has been completed.",
        action: "Restart tour",
        tone: "border-emerald-300 bg-emerald-50 text-emerald-700",
      }
    }

    if (status === false) {
      return {
        label: "Tour not started",
        meaning: "Start the walkthrough for a step-by-step introduction.",
        action: "Start tour",
        tone: "border-amber-300 bg-amber-50 text-amber-800",
      }
    }

    return {
      label: "Not tracked yet",
      meaning: "We have not detected walkthrough progress for this module yet.",
      action: "Start tour",
      tone: "border-neutral-300 bg-neutral-50 text-neutral-700",
    }
  }

  return (
    <section className="mt-5 rounded-3xl border border-[#c9d8ef] bg-[#f5f9ff] p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Module onboarding</p>
          <h2 className="mt-1 text-xl font-semibold text-[#142c4f]">Module onboarding progress</h2>
          <p className="mt-1 text-sm text-[#475569]">
            Track whether each module tour is complete, then restart any tour if a user needs help.
          </p>
        </div>
        <div className="rounded-full border border-[#bfd2ed] bg-white px-3 py-1 text-xs font-semibold text-[#2a63e5]">
          {loading ? "Loading..." : `${completeCount}/${statuses.length} completed`}
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {statuses.map((statusItem) => (
          <article key={`tour-status-${statusItem.key}`} className="rounded-2xl border border-[#d5e0f2] bg-white p-4">
            <h3 className="text-base font-semibold text-[#142c4f]">{statusItem.label}</h3>
            <div className="mt-2">
              <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getStatusCopy(statusItem.completed).tone}`}>
                {getStatusCopy(statusItem.completed).label}
              </span>
            </div>
            <p className="mt-2 text-sm text-[#475569]">{getStatusCopy(statusItem.completed).meaning}</p>
            <Link
              href={statusItem.relaunchHref}
              className="mt-3 inline-flex items-center rounded-xl border border-[#2a63e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#2a63e5] hover:bg-[#eef4ff]"
            >
              {getStatusCopy(statusItem.completed).action}
            </Link>
          </article>
        ))}
      </div>
    </section>
  )
}
