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
    <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Create CV and LinkedIn drafts</h2>
      <p className="mt-2 text-sm text-neutral-600">
        Generate a reusable CV summary, stronger experience bullets, a LinkedIn headline, and a rewritten About section from the current positioning pack.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">Use this after</div>
          <p className="mt-2 text-sm leading-6 text-emerald-950">
            Run this once the candidate profile and positioning are in place, so the drafts reflect a stronger narrative.
          </p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">What gets created</div>
          <p className="mt-2 text-sm leading-6 text-sky-950">
            CV draft outputs and LinkedIn-ready language that can then be reviewed, edited, and reused across applications.
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Where it saves</div>
          <p className="mt-2 text-sm leading-6 text-neutral-700">
            The finished files appear in the saved library and application documents area when the background run completes.
          </p>
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="mt-4 rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Generating drafts..." : "Generate CV and LinkedIn drafts"}
      </button>

      {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} className="mt-3" /> : null}
    </div>
  )
}
