"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, type FormEvent } from "react"
import { CareerStatusBanner } from "@/components/career/CareerStatusBanner"
import { careerActionErrorMessage, careerBackgroundStartedMessage, getCareerMessageTone, startCareerBackgroundJob } from "@/lib/career-client"

type Props = {
  candidateId: string
  targetWorkflowStatus?: string | null
  initialPrefill?: {
    companyName?: string
    companyWebsite?: string
    jobTitle?: string
    jobDescription?: string
  }
}

export function CareerTargetCompanyWorkflow({ candidateId, targetWorkflowStatus = null, initialPrefill }: Props) {
  const router = useRouter()
  const [companyName, setCompanyName] = useState(initialPrefill?.companyName || "")
  const [companyWebsite, setCompanyWebsite] = useState(initialPrefill?.companyWebsite || "")
  const [jobTitle, setJobTitle] = useState(initialPrefill?.jobTitle || "")
  const [jobDescription, setJobDescription] = useState(initialPrefill?.jobDescription || "")
  const [dossierInfluence, setDossierInfluence] = useState("medium")
  const [loading, setLoading] = useState(false)
  const [startedWorkflow, setStartedWorkflow] = useState(false)
  const [message, setMessage] = useState("")
  const persistedWorkflowRunning = targetWorkflowStatus === "queued" || targetWorkflowStatus === "running"
  const persistedWorkflowFinished = targetWorkflowStatus === "completed" || targetWorkflowStatus === "failed"
  const targetWorkflowRunning = loading || persistedWorkflowRunning || (startedWorkflow && !persistedWorkflowFinished)

  useEffect(() => {
    if (persistedWorkflowFinished) {
      setStartedWorkflow(false)
    }
  }, [persistedWorkflowFinished])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage("")

    try {
      await startCareerBackgroundJob(candidateId, "generate_target_company_workflow", {
        company_name: companyName,
        company_website: companyWebsite,
        job_title: jobTitle,
        job_description: jobDescription,
        dossier_influence: dossierInfluence,
      })
      setMessage(
        careerBackgroundStartedMessage({
          label: "Target company workflow",
          destination: "the company, cover letter, and interview sections",
        })
      )
      setStartedWorkflow(true)
      router.refresh()
    } catch (error) {
      setStartedWorkflow(false)
      setMessage(error instanceof Error ? error.message : careerActionErrorMessage("start the target company workflow"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-sky-200 bg-white p-4 text-neutral-900 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">Company workflow</div>
          <h2 className="mt-1 text-lg font-semibold">Research company and create tailored outputs</h2>
          <p className="mt-1 text-sm leading-5 text-neutral-600">
            Use one company brief to create the employer dossier, a company-matched cover letter, and interview prep.
          </p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-sky-800">
          Dossier + letter + prep
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">Company name</label>
          <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">Company website</label>
          <input
            value={companyWebsite}
            onChange={(event) => setCompanyWebsite(event.target.value)}
            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
            placeholder="Optional"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">Target role</label>
        <input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">Company tone influence</label>
        <div className="grid gap-2 md:grid-cols-3">
          {[
            { value: "low", label: "Low", description: "Keep the candidate voice." },
            { value: "medium", label: "Medium", description: "Blend candidate and company tone." },
            { value: "strong", label: "Strong", description: "Use more company language." },
          ].map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-xl border px-3 py-2 text-sm ${
                dossierInfluence === option.value ? "border-sky-300 bg-sky-50 text-sky-950" : "border-neutral-200 bg-neutral-50 text-neutral-700"
              }`}
            >
              <input
                type="radio"
                name="target-company-dossier-influence"
                value={option.value}
                checked={dossierInfluence === option.value}
                onChange={(event) => setDossierInfluence(event.target.value)}
                className="sr-only"
              />
              <div className="font-semibold">{option.label}</div>
              <p className="mt-0.5 text-xs leading-4">{option.description}</p>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">Job description</label>
        <textarea
          value={jobDescription}
          onChange={(event) => setJobDescription(event.target.value)}
          className="min-h-[130px] w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm leading-5"
          placeholder="Paste the full role description here..."
        />
      </div>

      {targetWorkflowRunning ? (
        <div className="inline-flex w-fit rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800">
          {loading ? "Starting workflow..." : "Target company workflow running"}
        </div>
      ) : (
        <button
          type="submit"
          disabled={!companyName.trim() || !jobDescription.trim()}
          className="rounded-xl bg-[#0f172a] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Run target company workflow
        </button>
      )}

      {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} /> : null}
    </form>
  )
}
