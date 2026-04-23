"use client"

import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { CareerStatusBanner } from "@/components/career/CareerStatusBanner"
import { careerActionErrorMessage, careerBackgroundStartedMessage, getCareerMessageTone, startCareerBackgroundJob } from "@/lib/career-client"

type StrategyAssetType = "executive_interview_playbook" | "interview_training_pack" | "job_hit_list"

type Props = {
  candidateId: string
  assetType: StrategyAssetType
}

const configByType: Record<
  StrategyAssetType,
  {
    heading: string
    description: string
    buttonLabel: string
    successMessage: string
    showRoleFields: boolean
    showMarketFields: boolean
  }
> = {
  executive_interview_playbook: {
    heading: "Generate executive interview playbook",
    description: "Build a polished prep pack with positioning, story bank, question bank, 90-day plan, follow-up language, and a final interview checklist.",
    buttonLabel: "Generate interview playbook",
    successMessage: "Executive interview playbook saved. Open My files &gt; Strategy docs.",
    showRoleFields: true,
    showMarketFields: false,
  },
  interview_training_pack: {
    heading: "Generate interview training pack",
    description: "Create a practice-ready training pack with story frameworks, core stories, likely questions, drills, and a strategic coaching note.",
    buttonLabel: "Generate training pack",
    successMessage: "Interview training pack saved. Open My files &gt; Strategy docs.",
    showRoleFields: true,
    showMarketFields: false,
  },
  job_hit_list: {
    heading: "Generate job hit list",
    description: "Create a targeted pursuit list with role focus, employer types, outreach angles, and a weekly execution plan.",
    buttonLabel: "Generate job hit list",
    successMessage: "Job hit list saved. Open My files &gt; Strategy docs.",
    showRoleFields: false,
    showMarketFields: true,
  },
}

export function CareerStrategicDocumentGenerator({ candidateId, assetType }: Props) {
  const router = useRouter()
  const [jobTitle, setJobTitle] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [jobDescription, setJobDescription] = useState("")
  const [targetLocation, setTargetLocation] = useState("")
  const [targetCompanies, setTargetCompanies] = useState("")
  const [marketNotes, setMarketNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  const config = configByType[assetType]

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage("")

    try {
      await startCareerBackgroundJob(candidateId, "generate_strategy_document", {
        asset_type: assetType,
        job_title: jobTitle,
        company_name: companyName,
        job_description: jobDescription,
        target_location: targetLocation,
        target_companies: targetCompanies,
        market_notes: marketNotes,
      })
      setMessage(
        careerBackgroundStartedMessage({
          label: config.heading,
          destination: "the application documents area",
        })
      )
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : careerActionErrorMessage(`start ${config.heading.toLowerCase()}`))
    } finally {
      setLoading(false)
    }
  }

  const isSubmitDisabled =
    loading ||
    (config.showRoleFields && !jobDescription.trim()) ||
    (config.showMarketFields && !jobTitle.trim() && !targetCompanies.trim() && !marketNotes.trim())

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold">{config.heading}</h2>
        <p className="mt-2 text-sm text-neutral-600">{config.description}</p>
        <p className="mt-2 text-sm text-neutral-500">Saved documents appear in My files &gt; Strategy docs and Recent files.</p>
      </div>

      {config.showRoleFields ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Job title</label>
              <input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} className="w-full rounded-xl border border-neutral-300 px-3 py-2" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Company</label>
              <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} className="w-full rounded-xl border border-neutral-300 px-3 py-2" />
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
        </>
      ) : null}

      {config.showMarketFields ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Target role</label>
              <input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} className="w-full rounded-xl border border-neutral-300 px-3 py-2" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Target location</label>
              <input value={targetLocation} onChange={(event) => setTargetLocation(event.target.value)} className="w-full rounded-xl border border-neutral-300 px-3 py-2" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Target companies or employer types</label>
            <textarea
              value={targetCompanies}
              onChange={(event) => setTargetCompanies(event.target.value)}
              className="min-h-[120px] w-full rounded-2xl border border-neutral-300 px-3 py-3 text-sm leading-6"
              placeholder="Optional: list companies, industries, or employer types to target..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Market notes or pasted links</label>
            <textarea
              value={marketNotes}
              onChange={(event) => setMarketNotes(event.target.value)}
              className="min-h-[160px] w-full rounded-2xl border border-neutral-300 px-3 py-3 text-sm leading-6"
              placeholder="Optional: paste job links, recruiter names, notes about the market, or outreach ideas..."
            />
          </div>
        </>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitDisabled}
        className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Generating..." : config.buttonLabel}
      </button>

      {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} /> : null}
    </form>
  )
}
