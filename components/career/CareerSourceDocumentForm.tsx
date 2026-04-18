"use client"

import { useRouter } from "next/navigation"
import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react"
import { CareerStatusBanner } from "@/components/career/CareerStatusBanner"
import { careerActionErrorMessage, getAuthHeaders, getCareerMessageTone, notifyCareerWorkspaceRefresh, toCareerUserMessage } from "@/lib/career-client"
import { validateCareerUploadFile } from "@/lib/career-upload-client"

type Props = {
  candidateId: string
  existingDocuments?: Array<{
    source_type: string | null
  }>
}

const sourceTypeOptions = [
  {
    value: "cv",
    label: "CV",
    priority: "Start here",
    guidance: "Upload the latest CV or resume. This gives the workspace the factual baseline of roles, achievements, and career history.",
    suggestedTitle: "Current CV",
  },
  {
    value: "gallup_strengths",
    label: "Gallup Strengths report",
    priority: "Essential",
    guidance: "Upload the Gallup Strengths report if available. This is the strongest input for tone, strengths language, and higher-quality positioning.",
    suggestedTitle: "Gallup Strengths Report",
  },
  {
    value: "linkedin",
    label: "LinkedIn profile",
    priority: "Recommended",
    guidance: "Paste or upload the candidate's LinkedIn About, headline, and profile text so the workspace can mirror public-facing language.",
    suggestedTitle: "LinkedIn Profile Text",
  },
  {
    value: "cover_letter",
    label: "Old cover letter",
    priority: "Recommended",
    guidance: "Upload past letters to show voice, structure, and evidence the candidate already uses.",
    suggestedTitle: "Previous Cover Letter",
  },
  {
    value: "achievements",
    label: "Achievements",
    priority: "Helpful",
    guidance: "Use this for quantified wins, case studies, awards, promotions, and evidence the system can reuse in tailored assets.",
    suggestedTitle: "Key Achievements",
  },
  {
    value: "recruiter_feedback",
    label: "Recruiter feedback",
    priority: "Helpful",
    guidance: "Add recruiter notes, objections, or market feedback so the workspace can adapt positioning and interview prep more intelligently.",
    suggestedTitle: "Recruiter Feedback",
  },
  {
    value: "job-target",
    label: "Target role brief",
    priority: "Helpful",
    guidance: "Use this for target-role descriptions, preferred industries, or search direction so the workspace knows where to aim.",
    suggestedTitle: "Target Role Brief",
  },
  {
    value: "notes",
    label: "Notes",
    priority: "Flexible",
    guidance: "Add any extra context that does not fit elsewhere, such as motivation, constraints, or personal working preferences.",
    suggestedTitle: "Career Notes",
  },
  {
    value: "background",
    label: "Background",
    priority: "Flexible",
    guidance: "Use this for background context such as career change stories, industry history, or personal context that matters.",
    suggestedTitle: "Career Background",
  },
  {
    value: "strengths",
    label: "Strengths",
    priority: "Flexible",
    guidance: "Use this for non-Gallup strengths material, personality summaries, or self-written strengths notes.",
    suggestedTitle: "Strengths Notes",
  },
  {
    value: "interview_notes",
    label: "Interview notes",
    priority: "Later stage",
    guidance: "Upload interview prep notes, panel context, or observed interview themes for upcoming conversations.",
    suggestedTitle: "Interview Notes",
  },
  {
    value: "interview_reflection",
    label: "Interview reflection",
    priority: "Later stage",
    guidance: "Use this after a real interview to capture what happened, what landed well, and what should improve next time.",
    suggestedTitle: "Interview Reflection",
  },
] as const

type SourceTypeValue = (typeof sourceTypeOptions)[number]["value"]

const setupWizardSteps: SourceTypeValue[] = ["cv", "gallup_strengths", "linkedin", "cover_letter", "achievements", "recruiter_feedback", "job-target"]
const UPLOAD_REQUEST_TIMEOUT_MS = 90_000

export function CareerSourceDocumentForm({ candidateId, existingDocuments = [] }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [sourceType, setSourceType] = useState("cv")
  const [title, setTitle] = useState("")
  const [contentText, setContentText] = useState("")
  const [selectedFileName, setSelectedFileName] = useState("")
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [wizardMode, setWizardMode] = useState(true)
  const [wizardStepIndex, setWizardStepIndex] = useState(0)
  const [wizardCompletedTypes, setWizardCompletedTypes] = useState<Set<SourceTypeValue>>(() => {
    const completed = new Set<SourceTypeValue>()
    for (const doc of existingDocuments) {
      if (doc.source_type && setupWizardSteps.includes(doc.source_type as SourceTypeValue)) {
        completed.add(doc.source_type as SourceTypeValue)
      }
    }
    return completed
  })
  const selectedSourceType = sourceTypeOptions.find((option) => option.value === sourceType) ?? sourceTypeOptions[0]
  const wizardCompletionCount = wizardCompletedTypes.size
  const wizardProgressLabel = `${wizardCompletionCount}/${setupWizardSteps.length}`
  const currentWizardType = setupWizardSteps[Math.min(wizardStepIndex, setupWizardSteps.length - 1)]
  const currentWizardOption = sourceTypeOptions.find((option) => option.value === currentWizardType) ?? sourceTypeOptions[0]

  const nextWizardIndex = useMemo(() => {
    const nextUnfinished = setupWizardSteps.findIndex((step) => !wizardCompletedTypes.has(step))
    return nextUnfinished >= 0 ? nextUnfinished : setupWizardSteps.length - 1
  }, [wizardCompletedTypes])

  function moveWizardToNextUnfinished() {
    setWizardStepIndex(nextWizardIndex)
    setSourceType(setupWizardSteps[nextWizardIndex] || "cv")
  }

  function handleSourceTypeChange(nextValue: string) {
    setSourceType(nextValue)
    setPendingFile(null)
    setSelectedFileName("")
    const nextOption = sourceTypeOptions.find((option) => option.value === nextValue)
    if (!nextOption) return

    setTitle((current) => (current.trim() ? current : nextOption.suggestedTitle))
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const validationError = validateCareerUploadFile(file)
    if (validationError) {
      setPendingFile(null)
      setSelectedFileName("")
      setMessage(validationError)
      if (event.target) {
        event.target.value = ""
      }
      return
    }

    setPendingFile(file)
    setSelectedFileName(file.name)
    setMessage("File ready to upload. Click 'Upload selected file' to continue.")
    if (event.target) {
      event.target.value = ""
    }
  }

  async function handleUploadSelectedFile() {
    if (fileLoading) return
    if (!pendingFile) {
      setMessage("Choose a file first.")
      return
    }

    setFileLoading(true)
    setMessage("")
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), UPLOAD_REQUEST_TIMEOUT_MS)

    try {
      const formData = new FormData()
      formData.append("file", pendingFile)
      formData.append("candidate_id", candidateId)
      formData.append("source_type", sourceType)
      if (title.trim()) {
        formData.append("title", title.trim())
      }

      const headers = await getAuthHeaders()
      delete headers["Content-Type"]

      const response = await fetch("/api/career/upload-source-file", {
        method: "POST",
        headers,
        body: formData,
        signal: controller.signal,
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to upload file")
      }

      setSelectedFileName(json.file_name || pendingFile.name)
      setPendingFile(null)
      setTitle("")
      setContentText("")
      if (setupWizardSteps.includes(sourceType as SourceTypeValue)) {
        setWizardCompletedTypes((current) => new Set(current).add(sourceType as SourceTypeValue))
      }
      setMessage(`Uploaded and saved ${json.file_name || pendingFile.name} into the workspace.`)
      notifyCareerWorkspaceRefresh()
      router.refresh()
      if (wizardMode) {
        moveWizardToNextUnfinished()
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setMessage("Upload timed out. Please try a smaller file or retry in a moment.")
        return
      }
      setMessage(toCareerUserMessage(error instanceof Error ? error.message : null, careerActionErrorMessage("upload the file")))
    } finally {
      window.clearTimeout(timeout)
      setFileLoading(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage("")

    try {
      const response = await fetch("/api/career/documents", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          candidate_id: candidateId,
          source_type: sourceType,
          title,
          content_text: contentText,
        }),
      })

      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || "Failed to save source material")
      }

      setTitle("")
      setContentText("")
      setSelectedFileName("")
      if (setupWizardSteps.includes(sourceType as SourceTypeValue)) {
        setWizardCompletedTypes((current) => new Set(current).add(sourceType as SourceTypeValue))
      }
      setMessage("Source material saved.")
      notifyCareerWorkspaceRefresh()
      router.refresh()
      if (wizardMode) {
        moveWizardToNextUnfinished()
      }
    } catch (error) {
      setMessage(toCareerUserMessage(error instanceof Error ? error.message : null, careerActionErrorMessage("save the source material")))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">Load content</h2>
        <p className="mt-1 text-sm text-neutral-600">Use guided setup for step-by-step onboarding, or switch to manual mode.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-600">
          Guided setup {wizardMode ? "on" : "off"} | Progress {wizardProgressLabel}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setWizardMode(true)
              moveWizardToNextUnfinished()
            }}
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${
              wizardMode ? "border-sky-300 bg-sky-50 text-sky-900" : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            Guided
          </button>
          <button
            type="button"
            onClick={() => setWizardMode(false)}
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${
              !wizardMode ? "border-sky-300 bg-sky-50 text-sky-900" : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            Manual
          </button>
        </div>
      </div>

      {wizardMode ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Current setup step</div>
              <div className="mt-1 text-base font-semibold text-sky-950">{currentWizardOption.label}</div>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-sky-900">{currentWizardOption.guidance}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const prev = Math.max(0, wizardStepIndex - 1)
                  setWizardStepIndex(prev)
                  setSourceType(setupWizardSteps[prev])
                }}
                disabled={wizardStepIndex === 0}
                className="rounded-full border border-sky-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-sky-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = Math.min(setupWizardSteps.length - 1, wizardStepIndex + 1)
                  setWizardStepIndex(next)
                  setSourceType(setupWizardSteps[next])
                }}
                disabled={wizardStepIndex >= setupWizardSteps.length - 1}
                className="rounded-full border border-sky-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-sky-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Skip
              </button>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-sky-900">
            Tip: after each save/upload, the wizard will move to the next missing setup item automatically.
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          Start with: CV -&gt; Gallup Strengths -&gt; LinkedIn -&gt; supporting proof.
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Selected content type</div>
            <div className="mt-1 text-base font-semibold text-neutral-900">{selectedSourceType.label}</div>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-600">{selectedSourceType.guidance}</p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white px-3 py-2">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Priority</div>
            <div className="mt-1 text-sm font-semibold text-neutral-900">{selectedSourceType.priority}</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-3">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Choose content type</div>
        <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {sourceTypeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSourceTypeChange(option.value)}
              className={`rounded-xl border px-3 py-2 text-left transition ${
                sourceType === option.value
                  ? "border-sky-300 bg-sky-50 shadow-sm"
                  : "border-neutral-200 bg-neutral-50 hover:border-neutral-300 hover:bg-white"
              }`}
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">{option.priority}</div>
              <div className="mt-1 text-sm font-semibold text-neutral-900">
                {option.label}
                {wizardCompletedTypes.has(option.value) ? (
                  <span className="ml-1 inline-block rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-800">
                    Done
                  </span>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Title</label>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-xl border border-neutral-300 px-3 py-2"
          placeholder={selectedSourceType.suggestedTitle}
        />
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <label className="block text-sm font-medium">Import file</label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={fileLoading}
              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {fileLoading ? "Importing file..." : "Choose file from computer"}
            </button>
            <button
              type="button"
              onClick={() => void handleUploadSelectedFile()}
              disabled={fileLoading || !pendingFile}
              className="rounded-xl border border-[#0a66c2] bg-[#0a66c2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0958a8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {fileLoading ? "Uploading..." : "Upload selected file"}
            </button>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.rtf,.docx,.pdf"
          onChange={handleFileChange}
          className="hidden"
        />
        <p className="text-xs text-neutral-500">Supported: `.txt`, `.md`, `.rtf`, `.docx`, `.pdf` (up to 10MB).</p>
        {selectedFileName ? (
          <p className="mt-2 text-xs text-neutral-700">
            Last uploaded file: <span className="font-medium">{selectedFileName}</span>
          </p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Content</label>
        <textarea
          value={contentText}
          onChange={(event) => setContentText(event.target.value)}
          className="min-h-[220px] w-full rounded-xl border border-neutral-300 px-3 py-2"
          placeholder={`Paste ${selectedSourceType.label.toLowerCase()} content here, or import a file above...`}
        />
      </div>

      <button
        type="submit"
        disabled={loading || fileLoading || !contentText.trim()}
        className="rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Saving..." : "Save source material"}
      </button>

      {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} /> : null}
      <p className="text-xs text-neutral-500">
        Next step: go to Step 3 and generate the profile.
      </p>
    </form>
  )
}
