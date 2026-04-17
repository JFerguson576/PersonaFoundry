"use client"

import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { CareerStatusBanner } from "@/components/career/CareerStatusBanner"
import { careerActionErrorMessage, careerBackgroundStartedMessage, getCareerMessageTone, startCareerBackgroundJob } from "@/lib/career-client"

type Props = {
  candidateId: string
  suggestedTargetRole: string
}

export function CareerDeepProspectResearch({ candidateId, suggestedTargetRole }: Props) {
  const router = useRouter()
  const [roleFamily, setRoleFamily] = useState(suggestedTargetRole)
  const [location, setLocation] = useState("")
  const [industryFocus, setIndustryFocus] = useState("")
  const [seniority, setSeniority] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage("")

    try {
      await startCareerBackgroundJob(candidateId, "generate_deep_prospect_research", {
        role_family: roleFamily,
        location,
        industry_focus: industryFocus,
        seniority,
        notes,
      })
      setMessage(
        careerBackgroundStartedMessage({
          label: "Deep prospect research",
          destination: "the hidden-market research section",
        })
      )
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : careerActionErrorMessage("start deep prospect research"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[2rem] border border-[#bfdbfe] bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_55%,#ffffff_100%)] p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563eb]">Career Intelligence research</div>
          <h2 className="mt-2 text-2xl font-semibold text-[#0f172a]">Deep prospect research</h2>
          <p className="mt-3 text-sm leading-6 text-[#475569]">
            Scan for strong companies in a chosen market that may not have your exact role advertised yet, but show signals they are likely to need someone like this candidate.
          </p>
        </div>
        <div className="rounded-2xl border border-[#dbeafe] bg-white px-4 py-3 text-sm text-[#334155]">
          Best for hidden-market targeting and warm outreach planning
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Role family</label>
          <input value={roleFamily} onChange={(event) => setRoleFamily(event.target.value)} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Location</label>
          <input value={location} onChange={(event) => setLocation(event.target.value)} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2" />
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Industry focus</label>
          <input value={industryFocus} onChange={(event) => setIndustryFocus(event.target.value)} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2" placeholder="Optional" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Seniority</label>
          <input value={seniority} onChange={(event) => setSeniority(event.target.value)} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2" placeholder="Optional" />
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-sm font-medium">Research notes</label>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="min-h-[140px] w-full rounded-2xl border border-neutral-300 bg-white px-3 py-3 text-sm leading-6"
          placeholder="Optional: target sectors, preferred company size, transformation themes, remote preference, or strategic notes..."
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl text-sm leading-6 text-[#475569]">
          This creates a saved market-intelligence report with likely target companies, growth signals, and suggested outreach angles.
        </p>
        <button
          type="submit"
          disabled={loading || !roleFamily.trim() || !location.trim()}
          className="rounded-xl bg-[#0f172a] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Starting deep research..." : "Start deep prospect research"}
        </button>
      </div>

      {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} className="mt-4" /> : null}
    </form>
  )
}
