"use client"

import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { CareerStatusBanner } from "@/components/career/CareerStatusBanner"
import { careerActionErrorMessage, getAuthHeaders, getCareerMessageTone, notifyCareerWorkspaceRefresh } from "@/lib/career-client"

type Props = {
  candidateId: string
}

export function CareerInterviewReflectionForm({ candidateId }: Props) {
  const router = useRouter()
  const [jobTitle, setJobTitle] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [confidenceScore, setConfidenceScore] = useState("3")
  const [clarityScore, setClarityScore] = useState("3")
  const [commercialScore, setCommercialScore] = useState("3")
  const [storytellingScore, setStorytellingScore] = useState("3")
  const [executivePresenceScore, setExecutivePresenceScore] = useState("3")
  const [overallAssessment, setOverallAssessment] = useState("")
  const [whatWentWell, setWhatWentWell] = useState("")
  const [whereStruggled, setWhereStruggled] = useState("")
  const [surpriseQuestions, setSurpriseQuestions] = useState("")
  const [nextTimeChanges, setNextTimeChanges] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage("")

    const titleParts = [jobTitle.trim(), companyName.trim()].filter(Boolean)
    const title = titleParts.length > 0 ? `Interview reflection - ${titleParts.join(" @ ")}` : "Interview reflection"
    const contentText = [
      `Scorecard
Confidence: ${confidenceScore}/5
Clarity: ${clarityScore}/5
Commercial sharpness: ${commercialScore}/5
Storytelling: ${storytellingScore}/5
Executive presence: ${executivePresenceScore}/5`,
      `Overall assessment\n${overallAssessment.trim() || "Not provided."}`,
      `What went well\n${whatWentWell.trim() || "Not provided."}`,
      `Where I struggled\n${whereStruggled.trim() || "Not provided."}`,
      `Surprise questions or themes\n${surpriseQuestions.trim() || "Not provided."}`,
      `What to change next time\n${nextTimeChanges.trim() || "Not provided."}`,
    ].join("\n\n")

    try {
      const response = await fetch("/api/career/documents", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          candidate_id: candidateId,
          source_type: "interview_reflection",
          title,
          content_text: contentText,
        }),
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to save interview assessment")
      }

      setJobTitle("")
      setCompanyName("")
      setConfidenceScore("3")
      setClarityScore("3")
      setCommercialScore("3")
      setStorytellingScore("3")
      setExecutivePresenceScore("3")
      setOverallAssessment("")
      setWhatWentWell("")
      setWhereStruggled("")
      setSurpriseQuestions("")
      setNextTimeChanges("")
      setMessage("Interview assessment saved. Future interview prep can now learn from it.")
      notifyCareerWorkspaceRefresh()
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : careerActionErrorMessage("save the interview assessment"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold">Capture interview assessment</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          Record how the interview actually went so the next practice pack can focus on the real weak spots, surprise questions, and better answer angles.
        </p>
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
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Overall assessment</label>
        <textarea
          value={overallAssessment}
          onChange={(event) => setOverallAssessment(event.target.value)}
          className="min-h-[120px] w-full rounded-2xl border border-neutral-300 px-3 py-3 text-sm leading-6"
          placeholder="How did it go overall? Confidence, chemistry, pacing, outcomes, and how the interview felt."
        />
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
        <div className="text-sm font-medium text-neutral-900">Interview scorecard</div>
        <p className="mt-1 text-sm leading-6 text-neutral-600">
          Score the interview from 1 to 5 so the next training round can target specific gaps more precisely.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <ScoreSelect label="Confidence" value={confidenceScore} onChange={setConfidenceScore} />
          <ScoreSelect label="Clarity" value={clarityScore} onChange={setClarityScore} />
          <ScoreSelect label="Commercial sharpness" value={commercialScore} onChange={setCommercialScore} />
          <ScoreSelect label="Storytelling" value={storytellingScore} onChange={setStorytellingScore} />
          <ScoreSelect label="Executive presence" value={executivePresenceScore} onChange={setExecutivePresenceScore} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">What went well</label>
          <textarea
            value={whatWentWell}
            onChange={(event) => setWhatWentWell(event.target.value)}
            className="min-h-[160px] w-full rounded-2xl border border-neutral-300 px-3 py-3 text-sm leading-6"
            placeholder="Which stories landed well? What questions felt strong? What feedback seemed positive?"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Where you struggled</label>
          <textarea
            value={whereStruggled}
            onChange={(event) => setWhereStruggled(event.target.value)}
            className="min-h-[160px] w-full rounded-2xl border border-neutral-300 px-3 py-3 text-sm leading-6"
            placeholder="Where did you hesitate, ramble, lack evidence, or feel underprepared?"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Surprise questions or themes</label>
          <textarea
            value={surpriseQuestions}
            onChange={(event) => setSurpriseQuestions(event.target.value)}
            className="min-h-[160px] w-full rounded-2xl border border-neutral-300 px-3 py-3 text-sm leading-6"
            placeholder="What did they ask that you did not expect?"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">What to change next time</label>
          <textarea
            value={nextTimeChanges}
            onChange={(event) => setNextTimeChanges(event.target.value)}
            className="min-h-[160px] w-full rounded-2xl border border-neutral-300 px-3 py-3 text-sm leading-6"
            placeholder="What should the next practice round focus on?"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !overallAssessment.trim()}
        className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Saving assessment..." : "Save interview assessment"}
      </button>

      {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} /> : null}
    </form>
  )
}

function ScoreSelect({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-700">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm">
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
        <option value="5">5</option>
      </select>
    </label>
  )
}
