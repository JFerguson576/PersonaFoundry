"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { CareerStatusBanner } from "@/components/career/CareerStatusBanner"
import { careerActionErrorMessage, getAuthHeaders, getCareerMessageTone, notifyCareerWorkspaceRefresh, toCareerUserMessage } from "@/lib/career-client"

type Props = {
  candidateId: string
  variant?: "card" | "inline"
  label?: string
}

const PROFILE_GENERATION_TIMEOUT_MS = 120_000

export function CareerGenerateProfileButton({ candidateId, variant = "card", label = "Generate profile" }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  async function handleGenerate() {
    setLoading(true)
    setMessage("")

    try {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), PROFILE_GENERATION_TIMEOUT_MS)
      const response = await fetch("/api/career/generate-profile", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ candidate_id: candidateId }),
        signal: controller.signal,
      })
      window.clearTimeout(timeout)

      const json = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof json?.error === "string" ? json.error : careerActionErrorMessage("generate career positioning"))
      }

      setMessage("Career positioning generated. The workspace is refreshing with the new profile.")
      notifyCareerWorkspaceRefresh()
      router.refresh()
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setMessage("Profile generation timed out. Please try again, or reduce the source material before retrying.")
        return
      }
      setMessage(toCareerUserMessage(error instanceof Error ? error.message : null, careerActionErrorMessage("generate career positioning")))
    } finally {
      setLoading(false)
    }
  }

  const action = (
    <>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${
          loading ? "animate-pulse bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900" : "bg-black"
        }`}
      >
        {loading ? (
          <>
            <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden />
            Generating...
          </>
        ) : (
          label
        )}
      </button>
      {loading ? <p className="mt-2 text-xs text-neutral-600">This may take about a minute. Stay on this page while the profile is created.</p> : null}

      {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} className="mt-3" /> : null}
    </>
  )

  if (variant === "inline") {
    return <div>{action}</div>
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold">Generate career positioning</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Build the first career identity and positioning pack from the saved source material.
      </p>
      <div className="mt-3">{action}</div>
    </div>
  )
}
