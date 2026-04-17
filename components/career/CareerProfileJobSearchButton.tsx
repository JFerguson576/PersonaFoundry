"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { CareerStatusBanner } from "@/components/career/CareerStatusBanner"
import { careerActionErrorMessage, careerBackgroundStartedMessage, getAuthHeaders, getCareerMessageTone, notifyCareerWorkspaceRefresh } from "@/lib/career-client"

type Props = {
  candidateId: string
  targetRole: string
  location: string
  supportingRoles: string[]
  careerIdentity: string
}

export function CareerProfileJobSearchButton({ candidateId, targetRole, location, supportingRoles, careerIdentity }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  async function handleSearch() {
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
          market_notes: [
            careerIdentity ? `Career identity: ${careerIdentity}` : "",
            supportingRoles.length > 0 ? `Also consider these related roles: ${supportingRoles.join(", ")}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        }),
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to start profile-matched job search")
      }

      setMessage(
        careerBackgroundStartedMessage({
          label: `Live job search for ${targetRole}${location ? ` in ${location}` : ""}`,
          destination: "the live opportunities section",
        })
      )
      notifyCareerWorkspaceRefresh()
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : careerActionErrorMessage("start the profile-matched job search"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Search jobs from this profile</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Use the candidate&apos;s current positioning to search for matching live jobs automatically.
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            Target role: <span className="font-medium text-neutral-800">{targetRole || "Not available yet"}</span>
            {location ? <span> | Location: <span className="font-medium text-neutral-800">{location}</span></span> : null}
          </p>
          <p className="mt-2 text-sm text-emerald-700">
            This search now starts as a tracked background run, so the user can continue working elsewhere in the workspace.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading || !targetRole}
          className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Starting background search..." : "Search jobs that match this profile"}
        </button>
      </div>

      {supportingRoles.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Related roles from the profile</div>
          <p className="mt-2 text-sm leading-6 text-neutral-700">{supportingRoles.join(", ")}</p>
        </div>
      ) : null}

      {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} className="mt-4" /> : null}
    </div>
  )
}
