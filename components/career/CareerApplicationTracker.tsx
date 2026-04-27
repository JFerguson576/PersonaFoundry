"use client"

import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { CareerStatusBanner } from "@/components/career/CareerStatusBanner"
import {
  CAREER_WORKSPACE_NAVIGATE_EVENT,
  careerActionErrorMessage,
  getAuthHeaders,
  getCareerMessageTone,
  navigateCareerWorkspace,
  notifyCareerWorkspaceRefresh,
  setCareerWorkspaceTarget,
} from "@/lib/career-client"

type ApplicationRow = {
  id: string
  company_name: string | null
  job_title: string | null
  location: string | null
  job_url: string | null
  status: string | null
  notes: string | null
  next_action: string | null
  follow_up_date: string | null
  cover_letter_asset_id: string | null
  company_dossier_asset_id: string | null
  salary_analysis_asset_id: string | null
  fit_analysis_asset_id: string | null
  created_at: string | null
  updated_at: string | null
}

type Props = {
  candidateId: string
  applications: ApplicationRow[]
  coverLetterOptions: { id: string; title: string | null }[]
  companyDossierOptions: { id: string; title: string | null }[]
  outreachStrategyOptions: { id: string; title: string | null }[]
  recruiterMatchSearchOptions: { id: string; title: string | null }[]
  salaryAnalysisOptions: { id: string; title: string | null }[]
  fitAnalysisOptions: { id: string; title: string | null; content?: string | null }[]
}

type CareerWorkspaceSection = "company" | "documents" | "jobs"

type RecommendedActionIntent =
  | {
      kind: "status"
      label: string
      status: string
      message: string
    }
  | {
      kind: "navigate"
      label: string
      sectionKey: CareerWorkspaceSection
      href: string
    }
  | {
      kind: "details"
      label: string
    }

type RecommendedActionBanner = {
  title: string
  body: string
  badge: string
  badgeClass: string
  cardClass: string
  action: RecommendedActionIntent | null
}

const applicationStatuses = [
  { value: "targeting", label: "Considering" },
  { value: "shortlisted", label: "Priority shortlist" },
  { value: "applied", label: "Applied" },
  { value: "interviewing", label: "In interviews" },
  { value: "final_round", label: "Final stage" },
  { value: "offer", label: "Offer" },
  { value: "on_hold", label: "Paused" },
  { value: "rejected", label: "Rejected" },
  { value: "archived", label: "Closed" },
]

const applicationStatusGuidance: Record<string, string> = {
  targeting: "Interesting role, not prioritized yet.",
  shortlisted: "High-priority role ready for tailoring or application.",
  applied: "Application submitted.",
  interviewing: "Interview conversations started.",
  final_round: "Final decision stage.",
  offer: "Offer received.",
  on_hold: "Paused for now.",
  rejected: "Process ended in rejection.",
  archived: "Closed and no longer active.",
}

export function CareerApplicationTracker({
  candidateId,
  applications,
  coverLetterOptions,
  companyDossierOptions,
  outreachStrategyOptions,
  recruiterMatchSearchOptions,
  salaryAnalysisOptions,
  fitAnalysisOptions,
}: Props) {
  const [companyName, setCompanyName] = useState("")
  const [jobTitle, setJobTitle] = useState("")
  const [location, setLocation] = useState("")
  const [jobUrl, setJobUrl] = useState("")
  const [status, setStatus] = useState("targeting")
  const [notes, setNotes] = useState("")
  const [nextAction, setNextAction] = useState("")
  const [followUpDate, setFollowUpDate] = useState("")
  const [coverLetterAssetId, setCoverLetterAssetId] = useState("")
  const [companyDossierAssetId, setCompanyDossierAssetId] = useState("")
  const [salaryAnalysisAssetId, setSalaryAnalysisAssetId] = useState("")
  const [fitAnalysisAssetId, setFitAnalysisAssetId] = useState("")
  const [showStageMeanings, setShowStageMeanings] = useState(false)
  const [showFocusGuide, setShowFocusGuide] = useState(false)
  const [showRoleComparison, setShowRoleComparison] = useState(false)
  const [showShortlist, setShowShortlist] = useState(false)
  const [showRoleBoard, setShowRoleBoard] = useState(false)
  const [showPipelineDetails, setShowPipelineDetails] = useState(false)
  const [showAdvancedRoleEntry, setShowAdvancedRoleEntry] = useState(false)
  const [openBoardStage, setOpenBoardStage] = useState<string | null>(null)
  const [openApplicationId, setOpenApplicationId] = useState<string | null>(applications[0]?.id ?? null)
  const [detailsApplicationId, setDetailsApplicationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const today = new Date()
  const todayKey = toDateKey(today)
  const activeApplications = applications.filter((application) => !["offer", "rejected", "archived"].includes(application.status ?? ""))
  const shortlistedApplications = applications.filter((application) => application.status === "shortlisted")
  const overdueApplications = applications.filter((application) => {
    if (!application.follow_up_date) return false
    return application.follow_up_date < todayKey && !["offer", "rejected", "archived"].includes(application.status ?? "")
  })
  const dueTodayApplications = applications.filter((application) => {
    if (!application.follow_up_date) return false
    return application.follow_up_date === todayKey && !["offer", "rejected", "archived"].includes(application.status ?? "")
  })
  const hasAnyApplications = applications.length > 0
  const applicationsByStatus = applicationStatuses.map((statusOption) => ({
    ...statusOption,
    count: applications.filter((application) => application.status === statusOption.value).length,
  }))
  const stageCountWithRoles = applicationsByStatus.filter((item) => item.count > 0).length
  const boardStatuses = applicationStatuses.filter((statusOption) =>
    applications.some((application) => application.status === statusOption.value)
  )
  const coverLetterTitleById = new Map(coverLetterOptions.map((asset) => [asset.id, asset.title || "Untitled cover letter"]))
  const companyDossierTitleById = new Map(companyDossierOptions.map((asset) => [asset.id, asset.title || "Untitled company dossier"]))
  const salaryAnalysisTitleById = new Map(salaryAnalysisOptions.map((asset) => [asset.id, asset.title || "Untitled salary analysis"]))
  const fitAnalysisTitleById = new Map(fitAnalysisOptions.map((asset) => [asset.id, asset.title || "Untitled fit analysis"]))
  const fitAnalysisContentById = new Map(fitAnalysisOptions.map((asset) => [asset.id, asset.content || ""]))
  const suggestedCoverLetter = suggestAssetForCompany(coverLetterOptions, companyName)
  const suggestedDossier = suggestAssetForCompany(companyDossierOptions, companyName)
  const suggestedOutreachStrategy = suggestAssetForCompany(outreachStrategyOptions, companyName)
  const suggestedRecruiterMatchSearch = suggestAssetForCompany(recruiterMatchSearchOptions, companyName)
  const applicationDecisionSummary = buildApplicationDecisionSummary(applications, fitAnalysisContentById)
  const comparisonRows = applications.map((application) =>
    buildComparisonRow({
      application,
      fitAnalysisContentById,
    })
  )
  const rankedComparisonRows = [...comparisonRows].sort((left, right) => {
    const leftScore = left.fitScore ?? -1
    const rightScore = right.fitScore ?? -1
    if (rightScore !== leftScore) return rightScore - leftScore

    const urgencyRank = (label: string) => {
      if (label === "Overdue") return 3
      if (label === "Today") return 2
      if (label === "Upcoming") return 1
      return 0
    }

    return urgencyRank(right.urgencyLabel) - urgencyRank(left.urgencyLabel)
  })
  const topFocusRow = rankedComparisonRows[0] ?? null
  const pipelineNextAction = overdueApplications[0]
    ? `Follow up with ${overdueApplications[0].company_name || overdueApplications[0].job_title || "the overdue role"}`
    : dueTodayApplications[0]
      ? `Check ${dueTodayApplications[0].company_name || dueTodayApplications[0].job_title || "today's role"}`
      : topFocusRow
        ? topFocusRow.nextMove
        : hasAnyApplications
          ? "Review saved roles and decide the next move."
          : "Add the first target role to start the pipeline."
  const pipelineFocusLabel = topFocusRow
    ? `${topFocusRow.company} | ${topFocusRow.role}`
    : hasAnyApplications
      ? "Saved role pipeline"
      : "No roles tracked yet"
  const comparisonRowById = new Map(comparisonRows.map((row) => [row.id, row]))
  const sortedApplications = [...applications].sort((left, right) => {
    const leftRow = comparisonRowById.get(left.id)
    const rightRow = comparisonRowById.get(right.id)
    const urgencyRank = (label: string | undefined) => {
      if (label === "Overdue") return 4
      if (label === "Today") return 3
      if (label === "Upcoming") return 2
      return 0
    }
    const statusRank = (status: string | null | undefined) => {
      if (status === "shortlisted") return 3
      if (status === "applied" || status === "interviewing" || status === "final_round") return 2
      if (status === "targeting") return 1
      return 0
    }
    const leftUrgency = urgencyRank(leftRow?.urgencyLabel)
    const rightUrgency = urgencyRank(rightRow?.urgencyLabel)
    if (rightUrgency !== leftUrgency) return rightUrgency - leftUrgency

    const leftStatus = statusRank(left.status)
    const rightStatus = statusRank(right.status)
    if (rightStatus !== leftStatus) return rightStatus - leftStatus

    const leftFit = leftRow?.fitScore ?? -1
    const rightFit = rightRow?.fitScore ?? -1
    if (rightFit !== leftFit) return rightFit - leftFit

    const leftTime = Date.parse(left.updated_at || left.created_at || "") || 0
    const rightTime = Date.parse(right.updated_at || right.created_at || "") || 0
    return rightTime - leftTime
  })

  useEffect(() => {
    function handlePrefill(event: Event) {
      const detail = (event as CustomEvent<{
        prefill?: {
          companyName?: string
          location?: string
          roleFamily?: string
          notes?: string
          jobUrl?: string
          nextAction?: string
          status?: string
        }
      }>).detail
      const prefill = detail?.prefill
      if (!prefill) return

      if (prefill.companyName) {
        setCompanyName(prefill.companyName)
      }
      if (prefill.location) {
        setLocation(prefill.location)
      }
      if (prefill.roleFamily && !jobTitle) {
        setJobTitle(prefill.roleFamily)
      }
      if (prefill.notes) {
        setNotes((current) => (current ? `${prefill.notes}\n\n${current}` : prefill.notes || ""))
      }
      if (prefill.jobUrl) {
        setJobUrl(prefill.jobUrl)
      }
      if (prefill.nextAction) {
        setNextAction(prefill.nextAction)
      }
      if (prefill.status) {
        setStatus(prefill.status)
      }

      if (prefill.companyName) {
        setMessage(
          `Prefilled application tracker for ${prefill.companyName}${prefill.roleFamily ? ` around ${prefill.roleFamily}` : ""}.`
        )
      }
    }

    if (typeof window !== "undefined") {
      window.addEventListener(CAREER_WORKSPACE_NAVIGATE_EVENT, handlePrefill)
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(CAREER_WORKSPACE_NAVIGATE_EVENT, handlePrefill)
      }
    }
  }, [jobTitle])

  useEffect(() => {
    if (!companyName.trim()) return

    if (!coverLetterAssetId && suggestedCoverLetter) {
      setCoverLetterAssetId(suggestedCoverLetter.id)
    }

    if (!companyDossierAssetId && suggestedDossier) {
      setCompanyDossierAssetId(suggestedDossier.id)
    }
  }, [companyName, companyDossierAssetId, coverLetterAssetId, suggestedCoverLetter, suggestedDossier])

  useEffect(() => {
    if (!hasAnyApplications) {
      if (openBoardStage !== null) {
        setOpenBoardStage(null)
      }
      return
    }

    const activeStageExists = openBoardStage
      ? applicationsByStatus.some((item) => item.value === openBoardStage && item.count > 0)
      : false

    if (activeStageExists) return

    const firstStageWithRoles = applicationsByStatus.find((item) => item.count > 0)?.value ?? applicationStatuses[0]?.value ?? null
    if (firstStageWithRoles !== openBoardStage) {
      setOpenBoardStage(firstStageWithRoles)
    }
  }, [applicationsByStatus, hasAnyApplications, openBoardStage])

  useEffect(() => {
    if (applications.length === 0) {
      if (openApplicationId !== null) {
        setOpenApplicationId(null)
      }
      return
    }

    const currentlyOpenStillExists = openApplicationId
      ? applications.some((application) => application.id === openApplicationId)
      : false

    if (!currentlyOpenStillExists) {
      setOpenApplicationId(applications[0]?.id ?? null)
    }
  }, [applications, openApplicationId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage("")

    try {
      const response = await fetch("/api/career/applications", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          candidate_id: candidateId,
          company_name: companyName,
          job_title: jobTitle,
          location,
          job_url: jobUrl,
          status,
          notes,
          next_action: nextAction,
          follow_up_date: followUpDate,
          cover_letter_asset_id: coverLetterAssetId,
          company_dossier_asset_id: companyDossierAssetId,
          salary_analysis_asset_id: salaryAnalysisAssetId,
          fit_analysis_asset_id: fitAnalysisAssetId,
        }),
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to add application")
      }

      setCompanyName("")
      setJobTitle("")
      setLocation("")
      setJobUrl("")
      setStatus("targeting")
      setNotes("")
      setNextAction("")
      setFollowUpDate("")
      setCoverLetterAssetId("")
      setCompanyDossierAssetId("")
      setSalaryAnalysisAssetId("")
      setFitAnalysisAssetId("")
      setMessage("Application added to tracker.")
      notifyCareerWorkspaceRefresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : careerActionErrorMessage("save the application"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2.5">
      <form onSubmit={handleSubmit} className="rounded-2xl border border-neutral-200 bg-white p-2.5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Add a target role</h2>
            <p className="mt-0.5 max-w-2xl text-xs leading-5 text-neutral-600">Start with company, role, location, and stage.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-neutral-300 bg-neutral-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
              Saved roles {applications.length}
            </span>
            <button
              type="button"
              onClick={() => setShowAdvancedRoleEntry((current) => !current)}
              className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
            >
              {showAdvancedRoleEntry ? "Hide optional fields" : "Show optional fields"}
            </button>
          </div>
        </div>

        <div className="mt-2.5 grid gap-2 md:grid-cols-2">
          <Field label="Company">
            <input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="e.g. Fletcher Building"
              className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5"
            />
          </Field>
          <Field label="Job title">
            <input
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
              placeholder="e.g. Product Manager"
              className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5"
            />
          </Field>
          <Field label="Location">
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="e.g. Auckland"
              className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5"
            />
          </Field>
          <Field label="Status">
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5">
              {applicationStatuses.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-0.5 text-[11px] leading-4 text-neutral-500">{applicationStatusGuidance[status] || "Choose the stage that best matches this role right now."}</p>
          </Field>
        </div>

        {!showAdvancedRoleEntry ? (
          <div className="mt-1.5 rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-600">
            Optional fields hidden: job URL, follow-up date, next action, notes, and linked assets.
          </div>
        ) : null}

        {showAdvancedRoleEntry ? (
          <>
            <div className="mt-2.5 grid gap-2 md:grid-cols-2">
              <Field label="Job URL">
                <input
                  value={jobUrl}
                  onChange={(event) => setJobUrl(event.target.value)}
                  placeholder="Paste role link (optional)"
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5"
                />
              </Field>
              <Field label="Follow-up date">
                <input type="date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5" />
              </Field>
              <Field label="Next action">
                <input
                  value={nextAction}
                  onChange={(event) => setNextAction(event.target.value)}
                  placeholder="What should happen next?"
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm"
                />
              </Field>
              <Field label="Notes">
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-[52px] w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm leading-5" />
              </Field>
            </div>
            <div className="mt-2.5 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Linked cover letter">
                <select value={coverLetterAssetId} onChange={(event) => setCoverLetterAssetId(event.target.value)} className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5">
                  <option value="">No linked cover letter</option>
                  {coverLetterOptions.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.title || "Untitled cover letter"}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Linked company dossier">
                <select value={companyDossierAssetId} onChange={(event) => setCompanyDossierAssetId(event.target.value)} className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5">
                  <option value="">No linked dossier</option>
                  {companyDossierOptions.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.title || "Untitled company dossier"}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Linked salary analysis">
                <select value={salaryAnalysisAssetId} onChange={(event) => setSalaryAnalysisAssetId(event.target.value)} className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5">
                  <option value="">No linked salary analysis</option>
                  {salaryAnalysisOptions.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.title || "Untitled salary analysis"}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Linked fit analysis">
                <select value={fitAnalysisAssetId} onChange={(event) => setFitAnalysisAssetId(event.target.value)} className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5">
                  <option value="">No linked fit analysis</option>
                  {fitAnalysisOptions.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.title || "Untitled fit analysis"}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </>
        ) : null}

        {showAdvancedRoleEntry && (suggestedCoverLetter || suggestedDossier || suggestedOutreachStrategy || suggestedRecruiterMatchSearch) ? (
          <div className="mt-2.5 rounded-xl border border-sky-200 bg-sky-50 p-2.5">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Suggested links</div>
            <div className="mt-1.5 grid gap-1.5 md:grid-cols-2 xl:grid-cols-4">
              {suggestedCoverLetter ? (
                <div className="rounded-xl border border-sky-200 bg-white p-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-sky-700">Suggested cover letter</div>
                  <div className="mt-2 text-sm font-semibold text-neutral-900">{suggestedCoverLetter.title || "Untitled cover letter"}</div>
                </div>
              ) : null}
              {suggestedDossier ? (
                <div className="rounded-xl border border-sky-200 bg-white p-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-sky-700">Suggested dossier</div>
                  <div className="mt-2 text-sm font-semibold text-neutral-900">{suggestedDossier.title || "Untitled company dossier"}</div>
                </div>
              ) : null}
              {suggestedOutreachStrategy ? (
                <div className="rounded-xl border border-sky-200 bg-white p-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-sky-700">Suggested outreach plan</div>
                  <div className="mt-2 text-sm font-semibold text-neutral-900">{suggestedOutreachStrategy.title || "Untitled outreach strategy"}</div>
                </div>
              ) : null}
              {suggestedRecruiterMatchSearch ? (
                <div className="rounded-xl border border-sky-200 bg-white p-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-sky-700">Suggested recruiter route</div>
                  <div className="mt-2 text-sm font-semibold text-neutral-900">
                    {suggestedRecruiterMatchSearch.title || "Untitled recruiter route"}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {suggestedOutreachStrategy ? (
                <button
                  type="button"
                  onClick={() => navigateCareerWorkspace("company", "#current-outreach-strategies")}
                  className="rounded-full border border-sky-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-sky-800 hover:bg-sky-100"
                >
                  Open outreach plan
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    navigateCareerWorkspace("company", "#outreach-strategy", {
                      companyName,
                      location,
                      roleFamily: jobTitle,
                      notes: "Create an outreach strategy before applying so the user can pursue a warmer route into this company.",
                    })
                  }
                  className="rounded-full border border-sky-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-sky-800 hover:bg-sky-100"
                >
                  Create outreach plan
                </button>
              )}
              {suggestedRecruiterMatchSearch ? (
                <button
                  type="button"
                  onClick={() => navigateCareerWorkspace("jobs", "#current-recruiter-match-searches")}
                  className="rounded-full border border-sky-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-sky-800 hover:bg-sky-100"
                >
                  Open recruiter route
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    navigateCareerWorkspace("jobs", "#recruiter-match-search", {
                      companyName,
                      location,
                      roleFamily: jobTitle,
                      notes: "Build recruiter routes and search-firm angles for this live application.",
                    })
                  }
                  className="rounded-full border border-sky-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-sky-800 hover:bg-sky-100"
                >
                  Create recruiter route
                </button>
              )}
            </div>
          </div>
        ) : null}

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <button
            type="submit"
            disabled={loading || !companyName.trim() || !jobTitle.trim()}
            className="rounded-lg bg-black px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Saving..." : status === "shortlisted" ? "Save to shortlist" : "Save role"}
          </button>
          {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} /> : null}
        </div>
      </form>

      <section className="rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-sm">
        <div className="mb-1.5 grid gap-1 md:grid-cols-2 xl:grid-cols-5">
          <TrackerMetricCard label="Active roles" value={String(activeApplications.length)} tone="neutral" />
          <TrackerMetricCard label="Shortlisted" value={String(shortlistedApplications.length)} tone={shortlistedApplications.length > 0 ? "success" : "neutral"} />
          <TrackerMetricCard label="Overdue follow-ups" value={String(overdueApplications.length)} tone={overdueApplications.length > 0 ? "danger" : "neutral"} />
          <TrackerMetricCard label="Due today" value={String(dueTodayApplications.length)} tone={dueTodayApplications.length > 0 ? "warning" : "neutral"} />
          <TrackerMetricCard label="Offers" value={String(applications.filter((application) => application.status === "offer").length)} tone="success" />
        </div>

        <div className="mb-1.5 rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-700">Application pipeline</span>
                <span className="rounded-full border border-sky-200 bg-white px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-sky-800">
                  {activeApplications.length} active
                </span>
                <span className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-amber-800">
                  {applicationDecisionSummary.promising.length} promising
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] ${
                  overdueApplications.length > 0 ? "border-rose-200 bg-rose-50 text-rose-700" : "border-neutral-200 bg-white text-neutral-600"
                }`}>
                  {overdueApplications.length} overdue
                </span>
              </div>
              <div className="mt-1 grid gap-1 lg:grid-cols-[minmax(0,0.8fr),minmax(0,1.2fr)]">
                <div className="truncate text-sm font-semibold text-sky-950">{pipelineFocusLabel}</div>
                <div className="line-clamp-1 text-xs text-sky-900">
                  <span className="font-semibold">Next:</span> {pipelineNextAction}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {topFocusRow ? (
                <button
                  type="button"
                  onClick={() => setCareerWorkspaceTarget(topFocusRow.id)}
                  className="rounded-full border border-sky-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-800 hover:bg-sky-100"
                >
                  Focus top role
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setShowPipelineDetails((current) => !current)}
                className="rounded-full border border-sky-300 bg-[#0a66c2] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#004182]"
              >
                {showPipelineDetails ? "Hide details" : "View details"}
              </button>
            </div>
          </div>
        </div>

        {showPipelineDetails ? (
          <>
        <div className="mb-1 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">Role stages</div>
              <p className="mt-0.5 text-[11px] text-neutral-600">One status per role keeps next actions clear.</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                Active stages {stageCountWithRoles}/{applicationStatuses.length}
              </span>
              <button
                type="button"
                onClick={() => setShowStageMeanings((current) => !current)}
                className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                {showStageMeanings ? "Hide details" : "Show details"}
              </button>
            </div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-0.5 text-[10px] font-semibold text-neutral-800">
            <span className="rounded-full border border-neutral-200 bg-white px-1.5 py-0.5">Considering</span>
            <span className="text-neutral-400">{"->"}</span>
            <span className="rounded-full border border-neutral-200 bg-white px-1.5 py-0.5">Priority shortlist</span>
            <span className="text-neutral-400">{"->"}</span>
            <span className="rounded-full border border-neutral-200 bg-white px-1.5 py-0.5">Applied</span>
            <span className="text-neutral-400">{"->"}</span>
            <span className="rounded-full border border-neutral-200 bg-white px-1.5 py-0.5">In interviews</span>
            <span className="text-neutral-400">{"->"}</span>
            <span className="rounded-full border border-neutral-200 bg-white px-1.5 py-0.5">Offer</span>
          </div>
          {!hasAnyApplications ? (
            <div className="mt-2 rounded-lg border border-dashed border-neutral-300 bg-white px-2.5 py-2 text-xs text-neutral-600">
              No roles tracked yet. Save the first role to start the pipeline.
            </div>
          ) : null}
          {showStageMeanings ? (
            <div className="mt-1.5 rounded-lg border border-neutral-200 bg-white p-1.5">
              <div className="space-y-0.5">
                {applicationStatuses.map((statusOption) => (
                  <div
                    key={`guide-meaning-${statusOption.value}`}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5"
                  >
                    <div className="text-[11px] font-semibold text-neutral-900">{statusOption.label}</div>
                    <div className="max-w-xl text-[10px] leading-4 text-neutral-600">
                      {compactStageGuidance(applicationStatusGuidance[statusOption.value])}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mb-1 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">Focus next</div>
              <h3 className="mt-0.5 text-xs font-semibold">Where to spend time first</h3>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-emerald-800">
                Strong {applicationDecisionSummary.strongFit.length}
              </span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-amber-800">
                Promising {applicationDecisionSummary.promising.length}
              </span>
              <span className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                Lower {applicationDecisionSummary.lowFit.length}
              </span>
              <button
                type="button"
                onClick={() => setShowFocusGuide((current) => !current)}
                className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                {showFocusGuide ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          {showFocusGuide && topFocusRow ? (
            <div className="mt-2 rounded-xl border border-sky-200 bg-white p-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2.5">
                <div className="max-w-2xl">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700">Top focus</div>
                  <h4 className="mt-1 text-sm font-semibold text-neutral-900">
                    {topFocusRow.company} | {topFocusRow.role}
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-neutral-600">{topFocusRow.nextMove}</p>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-3">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${topFocusRow.fitBadgeClass}`}>
                    {topFocusRow.fitScore !== null ? `${topFocusRow.fitScore}/100 fit` : "Fit not scored"}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${topFocusRow.urgencyBadgeClass}`}>
                    {topFocusRow.urgencyLabel}
                  </span>
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                    {topFocusRow.salaryStatus}
                  </span>
                </div>
              </div>
              <div className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-xs leading-5 text-neutral-700">
                {topFocusRow.decision}
              </div>
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setCareerWorkspaceTarget(topFocusRow.id)}
                  className="rounded-full border border-sky-300 bg-white px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-800 hover:bg-sky-100"
                >
                  Focus this role across workspace
                </button>
              </div>
            </div>
          ) : null}
          {showFocusGuide ? (
          <div className="mt-2 grid gap-2 xl:grid-cols-3">
            <DecisionColumn
              title="Push now"
              description="High-fit roles where the candidate should invest more energy immediately."
              tone="success"
              items={applicationDecisionSummary.strongFit}
            />
            <DecisionColumn
              title="Develop and tailor"
              description="Roles with promise, but where stronger tailoring or skills proof may improve odds."
              tone="warning"
              items={applicationDecisionSummary.promising}
            />
            <DecisionColumn
              title="Lower priority"
              description="Roles that currently look less aligned, unless there is a strategic reason to keep them alive."
              tone="neutral"
              items={applicationDecisionSummary.lowFit}
            />
          </div>
          ) : null}
        </div>

        <div className="mb-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-700">Shortlist</div>
              <h3 className="mt-0.5 text-xs font-semibold">Roles to decide next</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="rounded-full border border-violet-200 bg-white px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-violet-700">
                Shortlisted {shortlistedApplications.length}
              </span>
              <button
                type="button"
                onClick={() => setShowShortlist((current) => !current)}
                className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                {showShortlist ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          {!showShortlist ? (
            <div className="mt-1 rounded-lg border border-violet-200 bg-white px-2 py-1 text-[11px] text-neutral-700">
              {shortlistedApplications.length === 0
                ? "No shortlisted roles yet."
                : `${shortlistedApplications.length} shortlisted role${shortlistedApplications.length === 1 ? "" : "s"} ready for review.`}
            </div>
          ) : shortlistedApplications.length === 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
              <span>No shortlisted roles yet.</span>
              <button
                type="button"
                onClick={() => navigateCareerWorkspace("jobs", "#current-live-opportunities")}
                className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                Open live roles
              </button>
            </div>
          ) : (
            <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {shortlistedApplications.map((application) => {
                const linkedDossierTitle = application.company_dossier_asset_id ? companyDossierTitleById.get(application.company_dossier_asset_id) : null
                const linkedCoverLetterTitle = application.cover_letter_asset_id ? coverLetterTitleById.get(application.cover_letter_asset_id) : null
                const linkedFitContent = application.fit_analysis_asset_id ? fitAnalysisContentById.get(application.fit_analysis_asset_id) || "" : ""
                const fitScore = application.fit_analysis_asset_id ? extractFitScore(linkedFitContent) : null
                const readiness = getShortlistReadiness({
                  fitScore,
                  hasDossier: Boolean(linkedDossierTitle),
                  hasCoverLetter: Boolean(linkedCoverLetterTitle),
                })
                const nextStatusOption = getNextStatusOption(application.status)

                return (
                  <div key={`shortlist-${application.id}`} className={`rounded-xl border p-2.5 shadow-sm ${readiness.cardClass}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-current/80">Role</div>
                        <div className="mt-1 text-sm font-semibold text-neutral-900">{application.job_title || "Untitled role"}</div>
                        <div className="mt-0.5 text-xs text-neutral-700">
                          {application.company_name || "Untitled company"}
                          {application.location ? ` | ${application.location}` : ""}
                        </div>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${readiness.badgeClass}`}>
                        {readiness.label}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-semibold text-neutral-700">
                        {fitScore !== null ? `${fitScore}/100 fit` : "Fit not scored"}
                      </span>
                      <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-semibold text-neutral-700">
                        {linkedDossierTitle ? "Dossier linked" : "Dossier missing"}
                      </span>
                      <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-semibold text-neutral-700">
                        {linkedCoverLetterTitle ? "Letter linked" : "Letter missing"}
                      </span>
                    </div>

                    <p className="mt-2 text-xs leading-5 text-neutral-700">{buildShortlistGuidance(readiness.level, application.next_action)}</p>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCareerWorkspaceTarget(application.id)}
                        className="rounded-full border border-sky-300 bg-white px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-800 hover:bg-sky-100"
                      >
                        Focus this role
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateCareerWorkspace("company", linkedDossierTitle ? "#current-company-dossiers" : "#company-dossier")}
                        className="rounded-full border border-neutral-300 bg-white px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                      >
                        {linkedDossierTitle ? "Open dossier" : "Create dossier"}
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateCareerWorkspace("documents", linkedCoverLetterTitle ? "#current-cover-letters" : "#document-workbench")}
                        className="rounded-full border border-neutral-300 bg-white px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                      >
                        {linkedCoverLetterTitle ? "Open letter" : "Create letter"}
                      </button>
                      {nextStatusOption ? (
                        <QuickStatusAdvanceButton application={application} nextStatus={nextStatusOption.value} label={`Mark as ${nextStatusOption.label}`} />
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="mb-1 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">Compare roles</div>
              <h3 className="mt-0.5 text-xs font-semibold">Side-by-side view</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                Compared {rankedComparisonRows.length}
              </span>
              <button
                type="button"
                onClick={() => setShowRoleComparison((current) => !current)}
                className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                {showRoleComparison ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {showRoleComparison && rankedComparisonRows.length === 0 ? (
            <div className="mt-2 rounded-xl border border-dashed border-neutral-300 bg-white px-2.5 py-2 text-xs text-neutral-600">
              Add at least two roles to compare.
            </div>
          ) : showRoleComparison ? (
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    {["Role", "Company", "Fit", "Urgency", "Salary", "Decision", "Next move"].map((heading) => (
                      <th
                        key={heading}
                        className="border-b border-neutral-200 bg-white px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rankedComparisonRows.map((row) => (
                    <tr key={row.id}>
                      <td className="border-b border-neutral-200 bg-white px-2.5 py-2 text-xs font-semibold text-neutral-900">{row.role}</td>
                      <td className="border-b border-neutral-200 bg-white px-2.5 py-2 text-xs text-neutral-700">{row.company}</td>
                      <td className="border-b border-neutral-200 bg-white px-2.5 py-2 text-xs text-neutral-700">
                        {row.fitScore !== null ? (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${row.fitBadgeClass}`}>
                            {row.fitScore}/100
                          </span>
                        ) : (
                          <span className="text-neutral-400">Not scored</span>
                        )}
                      </td>
                      <td className="border-b border-neutral-200 bg-white px-2.5 py-2 text-xs text-neutral-700">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${row.urgencyBadgeClass}`}>
                          {row.urgencyLabel}
                        </span>
                      </td>
                      <td className="border-b border-neutral-200 bg-white px-2.5 py-2 text-xs text-neutral-700">{row.salaryStatus}</td>
                      <td className="border-b border-neutral-200 bg-white px-2.5 py-2 text-xs text-neutral-700">{row.decision}</td>
                      <td className="border-b border-neutral-200 bg-white px-2.5 py-2 text-xs leading-5 text-neutral-700">{row.nextMove}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <div className="mb-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">Role board</div>
              <h3 className="mt-0.5 text-xs font-semibold">Pipeline by stage</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                Stages {boardStatuses.length || 1}
              </span>
              <button
                type="button"
                onClick={() => setShowRoleBoard((current) => !current)}
                className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                {showRoleBoard ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {!hasAnyApplications && showRoleBoard ? (
            <div className="mt-2 rounded-xl border border-dashed border-neutral-300 bg-white px-2.5 py-2 text-xs text-neutral-600">
              No tracked roles yet. Save one live role to start this board.
            </div>
          ) : showRoleBoard ? (
            <div className="mt-1.5 space-y-1">
              {(boardStatuses.length > 0 ? boardStatuses : applicationStatuses.slice(0, 1)).map((statusOption) => {
                const items = applications.filter((application) => application.status === statusOption.value)
                const isExpanded = openBoardStage === statusOption.value
                return (
                  <div key={statusOption.value} className={`rounded-md border p-1.5 ${pipelineStageToneClass(statusOption.value)}`}>
                    <button
                      type="button"
                      onClick={() => setOpenBoardStage((current) => (current === statusOption.value ? null : statusOption.value))}
                      className="flex w-full items-center justify-between gap-3 text-left"
                    >
                      <div className="text-xs font-semibold text-neutral-900">{statusOption.label}</div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">{items.length}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-600">{isExpanded ? "Hide" : "Show"}</span>
                      </div>
                    </button>
                    {isExpanded ? (
                      items.length === 0 ? (
                        <p className="mt-2 text-xs leading-5 text-neutral-500">No applications in this stage.</p>
                      ) : (
                        <div className="mt-2 space-y-1.5">
                      {items.map((application) => {
                        const followUpState = getFollowUpState(application.follow_up_date || "", application.status || "")
                        const linkedCoverLetterTitle = application.cover_letter_asset_id ? coverLetterTitleById.get(application.cover_letter_asset_id) : null
                        const linkedDossierTitle = application.company_dossier_asset_id ? companyDossierTitleById.get(application.company_dossier_asset_id) : null
                        const linkedSalaryTitle = application.salary_analysis_asset_id ? salaryAnalysisTitleById.get(application.salary_analysis_asset_id) : null
                        const linkedFitTitle = application.fit_analysis_asset_id ? fitAnalysisTitleById.get(application.fit_analysis_asset_id) : null
                        const linkedOutreachTitle = suggestAssetForCompany(outreachStrategyOptions, application.company_name || "")?.title || null
                        const fitScore = application.fit_analysis_asset_id ? extractFitScore(fitAnalysisContentById.get(application.fit_analysis_asset_id) || "") : null
                        const fitDecision = fitScore !== null ? getFitDecision(fitScore) : null
                        const nextStatusOption = getNextStatusOption(application.status)
                        const campaignLane = buildCampaignLane({
                          status: application.status,
                          hasDossier: Boolean(linkedDossierTitle),
                          hasOutreach: Boolean(linkedOutreachTitle),
                          hasApplication: Boolean(application.cover_letter_asset_id) || ["applied", "interviewing", "final_round", "offer", "rejected"].includes(application.status || ""),
                          hasInterview: ["interviewing", "final_round", "offer", "rejected"].includes(application.status || ""),
                          hasFollowUp: Boolean(application.follow_up_date),
                        })
                        return (
                          <div key={`board-${application.id}`} className="rounded-lg border border-neutral-200 bg-neutral-50 p-2">
                            <div className="font-semibold text-neutral-900">{application.company_name || "Untitled company"}</div>
                            <div className="mt-0.5 text-sm text-neutral-600">{application.job_title || "Untitled role"}</div>
                            <div className="mt-1.5">
                              <CampaignLane steps={campaignLane} compact />
                            </div>
                            {fitDecision ? (
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${fitDecision.badgeClass}`}>
                                  {fitDecision.label}
                                </span>
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-700">{fitScore}/100 fit</span>
                              </div>
                            ) : null}
                            {application.next_action ? <p className="mt-1.5 text-xs leading-5 text-neutral-600">{application.next_action}</p> : null}
                            {linkedCoverLetterTitle || linkedDossierTitle || linkedSalaryTitle || linkedFitTitle ? (
                              <div className="mt-2 space-y-1.5">
                                <button
                                  type="button"
                                  onClick={() => setCareerWorkspaceTarget(application.id)}
                                  className="block w-full rounded-lg border border-sky-300 bg-white px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-sky-800 hover:bg-sky-100"
                                >
                                  Focus this role across workspace
                                </button>
                                {linkedCoverLetterTitle ? (
                                  <button
                                    type="button"
                                    onClick={() => navigateCareerWorkspace("documents", "#current-cover-letters")}
                                    className="block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                                  >
                                    Cover letter: {linkedCoverLetterTitle}
                                  </button>
                                ) : null}
                                {linkedDossierTitle ? (
                                  <button
                                    type="button"
                                    onClick={() => navigateCareerWorkspace("company", "#current-company-dossiers")}
                                    className="block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                                  >
                                    Dossier: {linkedDossierTitle}
                                  </button>
                                ) : null}
                                {linkedSalaryTitle ? (
                                  <button
                                    type="button"
                                    onClick={() => navigateCareerWorkspace("jobs", "#current-salary-analysis")}
                                    className="block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                                  >
                                    Salary: {linkedSalaryTitle}
                                  </button>
                                ) : null}
                                {linkedFitTitle ? (
                                  <button
                                    type="button"
                                    onClick={() => navigateCareerWorkspace("jobs", "#current-fit-analysis")}
                                    className="block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                                  >
                                    Fit: {linkedFitTitle}
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                            {nextStatusOption ? (
                              <QuickStatusAdvanceButton
                                application={application}
                                nextStatus={nextStatusOption.value}
                                label={`Mark as ${nextStatusOption.label}`}
                              />
                            ) : null}
                            {followUpState ? (
                              <div className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${followUpState.badgeClass}`}>
                                {followUpState.label}
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                      </div>
                    )
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="mt-1 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-[11px] text-neutral-600">
              Keep this collapsed for a cleaner view. Open when you need stage-by-stage detail.
            </div>
          )}
        </div>
          </>
        ) : null}

        <h2 className="text-base font-semibold">Saved roles and applications</h2>
        {applications.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-600">No saved roles yet. Add one above to start managing tailoring, follow-up, and interview progress.</p>
        ) : (
          <div className="mt-1.5 space-y-1.5">
            {sortedApplications.map((application) => {
              const isOpen = openApplicationId === application.id
              const matchedCoverLetterTitle =
                (application.cover_letter_asset_id ? coverLetterTitleById.get(application.cover_letter_asset_id) : null) ||
                suggestAssetForCompany(coverLetterOptions, application.company_name || "")?.title ||
                null
              const matchedDossierTitle =
                (application.company_dossier_asset_id ? companyDossierTitleById.get(application.company_dossier_asset_id) : null) ||
                suggestAssetForCompany(companyDossierOptions, application.company_name || "")?.title ||
                null
              const matchedSalaryTitle =
                (application.salary_analysis_asset_id ? salaryAnalysisTitleById.get(application.salary_analysis_asset_id) : null) ||
                suggestAssetForCompany(salaryAnalysisOptions, application.company_name || "")?.title ||
                null
              const matchedFitTitle =
                (application.fit_analysis_asset_id ? fitAnalysisTitleById.get(application.fit_analysis_asset_id) : null) ||
                suggestAssetForCompany(fitAnalysisOptions, application.company_name || "")?.title ||
                null
              const roleAssetReadiness = [
                { label: "Dossier", ready: Boolean(matchedDossierTitle), title: matchedDossierTitle },
                { label: "Letter", ready: Boolean(matchedCoverLetterTitle), title: matchedCoverLetterTitle },
                { label: "Salary", ready: Boolean(matchedSalaryTitle), title: matchedSalaryTitle },
                { label: "Fit", ready: Boolean(matchedFitTitle), title: matchedFitTitle },
              ]
              const fitScore = application.fit_analysis_asset_id ? extractFitScore(fitAnalysisContentById.get(application.fit_analysis_asset_id) || "") : null
              const fitDecision = fitScore !== null ? getFitDecision(fitScore) : null
              const followUpState = getFollowUpState(application.follow_up_date || "", application.status || "")
              const rolePrimaryAction = !matchedDossierTitle
                ? {
                    label: "Create dossier",
                    helper: "Research the company before tailoring.",
                    run: () =>
                      navigateCareerWorkspace("company", "#company-dossier", {
                        companyName: application.company_name || "",
                        location: application.location || "",
                        roleFamily: application.job_title || "",
                        jobUrl: application.job_url || "",
                        notes: application.notes || "Create a company dossier for this tracked role.",
                      }),
                  }
                : !matchedCoverLetterTitle
                  ? {
                      label: "Create cover letter",
                      helper: "Turn the role context into application copy.",
                      run: () =>
                        navigateCareerWorkspace("documents", "#document-workbench", {
                          companyName: application.company_name || "",
                          location: application.location || "",
                          roleFamily: application.job_title || "",
                          jobUrl: application.job_url || "",
                          notes: application.notes || "Create a tailored cover letter for this tracked role.",
                        }),
                    }
                  : !matchedFitTitle
                    ? {
                        label: "Run fit check",
                        helper: "Score the role before spending more time.",
                        run: () =>
                          navigateCareerWorkspace("jobs", "#fit-analysis", {
                            companyName: application.company_name || "",
                            location: application.location || "",
                            roleFamily: application.job_title || "",
                            jobUrl: application.job_url || "",
                            notes: application.notes || "Run a fit analysis for this tracked role.",
                          }),
                      }
                    : !application.follow_up_date && !["offer", "rejected", "archived"].includes(application.status || "")
                      ? {
                          label: "Set follow-up",
                          helper: "Add the next date or action.",
                          run: () => {
                            setDetailsApplicationId(application.id)
                            setOpenApplicationId(application.id)
                          },
                        }
                      : {
                          label: "Focus role",
                          helper: "Use this role across the workspace.",
                          run: () => setCareerWorkspaceTarget(application.id),
                        }

              return (
                <div key={application.id} className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_0_rgba(15,23,42,0.03)]">
                  <button
                    type="button"
                    onClick={() => setOpenApplicationId((current) => (current === application.id ? null : application.id))}
                    className="flex w-full flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 text-left"
                  >
                    <div>
                      <div className="text-sm font-semibold text-neutral-900">{application.company_name || "Untitled company"}</div>
                      <div className="mt-0.5 text-xs text-neutral-600">{application.job_title || "Untitled role"}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {roleAssetReadiness.map((asset) => (
                          <span
                            key={`${application.id}-${asset.label}`}
                            title={asset.title ? `${asset.label}: ${asset.title}` : `${asset.label} not generated yet`}
                            className={`rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.04em] ${assetReadinessChipClass(asset.ready)}`}
                          >
                            {asset.label} {asset.ready ? "ready" : "missing"}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {fitDecision && fitScore !== null ? (
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${fitDecision.badgeClass}`}>
                          {fitScore}/100
                        </span>
                      ) : null}
                      {followUpState ? (
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${followUpState.badgeClass}`}>
                          {followUpState.label}
                        </span>
                      ) : null}
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusBadgeClass(application.status)}`}>
                        {formatStatus(application.status)}
                      </span>
                      <span className="rounded-full border border-neutral-300 bg-neutral-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                        {isOpen ? "Collapse" : "Open"}
                      </span>
                    </div>
                  </button>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 bg-neutral-50/60 px-2.5 py-1.5">
                    <div className="text-[11px] text-neutral-500">
                      <span className="font-semibold text-neutral-700">Best next:</span> {rolePrimaryAction.helper}
                    </div>
                    <button
                      type="button"
                      onClick={rolePrimaryAction.run}
                      className="rounded-full border border-[#0a66c2] bg-[#0a66c2] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#004182]"
                    >
                      {rolePrimaryAction.label}
                    </button>
                  </div>
                  {isOpen ? (
                    <div className="border-t border-neutral-200 p-1">
                      <ApplicationEditor
                        application={application}
                        coverLetterOptions={coverLetterOptions}
                        companyDossierOptions={companyDossierOptions}
                        outreachStrategyOptions={outreachStrategyOptions}
                        salaryAnalysisOptions={salaryAnalysisOptions}
                        fitAnalysisOptions={fitAnalysisOptions}
                        embedded
                        initialShowDetails={detailsApplicationId === application.id}
                      />
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function ApplicationEditor({
  application,
  coverLetterOptions,
  companyDossierOptions,
  outreachStrategyOptions,
  salaryAnalysisOptions,
  fitAnalysisOptions,
  embedded = false,
  initialShowDetails = false,
}: {
  application: ApplicationRow
  coverLetterOptions: { id: string; title: string | null }[]
  companyDossierOptions: { id: string; title: string | null }[]
  outreachStrategyOptions: { id: string; title: string | null }[]
  salaryAnalysisOptions: { id: string; title: string | null }[]
  fitAnalysisOptions: { id: string; title: string | null; content?: string | null }[]
  embedded?: boolean
  initialShowDetails?: boolean
}) {
  const [companyName, setCompanyName] = useState(application.company_name || "")
  const [jobTitle, setJobTitle] = useState(application.job_title || "")
  const [location, setLocation] = useState(application.location || "")
  const [jobUrl, setJobUrl] = useState(application.job_url || "")
  const [status, setStatus] = useState(application.status || "targeting")
  const [notes, setNotes] = useState(application.notes || "")
  const [nextAction, setNextAction] = useState(application.next_action || "")
  const [followUpDate, setFollowUpDate] = useState(application.follow_up_date || "")
  const [coverLetterAssetId, setCoverLetterAssetId] = useState(application.cover_letter_asset_id || "")
  const [companyDossierAssetId, setCompanyDossierAssetId] = useState(application.company_dossier_asset_id || "")
  const [salaryAnalysisAssetId, setSalaryAnalysisAssetId] = useState(application.salary_analysis_asset_id || "")
  const [fitAnalysisAssetId, setFitAnalysisAssetId] = useState(application.fit_analysis_asset_id || "")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [showCampaignLane, setShowCampaignLane] = useState(false)
  const [showSuggestedLinks, setShowSuggestedLinks] = useState(false)
  const [showLinkedAssets, setShowLinkedAssets] = useState(false)
  const [showWarmPlan, setShowWarmPlan] = useState(false)
  const [showAdvancedLinks, setShowAdvancedLinks] = useState(false)
  const [showRoleDetails, setShowRoleDetails] = useState(() => {
    if (initialShowDetails) return true
    if (!embedded) return false
    return !(application.company_name && application.job_title)
  })
  const followUpState = getFollowUpState(followUpDate, status)
  const linkedCoverLetterTitle = coverLetterAssetId ? coverLetterOptions.find((asset) => asset.id === coverLetterAssetId)?.title || "Untitled cover letter" : null
  const linkedDossierTitle = companyDossierAssetId ? companyDossierOptions.find((asset) => asset.id === companyDossierAssetId)?.title || "Untitled company dossier" : null
  const linkedSalaryTitle = salaryAnalysisAssetId ? salaryAnalysisOptions.find((asset) => asset.id === salaryAnalysisAssetId)?.title || "Untitled salary analysis" : null
  const linkedFitTitle = fitAnalysisAssetId ? fitAnalysisOptions.find((asset) => asset.id === fitAnalysisAssetId)?.title || "Untitled fit analysis" : null
  const suggestedOutreachStrategy = suggestAssetForCompany(outreachStrategyOptions, companyName)
  const fitScore = fitAnalysisAssetId ? extractFitScore(fitAnalysisOptions.find((asset) => asset.id === fitAnalysisAssetId)?.content || "") : null
  const fitDecision = fitScore !== null ? getFitDecision(fitScore) : null
  const campaignLane = buildCampaignLane({
    status,
    hasDossier: Boolean(linkedDossierTitle),
    hasOutreach: Boolean(suggestedOutreachStrategy),
    hasApplication: Boolean(linkedCoverLetterTitle) || ["applied", "interviewing", "final_round", "offer", "rejected"].includes(status),
    hasInterview: ["interviewing", "final_round", "offer", "rejected"].includes(status),
    hasFollowUp: Boolean(followUpDate),
  })
  const warmPlan = buildWarmApplicationPlan({
    fitScore,
    hasCoverLetter: Boolean(linkedCoverLetterTitle),
    hasDossier: Boolean(linkedDossierTitle),
    hasSalaryAnalysis: Boolean(linkedSalaryTitle),
    nextAction,
  })
  const recommendedAction = getRecommendedActionBanner({
    status,
    fitScore,
    hasDossier: Boolean(linkedDossierTitle),
    hasCoverLetter: Boolean(linkedCoverLetterTitle),
    hasFollowUp: Boolean(followUpDate || nextAction),
  })
  const recommendedActionIntent = recommendedAction.action
  const suggestedCoverLetter = suggestAssetForCompany(coverLetterOptions, companyName)
  const suggestedDossier = suggestAssetForCompany(companyDossierOptions, companyName)

  useEffect(() => {
    if (initialShowDetails) {
      setShowRoleDetails(true)
    }
  }, [initialShowDetails])

  useEffect(() => {
    if (!companyName.trim()) return

    if (!coverLetterAssetId && suggestedCoverLetter) {
      setCoverLetterAssetId(suggestedCoverLetter.id)
    }

    if (!companyDossierAssetId && suggestedDossier) {
      setCompanyDossierAssetId(suggestedDossier.id)
    }
  }, [companyName, companyDossierAssetId, coverLetterAssetId, suggestedCoverLetter, suggestedDossier])

  async function handleSave(overrides: { status?: string; nextAction?: string; message?: string } = {}) {
    const nextStatus = overrides.status ?? status
    const nextActionValue = overrides.nextAction ?? nextAction

    setLoading(true)
    setMessage("")

    try {
      const response = await fetch(`/api/career/applications/${application.id}`, {
        method: "PATCH",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          company_name: companyName,
          job_title: jobTitle,
          location,
          job_url: jobUrl,
          status: nextStatus,
          notes,
          next_action: nextActionValue,
          follow_up_date: followUpDate,
          cover_letter_asset_id: coverLetterAssetId,
          company_dossier_asset_id: companyDossierAssetId,
          salary_analysis_asset_id: salaryAnalysisAssetId,
          fit_analysis_asset_id: fitAnalysisAssetId,
        }),
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to update application")
      }

      if (overrides.status) setStatus(overrides.status)
      if (overrides.nextAction !== undefined) setNextAction(overrides.nextAction)
      setMessage(overrides.message || "Application updated.")
      notifyCareerWorkspaceRefresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : careerActionErrorMessage("update the application"))
    } finally {
      setLoading(false)
    }
  }

  function handleRecommendedAction(action: RecommendedActionIntent) {
    if (action.kind === "navigate") {
      navigateCareerWorkspace(action.sectionKey, action.href, {
        companyName,
        location,
        roleFamily: jobTitle,
        notes: "Use this tracked role as the context for the next application step.",
      })
      return
    }

    if (action.kind === "details") {
      setShowRoleDetails(true)
      return
    }

    void handleSave({
      status: action.status,
      message: action.message,
    })
  }

  return (
    <div className={embedded ? "rounded-lg bg-neutral-50 p-1" : "rounded-lg border border-neutral-200 bg-neutral-50 p-1"}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-neutral-900">{companyName || "Untitled company"}</div>
          <div className="mt-0.5 text-xs text-neutral-600">{jobTitle || "Untitled role"}</div>
          {fitDecision ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] ${fitDecision.badgeClass}`}>
                {fitDecision.label}
              </span>
              <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-neutral-700">{fitScore}/100 fit</span>
            </div>
          ) : null}
          {followUpState ? (
            <div className={`mt-1.5 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] ${followUpState.badgeClass}`}>
              {followUpState.label}
            </div>
          ) : null}
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] ${statusBadgeClass(status)}`}>
          {formatStatus(status)}
        </span>
      </div>

      <div className={`mt-1.5 rounded-lg border px-2 py-1.5 ${recommendedAction.cardClass}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="max-w-2xl">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-current/80">Recommended action</div>
            <div className="mt-0.5 text-sm font-semibold text-neutral-900">{recommendedAction.title}</div>
            <p className="mt-0.5 text-[11px] leading-4 text-neutral-700">{recommendedAction.body}</p>
          </div>
          {recommendedActionIntent ? (
            <button
              type="button"
              onClick={() => handleRecommendedAction(recommendedActionIntent)}
              disabled={loading || (recommendedActionIntent.kind === "status" && (!companyName.trim() || !jobTitle.trim()))}
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 ${recommendedAction.badgeClass}`}
            >
              {loading && recommendedActionIntent.kind === "status" ? "Updating..." : recommendedActionIntent.label}
            </button>
          ) : (
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${recommendedAction.badgeClass}`}>
              {recommendedAction.badge}
            </span>
          )}
        </div>
      </div>

      <div className="mt-1.5 rounded-lg border border-neutral-200 bg-white px-2 py-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-600">
              {companyName || "Company"}
            </span>
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-600">
              {jobTitle || "Role"}
            </span>
            {location ? (
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-600">
                {location}
              </span>
            ) : null}
            {followUpDate ? (
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-600">
                Follow-up {followUpDate}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setShowRoleDetails((current) => !current)}
            className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
          >
            {showRoleDetails ? "Hide details" : "Edit details"}
          </button>
        </div>
      </div>

      {showRoleDetails ? (
        <>
        <div className="mt-2 grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Company">
              <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-sm" />
            </Field>
            <Field label="Job title">
              <input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-sm" />
            </Field>
            <Field label="Location">
              <input value={location} onChange={(event) => setLocation(event.target.value)} className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-sm" />
            </Field>
            <Field label="Status">
                <select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-sm">
                  {applicationStatuses.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-0.5 text-[11px] leading-4 text-neutral-500">{applicationStatusGuidance[status] || "Choose the stage that best matches this role right now."}</p>
            </Field>
            <Field label="Job URL">
              <input value={jobUrl} onChange={(event) => setJobUrl(event.target.value)} className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-sm" />
            </Field>
            <Field label="Follow-up date">
              <input type="date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-sm" />
            </Field>
          </div>

          <div className="mt-1.5">
            <button
              type="button"
              onClick={() => setShowAdvancedLinks((current) => !current)}
            className="rounded-full border border-neutral-300 bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
          >
            {showAdvancedLinks ? "Hide linked assets fields" : "Show linked assets fields"}
          </button>
          </div>

          {showAdvancedLinks ? (
            <div className="mt-2 grid gap-1.5 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Linked cover letter">
                <select value={coverLetterAssetId} onChange={(event) => setCoverLetterAssetId(event.target.value)} className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-sm">
                  <option value="">No linked cover letter</option>
                  {coverLetterOptions.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.title || "Untitled cover letter"}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Linked company dossier">
                <select value={companyDossierAssetId} onChange={(event) => setCompanyDossierAssetId(event.target.value)} className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-sm">
                  <option value="">No linked dossier</option>
                  {companyDossierOptions.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.title || "Untitled company dossier"}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Linked salary analysis">
                <select value={salaryAnalysisAssetId} onChange={(event) => setSalaryAnalysisAssetId(event.target.value)} className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-sm">
                  <option value="">No linked salary analysis</option>
                  {salaryAnalysisOptions.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.title || "Untitled salary analysis"}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Linked fit analysis">
                <select value={fitAnalysisAssetId} onChange={(event) => setFitAnalysisAssetId(event.target.value)} className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-sm">
                  <option value="">No linked fit analysis</option>
                  {fitAnalysisOptions.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.title || "Untitled fit analysis"}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          ) : null}
        </>
      ) : (
        <div className="mt-1 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] text-neutral-600">
          Editor is collapsed for focus. Open details only when you need to change role, links, or follow-up.
        </div>
      )}

      {showRoleDetails ? (
        <div className="mt-2 rounded-xl border border-neutral-200 bg-white p-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Campaign lane</div>
            <button
              type="button"
              onClick={() => setShowCampaignLane((current) => !current)}
              className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
            >
              {showCampaignLane ? "Hide" : "Show"}
            </button>
          </div>
          {showCampaignLane ? (
            <>
              <p className="mt-1.5 text-xs leading-5 text-neutral-600">
                Research, warm outreach, tailored apply, interview prep, and follow-up in one flow.
              </p>
              <div className="mt-2">
                <CampaignLane steps={campaignLane} />
              </div>
              <div className="mt-2.5">
                <button
                  type="button"
                  onClick={() => setCareerWorkspaceTarget(application.id)}
                  className="rounded-full border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-sky-800 hover:bg-sky-100"
                >
                  Use this as current workspace brief
                </button>
              </div>
            </>
          ) : (
            <p className="mt-1.5 text-xs text-neutral-600">Hidden for focus. Expand when you want full pipeline detail.</p>
          )}
        </div>
      ) : null}

      {showRoleDetails && (suggestedCoverLetter || suggestedDossier || suggestedOutreachStrategy) ? (
        <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50 p-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Suggested links for this company</div>
            <button
              type="button"
              onClick={() => setShowSuggestedLinks((current) => !current)}
              className="rounded-full border border-sky-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-800 hover:bg-sky-100"
            >
              {showSuggestedLinks ? "Hide" : "Show"}
            </button>
          </div>
          {showSuggestedLinks ? (
            <>
              <div className="mt-1.5 grid gap-1.5 md:grid-cols-3">
                {suggestedCoverLetter ? (
                  <div className="rounded-xl border border-sky-200 bg-white p-2.5">
                    <div className="text-xs font-semibold uppercase tracking-[0.08em] text-sky-700">Suggested cover letter</div>
                    <div className="mt-2 text-sm font-semibold text-neutral-900">{suggestedCoverLetter.title || "Untitled cover letter"}</div>
                  </div>
                ) : null}
                {suggestedDossier ? (
                  <div className="rounded-xl border border-sky-200 bg-white p-2.5">
                    <div className="text-xs font-semibold uppercase tracking-[0.08em] text-sky-700">Suggested dossier</div>
                    <div className="mt-2 text-sm font-semibold text-neutral-900">{suggestedDossier.title || "Untitled company dossier"}</div>
                  </div>
                ) : null}
                {suggestedOutreachStrategy ? (
                  <div className="rounded-xl border border-sky-200 bg-white p-2.5">
                    <div className="text-xs font-semibold uppercase tracking-[0.08em] text-sky-700">Suggested outreach plan</div>
                    <div className="mt-2 text-sm font-semibold text-neutral-900">{suggestedOutreachStrategy.title || "Untitled outreach strategy"}</div>
                  </div>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestedOutreachStrategy ? (
                  <button
                    type="button"
                    onClick={() => navigateCareerWorkspace("company", "#current-outreach-strategies")}
                    className="rounded-full border border-sky-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-sky-800 hover:bg-sky-100"
                  >
                    Open outreach plan
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      navigateCareerWorkspace("company", "#outreach-strategy", {
                        companyName,
                        location,
                        roleFamily: jobTitle,
                        notes: "Create an outreach strategy for this tracked application before the next contact step.",
                      })
                    }
                    className="rounded-full border border-sky-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-sky-800 hover:bg-sky-100"
                  >
                    Create outreach plan
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="mt-1.5 text-xs text-sky-900/80">Hidden by default to keep this role editor compact.</p>
          )}
        </div>
      ) : null}

      {showRoleDetails ? (
        <div className="mt-2 grid gap-1.5 md:grid-cols-2">
          <Field label="Next action">
            <input
              value={nextAction}
              onChange={(event) => setNextAction(event.target.value)}
              placeholder="What should happen next?"
              className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-sm"
            />
          </Field>
          <Field label="Notes">
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-[38px] w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-sm leading-5" />
          </Field>
        </div>
      ) : (
        <div className="mt-1 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] text-neutral-700">
          Next action: {nextAction?.trim() ? nextAction : "No next action set yet."}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {showRoleDetails ? (
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={loading || !companyName.trim() || !jobTitle.trim()}
            className="rounded-xl bg-black px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save application"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowRoleDetails(true)}
            className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
          >
            Edit details
          </button>
        )}
        {jobUrl ? (
          <a href={jobUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-white">
            Open link
          </a>
        ) : null}
        {showRoleDetails && linkedCoverLetterTitle ? (
          <button
            type="button"
            onClick={() => navigateCareerWorkspace("documents", "#current-cover-letters")}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-white"
          >
            Open linked cover letter
          </button>
        ) : null}
        {showRoleDetails && linkedDossierTitle ? (
          <button
            type="button"
            onClick={() => navigateCareerWorkspace("company", "#current-company-dossiers")}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-white"
          >
            Open linked dossier
          </button>
        ) : null}
        {showRoleDetails && linkedSalaryTitle ? (
          <button
            type="button"
            onClick={() => navigateCareerWorkspace("jobs", "#current-salary-analysis")}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-white"
          >
            Open salary analysis
          </button>
        ) : null}
        {showRoleDetails && linkedFitTitle ? (
          <button
            type="button"
            onClick={() => navigateCareerWorkspace("jobs", "#current-fit-analysis")}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-white"
          >
            Open fit analysis
          </button>
        ) : null}
        {showRoleDetails ? (
          <button
            type="button"
            onClick={() =>
              navigateCareerWorkspace("company", suggestedOutreachStrategy ? "#current-outreach-strategies" : "#outreach-strategy", {
                companyName,
                location,
                roleFamily: jobTitle,
                notes: "Use the tracked application context to shape the outreach path and warm-introduction angle.",
              })
            }
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-white"
          >
            {suggestedOutreachStrategy ? "Open outreach plan" : "Create outreach plan"}
          </button>
        ) : null}
        <p className="text-xs text-neutral-500">
          Updated {application.updated_at ? new Date(application.updated_at).toLocaleString() : "recently"}
        </p>
        {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} /> : null}
      </div>

      {showRoleDetails && (linkedCoverLetterTitle || linkedDossierTitle || linkedSalaryTitle || linkedFitTitle) ? (
        <div className="mt-2.5 rounded-xl border border-neutral-200 bg-white p-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Linked execution assets</div>
            <button
              type="button"
              onClick={() => setShowLinkedAssets((current) => !current)}
              className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
            >
              {showLinkedAssets ? "Hide" : "Show"}
            </button>
          </div>
          {showLinkedAssets ? (
            <div className="mt-1.5 grid gap-1.5 md:grid-cols-2 xl:grid-cols-4">
              {linkedCoverLetterTitle ? (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Cover letter</div>
                  <div className="mt-2 text-sm font-semibold text-neutral-900">{linkedCoverLetterTitle}</div>
                </div>
              ) : null}
              {linkedDossierTitle ? (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Company dossier</div>
                  <div className="mt-2 text-sm font-semibold text-neutral-900">{linkedDossierTitle}</div>
                </div>
              ) : null}
              {linkedSalaryTitle ? (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Salary analysis</div>
                  <div className="mt-2 text-sm font-semibold text-neutral-900">{linkedSalaryTitle}</div>
                </div>
              ) : null}
              {linkedFitTitle ? (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Fit analysis</div>
                  <div className="mt-2 text-sm font-semibold text-neutral-900">{linkedFitTitle}</div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-1.5 text-xs text-neutral-600">Linked assets are available. Expand to view details.</p>
          )}
        </div>
      ) : null}

      {showRoleDetails ? (
      <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Warm application plan</div>
          <button
            type="button"
            onClick={() => setShowWarmPlan((current) => !current)}
            className="rounded-full border border-sky-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-800 hover:bg-sky-100"
          >
            {showWarmPlan ? "Hide" : "Show"}
          </button>
        </div>
        {showWarmPlan ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <PlanCard title="Do first" body={warmPlan.doFirst} />
            <PlanCard title="Tighten before applying" body={warmPlan.tightenBeforeApplying} />
            <PlanCard title="Best asset to use" body={warmPlan.bestAssetToUse} />
            <PlanCard title="Decision" body={warmPlan.decision} />
          </div>
        ) : (
          <p className="mt-1.5 text-xs text-sky-900/80">Use this when you want a deeper decision checklist before applying.</p>
        )}
      </div>
      ) : null}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-0.5 block text-[13px] font-medium text-neutral-800">{label}</label>
      {children}
    </div>
  )
}

function formatStatus(status: string | null | undefined) {
  if (!status) return "Unknown"
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function statusBadgeClass(status: string | null | undefined) {
  switch (status) {
    case "offer":
      return "bg-emerald-100 text-emerald-700"
    case "final_round":
    case "interviewing":
      return "bg-sky-100 text-sky-700"
    case "applied":
    case "targeting":
      return "bg-amber-100 text-amber-800"
    case "rejected":
      return "bg-rose-100 text-rose-700"
    default:
      return "bg-neutral-200 text-neutral-700"
  }
}

function assetReadinessChipClass(ready: boolean) {
  return ready
    ? "border-emerald-100 bg-white text-emerald-700"
    : "border-neutral-200 bg-white text-neutral-400"
}

function TrackerMetricCard({ label, value, tone }: { label: string; value: string; tone: "neutral" | "warning" | "danger" | "success" }) {
  const toneClass =
    tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : tone === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-neutral-200 bg-neutral-50 text-neutral-700"

  return (
    <div className={`rounded-lg border px-2.5 py-1.5 ${toneClass}`}>
      <div className="text-[9px] font-semibold uppercase tracking-[0.12em]">{label}</div>
      <div className="mt-0.5 text-lg font-semibold leading-none">{value}</div>
    </div>
  )
}

function QuickStatusAdvanceButton({
  application,
  nextStatus,
  label,
}: {
  application: ApplicationRow
  nextStatus: string
  label: string
}) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  async function handleAdvance() {
    setLoading(true)
    setMessage("")

    try {
      const response = await fetch(`/api/career/applications/${application.id}`, {
        method: "PATCH",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          company_name: application.company_name,
          job_title: application.job_title,
          location: application.location,
          job_url: application.job_url,
          status: nextStatus,
          notes: application.notes,
          next_action: application.next_action,
          follow_up_date: application.follow_up_date,
          cover_letter_asset_id: application.cover_letter_asset_id,
          company_dossier_asset_id: application.company_dossier_asset_id,
          salary_analysis_asset_id: application.salary_analysis_asset_id,
          fit_analysis_asset_id: application.fit_analysis_asset_id,
        }),
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to advance application stage")
      }

      setMessage("Stage updated.")
      notifyCareerWorkspaceRefresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : careerActionErrorMessage("update the application stage"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => void handleAdvance()}
        disabled={loading || !application.company_name || !application.job_title}
        className="inline-flex rounded-full border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Updating..." : label}
      </button>
      {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} className="mt-2" /> : null}
    </div>
  )
}

function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10)
}

function getFollowUpState(followUpDate: string, status: string) {
  if (!followUpDate || ["offer", "rejected", "archived"].includes(status)) {
    return null
  }

  const todayKey = toDateKey(new Date())
  if (followUpDate < todayKey) {
    return {
      label: "Follow-up overdue",
      badgeClass: "bg-rose-100 text-rose-700",
    }
  }

  if (followUpDate === todayKey) {
    return {
      label: "Follow-up today",
      badgeClass: "bg-amber-100 text-amber-800",
    }
  }

  return {
    label: `Follow-up ${followUpDate}`,
    badgeClass: "bg-neutral-200 text-neutral-700",
  }
}

function suggestAssetForCompany(options: { id: string; title: string | null }[], companyName: string) {
  const normalizedCompany = normalizeCompanyName(companyName)
  if (!normalizedCompany) return null

  return options.find((asset) => normalizeCompanyName(asset.title || "").includes(normalizedCompany)) ?? null
}

function normalizeCompanyName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(limited|ltd|inc|corp|corporation|company|co|group|holdings)\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function getNextStatusOption(status: string | null | undefined) {
  const currentIndex = applicationStatuses.findIndex((option) => option.value === status)
  if (currentIndex === -1) return null
  return applicationStatuses[currentIndex + 1] ?? null
}

function extractFitScore(content: string) {
  const match = content.match(/(\d{1,3})\/100/)
  if (!match) return null

  const value = Number(match[1])
  if (!Number.isFinite(value)) return null
  return Math.max(0, Math.min(100, Math.round(value)))
}

function getFitDecision(score: number) {
  if (score >= 75) {
    return {
      label: "Strong fit",
      badgeClass: "bg-emerald-100 text-emerald-700",
      bucket: "strong" as const,
    }
  }

  if (score >= 50) {
    return {
      label: "Promising fit",
      badgeClass: "bg-amber-100 text-amber-800",
      bucket: "promising" as const,
    }
  }

  return {
    label: "Lower fit",
    badgeClass: "bg-neutral-200 text-neutral-700",
    bucket: "low" as const,
  }
}

function buildApplicationDecisionSummary(
  applications: ApplicationRow[],
  fitAnalysisContentById: Map<string, string>
) {
  const buckets = {
    strongFit: [] as Array<{ id: string; title: string; subtitle: string }>,
    promising: [] as Array<{ id: string; title: string; subtitle: string }>,
    lowFit: [] as Array<{ id: string; title: string; subtitle: string }>,
  }

  for (const application of applications) {
    const fitAnalysisId = application.fit_analysis_asset_id
    if (!fitAnalysisId) continue

    const score = extractFitScore(fitAnalysisContentById.get(fitAnalysisId) || "")
    if (score === null) continue

    const item = {
      id: application.id,
      title: `${application.company_name || "Untitled company"} - ${application.job_title || "Untitled role"}`,
      subtitle: `${score}/100 fit`,
    }

    const decision = getFitDecision(score)
    if (decision.bucket === "strong") {
      buckets.strongFit.push(item)
    } else if (decision.bucket === "promising") {
      buckets.promising.push(item)
    } else {
      buckets.lowFit.push(item)
    }
  }

  return buckets
}

function DecisionColumn({
  title,
  description,
  tone,
  items,
}: {
  title: string
  description: string
  tone: "success" | "warning" | "neutral"
  items: Array<{ id: string; title: string; subtitle: string }>
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50"
        : "border-neutral-200 bg-white"

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="font-semibold text-neutral-900">{title}</div>
      <p className="mt-2 text-sm leading-6 text-neutral-600">{description}</p>
      {items.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-neutral-500">No scored roles in this bucket yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.slice(0, 4).map((item) => (
            <div key={item.id} className="rounded-2xl border border-neutral-200 bg-white p-3">
              <div className="text-sm font-semibold text-neutral-900">{item.title}</div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">{item.subtitle}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PlanCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-sky-200 bg-white p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-sky-700">{title}</div>
      <p className="mt-2 text-sm leading-6 text-neutral-700">{body}</p>
    </div>
  )
}

function CampaignLane({
  steps,
  compact = false,
}: {
  steps: Array<{
    label: string
    complete: boolean
    active: boolean
    sectionKey: string
    href: string
    badge?: string
    note?: string
  }>
  compact?: boolean
}) {
  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-2 xl:grid-cols-5" : "md:grid-cols-5"}`}>
      {steps.map((step) => {
        const toneClass = step.complete
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : step.active
            ? "border-sky-200 bg-sky-50 text-sky-800"
            : "border-neutral-200 bg-neutral-50 text-neutral-500"

        return (
          <button
            key={step.label}
            type="button"
            onClick={() => navigateCareerWorkspace(step.sectionKey, step.href)}
            className={`rounded-2xl border px-3 py-3 text-left transition hover:shadow-sm ${toneClass}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                {step.complete ? "Ready" : step.active ? "Now" : "Next"}
              </div>
              {step.badge ? (
                <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                  {step.badge}
                </span>
              ) : null}
            </div>
            <div className="mt-2 text-sm font-semibold">{step.label}</div>
            {!compact && step.note ? <div className="mt-1 text-xs leading-5 text-current/80">{step.note}</div> : null}
          </button>
        )
      })}
    </div>
  )
}

function buildWarmApplicationPlan({
  fitScore,
  hasCoverLetter,
  hasDossier,
  hasSalaryAnalysis,
  nextAction,
}: {
  fitScore: number | null
  hasCoverLetter: boolean
  hasDossier: boolean
  hasSalaryAnalysis: boolean
  nextAction: string
}) {
  const normalizedNextAction = nextAction.trim()

  if (fitScore !== null && fitScore >= 75) {
    return {
      doFirst: normalizedNextAction || "Move quickly. Finalize the tailored cover letter and submit while the role still feels current.",
      tightenBeforeApplying: hasDossier ? "Mirror the employer language closely and make sure the strongest evidence is in the first half of the application." : "Create or refresh the company dossier so the application language feels more targeted.",
      bestAssetToUse: hasCoverLetter ? "Use the linked cover letter as the main execution asset and polish it rather than starting over." : "Generate a tailored cover letter now, because this role already looks like a strong match.",
      decision: "High-priority role. Push this one now.",
    }
  }

  if (fitScore !== null && fitScore >= 50) {
    return {
      doFirst: normalizedNextAction || "Tailor before committing. Strengthen the story for the most relevant achievements and proof points.",
      tightenBeforeApplying: hasDossier ? "Use the dossier to align tone and sharpen the opening case for fit." : "Generate a dossier first, then rewrite the opening pitch to feel more company-specific.",
      bestAssetToUse: hasCoverLetter ? "Start with the linked cover letter, but rewrite the first third so it speaks more directly to the role brief." : "Build a new targeted cover letter once the employer language and gaps are clearer.",
      decision: "Promising role. Worth pursuing, but improve the application before going all in.",
    }
  }

  return {
    doFirst: normalizedNextAction || "Pause and reassess whether this role deserves more effort right now.",
    tightenBeforeApplying: hasSalaryAnalysis ? "Use the salary analysis to decide if the opportunity is still worth pursuing once fit and reward are weighed together." : "Run salary analysis and fit review together before putting more time into this application.",
    bestAssetToUse: hasDossier ? "Use the dossier only if there is a strategic reason to keep the role alive, otherwise focus energy elsewhere." : "Do not over-invest in new assets until the fit story improves materially.",
    decision: "Lower-priority role. Keep it alive only if there is a strategic reason.",
  }
}

function buildComparisonRow({
  application,
  fitAnalysisContentById,
}: {
  application: ApplicationRow
  fitAnalysisContentById: Map<string, string>
}) {
  const fitScore = application.fit_analysis_asset_id ? extractFitScore(fitAnalysisContentById.get(application.fit_analysis_asset_id) || "") : null
  const fitDecision = fitScore !== null ? getFitDecision(fitScore) : null
  const urgency = getComparisonUrgency(application.follow_up_date || "", application.status || "")
  const warmPlan = buildWarmApplicationPlan({
    fitScore,
    hasCoverLetter: Boolean(application.cover_letter_asset_id),
    hasDossier: Boolean(application.company_dossier_asset_id),
    hasSalaryAnalysis: Boolean(application.salary_analysis_asset_id),
    nextAction: application.next_action || "",
  })

  return {
    id: application.id,
    role: application.job_title || "Untitled role",
    company: application.company_name || "Untitled company",
    fitScore,
    fitBadgeClass: fitDecision?.badgeClass || "bg-neutral-200 text-neutral-700",
    urgencyLabel: urgency.label,
    urgencyBadgeClass: urgency.badgeClass,
    salaryStatus: application.salary_analysis_asset_id ? "Covered" : "Not yet",
    decision: warmPlan.decision,
    nextMove: warmPlan.doFirst,
  }
}

function buildCampaignLane({
  status,
  hasDossier,
  hasOutreach,
  hasApplication,
  hasInterview,
  hasFollowUp,
  followUpDate,
}: {
  status: string | null | undefined
  hasDossier: boolean
  hasOutreach: boolean
  hasApplication: boolean
  hasInterview: boolean
  hasFollowUp: boolean
  followUpDate?: string | null
}) {
  const normalizedStatus = status || ""
  const followUpState = followUpDate ? getComparisonUrgency(followUpDate, normalizedStatus) : null

  return [
    {
      label: "Research",
      complete: hasDossier,
      active: !hasDossier,
      sectionKey: "company",
      href: "#current-company-dossiers",
      note: hasDossier ? "Dossier linked." : "No dossier linked yet.",
    },
    {
      label: "Outreach",
      complete: hasOutreach,
      active: hasDossier && !hasOutreach,
      sectionKey: "company",
      href: hasOutreach ? "#current-outreach-strategies" : "#outreach-strategy",
      note: hasOutreach ? "Outreach plan ready." : "No outreach plan yet.",
    },
    {
      label: "Apply",
      complete: hasApplication,
      active: hasDossier && (hasOutreach || ["targeting", "shortlisted", "applied"].includes(normalizedStatus)) && !hasApplication,
      sectionKey: "documents",
      href: "#document-workbench",
      note:
        normalizedStatus === "shortlisted"
          ? "Shortlisted role is ready for tailoring."
          : hasApplication
            ? "Application assets linked."
            : "Application step not fully prepared.",
    },
    {
      label: "Interview",
      complete: hasInterview,
      active: ["applied"].includes(normalizedStatus),
      sectionKey: "interview",
      href: "#current-interview-prep",
      note: hasInterview ? "Interview stage reached." : "Interview stage not reached yet.",
    },
    {
      label: "Follow-up",
      complete: hasFollowUp,
      active: ["interviewing", "final_round"].includes(normalizedStatus) || (hasApplication && !hasFollowUp),
      sectionKey: "documents",
      href: "#document-workbench",
      badge: followUpState?.label,
      note: hasFollowUp ? "A next action or follow-up date is set." : "No follow-up action is scheduled.",
    },
  ]
}

function getShortlistReadiness({
  fitScore,
  hasDossier,
  hasCoverLetter,
}: {
  fitScore: number | null
  hasDossier: boolean
  hasCoverLetter: boolean
}) {
  if ((fitScore === null || fitScore >= 75) && hasDossier && hasCoverLetter) {
    return {
      level: "ready" as const,
      label: "Ready to apply",
      badgeClass: "bg-emerald-100 text-emerald-700",
      cardClass: "border-emerald-200 bg-emerald-50",
    }
  }

  if ((fitScore === null || fitScore >= 50) && (hasDossier || hasCoverLetter)) {
    return {
      level: "tailor" as const,
      label: "Needs tailoring",
      badgeClass: "bg-amber-100 text-amber-800",
      cardClass: "border-amber-200 bg-amber-50",
    }
  }

  return {
    level: "research" as const,
    label: "Needs research",
    badgeClass: "bg-sky-100 text-sky-700",
    cardClass: "border-sky-200 bg-sky-50",
  }
}

function getRecommendedActionBanner({
  status,
  fitScore,
  hasDossier,
  hasCoverLetter,
  hasFollowUp,
}: {
  status: string
  fitScore: number | null
  hasDossier: boolean
  hasCoverLetter: boolean
  hasFollowUp: boolean
}): RecommendedActionBanner {
  if (status === "offer") {
    return {
      title: "Review the offer and capture the decision path.",
      body: "Record the key terms, compare them against the market, and note the next decision milestone.",
      badge: "Offer",
      badgeClass: "bg-emerald-100 text-emerald-700",
      cardClass: "border-emerald-200 bg-emerald-50",
      action: { kind: "details", label: "Add notes" },
    }
  }

  if (status === "interviewing" || status === "final_round") {
    return {
      title: hasFollowUp ? "Stay tight on interview follow-up." : "Set the next interview follow-up now.",
      body: hasFollowUp
        ? "The role is active. Keep prep, thank-you notes, and decision dates tightly managed."
        : "This role is already in motion, so add the next meeting date, prep task, or follow-up note now.",
      badge: "Interview",
      badgeClass: "bg-amber-100 text-amber-800",
      cardClass: "border-amber-200 bg-amber-50",
      action: { kind: "details", label: hasFollowUp ? "Review follow-up" : "Add follow-up" },
    }
  }

  if (status === "applied") {
    return {
      title: hasFollowUp ? "Application is out. Keep momentum." : "Application sent. Set a follow-up date.",
      body: hasFollowUp
        ? "The key job now is staying visible and prepared for the next reply."
        : "Do not leave this role hanging. Add a follow-up date or the next action while it is still fresh.",
      badge: "Applied",
      badgeClass: "bg-emerald-100 text-emerald-700",
      cardClass: "border-emerald-200 bg-emerald-50",
      action: { kind: "details", label: hasFollowUp ? "Review follow-up" : "Add follow-up" },
    }
  }

  if (status === "shortlisted") {
    return {
      title: hasDossier && hasCoverLetter ? "This shortlisted role is ready to move forward." : "Shortlisted role needs tailoring before it is sent.",
      body:
        hasDossier && hasCoverLetter
          ? "The core research and letter are in place. Review the final story, then move this role to applied when ready."
          : "Use the shortlist as a decision point. Build the dossier, tailor the letter, and only then push the application forward.",
      badge: "Shortlist",
      badgeClass: "bg-violet-100 text-violet-700",
      cardClass: "border-violet-200 bg-violet-50",
      action:
        hasDossier && hasCoverLetter
          ? { kind: "status", label: "Mark applied", status: "applied", message: "Role moved to applied." }
          : { kind: "navigate", label: "Create assets", sectionKey: "documents", href: "#document-workbench" },
    }
  }

  if (fitScore !== null && fitScore < 50) {
    return {
      title: "Recheck whether this role deserves more effort.",
      body: "The fit signal is weaker here, so pause before investing more time unless there is a strategic reason to continue.",
      badge: "Reassess",
      badgeClass: "bg-neutral-200 text-neutral-700",
      cardClass: "border-neutral-200 bg-white",
      action: { kind: "details", label: "Open details" },
    }
  }

  return {
    title: "Decide whether to prioritize this role.",
    body: hasDossier
      ? "The research base is started. Decide whether this should stay in consideration or move into the shortlist."
      : "Start with employer research so the next decision is based on stronger evidence and better language matching.",
    badge: "Next",
    badgeClass: "bg-sky-100 text-sky-700",
    cardClass: "border-sky-200 bg-sky-50",
    action: hasDossier
      ? { kind: "status", label: "Move to shortlist", status: "shortlisted", message: "Role moved to the priority shortlist." }
      : { kind: "navigate", label: "Research company", sectionKey: "company", href: "#company-dossier" },
  }
}

function buildShortlistGuidance(level: "ready" | "tailor" | "research", nextAction: string | null | undefined) {
  const normalizedNextAction = nextAction?.trim()
  if (normalizedNextAction) return normalizedNextAction

  if (level === "ready") {
    return "This role has enough support to move forward. Check the final tone, submit, and set a follow-up date."
  }

  if (level === "tailor") {
    return "The opportunity looks promising, but it still needs stronger company-specific tailoring before the application goes out."
  }

  return "Do not rush the application yet. Build the research base first so the application language is targeted and credible."
}

function compactStageGuidance(guidance: string | undefined) {
  if (!guidance) return "Set the stage that best matches the current reality."
  return guidance
    .replace(/^Use this when\s*/i, "")
    .replace(/^Use this once\s*/i, "")
    .replace(/^Use this for\s*/i, "")
    .replace(/^Interesting role,\s*/i, "")
    .replace(/\.\s*$/g, "")
    .trim()
}

function pipelineStageToneClass(status: string) {
  switch (status) {
    case "shortlisted":
      return "border-violet-200 bg-violet-50"
    case "applied":
      return "border-emerald-200 bg-emerald-50"
    case "interviewing":
    case "final_round":
      return "border-amber-200 bg-amber-50"
    case "offer":
      return "border-emerald-300 bg-emerald-100"
    case "on_hold":
      return "border-slate-200 bg-slate-50"
    case "rejected":
    case "archived":
      return "border-neutral-200 bg-neutral-100"
    default:
      return "border-sky-200 bg-sky-50"
  }
}

function getComparisonUrgency(followUpDate: string, status: string) {
  if (!followUpDate || ["offer", "rejected", "archived"].includes(status)) {
    return {
      label: "Normal",
      badgeClass: "bg-neutral-200 text-neutral-700",
    }
  }

  const todayKey = toDateKey(new Date())
  if (followUpDate < todayKey) {
    return {
      label: "Overdue",
      badgeClass: "bg-rose-100 text-rose-700",
    }
  }

  if (followUpDate === todayKey) {
    return {
      label: "Today",
      badgeClass: "bg-amber-100 text-amber-800",
    }
  }

  return {
    label: "Upcoming",
    badgeClass: "bg-sky-100 text-sky-700",
  }
}
