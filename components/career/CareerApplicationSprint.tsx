"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, type FormEvent } from "react"
import { CareerStatusBanner } from "@/components/career/CareerStatusBanner"
import { CAREER_WORKSPACE_NAVIGATE_EVENT, careerActionErrorMessage, careerBackgroundStartedMessage, getCareerMessageTone, startCareerBackgroundJob } from "@/lib/career-client"

type Props = {
  candidateId: string
  initialPrefill?: {
    jobTitle?: string
    companyName?: string
    companyWebsite?: string
    location?: string
    jobUrl?: string
    jobDescription?: string
    notes?: string
  }
}

export function CareerApplicationSprint({ candidateId, initialPrefill }: Props) {
  const router = useRouter()
  const [jobTitle, setJobTitle] = useState(initialPrefill?.jobTitle || "")
  const [companyName, setCompanyName] = useState(initialPrefill?.companyName || "")
  const [companyWebsite, setCompanyWebsite] = useState(initialPrefill?.companyWebsite || "")
  const [location, setLocation] = useState(initialPrefill?.location || "")
  const [jobUrl, setJobUrl] = useState(initialPrefill?.jobUrl || "")
  const [jobDescription, setJobDescription] = useState(initialPrefill?.jobDescription || "")
  const [notes, setNotes] = useState(initialPrefill?.notes || "")
  const [dossierInfluence, setDossierInfluence] = useState("medium")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    function handlePrefill(event: Event) {
      const detail = (event as CustomEvent<{ prefill?: { companyName?: string; location?: string; roleFamily?: string; notes?: string } }>).detail
      const prefill = detail?.prefill
      if (!prefill) return

      if (prefill.companyName) {
        setCompanyName(prefill.companyName)
      }
      if (prefill.location) {
        setLocation(prefill.location)
      }
      if (prefill.roleFamily && !jobTitle) {
        setJobTitle(prefill.roleFamily)
      }
      if (prefill.notes) {
        setNotes((current) => (current ? `${prefill.notes}\n\n${current}` : prefill.notes || ""))
      }

      if (prefill.companyName || prefill.location) {
        setMessage(
          `Prefilled application sprint${prefill.companyName ? ` for ${prefill.companyName}` : ""}${
            prefill.location ? ` in ${prefill.location}` : ""
          }${prefill.roleFamily ? ` around ${prefill.roleFamily}` : ""}.`
        )
      }
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
      await startCareerBackgroundJob(candidateId, "generate_application_sprint", {
        job_title: jobTitle,
        company_name: companyName,
        company_website: companyWebsite,
        location,
        job_url: jobUrl,
        job_description: jobDescription,
        notes,
        dossier_influence: dossierInfluence,
      })
      setMessage(
        careerBackgroundStartedMessage({
          label: "Application sprint",
          destination: "the company, fit, salary, cover letter, and interview sections",
        })
      )
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : careerActionErrorMessage("start the application sprint"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[2rem] border border-[#c7d2fe] bg-[linear-gradient(135deg,#eef2ff_0%,#f8fafc_48%,#ffffff_100%)] p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4f46e5]">One-click sprint</div>
          <h3 className="mt-2 text-2xl font-semibold text-[#0f172a]">Launch a full application sprint</h3>
          <p className="mt-3 text-sm leading-6 text-[#475569]">
            Use one brief to generate the highest-value application assets together: company intelligence, role fit analysis, salary analysis,
            tailored cover letter, and interview prep.
          </p>
        </div>
        <div className="rounded-2xl border border-[#cbd5e1] bg-white px-4 py-3 text-sm text-[#334155]">
          Creates: dossier, fit score, salary view, cover letter, interview pack
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Job title</label>
          <input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Company name</label>
          <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2" />
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Location</label>
          <input value={location} onChange={(event) => setLocation(event.target.value)} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Company website</label>
          <input value={companyWebsite} onChange={(event) => setCompanyWebsite(event.target.value)} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2" placeholder="Optional" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Job URL</label>
          <input value={jobUrl} onChange={(event) => setJobUrl(event.target.value)} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2" placeholder="Optional" />
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-2 block text-sm font-medium">Company language influence on cover letter</label>
        <div className="grid gap-2 md:grid-cols-3">
          {[
            { value: "low", label: "Low", description: "Keep the letter closer to the candidate's natural voice." },
            { value: "medium", label: "Medium", description: "Blend candidate voice with company tone in a balanced way." },
            { value: "strong", label: "Strong", description: "Push much harder into the company's messaging and public language." },
          ].map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-2xl border px-4 py-3 text-sm ${
                dossierInfluence === option.value ? "border-[#312e81] bg-white text-[#0f172a]" : "border-neutral-300 bg-[#f8fafc] text-neutral-700"
              }`}
            >
              <input
                type="radio"
                name="application-sprint-dossier-influence"
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

      <div className="mt-4">
        <label className="mb-1 block text-sm font-medium">Job description</label>
        <textarea
          value={jobDescription}
          onChange={(event) => setJobDescription(event.target.value)}
          className="min-h-[220px] w-full rounded-2xl border border-neutral-300 bg-white px-3 py-3 text-sm leading-6"
          placeholder="Paste the full role description here..."
        />
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-sm font-medium">Extra notes</label>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="min-h-[120px] w-full rounded-2xl border border-neutral-300 bg-white px-3 py-3 text-sm leading-6"
          placeholder="Optional: recruiter comments, compensation notes, urgency, role risks, or anything else to consider..."
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl text-sm leading-6 text-[#475569]">
          This runs in the background, so the user can leave the screen while results are being generated and saved into the workspace.
        </p>
        <button
          type="submit"
          disabled={loading || !jobTitle.trim() || !jobDescription.trim()}
          className="rounded-xl bg-[#0f172a] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Starting application sprint..." : "Start application sprint"}
        </button>
      </div>

      {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} className="mt-4" /> : null}
    </form>
  )
}
