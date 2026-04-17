"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { CareerStatusBanner } from "@/components/career/CareerStatusBanner"
import { careerActionErrorMessage, getAuthHeaders, getCareerMessageTone, notifyCareerWorkspaceRefresh } from "@/lib/career-client"

type Props = {
  documentId: string
  initialSourceType: string
  initialTitle: string
  initialContent: string
}

const sourceTypeOptions = [
  {
    value: "cv",
    label: "CV",
    priority: "Start here",
    guidance: "Use this for the main CV or resume. It should hold the factual career baseline the rest of the workspace can trust.",
  },
  {
    value: "gallup_strengths",
    label: "Gallup Strengths report",
    priority: "Essential",
    guidance: "Use this for the Gallup Strengths report. It is the strongest source for tone, strengths language, and differentiation.",
  },
  {
    value: "linkedin",
    label: "LinkedIn",
    priority: "Recommended",
    guidance: "Use this for LinkedIn headline, About text, and public-facing profile language.",
  },
  {
    value: "strengths",
    label: "Strengths",
    priority: "Flexible",
    guidance: "Use this for non-Gallup strengths content, personal strengths notes, or other personality-based input.",
  },
  {
    value: "cover_letter",
    label: "Old cover letter",
    priority: "Recommended",
    guidance: "Use this for past cover letters or examples of how the candidate already writes about themselves.",
  },
  {
    value: "achievements",
    label: "Achievements",
    priority: "Helpful",
    guidance: "Use this for quantified wins, milestones, awards, and proof the workspace can reuse in tailored outputs.",
  },
  {
    value: "recruiter_feedback",
    label: "Recruiter feedback",
    priority: "Helpful",
    guidance: "Use this for recruiter comments, objections, or market feedback that should shape positioning and interview prep.",
  },
  {
    value: "notes",
    label: "Notes",
    priority: "Flexible",
    guidance: "Use this for general supporting context that does not clearly fit another type.",
  },
  {
    value: "background",
    label: "Background",
    priority: "Flexible",
    guidance: "Use this for broader personal or career background that adds context but is not a formal asset.",
  },
  {
    value: "job-target",
    label: "Target role brief",
    priority: "Helpful",
    guidance: "Use this for target role descriptions, target-company thinking, or search-direction context.",
  },
  {
    value: "interview_notes",
    label: "Interview notes",
    priority: "Later stage",
    guidance: "Use this for interview-specific notes, panel context, or prompts tied to an upcoming interview.",
  },
  {
    value: "interview_reflection",
    label: "Interview reflection",
    priority: "Later stage",
    guidance: "Use this after a real interview to capture what happened and what should improve next time.",
  },
] as const

export function CareerSourceDocumentEditor({ documentId, initialSourceType, initialTitle, initialContent }: Props) {
  const router = useRouter()
  const [sourceType, setSourceType] = useState(initialSourceType || "notes")
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(initialContent)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const selectedSourceType = sourceTypeOptions.find((option) => option.value === sourceType) ?? sourceTypeOptions[sourceTypeOptions.length - 1]

  async function handleSave() {
    setLoading(true)
    setMessage("")

    try {
      const response = await fetch(`/api/career/documents/${documentId}`, {
        method: "PATCH",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          source_type: sourceType,
          title,
          content_text: content,
        }),
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to update source material")
      }

      setMessage("Source material updated.")
      notifyCareerWorkspaceRefresh()
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : careerActionErrorMessage("update the source material"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 p-4">
      <div className="mb-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Source guidance</div>
            <div className="mt-2 text-sm font-semibold text-neutral-900">{selectedSourceType.label}</div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">{selectedSourceType.guidance}</p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Priority</div>
            <div className="mt-1 text-sm font-semibold text-neutral-900">{selectedSourceType.priority}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[0.8fr_1.2fr]">
        <select value={sourceType} onChange={(event) => setSourceType(event.target.value)} className="rounded-xl border border-neutral-300 px-3 py-2 text-sm">
          {sourceTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} - {option.priority}
            </option>
          ))}
        </select>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Document title"
          className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-semibold"
        />
      </div>

      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        className="mt-3 min-h-[220px] w-full rounded-2xl border border-neutral-300 px-3 py-3 text-sm leading-6"
        placeholder={`Review or refine the saved ${selectedSourceType.label.toLowerCase()} content here...`}
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={handleSave}
          disabled={loading || !content.trim()}
          type="button"
          className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save source changes"}
        </button>
        {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} /> : null}
      </div>
    </div>
  )
}
