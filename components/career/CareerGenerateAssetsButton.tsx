"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { CareerStatusBanner } from "@/components/career/CareerStatusBanner"
import { careerActionErrorMessage, careerBackgroundStartedMessage, getCareerMessageTone, startCareerBackgroundJob } from "@/lib/career-client"

type Props = {
  candidateId: string
}

export function CareerGenerateAssetsButton({ candidateId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  async function handleGenerate() {
    setLoading(true)
    setMessage("")

    try {
      await startCareerBackgroundJob(candidateId, "generate_assets", {})
      setMessage(
        careerBackgroundStartedMessage({
          label: "CV and LinkedIn drafts",
          destination: "the saved library and application documents",
        })
      )
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : careerActionErrorMessage("start CV and LinkedIn draft generation"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Create CV and LinkedIn drafts</h2>
      <p className="mt-1 text-xs text-neutral-600">
        Generate a reusable CV summary, stronger experience bullets, a LinkedIn headline, and a rewritten About section from the current positioning pack.
      </p>
      <div className="mt-2 grid gap-2 md:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">Use this after</div>
          <p className="mt-1 text-[11px] leading-4 text-emerald-950">
            Run this once the candidate profile and positioning are in place, so the drafts reflect a stronger narrative.
          </p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">What gets created</div>
          <p className="mt-1 text-[11px] leading-4 text-sky-950">
            CV draft outputs and LinkedIn-ready language that can then be reviewed, edited, and reused across applications.
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Where it saves</div>
          <p className="mt-1 text-[11px] leading-4 text-neutral-700">
            The finished files appear in the saved library and application documents area when the background run completes.
          </p>
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="mt-3 rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Generating drafts..." : "Generate CV and LinkedIn drafts"}
      </button>

      {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} className="mt-3" /> : null}
    </div>
  )
}
