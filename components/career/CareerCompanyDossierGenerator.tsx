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
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Company research</div>
        <h2 className="text-lg font-semibold">Generate company dossier</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Research a target company&apos;s culture, messaging, tone of voice, hiring story, and public language patterns so applications can be tailored more precisely.
        </p>
        <p className="mt-1 text-xs text-neutral-500">Job description is optional. You can run dossier-only research with just the company name.</p>
      </div>

      <details className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700">When to use this</summary>
        <div className="mt-2 space-y-2 text-sm leading-6 text-neutral-700">
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

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">Company name</label>
          <input
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2"
            placeholder="e.g. Microsoft"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">Company website</label>
          <input
            value={companyWebsite}
            onChange={(event) => setCompanyWebsite(event.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2"
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">Target role</label>
          <input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} className="w-full rounded-xl border border-neutral-300 px-3 py-2" />
        </div>
        <div className="text-xs text-neutral-500 md:self-end">
          Optional. Add the role and job description when you have them so the dossier can emphasize the most relevant company signals.
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">Job description</label>
        <textarea
          value={jobDescription}
          onChange={(event) => setJobDescription(event.target.value)}
          className="min-h-[120px] w-full rounded-2xl border border-neutral-300 px-3 py-2.5 text-sm leading-6"
          placeholder="Optional: paste the role description here..."
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={loading || !canGenerate}
          title="Research and save a reusable company dossier in this workspace."
          className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Researching company..." : "Generate company dossier"}
        </button>
        <div
          className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
            canGenerate ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-neutral-200 bg-neutral-50 text-neutral-500"
          }`}
        >
          {canGenerate ? "Ready to generate" : "Add company name"}
        </div>
      </div>

      {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} /> : null}
      <p className="text-xs text-neutral-500">Once saved, use the dossier inside cover letters to match employer language and tone.</p>
    </form>
  )
}
