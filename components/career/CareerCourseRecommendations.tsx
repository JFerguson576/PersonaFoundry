"use client"

import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { CareerStatusBanner } from "@/components/career/CareerStatusBanner"
import { careerActionErrorMessage, careerBackgroundStartedMessage, getCareerMessageTone, startCareerBackgroundJob } from "@/lib/career-client"

type Props = {
  candidateId: string
  suggestedTargetRole: string
}

export function CareerCourseRecommendations({ candidateId, suggestedTargetRole }: Props) {
  const router = useRouter()
  const [targetRole, setTargetRole] = useState(suggestedTargetRole)
  const [focusArea, setFocusArea] = useState("")
  const [learningGoal, setLearningGoal] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const canGenerate = Boolean(targetRole.trim())

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage("")

    try {
      await startCareerBackgroundJob(candidateId, "generate_course_recommendations", {
        target_role: targetRole,
        focus_area: focusArea,
        learning_goal: learningGoal,
        notes,
      })
      setMessage(
        careerBackgroundStartedMessage({
          label: "Course search",
          destination: "the course recommendations section",
        })
      )
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : careerActionErrorMessage("start the course search"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold">Search relevant courses</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Find credible courses and certifications that match the candidate&apos;s CV, Gallup strengths, and likely target roles.
        </p>
        <p className="mt-2 text-sm text-neutral-500">This is designed to produce practical, near-term learning options rather than a long generic list.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Target role</label>
          <input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} className="w-full rounded-xl border border-neutral-300 px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Focus area</label>
          <input
            value={focusArea}
            onChange={(event) => setFocusArea(event.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2"
            placeholder="Optional: leadership, strategy, AI, operations, governance..."
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Learning goal</label>
        <input
          value={learningGoal}
          onChange={(event) => setLearningGoal(event.target.value)}
          className="w-full rounded-xl border border-neutral-300 px-3 py-2"
          placeholder="Optional: qualify for bigger roles, sharpen interview story, close a skill gap..."
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Notes</label>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="min-h-[150px] w-full rounded-2xl border border-neutral-300 px-3 py-3 text-sm leading-6"
          placeholder="Optional: budget, time available, provider preferences, local or online, certification preferences..."
        />
      </div>

      <button
        type="submit"
        disabled={loading || !canGenerate}
        title="Generate course recommendations and save them to this workspace."
        className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Searching courses..." : "Generate course recommendations"}
      </button>
      <div
        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
          canGenerate ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-neutral-200 bg-neutral-50 text-neutral-500"
        }`}
      >
        {canGenerate ? "Ready to generate" : "Add target role to enable"}
      </div>

      {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} /> : null}
    </form>
  )
}
