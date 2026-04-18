"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { CareerStatusBanner } from "@/components/career/CareerStatusBanner"
import { CAREER_WORKSPACE_NAVIGATE_EVENT, careerActionErrorMessage, careerBackgroundStartedMessage, getCareerMessageTone, startCareerBackgroundJob } from "@/lib/career-client"

type ApplicationOption = {
  id: string
  company_name: string | null
  job_title: string | null
  location: string | null
  notes: string | null
}

type Props = {
  candidateId: string
  applications: ApplicationOption[]
  suggestedTargetRole: string
  initialPrefill?: {
    jobTitle?: string
    companyName?: string
    location?: string
    notes?: string
  }
}

export function CareerRecruiterMatchSearch({ candidateId, applications, suggestedTargetRole, initialPrefill }: Props) {
  const router = useRouter()
  const [selectedApplicationId, setSelectedApplicationId] = useState("")
  const [jobTitle, setJobTitle] = useState(initialPrefill?.jobTitle || suggestedTargetRole)
  const [companyName, setCompanyName] = useState(initialPrefill?.companyName || "")
  const [location, setLocation] = useState(initialPrefill?.location || "")
  const [specialty, setSpecialty] = useState("")
  const [notes, setNotes] = useState(initialPrefill?.notes || "")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const canGenerate = Boolean(jobTitle.trim())

  const selectedApplication = useMemo(
    () => applications.find((application) => application.id === selectedApplicationId) ?? null,
    [applications, selectedApplicationId]
  )

  useEffect(() => {
    if (!selectedApplication) return
    setCompanyName(selectedApplication.company_name || "")
    setJobTitle(selectedApplication.job_title || "")
    setLocation(selectedApplication.location || "")
    setNotes(selectedApplication.notes || "")
  }, [selectedApplication])

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
      if (prefill.roleFamily) {
        setJobTitle(prefill.roleFamily)
      }
      if (prefill.notes) {
        setNotes((current) => (current ? `${prefill.notes}\n\n${current}` : prefill.notes || ""))
      }

      if (prefill.companyName || prefill.roleFamily) {
        setMessage(
          `Prefilled recruiter search${prefill.roleFamily ? ` for ${prefill.roleFamily}` : ""}${
            prefill.companyName ? ` around ${prefill.companyName}` : ""
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
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage("")

    try {
      await startCareerBackgroundJob(candidateId, "generate_recruiter_match_search", {
        application_id: selectedApplicationId || null,
        job_title: jobTitle,
        company_name: companyName,
        location,
        specialty,
        notes,
        target_countries: ["NZ"],
      })
      setMessage(
        careerBackgroundStartedMessage({
          label: "Recruiter match search",
          destination: "the recruiter routes section",
        })
      )
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : careerActionErrorMessage("start the recruiter match search"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[2rem] border border-[#c7d2fe] bg-[linear-gradient(135deg,#eef2ff_0%,#f8fafc_55%,#ffffff_100%)] p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4338ca]">Career Intelligence access</div>
          <h2 className="mt-2 text-2xl font-semibold text-[#0f172a]">Recruiter match search</h2>
          <p className="mt-3 text-sm leading-6 text-[#475569]">
            Search for recruiter channels, search firms, and talent-market routes relevant to the candidate&apos;s role, location, and target company strategy.
          </p>
        </div>
        <div className="rounded-2xl border border-[#dbeafe] bg-white px-4 py-3 text-sm text-[#334155]">
          Best for market access beyond standard applications
        </div>
      </div>

      <div className="mt-5">
        <label className="mb-1 block text-sm font-medium">Tracked application</label>
        <select value={selectedApplicationId} onChange={(event) => setSelectedApplicationId(event.target.value)} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2">
          <option value="">Use a custom recruiter search brief</option>
          {applications.map((application) => (
            <option key={application.id} value={application.id}>
              {(application.company_name || "Untitled company") + " - " + (application.job_title || "Untitled role")}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Target role</label>
          <input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Location</label>
          <input value={location} onChange={(event) => setLocation(event.target.value)} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2" />
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Target company</label>
          <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2" placeholder="Optional" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Recruiter specialty</label>
          <input value={specialty} onChange={(event) => setSpecialty(event.target.value)} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2" placeholder="Optional: executive search, product, transformation..." />
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
        <div className="mb-2 text-sm font-medium">Recruiter market</div>
        <p className="mb-3 text-xs text-neutral-600">
          Recruiter mapping is currently focused on New Zealand. International recruiter targeting is coming soon.
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-[#0a66c2] bg-[#e8f3ff] px-3 py-1 text-xs font-semibold text-[#0a66c2]">
            ✓ New Zealand
          </span>
          <span className="cursor-not-allowed rounded-full border border-neutral-200 bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-500">
            International (Coming soon)
          </span>
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-sm font-medium">Notes</label>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="min-h-[140px] w-full rounded-2xl border border-neutral-300 bg-white px-3 py-3 text-sm leading-6"
          placeholder="Optional: recruiter angle, target market, sectors, company list, warm-contact context, or what kind of recruiter access would help most..."
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl text-sm leading-6 text-[#475569]">
          This creates a saved recruiter-market report with search-firm angles, recruiter positioning guidance, and next-step recommendations.
        </p>
        <button
          type="submit"
          disabled={loading || !canGenerate}
          title="Generate recruiter match routes and save them to this workspace."
          className="rounded-xl bg-[#0f172a] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Starting recruiter search..." : "Generate recruiter match search"}
        </button>
      </div>
      <div
        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
          canGenerate ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-neutral-200 bg-neutral-50 text-neutral-500"
        }`}
      >
        {canGenerate ? "Ready to generate" : "Add target role to enable"}
      </div>

      {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} className="mt-4" /> : null}
    </form>
  )
}
