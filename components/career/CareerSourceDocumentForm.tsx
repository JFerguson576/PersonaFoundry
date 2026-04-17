"use client"

import { useRouter } from "next/navigation"
import { useRef, useState, type ChangeEvent, type FormEvent } from "react"
import { CareerStatusBanner } from "@/components/career/CareerStatusBanner"
import { careerActionErrorMessage, getAuthHeaders, getCareerMessageTone, notifyCareerWorkspaceRefresh, toCareerUserMessage } from "@/lib/career-client"

type Props = {
  candidateId: string
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

export function CareerSourceDocumentForm({ candidateId }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [sourceType, setSourceType] = useState("cv")
  const [title, setTitle] = useState("")
  const [contentText, setContentText] = useState("")
  const [selectedFileName, setSelectedFileName] = useState("")
  const [fileLoading, setFileLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const selectedSourceType = sourceTypeOptions.find((option) => option.value === sourceType) ?? sourceTypeOptions[0]

  function handleSourceTypeChange(nextValue: string) {
    setSourceType(nextValue)
    const nextOption = sourceTypeOptions.find((option) => option.value === nextValue)
    if (!nextOption) return

    setTitle((current) => (current.trim() ? current : nextOption.suggestedTitle))
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setFileLoading(true)
    setMessage("")

    try {
      const formData = new FormData()
      formData.append("file", file)
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
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to upload file")
      }

      setSelectedFileName(json.file_name || file.name)
      setTitle("")
      setContentText("")
      setMessage(`Uploaded and saved ${json.file_name || file.name} into the workspace.`)
      notifyCareerWorkspaceRefresh()
      router.refresh()
    } catch (error) {
      setMessage(toCareerUserMessage(error instanceof Error ? error.message : null, careerActionErrorMessage("upload the file")))
    } finally {
      setFileLoading(false)
      if (event.target) {
        event.target.value = ""
      }
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
      setMessage("Source material saved.")
      notifyCareerWorkspaceRefresh()
      router.refresh()
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
        <p className="mt-1 text-sm text-neutral-600">Choose a content type, then upload a file or paste text.</p>
      </div>

      <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
        Start with: CV -&gt; Gallup Strengths -&gt; LinkedIn -&gt; supporting proof.
      </div>

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
              <div className="mt-1 text-sm font-semibold text-neutral-900">{option.label}</div>
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
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={fileLoading}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {fileLoading ? "Importing file..." : "Choose file from computer"}
          </button>
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
