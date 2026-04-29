"use client"

import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { CareerStatusBanner } from "@/components/career/CareerStatusBanner"
import { careerActionErrorMessage, careerBackgroundStartedMessage, getCareerMessageTone, navigateCareerWorkspace, startCareerBackgroundJob } from "@/lib/career-client"

type Props = {
  candidateId: string
  companyDossiers: Array<{
    id: string
    title: string | null
    content: string | null
  }>
}

export function CareerCoverLetterGenerator({ candidateId, companyDossiers }: Props) {
  const router = useRouter()
  const [jobTitle, setJobTitle] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [jobDescription, setJobDescription] = useState("")
  const [useCompanyDossier, setUseCompanyDossier] = useState(true)
  const [dossierInfluence, setDossierInfluence] = useState("medium")
  const [strengthVoiceInfluence, setStrengthVoiceInfluence] = useState("medium")
  const [selectedDossierId, setSelectedDossierId] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  function handleDossierSelect(nextValue: string) {
    setSelectedDossierId(nextValue)
    if (!nextValue) return

    const selected = companyDossiers.find((dossier) => dossier.id === nextValue)
    if (!selected) return

    const cleanedTitle = (selected.title || "").replace(/^company dossier\s*-\s*/i, "").trim()
    if (cleanedTitle) {
      setCompanyName(cleanedTitle)
    }
    setUseCompanyDossier(true)
  }

  const selectedDossier = companyDossiers.find((dossier) => dossier.id === selectedDossierId) ?? null
  const selectedDossierPreview = selectedDossier?.content ? selectedDossier.content.slice(0, 280).trim() : ""
  const canGenerate = Boolean(jobDescription.trim())

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage("")

    try {
      await startCareerBackgroundJob(candidateId, "generate_cover_letter", {
        job_title: jobTitle,
        company_name: companyName,
        job_description: jobDescription,
        use_company_dossier: useCompanyDossier,
        dossier_influence: dossierInfluence,
        strength_voice_influence: strengthVoiceInfluence,
      })
      setMessage(
        careerBackgroundStartedMessage({
          label: "Cover letter generation",
          destination: "the cover letter section of this workspace",
        })
      )
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : careerActionErrorMessage("start cover letter generation"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Step</div>
        <h2 className="text-lg font-semibold">Generate cover letter</h2>
        <p className="mt-1 text-xs text-neutral-600">
          Paste a job description and the Career Intelligence engine will generate a tailored letter using the candidate&apos;s positioning and CV/LinkedIn drafts.
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Saved cover letters appear in My files &gt; Cover letters and Recent files.
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          If you have already generated a company dossier for this employer, you can choose how strongly it should influence the language and tone of the letter.
        </p>
      </div>

      <details className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-neutral-800">More info</summary>
        <div className="mt-2 space-y-1.5 text-xs leading-5 text-neutral-700">
          <p>
            <span className="font-semibold text-neutral-900">Best used after:</span> generate the candidate profile and CV/LinkedIn drafts first.
          </p>
          <p>
            <span className="font-semibold text-neutral-900">Strongest input combo:</span> full job description plus a saved company dossier.
          </p>
          <p>
            <span className="font-semibold text-neutral-900">Where it appears:</span> My files &gt; Cover letters (ready to edit and reuse).
          </p>
        </div>
      </details>

      {companyDossiers.length > 0 ? (
        <div>
          <label className="mb-1 block text-sm font-medium">Choose a saved company dossier</label>
          <select
            value={selectedDossierId}
            onChange={(event) => handleDossierSelect(event.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm"
          >
            <option value="">Select a saved company dossier...</option>
            {companyDossiers.map((dossier) => (
              <option key={dossier.id} value={dossier.id}>
                {dossier.title || "Untitled company dossier"}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-neutral-500">Selecting a dossier fills company and applies dossier tone options.</p>
          {selectedDossier ? (
            <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Selected dossier</div>
                  <div className="mt-1 font-semibold text-neutral-900">{selectedDossier.title || "Untitled company dossier"}</div>
                </div>
                <button
                  type="button"
                  onClick={() => navigateCareerWorkspace("company", "#current-company-dossiers")}
                  className="ui-compact-pill"
                >
                  View dossier library
                </button>
              </div>
              {selectedDossierPreview ? (
                <p className="mt-2 text-xs leading-5 text-neutral-600">
                  {selectedDossierPreview}
                  {selectedDossier.content && selectedDossier.content.length > 280 ? "..." : ""}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Job title</label>
          <input
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm"
            placeholder="e.g. Head of Partnerships"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Company</label>
          <input
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm"
            placeholder="e.g. LinkedIn"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Job description</label>
        <textarea
          value={jobDescription}
          onChange={(event) => setJobDescription(event.target.value)}
          className="min-h-[170px] w-full rounded-xl border border-neutral-300 px-2.5 py-2 text-sm leading-5"
          placeholder="Paste the role description here..."
        />
      </div>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-neutral-900">Use company dossier tone</div>
            <p className="mt-1 text-xs leading-5 text-neutral-600">
              Turn this on when you want the cover letter to mirror the company&apos;s public language, culture signals, and messaging.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={useCompanyDossier}
              onChange={(event) => setUseCompanyDossier(event.target.checked)}
              className="h-4 w-4 rounded border-neutral-300"
            />
            Use dossier
          </label>
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-sm font-medium">Dossier influence strength</label>
          <div className="grid gap-1.5 md:grid-cols-3">
            {[
              {
                value: "low",
                label: "Low",
                description: "Light touch. Keep mostly the candidate's natural language.",
              },
              {
                value: "medium",
                label: "Medium",
                description: "Balanced. Match the company voice without overdoing it.",
              },
              {
                value: "strong",
                label: "Strong",
                description: "Heavy alignment. Push much harder into the company's wording and tone.",
              },
            ].map((option) => (
              <label
                key={option.value}
                className={`cursor-pointer rounded-xl border px-3 py-2 text-xs ${
                  dossierInfluence === option.value && useCompanyDossier
                    ? "border-neutral-900 bg-white text-neutral-900"
                    : "border-neutral-300 bg-neutral-100 text-neutral-700"
                } ${!useCompanyDossier ? "opacity-50" : ""}`}
              >
                <input
                  type="radio"
                  name="dossier-influence"
                  value={option.value}
                  checked={dossierInfluence === option.value}
                  onChange={(event) => setDossierInfluence(event.target.value)}
                  disabled={!useCompanyDossier}
                  className="sr-only"
                />
                <div className="font-semibold">{option.label}</div>
                <p className="mt-0.5 leading-4">{option.description}</p>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
        <div className="text-sm font-medium text-neutral-900">Strength voice influence</div>
        <p className="mt-1 text-xs leading-5 text-neutral-600">
          Controls how strongly Gallup strengths language shapes the letter tone and phrasing.
        </p>
        <div className="mt-2 grid gap-1.5 md:grid-cols-3">
          {[
            {
              value: "low",
              label: "Low",
              description: "Light strengths cues, mostly neutral professional tone.",
            },
            {
              value: "medium",
              label: "Medium",
              description: "Balanced strengths voice with clear professional polish.",
            },
            {
              value: "high",
              label: "High",
              description: "Strong strengths signature while staying credible.",
            },
          ].map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-xl border px-3 py-2 text-xs ${
                strengthVoiceInfluence === option.value
                  ? "border-indigo-700 bg-white text-neutral-900"
                  : "border-indigo-200 bg-indigo-100 text-neutral-700"
              }`}
            >
              <input
                type="radio"
                name="strength-voice-influence-cover-letter"
                value={option.value}
                checked={strengthVoiceInfluence === option.value}
                onChange={(event) => setStrengthVoiceInfluence(event.target.value)}
                className="sr-only"
              />
              <div className="font-semibold">{option.label}</div>
              <p className="mt-0.5 leading-4">{option.description}</p>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-600">Primary action</div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={loading || !canGenerate}
            title="Generate a tailored cover letter and save it to this workspace."
            className="rounded-full border border-[#0a66c2] bg-[#0a66c2] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[#004182]"
          >
            {loading ? "Generating..." : "Generate letter"}
          </button>
          <div
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
              canGenerate ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-neutral-200 bg-neutral-50 text-neutral-500"
            }`}
          >
            {canGenerate ? "Ready" : "Needs job description"}
          </div>
        </div>
      </div>

      {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} /> : null}
    </form>
  )
}
