"use client"

import { useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { getAuthHeaders } from "@/lib/career-client"

type TesterNote = {
  id: string
  note_type: "bug" | "improvement" | "question"
  severity: "low" | "medium" | "high"
  status: "open" | "in_review" | "resolved"
  message: string
  module: string
  route_path: string
  section_anchor: string | null
  created_at: string
}

function resolveModuleFromPath(pathname: string) {
  if (pathname.startsWith("/career")) return "career-intelligence"
  if (pathname.startsWith("/persona-foundry")) return "persona-foundry"
  if (pathname.startsWith("/teamsync")) return "teamsync"
  if (pathname.startsWith("/admin") || pathname.startsWith("/control-center") || pathname.startsWith("/operations")) return "control-center"
  if (pathname.startsWith("/community")) return "community"
  return "platform"
}

function findVisibleSectionAnchor() {
  if (typeof window === "undefined") return ""
  const candidates = document.querySelectorAll<HTMLElement>("section[id], [data-help-section], [id]")
  for (const node of candidates) {
    const rect = node.getBoundingClientRect()
    if (rect.top <= 180 && rect.bottom >= 140) {
      return node.id || node.getAttribute("data-help-section") || ""
    }
  }
  return ""
}

export function TesterNotesWidget({ enabled = true }: { enabled?: boolean }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [noteType, setNoteType] = useState<"bug" | "improvement" | "question">("improvement")
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("medium")
  const [message, setMessage] = useState("")
  const [statusMessage, setStatusMessage] = useState("")
  const [statusTone, setStatusTone] = useState<"success" | "error" | "info">("info")
  const [recentNotes, setRecentNotes] = useState<TesterNote[]>([])
  const [loadingRecent, setLoadingRecent] = useState(false)

  const moduleName = useMemo(() => resolveModuleFromPath(pathname), [pathname])

  async function loadRecentNotes() {
    setLoadingRecent(true)
    try {
      const response = await fetch("/api/tester-notes", {
        headers: await getAuthHeaders(),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Could not load notes")
      }
      setRecentNotes(Array.isArray(json.notes) ? (json.notes as TesterNote[]) : [])
    } catch (error) {
      setStatusTone("error")
      setStatusMessage(error instanceof Error ? error.message : "Could not load notes")
    } finally {
      setLoadingRecent(false)
    }
  }

  async function submitNote() {
    if (!message.trim()) {
      setStatusTone("error")
      setStatusMessage("Please add a short note before sending.")
      return
    }

    setLoading(true)
    setStatusMessage("")
    try {
      const sectionAnchor = findVisibleSectionAnchor()
      const fullUrl =
        typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}` : pathname
      const response = await fetch("/api/tester-notes", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          note_type: noteType,
          severity,
          message: message.trim(),
          module: moduleName,
          route_path: pathname,
          full_url: fullUrl,
          section_anchor: sectionAnchor || (typeof window !== "undefined" ? window.location.hash.replace("#", "") : ""),
          page_title: typeof document !== "undefined" ? document.title : "",
          viewport_width: typeof window !== "undefined" ? window.innerWidth : null,
          viewport_height: typeof window !== "undefined" ? window.innerHeight : null,
          browser_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
          metadata: {
            hash: typeof window !== "undefined" ? window.location.hash || null : null,
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          },
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Could not save note")
      }
      setMessage("")
      setStatusTone("success")
      setStatusMessage("Saved. Thanks for helping improve Personara.")
      await loadRecentNotes()
    } catch (error) {
      setStatusTone("error")
      setStatusMessage(error instanceof Error ? error.message : "Could not save note")
    } finally {
      setLoading(false)
    }
  }

  if (!enabled) return null

  return (
    <>
      <button
        type="button"
        onClick={() => {
          const nextOpen = !open
          setOpen(nextOpen)
          if (nextOpen) {
            void loadRecentNotes()
          }
        }}
        className={`inline-flex items-center rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
          open ? "border-[#0a66c2] bg-[#e8f3ff] text-[#0a66c2]" : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
        }`}
        title="Share bug reports and ideas with context"
      >
        Tester Feedback
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Tester feedback"
          className="fixed right-4 top-24 z-[75] w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-[#d8e4f2] bg-white p-4 shadow-xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[#0f172a]">Tester feedback</h3>
              <p className="mt-1 text-xs text-neutral-600">We attach route + section context automatically.</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
            >
              Close
            </button>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-600">
              Type
              <select
                value={noteType}
                onChange={(event) => setNoteType(event.target.value as "bug" | "improvement" | "question")}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-xs font-medium normal-case text-neutral-800"
              >
                <option value="improvement">Improvement</option>
                <option value="bug">Bug</option>
                <option value="question">Question</option>
              </select>
            </label>
            <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-600">
              Severity
              <select
                value={severity}
                onChange={(event) => setSeverity(event.target.value as "low" | "medium" | "high")}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-xs font-medium normal-case text-neutral-800"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>

          <label className="mt-3 block text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-600">
            Note
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="mt-1 min-h-[88px] w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm normal-case text-neutral-800"
              placeholder="What happened, and what should be improved?"
            />
          </label>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="text-[11px] text-neutral-500">
              <span className="font-semibold text-neutral-700">{moduleName}</span> · {pathname}
            </div>
            <button
              type="button"
              onClick={() => void submitNote()}
              disabled={loading}
              className="rounded-lg border border-[#0a66c2] bg-[#0a66c2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#004182] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Saving..." : "Send note"}
            </button>
          </div>

          {statusMessage ? (
            <p
              className={`mt-2 text-xs ${
                statusTone === "success" ? "text-emerald-700" : statusTone === "error" ? "text-rose-700" : "text-neutral-700"
              }`}
            >
              {statusMessage}
            </p>
          ) : null}

          <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-600">Recent notes</div>
            {loadingRecent ? (
              <p className="mt-1 text-xs text-neutral-500">Loading…</p>
            ) : recentNotes.length === 0 ? (
              <p className="mt-1 text-xs text-neutral-500">No notes yet.</p>
            ) : (
              <ul className="mt-1 space-y-1.5">
                {recentNotes.slice(0, 4).map((note) => (
                  <li key={note.id} className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-700">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold capitalize">{note.note_type}</span>
                      <span className="uppercase tracking-[0.06em] text-neutral-500">{note.status.replace("_", " ")}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-neutral-600">{note.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
