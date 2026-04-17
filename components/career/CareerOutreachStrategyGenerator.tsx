"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, type FormEvent } from "react"
import { CareerStatusBanner } from "@/components/career/CareerStatusBanner"
import { CAREER_WORKSPACE_NAVIGATE_EVENT, careerActionErrorMessage, careerBackgroundStartedMessage, getCareerMessageTone, startCareerBackgroundJob } from "@/lib/career-client"

type Props = {
  candidateId: string
  initialPrefill?: {
    companyName?: string
    location?: string
    jobTitle?: string
    notes?: string
  }
}

export function CareerOutreachStrategyGenerator({ candidateId, initialPrefill }: Props) {
  const router = useRouter()
  const [companyName, setCompanyName] = useState(initialPrefill?.companyName || "")
  const [location, setLocation] = useState(initialPrefill?.location || "")
  const [jobTitle, setJobTitle] = useState(initialPrefill?.jobTitle || "")
  const [contactObjective, setContactObjective] = useState("")
  const [notes, setNotes] = useState(initialPrefill?.notes || "")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const canGenerate = Boolean(companyName.trim())

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

      if (prefill.companyName) {
        setMessage(
          `Prefilled outreach strategy for ${prefill.companyName}${
            prefill.roleFamily ? ` around ${prefill.roleFamily}` : ""
          }.`
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
      await startCareerBackgroundJob(candidateId, "generate_outreach_strategy", {
        company_name: companyName,
        location,
        job_title: jobTitle,
        contact_objective: contactObjective,
        notes,
      })
      setMessage(
        careerBackgroundStartedMessage({
          label: "Outreach strategy",
          destination: "the outreach strategy section",
        })
      )
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : careerActionErrorMessage("start the outreach strategy"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-[#bfdbfe] bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_48%,#ffffff_100%)] p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1d4ed8]">Career Intelligence outreach</div>
          <h2 className="mt-2 text-2xl font-semibold text-[#0f172a]">Generate outreach strategy</h2>
          <p className="mt-2 text-sm leading-6 text-[#475569]">
            Create a practical company-targeting plan with likely contact paths, warm introduction angles, message themes, and a ready-to-send first outreach note.
          </p>
        </div>
        <div className="rounded-2xl border border-[#cbd5e1] bg-white px-4 py-3 text-sm text-[#334155]">
          Best after: dossier or prospect research
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Company name</label>
          <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Location</label>
          <input value={location} onChange={(event) => setLocation(event.target.value)} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2" placeholder="Optional" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Target role or role family</label>
          <input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2" placeholder="Optional but helpful" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Contact objective</label>
          <input
            value={contactObjective}
            onChange={(event) => setContactObjective(event.target.value)}
            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2"
            placeholder="Example: warm intro, exploratory conversation, unadvertised role"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Context or notes</label>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="min-h-[160px] w-full rounded-2xl border border-neutral-300 bg-white px-3 py-3 text-sm leading-6"
          placeholder="Optional: why this company matters, signals from prospect research, people to approach, timing, mutual contacts, or campaign notes..."
        />
      </div>

      <button
        type="submit"
        disabled={loading || !canGenerate}
        title="Generate an outreach strategy and save it to this workspace."
        className="rounded-xl bg-[#0f172a] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Starting outreach strategy..." : "Generate outreach strategy"}
      </button>
      <div
        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
          canGenerate ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-neutral-200 bg-neutral-50 text-neutral-500"
        }`}
      >
        {canGenerate ? "Ready to generate" : "Add company name to enable"}
      </div>

      {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} /> : null}
    </form>
  )
}
