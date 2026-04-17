"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { CareerStatusBanner } from "@/components/career/CareerStatusBanner"
import { careerActionErrorMessage, careerBackgroundStartedMessage, getCareerMessageTone, startCareerBackgroundJob } from "@/lib/career-client"

type ApplicationOption = {
  id: string
  company_name: string | null
  job_title: string | null
  location: string | null
  job_url: string | null
  notes: string | null
}

type Props = {
  candidateId: string
  applications: ApplicationOption[]
  initialPrefill?: {
    jobTitle?: string
    companyName?: string
    location?: string
    jobUrl?: string
    jobDescription?: string
    notes?: string
  }
}

export function CareerSalaryAnalyzer({ candidateId, applications, initialPrefill }: Props) {
  const router = useRouter()
  const [selectedApplicationId, setSelectedApplicationId] = useState("")
  const [jobTitle, setJobTitle] = useState(initialPrefill?.jobTitle || "")
  const [companyName, setCompanyName] = useState(initialPrefill?.companyName || "")
  const [location, setLocation] = useState(initialPrefill?.location || "")
  const [jobUrl, setJobUrl] = useState(initialPrefill?.jobUrl || "")
  const [jobDescription, setJobDescription] = useState(initialPrefill?.jobDescription || "")
  const [notes, setNotes] = useState(initialPrefill?.notes || "")
  const [focus, setFocus] = useState("")
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
    setJobUrl(selectedApplication.job_url || "")
    setNotes(selectedApplication.notes || "")
  }, [selectedApplication])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage("")

    try {
      await startCareerBackgroundJob(candidateId, "generate_salary_analysis", {
        application_id: selectedApplicationId || null,
        company_name: companyName,
        job_title: jobTitle,
        location,
        job_url: jobUrl,
        job_description: jobDescription,
        notes,
        focus,
      })
      setMessage(
        careerBackgroundStartedMessage({
          label: "Salary analysis",
          destination: "the salary analysis section",
        })
      )
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : careerActionErrorMessage("start the salary analysis"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold">Analyze role salary</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Research likely salary range, total compensation, and negotiation angles for a live target role or application.
        </p>
        <p className="mt-2 text-sm text-neutral-500">Pick a tracked application to prefill the form, or enter a role manually.</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Tracked application</label>
        <select value={selectedApplicationId} onChange={(event) => setSelectedApplicationId(event.target.value)} className="w-full rounded-xl border border-neutral-300 px-3 py-2">
          <option value="">Use a custom role instead</option>
          {applications.map((application) => (
            <option key={application.id} value={application.id}>
              {(application.company_name || "Untitled company") + " - " + (application.job_title || "Untitled role")}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Job title</label>
          <input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} className="w-full rounded-xl border border-neutral-300 px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Company</label>
          <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} className="w-full rounded-xl border border-neutral-300 px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Location</label>
          <input value={location} onChange={(event) => setLocation(event.target.value)} className="w-full rounded-xl border border-neutral-300 px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Focus</label>
          <input
            value={focus}
            onChange={(event) => setFocus(event.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2"
            placeholder="Optional: base salary, total comp, negotiation, relocation..."
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Job URL</label>
        <input value={jobUrl} onChange={(event) => setJobUrl(event.target.value)} className="w-full rounded-xl border border-neutral-300 px-3 py-2" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Job description</label>
        <textarea
          value={jobDescription}
          onChange={(event) => setJobDescription(event.target.value)}
          className="min-h-[180px] w-full rounded-2xl border border-neutral-300 px-3 py-3 text-sm leading-6"
          placeholder="Optional but helpful: paste the role description here..."
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Extra notes</label>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="min-h-[120px] w-full rounded-2xl border border-neutral-300 px-3 py-3 text-sm leading-6"
          placeholder="Optional: recruiter comments, level hints, bonus clues, or compensation questions..."
        />
      </div>

      <button
        type="submit"
        disabled={loading || !canGenerate}
        title="Generate salary analysis and save it to this workspace."
        className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Starting salary research..." : "Generate salary analysis"}
      </button>
      <div
        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
          canGenerate ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-neutral-200 bg-neutral-50 text-neutral-500"
        }`}
      >
        {canGenerate ? "Ready to generate" : "Add job title to enable"}
      </div>

      {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} /> : null}
    </form>
  )
}
