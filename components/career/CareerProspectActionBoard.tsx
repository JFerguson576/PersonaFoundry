"use client"

import { useMemo, useState } from "react"
import { getAuthHeaders, navigateCareerWorkspace, notifyCareerWorkspaceRefresh } from "@/lib/career-client"

type Prospect = {
  company: string
  location: string
}

type Props = {
  candidateId: string
  content: string
  roleFamily?: string
}

export function CareerProspectActionBoard({ candidateId, content, roleFamily = "" }: Props) {
  const prospects = useMemo(() => extractProspects(content), [content])
  const [message, setMessage] = useState("")
  const [creatingTargetFor, setCreatingTargetFor] = useState("")

  async function handleCopy(company: string) {
    try {
      await navigator.clipboard.writeText(company)
      setMessage(`Copied ${company}`)
    } catch {
      setMessage("Failed to copy company name")
    }
  }

  async function handleCreateTrackedTarget(prospect: Prospect) {
    setCreatingTargetFor(prospect.company)
    setMessage("")

    try {
      const response = await fetch("/api/career/applications", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          candidate_id: candidateId,
          company_name: prospect.company,
          job_title: roleFamily || "Prospect target",
          location: prospect.location,
          status: "targeting",
          notes: `Created from deep prospect research${roleFamily ? ` for ${roleFamily}` : ""}. Hidden-market target company.`,
          next_action: "Review company dossier and decide whether to launch an application sprint.",
        }),
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to create tracked target")
      }

      notifyCareerWorkspaceRefresh()
      navigateCareerWorkspace("documents", "#document-workbench")
      setMessage(`Tracked target created for ${prospect.company}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong")
    } finally {
      setCreatingTargetFor("")
    }
  }

  if (prospects.length === 0) {
    return null
  }

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Prospect action board</div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-sky-950">
            Pull likely target companies out of this report and move straight into employer intelligence, application sprint, or application tracking.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigateCareerWorkspace("company", "#company-dossier")}
          className="rounded-full border border-sky-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-sky-800 hover:bg-sky-100"
        >
          Open company intelligence
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {prospects.slice(0, 6).map((prospect) => (
          <div key={`${prospect.company}-${prospect.location}`} className="rounded-2xl border border-sky-100 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-neutral-900">{prospect.company}</div>
                <div className="mt-1 text-sm text-neutral-600">{prospect.location || "Location not specified"}</div>
              </div>
              <button
                type="button"
                onClick={() => void handleCopy(prospect.company)}
                className="rounded-full border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                Copy company
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  navigateCareerWorkspace("company", "#company-dossier", {
                    companyName: prospect.company,
                    location: prospect.location,
                    roleFamily,
                    notes: `Sourced from deep prospect research for ${roleFamily || "this target market"}.`,
                  })
                }
                className="rounded-full border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                Build company dossier
              </button>
              <button
                type="button"
                onClick={() =>
                  navigateCareerWorkspace("documents", "#document-actions", {
                    companyName: prospect.company,
                    location: prospect.location,
                    roleFamily,
                    notes: `Prospect identified from deep prospect research for ${roleFamily || "this target market"}.`,
                  })
                }
                className="rounded-full border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                Open application sprint
              </button>
              <button
                type="button"
                onClick={() =>
                  navigateCareerWorkspace("company", "#outreach-strategy", {
                    companyName: prospect.company,
                    location: prospect.location,
                    roleFamily,
                    notes: `Prospect identified from deep prospect research for ${roleFamily || "this target market"}. Build a contact path and first-message strategy.`,
                  })
                }
                className="rounded-full border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                Build outreach plan
              </button>
              <button
                type="button"
                onClick={() =>
                  navigateCareerWorkspace("jobs", "#recruiter-match-search", {
                    companyName: prospect.company,
                    location: prospect.location,
                    roleFamily,
                    notes: `Prospect identified from deep prospect research for ${roleFamily || "this target market"}. Build recruiter routes, search-firm angles, and talent-market access paths.`,
                  })
                }
                className="rounded-full border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                Build recruiter route
              </button>
              <button
                type="button"
                onClick={() => navigateCareerWorkspace("documents", "#document-workbench")}
                className="rounded-full border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                Open application tracker
              </button>
              <button
                type="button"
                onClick={() => void handleCreateTrackedTarget(prospect)}
                disabled={creatingTargetFor === prospect.company}
                className="rounded-full border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creatingTargetFor === prospect.company ? "Creating target..." : "Create tracked target"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {message ? <p className="mt-3 text-sm text-sky-900">{message}</p> : null}
    </div>
  )
}

function extractProspects(content: string): Prospect[] {
  const lines = content.split(/\r?\n/)
  const prospects: Prospect[] = []

  for (const line of lines) {
    const match = line.match(/^\d+\.\s+(.+?)(?:\s+\|\s+(.+))?$/)
    if (!match) continue

    const company = match[1]?.trim() || ""
    const location = match[2]?.trim() || ""

    if (!company) continue
    prospects.push({ company, location })
  }

  return prospects
}
