"use client"

import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { CareerStatusBanner } from "@/components/career/CareerStatusBanner"
import { careerActionErrorMessage, careerBackgroundStartedMessage, getAuthHeaders, getCareerMessageTone, notifyCareerWorkspaceRefresh } from "@/lib/career-client"

type Props = {
  candidateId: string
}

export function CareerLiveJobFinder({ candidateId }: Props) {
  const router = useRouter()
  const [targetRole, setTargetRole] = useState("")
  const [location, setLocation] = useState("")
  const [marketNotes, setMarketNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage("")

    try {
      const response = await fetch("/api/career/live-job-search-runs", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          candidate_id: candidateId,
          target_role: targetRole,
          location,
          market_notes: marketNotes,
          target_countries: ["NZ"],
        }),
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to start live job search")
      }

      setTargetRole("")
      setLocation("")
      setMarketNotes("")
      setMessage(
        careerBackgroundStartedMessage({
          label: "Live job search",
          destination: "the live opportunities section",
          followUp: "You can leave this screen and come back while it continues.",
        })
      )
      notifyCareerWorkspaceRefresh()
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : careerActionErrorMessage("start the live job search"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold">Find live job opportunities</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Search the live web for current public roles that fit this candidate, then save the strongest opportunities into the workspace.
        </p>
        <p className="mt-2 text-sm text-neutral-500">Saved searches appear in the live opportunities panels on the right.</p>
        <p className="mt-2 text-sm text-emerald-700">This search now starts as a tracked background run. You can move to other screens and return later to review the result.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">Use this after</div>
          <p className="mt-2 text-sm leading-6 text-emerald-950">
            Run live search once the candidate profile is solid, so the search can be shaped around clearer target roles and stronger positioning.
          </p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">What it creates</div>
          <p className="mt-2 text-sm leading-6 text-sky-950">
            A saved live-market search with role matches, company names, and opportunities that can be shortlisted into the application tracker.
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Where it saves</div>
          <p className="mt-2 text-sm leading-6 text-neutral-700">
            Results land in the live opportunities area of this workspace and remain available even if you leave the page while the run is processing.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Target role</label>
          <input
            value={targetRole}
            onChange={(event) => setTargetRole(event.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2"
            placeholder="e.g. Chief of Staff"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Location</label>
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2"
            placeholder="e.g. Auckland or Remote"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
        <div className="mb-2 text-sm font-medium">Search market</div>
        <p className="mb-3 text-xs text-neutral-600">
          Live search is currently tuned for New Zealand. International targeting will be enabled in a later release.
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-[#0a66c2] bg-[#e8f3ff] px-3 py-1 text-xs font-semibold text-[#0a66c2]">
            ✓ New Zealand
          </span>
          <span className="cursor-not-allowed rounded-full border border-neutral-200 bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-500">
            International (Coming soon)
          </span>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Search notes</label>
        <textarea
          value={marketNotes}
          onChange={(event) => setMarketNotes(event.target.value)}
          className="min-h-[160px] w-full rounded-2xl border border-neutral-300 px-3 py-3 text-sm leading-6"
          placeholder="Optional: add industries, target employers, salary notes, remote preferences, or pasted job-board links..."
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-600">Primary action</div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={loading || !targetRole.trim()}
            className="rounded-full border border-[#0a66c2] bg-[#0a66c2] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[#004182]"
          >
            {loading ? "Starting..." : "Run live search"}
          </button>
          <div
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
              targetRole.trim() ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-neutral-200 bg-neutral-50 text-neutral-500"
            }`}
          >
            {targetRole.trim() ? "Ready" : "Needs target role"}
          </div>
        </div>
      </div>

      {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} /> : null}
      <p className="text-sm text-neutral-500">Tip: add location, employer themes, salary context, or target industries in the notes box to improve the quality of the search.</p>
    </form>
  )
}
