"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { getAuthHeaders } from "@/lib/career-client"

type CandidateQuickPick = {
  id: string
  full_name: string | null
  city: string | null
  primary_goal: string | null
}

type StaticAction = {
  id: string
  label: string
  href: string
  tags: string
}

const STATIC_ACTIONS: StaticAction[] = [
  { id: "platform", label: "Open Platform", href: "/platform", tags: "home main platform" },
  { id: "marketing", label: "Open Marketing Engine", href: "/control-center/marketing-engine", tags: "marketing engine control center growth" },
  { id: "career", label: "Open Career Control Center", href: "/career?view=control", tags: "career control center dashboard" },
  { id: "career-preview", label: "Open Candidate View Preview", href: "/career?view=preview", tags: "career preview candidate view" },
  { id: "admin", label: "Open Admin Dashboard", href: "/admin", tags: "admin dashboard superuser management" },
  { id: "operations", label: "Open Operations Monitor", href: "/operations", tags: "operations jobs monitor retries failures queues" },
  { id: "persona", label: "Open Persona Foundry", href: "/persona-foundry", tags: "persona foundry ai personality" },
  { id: "teamsync", label: "Open TeamSync", href: "/teamsync", tags: "teamsync team family dynamics" },
]

export function GlobalCommandBar() {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState(false)
  const [candidateResults, setCandidateResults] = useState<CandidateQuickPick[]>([])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isK = event.key.toLowerCase() === "k"
      const hasModifier = event.metaKey || event.ctrlKey
      if (isK && hasModifier) {
        event.preventDefault()
        setOpen((current) => !current)
      }
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (!open) return
    async function loadCandidates() {
      setBusy(true)
      try {
        const response = await fetch("/api/career/candidates", {
          cache: "no-store",
          headers: await getAuthHeaders(),
        })
        const json = await response.json()
        if (!response.ok) {
          setCandidateResults([])
          return
        }
        setCandidateResults((json.candidates ?? []) as CandidateQuickPick[])
      } catch {
        setCandidateResults([])
      } finally {
        setBusy(false)
      }
    }
    void loadCandidates()
  }, [open])

  const normalizedQuery = query.trim().toLowerCase()
  const matchingActions = useMemo(() => {
    if (!normalizedQuery) return STATIC_ACTIONS
    return STATIC_ACTIONS.filter((action) => `${action.label} ${action.tags}`.toLowerCase().includes(normalizedQuery))
  }, [normalizedQuery])

  const matchingCandidates = useMemo(() => {
    if (!normalizedQuery) return candidateResults.slice(0, 8)
    return candidateResults
      .filter((candidate) =>
        [candidate.full_name, candidate.city, candidate.primary_goal, candidate.id]
          .filter((value): value is string => Boolean(value))
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery)
      )
      .slice(0, 8)
  }, [candidateResults, normalizedQuery])

  function openHref(href: string) {
    router.push(href)
    setOpen(false)
    setQuery("")
  }

  function openCandidate(candidateId: string) {
    router.push(`/career/${candidateId}`)
    setOpen(false)
    setQuery("")
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 top-20 z-[70] rounded-full border border-[#d0d7e2] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#334155] shadow-sm hover:bg-[#f8fafc]"
      >
        Command
      </button>
      {open ? (
        <div className="fixed inset-0 z-[80] bg-black/25 p-4 sm:p-8" onClick={() => setOpen(false)}>
          <div
            className="mx-auto max-w-3xl rounded-2xl border border-[#d8e4f2] bg-white p-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5b6b7c]">Global command bar</div>
              <div className="text-[11px] text-neutral-500">Ctrl/Cmd + K</div>
            </div>
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search actions, modules, or candidates..."
              className="mt-2 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
            />
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-2">
                <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Navigation</div>
                <div className="mt-1 space-y-1">
                  {matchingActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => openHref(action.href)}
                      className={`w-full rounded-lg border px-2.5 py-2 text-left text-sm ${
                        pathname === action.href.split("?")[0]
                          ? "border-sky-300 bg-sky-50 text-sky-900"
                          : "border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-100"
                      }`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-2">
                <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Candidates</div>
                <div className="mt-1 space-y-1">
                  {busy ? <div className="rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-sm text-neutral-500">Loading candidates...</div> : null}
                  {!busy && matchingCandidates.length === 0 ? (
                    <div className="rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-sm text-neutral-500">
                      No candidates found.
                    </div>
                  ) : null}
                  {!busy
                    ? matchingCandidates.map((candidate) => (
                        <button
                          key={candidate.id}
                          type="button"
                          onClick={() => openCandidate(candidate.id)}
                          className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-100"
                        >
                          <div className="font-semibold">{candidate.full_name || "Untitled candidate"}</div>
                          <div className="text-xs text-neutral-500">
                            {[candidate.city, candidate.primary_goal].filter(Boolean).join(" | ") || candidate.id}
                          </div>
                        </button>
                      ))
                    : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
