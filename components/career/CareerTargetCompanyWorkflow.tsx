"use client"

import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { CareerStatusBanner } from "@/components/career/CareerStatusBanner"
import { careerActionErrorMessage, careerBackgroundStartedMessage, getCareerMessageTone, startCareerBackgroundJob } from "@/lib/career-client"

type Props = {
  candidateId: string
  initialPrefill?: {
    companyName?: string
    companyWebsite?: string
    jobTitle?: string
    jobDescription?: string
  }
}

export function CareerTargetCompanyWorkflow({ candidateId, initialPrefill }: Props) {
  const router = useRouter()
  const [companyName, setCompanyName] = useState(initialPrefill?.companyName || "")
  const [companyWebsite, setCompanyWebsite] = useState(initialPrefill?.companyWebsite || "")
  const [jobTitle, setJobTitle] = useState(initialPrefill?.jobTitle || "")
  const [jobDescription, setJobDescription] = useState(initialPrefill?.jobDescription || "")
  const [dossierInfluence, setDossierInfluence] = useState("medium")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

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
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : careerActionErrorMessage("start the target company workflow"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-black bg-neutral-950 p-6 text-white shadow-sm">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">One-click workflow</div>
        <h2 className="mt-2 text-2xl font-semibold">Target company workflow</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-300">
          Enter the company and role once, then the Career Intelligence engine will generate the company dossier, a company-matched cover letter, and company-specific interview prep in one run.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Company name</label>
          <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-white" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Company website</label>
          <input
            value={companyWebsite}
            onChange={(event) => setCompanyWebsite(event.target.value)}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
            placeholder="Optional"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Target role</label>
        <input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-white" />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Company tone influence on cover letter</label>
        <div className="grid gap-2 md:grid-cols-3">
          {[
            { value: "low", label: "Low", description: "Keep mostly the candidate's natural voice." },
            { value: "medium", label: "Medium", description: "Balance the candidate voice with the company tone." },
            { value: "strong", label: "Strong", description: "Lean hard into the company's public language and style." },
          ].map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-2xl border px-4 py-3 text-sm ${
                dossierInfluence === option.value ? "border-white bg-white text-black" : "border-neutral-700 bg-neutral-900 text-neutral-200"
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
              <p className="mt-1 leading-6">{option.description}</p>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Job description</label>
        <textarea
          value={jobDescription}
          onChange={(event) => setJobDescription(event.target.value)}
          className="min-h-[220px] w-full rounded-2xl border border-neutral-700 bg-neutral-900 px-3 py-3 text-sm leading-6 text-white"
          placeholder="Paste the full role description here..."
        />
      </div>

      <button
        type="submit"
        disabled={loading || !companyName.trim() || !jobDescription.trim()}
        className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Running target company workflow..." : "Run target company workflow"}
      </button>

      {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} /> : null}
    </form>
  )
}
