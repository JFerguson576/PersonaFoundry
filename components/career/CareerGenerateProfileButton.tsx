"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { CareerStatusBanner } from "@/components/career/CareerStatusBanner"
import { careerActionErrorMessage, careerBackgroundStartedMessage, getCareerMessageTone, startCareerBackgroundJob } from "@/lib/career-client"

type Props = {
  candidateId: string
}

export function CareerGenerateProfileButton({ candidateId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  async function handleGenerate() {
    setLoading(true)
    setMessage("")

    try {
      await startCareerBackgroundJob(candidateId, "generate_profile", {})
      setMessage(
        careerBackgroundStartedMessage({
          label: "Career positioning",
          destination: "the positioning section",
        })
      )
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : careerActionErrorMessage("start career positioning"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Generate career positioning</h2>
      <p className="mt-2 text-sm text-neutral-600">
        Build a new career identity and positioning pack from the currently saved source material.
      </p>

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="mt-4 rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Generating..." : "Generate new positioning version"}
      </button>

      {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} className="mt-3" /> : null}
    </div>
  )
}
