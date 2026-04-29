"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, type FormEvent } from "react"
import { CareerStatusBanner } from "@/components/career/CareerStatusBanner"
import { careerActionErrorMessage, careerBackgroundStartedMessage, getCareerMessageTone, startCareerBackgroundJob } from "@/lib/career-client"

type Props = {
  candidateId: string
  interviewPrepStatus?: string | null
  initialPrefill?: {
    jobTitle?: string
    companyName?: string
    jobDescription?: string
  }
}

export function CareerInterviewPrepGenerator({ candidateId, interviewPrepStatus = null, initialPrefill }: Props) {
  const router = useRouter()
  const [jobTitle, setJobTitle] = useState(initialPrefill?.jobTitle || "")
  const [companyName, setCompanyName] = useState(initialPrefill?.companyName || "")
  const [jobDescription, setJobDescription] = useState(initialPrefill?.jobDescription || "")
  const [strengthVoiceInfluence, setStrengthVoiceInfluence] = useState("medium")
  const [loading, setLoading] = useState(false)
  const [startedPrep, setStartedPrep] = useState(false)
  const [message, setMessage] = useState("")
  const canGenerate = Boolean(jobDescription.trim())
  const persistedPrepRunning = interviewPrepStatus === "queued" || interviewPrepStatus === "running"
  const persistedPrepFinished = interviewPrepStatus === "completed" || interviewPrepStatus === "failed"
  const prepRunning = loading || persistedPrepRunning || (startedPrep && !persistedPrepFinished)

  useEffect(() => {
    if (persistedPrepFinished) {
      setStartedPrep(false)
    }
  }, [persistedPrepFinished])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage("")

    try {
      await startCareerBackgroundJob(candidateId, "generate_interview_prep", {
        job_title: jobTitle,
        company_name: companyName,
        job_description: jobDescription,
        strength_voice_influence: strengthVoiceInfluence,
      })
      setMessage(
        careerBackgroundStartedMessage({
          label: "Interview prep",
          destination: "the interview section",
          followUp: "Save an interview reflection afterward to improve the next prep round.",
        })
      )
      setStartedPrep(true)
      router.refresh()
    } catch (error) {
      setStartedPrep(false)
      setMessage(error instanceof Error ? error.message : careerActionErrorMessage("start interview prep"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Step</div>
        <h2 className="text-xl font-semibold">Generate interview prep</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Paste a role description and the Career Intelligence engine will build practice questions, answer angles, and likely objections for this candidate.
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Saved interview prep appears in My files &gt; Interview prep and Recent files.
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          If the candidate has saved interview assessments from previous rounds, this prep will use them to improve the next training pack.
        </p>
      </div>

      <details className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-neutral-800">More info</summary>
        <div className="mt-3 space-y-2 text-sm leading-6 text-neutral-700">
          <p>
            <span className="font-semibold text-neutral-900">Use this after:</span> target role and company direction are mostly clear.
          </p>
          <p>
            <span className="font-semibold text-neutral-900">What it creates:</span> questions, objections, answer angles, and a role-specific prep pack.
          </p>
          <p>
            <span className="font-semibold text-neutral-900">Where it saves:</span> interview section, ready for later reflection-driven upgrades.
          </p>
        </div>
      </details>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Job title</label>
          <input
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2"
            placeholder="e.g. Senior Product Manager"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Company</label>
          <input
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2"
            placeholder="e.g. Atlassian"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Job description</label>
        <textarea
          value={jobDescription}
          onChange={(event) => setJobDescription(event.target.value)}
          className="min-h-[220px] w-full rounded-2xl border border-neutral-300 px-3 py-3 text-sm leading-6"
          placeholder="Paste the role description here..."
        />
      </div>

      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
        <div className="text-sm font-medium text-neutral-900">Strength voice influence</div>
        <p className="mt-1 text-sm leading-6 text-neutral-600">
          Controls how strongly Gallup strengths shape answer framing and coaching tone.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {[
            {
              value: "low",
              label: "Low",
              description: "Mostly neutral coaching with light strengths references.",
            },
            {
              value: "medium",
              label: "Medium",
              description: "Balanced coaching with clear strengths integration.",
            },
            {
              value: "high",
              label: "High",
              description: "Strong strengths-led answer framing and rehearsal guidance.",
            },
          ].map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-2xl border px-4 py-3 text-sm ${
                strengthVoiceInfluence === option.value
                  ? "border-indigo-700 bg-white text-neutral-900"
                  : "border-indigo-200 bg-indigo-100 text-neutral-700"
              }`}
            >
              <input
                type="radio"
                name="strength-voice-influence-interview"
                value={option.value}
                checked={strengthVoiceInfluence === option.value}
                onChange={(event) => setStrengthVoiceInfluence(event.target.value)}
                className="sr-only"
              />
              <div className="font-semibold">{option.label}</div>
              <p className="mt-1 leading-6">{option.description}</p>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-600">Primary action</div>
        <div className="flex flex-wrap items-center gap-2">
          {prepRunning ? (
            <div className="inline-flex rounded-full border border-neutral-200 bg-neutral-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-600">
              {loading ? "Starting prep..." : "Prep running"}
            </div>
          ) : (
            <button
              type="submit"
              disabled={!canGenerate}
              title="Generate interview prep and save it to the interview section."
              className="rounded-full border border-[#0a66c2] bg-[#0a66c2] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[#004182]"
            >
              Generate prep
            </button>
          )}
          <div
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
              canGenerate ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-neutral-200 bg-neutral-50 text-neutral-500"
            }`}
          >
            {canGenerate ? "Ready" : "Needs job description"}
          </div>
        </div>
      </div>

      {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} /> : null}
      <p className="text-sm text-neutral-500">After the real interview, save a reflection so the next prep round becomes more targeted and useful.</p>
    </form>
  )
}
