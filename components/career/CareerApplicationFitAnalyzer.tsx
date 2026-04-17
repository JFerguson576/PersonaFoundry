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

export function CareerApplicationFitAnalyzer({ candidateId, applications, initialPrefill }: Props) {
  const router = useRouter()
  const [selectedApplicationId, setSelectedApplicationId] = useState("")
  const [jobTitle, setJobTitle] = useState(initialPrefill?.jobTitle || "")
  const [companyName, setCompanyName] = useState(initialPrefill?.companyName || "")
  const [location, setLocation] = useState(initialPrefill?.location || "")
  const [jobUrl, setJobUrl] = useState(initialPrefill?.jobUrl || "")
  const [jobDescription, setJobDescription] = useState(initialPrefill?.jobDescription || "")
  const [notes, setNotes] = useState(initialPrefill?.notes || "")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

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
      await startCareerBackgroundJob(candidateId, "generate_application_fit_analysis", {
        application_id: selectedApplicationId || null,
        company_name: companyName,
        job_title: jobTitle,
        location,
        job_url: jobUrl,
        job_description: jobDescription,
        notes,
      })
      setMessage(
        careerBackgroundStartedMessage({
          label: "Application fit analysis",
          destination: "the fit analysis section",
        })
      )
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : careerActionErrorMessage("start the fit analysis"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold">Analyze role fit</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Score how strongly the current candidate matches a target role before they apply, interview, or spend time tailoring assets.
        </p>
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
          <label className="mb-1 block text-sm font-medium">Job URL</label>
          <input value={jobUrl} onChange={(event) => setJobUrl(event.target.value)} className="w-full rounded-xl border border-neutral-300 px-3 py-2" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Job description</label>
        <textarea
          value={jobDescription}
          onChange={(event) => setJobDescription(event.target.value)}
          className="min-h-[200px] w-full rounded-2xl border border-neutral-300 px-3 py-3 text-sm leading-6"
          placeholder="Paste the role description here..."
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Notes</label>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="min-h-[120px] w-full rounded-2xl border border-neutral-300 px-3 py-3 text-sm leading-6"
          placeholder="Optional: recruiter comments, what the candidate likes about the role, internal concerns, or application strategy notes..."
        />
      </div>

      <button
        type="submit"
        disabled={loading || !jobTitle.trim() || !jobDescription.trim()}
        className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Starting fit analysis..." : "Generate fit score"}
      </button>

      {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} /> : null}
    </form>
  )
}
