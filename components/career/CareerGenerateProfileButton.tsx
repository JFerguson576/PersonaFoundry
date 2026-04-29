"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { CareerStatusBanner } from "@/components/career/CareerStatusBanner"
import {
  careerActionErrorMessage,
  getAuthHeaders,
  getCareerMessageTone,
  navigateCareerWorkspace,
  notifyCareerWorkspaceRefresh,
  toCareerUserMessage,
} from "@/lib/career-client"

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
      navigateCareerWorkspace("documents", "#base-asset-generator")
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

  const actionButton = (
    <button
      type="button"
      onClick={handleGenerate}
      disabled={loading}
      className={`inline-flex items-center gap-2 rounded-full border border-[#0a66c2] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-50 ${
        loading ? "animate-pulse bg-[#0a66c2]" : "bg-[#0a66c2] hover:bg-[#004182]"
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
  )

  if (variant === "inline") {
    return (
      <div>
        {actionButton}
        {loading ? <p className="mt-2 text-xs text-neutral-600">This may take about a minute. Stay on this page while the profile is created.</p> : null}
        {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} className="mt-3" /> : null}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold">Generate career positioning</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Build the first career identity and positioning pack from the saved source material.
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-600">Primary action</div>
        <div className="flex flex-wrap items-center gap-2">
          {actionButton}
          <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
            Ready
          </div>
        </div>
      </div>
      {loading ? <p className="mt-2 text-xs text-neutral-600">This may take about a minute. Stay on this page while the profile is created.</p> : null}
      {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} className="mt-3" /> : null}
    </div>
  )
}
