"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, type FormEvent } from "react"
import { CareerStatusBanner } from "@/components/career/CareerStatusBanner"
import { CAREER_WORKSPACE_NAVIGATE_EVENT, careerActionErrorMessage, careerBackgroundStartedMessage, getCareerMessageTone, startCareerBackgroundJob } from "@/lib/career-client"

type Props = {
  candidateId: string
  initialPrefill?: {
    companyName?: string
    companyWebsite?: string
    jobTitle?: string
    jobDescription?: string
  }
}

export function CareerCompanyDossierGenerator({ candidateId, initialPrefill }: Props) {
  const router = useRouter()
  const [companyName, setCompanyName] = useState(initialPrefill?.companyName || "")
  const [companyWebsite, setCompanyWebsite] = useState(initialPrefill?.companyWebsite || "")
  const [jobTitle, setJobTitle] = useState(initialPrefill?.jobTitle || "")
  const [jobDescription, setJobDescription] = useState(initialPrefill?.jobDescription || "")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const canGenerate = Boolean(companyName.trim())

  useEffect(() => {
    function handlePrefill(event: Event) {
      const detail = (event as CustomEvent<{ prefill?: { companyName?: string; location?: string; roleFamily?: string; notes?: string } }>).detail
      const prefill = detail?.prefill
      if (!prefill?.companyName) return
      setCompanyName(prefill.companyName)
      if (prefill.roleFamily && !jobTitle) {
        setJobTitle(prefill.roleFamily)
      }
      if (prefill.notes) {
        setJobDescription((current) => (current ? `${prefill.notes}\n\n${current}` : prefill.notes || ""))
      }
      setMessage(
        `Prefilled company dossier form for ${prefill.companyName}${prefill.roleFamily ? ` around ${prefill.roleFamily}` : ""}.`
      )
    }

    if (typeof window !== "undefined") {
      window.addEventListener(CAREER_WORKSPACE_NAVIGATE_EVENT, handlePrefill)
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(CAREER_WORKSPACE_NAVIGATE_EVENT, handlePrefill)
      }
    }
  }, [jobTitle])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage("")

    try {
      await startCareerBackgroundJob(candidateId, "generate_company_dossier", {
        company_name: companyName,
        company_website: companyWebsite,
        job_title: jobTitle,
        job_description: jobDescription,
      })
      setMessage(
        careerBackgroundStartedMessage({
          label: "Company dossier research",
          destination: "the company research section",
          followUp: "You can then use it to shape cover letter language and tone.",
        })
      )
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : careerActionErrorMessage("start company dossier research"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Step</div>
        <h2 className="text-xl font-semibold">Generate company dossier</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Research a target company&apos;s culture, messaging, tone of voice, hiring story, and public language patterns so applications can be tailored more precisely.
        </p>
        <p className="mt-2 text-sm text-neutral-500">Job description is optional here. Use dossier-only research when you just want insight on the organisation itself.</p>
        <p className="mt-2 text-sm text-neutral-500">If a matching dossier exists, future cover letters can use it to better match the company&apos;s language and tone.</p>
      </div>

      <details className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-neutral-800">More info</summary>
        <div className="mt-3 space-y-2 text-sm leading-6 text-neutral-700">
          <p>
            <span className="font-semibold text-neutral-900">Use this when:</span> you want a deeper read on a company before writing and interview prep.
          </p>
          <p>
            <span className="font-semibold text-neutral-900">What it creates:</span> a reusable company intelligence file with culture and language signals.
          </p>
          <p>
            <span className="font-semibold text-neutral-900">Where it saves:</span> company research area, selectable later inside cover letter flow.
          </p>
        </div>
      </details>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Company name</label>
          <input
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2"
            placeholder="e.g. Microsoft"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Company website</label>
          <input
            value={companyWebsite}
            onChange={(event) => setCompanyWebsite(event.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2"
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Target role</label>
          <input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} className="w-full rounded-xl border border-neutral-300 px-3 py-2" />
        </div>
        <div className="text-sm text-neutral-500 md:self-end">
          Optional. Add the role and job description when you have them so the dossier can emphasize the most relevant company signals.
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Job description</label>
        <textarea
          value={jobDescription}
          onChange={(event) => setJobDescription(event.target.value)}
          className="min-h-[180px] w-full rounded-2xl border border-neutral-300 px-3 py-3 text-sm leading-6"
          placeholder="Optional: paste the role description here..."
        />
      </div>

      <button
        type="submit"
        disabled={loading || !canGenerate}
        title="Research and save a reusable company dossier in this workspace."
        className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Researching company..." : "Generate company dossier"}
      </button>
      <div
        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
          canGenerate ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-neutral-200 bg-neutral-50 text-neutral-500"
        }`}
      >
        {canGenerate ? "Ready to generate" : "Add company name to enable"}
      </div>

      {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} /> : null}
      <p className="text-sm text-neutral-500">Once it is saved, use the dossier in cover letters to match the employer&apos;s language more deliberately.</p>
    </form>
  )
}
