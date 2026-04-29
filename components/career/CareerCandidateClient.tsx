"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { useCallback, useEffect, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { CareerAssetEditor } from "@/components/career/CareerAssetEditor"
import { CareerApplicationTracker } from "@/components/career/CareerApplicationTracker"
import { CareerApplicationFitAnalyzer } from "@/components/career/CareerApplicationFitAnalyzer"
import { CareerApplicationSprint } from "@/components/career/CareerApplicationSprint"
import { CareerCourseRecommendations } from "@/components/career/CareerCourseRecommendations"
import { CareerDeepProspectResearch } from "@/components/career/CareerDeepProspectResearch"
import { CareerCompanyDossierGenerator } from "@/components/career/CareerCompanyDossierGenerator"
import { CareerGenerateAssetsButton } from "@/components/career/CareerGenerateAssetsButton"
import { CareerCoverLetterGenerator } from "@/components/career/CareerCoverLetterGenerator"
import { CareerGenerateProfileButton } from "@/components/career/CareerGenerateProfileButton"
import { CareerInterviewPrepGenerator } from "@/components/career/CareerInterviewPrepGenerator"
import { CareerInterviewReflectionForm } from "@/components/career/CareerInterviewReflectionForm"
import { CareerLiveJobFinder } from "@/components/career/CareerLiveJobFinder"
import { CareerOutreachStrategyGenerator } from "@/components/career/CareerOutreachStrategyGenerator"
import { CareerProfileJobSearchButton } from "@/components/career/CareerProfileJobSearchButton"
import { CareerProspectActionBoard } from "@/components/career/CareerProspectActionBoard"
import { CareerPremiumAutopilotPanel } from "@/components/career/CareerPremiumAutopilotPanel"
import { CareerRecruiterMatchSearch } from "@/components/career/CareerRecruiterMatchSearch"
import { CareerSalaryAnalyzer } from "@/components/career/CareerSalaryAnalyzer"
import { CareerSourceSetupWizard } from "@/components/career/CareerSourceSetupWizard"
import { CareerSourceDocumentEditor } from "@/components/career/CareerSourceDocumentEditor"
import { CareerStrategicDocumentGenerator } from "@/components/career/CareerStrategicDocumentGenerator"
import { CareerTargetCompanyWorkflow } from "@/components/career/CareerTargetCompanyWorkflow"
import { AdaptiveProductTour } from "@/components/navigation/AdaptiveProductTour"
import { PlatformModuleNav } from "@/components/navigation/PlatformModuleNav"
import { WelcomeBackNotice } from "@/components/navigation/WelcomeBackNotice"
import {
  CAREER_WORKSPACE_NAVIGATE_EVENT,
  CAREER_WORKSPACE_REFRESH_EVENT,
  CAREER_WORKSPACE_TARGET_EVENT,
  getAuthHeaders,
  navigateCareerWorkspace,
  notifyCareerWorkspaceRefresh,
  retryCareerBackgroundJob,
  retryCareerLiveJobRun,
  setCareerWorkspaceTarget,
} from "@/lib/career-client"
import { getAuthProviderLabel } from "@/lib/auth-provider"
import { CAREER_SOURCE_PREP_STEPS } from "@/lib/career-workflow"
import { supabase } from "@/lib/supabase"

type CandidateRow = {
  id: string
  full_name: string | null
  city: string | null
  primary_goal: string | null
  created_at: string | null
}

type DocumentRow = {
  id: string
  source_type: string | null
  title: string | null
  content_text: string | null
  created_at: string | null
}

type ProfileRow = {
  id: string
  profile_version: number | null
  career_identity: string | null
  market_positioning: string | null
  seniority_level: string | null
  core_strengths: string[] | null
  signature_achievements: string[] | null
  role_families: string[] | null
  skills: string[] | null
  risks_or_gaps: string[] | null
  recommended_target_roles: string[] | null
  created_at: string | null
}

type AssetRow = {
  id: string
  asset_type: string | null
  version: number | null
  title: string | null
  content: string | null
  created_at: string | null
}

type ParsedLiveOpportunity = {
  title: string
  company: string
  location: string
  whyFit: string
  applyUrl: string
}

type WorkspaceResponse = {
  candidate: CandidateRow
  documents: DocumentRow[]
  profiles: ProfileRow[]
  assets: AssetRow[]
  liveJobRuns: LiveJobRunRow[]
  backgroundJobs: BackgroundJobRow[]
  applications: ApplicationRow[]
}

type LiveJobRunRow = {
  id: string
  target_role: string | null
  location: string | null
  market_notes: string | null
  status: string | null
  error_message: string | null
  result_asset_id: string | null
  created_at: string | null
  started_at: string | null
  completed_at: string | null
}

type BackgroundJobRow = {
  id: string
  job_type: string | null
  request_payload: Record<string, unknown> | null
  status: string | null
  result_summary: string | null
  error_message: string | null
  created_at: string | null
  started_at: string | null
  completed_at: string | null
}

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
  previewOwnerUserId?: string | null
}

const CAREER_ACTIVE_WORKSPACE_URL_KEY = "personara-career-active-workspace-url"
const CAREER_ACTIVE_CANDIDATE_ID_KEY = "personara-career-active-candidate-id"

function normalizeTrackedRoleField(value: string | null | undefined) {
  return (value || "").trim().toLowerCase()
}

function applicationMatchesOpportunity(application: ApplicationRow, opportunity: ParsedLiveOpportunity) {
  const sameCompany = normalizeTrackedRoleField(application.company_name) === normalizeTrackedRoleField(opportunity.company)
  const sameTitle = normalizeTrackedRoleField(application.job_title) === normalizeTrackedRoleField(opportunity.title)
  const isClosed = ["offer", "rejected", "archived"].includes(application.status ?? "")
  return sameCompany && sameTitle && !isClosed
}

export function CareerCandidateClient({ candidateId, previewOwnerUserId = null }: Props) {
  const [session, setSession] = useState<Session | null>(null)
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null)
  const [message, setMessage] = useState("")
  const [trackerMessage, setTrackerMessage] = useState("")
  const [savedSearch, setSavedSearch] = useState("")
  const [savedAssetTypeFilter, setSavedAssetTypeFilter] = useState("all")
  const [activeStep, setActiveStep] = useState("workflow")
  const [activeMode, setActiveMode] = useState("plan")
  const [activeAnchor, setActiveAnchor] = useState("#workflow-guide")
  const [isFocusMode, setIsFocusMode] = useState(true)
  const [isMenuRolledUp, setIsMenuRolledUp] = useState(true)
  const [isContextRailOpen, setIsContextRailOpen] = useState(false)
  const [showStepGuidance, setShowStepGuidance] = useState(false)
  const [showWorkflowMap, setShowWorkflowMap] = useState(false)
  const [showAdvancedTools, setShowAdvancedTools] = useState(false)
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false)
  const [showPriorityDetails, setShowPriorityDetails] = useState(false)
  const [isTodayAtGlanceExpanded, setIsTodayAtGlanceExpanded] = useState(false)
  const [showRecentFilesDetails, setShowRecentFilesDetails] = useState(false)
  const [savingOpportunityKey, setSavingOpportunityKey] = useState<string | null>(null)
  const [quickSavedApplicationIds, setQuickSavedApplicationIds] = useState<string[]>([])
  const [quickSavedOpportunityStatuses, setQuickSavedOpportunityStatuses] = useState<Record<string, "targeting" | "shortlisted">>({})
  const [openGuideHintId, setOpenGuideHintId] = useState<string | null>(null)
  const [isWorkflowGuideExpanded, setIsWorkflowGuideExpanded] = useState(false)
  const [isGuidedMode, setIsGuidedMode] = useState(() => {
    if (typeof window === "undefined") return true
    const stored = window.localStorage.getItem(`career-guided-mode-${candidateId}`)
    return stored ? stored === "1" : true
  })
  const [toast, setToast] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(null)
  const [savePulse, setSavePulse] = useState<{ id: number; label: string } | null>(null)
  const [hasSeenSetupCelebration, setHasSeenSetupCelebration] = useState(() => {
    if (typeof window === "undefined") return false
    return window.localStorage.getItem(`career-first-five-celebrated-${candidateId}`) === "1"
  })
  const [isSavedWorkExpanded, setIsSavedWorkExpanded] = useState(false)
  const [isFindSavedWorkExpanded, setIsFindSavedWorkExpanded] = useState(false)
  const [showSourceSecondaryPanels, setShowSourceSecondaryPanels] = useState(false)
  const [showDocumentSecondaryPanels, setShowDocumentSecondaryPanels] = useState(false)
  const [showJobsSecondaryPanels, setShowJobsSecondaryPanels] = useState(false)
  const [isMyFilesDrawerOpen, setIsMyFilesDrawerOpen] = useState(false)
  const [isReportIssueOpen, setIsReportIssueOpen] = useState(false)
  const [issueType, setIssueType] = useState("Workflow confusion")
  const [issueDetail, setIssueDetail] = useState("")
  const [issueContactEmail, setIssueContactEmail] = useState("")
  const [manualOutputChecks, setManualOutputChecks] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {}
    try {
      const raw = window.localStorage.getItem(`career-manual-output-checks-${candidateId}`)
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
    } catch {
      return {}
    }
  })
  const [focusedApplicationId, setFocusedApplicationId] = useState(() => {
    if (typeof window === "undefined") return ""
    return window.localStorage.getItem(`career-workspace-target-${candidateId}`) || ""
  })
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    workflow: false,
    source: false,
    positioning: false,
    documents: false,
    company: false,
    interview: false,
    jobs: false,
  })
  const [showSectionContext, setShowSectionContext] = useState<Record<string, boolean>>({
    source: false,
    positioning: false,
    documents: false,
    company: false,
    interview: false,
    jobs: false,
  })
  const [expandedLeftSections, setExpandedLeftSections] = useState<Record<string, boolean>>({
    workflow: false,
    source: false,
    positioning: false,
    documents: false,
    company: false,
    interview: false,
    jobs: false,
  })
  const [quickSettingsOpen, setQuickSettingsOpen] = useState(false)
  const [didAutoRouteOnboarding, setDidAutoRouteOnboarding] = useState(false)

  const showToast = useCallback((nextToast: { tone: "success" | "error" | "info"; message: string }) => {
    setToast(nextToast)
    if (nextToast.tone === "success" && typeof window !== "undefined") {
      const label =
        /saved/i.test(nextToast.message)
          ? "Saved just now"
          : /updated|created|generated|queued|started|running/i.test(nextToast.message)
            ? "Updated just now"
            : "Success"
      const pulseId = Date.now()
      setSavePulse({ id: pulseId, label })
      window.setTimeout(() => {
        setSavePulse((current) => (current?.id === pulseId ? null : current))
      }, 2600)
    }
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        setToast((current) => (current?.message === nextToast.message ? null : current))
      }, 3200)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const currentHref = `${window.location.pathname}${window.location.search || ""}`
    const workspaceHref = currentHref.startsWith(`/career/${candidateId}`) ? currentHref : `/career/${candidateId}`
    window.localStorage.setItem(CAREER_ACTIVE_WORKSPACE_URL_KEY, workspaceHref)
    window.localStorage.setItem(CAREER_ACTIVE_CANDIDATE_ID_KEY, candidateId)
  }, [candidateId])

  const loadWorkspace = useCallback(async () => {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession()

    setSession(currentSession)

    if (!currentSession?.access_token) {
      return
    }

    const response = await fetch(`/api/career/candidates/${candidateId}`, {
      headers: await getAuthHeaders(),
    })
    const json = await response.json()

    if (!response.ok) {
      const errorMessage = json.error || "Failed to load workspace"
      setMessage(errorMessage)
      showToast({ tone: "error", message: errorMessage })
      return
    }

    setMessage("")
    setWorkspace(json as WorkspaceResponse)
  }, [candidateId, showToast])

  const openSectionsFor = useCallback((sectionKey: string) => ({
    workflow: sectionKey === "workflow",
    source: sectionKey === "source",
    positioning: sectionKey === "positioning",
    documents: sectionKey === "documents",
    company: sectionKey === "company",
    interview: sectionKey === "interview",
    jobs: sectionKey === "jobs",
  }), [])

  const openAndScroll = useCallback((sectionKey: string, href: string) => {
    const nextMode =
      sectionKey === "workflow" || sectionKey === "source" || sectionKey === "positioning"
        ? "plan"
        : sectionKey === "documents" || sectionKey === "company" || sectionKey === "interview"
          ? "build"
          : sectionKey === "jobs"
            ? "apply"
            : "plan"
    setActiveMode(nextMode)
    setActiveStep(sectionKey)
    setActiveAnchor(href)
    if (href === "#saved-library") {
      setIsSavedWorkExpanded(true)
    }
    if (href === "#current-application-documents" || href === "#current-cover-letters") {
      setShowDocumentSecondaryPanels(true)
    }
    if (href === "#current-company-dossiers" || href === "#current-outreach-strategies") {
      setShowSectionContext((current) => ({ ...current, company: true }))
    }
    if (href === "#current-interview-prep" || href === "#recent-interview-assessments") {
      setShowSectionContext((current) => ({ ...current, interview: true }))
    }
    if (
      href === "#deep-prospect-research" ||
      href === "#recruiter-match-search" ||
      href === "#salary-analysis" ||
      href === "#fit-analysis" ||
      href === "#current-live-opportunities" ||
      href === "#current-recruiter-match-searches" ||
      href === "#current-salary-analysis" ||
      href === "#current-fit-analysis"
    ) {
      setShowJobsSecondaryPanels(true)
    }
    setOpenSections(openSectionsFor(sectionKey))
    setIsMenuRolledUp(true)

    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        const target = document.querySelector(href)
        if (target instanceof HTMLElement) {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              const stickyNav =
                document.querySelector("#career-workspace-root nav") ||
                document.querySelector('[data-sticky-nav="true"]')
              let stickyOffset = 172
              if (stickyNav instanceof HTMLElement) {
                const stickyTop = Number.parseFloat(window.getComputedStyle(stickyNav).top || "0")
                stickyOffset = Math.ceil(stickyNav.getBoundingClientRect().height + stickyTop + 20)
              }

              const top = window.scrollY + target.getBoundingClientRect().top - stickyOffset
              window.scrollTo({ top: Math.max(0, top), behavior: "smooth" })
              target.classList.add("ring-2", "ring-sky-300", "ring-offset-2", "transition-shadow", "duration-300")
              window.setTimeout(() => {
                target.classList.remove("ring-2", "ring-sky-300", "ring-offset-2", "transition-shadow", "duration-300")
              }, 1300)
            })
          })
        }
      }, 180)
    }
  }, [openSectionsFor])

  const openSavedAsset = useCallback((asset: AssetRow, options?: { closeMyFilesDrawer?: boolean }) => {
    const target = getSectionTargetForAssetType(asset.asset_type)
    if (asset.asset_type) {
      setSavedAssetTypeFilter(asset.asset_type)
    }
    setIsSavedWorkExpanded(true)
    if (target.sectionKey === "documents") {
      setIsFindSavedWorkExpanded(true)
    }
    if (options?.closeMyFilesDrawer) {
      setIsMyFilesDrawerOpen(false)
    }
    openAndScroll(target.sectionKey, target.href)
  }, [openAndScroll])

  const revealLeftSection = useCallback((sectionKey: string, shouldExpand = true) => {
    setExpandedLeftSections((current) => {
      const next = { ...current }
      const activeKey = sectionKey as keyof typeof next
      ;(Object.keys(next) as Array<keyof typeof next>).forEach((key) => {
        next[key] = key === activeKey ? shouldExpand : false
      })
      return next
    })
  }, [])

  const activateLeftNavigation = useCallback((sectionKey: string, href: string) => {
    const isSameTarget = activeStep === sectionKey && activeAnchor === href
    const sectionKeyTyped = sectionKey as keyof typeof expandedLeftSections
    const isExpanded = Boolean(expandedLeftSections[sectionKeyTyped])

    if (isSameTarget && isExpanded) {
      revealLeftSection(sectionKey, false)
      return
    }

    revealLeftSection(sectionKey, true)
    openAndScroll(sectionKey, href)
  }, [activeAnchor, activeStep, expandedLeftSections, openAndScroll, revealLeftSection])

  useEffect(() => {
    revealLeftSection(activeStep, true)
  }, [activeStep, revealLeftSection])

  useEffect(() => {
    void Promise.resolve().then(loadWorkspace)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    const handleWorkspaceRefresh = () => {
      void loadWorkspace()
    }

    const handleWorkspaceNavigate = (event: Event) => {
      const detail = (event as CustomEvent<{ sectionKey?: string; href?: string }>).detail
      if (!detail?.sectionKey || !detail?.href) return
      openAndScroll(detail.sectionKey, detail.href)
    }

    const handleWorkspaceTarget = (event: Event) => {
      const detail = (event as CustomEvent<{ applicationId?: string }>).detail
      const nextId = detail?.applicationId || ""
      setFocusedApplicationId(nextId)

      if (typeof window !== "undefined") {
        if (nextId) {
          window.localStorage.setItem(`career-workspace-target-${candidateId}`, nextId)
        } else {
          window.localStorage.removeItem(`career-workspace-target-${candidateId}`)
        }
      }
    }

    if (typeof window !== "undefined") {
      window.addEventListener(CAREER_WORKSPACE_REFRESH_EVENT, handleWorkspaceRefresh)
      window.addEventListener(CAREER_WORKSPACE_NAVIGATE_EVENT, handleWorkspaceNavigate)
      window.addEventListener(CAREER_WORKSPACE_TARGET_EVENT, handleWorkspaceTarget)
    }

    return () => {
      subscription.unsubscribe()
      if (typeof window !== "undefined") {
        window.removeEventListener(CAREER_WORKSPACE_REFRESH_EVENT, handleWorkspaceRefresh)
        window.removeEventListener(CAREER_WORKSPACE_NAVIGATE_EVENT, handleWorkspaceNavigate)
        window.removeEventListener(CAREER_WORKSPACE_TARGET_EVENT, handleWorkspaceTarget)
      }
    }
  }, [candidateId, loadWorkspace, openAndScroll])

  useEffect(() => {
    if (!workspace) {
      return
    }

    const activeRuns = workspace.liveJobRuns.filter((run) => run.status === "queued" || run.status === "running")
    const activeBackgroundJobs = workspace.backgroundJobs.filter((job) => job.status === "queued" || job.status === "running")
    if ((activeRuns.length === 0 && activeBackgroundJobs.length === 0) || typeof window === "undefined") {
      return
    }

    const timeout = window.setTimeout(() => {
      void loadWorkspace()
    }, 5000)

    return () => window.clearTimeout(timeout)
  }, [loadWorkspace, workspace])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(`career-guided-mode-${candidateId}`, isGuidedMode ? "1" : "0")
  }, [candidateId, isGuidedMode])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(`career-manual-output-checks-${candidateId}`, JSON.stringify(manualOutputChecks))
  }, [candidateId, manualOutputChecks])

  useEffect(() => {
    if (!openGuideHintId || typeof window === "undefined") return

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Element | null
      if (target?.closest("[data-guide-hint-root='true']")) return
      setOpenGuideHintId(null)
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenGuideHintId(null)
      }
    }

    window.addEventListener("mousedown", handlePointerDown)
    window.addEventListener("touchstart", handlePointerDown, { passive: true })
    window.addEventListener("keydown", handleEscape)

    return () => {
      window.removeEventListener("mousedown", handlePointerDown)
      window.removeEventListener("touchstart", handlePointerDown)
      window.removeEventListener("keydown", handleEscape)
    }
  }, [openGuideHintId])

  useEffect(() => {
    if (!session?.user?.email) return
    setIssueContactEmail((current) => current || session.user.email || "")
  }, [session?.user?.email])

  useEffect(() => {
    setOpenSections(openSectionsFor(activeStep))
  }, [activeStep, openSectionsFor])

  useEffect(() => {
    revealLeftSection(activeStep)
  }, [activeStep, revealLeftSection])

  useEffect(() => {
    if (!workspace || didAutoRouteOnboarding) return
    const latestProfile = workspace.profiles[0]
    const hasProfile = Boolean(latestProfile)
    const hasCv = workspace.documents.some((doc) => doc.source_type === "cv")
    const hasGallupStrengths = workspace.documents.some((doc) => doc.source_type === "gallup_strengths" || doc.source_type === "strengths")
    const hasDraftDocuments = workspace.assets.length > 0
    const hasLiveSearch = workspace.assets.some((asset) => asset.asset_type === "live_job_search")
    const showOnboardingGuide = !hasCv || !hasGallupStrengths || !hasProfile
    if (!showOnboardingGuide) return
    const firstFiveChecklist = [
      { sectionKey: "source", href: "#source-material", done: hasCv },
      { sectionKey: "source", href: "#source-material", done: hasGallupStrengths },
      { sectionKey: "positioning", href: "#generate-profile", done: hasProfile },
      { sectionKey: "documents", href: "#document-workbench", done: hasDraftDocuments },
      { sectionKey: "jobs", href: "#live-job-search", done: hasLiveSearch },
    ] as const
    const nextStep = firstFiveChecklist.find((item) => !item.done)
    if (!nextStep) return
    setDidAutoRouteOnboarding(true)
    setIsGuidedMode(true)
    setShowStepGuidance(true)
    setIsFocusMode(true)
    setIsMenuRolledUp(true)
    openAndScroll(nextStep.sectionKey, nextStep.href)
  }, [didAutoRouteOnboarding, openAndScroll, workspace])

  if (!session?.user) {
    return (
      <main className="min-h-screen bg-neutral-50 text-neutral-900">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold">Sign in required</h1>
            <p className="mt-2 text-sm text-neutral-600">Sign in on the main Persona Foundry page first, then reopen this candidate workspace.</p>
            <Link href="/" className="mt-4 inline-flex rounded-xl bg-black px-4 py-2 text-sm font-medium text-white">
              Go to homepage
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (message && !workspace) {
    return (
      <main className="min-h-screen bg-neutral-50 text-neutral-900">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold">Career Intelligence workspace</h1>
            <p className="mt-2 text-sm text-rose-700">{message}</p>
            <Link href="/career" className="mt-4 inline-flex rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium">
              Back to Career Intelligence
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (!workspace) {
    return (
      <main className="min-h-screen bg-neutral-50 text-neutral-900">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm text-sm text-neutral-600">Loading workspace...</div>
        </div>
      </main>
    )
  }

  const { candidate, documents, profiles, assets, liveJobRuns, backgroundJobs, applications } = workspace
  const authProviderBadge = getAuthProviderLabel(session?.user)

  async function handleSwitchAccount() {
    setIsSwitchingAccount(true)
    await supabase.auth.signOut()
    if (typeof window !== "undefined") {
      window.location.href = "/platform"
    }
  }
  const latestProfile = profiles[0]
  const latestDraftsByType = new Map<string, AssetRow>()
  const latestCoverLetters: AssetRow[] = []
  const latestInterviewPrep: AssetRow[] = []
  const latestLiveJobSearches: AssetRow[] = []
  const latestDeepProspectResearch: AssetRow[] = []
  const latestOutreachStrategies: AssetRow[] = []
  const latestRecruiterMatchSearches: AssetRow[] = []
  const latestSalaryAnalysis: AssetRow[] = []
  const latestFitAnalysis: AssetRow[] = []
  const latestCourseRecommendations: AssetRow[] = []
  const companyDossiers = assets.filter((asset) => asset.asset_type === "company_dossier")
  const latestCompanyDossiers: AssetRow[] = []
  const draftHistory = assets.filter(
    (asset) =>
      asset.asset_type !== "cover_letter" &&
      asset.asset_type !== "interview_prep" &&
      asset.asset_type !== "live_job_search" &&
      asset.asset_type !== "deep_prospect_research" &&
      asset.asset_type !== "company_dossier" &&
      asset.asset_type !== "outreach_strategy" &&
      asset.asset_type !== "recruiter_match_search" &&
      asset.asset_type !== "salary_analysis" &&
      asset.asset_type !== "application_fit_analysis" &&
      asset.asset_type !== "course_recommendations"
  )
  const coverLetterHistory = assets.filter((asset) => asset.asset_type === "cover_letter")
  const interviewPrepHistory = assets.filter((asset) => asset.asset_type === "interview_prep")
  const liveJobSearchHistory = assets.filter((asset) => asset.asset_type === "live_job_search")
  const deepProspectResearchHistory = assets.filter((asset) => asset.asset_type === "deep_prospect_research")
  const outreachStrategyHistory = assets.filter((asset) => asset.asset_type === "outreach_strategy")
  const recruiterMatchSearchHistory = assets.filter((asset) => asset.asset_type === "recruiter_match_search")
  const salaryAnalysisHistory = assets.filter((asset) => asset.asset_type === "salary_analysis")
  const fitAnalysisHistory = assets.filter((asset) => asset.asset_type === "application_fit_analysis")
  const courseRecommendationHistory = assets.filter((asset) => asset.asset_type === "course_recommendations")
  const activeLiveJobRuns = liveJobRuns.filter((run) => run.status === "queued" || run.status === "running")
  const activeBackgroundJobs = backgroundJobs.filter((job) => job.status === "queued" || job.status === "running")
  const isBackgroundJobRunning = (...jobTypes: string[]) => activeBackgroundJobs.some((job) => jobTypes.includes(job.job_type || ""))
  const latestApplicationSprintJob = backgroundJobs.find((job) => job.job_type === "generate_application_sprint") ?? null
  const latestTargetCompanyWorkflowJob = backgroundJobs.find((job) => job.job_type === "generate_target_company_workflow") ?? null
  const latestInterviewPrepJob = backgroundJobs.find((job) => job.job_type === "generate_interview_prep") ?? null
  const latestApplicationSprintPayload = latestApplicationSprintJob?.request_payload ?? null
  const latestApplicationSprintJobTitle =
    typeof latestApplicationSprintPayload?.job_title === "string" ? latestApplicationSprintPayload.job_title : ""
  const latestApplicationSprintCompany =
    typeof latestApplicationSprintPayload?.company_name === "string" ? latestApplicationSprintPayload.company_name : ""
  const sprintRelatedApplication =
    applications.find((application) => {
      if (!latestApplicationSprintJob) return false
      const sameTitle = latestApplicationSprintJobTitle
        ? (application.job_title || "").trim().toLowerCase() === latestApplicationSprintJobTitle.trim().toLowerCase()
        : true
      const sameCompany = latestApplicationSprintCompany
        ? (application.company_name || "").trim().toLowerCase() === latestApplicationSprintCompany.trim().toLowerCase()
        : true
      return sameTitle && sameCompany
    }) ?? null

  for (const asset of assets) {
    if (asset.asset_type === "cover_letter") {
      if (latestCoverLetters.length === 0) {
        latestCoverLetters.push(asset)
      }
      continue
    }

    if (asset.asset_type === "interview_prep") {
      if (latestInterviewPrep.length === 0) {
        latestInterviewPrep.push(asset)
      }
      continue
    }

    if (asset.asset_type === "live_job_search") {
      if (latestLiveJobSearches.length === 0) {
        latestLiveJobSearches.push(asset)
      }
      continue
    }

    if (asset.asset_type === "deep_prospect_research") {
      if (latestDeepProspectResearch.length === 0) {
        latestDeepProspectResearch.push(asset)
      }
      continue
    }

    if (asset.asset_type === "salary_analysis") {
      if (latestSalaryAnalysis.length === 0) {
        latestSalaryAnalysis.push(asset)
      }
      continue
    }

    if (asset.asset_type === "outreach_strategy") {
      if (latestOutreachStrategies.length === 0) {
        latestOutreachStrategies.push(asset)
      }
      continue
    }

    if (asset.asset_type === "recruiter_match_search") {
      if (latestRecruiterMatchSearches.length === 0) {
        latestRecruiterMatchSearches.push(asset)
      }
      continue
    }

    if (asset.asset_type === "application_fit_analysis") {
      if (latestFitAnalysis.length === 0) {
        latestFitAnalysis.push(asset)
      }
      continue
    }

    if (asset.asset_type === "course_recommendations") {
      if (latestCourseRecommendations.length === 0) {
        latestCourseRecommendations.push(asset)
      }
      continue
    }

    if (asset.asset_type === "company_dossier") {
      if (latestCompanyDossiers.length === 0) {
        latestCompanyDossiers.push(asset)
      }
      continue
    }

    if (asset.asset_type && !latestDraftsByType.has(asset.asset_type)) {
      latestDraftsByType.set(asset.asset_type, asset)
    }
  }

  const applicationSprintChecklist = [
    {
      key: "dossier",
      label: "Company intelligence",
      complete: Boolean(latestCompanyDossiers[0]),
      sectionKey: "company",
      href: "#current-company-dossiers",
    },
    {
      key: "fit",
      label: "Fit analysis",
      complete: Boolean(latestFitAnalysis[0]),
      sectionKey: "jobs",
      href: "#current-fit-analysis",
    },
    {
      key: "salary",
      label: "Salary analysis",
      complete: Boolean(latestSalaryAnalysis[0]),
      sectionKey: "jobs",
      href: "#current-salary-analysis",
    },
    {
      key: "cover-letter",
      label: "Cover letter",
      complete: Boolean(latestCoverLetters[0]),
      sectionKey: "documents",
      href: "#current-cover-letters",
    },
    {
      key: "interview",
      label: "Interview prep",
      complete: Boolean(latestInterviewPrep[0]),
      sectionKey: "interview",
      href: "#current-interview-prep",
    },
  ]

  const hasCv = documents.some((doc) => doc.source_type === "cv")
  const hasGallupStrengths = documents.some((doc) => doc.source_type === "gallup_strengths" || doc.source_type === "strengths")
  const hasLinkedIn = documents.some((doc) => doc.source_type === "linkedin")
  const hasCoverLetterExamples = documents.some((doc) => doc.source_type === "cover_letter")
  const latestCvName = documents.find((doc) => doc.source_type === "cv")?.title?.trim() || ""
  const latestStrengthsName =
    documents.find((doc) => doc.source_type === "gallup_strengths" || doc.source_type === "strengths")?.title?.trim() || ""
  const latestLinkedInName = documents.find((doc) => doc.source_type === "linkedin")?.title?.trim() || ""
  const keySourceNames = [latestCvName, latestStrengthsName, latestLinkedInName].filter((name): name is string => Boolean(name))
  const fallbackRecentSourceNames = documents
    .map((doc) => doc.title?.trim() || "")
    .filter((name): name is string => Boolean(name))
  const loadedSourceNames = keySourceNames.length > 0 ? keySourceNames : fallbackRecentSourceNames
  const loadedSourceSummaryLabel =
    loadedSourceNames.length === 0
      ? `${documents.length} loaded`
      : loadedSourceNames.length <= 2
        ? loadedSourceNames.join(" | ")
        : `${loadedSourceNames.slice(0, 2).join(" | ")} +${loadedSourceNames.length - 2}`
  const loadedSourceSummaryTitle = loadedSourceNames.length > 0 ? loadedSourceNames.join(" | ") : ""
  const strengthSourceText = documents
    .filter((doc) => doc.source_type === "gallup_strengths" || doc.source_type === "strengths")
    .map((doc) => doc.content_text || "")
    .join("\n")
  const inferredStrengthThemes = extractGallupStrengthThemes({
    profileStrengths: latestProfile?.core_strengths || [],
    sourceText: strengthSourceText,
  })
  const topStrengthThemes = inferredStrengthThemes.slice(0, 3)
  const candidateFirstName = (candidate.full_name || "there").trim().split(/\s+/)[0] || "there"
  const hasStrengthThemes = topStrengthThemes.length > 0
  const strengthsSummary = hasStrengthThemes ? formatThemeList(topStrengthThemes) : "your unique strengths profile"
  const strengthWorkflowStyle = inferStrengthWorkflowStyle(topStrengthThemes)
  const strengthWorkflowLabel = getStrengthWorkflowLabel(strengthWorkflowStyle)
  const personalizedWelcomeMessage = hasStrengthThemes
    ? `${candidateFirstName}, this workspace is tuned to themes like ${strengthsSummary}. Guidance adapts as you move through each step.`
    : "Add your Gallup Strengths report to unlock more personalized coaching language across profile, documents, and interview preparation."
  const activeStepStrengthNudges = {
    workflow: hasStrengthThemes
      ? `Use ${strengthsSummary} as your decision filter: keep what feels true to your natural style, and simplify what does not.`
      : "Once Gallup Strengths is added, this guide will adapt its advice to your style in each step.",
    source: hasStrengthThemes
      ? `When loading files, prioritize examples that best demonstrate ${strengthsSummary}. This improves narrative quality quickly.`
      : "Add Gallup Strengths early. It is the highest-leverage input for better tone and stronger personalization.",
    positioning: hasStrengthThemes
      ? `Shape your positioning story around ${strengthsSummary}, then anchor each theme with a clear proof point.`
      : "Generate the profile after loading strengths so your narrative sounds specific, not generic.",
    documents: hasStrengthThemes
      ? `Keep your CV and letter language consistent with ${strengthsSummary} so your value feels coherent across assets.`
      : "Use this section after profile generation so your assets inherit a clearer personal narrative.",
    company: hasStrengthThemes
      ? `Use company research to translate ${strengthsSummary} into their language, while keeping your authentic voice intact.`
      : "Company dossier and tone matching become stronger after strengths are loaded.",
    interview: hasStrengthThemes
      ? `Frame interview stories around moments where ${strengthsSummary} directly drove measurable outcomes.`
      : "Interview answers improve once strengths are loaded and connected to concrete achievements.",
    jobs: hasStrengthThemes
      ? `Prioritize roles where ${strengthsSummary} is genuinely valued in the role expectations and culture signals.`
      : "Use market tools now, then refine fit decisions again once Gallup Strengths is loaded.",
  } as const
  const activeStrengthNudge =
    activeStepStrengthNudges[activeStep as keyof typeof activeStepStrengthNudges] ?? activeStepStrengthNudges.workflow
  const interviewReflections = documents.filter((doc) => doc.source_type === "interview_reflection")
  const latestInterviewReflections = interviewReflections.slice(0, 3)
  const sourceChecklist = [
    {
      label: "Current CV",
      ready: hasCv,
      hint: hasCv ? "Factual career baseline is loaded." : "Still missing the main career baseline document.",
      tone: hasCv ? "success" as const : "warning" as const,
    },
    {
      label: "Gallup Strengths",
      ready: hasGallupStrengths,
      hint: hasGallupStrengths ? "Engine-room strengths input is loaded." : "Still missing the strongest tone and strengths input.",
      tone: hasGallupStrengths ? "success" as const : "warning" as const,
    },
    {
      label: "LinkedIn profile",
      ready: hasLinkedIn,
      hint: hasLinkedIn ? "Public-facing positioning proof is loaded." : "Add LinkedIn text to strengthen outward-facing positioning.",
      tone: hasLinkedIn ? "success" as const : "info" as const,
    },
    {
      label: "Supporting proof",
      ready: hasCoverLetterExamples || documents.length >= 4,
      hint: hasCoverLetterExamples || documents.length >= 4 ? "The workspace has additional proof and examples." : "Add old letters, recruiter notes, achievements, or target-role notes.",
      tone: hasCoverLetterExamples || documents.length >= 4 ? "success" as const : "info" as const,
    },
  ]
  const sourcePrepItems = [
    {
      label: "CV or resume",
      status: hasCv ? "Ready" : "Have ready",
      detail: "Use the latest version with role history, dates, achievements, and qualifications.",
      ready: hasCv,
    },
    {
      label: "Gallup Strengths",
      status: hasGallupStrengths ? "Ready" : "Best input",
      detail: "Upload the full report if available. This is the highest-value input after the CV and gives the whole workspace a stronger strengths-led voice.",
      ready: hasGallupStrengths,
    },
    {
      label: "LinkedIn profile",
      status: hasLinkedIn ? "Ready" : "Prepare text",
      detail: "Best: download your LinkedIn profile PDF. Or paste your headline, About, Experience, and Skills text.",
      ready: hasLinkedIn,
    },
    {
      label: "Useful examples",
      status: hasCoverLetterExamples || documents.length >= 4 ? "Ready" : "Optional",
      detail: "Old cover letters, recruiter feedback, achievements, target roles, and notes all improve tailoring.",
      ready: hasCoverLetterExamples || documents.length >= 4,
    },
  ]
  const sourcePackStrength =
    hasCv && hasGallupStrengths && hasLinkedIn && (hasCoverLetterExamples || documents.length >= 4)
      ? "High"
      : hasCv && hasGallupStrengths && (hasLinkedIn || documents.length >= 3)
        ? "Medium"
        : "Low"
  const sourceDocsByType = new Map<string, number>()
  for (const doc of documents) {
    const key = doc.source_type || "notes"
    sourceDocsByType.set(key, (sourceDocsByType.get(key) ?? 0) + 1)
  }
  const hasProfile = Boolean(latestProfile)
  const hasDraftDocuments = draftHistory.length > 0
  const hasGeneratedAssets = assets.length > 0
  const hasLiveSearch = liveJobSearchHistory.length > 0
  const showOnboardingGuide = !hasCv || !hasGallupStrengths || !hasProfile
  const firstFiveChecklist = [
    {
      key: "cv",
      label: "Load CV",
      done: hasCv,
      sectionKey: "source",
      href: "#source-material",
    },
    {
      key: "strengths",
      label: "Load Gallup Strengths",
      done: hasGallupStrengths,
      sectionKey: "source",
      href: "#source-material",
    },
    {
      key: "profile",
      label: "Generate profile",
      done: hasProfile,
      sectionKey: "positioning",
      href: "#generate-profile",
    },
    {
      key: "assets",
      label: hasGeneratedAssets ? "Review saved assets" : "Create first CV + LinkedIn assets",
      done: hasGeneratedAssets,
      sectionKey: "documents",
      href: hasGeneratedAssets ? "#saved-library" : "#base-asset-generator",
    },
    {
      key: "jobs",
      label: "Run live job search",
      done: hasLiveSearch,
      sectionKey: "jobs",
      href: "#live-job-search",
    },
  ]
  const firstFiveCompleteCount = firstFiveChecklist.filter((item) => item.done).length
  const firstFiveRemainingCount = Math.max(firstFiveChecklist.length - firstFiveCompleteCount, 0)
  const isWizardFocusActive = isGuidedMode && showStepGuidance
  const isFirstTimeMinimalMode = showOnboardingGuide && firstFiveCompleteCount <= 3
  const firstFiveNextItem = firstFiveChecklist.find((item) => !item.done) ?? null
  const isFirstFiveComplete = firstFiveCompleteCount === firstFiveChecklist.length
  const showSetupCelebration = isFirstFiveComplete && !hasSeenSetupCelebration
  const dismissSetupCelebration = () => {
    setHasSeenSetupCelebration(true)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`career-first-five-celebrated-${candidateId}`, "1")
    }
  }
  const hasOutreachStrategy = outreachStrategyHistory.length > 0
  const keyOutputChecklist = [
    {
      id: "profile",
      label: "Profile",
      systemDone: hasProfile,
      done: hasProfile || Boolean(manualOutputChecks.profile),
      count: hasProfile ? 1 : 0,
      sectionKey: "positioning",
      href: "#positioning",
    },
    {
      id: "dossier",
      label: "Company dossier",
      systemDone: companyDossiers.length > 0,
      done: companyDossiers.length > 0 || Boolean(manualOutputChecks.dossier),
      count: companyDossiers.length,
      sectionKey: "company",
      href: companyDossiers.length > 0 ? "#current-company-dossiers" : "#company-dossier",
    },
    {
      id: "cover_letter",
      label: "Cover letter",
      systemDone: coverLetterHistory.length > 0,
      done: coverLetterHistory.length > 0 || Boolean(manualOutputChecks.cover_letter),
      count: coverLetterHistory.length,
      sectionKey: "documents",
      href: coverLetterHistory.length > 0 ? "#current-cover-letters" : "#document-actions",
    },
    {
      id: "fit_analysis",
      label: "Fit analysis",
      systemDone: fitAnalysisHistory.length > 0,
      done: fitAnalysisHistory.length > 0 || Boolean(manualOutputChecks.fit_analysis),
      count: fitAnalysisHistory.length,
      sectionKey: "jobs",
      href: fitAnalysisHistory.length > 0 ? "#current-fit-analysis" : "#fit-analysis",
    },
    {
      id: "salary_analysis",
      label: "Salary analysis",
      systemDone: salaryAnalysisHistory.length > 0,
      done: salaryAnalysisHistory.length > 0 || Boolean(manualOutputChecks.salary_analysis),
      count: salaryAnalysisHistory.length,
      sectionKey: "jobs",
      href: salaryAnalysisHistory.length > 0 ? "#current-salary-analysis" : "#salary-analysis",
    },
    {
      id: "interview_prep",
      label: "Interview prep",
      systemDone: interviewPrepHistory.length > 0,
      done: interviewPrepHistory.length > 0 || Boolean(manualOutputChecks.interview_prep),
      count: interviewPrepHistory.length,
      sectionKey: "interview",
      href: interviewPrepHistory.length > 0 ? "#current-interview-prep" : "#interview",
    },
  ] as const
  const outputCompletionItems = [
    {
      id: "cv-linkedin",
      label: "CV + LinkedIn",
      count: draftHistory.length,
      running: isBackgroundJobRunning("generate_assets"),
      sectionKey: "documents",
      href: draftHistory.length > 0 ? "#current-application-documents" : "#base-asset-generator",
    },
    {
      id: "dossier",
      label: "Company dossier",
      count: companyDossiers.length,
      running: isBackgroundJobRunning("generate_company_dossier", "generate_target_company_workflow", "generate_application_sprint"),
      sectionKey: "company",
      href: companyDossiers.length > 0 ? "#current-company-dossiers" : "#company-dossier",
    },
    {
      id: "cover-letter",
      label: "Cover letter",
      count: coverLetterHistory.length,
      running: isBackgroundJobRunning("generate_cover_letter", "generate_target_company_workflow", "generate_application_sprint"),
      sectionKey: "documents",
      href: coverLetterHistory.length > 0 ? "#current-cover-letters" : "#document-actions",
    },
    {
      id: "fit",
      label: "Fit analysis",
      count: fitAnalysisHistory.length,
      running: isBackgroundJobRunning("generate_application_fit_analysis", "generate_application_sprint"),
      sectionKey: "jobs",
      href: fitAnalysisHistory.length > 0 ? "#current-fit-analysis" : "#fit-analysis",
    },
    {
      id: "salary",
      label: "Salary view",
      count: salaryAnalysisHistory.length,
      running: isBackgroundJobRunning("generate_salary_analysis", "generate_application_sprint"),
      sectionKey: "jobs",
      href: salaryAnalysisHistory.length > 0 ? "#current-salary-analysis" : "#salary-analysis",
    },
    {
      id: "interview",
      label: "Interview prep",
      count: interviewPrepHistory.length,
      running: isBackgroundJobRunning("generate_interview_prep", "generate_target_company_workflow", "generate_application_sprint"),
      sectionKey: "interview",
      href: interviewPrepHistory.length > 0 ? "#current-interview-prep" : "#interview",
    },
  ] as const
  function getOutputMissingLabel(item: (typeof outputCompletionItems)[number]) {
    switch (item.id) {
      case "cv-linkedin":
        return "Needs base drafts"
      case "dossier":
        return "Needs company research"
      case "cover-letter":
        return "Needs tailored letter"
      case "fit":
        return "Needs fit check"
      case "salary":
        return "Needs salary check"
      case "interview":
        return "Needs interview prep"
      default:
        return "Needs setup"
    }
  }

  function getOutputActionLabel(item: (typeof outputCompletionItems)[number]) {
    if (item.running) return "Open running work"
    if (item.count > 0) {
      switch (item.id) {
        case "cv-linkedin":
          return "Open drafts"
        case "dossier":
          return "Open dossier"
        case "cover-letter":
          return "Open letter"
        case "fit":
          return "Open fit check"
        case "salary":
          return "Open salary view"
        case "interview":
          return "Open interview prep"
        default:
          return "Open output"
      }
    }
    switch (item.id) {
      case "cv-linkedin":
        return "Create drafts"
      case "dossier":
        return "Create dossier"
      case "cover-letter":
        return "Create letter"
      case "fit":
        return "Run fit check"
      case "salary":
        return "Run salary check"
      case "interview":
        return "Create prep"
      default:
        return "Open next step"
    }
  }

  const outputReadyCount = outputCompletionItems.filter((item) => item.count > 0).length
  const runningOutputItem = outputCompletionItems.find((item) => item.running) ?? null
  const nextMissingOutputItem = outputCompletionItems.find((item) => item.count === 0 && !item.running) ?? null
  const nextOutputPromptItem = runningOutputItem ?? nextMissingOutputItem
  const completedBackgroundJobs = backgroundJobs
    .filter((job) => job.status === "completed")
    .map((job) => ({
      job,
      timestamp: Date.parse(job.completed_at || job.started_at || job.created_at || "") || 0,
    }))
    .sort((a, b) => b.timestamp - a.timestamp)
  const latestCompletedBackgroundJob = completedBackgroundJobs[0]?.job ?? null
  const latestCompletedOutputTarget = latestCompletedBackgroundJob
    ? getResultAnchorForBackgroundJob(latestCompletedBackgroundJob.job_type)
    : null
  const latestCompletedOutputFollowUp = latestCompletedBackgroundJob
    ? getFollowUpActionForBackgroundJob(latestCompletedBackgroundJob.job_type)
    : null
  const latestCompletedOutputOpenLabel = latestCompletedBackgroundJob
    ? getOpenOutputLabelForBackgroundJob(latestCompletedBackgroundJob.job_type)
    : "Open output"
  const latestCompletedOutputTime =
    latestCompletedBackgroundJob?.completed_at ||
    latestCompletedBackgroundJob?.started_at ||
    latestCompletedBackgroundJob?.created_at ||
    null
  const activeApplications = applications.filter((application) => {
    const status = application.status ?? ""
    return !["offer", "rejected", "archived"].includes(status)
  })
  const todayKey = new Date().toISOString().slice(0, 10)
  const overdueApplications = activeApplications.filter((application) => {
    if (!application.follow_up_date) return false
    return application.follow_up_date < todayKey
  })
  const dueTodayApplications = activeApplications.filter((application) => application.follow_up_date === todayKey)
  const normalizedSavedSearch = savedSearch.trim().toLowerCase()
  const savedLibraryAssetTypes = [
    "all",
    ...new Set(
      assets
        .map((asset) => asset.asset_type)
        .filter((assetType): assetType is string => Boolean(assetType))
    ),
  ]
  const filteredSavedAssets = assets.filter((asset) => {
    const matchesType = savedAssetTypeFilter === "all" || asset.asset_type === savedAssetTypeFilter
    const haystack = [asset.title, asset.asset_type, asset.content]
      .filter((value): value is string => Boolean(value))
      .join(" ")
      .toLowerCase()
    const matchesSearch = !normalizedSavedSearch || haystack.includes(normalizedSavedSearch)
    return matchesType && matchesSearch
  })
  const recentSavedAssets = filteredSavedAssets.slice(0, 3)
  const latestSavedAsset = recentSavedAssets[0] ?? null
  const latestSavedAssetTarget = latestSavedAsset ? getSectionTargetForAssetType(latestSavedAsset.asset_type) : null
  const filteredLatestSavedAssets = filteredSavedAssets.slice(0, 8)
  const suggestedTargetRole =
    latestProfile?.recommended_target_roles?.[0] ||
    latestProfile?.career_identity ||
    candidate.primary_goal ||
    ""
  const supportingTargetRoles = (latestProfile?.recommended_target_roles ?? []).slice(1, 5)
  const focusedApplication = applications.find((application) => application.id === focusedApplicationId) ?? null
  const preferredApplication = focusedApplication ?? activeApplications[0] ?? applications[0] ?? null
  const currentTargetBrief = {
    jobTitle:
      preferredApplication?.job_title ||
      latestApplicationSprintJobTitle ||
      suggestedTargetRole,
    companyName:
      preferredApplication?.company_name ||
      latestApplicationSprintCompany ||
      "",
    companyWebsite:
      typeof latestApplicationSprintPayload?.company_website === "string" ? latestApplicationSprintPayload.company_website : "",
    location:
      preferredApplication?.location ||
      (typeof latestApplicationSprintPayload?.location === "string" ? latestApplicationSprintPayload.location : "") ||
      candidate.city ||
      "",
    jobUrl:
      preferredApplication?.job_url ||
      (typeof latestApplicationSprintPayload?.job_url === "string" ? latestApplicationSprintPayload.job_url : "") ||
      "",
    jobDescription:
      typeof latestApplicationSprintPayload?.job_description === "string" ? latestApplicationSprintPayload.job_description : "",
    notes:
      (typeof latestApplicationSprintPayload?.notes === "string" ? latestApplicationSprintPayload.notes : "") ||
      preferredApplication?.notes ||
      "",
  }
  const hasTargetRole = Boolean(currentTargetBrief.jobTitle || currentTargetBrief.companyName)
  const targetSummaryTitle = hasTargetRole
    ? [currentTargetBrief.jobTitle || "Target role", currentTargetBrief.companyName].filter(Boolean).join(" | ")
    : "Choose your target role"
  const targetSourceLabel = focusedApplication
    ? "Using role from your application tracker"
    : preferredApplication
      ? "Using your latest active role"
      : "Set a target role to personalize outputs"
  const targetStatusBadgeLabel = focusedApplication
    ? "Tracker-selected role"
    : preferredApplication
      ? "Auto-picked live role"
      : "No live role selected"
  const targetStageLabel = preferredApplication?.status ? preferredApplication.status.replaceAll("_", " ") : targetStatusBadgeLabel
  const currentTargetQuickLinks = [
    {
      label: "Dossier",
      value: latestCompanyDossiers[0] ? "Ready" : "Create",
      sectionKey: "company",
      href: latestCompanyDossiers[0] ? "#current-company-dossiers" : "#company-dossier",
      tone: "company" as const,
    },
    {
      label: "Cover letter",
      value: latestCoverLetters[0] ? "Ready" : "Create",
      sectionKey: "documents",
      href: latestCoverLetters[0] ? "#current-cover-letters" : "#document-actions",
      tone: "documents" as const,
    },
    {
      label: "Fit",
      value: latestFitAnalysis[0] ? "Ready" : "Create",
      sectionKey: "jobs",
      href: latestFitAnalysis[0] ? "#current-fit-analysis" : "#fit-analysis",
      tone: "jobs" as const,
    },
    {
      label: "Salary",
      value: latestSalaryAnalysis[0] ? "Ready" : "Create",
      sectionKey: "jobs",
      href: latestSalaryAnalysis[0] ? "#current-salary-analysis" : "#salary-analysis",
      tone: "jobs" as const,
    },
    {
      label: "Recruiter",
      value: latestRecruiterMatchSearches[0] ? "Ready" : "Create",
      sectionKey: "jobs",
      href: latestRecruiterMatchSearches[0] ? "#current-recruiter-match-searches" : "#recruiter-match-search",
      tone: "jobs" as const,
    },
    {
      label: "Interview",
      value: latestInterviewPrep[0] ? "Ready" : "Create",
      sectionKey: "interview",
      href: latestInterviewPrep[0] ? "#current-interview-prep" : "#interview",
      tone: "interview" as const,
    },
  ]
  const campaignLane = buildWorkspaceCampaignLane({
    hasResearch: companyDossiers.length > 0 || deepProspectResearchHistory.length > 0,
    hasOutreach: hasOutreachStrategy,
    hasApplicationAssets: coverLetterHistory.length > 0 || hasDraftDocuments,
    hasApplications: applications.length > 0,
    hasInterviewReadiness: interviewPrepHistory.length > 0 || interviewReflections.length > 0,
    hasFollowUpMotion:
      activeApplications.some((application) => Boolean(application.follow_up_date || application.next_action)) ||
      overdueApplications.length > 0 ||
      dueTodayApplications.length > 0,
    researchCount: companyDossiers.length + deepProspectResearchHistory.length,
    outreachCount: outreachStrategyHistory.length,
    applicationCount: applications.length,
    interviewCount: interviewPrepHistory.length + interviewReflections.length,
    overdueFollowUpCount: overdueApplications.length,
    dueTodayFollowUpCount: dueTodayApplications.length,
  })
  const simpleWorkflowSteps = [
    {
      id: "prepare",
      title: "1. Prepare inputs",
      description: "Load the CV, Gallup Strengths, LinkedIn, and supporting proof.",
      ready: hasCv && hasGallupStrengths && (hasLinkedIn || hasCoverLetterExamples || documents.length >= 3),
      sectionKey: "source",
      href: "#source-material",
      actionLabel: hasCv && hasGallupStrengths ? "Open inputs" : "Load inputs",
    },
    {
      id: "position",
      title: "2. Build the narrative",
      description: "Generate the core positioning brief so the story is clear before drafting assets.",
      ready: hasProfile,
      sectionKey: "positioning",
      href: "#positioning",
      actionLabel: hasProfile ? "Review narrative" : "Generate narrative",
    },
    {
      id: "tailor",
      title: "3. Create CV + LinkedIn assets",
      description: "Generate base CV and LinkedIn drafts before tailoring anything to a role.",
      ready: hasDraftDocuments || coverLetterHistory.length > 0 || companyDossiers.length > 0,
      sectionKey: "documents",
      href: "#document-workbench",
      actionLabel: "Open assets",
    },
    {
      id: "apply",
      title: "4. Track and follow up",
      description: "Shortlist roles, apply, and manage next actions from one tracker.",
      ready: applications.length > 0,
      sectionKey: "documents",
      href: "#document-workbench",
      actionLabel: applications.length > 0 ? "Open tracker" : "Start tracking",
    },
  ]
  const applicationFlowSteps = [
    {
      id: "choose-role",
      title: "Choose the role",
      description: applications.length > 0 ? "A tracked role already exists in the workspace." : "Use live search or shortlist a role first.",
      ready: applications.length > 0 || liveJobSearchHistory.length > 0,
      sectionKey: applications.length > 0 ? "documents" : "jobs",
      href: applications.length > 0 ? "#document-workbench" : "#current-live-opportunities",
      actionLabel: applications.length > 0 ? "Open tracker" : "Open live roles",
    },
    {
      id: "research-company",
      title: "Research the company",
      description: companyDossiers.length > 0 ? "A company dossier is already saved." : "Create a dossier so the tone and language match the employer.",
      ready: companyDossiers.length > 0,
      sectionKey: "company",
      href: companyDossiers.length > 0 ? "#current-company-dossiers" : "#company-dossier",
      actionLabel: companyDossiers.length > 0 ? "Open dossiers" : "Create dossier",
    },
    {
      id: "tailor-letter",
      title: "Tailor the application",
      description: coverLetterHistory.length > 0 ? "A cover letter already exists and can be refined." : "Generate a tailored cover letter and connect it to the tracked role.",
      ready: coverLetterHistory.length > 0,
      sectionKey: "documents",
      href: coverLetterHistory.length > 0 ? "#current-cover-letters" : "#document-actions",
      actionLabel: coverLetterHistory.length > 0 ? "Open letters" : "Create letter",
    },
    {
      id: "submit-follow-up",
      title: "Submit and follow up",
      description:
        activeApplications.some((application) => Boolean(application.follow_up_date || application.next_action))
          ? "The workspace already has follow-up motion."
          : "Set a next action or follow-up date once the application goes out.",
      ready: activeApplications.some((application) => Boolean(application.follow_up_date || application.next_action)),
      sectionKey: "documents",
      href: "#document-workbench",
      actionLabel: "Open tracker",
    },
  ]
  const focusedRoleHealthSteps = [
    {
      id: "role",
      label: "Role selected",
      done: Boolean(preferredApplication?.job_title || currentTargetBrief.jobTitle),
      sectionKey: applications.length > 0 ? "documents" : "jobs",
      href: applications.length > 0 ? "#document-workbench" : "#live-job-search",
      actionLabel: applications.length > 0 ? "Open tracker" : "Search live roles",
      missingMessage: "Choose or focus a live role so the rest of the workspace has a clear target.",
    },
    {
      id: "dossier",
      label: "Company dossier",
      done: Boolean(latestCompanyDossiers[0]),
      sectionKey: "company",
      href: latestCompanyDossiers[0] ? "#current-company-dossiers" : "#company-dossier",
      actionLabel: latestCompanyDossiers[0] ? "Open dossier" : "Create dossier",
      missingMessage: "Build employer intelligence so the tone, messaging, and positioning match the company.",
    },
    {
      id: "letter",
      label: "Cover letter",
      done: Boolean(latestCoverLetters[0]),
      sectionKey: "documents",
      href: latestCoverLetters[0] ? "#current-cover-letters" : "#document-actions",
      actionLabel: latestCoverLetters[0] ? "Open letter" : "Create letter",
      missingMessage: "Generate or refine the tailored cover letter for this role before sending the application.",
    },
    {
      id: "fit",
      label: "Fit analysis",
      done: Boolean(latestFitAnalysis[0]),
      sectionKey: "jobs",
      href: latestFitAnalysis[0] ? "#current-fit-analysis" : "#fit-analysis",
      actionLabel: latestFitAnalysis[0] ? "Open fit analysis" : "Score fit",
      missingMessage: "Score the role so the user knows whether this opportunity deserves more energy.",
    },
    {
      id: "salary",
      label: "Salary view",
      done: Boolean(latestSalaryAnalysis[0]),
      sectionKey: "jobs",
      href: latestSalaryAnalysis[0] ? "#current-salary-analysis" : "#salary-analysis",
      actionLabel: latestSalaryAnalysis[0] ? "Open salary analysis" : "Check salary",
      missingMessage: "Check likely compensation and negotiation angle before investing deeper or accepting an offer.",
    },
    {
      id: "interview",
      label: "Interview prep",
      done: Boolean(latestInterviewPrep[0]),
      sectionKey: "interview",
      href: latestInterviewPrep[0] ? "#current-interview-prep" : "#interview",
      actionLabel: latestInterviewPrep[0] ? "Open prep" : "Create prep",
      missingMessage: "Build interview prep once the role is moving so the candidate can rehearse with specificity.",
    },
  ]
  const focusedRoleHealthPercent = safePercent(
    focusedRoleHealthSteps.filter((step) => step.done).length,
    Math.max(focusedRoleHealthSteps.length, 1)
  )
  const topReadinessItems = [
    {
      label: "Inputs",
      ready: hasCv && hasGallupStrengths,
      readyText: "CV + Gallup loaded",
      nextText: "Load CV + Gallup",
      sectionKey: "source",
      href: "#source-material",
    },
    {
      label: "Narrative",
      ready: hasProfile,
      readyText: "Profile generated",
      nextText: "Generate profile",
      sectionKey: "positioning",
      href: "#positioning",
    },
    {
      label: "Execution",
      ready: hasDraftDocuments || coverLetterHistory.length > 0 || applications.length > 0,
      readyText: "Assets/tracker active",
      nextText: "Create assets",
      sectionKey: "documents",
      href: "#document-workbench",
    },
  ] as const
  const focusedRoleHealthTone =
    focusedRoleHealthPercent >= 85 ? "success" : focusedRoleHealthPercent >= 50 ? "info" : "warning"
  const preparationSteps = [
    {
      id: CAREER_SOURCE_PREP_STEPS[0].id,
      title: CAREER_SOURCE_PREP_STEPS[0].title,
      description: CAREER_SOURCE_PREP_STEPS[0].description,
      done: hasCv,
      href: "#source-material",
      sectionKey: "source",
      actionLabel: CAREER_SOURCE_PREP_STEPS[0].actionLabel,
    },
    {
      id: CAREER_SOURCE_PREP_STEPS[1].id,
      title: CAREER_SOURCE_PREP_STEPS[1].title,
      description: CAREER_SOURCE_PREP_STEPS[1].description,
      done: hasGallupStrengths,
      href: "#source-material",
      sectionKey: "source",
      actionLabel: CAREER_SOURCE_PREP_STEPS[1].actionLabel,
    },
    {
      id: CAREER_SOURCE_PREP_STEPS[2].id,
      title: CAREER_SOURCE_PREP_STEPS[2].title,
      description: CAREER_SOURCE_PREP_STEPS[2].description,
      done: hasLinkedIn || hasCoverLetterExamples || documents.length >= 3,
      href: "#source-material",
      sectionKey: "source",
      actionLabel: CAREER_SOURCE_PREP_STEPS[2].actionLabel,
    },
    {
      id: "positioning",
      title: "Generate career positioning",
      description: "Turn the source material into a reusable positioning pack before creating outward-facing assets.",
      done: hasProfile,
      href: "#generate-profile",
      sectionKey: "positioning",
      actionLabel: "Generate positioning",
    },
    {
      id: "documents",
      title: "Generate documents",
      description: "Create CV, LinkedIn, cover letter, interview, and strategy outputs once the positioning is strong.",
      done: hasDraftDocuments || coverLetterHistory.length > 0 || interviewPrepHistory.length > 0,
      href: "#document-actions",
      sectionKey: "documents",
      actionLabel: "Open document tools",
    },
    {
      id: "company",
      title: "Research target companies",
      description: "Build a company dossier before writing role-specific letters so the language can match the employer more closely.",
      done: assets.some((asset) => asset.asset_type === "company_dossier"),
      href: "#company-dossier",
      sectionKey: "company",
      actionLabel: "Open company research",
    },
    {
      id: "jobs",
      title: "Search live opportunities",
      description: "Run live job search after the positioning and documents are ready to support tailored applications.",
      done: hasLiveSearch,
      href: "#live-job-search",
      sectionKey: "jobs",
      actionLabel: "Open live jobs",
    },
  ]
  const prioritizedPreparationSteps = [...preparationSteps].sort((a, b) => {
    const aPriority = getWorkflowStepPriority(strengthWorkflowStyle, a.id)
    const bPriority = getWorkflowStepPriority(strengthWorkflowStyle, b.id)

    if (a.done !== b.done) return a.done ? 1 : -1
    if (aPriority !== bPriority) return aPriority - bPriority
    return preparationSteps.findIndex((step) => step.id === a.id) - preparationSteps.findIndex((step) => step.id === b.id)
  })
  const strengthOrderedNextSteps = prioritizedPreparationSteps.filter((step) => !step.done).slice(0, 3)
  const nextUndoneStep = strengthOrderedNextSteps[0] ?? null
  const workflowPrimaryAction =
    nextUndoneStep ??
    simpleWorkflowSteps.find((step) => !step.ready) ??
    simpleWorkflowSteps[0] ??
    null

  const completionCount = preparationSteps.filter((step) => step.done).length
  const workflowModes = [
    { key: "plan", label: "Get ready", sections: ["workflow", "source", "positioning"] },
    { key: "build", label: "Create", sections: ["documents", "company", "interview"] },
    { key: "apply", label: "Apply", sections: ["jobs"] },
    { key: "review", label: "Review", sections: ["workflow", "documents", "jobs"] },
  ] as const
  const modeSections: Record<string, string[]> = workflowModes.reduce((acc, mode) => {
    acc[mode.key] = [...mode.sections]
    return acc
  }, {} as Record<string, string[]>)
  const quickLinks = [
    {
      href: "#workflow-guide",
      sectionKey: "workflow",
      label: isFirstFiveComplete ? "Overview" : "Start",
      description: isFirstFiveComplete
        ? "Review momentum, saved outputs, and the next best action."
        : "See what matters now and follow the easiest next step.",
    },
    { href: "#source-material", sectionKey: "source", label: "Add files", description: "Add CV, Gallup Strengths, LinkedIn, and supporting notes." },
    { href: "#positioning", sectionKey: "positioning", label: "Create profile", description: "Turn your files into a clear professional story and target roles." },
    { href: "#document-workbench", sectionKey: "documents", label: "Create CV + LinkedIn", description: "Generate base CV and LinkedIn drafts, then tailor to a role when ready." },
    { href: "#company-dossier", sectionKey: "company", label: "Research companies", description: "Research target employers so tone and messaging fit better." },
    { href: "#interview", sectionKey: "interview", label: "Practice interviews", description: "Prepare answers and save notes after real interviews." },
    { href: "#jobs", sectionKey: "jobs", label: "Search jobs", description: "Run job search, recruiter search, salary checks, and fit checks." },
  ]
  const activeModeSections = modeSections[activeMode] ?? modeSections.plan
  const menuQuickLinks = quickLinks
  const activeWorkflowLink =
    menuQuickLinks.find((link) => link.sectionKey === activeStep) ??
    quickLinks.find((link) => link.sectionKey === activeStep) ??
    menuQuickLinks[0] ??
    quickLinks[0]
  const activeWorkflowStepLabel = cleanWorkflowLabel(activeWorkflowLink?.label || "Start")
  const sectionSubmenuLinks: Record<string, Array<{ label: string; sectionKey: string; href: string }>> = {
    workflow: [
      { label: "Saved files", sectionKey: "documents", href: "#saved-library" },
    ],
    source: [
      { label: "Add files", sectionKey: "source", href: "#source-material" },
      { label: "View source files", sectionKey: "source", href: "#source-material" },
    ],
    positioning: [
      { label: "Create profile", sectionKey: "positioning", href: "#generate-profile" },
      { label: "View profile", sectionKey: "positioning", href: "#positioning" },
      { label: "Learning plan", sectionKey: "positioning", href: "#current-course-recommendations" },
    ],
    documents: [
      { label: "Generate base assets", sectionKey: "documents", href: "#base-asset-generator" },
      { label: "Tailor to a role", sectionKey: "documents", href: "#target-role-tracker" },
      { label: "Saved documents", sectionKey: "documents", href: "#current-application-documents" },
      { label: "Cover letters", sectionKey: "documents", href: "#current-cover-letters" },
    ],
    company: [
      { label: "Company research", sectionKey: "company", href: "#company-dossier" },
      { label: "Outreach plan", sectionKey: "company", href: "#outreach-strategy" },
      { label: "Saved dossiers", sectionKey: "company", href: "#current-company-dossiers" },
    ],
    interview: [
      { label: "Practice tools", sectionKey: "interview", href: "#interview" },
      { label: "Saved interview prep", sectionKey: "interview", href: "#current-interview-prep" },
      { label: "Interview notes", sectionKey: "interview", href: "#recent-interview-assessments" },
    ],
    jobs: [
      { label: "Start search", sectionKey: "jobs", href: "#live-job-search" },
      { label: "Saved opportunities", sectionKey: "jobs", href: "#current-live-opportunities" },
      { label: "Salary check", sectionKey: "jobs", href: latestSalaryAnalysis[0] ? "#current-salary-analysis" : "#salary-analysis" },
      { label: "Fit check", sectionKey: "jobs", href: latestFitAnalysis[0] ? "#current-fit-analysis" : "#fit-analysis" },
    ],
  }
  const activeSectionSubmenuLinks = sectionSubmenuLinks[activeStep] ?? []
  const activeSectionRawLabel = quickLinks.find((link) => link.sectionKey === activeStep)?.label || "Start here"
  const activeSectionLabel = cleanWorkflowLabel(activeSectionRawLabel)
  const activeSubsectionLabel =
    activeSectionSubmenuLinks.find((item) => item.href === activeAnchor)?.label ||
    activeSectionSubmenuLinks[0]?.label ||
    "Overview"
  const activeStepIndex = Math.max(0, quickLinks.findIndex((link) => link.sectionKey === activeStep))
  const canGoPrevStep = activeStepIndex > 0
  const canGoNextStep = activeStepIndex < quickLinks.length - 1
  const showWorkflowSecondary = (!isFocusMode || showAdvancedTools) && !isGuidedMode
  const hideWorkspaceMenuInFocus = isFocusMode && activeStep !== "workflow"
  const showFirstFiveCompact = !showAdvancedTools
  const showApplicationWorkspacePanel = isFirstFiveComplete && !showOnboardingGuide
  const showTargetRoleDetails = !isMenuRolledUp || !isFocusMode || showAdvancedTools
  const sourceRemainingCount = sourceChecklist.filter((item) => !item.ready).length
  const sourceWizardFocusMode = openSections.source && sourceRemainingCount > 0 && !showAdvancedTools
  const hideWorkspaceGuideToggle = activeStep === "source" && sourceWizardFocusMode
  const showSourceSupplementary = isGuidedMode
    ? showSourceSecondaryPanels
    : !sourceWizardFocusMode || showSourceSecondaryPanels
  const workflowMapSections = menuQuickLinks.map((link) => ({
    ...link,
    items: sectionSubmenuLinks[link.sectionKey] ?? [],
  }))

  const sectionActionGuides = {
    source: {
      statusLabel: hasCv && hasGallupStrengths ? "Ready for narrative" : "Needs input",
      summary:
        hasCv && hasGallupStrengths
          ? "The engine-room inputs are in place. Add any extra proof or move into the positioning brief."
          : "Load the CV and Gallup Strengths first so the rest of the workspace has a strong baseline.",
      actionLabel: hasCv && hasGallupStrengths ? "Review source library" : "Load source files",
      href: "#source-material",
    },
    positioning: {
      statusLabel: hasProfile ? "Profile ready" : "Generate profile",
      summary: hasProfile
        ? "The profile is ready. Next, create the CV and LinkedIn assets, then use them for job search and company tailoring."
        : "Generate the positioning brief after the source pack is loaded so the story is clear before creating outward-facing assets.",
      actionLabel: hasProfile ? "Create CV + LinkedIn" : "Generate profile",
      href: hasProfile ? "#document-workbench" : "#generate-profile",
    },
    documents: {
      statusLabel: hasDraftDocuments || coverLetterHistory.length > 0 ? "Assets active" : "Create base assets",
      summary:
        hasDraftDocuments || coverLetterHistory.length > 0
          ? "Core CV and LinkedIn materials are already saved here. Keep refining them or tailor them to a specific role."
          : "Generate the base CV and LinkedIn drafts first. Add a target role only when the user is ready to tailor.",
      actionLabel: hasDraftDocuments || coverLetterHistory.length > 0 ? "Open current documents" : "Generate base assets",
      href: hasDraftDocuments || coverLetterHistory.length > 0 ? "#current-application-documents" : "#base-asset-generator",
    },
    company: {
      statusLabel: companyDossiers.length > 0 ? "Research ready" : "Research needed",
      summary:
        companyDossiers.length > 0
          ? "Employer intelligence is saved and can now influence letters, outreach messaging, and interview tone."
          : "Build a company dossier before finalizing letters so the language and emphasis match the employer more closely.",
      actionLabel: companyDossiers.length > 0 ? "Open company dossiers" : "Create company dossier",
      href: companyDossiers.length > 0 ? "#current-company-dossiers" : "#company-dossier",
    },
    interview: {
      statusLabel: interviewPrepHistory.length > 0 || interviewReflections.length > 0 ? "Practice active" : "Prep needed",
      summary:
        interviewPrepHistory.length > 0 || interviewReflections.length > 0
          ? "Interview rehearsal and learning notes are saved here so the next conversation can improve on the last one."
          : "Generate a practice pack for a real role, then save post-interview reflections to improve the next round.",
      actionLabel: interviewPrepHistory.length > 0 ? "Open interview prep" : "Create interview prep",
      href: interviewPrepHistory.length > 0 ? "#current-interview-prep" : "#interview",
    },
    jobs: {
      statusLabel: hasLiveSearch || recruiterMatchSearchHistory.length > 0 || salaryAnalysisHistory.length > 0 ? "Market tools active" : "Search not started",
      summary:
        hasLiveSearch || recruiterMatchSearchHistory.length > 0 || salaryAnalysisHistory.length > 0
          ? "Live-market signals are now saved here. Compare openings, recruiter paths, pay ranges, and role fit before committing effort."
          : "Start this stage once the profile and core documents are ready, so real opportunities can be acted on quickly.",
      actionLabel: hasLiveSearch ? "Open live opportunities" : "Open market tools",
      href: hasLiveSearch ? "#current-live-opportunities" : "#jobs",
    },
  } as const
  const primaryActionBySection = {
    workflow: {
      title: "Next action",
      label: nextUndoneStep?.actionLabel || "Open workflow guide",
      detail: nextUndoneStep?.description || "Follow the recommended sequence to keep momentum and avoid rework.",
      sectionKey: nextUndoneStep?.sectionKey || "workflow",
      href: nextUndoneStep?.href || "#workflow-guide",
    },
    source: {
      title: "Next action",
      label: sectionActionGuides.source.actionLabel,
      detail: sectionActionGuides.source.summary,
      sectionKey: "source",
      href: sectionActionGuides.source.href,
    },
    positioning: {
      title: "Next action",
      label: sectionActionGuides.positioning.actionLabel,
      detail: sectionActionGuides.positioning.summary,
      sectionKey: hasProfile ? "documents" : "positioning",
      href: sectionActionGuides.positioning.href,
    },
    documents: {
      title: "Next action",
      label: sectionActionGuides.documents.actionLabel,
      detail: sectionActionGuides.documents.summary,
      sectionKey: "documents",
      href: sectionActionGuides.documents.href,
    },
    company: {
      title: "Next action",
      label: sectionActionGuides.company.actionLabel,
      detail: sectionActionGuides.company.summary,
      sectionKey: "company",
      href: sectionActionGuides.company.href,
    },
    interview: {
      title: "Next action",
      label: sectionActionGuides.interview.actionLabel,
      detail: sectionActionGuides.interview.summary,
      sectionKey: "interview",
      href: sectionActionGuides.interview.href,
    },
    jobs: {
      title: "Next action",
      label: sectionActionGuides.jobs.actionLabel,
      detail: sectionActionGuides.jobs.summary,
      sectionKey: "jobs",
      href: sectionActionGuides.jobs.href,
    },
  } as const
  const nextActionHelpBySection = {
    workflow: "Follow this one action first. The rest of the page can wait.",
    source: "Load missing source files first so every downstream output is stronger.",
    positioning: "Generate or refine the profile before creating new application assets.",
    documents: "Generate the base CV and LinkedIn drafts first. Tailoring can wait until there is a real role.",
    company: "Research the target company next so tone matching and messaging are specific.",
    interview: "Run interview prep before your next conversation, then save reflections.",
    jobs: "Search and shortlist roles next, then move them into your tracker.",
  } as const
  const activePrimaryAction = primaryActionBySection[activeStep as keyof typeof primaryActionBySection] ?? primaryActionBySection.workflow
  const wizardAction = {
    label: nextUndoneStep?.actionLabel || "Open Step Coach",
    sectionKey: nextUndoneStep?.sectionKey || "source",
    href: nextUndoneStep?.href || "#source-material",
  }
  const savedLibraryLinks = [
    {
      href: "#saved-library",
      label: "Saved files home",
      description: "See where all generated files are stored.",
      count: assets.length,
      tone: "neutral" as const,
    },
    {
      href: "#current-application-documents",
      label: "CV and profile documents",
      description: "Latest CV, LinkedIn, and strategy files.",
      count: draftHistory.length,
      tone: "positioning" as const,
    },
    {
      href: "#current-cover-letters",
      label: "Cover letters",
      description: "Latest tailored letters and past versions.",
      count: coverLetterHistory.length,
      tone: "execution" as const,
    },
    {
      href: "#current-company-dossiers",
      label: "Company dossiers",
      description: "Employer research and saved dossiers.",
      count: companyDossiers.length,
      tone: "research" as const,
    },
    {
      href: "#current-outreach-strategies",
      label: "Outreach strategies",
      description: "Contact paths, warm intro angles, and first-message plans.",
      count: outreachStrategyHistory.length,
      tone: "outreach" as const,
    },
    {
      href: "#current-deep-prospect-research",
      label: "Prospect research reports",
      description: "Hidden-market company maps and outreach targets.",
      count: deepProspectResearchHistory.length,
      tone: "research" as const,
    },
    {
      href: "#current-interview-prep",
      label: "Interview prep",
      description: "Practice packs and readiness files.",
      count: interviewPrepHistory.length,
      tone: "interview" as const,
    },
    {
      href: "#recent-interview-assessments",
      label: "Interview assessments",
      description: "Saved reflections and scorecards from real interviews.",
      count: interviewReflections.length,
      tone: "interview" as const,
    },
    {
      href: "#current-live-opportunities",
      label: "Live job searches",
      description: "Saved opportunity reports and job search runs.",
      count: liveJobSearchHistory.length,
      tone: "market" as const,
    },
    {
      href: "#current-recruiter-match-searches",
      label: "Recruiter match searches",
      description: "Recruiter routes, search-firm angles, and talent-market guidance.",
      count: recruiterMatchSearchHistory.length,
      tone: "outreach" as const,
    },
    {
      href: "#current-salary-analysis",
      label: "Salary analysis",
      description: "Market pay ranges and negotiation guidance.",
      count: salaryAnalysisHistory.length,
      tone: "market" as const,
    },
    {
      href: "#current-fit-analysis",
      label: "Role fit analysis",
      description: "How strongly the candidate matches a target role.",
      count: fitAnalysisHistory.length,
      tone: "execution" as const,
    },
    {
      href: "#current-course-recommendations",
      label: "Courses and certifications",
      description: "Learning recommendations matched to strengths and goals.",
      count: courseRecommendationHistory.length,
      tone: "positioning" as const,
    },
  ]
  const latestOutputHighlights = [
    [...latestDraftsByType.values()][0],
    latestCoverLetters[0],
    latestCompanyDossiers[0],
    latestInterviewPrep[0],
    latestLiveJobSearches[0],
    latestSalaryAnalysis[0],
    latestFitAnalysis[0],
    latestCourseRecommendations[0],
  ].filter((asset): asset is AssetRow => Boolean(asset))
  const latestCvDraft =
    latestDraftsByType.get("cv_master") ||
    latestDraftsByType.get("cv_rewrite") ||
    latestDraftsByType.get("cv") ||
    null
  const latestLinkedInDraft =
    latestDraftsByType.get("linkedin_profile") ||
    latestDraftsByType.get("linkedin_about") ||
    latestDraftsByType.get("linkedin") ||
    null
  const latestStrategyDraft =
    latestDraftsByType.get("career_strategy") ||
    latestDraftsByType.get("personal_brand_statement") ||
    latestDraftsByType.get("executive_bio") ||
    [...latestDraftsByType.values()].find(
      (asset) =>
        asset.asset_type !== latestCvDraft?.asset_type &&
        asset.asset_type !== latestLinkedInDraft?.asset_type
    ) ||
    null
  const savedMarketComparisons = [
    ...liveJobSearchHistory.slice(0, 2),
    ...recruiterMatchSearchHistory.slice(0, 2),
    ...salaryAnalysisHistory.slice(0, 2),
    ...fitAnalysisHistory.slice(0, 2),
  ].slice(0, 8)
  const parsedLatestLiveOpportunities = parseLiveJobSearchContent(latestLiveJobSearches[0]?.content || "")
  const quickSavedApplications = quickSavedApplicationIds
    .map((id) => applications.find((application) => application.id === id) || null)
    .filter((application): application is ApplicationRow => Boolean(application))
  const positioningGapItems = [
    !latestProfile?.career_identity ? "Generate the core career identity." : null,
    !latestProfile?.market_positioning ? "Add a sharper market positioning summary." : null,
    !latestProfile?.role_families?.length ? "Clarify target role families." : null,
    !latestProfile?.recommended_target_roles?.length ? "Recommend specific target roles." : null,
    !latestProfile?.core_strengths?.length ? "Capture the candidate's strongest themes." : null,
  ].filter((item): item is string => Boolean(item))
  const priorityItems = [
    ...overdueApplications.slice(0, 3).map((application) => ({
      id: `overdue-${application.id}`,
      tone: "danger" as const,
      title: `${application.company_name || "Untitled company"} follow-up is overdue`,
      description: application.next_action || application.job_title || "Open the application tracker and update the next step.",
      sectionKey: "documents",
      href: "#document-workbench",
      actionLabel: "Open application tracker",
    })),
    ...dueTodayApplications.slice(0, 3).map((application) => ({
      id: `today-${application.id}`,
      tone: "warning" as const,
      title: `${application.company_name || "Untitled company"} needs follow-up today`,
      description: application.next_action || application.job_title || "Review the application and complete today's next step.",
      sectionKey: "documents",
      href: "#document-workbench",
      actionLabel: "Review today's follow-up",
    })),
    ...activeBackgroundJobs.slice(0, 2).map((job) => ({
      id: `job-${job.id}`,
      tone: "info" as const,
      title: `${formatBackgroundJobType(job.job_type)} is still running`,
      description: job.result_summary || "You can keep working while this background task completes.",
      sectionKey: getResultAnchorForBackgroundJob(job.job_type).sectionKey,
      href: getResultAnchorForBackgroundJob(job.job_type).href,
      actionLabel: "Open related section",
    })),
    ...activeLiveJobRuns.slice(0, 2).map((run) => ({
      id: `live-${run.id}`,
      tone: "info" as const,
      title: `Live job search running for ${run.target_role || "target role"}`,
      description: run.location || "Results will appear in the live opportunities area when complete.",
      sectionKey: "jobs",
      href: "#current-live-opportunities",
      actionLabel: "Open live jobs",
    })),
  ].slice(0, 6)
  const blockerItems = [
    !hasCv
      ? {
          id: "blocker-cv",
          title: "Load the current CV",
          description: "The workspace still needs the factual baseline document before the strongest downstream outputs can be created.",
          sectionKey: "source",
          href: "#source-material",
          actionLabel: "Add CV",
          tone: "warning" as const,
        }
      : null,
    !hasGallupStrengths
      ? {
          id: "blocker-strengths",
          title: "Add the Gallup Strengths report",
          description: "This is still the engine-room document for stronger tone, positioning, and interview language.",
          sectionKey: "source",
          href: "#source-material",
          actionLabel: "Add strengths report",
          tone: "warning" as const,
        }
      : null,
    hasProfile && !companyDossiers.length
      ? {
          id: "blocker-dossier",
          title: "Build company intelligence",
          description: "The user is ready to start matching language and tone to target employers, but no dossier is saved yet.",
          sectionKey: "company",
          href: "#company-dossier",
          actionLabel: "Create dossier",
          tone: "info" as const,
        }
      : null,
  ].filter((item): item is { id: string; title: string; description: string; sectionKey: string; href: string; actionLabel: string; tone: "warning" | "info" } => Boolean(item))
  const todayBoardItems = [...priorityItems, ...blockerItems].slice(0, 4)
  const stageStatusBySection: Record<string, { complete: boolean; nextPrompt: string }> = {
    workflow: {
      complete: completionCount === preparationSteps.length,
      nextPrompt:
        activeBackgroundJobs.length > 0 || activeLiveJobRuns.length > 0
          ? "Background work is still running. You can keep moving through the workspace."
          : nextUndoneStep
            ? nextUndoneStep.actionLabel
            : "Everything is in place. Continue refining assets and outreach.",
    },
    source: {
      complete: hasCv && hasGallupStrengths && (hasLinkedIn || hasCoverLetterExamples || documents.length >= 3),
      nextPrompt: !hasCv ? "Add the current CV first." : !hasGallupStrengths ? "Add the Gallup Strengths report next." : "Add LinkedIn text and supporting proof.",
    },
    positioning: {
      complete: hasProfile,
      nextPrompt: hasProfile ? "Review and refine the professional narrative." : "Generate the first professional narrative.",
    },
    documents: {
      complete: hasDraftDocuments || coverLetterHistory.length > 0,
      nextPrompt: hasDraftDocuments ? "Review saved drafts or tailor them to a role." : "Generate base CV and LinkedIn assets first.",
    },
    company: {
      complete: companyDossiers.length > 0,
      nextPrompt: companyDossiers.length > 0 ? "Use employer insights to tailor language and tone." : "Generate an employer insights dossier for a target company.",
    },
    interview: {
      complete: interviewPrepHistory.length > 0 || interviewReflections.length > 0,
      nextPrompt:
        interviewReflections.length > 0
          ? "Use saved interview feedback to sharpen the next prep round."
          : interviewPrepHistory.length > 0
            ? "Capture how the real interview went so the next prep gets smarter."
            : "Generate interview readiness for a live role.",
    },
    jobs: {
      complete: hasLiveSearch,
      nextPrompt: activeLiveJobRuns.length > 0 ? "A live job search is running in the background." : hasLiveSearch ? "Review live matches and run another search if needed." : "Run opportunity matching from the saved profile.",
    },
  }
  const activeStepStatus = stageStatusBySection[activeStep] ?? stageStatusBySection.workflow
  const activeStepCheckToneClass = activeStepStatus.complete
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : "border-amber-200 bg-amber-50 text-amber-900"
  const activeStepCheckLabel = activeStepStatus.complete ? "Ready" : "Needs one more input"
  const sectionHeaderMeta = {
    workflow: {
      badgeLabel: activeStep === "workflow" ? "Current" : stageStatusBySection.workflow.complete ? "Ready" : "In progress",
      badgeClass:
        activeStep === "workflow"
          ? "bg-sky-100 text-sky-800"
          : stageStatusBySection.workflow.complete
            ? "bg-emerald-100 text-emerald-700"
            : "bg-amber-100 text-amber-800",
      prompt: stageStatusBySection.workflow.nextPrompt,
    },
    source: {
      badgeLabel: activeStep === "source" ? "Current" : stageStatusBySection.source.complete ? "Ready" : "Load inputs",
      badgeClass:
        activeStep === "source"
          ? "bg-sky-100 text-sky-800"
          : stageStatusBySection.source.complete
            ? "bg-emerald-100 text-emerald-700"
            : "bg-amber-100 text-amber-800",
      prompt: stageStatusBySection.source.nextPrompt,
    },
    positioning: {
      badgeLabel: activeStep === "positioning" ? "Current" : stageStatusBySection.positioning.complete ? "Ready" : "Generate next",
      badgeClass:
        activeStep === "positioning"
          ? "bg-sky-100 text-sky-800"
          : stageStatusBySection.positioning.complete
            ? "bg-emerald-100 text-emerald-700"
            : "bg-amber-100 text-amber-800",
      prompt: stageStatusBySection.positioning.nextPrompt,
    },
    documents: {
      badgeLabel: activeStep === "documents" ? "Current" : stageStatusBySection.documents.complete ? "Ready" : "Create assets",
      badgeClass:
        activeStep === "documents"
          ? "bg-sky-100 text-sky-800"
          : stageStatusBySection.documents.complete
            ? "bg-emerald-100 text-emerald-700"
            : "bg-amber-100 text-amber-800",
      prompt: stageStatusBySection.documents.nextPrompt,
    },
    company: {
      badgeLabel: activeStep === "company" ? "Current" : stageStatusBySection.company.complete ? "Ready" : "Research needed",
      badgeClass:
        activeStep === "company"
          ? "bg-sky-100 text-sky-800"
          : stageStatusBySection.company.complete
            ? "bg-emerald-100 text-emerald-700"
            : "bg-amber-100 text-amber-800",
      prompt: stageStatusBySection.company.nextPrompt,
    },
    interview: {
      badgeLabel: activeStep === "interview" ? "Current" : stageStatusBySection.interview.complete ? "Ready" : "Prep needed",
      badgeClass:
        activeStep === "interview"
          ? "bg-sky-100 text-sky-800"
          : stageStatusBySection.interview.complete
            ? "bg-emerald-100 text-emerald-700"
            : "bg-amber-100 text-amber-800",
      prompt: stageStatusBySection.interview.nextPrompt,
    },
    jobs: {
      badgeLabel: activeStep === "jobs" ? "Current" : stageStatusBySection.jobs.complete ? "Ready" : "Search next",
      badgeClass:
        activeStep === "jobs"
          ? "bg-sky-100 text-sky-800"
          : stageStatusBySection.jobs.complete
            ? "bg-emerald-100 text-emerald-700"
            : "bg-amber-100 text-amber-800",
      prompt: stageStatusBySection.jobs.nextPrompt,
    },
  } as const
  const stepContentCompactClass =
    "mt-1 space-y-1 [&_.rounded-3xl]:rounded-xl [&_.rounded-3xl]:p-1.5 [&_.rounded-2xl]:p-1.5 [&_.rounded-xl]:p-1.5 [&_h2]:text-[0.94rem] [&_h3]:text-[0.88rem] [&_p]:leading-[1.3] [&_.text-sm]:text-[0.8rem]"
  const urgentSectionKey =
    priorityItems[0]?.sectionKey ||
    todayBoardItems[0]?.sectionKey ||
    nextUndoneStep?.sectionKey ||
    null
  const workflowLinkStatuses = menuQuickLinks.map((link) => {
    const sectionState = stageStatusBySection[link.sectionKey]
    const isActive = link.sectionKey === activeStep
    const isUrgent = urgentSectionKey === link.sectionKey

    return {
      ...link,
      isActive,
      isUrgent,
      complete: sectionState?.complete ?? false,
      badgeLabel: isActive ? "Current" : isUrgent ? "Urgent" : sectionState?.complete ? "Ready" : "Needs work",
      badgeClass: isActive
        ? "bg-sky-100 text-sky-800"
        : isUrgent
          ? "bg-rose-100 text-rose-700"
        : sectionState?.complete
          ? "bg-emerald-100 text-emerald-700"
          : "bg-amber-100 text-amber-800",
    }
  })
  const leftWorkflowLinkStatuses = quickLinks.map((link) => {
    const sectionState = stageStatusBySection[link.sectionKey]
    const isActive = link.sectionKey === activeStep
    const isUrgent = urgentSectionKey === link.sectionKey
    const isWorkflowOverview = link.sectionKey === "workflow"
    const complete = isWorkflowOverview ? completionCount > 0 : sectionState?.complete ?? false

    return {
      ...link,
      isActive,
      isUrgent: !isWorkflowOverview && isUrgent,
      complete,
      badgeLabel: isActive ? "Current" : isWorkflowOverview ? (isFirstFiveComplete ? "Ready" : "Guide") : isUrgent ? "Next" : complete ? "Ready" : "Todo",
      badgeClass: isActive
        ? "bg-sky-100 text-sky-800"
        : isWorkflowOverview
          ? isFirstFiveComplete
            ? "bg-emerald-100 text-emerald-700"
            : "bg-neutral-100 text-neutral-600"
        : isUrgent
          ? "bg-amber-100 text-amber-800"
          : complete
            ? "bg-emerald-100 text-emerald-700"
            : "bg-neutral-100 text-neutral-600",
    }
  })
  const displayedLeftWorkflowLinks = leftWorkflowLinkStatuses
  const hasLiveExecutionActivity = activeBackgroundJobs.length + activeLiveJobRuns.length > 0
  const isWorkflowComplete = preparationSteps.length > 0 && completionCount >= preparationSteps.length
  const useCompactWorkflowGuide = showApplicationWorkspacePanel && isWorkflowComplete && !showAdvancedTools
  const shouldShowTodayAtGlance =
    priorityItems.length > 0 || hasLiveExecutionActivity || isTodayAtGlanceExpanded
  const contextRailItems = [
    {
      label: "Needs attention",
      value: String(priorityItems.length),
      tone: priorityItems.length > 0 ? "text-rose-700" : "text-emerald-700",
      actionLabel: priorityItems.length > 0 ? "Open priority lane" : "Open workflow guide",
      sectionKey: priorityItems.length > 0 ? priorityItems[0]?.sectionKey || "workflow" : "workflow",
      href: priorityItems.length > 0 ? priorityItems[0]?.href || "#workflow-guide" : "#workflow-guide",
    },
    {
      label: "Running now",
      value: String(activeBackgroundJobs.length + activeLiveJobRuns.length),
      tone: hasLiveExecutionActivity ? "text-sky-700" : "text-neutral-700",
      actionLabel: "Open background activity",
      sectionKey: "workflow",
      href: "#workflow-guide",
    },
    {
      label: "Recent files",
      value: String(latestOutputHighlights.length),
      tone: latestOutputHighlights.length > 0 ? "text-emerald-700" : "text-neutral-700",
      actionLabel: "Open saved files",
      sectionKey: "documents",
      href: "#saved-library",
    },
    {
      label: "Next action",
      value: nextUndoneStep?.actionLabel || "Continue refining",
      tone: "text-neutral-900",
      actionLabel: nextUndoneStep?.actionLabel || "Open workflow guide",
      sectionKey: nextUndoneStep?.sectionKey || "workflow",
      href: nextUndoneStep?.href || "#workflow-guide",
    },
  ]
  const workflowActionLane = [
    ...(runningOutputItem
      ? [
          {
            id: "running-output",
            label: "Processing now",
            title: `${runningOutputItem.label} is being saved`,
            detail: "Open the related workspace while the result finishes.",
            actionLabel: "Open area",
            sectionKey: runningOutputItem.sectionKey,
            href: runningOutputItem.href,
            tone: "sky" as const,
          },
        ]
      : []),
    ...(activeLiveJobRuns.length > 0
      ? [
          {
            id: "running-live-search",
            label: "Live search running",
            title: "Opportunity matching is in progress",
            detail: "Review live matches as soon as the run completes.",
            actionLabel: "Open search",
            sectionKey: "jobs",
            href: "#live-job-search",
            tone: "sky" as const,
          },
        ]
      : []),
    ...(overdueApplications[0]
      ? [
          {
            id: `overdue-${overdueApplications[0].id}`,
            label: "Follow-up overdue",
            title: overdueApplications[0].company_name
              ? `Follow up with ${overdueApplications[0].company_name}`
              : "Follow-up is overdue",
            detail:
              overdueApplications[0].next_action ||
              overdueApplications[0].job_title ||
              "Open the role tracker and decide the next move.",
            actionLabel: "Open tracker",
            sectionKey: "documents",
            href: "#target-role-tracker",
            tone: "rose" as const,
          },
        ]
      : []),
    ...(dueTodayApplications[0]
      ? [
          {
            id: `due-today-${dueTodayApplications[0].id}`,
            label: "Due today",
            title: dueTodayApplications[0].company_name
              ? `Check ${dueTodayApplications[0].company_name}`
              : "Application follow-up due",
            detail:
              dueTodayApplications[0].next_action ||
              dueTodayApplications[0].job_title ||
              "Keep the role moving while it is fresh.",
            actionLabel: "Open tracker",
            sectionKey: "documents",
            href: "#target-role-tracker",
            tone: "amber" as const,
          },
        ]
      : []),
    ...(latestCompletedBackgroundJob && latestCompletedOutputTarget
      ? [
          {
            id: `latest-output-${latestCompletedBackgroundJob.id}`,
            label: "Latest output ready",
            title: `${formatBackgroundJobType(latestCompletedBackgroundJob.job_type)} ready`,
            detail: latestCompletedOutputFollowUp?.label
              ? `Next: ${latestCompletedOutputFollowUp.label}`
              : latestCompletedBackgroundJob.result_summary || "Open the saved result.",
            actionLabel: latestCompletedOutputOpenLabel,
            sectionKey: latestCompletedOutputTarget.sectionKey,
            href: latestCompletedOutputTarget.href,
            tone: "emerald" as const,
          },
        ]
      : []),
    ...(nextMissingOutputItem
      ? [
          {
            id: `missing-output-${nextMissingOutputItem.id}`,
            label: "Next output",
            title: `Create ${nextMissingOutputItem.label}`,
            detail: "Fill the next gap in the candidate output set.",
            actionLabel: "Create",
            sectionKey: nextMissingOutputItem.sectionKey,
            href: nextMissingOutputItem.href,
            tone: "amber" as const,
          },
        ]
      : []),
    ...(firstFiveNextItem
      ? [
          {
            id: `setup-${firstFiveNextItem.key}`,
            label: "Setup",
            title: firstFiveNextItem.label,
            detail: "Finish the next setup step before moving into full execution.",
            actionLabel: "Continue",
            sectionKey: firstFiveNextItem.sectionKey,
            href: firstFiveNextItem.href,
            tone: "neutral" as const,
          },
        ]
      : nextUndoneStep
        ? [
            {
              id: `workflow-${nextUndoneStep.id}`,
              label: "Workflow",
              title: nextUndoneStep.title,
              detail: nextUndoneStep.description,
              actionLabel: nextUndoneStep.actionLabel,
              sectionKey: nextUndoneStep.sectionKey,
              href: nextUndoneStep.href,
              tone: "neutral" as const,
            },
          ]
        : []),
  ].slice(0, 3)

  const workspacePrimaryAction = runningOutputItem
    ? {
        title: `${runningOutputItem.label} is being saved`,
        detail: "Background work is running. Open the related area only if you need to check it.",
        label: "Open running work",
        sectionKey: runningOutputItem.sectionKey,
        href: runningOutputItem.href,
      }
    : latestCompletedBackgroundJob && latestCompletedOutputTarget
      ? {
          title: `${formatBackgroundJobType(latestCompletedBackgroundJob.job_type)} ready`,
          detail: latestCompletedOutputFollowUp?.label
            ? `Recommended next step: ${latestCompletedOutputFollowUp.label}.`
            : latestCompletedBackgroundJob.result_summary || "Review the latest saved output.",
          label: latestCompletedOutputFollowUp?.label || latestCompletedOutputOpenLabel,
          sectionKey: latestCompletedOutputFollowUp?.sectionKey || latestCompletedOutputTarget.sectionKey,
          href: latestCompletedOutputFollowUp?.href || latestCompletedOutputTarget.href,
        }
      : nextOutputPromptItem
        ? {
            title: `Create ${nextOutputPromptItem.label}`,
            detail: "Fill the next useful gap in the candidate output set.",
            label: runningOutputItem ? "Open area" : "Create output",
            sectionKey: nextOutputPromptItem.sectionKey,
            href: nextOutputPromptItem.href,
          }
        : {
            title: "Workspace ready",
            detail: "Review saved assets, track roles, or start another targeted output.",
            label: "Review assets",
            sectionKey: "documents",
            href: "#saved-library",
          }

  const workspaceQuickActions = [
    { label: "Review assets", detail: `${assets.length} saved`, sectionKey: "documents", href: "#saved-library" },
    { label: "Track roles", detail: `${activeApplications.length} active`, sectionKey: "documents", href: "#document-workbench" },
    {
      label: "Research company",
      detail: companyDossiers.length > 0 ? "Dossier ready" : "Build dossier",
      sectionKey: "company",
      href: "#company-dossier",
    },
  ]
  const workspaceSecondaryActivity = workflowActionLane.slice(1)

  function toggleSection(sectionKey: string) {
    const isCollapsingCurrentSection = activeStep === sectionKey && openSections[sectionKey]
    if (isCollapsingCurrentSection) {
      setActiveMode("plan")
      setActiveStep("workflow")
      setOpenSections(openSectionsFor("workflow"))
      return
    }

    const nextMode =
      sectionKey === "workflow" || sectionKey === "source" || sectionKey === "positioning"
        ? "plan"
        : sectionKey === "documents" || sectionKey === "company" || sectionKey === "interview"
          ? "build"
          : sectionKey === "jobs"
            ? "apply"
            : "plan"
    setActiveMode(nextMode)
    setActiveStep(sectionKey)
    setOpenSections(openSectionsFor(sectionKey))
    setIsMenuRolledUp(true)
  }

  function getSectionKeyForSavedLink(href: string) {
    if (href === "#current-company-dossiers") return "company"
    if (href === "#current-outreach-strategies") return "company"
    if (href === "#current-interview-prep" || href === "#recent-interview-assessments") return "interview"
    if (href === "#current-live-opportunities" || href === "#current-recruiter-match-searches" || href === "#current-salary-analysis" || href === "#current-fit-analysis") return "jobs"
    if (href === "#current-course-recommendations") return "positioning"
    return "documents"
  }

  function getSectionTargetForAssetType(assetType: string | null | undefined) {
    switch (assetType) {
      case "company_dossier":
        return { sectionKey: "company", href: "#current-company-dossiers" }
      case "outreach_strategy":
        return { sectionKey: "company", href: "#current-outreach-strategies" }
      case "recruiter_match_search":
        return { sectionKey: "jobs", href: "#current-recruiter-match-searches" }
      case "interview_prep":
        return { sectionKey: "interview", href: "#current-interview-prep" }
      case "live_job_search":
        return { sectionKey: "jobs", href: "#current-live-opportunities" }
      case "salary_analysis":
        return { sectionKey: "jobs", href: "#current-salary-analysis" }
      case "application_fit_analysis":
        return { sectionKey: "jobs", href: "#current-fit-analysis" }
      case "course_recommendations":
        return { sectionKey: "positioning", href: "#current-course-recommendations" }
      case "cover_letter":
        return { sectionKey: "documents", href: "#current-cover-letters" }
      default:
        return { sectionKey: "documents", href: "#current-application-documents" }
    }
  }

  function getResultAnchorForBackgroundJob(jobType: string | null | undefined) {
    switch (jobType) {
      case "generate_profile":
        return { sectionKey: "positioning", href: "#positioning" }
      case "generate_assets":
      case "generate_cover_letter":
      case "generate_strategy_document":
      case "generate_target_company_workflow":
        return { sectionKey: "documents", href: "#document-workbench" }
      case "generate_company_dossier":
        return { sectionKey: "company", href: "#current-company-dossiers" }
      case "generate_outreach_strategy":
        return { sectionKey: "company", href: "#current-outreach-strategies" }
      case "generate_recruiter_match_search":
        return { sectionKey: "jobs", href: "#current-recruiter-match-searches" }
      case "generate_interview_prep":
        return { sectionKey: "interview", href: "#current-interview-prep" }
      case "generate_salary_analysis":
        return { sectionKey: "jobs", href: "#current-salary-analysis" }
      case "generate_application_fit_analysis":
        return { sectionKey: "jobs", href: "#current-fit-analysis" }
      case "generate_course_recommendations":
        return { sectionKey: "positioning", href: "#current-course-recommendations" }
      default:
        return { sectionKey: "workflow", href: "#workflow-guide" }
    }
  }

  function getFollowUpActionForBackgroundJob(jobType: string | null | undefined) {
    switch (jobType) {
      case "generate_profile":
        return { label: "Create first assets", sectionKey: "documents", href: "#base-asset-generator" }
      case "generate_assets":
        return { label: "Create cover letter", sectionKey: "documents", href: "#document-actions" }
      case "generate_company_dossier":
        return { label: "Use in cover letter", sectionKey: "documents", href: "#document-actions" }
      case "generate_target_company_workflow":
      case "generate_application_sprint":
        return { label: "Review saved files", sectionKey: "documents", href: "#saved-library" }
      case "generate_cover_letter":
        return { label: "Open tracker", sectionKey: "documents", href: "#document-workbench" }
      case "generate_interview_prep":
        return { label: "Open interview notes", sectionKey: "interview", href: "#recent-interview-assessments" }
      case "generate_salary_analysis":
      case "generate_application_fit_analysis":
        return { label: "Open active role", sectionKey: "documents", href: "#document-workbench" }
      default:
        return null
    }
  }

  function getOpenOutputLabelForBackgroundJob(jobType: string | null | undefined) {
    switch (jobType) {
      case "generate_profile":
        return "Open profile"
      case "generate_assets":
        return "Review assets"
      case "generate_company_dossier":
        return "Open dossier"
      case "generate_outreach_strategy":
        return "Open outreach"
      case "generate_cover_letter":
        return "Open cover letter"
      case "generate_interview_prep":
        return "Open interview prep"
      case "generate_salary_analysis":
        return "Open salary view"
      case "generate_application_fit_analysis":
        return "Open fit analysis"
      case "generate_course_recommendations":
        return "Open courses"
      case "generate_target_company_workflow":
      case "generate_application_sprint":
      case "generate_strategy_document":
        return "Review files"
      default:
        return "Open output"
    }
  }

  async function handleRetryBackgroundJob(jobId: string) {
    try {
      setTrackerMessage("")
      await retryCareerBackgroundJob(jobId)
      setTrackerMessage("Background job retried.")
      showToast({ tone: "success", message: "Background job retried and running in the background." })
      void loadWorkspace()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to retry background job"
      setTrackerMessage(errorMessage)
      showToast({ tone: "error", message: errorMessage })
    }
  }

  async function handleRetryLiveJobRun(runId: string) {
    try {
      setTrackerMessage("")
      await retryCareerLiveJobRun(runId)
      setTrackerMessage("Live job search retried.")
      showToast({ tone: "success", message: "Live job search restarted in the background." })
      void loadWorkspace()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to retry live job search"
      setTrackerMessage(errorMessage)
      showToast({ tone: "error", message: errorMessage })
    }
  }

  async function handleQuickSaveOpportunity(opportunityKey: string, opportunity: ParsedLiveOpportunity, nextStatus: "shortlisted" | "targeting") {
    const normalizedCompany = (opportunity.company || "").trim()
    const normalizedTitle = (opportunity.title || "").trim()

    if (!normalizedCompany || !normalizedTitle) {
      const warning = "This role is missing core details and could not be saved."
      setTrackerMessage(warning)
      showToast({ tone: "error", message: warning })
      return
    }

    const alreadyTrackedApplication = applications.find((application) => applicationMatchesOpportunity(application, opportunity))

    if (alreadyTrackedApplication) {
      const existingStatus = alreadyTrackedApplication.status === "shortlisted" ? "shortlisted" : "targeting"
      setQuickSavedOpportunityStatuses((current) => ({ ...current, [opportunityKey]: existingStatus }))
      const info = `${normalizedTitle} at ${normalizedCompany} is already in the tracker.`
      setTrackerMessage(info)
      showToast({ tone: "info", message: info })
      return
    }

    setSavingOpportunityKey(opportunityKey)
    setTrackerMessage("")

    try {
      const response = await fetch("/api/career/applications", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          candidate_id: candidate.id,
          company_name: normalizedCompany,
          job_title: normalizedTitle,
          location: opportunity.location || "",
          job_url: opportunity.applyUrl || "",
          status: nextStatus,
          notes: opportunity.whyFit || "",
          next_action:
            nextStatus === "shortlisted"
              ? "Review dossier, tailor the cover letter, and decide whether to apply."
              : "Decide whether this opportunity should move into the shortlist.",
        }),
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to save this role")
      }
      const savedApplication = (json?.application || null) as ApplicationRow | null
      const savedApplicationId = savedApplication?.id || ""
      if (savedApplicationId) {
        setQuickSavedApplicationIds((current) => [savedApplicationId, ...current.filter((id) => id !== savedApplicationId)].slice(0, 6))
      }
      setQuickSavedOpportunityStatuses((current) => ({ ...current, [opportunityKey]: nextStatus }))

      const success =
        nextStatus === "shortlisted"
          ? `${normalizedTitle} saved to shortlist.`
          : `${normalizedTitle} saved in tracker.`
      setTrackerMessage(success)
      showToast({ tone: "success", message: success })
      notifyCareerWorkspaceRefresh()
      void loadWorkspace()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save this role"
      setTrackerMessage(errorMessage)
      showToast({ tone: "error", message: errorMessage })
    } finally {
      setSavingOpportunityKey((current) => (current === opportunityKey ? null : current))
    }
  }

  async function handleQuickUpdateApplicationStatus(applicationId: string, nextStatus: "targeting" | "shortlisted" | "applied") {
    const application = applications.find((item) => item.id === applicationId)
    if (!application) {
      const warning = "That role could not be found in the tracker."
      setTrackerMessage(warning)
      showToast({ tone: "error", message: warning })
      return
    }

    if (application.status === nextStatus) {
      const info = `Status is already ${nextStatus}.`
      setTrackerMessage(info)
      showToast({ tone: "info", message: info })
      return
    }

    setSavingOpportunityKey(`status-${applicationId}`)
    setTrackerMessage("")

    try {
      const response = await fetch(`/api/career/applications/${applicationId}`, {
        method: "PATCH",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          company_name: application.company_name || "",
          job_title: application.job_title || "",
          location: application.location || "",
          job_url: application.job_url || "",
          status: nextStatus,
          notes: application.notes || "",
          next_action: application.next_action || "",
          follow_up_date: application.follow_up_date || "",
          cover_letter_asset_id: application.cover_letter_asset_id || "",
          company_dossier_asset_id: application.company_dossier_asset_id || "",
          salary_analysis_asset_id: application.salary_analysis_asset_id || "",
          fit_analysis_asset_id: application.fit_analysis_asset_id || "",
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to update role status")
      }

      const success = `${application.job_title || "Role"} moved to ${nextStatus}.`
      setTrackerMessage(success)
      showToast({ tone: "success", message: success })
      notifyCareerWorkspaceRefresh()
      void loadWorkspace()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update role status"
      setTrackerMessage(errorMessage)
      showToast({ tone: "error", message: errorMessage })
    } finally {
      setSavingOpportunityKey((current) => (current === `status-${applicationId}` ? null : current))
    }
  }

  function goToPrevStep() {
    if (!canGoPrevStep) return
    const prev = quickLinks[activeStepIndex - 1]
    if (!prev) return
    openAndScroll(prev.sectionKey, prev.href)
  }

  function goToNextStep() {
    if (!canGoNextStep) return
    const next = quickLinks[activeStepIndex + 1]
    if (!next) return
    openAndScroll(next.sectionKey, next.href)
  }

  function setGuidedModeEnabled(enabled: boolean) {
    setIsGuidedMode(enabled)
    if (enabled) {
      setIsFocusMode(true)
      setIsMenuRolledUp(true)
      setShowStepGuidance(true)
      setShowAdvancedTools(false)
      setShowWorkflowMap(false)
      setIsContextRailOpen(false)
      setShowSourceSecondaryPanels(false)
    }
  }

  function openWizardFlow() {
    setIsMenuRolledUp(true)
    setShowStepGuidance(true)
    setIsGuidedMode(true)
    setIsContextRailOpen(false)
    setShowAdvancedTools(false)
    setIsMyFilesDrawerOpen(false)
    openAndScroll(wizardAction.sectionKey, wizardAction.href)
  }

  function resetWorkspaceView() {
    setGuidedModeEnabled(true)
    setOpenGuideHintId(null)
    setShowPriorityDetails(false)
    setShowRecentFilesDetails(false)
    setOpenSections(openSectionsFor("workflow"))
    setShowSectionContext({
      source: false,
      positioning: false,
      documents: false,
      company: false,
      interview: false,
      jobs: false,
    })
    setIsMyFilesDrawerOpen(false)
    openAndScroll("workflow", "#workflow-guide")
    showToast({ tone: "info", message: "Workspace view reset to the guided start." })
  }

  function toggleSectionContext(sectionKey: "source" | "positioning" | "documents" | "company" | "interview" | "jobs") {
    setShowSectionContext((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }))
  }

  function getRecoveryAnchorForBackgroundJob(jobType: string | null | undefined) {
    switch (jobType) {
      case "generate_recruiter_match_search":
        return { sectionKey: "jobs", href: "#recruiter-match-search" }
      case "generate_salary_analysis":
        return { sectionKey: "jobs", href: "#salary-analysis" }
      case "generate_application_fit_analysis":
        return { sectionKey: "jobs", href: "#fit-analysis" }
      case "generate_company_dossier":
        return { sectionKey: "company", href: "#company-dossier" }
      case "generate_interview_prep":
        return { sectionKey: "interview", href: "#interview" }
      case "generate_assets":
      case "generate_cover_letter":
      case "generate_strategy_document":
      case "generate_target_company_workflow":
        return { sectionKey: "documents", href: "#document-workbench" }
      default:
        return { sectionKey: "workflow", href: "#workflow-guide" }
    }
  }

  function markOutputChecked(outputId: string) {
    setManualOutputChecks((current) => ({
      ...current,
      [outputId]: !current[outputId],
    }))
  }

  async function submitIssueReport() {
    const trimmedDetail = issueDetail.trim()
    if (!trimmedDetail) {
      showToast({ tone: "error", message: "Add a short issue description so support can help quickly." })
      return
    }

    try {
      const response = await fetch("/api/tester-notes", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          note_type: "bug",
          severity: "medium",
          message: `${issueType}: ${trimmedDetail}`,
          module: "career-intelligence",
          route_path: typeof window !== "undefined" ? window.location.pathname : "/career",
          full_url: typeof window !== "undefined" ? window.location.href : null,
          section_anchor: activeWorkflowLink?.href ?? null,
          metadata: {
            issue_type: issueType,
            contact_email: issueContactEmail || null,
            candidate_id: candidate.id,
            candidate_name: candidate.full_name || null,
            current_step: `${activeSectionLabel} / ${activeSubsectionLabel}`,
          },
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json?.error || "Could not submit issue.")
      }
      showToast({ tone: "success", message: "Issue sent. Thanks, our team can now review this report." })
    } catch {
      showToast({ tone: "error", message: "Could not send issue report right now. Please try again." })
    }

    setIsReportIssueOpen(false)
  }

  return (
    <main id="career-workspace-root" className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className={`candidate-compact-workspace w-full px-4 py-3 lg:pl-[240px] lg:pr-4 ${isContextRailOpen || isMyFilesDrawerOpen ? "lg:pr-[380px]" : ""}`}>
        <PlatformModuleNav />
        <AdaptiveProductTour moduleKey="career" />
        <WelcomeBackNotice userId={session?.user?.id} moduleLabel="Career Intelligence" />
        {previewOwnerUserId ? (
          <div className="mb-2 rounded-2xl border border-sky-300 bg-sky-50 px-3 py-2 text-[11px] font-medium text-sky-900">
            Admin preview mode active. You are viewing this workspace as candidate owner <span className="font-semibold">{previewOwnerUserId}</span>.
          </div>
        ) : null}
        <div id="career-header" className="mb-1.5 rounded-2xl border border-[#d8e4f2] bg-white px-3 py-1.5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <Link href="/career" className="text-[11px] font-medium text-neutral-500 hover:text-neutral-900">
              Back to Career Intelligence
              </Link>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <h1 className="truncate text-base font-semibold tracking-tight md:text-lg">{candidate.full_name || "Untitled candidate"}</h1>
                {authProviderBadge ? (
                  <span className="rounded-full border border-neutral-300 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                    {authProviderBadge} login
                  </span>
                ) : null}
                {session?.user ? (
                  <button
                    type="button"
                    onClick={() => void handleSwitchAccount()}
                    disabled={isSwitchingAccount}
                    className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSwitchingAccount ? "Switching..." : "Switch account"}
                  </button>
                ) : null}
              </div>
              <p className="mt-0.5 hidden line-clamp-1 max-w-3xl text-[11px] leading-4 text-neutral-600 md:block">
                {hasTargetRole
                  ? "Use the left workflow to refine assets, run live search, and keep momentum."
                  : personalizedWelcomeMessage}
              </p>
              <div className="mt-1 text-[11px] text-neutral-600">
                <span className="font-semibold text-neutral-700">Location:</span> {candidate.city || "Not set"}
                <span className="mx-1.5 text-neutral-400">•</span>
                <span className="font-semibold text-neutral-700">Target role:</span>{" "}
                {candidate.primary_goal ? candidate.primary_goal.replaceAll("_", " ") : "Not set"}
              </div>
            </div>
          </div>
        </div>

        {!isWizardFocusActive ? (
        <section className="mb-1.5 rounded-2xl border border-[#d8e4f2] bg-white px-2 py-1.5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5b6b7c]">
                {showApplicationWorkspacePanel ? "Application workspace" : "Setup progress"}
              </div>
              <p className="text-xs text-neutral-600">
                {showApplicationWorkspacePanel
                  ? `${outputReadyCount}/${outputCompletionItems.length} outputs ready | ${activeApplications.length} active role${activeApplications.length === 1 ? "" : "s"}`
                  : `${firstFiveCompleteCount}/5 complete${firstFiveNextItem ? ` | Next: ${firstFiveNextItem.label}` : " | Core setup complete"}`}
              </p>
            </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (showApplicationWorkspacePanel) {
                      openAndScroll(workspacePrimaryAction.sectionKey, workspacePrimaryAction.href)
                      return
                    }
                    if (firstFiveNextItem) {
                      openAndScroll(firstFiveNextItem.sectionKey, firstFiveNextItem.href)
                      return
                    }
                    openWizardFlow()
                  }}
                  className={`rounded-full border border-[#0a66c2] bg-[#0a66c2] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white shadow-[0_0_0_2px_rgba(10,102,194,0.2)] hover:bg-[#0958a8] ${
                    showOnboardingGuide ? "wizard-spotlight" : ""
                  }`}
                >
                  {showApplicationWorkspacePanel
                    ? workspacePrimaryAction.label
                    : firstFiveNextItem
                    ? `Next step: ${firstFiveNextItem.label}`
                    : `Setup wizard${showOnboardingGuide ? ` (${firstFiveRemainingCount} left)` : ""}`}
                </button>
                {showFirstFiveCompact ? (
                  <button
                    type="button"
                  onClick={() => {
                    setShowAdvancedTools(true)
                    setIsMenuRolledUp(false)
                  }}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  View checklist
                </button>
              ) : null}
            </div>
          </div>
          {!showApplicationWorkspacePanel && latestCompletedBackgroundJob && latestCompletedOutputTarget ? (
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700">Latest completed output</div>
                <div className="mt-0.5 truncate text-sm font-semibold text-emerald-950">
                  {formatBackgroundJobType(latestCompletedBackgroundJob.job_type)} ready
                </div>
                <div className="mt-0.5 line-clamp-1 text-[11px] text-emerald-900">
                  {latestCompletedBackgroundJob.result_summary ||
                    (latestCompletedOutputTime ? `Saved ${new Date(latestCompletedOutputTime).toLocaleString()}` : "Saved and ready to review")}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openAndScroll(latestCompletedOutputTarget.sectionKey, latestCompletedOutputTarget.href)}
                  className="rounded-full border border-emerald-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-800 hover:bg-emerald-100"
                >
                  {latestCompletedOutputOpenLabel}
                </button>
                {latestCompletedOutputFollowUp ? (
                  <button
                    type="button"
                    onClick={() => openAndScroll(latestCompletedOutputFollowUp.sectionKey, latestCompletedOutputFollowUp.href)}
                    className="rounded-full border border-emerald-300 bg-emerald-700 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-emerald-800"
                  >
                    {latestCompletedOutputFollowUp.label}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          {!showApplicationWorkspacePanel && workflowActionLane.length > 0 && !(latestCompletedBackgroundJob && latestCompletedOutputTarget) ? (
            <div className="mt-1 rounded-xl border border-[#d8e4f2] bg-[#f7fbff] px-2 py-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#56708d]">Today's workflow</div>
                  <div className="hidden text-[11px] text-neutral-600 md:block">Best next actions based on saved files, running work, and tracked roles.</div>
                </div>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                  {workflowActionLane.length} active
                </span>
              </div>
              <div className="mt-1 grid gap-1 lg:grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
                {workflowActionLane.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openAndScroll(item.sectionKey, item.href)}
                    className={`rounded-lg border px-2.5 py-1 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${workflowActionToneClass(item.tone)}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-neutral-500">{item.label}</span>
                      <span className="rounded-full border border-white bg-white px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                        {item.actionLabel}
                      </span>
                    </div>
                    <div className="mt-0.5 line-clamp-1 text-xs font-semibold text-neutral-950">{item.title}</div>
                    <div className="mt-0.5 line-clamp-1 text-[11px] leading-4 text-neutral-600">{item.detail}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {showApplicationWorkspacePanel ? (
            <>
              <div className="mt-1.5 grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]">
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-700">Current focus</div>
                  <div className="mt-0.5 truncate text-sm font-semibold text-sky-950">{targetSummaryTitle}</div>
                  <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-sky-900">
                    <span>{currentTargetBrief.location || "Location not set"}</span>
                    <span>{targetStageLabel}</span>
                    <span>{outputReadyCount}/{outputCompletionItems.length} outputs ready</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openAndScroll(workspacePrimaryAction.sectionKey, workspacePrimaryAction.href)}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-left transition hover:border-emerald-300 hover:bg-emerald-100"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                    {runningOutputItem ? "Working now" : "Recommended next"}
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-emerald-950">{workspacePrimaryAction.title}</div>
                  <div className="mt-0.5 line-clamp-1 text-[11px] text-emerald-900">{workspacePrimaryAction.detail}</div>
                  <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-800">{workspacePrimaryAction.label}</div>
                </button>
              </div>
              <div className="mt-1.5 grid gap-1.5 md:grid-cols-3">
                {workspaceQuickActions.map((item) => (
                  <button
                    key={`workspace-action-${item.label}`}
                    type="button"
                    onClick={() => openAndScroll(item.sectionKey, item.href)}
                    className="group flex items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-left transition hover:border-sky-300 hover:bg-white"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-semibold text-neutral-900">{item.label}</span>
                      <span className="block truncate text-[10px] text-neutral-500">{item.detail}</span>
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-700 opacity-80 group-hover:opacity-100">Open</span>
                  </button>
                ))}
              </div>
              {workspaceSecondaryActivity.length > 0 ? (
                <div className="mt-1.5 rounded-xl border border-neutral-200 bg-white px-2.5 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Also active</div>
                    <div className="text-[10px] text-neutral-500">
                      {workspaceSecondaryActivity.length} item{workspaceSecondaryActivity.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="mt-1.5 space-y-1.5">
                    {workspaceSecondaryActivity.map((item) => (
                      <button
                        key={`workspace-secondary-${item.id}`}
                        type="button"
                        onClick={() => openAndScroll(item.sectionKey, item.href)}
                        className="group flex w-full items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-left transition hover:border-sky-300 hover:bg-white"
                      >
                        <span className="min-w-0">
                          <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">{item.label}</span>
                          <span className="block truncate text-[11px] font-semibold text-neutral-900">{item.title}</span>
                          <span className="block truncate text-[10px] text-neutral-500">{item.detail}</span>
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-700 opacity-80 group-hover:opacity-100">
                          {item.actionLabel}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : !showFirstFiveCompact ? (
            <>
              <div className="mt-2 grid gap-1.5 md:grid-cols-3">
                {topReadinessItems.map((item) => (
                  <button
                    key={`top-readiness-${item.label}`}
                    type="button"
                    onClick={() => openAndScroll(item.sectionKey, item.href)}
                    className={`rounded-xl border px-2.5 py-2 text-left ${
                      item.ready ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
                    }`}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-600">{item.label}</div>
                    <div className="mt-0.5 text-xs font-medium text-neutral-800">{item.ready ? item.readyText : item.nextText}</div>
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {firstFiveChecklist.map((item) => (
                  <button
                    key={`first-five-${item.key}`}
                    type="button"
                    onClick={() => openAndScroll(item.sectionKey, item.href)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                      item.done
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    {item.done ? "Done" : "Next"} | {item.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Outputs</div>
                    <div className="mt-0.5 text-[11px] text-neutral-600">
                      {outputReadyCount}/{outputCompletionItems.length} ready. Work from the next missing output first.
                    </div>
                  </div>
                  <div className="text-[10px] text-neutral-500">
                    {nextOutputPromptItem ? "Next output selected" : "All core outputs are in place"}
                  </div>
                </div>
                {nextOutputPromptItem ? (
                  <div className={`mt-1.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 ${
                    runningOutputItem
                      ? "border-sky-200 bg-sky-50 text-sky-900"
                      : "border-amber-200 bg-amber-50 text-amber-900"
                  }`}>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.08em]">
                        {runningOutputItem ? "Processing now" : "Do this next"}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] font-semibold">
                        {runningOutputItem ? `${nextOutputPromptItem.label} is being saved` : `Create ${nextOutputPromptItem.label}`}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openAndScroll(nextOutputPromptItem.sectionKey, nextOutputPromptItem.href)}
                      className="rounded-full border border-white bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-800 hover:bg-neutral-50"
                    >
                      {runningOutputItem ? "Open area" : "Open next step"}
                    </button>
                  </div>
                ) : null}
                <div className="mt-1.5 grid gap-1.5 md:grid-cols-3 xl:grid-cols-6">
                  {outputCompletionItems.map((item) => {
                    const isReady = item.count > 0
                    const statusLabel = item.running ? "Running" : isReady ? "Ready to use" : getOutputMissingLabel(item)
                    const actionLabel = getOutputActionLabel(item)
                    const statusClass = item.running
                      ? "bg-sky-100 text-sky-800"
                      : isReady
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-800"

                    return (
                      <button
                        key={`output-status-${item.id}`}
                        type="button"
                        onClick={() => openAndScroll(item.sectionKey, item.href)}
                        className="group rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-left transition hover:border-sky-300 hover:bg-sky-50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate text-[11px] font-semibold text-neutral-900">{item.label}</div>
                          <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] ${statusClass}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
                          <span className="text-neutral-500">
                            {isReady ? `${item.count} saved` : item.running ? "Saving soon" : "Action needed"}
                          </span>
                          <span className="font-semibold uppercase tracking-[0.08em] text-sky-700 opacity-80 group-hover:opacity-100">
                            {actionLabel}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          ) : isFirstTimeMinimalMode ? (
            <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
              Keep this simple: load CV + Gallup, then generate profile. Everything else opens after that.
            </div>
          ) : null}
        </section>
        ) : null}

        <section className="sticky top-2 z-20 mb-2 rounded-xl border border-[#d8e4f2] bg-white/95 px-3 py-1.5 shadow-sm backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 text-[11px] text-neutral-600">
              <span className="font-semibold text-neutral-900">{activeWorkflowStepLabel}</span>
              <span className="text-neutral-400"> · </span>
              <span>{completionCount}/{preparationSteps.length} done</span>
            </div>
            <button
              type="button"
              onClick={() => openAndScroll(activePrimaryAction.sectionKey, activePrimaryAction.href)}
              className="rounded-full bg-[#0a66c2] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#004182]"
            >
              Continue
            </button>
          </div>
        </section>

        {showSetupCelebration && !isWizardFocusActive && !showApplicationWorkspacePanel ? (
          <section
            className={`border border-emerald-300 bg-emerald-50 shadow-sm ${
              showApplicationWorkspacePanel
                ? "mb-2 rounded-2xl px-2.5 py-1.5"
                : "mb-2.5 rounded-2xl px-3 py-2.5"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Setup complete</div>
                <p className="text-xs text-emerald-800">
                  {showApplicationWorkspacePanel
                    ? "Core setup is done. Continue from the workspace above when you are ready to review or create outputs."
                    : "Great momentum. Your first five setup actions are complete, so you can now focus on high-impact applications."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    dismissSetupCelebration()
                    openAndScroll("documents", "#document-workbench")
                  }}
                  className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700 hover:bg-emerald-100"
                >
                  {showApplicationWorkspacePanel ? "Open documents" : "Build documents"}
                </button>
                <button
                  type="button"
                  onClick={dismissSetupCelebration}
                  className="rounded-full border border-emerald-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700 hover:bg-emerald-100"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {hideWorkspaceMenuInFocus ? (
          <section data-sticky-nav="true" className="sticky top-3 z-30 mb-3 rounded-2xl border border-[#d8e4f2] bg-white px-3 py-2 shadow-sm backdrop-blur lg:hidden">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] text-neutral-600">
                Working in <span className="font-semibold text-neutral-900">{activeSectionLabel}</span> /{" "}
                <span className="font-semibold text-neutral-900">{activeSubsectionLabel}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {savePulse ? (
                  <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                    {savePulse.label}
                  </span>
                ) : null}
                {!hideWorkspaceGuideToggle ? (
                  <button
                    type="button"
                    onClick={() => setGuidedModeEnabled(!isGuidedMode)}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                      isGuidedMode
                        ? "border-[#0a66c2] bg-[#0a66c2] text-white"
                        : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    {isGuidedMode ? "Workspace guide on" : "Workspace guide off"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={resetWorkspaceView}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  Reset view
                </button>
                <button
                  type="button"
                  onClick={() => setIsMyFilesDrawerOpen((current) => !current)}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  {isMyFilesDrawerOpen ? "Hide files" : "My files"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsReportIssueOpen(true)}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  Report issue
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsFocusMode(false)
                    setIsMenuRolledUp(false)
                  }}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  Show menu
                </button>
                <button
                  type="button"
                  onClick={() => setIsFocusMode(false)}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  Exit focus
                </button>
              </div>
            </div>
            <div className={`mt-2 rounded-xl border px-2.5 py-2 text-[11px] ${activeStepCheckToneClass}`}>
              <div className="font-semibold uppercase tracking-[0.08em]">{activeStepCheckLabel}</div>
              <div className="mt-0.5">{activeStepStatus.nextPrompt}</div>
            </div>
          </section>
        ) : (
          <section data-sticky-nav="true" className="sticky top-3 z-30 mb-3 rounded-2xl border border-[#d8e4f2] bg-[linear-gradient(180deg,#fcfdff_0%,#f4f8fc_100%)] px-2.5 py-2 shadow-sm backdrop-blur lg:hidden">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5b6b7c]">Step-by-step menu</div>
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                  {completionCount}/{preparationSteps.length} steps done
                </div>
                {savePulse ? (
                  <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                    {savePulse.label}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={openWizardFlow}
                  className={`rounded-full border border-[#0a66c2] bg-[#e8f3ff] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0a66c2] shadow-[0_0_0_1px_rgba(10,102,194,0.2)] hover:bg-[#dcecff] ${
                    showOnboardingGuide ? "wizard-spotlight-soft" : ""
                  }`}
                >
                  Guided setup{showOnboardingGuide ? ` (${firstFiveRemainingCount} left)` : ""}
                </button>
                {workflowPrimaryAction ? (
                  <button
                    type="button"
                    onClick={() => openAndScroll(workflowPrimaryAction.sectionKey, workflowPrimaryAction.href)}
                    className="rounded-full border border-[#0a66c2] bg-[#0a66c2] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#004182]"
                  >
                    {workflowPrimaryAction.actionLabel || "Next action"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setIsMenuRolledUp((current) => !current)}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  {isMenuRolledUp ? "Expand" : "Collapse"}
                </button>
              </div>
            </div>
            <details className="mt-1.5 rounded-xl border border-neutral-200 bg-white px-2.5 py-1.5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-600">
                More options
                <span className="text-[10px] text-neutral-500">Open</span>
              </summary>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {!hideWorkspaceGuideToggle ? (
                  <button
                    type="button"
                    onClick={() => setGuidedModeEnabled(!isGuidedMode)}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                      isGuidedMode
                        ? "border-[#0a66c2] bg-[#0a66c2] text-white"
                        : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    {isGuidedMode ? "Agent tips on" : "Agent tips off"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={resetWorkspaceView}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  Reset view
                </button>
                <button
                  type="button"
                  onClick={() => setIsMyFilesDrawerOpen((current) => !current)}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  {isMyFilesDrawerOpen ? "Hide files" : "My files"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsReportIssueOpen(true)}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  Report issue
                </button>
              </div>
            </details>
            {!isMenuRolledUp && showStepGuidance ? (
              <div className={`mt-1.5 rounded-xl border px-2.5 py-2 text-[11px] ${activeStepCheckToneClass}`}>
                <div className="font-semibold uppercase tracking-[0.08em]">
                  Smart check: {activeStepCheckLabel}
                </div>
                <div className="mt-0.5">{activeStepStatus.nextPrompt}</div>
              </div>
            ) : null}
            {!isMenuRolledUp ? (
              <div className="mt-1.5 flex items-center gap-1.5 overflow-x-auto pb-1">
                <span className="shrink-0 rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-600">
                  Workflow steps
                </span>
                {workflowLinkStatuses.map((link) => (
                  <button
                    key={`top-step-${link.href}`}
                    type="button"
                    onClick={() => openAndScroll(link.sectionKey, link.href)}
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition ${
                      link.isActive
                        ? "border-sky-300 bg-sky-100 text-sky-900"
                        : link.complete
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    {link.complete ? "? " : ""}
                    {cleanWorkflowLabel(link.label)}
                  </button>
                ))}
              </div>
            ) : null}
            {isMenuRolledUp ? (
              <>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-2.5 py-1.5">
                  <div className="min-w-0 flex-1 text-[11px] text-neutral-600">
                    Now: <span className="font-semibold text-neutral-900">{activeWorkflowStepLabel}</span>
                    <span className="text-neutral-400"> / </span>
                    <span className="font-semibold text-neutral-900">
                      {activeStepIndex + 1}/{quickLinks.length}
                    </span>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${activeStepCheckToneClass}`}>
                    {activeStepCheckLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => openAndScroll(activePrimaryAction.sectionKey, activePrimaryAction.href)}
                    className="rounded-full bg-[#0a66c2] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#004182]"
                  >
                    {activePrimaryAction.label}
                  </button>
                  {!isGuidedMode ? (
                    <button
                      type="button"
                      onClick={() => setShowAdvancedTools((current) => !current)}
                      className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                    >
                      {showAdvancedTools ? "Hide controls" : "Controls"}
                    </button>
                  ) : null}
                </div>
                {showAdvancedTools && !isGuidedMode ? (
                  <div className="mt-1.5 flex flex-wrap justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setIsFocusMode((current) => {
                          const next = !current
                          setIsMenuRolledUp(next)
                          return next
                        })
                      }
                      className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                    >
                      {isFocusMode ? "Focus mode on" : "Focus mode off"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsContextRailOpen((current) => !current)}
                      className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                    >
                      {isContextRailOpen ? "Hide rail" : "Show rail"}
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div className="mt-1.5 rounded-xl border border-neutral-200 bg-white px-2.5 py-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="text-[11px] text-neutral-600">
                      Current: <span className="font-semibold text-neutral-900">{cleanWorkflowLabel(activeWorkflowLink?.label || "Start")}</span>
                      <span className="text-neutral-400"> / </span>
                      <span className="font-semibold text-neutral-900">
                        {activeStepIndex + 1}/{quickLinks.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openAndScroll(activePrimaryAction.sectionKey, activePrimaryAction.href)}
                        className="rounded-full border border-[#0a66c2] bg-[#e8f3ff] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0a66c2] hover:bg-[#dcecff]"
                      >
                        {activePrimaryAction.label}
                      </button>
                      <button
                        type="button"
                        onClick={goToPrevStep}
                        disabled={!canGoPrevStep}
                        className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={goToNextStep}
                        disabled={!canGoNextStep}
                        className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                  {showStepGuidance ? (
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-neutral-600">
                      <span className="font-semibold text-neutral-700">Path:</span>
                      <button
                        type="button"
                        onClick={() => openAndScroll(activeStep, activeWorkflowLink?.href || "#workflow-guide")}
                        className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 font-semibold text-neutral-700 hover:bg-neutral-100"
                      >
                        {activeSectionLabel}
                      </button>
                      <span className="text-neutral-400">/</span>
                      <button
                        type="button"
                        onClick={() => openAndScroll(activeStep, activeAnchor)}
                        className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 font-semibold text-neutral-700 hover:bg-neutral-100"
                      >
                        {activeSubsectionLabel}
                      </button>
                    </div>
                  ) : null}
                </div>
                {showStepGuidance ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-1.5">
                    <div className="flex items-center gap-1">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-700">{activePrimaryAction.title}</div>
                      <button
                        type="button"
                        title={nextActionHelpBySection[activeStep as keyof typeof nextActionHelpBySection] ?? nextActionHelpBySection.workflow}
                        className="rounded-full border border-sky-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 hover:bg-sky-100"
                        aria-label="Next action help"
                      >
                        ?
                      </button>
                    </div>
                    <div className="min-w-0 flex-1 truncate text-[11px] text-sky-900">{activePrimaryAction.detail}</div>
                    <button
                      type="button"
                      onClick={() => openAndScroll(activePrimaryAction.sectionKey, activePrimaryAction.href)}
                      className="rounded-full bg-[#0a66c2] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#004182]"
                    >
                      {activePrimaryAction.label}
                    </button>
                  </div>
                ) : null}
                {showAdvancedTools && !isGuidedMode ? (
                  <div className="mt-1.5 rounded-lg border border-sky-200 bg-white/90 px-2 py-1 text-[10px] leading-4 text-sky-950">
                    Strength lens: {activeStrengthNudge}
                  </div>
                ) : null}
                {!isGuidedMode ? (
                  <div className="mt-1.5 flex flex-wrap justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setIsFocusMode((current) => {
                          const next = !current
                          setIsMenuRolledUp(next)
                          return next
                        })
                      }
                      className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                    >
                      {isFocusMode ? "Focus mode on" : "Focus mode off"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsContextRailOpen((current) => !current)}
                      className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                    >
                      {isContextRailOpen ? "Hide rail" : "Show rail"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAdvancedTools((current) => !current)}
                      className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                    >
                      {showAdvancedTools ? "Hide advanced" : "Show advanced"}
                    </button>
                  </div>
                ) : (
                  <div className="mt-1.5 text-[10px] text-neutral-500">
                    Guided mode keeps only core actions visible.
                  </div>
                )}
              </>
            )}
            {showAdvancedTools && !isGuidedMode ? (
              <div className="mt-2 text-[11px] text-neutral-500">Advanced tools are open in the side drawer.</div>
            ) : null}
          </section>
        )}

        {isWizardFocusActive ? (
          <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
            Setup wizard mode is active. Secondary panels are hidden so you can finish this step without distractions.
          </div>
        ) : null}

        {showOnboardingGuide && !isGuidedMode && !showStepGuidance ? (
          <section className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-800">New user quick start</div>
            <div className="mt-1 text-sm text-amber-900">Load CV + Gallup first, then generate the profile before documents.</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {!hasCv ? (
                <button
                  type="button"
                  onClick={() => openAndScroll("source", "#source-material")}
                  className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-900 hover:bg-amber-100"
                >
                  Add CV
                </button>
              ) : null}
              {!hasGallupStrengths ? (
                <button
                  type="button"
                  onClick={() => openAndScroll("source", "#source-material")}
                  className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-900 hover:bg-amber-100"
                >
                  Add strengths
                </button>
              ) : null}
              {!hasProfile ? (
                <button
                  type="button"
                  onClick={() => openAndScroll("positioning", "#generate-profile")}
                  className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-900 hover:bg-amber-100"
                >
                  Generate profile
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {!isFirstTimeMinimalMode && !isGuidedMode ? (
        <section className="mb-3 rounded-2xl border border-[#d5e1ef] bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5b6b7c]">Current target role</div>
              <h2 className="mt-1 text-base font-semibold text-neutral-900">
                {targetSummaryTitle}
              </h2>
              <p className="mt-0.5 text-[11px] text-neutral-600">
                {targetSourceLabel}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 py-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Role readiness</div>
              <div className={`mt-0.5 text-base font-semibold ${focusedRoleHealthTone === "success" ? "text-emerald-700" : focusedRoleHealthTone === "info" ? "text-amber-700" : "text-rose-700"}`}>
                {focusedRoleHealthPercent}%
              </div>
            </div>
          </div>
          {showTargetRoleDetails ? (
            <>
              <div className="mt-1.5 flex gap-1 overflow-x-auto pb-1">
                {currentTargetQuickLinks.map((link) => (
                  <button
                    key={`target-link-${link.href}`}
                    type="button"
                    onClick={() => openAndScroll(link.sectionKey, link.href)}
                    className="shrink-0 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-1 text-[10px] font-semibold text-neutral-700 hover:bg-neutral-100"
                  >
                    {link.label}
                  </button>
                ))}
              </div>
              <div className="mt-1.5 flex gap-1 overflow-x-auto pb-1">
                {focusedRoleHealthSteps.map((step) => (
                  <button
                    key={`role-health-${step.id}`}
                    type="button"
                    onClick={() => openAndScroll(step.sectionKey, step.href)}
                    className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${
                      step.done ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"
                    }`}
                  >
                    {step.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-1.5">
              <button
                type="button"
                onClick={() => setIsMenuRolledUp(false)}
                className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                Show role details
              </button>
            </div>
          )}
        </section>
        ) : null}

        <section id="workflow-guide" className={`${useCompactWorkflowGuide ? "mb-2 rounded-2xl p-2" : "mb-3 rounded-[1.25rem] p-2.5"} border border-[#d7e3f4] bg-[linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] shadow-sm ${isFirstTimeMinimalMode || useCompactWorkflowGuide ? "hidden" : activeStep === "workflow" ? "" : "hidden"}`}>
          <button
            type="button"
            onClick={() => toggleSection("workflow")}
            aria-expanded={openSections.workflow}
            className={`flex w-full justify-between gap-3 text-left ${useCompactWorkflowGuide ? "items-center" : "items-start"}`}
          >
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                {useCompactWorkflowGuide ? "Momentum" : "Guide"}
              </div>
              <h2 className={`${useCompactWorkflowGuide ? "text-sm" : "mt-0.5 text-base"} font-semibold tracking-tight text-[#0f172a]`}>
                {useCompactWorkflowGuide ? "Ready to keep moving" : "Next best step"}
              </h2>
              <div className={`${useCompactWorkflowGuide ? "mt-0.5" : "mt-1"} flex flex-wrap items-center gap-1.5`}>
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${sectionHeaderMeta.workflow.badgeClass}`}>
                  {sectionHeaderMeta.workflow.badgeLabel}
                </span>
                <span className="text-xs text-neutral-600">
                  {useCompactWorkflowGuide ? "Use the workspace above for saved assets, follow-ups, and live role execution." : sectionHeaderMeta.workflow.prompt}
                </span>
              </div>
            </div>
            <span className="rounded-full border border-neutral-300 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-600">
              {useCompactWorkflowGuide ? (openSections.workflow ? "Hide" : "Show") : openSections.workflow ? "Collapse" : "Expand"}
            </span>
          </button>

          {openSections.workflow ? (
            <div className="mt-2 space-y-1.5">
              {useCompactWorkflowGuide ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#0a66c2]/20 bg-white px-2.5 py-1.5">
                  <p className="text-xs text-neutral-700">
                    <span className="font-semibold text-[#0f172a]">Setup complete.</span>{" "}
                    Keep working from Application Workspace and open details only when you need the full checklist.
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {workflowPrimaryAction ? (
                      <button
                        type="button"
                        onClick={() => openAndScroll(workflowPrimaryAction.sectionKey, workflowPrimaryAction.href)}
                        className="rounded-full border border-[#0a66c2] bg-[#0a66c2] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#0958a8]"
                      >
                        {workflowPrimaryAction.actionLabel || "Open step"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setIsWorkflowGuideExpanded((current) => !current)}
                      className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                    >
                      {isWorkflowGuideExpanded ? "Less details" : "More details"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-[#0a66c2]/20 bg-white px-2.5 py-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                          Setup {completionCount}/{preparationSteps.length}
                        </span>
                        {priorityItems.length > 0 ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-800">
                            {priorityItems.length} priority
                          </span>
                        ) : null}
                      </div>
                      {workflowPrimaryAction ? (
                        <button
                          type="button"
                          onClick={() => openAndScroll(workflowPrimaryAction.sectionKey, workflowPrimaryAction.href)}
                          className="rounded-full border border-[#0a66c2] bg-[#0a66c2] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#0958a8]"
                        >
                          {workflowPrimaryAction.actionLabel || "Open step"}
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-neutral-700">
                      <span className="font-semibold text-[#0f172a]">Next step:</span>{" "}
                      {isWorkflowComplete && !hasLiveExecutionActivity
                        ? "Core setup is complete. Stay in momentum with saved files, follow-ups, and live role execution."
                        : workflowPrimaryAction?.description || "Move to document refinement or live role execution."}
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setIsWorkflowGuideExpanded((current) => !current)}
                      className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                    >
                      {isWorkflowGuideExpanded ? "Less details" : "More details"}
                    </button>
                  </div>
                </>
              )}

              {isWorkflowGuideExpanded ? (
                <>
                  <div className="rounded-xl border border-neutral-200 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Workflow status</div>
                        <p className="mt-0.5 text-xs text-neutral-600">Core stages, current readiness, and the next practical action.</p>
                      </div>
                      <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                        {completionCount}/{preparationSteps.length} complete
                      </span>
                    </div>
                    <div className="mt-2 grid gap-1.5 md:grid-cols-2 xl:grid-cols-4">
                      {simpleWorkflowSteps.map((step) => (
                        <button
                          key={`simple-${step.id}`}
                          type="button"
                          onClick={() => openAndScroll(step.sectionKey, step.href)}
                          className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-left transition hover:border-neutral-300 hover:bg-white"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="truncate text-xs font-semibold text-neutral-900">{step.title}</div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] ${
                                step.ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {step.ready ? "Ready" : "Next"}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-neutral-600">{step.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                    <div className="rounded-xl border border-neutral-200 bg-white p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Priority queue</div>
                      {strengthOrderedNextSteps.length > 0 ? (
                        <div className="mt-2 space-y-1.5">
                          {strengthOrderedNextSteps.map((step, index) => (
                            <button
                              key={`strength-priority-${step.id}`}
                              type="button"
                              onClick={() => openAndScroll(step.sectionKey, step.href)}
                              className="flex w-full items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-left transition hover:border-neutral-300 hover:bg-white"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-semibold text-neutral-900">{step.title}</span>
                                <span className="block truncate text-[11px] text-neutral-600">{step.actionLabel}</span>
                              </span>
                              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-neutral-600">{index + 1}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs leading-5 text-neutral-600">
                          No blockers. Continue with saved files, follow-ups, and live role execution.
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl border border-neutral-200 bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Checklist</div>
                        <div className="text-[11px] font-medium text-neutral-500">{strengthWorkflowLabel} guidance</div>
                      </div>
                      <div className="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-neutral-50">
                        {preparationSteps.map((step, index) => (
                          <button
                            key={step.title}
                            type="button"
                            onClick={() => openAndScroll(step.sectionKey, step.href)}
                            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition hover:bg-white"
                          >
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold ${
                                step.done ? "bg-emerald-100 text-emerald-700" : "bg-neutral-200 text-neutral-700"
                              }`}
                            >
                              {step.done ? "OK" : index + 1}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-semibold text-neutral-900">{step.title}</span>
                              <span className="block truncate text-[11px] text-neutral-600">{step.description}</span>
                            </span>
                            <span className="hidden shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500 md:inline">
                              {step.actionLabel}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : null}

            </div>
          ) : null}
        </section>

        <section id="saved-library" className={`mb-5 rounded-3xl border border-[#d9e6f2] bg-[linear-gradient(180deg,#fcfdff_0%,#f3f8fc_100%)] p-4 shadow-sm ${activeStep === "documents" && !isWizardFocusActive ? "" : "hidden"}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Saved library</div>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#0f172a]">Saved files</h2>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Total saved outputs</div>
              <div className="mt-0.5 text-lg font-semibold">{assets.length}</div>
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700">
              {latestSavedAsset ? (
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700">Latest saved output</div>
                  <div className="mt-0.5 truncate font-semibold text-neutral-900">{latestSavedAsset.title || "Untitled file"}</div>
                  <div className="mt-0.5 truncate text-[11px] text-neutral-500">
                    Latest saved | {formatAssetType(latestSavedAsset.asset_type)}
                    {latestSavedAsset.created_at ? ` | ${new Date(latestSavedAsset.created_at).toLocaleString()}` : ""}
                  </div>
                </div>
              ) : (
                <span>No saved files yet. Generate an output and it will appear here.</span>
              )}
              {latestSavedAssetTarget ? (
                <button
                  type="button"
                  onClick={() => latestSavedAsset ? openSavedAsset(latestSavedAsset) : null}
                  className="rounded-full border border-[#0a66c2] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0a66c2] hover:bg-[#e8f3ff]"
                >
                  Open latest
                </button>
              ) : null}
            </div>
            <div className="ui-action-row">
              <button
                type="button"
                onClick={() => setIsSavedWorkExpanded((current) => !current)}
                aria-expanded={isSavedWorkExpanded}
                className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                {isSavedWorkExpanded ? "Hide recent files" : "Show recent files"}
              </button>
              <button
                type="button"
                onClick={() => setIsFindSavedWorkExpanded((current) => !current)}
                aria-expanded={isFindSavedWorkExpanded}
                className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                {isFindSavedWorkExpanded ? "Hide search" : "Find a file"}
              </button>
            </div>
          </div>

          {isSavedWorkExpanded ? (
            <div className="mt-3 space-y-2">
              <div className="rounded-xl border border-neutral-200 bg-white p-2.5">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Recent files</div>
                {recentSavedAssets.length === 0 ? (
                  <p className="text-xs text-neutral-600">No saved files yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {recentSavedAssets.slice(0, 8).map((asset) => {
                      return (
                        <button
                          key={`recent-row-${asset.id}`}
                          type="button"
                          onClick={() => openSavedAsset(asset)}
                          className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-left transition hover:border-neutral-300 hover:bg-white"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">{formatAssetType(asset.asset_type)}</div>
                            <div className="truncate text-xs font-semibold text-neutral-900">{asset.title || "Untitled file"}</div>
                            <div className="mt-0.5 text-[11px] text-neutral-600">
                              {asset.created_at ? new Date(asset.created_at).toLocaleString() : "Recently"}
                            </div>
                          </div>
                          <span className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                            Open
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-neutral-200 bg-white p-2.5">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">File categories</div>
                <div className="flex flex-wrap gap-2">
                  {savedLibraryLinks.map((link) => (
                    <button
                      key={`saved-link-${link.href}`}
                      type="button"
                      onClick={() => openAndScroll(getSectionKeyForSavedLink(link.href), link.href)}
                      className="rounded-full border border-neutral-300 bg-neutral-50 px-2.5 py-1 text-[10px] font-semibold text-neutral-700 hover:bg-white"
                    >
                      {link.label} ({link.count})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {isFindSavedWorkExpanded ? (
            <div className="mt-3 space-y-2">
              <div className="rounded-xl border border-neutral-200 bg-white p-2.5">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Find saved files</div>
                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_200px]">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">Search</label>
                    <input
                      value={savedSearch}
                      onChange={(event) => setSavedSearch(event.target.value)}
                      className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-neutral-500"
                      placeholder="Search CV, cover letter, dossier..."
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">Type</label>
                    <select
                      value={savedAssetTypeFilter}
                      onChange={(event) => setSavedAssetTypeFilter(event.target.value)}
                      className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-neutral-500"
                    >
                      {savedLibraryAssetTypes.map((assetType) => (
                        <option key={assetType} value={assetType}>
                          {assetType === "all" ? "All file types" : formatAssetType(assetType)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {filteredLatestSavedAssets.length === 0 ? (
                <p className="text-xs text-neutral-600">
                  {assets.length === 0 ? "No saved files yet." : "No files match that search."}
                </p>
              ) : (
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {filteredLatestSavedAssets.slice(0, 9).map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => openSavedAsset(asset)}
                      className="rounded-xl border border-neutral-200 bg-white p-3 text-left transition hover:border-neutral-300 hover:shadow-sm"
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-600">{formatAssetType(asset.asset_type)}</div>
                      <div className="mt-1.5 line-clamp-2 text-sm font-semibold leading-5 text-neutral-900">{asset.title || "Untitled file"}</div>
                      <div className="mt-1 text-[11px] text-neutral-500">
                        {asset.created_at ? new Date(asset.created_at).toLocaleString() : "Recently"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </section>

        <div className="space-y-5">
          <aside className="hidden">
            <div className="rounded-[2rem] border border-[#d5e1ef] bg-[linear-gradient(180deg,#ffffff_0%,#f6f9fc_100%)] p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5b6b7c]">Career Intelligence</div>
              <div className="mt-2 text-2xl font-semibold">{candidate.full_name || "Candidate"}</div>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                Move top to bottom. Each section builds on the one before it, and every output saves back into this workspace.
              </p>

              <div className="mt-5 rounded-2xl border border-[#d8e4f2] bg-[#f6f9fc] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5b6b7c]">Progress</div>
                <div className="mt-2 text-3xl font-semibold">
                  {completionCount}/{preparationSteps.length}
                </div>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  Completed workflow steps in this workspace.
                </p>
              </div>

              <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Next best action</div>
                <div className="mt-2 text-base font-semibold text-sky-950">
                  {activeBackgroundJobs.length > 0 || activeLiveJobRuns.length > 0
                    ? "Background work is running. You can keep moving through the workspace."
                    : nextUndoneStep?.title || "Everything essential is in place. Keep refining and tailoring."}
                </div>
                <p className="mt-2 text-sm leading-6 text-sky-900">
                  {activeBackgroundJobs.length > 0 || activeLiveJobRuns.length > 0
                    ? "New outputs will land in the saved-file sections as soon as processing completes."
                    : nextUndoneStep?.description || "Use the dossier, interview prep, and live jobs sections to move into execution."}
                </p>
                {nextUndoneStep && activeBackgroundJobs.length === 0 && activeLiveJobRuns.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => openAndScroll(nextUndoneStep.sectionKey, nextUndoneStep.href)}
                    className="mt-3 inline-flex rounded-full border border-sky-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-sky-800 hover:bg-sky-100"
                  >
                    {nextUndoneStep.actionLabel}
                  </button>
                ) : null}
              </div>

              <div className="mt-5 rounded-2xl border border-[#d8e4f2] bg-[#f6f9fc] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5b6b7c]">Campaign view</div>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  Research, outreach, application, interview, and follow-up in one line of sight.
                </p>
                <div className="mt-4">
                  <WorkspaceCampaignLane steps={campaignLane} compact onStepClick={openAndScroll} />
                </div>
              </div>

              {priorityItems.length > 0 ? (
                <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">Needs attention</div>
                  <div className="mt-3 space-y-3">
                    {priorityItems.slice(0, 3).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openAndScroll(item.sectionKey, item.href)}
                        className="block w-full rounded-2xl border border-rose-200 bg-white px-4 py-3 text-left transition hover:border-rose-300 hover:bg-rose-50"
                      >
                        <div className="font-semibold text-neutral-900">{item.title}</div>
                        <p className="mt-1 text-sm leading-6 text-neutral-600">{item.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {urgentSectionKey ? (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">Urgent workflow section</div>
                  <div className="mt-2 text-base font-semibold text-amber-950">
                    {workflowLinkStatuses.find((link) => link.sectionKey === urgentSectionKey)?.label || "Open the next urgent section"}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-amber-950">
                    {todayBoardItems[0]?.description || nextUndoneStep?.description || "This is the next section most likely to unblock progress."}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      openAndScroll(
                        workflowLinkStatuses.find((link) => link.sectionKey === urgentSectionKey)?.sectionKey || "workflow",
                        workflowLinkStatuses.find((link) => link.sectionKey === urgentSectionKey)?.href || "#workflow-guide"
                      )
                    }
                    className="mt-3 inline-flex rounded-full border border-amber-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-amber-900 hover:bg-amber-100"
                  >
                    Open urgent section
                  </button>
                </div>
              ) : null}

              <nav className="mt-5 space-y-2">
                {workflowLinkStatuses.map((link) => (
                  <button
                    key={link.href}
                    type="button"
                    onClick={() => openAndScroll(link.sectionKey, link.href)}
                    className={`block w-full rounded-2xl px-4 py-3 text-left transition ${
                      link.isActive
                        ? `${workflowLinkToneClass(link.sectionKey)} shadow-sm ring-1 ring-sky-300`
                        : link.isUrgent
                          ? "border-rose-200 bg-rose-50 shadow-sm hover:bg-white"
                        : `${workflowLinkToneClass(link.sectionKey)} opacity-90 hover:opacity-100 hover:shadow-sm`
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-semibold text-neutral-900">{link.label}</div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${link.badgeClass}`}>
                        {link.badgeLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-neutral-600">{link.description}</p>
                  </button>
                ))}
              </nav>

              <div className="mt-5 border-t border-neutral-200 pt-5">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5b6b7c]">Saved files</div>
                <div className="mt-3 space-y-2">
                  {savedLibraryLinks.map((link) => (
                    <button
                      key={`saved-${link.href}`}
                      type="button"
                      onClick={() => openAndScroll(getSectionKeyForSavedLink(link.href), link.href)}
                      className={`block w-full rounded-2xl border px-4 py-3 text-left transition hover:shadow-sm ${savedLinkToneClass(link.tone)}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-neutral-900">{link.label}</div>
                        <span className="rounded-full bg-white/80 px-2 py-1 text-xs font-semibold text-neutral-700">{link.count}</span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-neutral-600">{link.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">Engine-room input</div>
                <p className="mt-2 text-sm leading-6 text-amber-950">
                  Gallup Strengths is still the highest-value supporting document for better positioning and more human cover letters.
                </p>
              </div>
            </div>
          </aside>

          <div className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <section className={`rounded-3xl border border-neutral-200 bg-white p-3 shadow-sm md:p-4 ${activeStep === "workflow" && (!isGuidedMode || showAdvancedTools) && shouldShowTodayAtGlance ? "" : "hidden"}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold">Today focus</h2>
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                    {priorityItems.length} priority items
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTodayAtGlanceExpanded((current) => !current)}
                    className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                  >
                    {isTodayAtGlanceExpanded ? "Hide details" : "Show details"}
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                <div className="min-w-0 flex-1 text-sm text-neutral-800">
                  <span className="font-semibold">Next best action:</span>{" "}
                  {nextUndoneStep?.actionLabel || "Continue refining your saved documents and role strategy."}
                </div>
                {priorityItems[0] ? (
                  <button
                    type="button"
                    onClick={() => openAndScroll(priorityItems[0].sectionKey, priorityItems[0].href)}
                    className="rounded-full border border-[#0a66c2] bg-[#0a66c2] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#0958a8]"
                  >
                    Open priority
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openAndScroll("workflow", "#workflow-guide")}
                    className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                  >
                    Open next step
                  </button>
                )}
              </div>
              {isTodayAtGlanceExpanded ? (
                <>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Needs attention</div>
                      <div className="mt-1 text-sm font-semibold text-neutral-900">{priorityItems.length}</div>
                    </div>
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Running now</div>
                      <div className="mt-1 text-sm font-semibold text-neutral-900">{hasLiveExecutionActivity ? activeBackgroundJobs.length + activeLiveJobRuns.length : 0}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openAndScroll("documents", "#saved-library")}
                      className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-left hover:bg-neutral-50 sm:col-span-2"
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Saved outputs</div>
                      <div className="mt-1 text-sm font-semibold text-neutral-900">Open saved files</div>
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {priorityItems.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setShowPriorityDetails((current) => !current)}
                        className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                      >
                        {showPriorityDetails ? "Hide details" : "Show details"}
                      </button>
                    ) : null}
                  </div>
                  {priorityItems.length === 0 ? (
                    <p className="mt-3 text-xs text-neutral-600">Nothing urgent right now. Keep moving through the steps.</p>
                  ) : showPriorityDetails ? (
                    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {priorityItems.map((item) => (
                        <PriorityCard
                          key={item.id}
                          title={item.title}
                          description={item.description}
                          tone={item.tone}
                          actionLabel={item.actionLabel}
                          onClick={() => openAndScroll(item.sectionKey, item.href)}
                        />
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}
            </section>

            {showWorkflowSecondary ? (
            <section className={`rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm md:p-5 ${activeStep === "workflow" ? "" : "hidden"}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold">Recent files</h2>
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                  {latestOutputHighlights.length} files
                </div>
              </div>
              {latestOutputHighlights.length === 0 ? (
                <EmptyStateActionCard
                  className="mt-3"
                  title="No generated outputs yet"
                  description="Start with the positioning section, then generate the first saved assets so this workspace begins building reusable application material."
                  actionLabel={hasProfile ? "Open document tools" : "Generate positioning"}
                  onClick={() => openAndScroll(hasProfile ? "documents" : "positioning", hasProfile ? "#document-actions" : "#generate-profile")}
                />
              ) : (
                <>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {latestOutputHighlights.slice(0, 4).map((asset) => {
                      return (
                        <button
                          key={`recent-compact-${asset.id}`}
                          type="button"
                          onClick={() => openSavedAsset(asset)}
                          className={`min-w-0 rounded-xl border px-3 py-2 text-left hover:bg-white ${asset.id === latestSavedAsset?.id ? "border-emerald-200 bg-emerald-50" : "border-neutral-200 bg-neutral-50"}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">{formatAssetType(asset.asset_type)}</div>
                            {asset.id === latestSavedAsset?.id ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                                Newest
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-[11px] font-semibold text-neutral-900 [overflow-wrap:anywhere]">{asset.title || "Untitled output"}</div>
                          <div className="mt-1 text-[10px] text-neutral-500">{asset.created_at ? new Date(asset.created_at).toLocaleString() : "Recently"}</div>
                        </button>
                      )
                    })}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => openAndScroll("documents", "#saved-library")}
                      className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                    >
                      Open saved library
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRecentFilesDetails((current) => !current)}
                      className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                    >
                      {showRecentFilesDetails ? "Hide details" : "Show details"}
                    </button>
                  </div>
                  {showRecentFilesDetails ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {latestOutputHighlights.map((asset) => {
                        return (
                          <button
                            key={`latest-${asset.id}`}
                            type="button"
                            onClick={() => openSavedAsset(asset)}
                            className={`min-w-0 overflow-hidden rounded-2xl border p-4 text-left transition hover:shadow-sm ${assetToneClass(asset.asset_type)}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-neutral-600">{formatAssetType(asset.asset_type)}</div>
                              {asset.id === latestSavedAsset?.id ? (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                                  Newest
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-2 text-sm font-semibold leading-5 text-neutral-900 [overflow-wrap:anywhere]">
                              {asset.title || "Untitled output"}
                            </div>
                            <div className="mt-2 text-xs leading-5 text-neutral-500 [overflow-wrap:anywhere]">
                              {formatAssetType(asset.asset_type)} | Version {asset.version ?? "?"} {asset.created_at ? `| ${new Date(asset.created_at).toLocaleString()}` : ""}
                            </div>
                            <div className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">Open saved file</div>
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </>
              )}
            </section>
            ) : null}
            </div>

            {showWorkflowSecondary && latestApplicationSprintJob ? (
              <details className={`group rounded-3xl border border-[#c7d2fe] bg-[linear-gradient(135deg,#eef2ff_0%,#f8fafc_55%,#ffffff_100%)] p-6 shadow-sm ${activeStep === "workflow" ? "" : "hidden"}`}>
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-3xl">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4f46e5]">Application sprint status</div>
                    <h2 className="mt-2 text-xl font-semibold text-[#0f172a]">
                      {latestApplicationSprintJobTitle || "Target role sprint"}
                      {latestApplicationSprintCompany ? ` | ${latestApplicationSprintCompany}` : ""}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[#475569]">
                      {latestApplicationSprintJob.status === "completed"
                        ? latestApplicationSprintJob.result_summary || "The latest application sprint has completed and saved its outputs into this workspace."
                        : latestApplicationSprintJob.status === "failed"
                          ? latestApplicationSprintJob.error_message || "The latest application sprint failed before finishing."
                          : "This application sprint is still running in the background. You can keep working elsewhere in the workspace while outputs continue to save."}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Sprint status</div>
                    <div className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${
                      latestApplicationSprintJob.status === "completed"
                        ? "bg-emerald-100 text-emerald-700"
                        : latestApplicationSprintJob.status === "failed"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-sky-100 text-sky-700"
                    }`}>
                      {formatRunStatus(latestApplicationSprintJob.status)}
                    </div>
                    <div className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500 group-open:hidden">Expand</div>
                    <div className="mt-2 hidden text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500 group-open:block">Collapse</div>
                  </div>
                </div>
                </summary>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {applicationSprintChecklist.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => openAndScroll(item.sectionKey, item.href)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        item.complete
                          ? "border-emerald-200 bg-emerald-50 hover:border-emerald-300"
                          : latestApplicationSprintJob.status === "failed"
                            ? "border-rose-200 bg-rose-50 hover:border-rose-300"
                            : "border-[#cbd5e1] bg-white hover:border-[#94a3b8]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">{item.label}</div>
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${
                            item.complete
                              ? "bg-emerald-100 text-emerald-700"
                              : latestApplicationSprintJob.status === "failed"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-sky-100 text-sky-700"
                          }`}
                        >
                          {item.complete ? "Ready" : latestApplicationSprintJob.status === "failed" ? "Blocked" : "Pending"}
                        </span>
                      </div>
                      <div className="mt-3 font-semibold text-neutral-900">{item.complete ? "Saved and ready to review" : "Still to be completed"}</div>
                      <p className="mt-2 text-sm leading-6 text-neutral-600">
                        {item.complete
                          ? "Open the saved output."
                          : latestApplicationSprintJob.status === "failed"
                            ? "Review the tracker, then retry the sprint or rerun the specific tool."
                            : "This output will appear here when the sprint finishes."}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <button
                    type="button"
                    onClick={() => openAndScroll("company", "#current-company-dossiers")}
                    className="rounded-2xl border border-[#cbd5e1] bg-white p-4 text-left transition hover:border-[#94a3b8]"
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Company intelligence</div>
                    <div className="mt-2 font-semibold text-neutral-900">Open dossier</div>
                    <p className="mt-2 text-sm leading-6 text-neutral-600">Review the latest employer insight dossier.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => openAndScroll("jobs", "#current-fit-analysis")}
                    className="rounded-2xl border border-[#cbd5e1] bg-white p-4 text-left transition hover:border-[#94a3b8]"
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Role fit</div>
                    <div className="mt-2 font-semibold text-neutral-900">Open fit analysis</div>
                    <p className="mt-2 text-sm leading-6 text-neutral-600">See the latest fit score and risks.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => openAndScroll("jobs", "#current-salary-analysis")}
                    className="rounded-2xl border border-[#cbd5e1] bg-white p-4 text-left transition hover:border-[#94a3b8]"
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Compensation</div>
                    <div className="mt-2 font-semibold text-neutral-900">Open salary view</div>
                    <p className="mt-2 text-sm leading-6 text-neutral-600">Review the latest salary analysis.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => openAndScroll("documents", "#current-cover-letters")}
                    className="rounded-2xl border border-[#cbd5e1] bg-white p-4 text-left transition hover:border-[#94a3b8]"
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Application letter</div>
                    <div className="mt-2 font-semibold text-neutral-900">Open cover letter</div>
                    <p className="mt-2 text-sm leading-6 text-neutral-600">Refine the latest tailored letter.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => openAndScroll("interview", "#current-interview-prep")}
                    className="rounded-2xl border border-[#cbd5e1] bg-white p-4 text-left transition hover:border-[#94a3b8]"
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Interview readiness</div>
                    <div className="mt-2 font-semibold text-neutral-900">Open interview pack</div>
                    <p className="mt-2 text-sm leading-6 text-neutral-600">Jump straight into the latest interview prep.</p>
                  </button>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => openAndScroll("documents", "#document-actions")}
                    className="rounded-full border border-[#94a3b8] bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-[#f8fafc]"
                  >
                    Launch another sprint
                  </button>
                  <button
                    type="button"
                    onClick={() => openAndScroll("documents", "#document-actions")}
                    className="rounded-full border border-[#94a3b8] bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-[#f8fafc]"
                  >
                    Open sprint tools
                  </button>
                  {sprintRelatedApplication ? (
                    <button
                      type="button"
                      onClick={() => openAndScroll("documents", "#document-workbench")}
                      className="rounded-full border border-[#94a3b8] bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-[#f8fafc]"
                    >
                      Open linked application
                    </button>
                  ) : null}
                </div>
              </details>
            ) : null}

            {showWorkflowSecondary ? (
            <details className={`group rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm md:p-5 ${activeStep === "workflow" ? "" : "hidden"}`}>
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Background activity</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                    Long-running work keeps going after it starts, so users can move around the workspace without losing progress.
                  </p>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Running now</div>
                  <div className="mt-1 text-2xl font-semibold">{activeBackgroundJobs.length + activeLiveJobRuns.length}</div>
                  <div className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500 group-open:hidden">Expand</div>
                  <div className="mt-2 hidden text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500 group-open:block">Collapse</div>
                </div>
              </div>
              </summary>
              <div className="mt-3">
              {trackerMessage ? <p className="mt-3 text-sm text-neutral-700">{trackerMessage}</p> : null}
              {backgroundJobs.length === 0 && liveJobRuns.length === 0 ? (
                <p className="mt-3 text-sm text-neutral-600">Long-running generation jobs and live searches will appear here once they are started.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {backgroundJobs.map((job) => (
                    <div
                      key={job.id}
                      className={`rounded-2xl border p-4 ${backgroundRunCardClass(job.status, isRunTakingLongerThanExpected(job))}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">{formatBackgroundJobType(job.job_type)}</div>
                          <div className="mt-1 text-sm text-neutral-700">
                            {job.status === "queued" || job.status === "running"
                              ? isRunTakingLongerThanExpected(job)
                                ? `This job is taking longer than expected. It may still finish, but the user should be able to keep moving or retry.`
                                : job.result_summary || "This background job is processing in the background. You can keep working while it finishes."
                              : job.result_summary || "This background job is processing or waiting."}
                          </div>
                          {job.error_message ? <p className="mt-2 text-sm text-rose-700">{job.error_message}</p> : null}
                        </div>
                        <div className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${
                          backgroundRunBadgeClass(job.status, isRunTakingLongerThanExpected(job))
                        }`}>
                          {isRunTakingLongerThanExpected(job) ? "Needs attention" : formatRunStatus(job.status)}
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-neutral-400">
                        Started: {job.created_at ? new Date(job.created_at).toLocaleString() : "Unknown"}
                        {["queued", "running"].includes(job.status || "") ? ` | Running: ${formatElapsedRunTime(job)}` : ""}
                        {job.completed_at ? ` | Finished: ${new Date(job.completed_at).toLocaleString()}` : ""}
                      </div>
                      {job.status === "queued" || job.status === "running" ? (
                        <div className="mt-3 rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-xs text-neutral-700">
                          <div className="font-semibold uppercase tracking-[0.08em] text-neutral-600">Progress stage</div>
                          <div className="mt-1">{getBackgroundRunStage(job.status, isRunTakingLongerThanExpected(job))}</div>
                          <div className="mt-2 text-neutral-600">{getWhileYouWaitSuggestionForBackgroundJob(job.job_type)}</div>
                        </div>
                      ) : null}
                      <div className="ui-action-row mt-4">
                        {job.status === "queued" || job.status === "running" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                const target = getResultAnchorForBackgroundJob(job.job_type)
                                openAndScroll(target.sectionKey, target.href)
                              }}
                              className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                            >
                              Open related area
                            </button>
                            {isRunTakingLongerThanExpected(job) ? (
                              <button
                                type="button"
                                onClick={() => void handleRetryBackgroundJob(job.id)}
                                className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                              >
                                Retry now
                              </button>
                            ) : null}
                          </>
                        ) : null}
                        {job.status === "completed" ? (
                          <button
                            type="button"
                            onClick={() => {
                              const target = getResultAnchorForBackgroundJob(job.job_type)
                              openAndScroll(target.sectionKey, target.href)
                            }}
                            className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                          >
                            Open result
                          </button>
                        ) : null}
                        {job.status === "failed" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleRetryBackgroundJob(job.id)}
                              className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                            >
                              Retry
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const target = getRecoveryAnchorForBackgroundJob(job.job_type)
                                openAndScroll(target.sectionKey, target.href)
                              }}
                              className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                            >
                              Adjust inputs
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {liveJobRuns.map((run) => (
                    <div
                      key={run.id}
                      className={`rounded-2xl border p-4 ${backgroundRunCardClass(run.status, isRunTakingLongerThanExpected(run))}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">Live job search</div>
                          <div className="mt-1 text-sm text-neutral-700">
                            {run.target_role || "Untitled role search"}
                            {run.location ? ` | ${run.location}` : ""} |{" "}
                            {isRunTakingLongerThanExpected(run) ? "Taking longer than expected" : formatRunStatus(run.status)}
                          </div>
                          {run.error_message ? <p className="mt-2 text-sm text-rose-700">{run.error_message}</p> : null}
                        </div>
                        <div className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${
                          backgroundRunBadgeClass(run.status, isRunTakingLongerThanExpected(run))
                        }`}>
                          {isRunTakingLongerThanExpected(run) ? "Needs attention" : formatRunStatus(run.status)}
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-neutral-400">
                        Started: {run.created_at ? new Date(run.created_at).toLocaleString() : "Unknown"}
                        {["queued", "running"].includes(run.status || "") ? ` | Running: ${formatElapsedRunTime(run)}` : ""}
                        {run.completed_at ? ` | Finished: ${new Date(run.completed_at).toLocaleString()}` : ""}
                      </div>
                      {run.status === "queued" || run.status === "running" ? (
                        <div className="mt-3 rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-xs text-neutral-700">
                          <div className="font-semibold uppercase tracking-[0.08em] text-neutral-600">Progress stage</div>
                          <div className="mt-1">{getBackgroundRunStage(run.status, isRunTakingLongerThanExpected(run))}</div>
                          <div className="mt-2 text-neutral-600">{getWhileYouWaitSuggestionForLiveRun(run)}</div>
                        </div>
                      ) : null}
                      <div className="ui-action-row mt-4">
                        {run.status === "queued" || run.status === "running" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openAndScroll("jobs", "#current-live-opportunities")}
                              className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                            >
                              Open search area
                            </button>
                            {isRunTakingLongerThanExpected(run) ? (
                              <button
                                type="button"
                                onClick={() => void handleRetryLiveJobRun(run.id)}
                                className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                              >
                                Retry now
                              </button>
                            ) : null}
                          </>
                        ) : null}
                        {run.status === "completed" ? (
                          <button
                            type="button"
                            onClick={() => openAndScroll("jobs", "#current-live-opportunities")}
                            className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                          >
                            Open result
                          </button>
                        ) : null}
                        {run.status === "failed" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleRetryLiveJobRun(run.id)}
                              className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                            >
                              Retry
                            </button>
                            <button
                              type="button"
                              onClick={() => openAndScroll("jobs", "#live-job-search")}
                              className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                            >
                              Adjust search
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </div>
            </details>
            ) : null}

            <section id="source-material" className={`rounded-[1.5rem] border border-[#d8e7f5] bg-[linear-gradient(180deg,#fbfdff_0%,#f1f8ff_100%)] p-3 shadow-sm ${activeStep === "source" || isFirstTimeMinimalMode ? "" : "hidden"}`}>
              <button
                type="button"
                onClick={() => toggleSection("source")}
                aria-expanded={openSections.source}
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">Step 1</span>
                    <h2 className="text-base font-semibold tracking-tight text-[#0f172a]">Load career inputs</h2>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${sectionHeaderMeta.source.badgeClass}`}>
                      {sectionHeaderMeta.source.badgeLabel}
                    </span>
                    {sourceWizardFocusMode ? (
                      <span className="rounded-full border border-[#0a66c2] bg-[#e8f3ff] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0a66c2]">
                        Agent focus
                      </span>
                    ) : null}
                    {openSections.source ? <span className="break-words text-xs text-neutral-600">{sectionHeaderMeta.source.prompt}</span> : null}
                  </div>
                </div>
                <span className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
                  {openSections.source ? "Collapse" : "Expand"}
                </span>
              </button>

              {openSections.source ? (
                <div className={stepContentCompactClass}>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5">
                <div className="text-[10px] text-neutral-700">
                  <span className="font-semibold">Start here:</span> Add CV, Gallup Strengths, LinkedIn, then any extra proof.
                </div>
                <button
                  type="button"
                  onClick={() => toggleSectionContext("source")}
                  className="ui-compact-pill"
                >
                  {showSectionContext.source ? "Hide details" : "Show details"}
                </button>
              </div>
              <div className="rounded-xl border border-sky-200 bg-white px-3 py-2 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-700">Before you start</div>
                    <h3 className="mt-1 text-sm font-semibold text-neutral-950">Have these ready before you begin</h3>
                    <p className="mt-1 max-w-3xl text-xs leading-5 text-neutral-600">
                      Keep the first pass simple. Load the CV first, add Gallup Strengths second, then add LinkedIn and any supporting proof you already have.
                    </p>
                  </div>
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-700">
                    {sourceChecklist.filter((item) => item.ready).length}/{sourceChecklist.length} ready
                  </span>
                </div>
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-4 text-amber-950">
                  <span className="font-semibold">Do not miss:</span> Gallup Strengths is the strongest personalization input in Career Intelligence. If you have it, add it early.
                </div>
                <div className="mt-2 grid gap-1.5 md:grid-cols-2 xl:grid-cols-4">
                  {sourcePrepItems.map((item) => (
                    <div
                      key={item.label}
                      className={`rounded-lg border px-2.5 py-2 ${
                        item.ready ? "border-emerald-200 bg-emerald-50" : "border-neutral-200 bg-neutral-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-xs font-semibold text-neutral-900">{item.label}</div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] ${
                            item.ready ? "bg-emerald-100 text-emerald-700" : "bg-white text-neutral-600"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-4 text-neutral-600">{item.detail}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-2 grid gap-1.5 lg:grid-cols-3">
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">Best order</div>
                    <p className="mt-1 text-[11px] leading-4 text-neutral-600">1. CV  2. Gallup Strengths  3. LinkedIn  4. Extra proof</p>
                  </div>
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">LinkedIn tip</div>
                    <p className="mt-1 text-[11px] leading-4 text-neutral-600">Use a LinkedIn PDF export or paste your headline, About, Experience, and Skills.</p>
                  </div>
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">Optional proof</div>
                    <p className="mt-1 text-[11px] leading-4 text-neutral-600">Old cover letters, recruiter feedback, achievements, and target-role notes can all be added later.</p>
                  </div>
                </div>
              </div>
              {showSectionContext.source && showStepGuidance && !sourceWizardFocusMode ? (
                <>
                  <SectionGuideBanner
                    className="mt-5"
                    statusLabel={sectionActionGuides.source.statusLabel}
                    summary={sectionActionGuides.source.summary}
                    actionLabel={sectionActionGuides.source.actionLabel}
                    tone="source"
                    onClick={() => openAndScroll("source", sectionActionGuides.source.href)}
                  />
                  <SectionSubnav
                    className="mt-4"
                    title="Inside career inputs"
                    items={[
                      { label: "Add files", href: "#source-material" },
                      { label: "Loaded source mix", href: "#source-material" },
                      { label: "Source files", href: "#source-material" },
                    ]}
                    onClick={(href) => openAndScroll("source", href)}
                  />
                </>
              ) : null}
              <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                <div className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700">
                  Core inputs first: CV and Gallup Strengths. Then add LinkedIn and any supporting proof you have.
                  <span
                    title={loadedSourceSummaryTitle}
                    className="ml-2 inline-flex max-w-full items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700"
                  >
                    {loadedSourceSummaryLabel}
                  </span>
                </div>
              </div>

              <div className="mt-3">
                <CareerSourceSetupWizard candidateId={candidate.id} existingDocuments={documents} />
              </div>

              {sourceWizardFocusMode ? (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#c7dcff] bg-[#eef6ff] px-3 py-2 text-xs text-[#0a4a82]">
                  <span>
                    Guided setup is handling the remaining {sourceRemainingCount} source {sourceRemainingCount === 1 ? "step" : "steps"}.
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSourceSecondaryPanels((current) => !current)}
                    className="rounded-full border border-[#0a66c2] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0a66c2] hover:bg-[#e8f3ff]"
                  >
                    {showSourceSecondaryPanels ? "Hide details" : "Show details"}
                  </button>
                </div>
              ) : null}

              {showSectionContext.source && showSourceSupplementary ? (
                <>
              <details className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.14em] text-neutral-600">
                  Extra guidance
                </summary>
                <div className="mt-2 grid gap-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
                    Start with CV + Gallup Strengths, then add LinkedIn and supporting proof.
                  </div>
                  <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700">
                    Input quality: <span className="font-semibold">{sourcePackStrength}</span> | Loaded:{" "}
                    <span className="font-semibold">{loadedSourceSummaryLabel}</span>
                  </div>
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-950">
                    {hasStrengthThemes
                      ? `Strength-led tip: include examples that show ${strengthsSummary}.`
                      : "Strength-led tip: add Gallup Strengths now to unlock personalized wording in every step."}
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
                    Next: {!hasCv ? "Add CV" : !hasGallupStrengths ? "Add strengths" : !hasLinkedIn ? "Add LinkedIn" : "Add proof"}
                  </div>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {sourceChecklist.map((item) => (
                    <SourceStatusCard
                      key={item.label}
                      label={item.label}
                      status={item.ready ? "Ready" : "Missing"}
                      description={item.hint}
                      tone={item.tone}
                    />
                  ))}
                </div>
              </details>

              <div className="mt-6 rounded-3xl border border-neutral-200 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Source files</div>
                    <h3 className="mt-2 text-lg font-semibold">Loaded source material</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                      These are editable source inputs reused for positioning, documents, interview prep, and market outputs.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Editable inputs</div>
                    <div className="mt-1 text-2xl font-semibold">{documents.length}</div>
                  </div>
                </div>
                {documents.length === 0 ? (
                  <EmptyStateActionCard
                    className="mt-3"
                    title="No background material yet"
                    description="Add CV, Gallup Strengths, LinkedIn text, and notes to enrich the profile before generating positioning and application assets."
                    actionLabel="Load source files"
                    onClick={() => openAndScroll("source", "#source-material")}
                  />
                ) : (
                  <div className="mt-4 space-y-3">
                    {documents.map((doc) => (
                      <div key={doc.id} className="rounded-2xl border border-neutral-200 p-4">
                        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">{doc.source_type || "source"}</div>
                            <div className="mt-1 font-semibold">{doc.title || "Untitled document"}</div>
                          </div>
                          <div className="text-xs text-neutral-400">{doc.created_at ? new Date(doc.created_at).toLocaleString() : ""}</div>
                        </div>
                        <CareerSourceDocumentEditor
                          documentId={doc.id}
                          initialSourceType={doc.source_type || "notes"}
                          initialTitle={doc.title || ""}
                          initialContent={doc.content_text || ""}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
                </>
              ) : null}
                </div>
              ) : null}
            </section>

            <section id="positioning" className={`rounded-[1.5rem] border border-[#dde2fb] bg-[linear-gradient(180deg,#fcfcff_0%,#f3f4ff_100%)] p-3 shadow-sm ${activeStep === "positioning" ? "" : "hidden"}`}>
              <button
                type="button"
                onClick={() => toggleSection("positioning")}
                aria-expanded={openSections.positioning}
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">Step 2</span>
                    <h2 className="text-base font-semibold tracking-tight text-[#0f172a]">Build your profile</h2>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${sectionHeaderMeta.positioning.badgeClass}`}>
                      {sectionHeaderMeta.positioning.badgeLabel}
                    </span>
                    {openSections.positioning ? <span className="break-words text-xs text-neutral-600">{sectionHeaderMeta.positioning.prompt}</span> : null}
                  </div>
                </div>
                <span className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
                  {openSections.positioning ? "Collapse" : "Expand"}
                </span>
              </button>

              {openSections.positioning ? (
                <div className={stepContentCompactClass}>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-2 py-1.5">
                  <div className="text-[11px] text-neutral-700">
                      <span className="font-semibold">Next:</span>{" "}
                      {latestProfile
                        ? "Create the first CV and LinkedIn drafts from this profile, then move into job search."
                        : "Generate your profile, then refine positioning."}
                    </div>
                    {latestProfile ? (
                      <button
                        type="button"
                        onClick={() => openAndScroll("documents", "#base-asset-generator")}
                        className="rounded-full border border-[#0a66c2] bg-[#0a66c2] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#004182]"
                      >
                        Create first CV + LinkedIn
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => toggleSectionContext("positioning")}
                      className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                    >
                      {showSectionContext.positioning ? "Hide details" : "Show details"}
                    </button>
                  </div>
                  {showSectionContext.positioning && showStepGuidance ? (
                    <>
                      <SectionGuideBanner
                        statusLabel={sectionActionGuides.positioning.statusLabel}
                        summary={sectionActionGuides.positioning.summary}
                        actionLabel={sectionActionGuides.positioning.actionLabel}
                        tone="positioning"
                        onClick={() =>
                          openAndScroll(hasProfile ? "documents" : "positioning", sectionActionGuides.positioning.href)
                        }
                      />
                      <SectionSubnav
                        title="Inside profile builder"
                        items={[
                          { label: "Create profile", href: "#generate-profile" },
                          { label: "Current positioning", href: "#positioning" },
                          { label: "Course recommendations", href: "#current-course-recommendations" },
                        ]}
                        onClick={(href) => openAndScroll("positioning", href)}
                      />
                    </>
                  ) : null}
                <section id="generate-profile" className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm md:p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-700">Profile builder</div>
                  <h2 className="mt-1 text-lg font-semibold">Current career positioning</h2>
                  <p className="mt-1 text-sm text-neutral-600">
                    {latestProfile
                      ? "Profile is ready. Use it to generate a refreshed CV, LinkedIn profile, cover letters, and job-search materials."
                      : "Generate the professional narrative before creating outward-facing assets."}
                  </p>
                </div>
                {latestProfile ? (
                  <CareerGenerateProfileButton candidateId={candidate.id} variant="inline" label="Generate new version" />
                ) : null}
              </div>
              {!latestProfile ? (
                <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Recommended next move</div>
                  <div className="mt-1 text-base font-semibold text-sky-950">No profile generated yet</div>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-sky-950">
                    Use the saved source material to generate the first career identity. The profile will appear here and power the CV,
                    LinkedIn, cover letter, and interview tools.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {documents.length > 0 ? (
                      <CareerGenerateProfileButton candidateId={candidate.id} variant="inline" label="Generate profile" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => openAndScroll("source", "#source-material")}
                        className="inline-flex rounded-full border border-sky-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-sky-800 hover:bg-sky-100"
                      >
                        Load source material
                      </button>
                    )}
                    <span className="text-xs text-sky-900">{documents.length} source {documents.length === 1 ? "file" : "files"} saved</span>
                  </div>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="grid gap-3 lg:grid-cols-[1.2fr,0.8fr]">
                    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">Professional narrative</div>
                      <div className="mt-2">
                        <div className="text-sm text-neutral-500">Career identity</div>
                        <div className="mt-1 text-lg font-semibold text-neutral-900">{latestProfile.career_identity}</div>
                      </div>
                      <div className="mt-3">
                        <div className="text-sm text-neutral-500">How the market should read this candidate</div>
                        <p className="mt-1 text-sm leading-6 text-neutral-800">{latestProfile.market_positioning}</p>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Narrative control panel</div>
                      <div className="mt-2 space-y-2">
                        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5">
                          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Seniority level</div>
                          <div className="mt-1 text-sm font-semibold text-neutral-900">{latestProfile.seniority_level || "Not defined yet"}</div>
                        </div>
                        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5">
                          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Primary target direction</div>
                          <div className="mt-1 text-sm font-semibold text-neutral-900">
                            {latestProfile.recommended_target_roles?.[0] || latestProfile.role_families?.[0] || "Not defined yet"}
                          </div>
                        </div>
                        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5">
                          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">What to improve next</div>
                          <div className="mt-1 text-sm leading-5 text-neutral-700">
                            {positioningGapItems[0] || "Use this brief to generate outward-facing assets and tailor it further with company intelligence."}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard
                      label="Seniority"
                      value={latestProfile.seniority_level || "Set next"}
                      tone={latestProfile.seniority_level ? "success" : "warning"}
                    />
                    <SummaryCard
                      label="Core strengths"
                      value={String(latestProfile.core_strengths?.length || 0)}
                      tone={latestProfile.core_strengths?.length ? "success" : "warning"}
                    />
                    <SummaryCard
                      label="Achievements"
                      value={String(latestProfile.signature_achievements?.length || 0)}
                      tone={latestProfile.signature_achievements?.length ? "success" : "warning"}
                    />
                    <SummaryCard
                      label="Open gaps"
                      value={String(positioningGapItems.length)}
                      tone={positioningGapItems.length === 0 ? "success" : "warning"}
                    />
                  </div>
                  <div className="rounded-xl border border-indigo-200 bg-white p-2.5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">Use this profile next</div>
                        <h3 className="mt-0.5 text-sm font-semibold text-neutral-900">Move from profile to outputs</h3>
                      </div>
                      <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">Best next move</div>
                        <div className="mt-0.5 text-xs font-semibold text-indigo-950">
                          {positioningGapItems.length > 0 ? "Refine the narrative" : "Generate application assets"}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 grid gap-1.5 md:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => openAndScroll("documents", "#document-actions")}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-left transition hover:shadow-sm"
                      >
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">Create assets</div>
                        <div className="mt-0.5 text-[13px] font-semibold text-neutral-900">Generate CV, LinkedIn, and letters</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => openAndScroll("company", "#company-dossier")}
                        className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-1.5 text-left transition hover:shadow-sm"
                      >
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Tailor the story</div>
                        <div className="mt-0.5 text-[13px] font-semibold text-neutral-900">Match narrative to target employers</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => openAndScroll("jobs", "#jobs")}
                        className="rounded-lg border border-violet-200 bg-violet-50 px-2 py-1.5 text-left transition hover:shadow-sm"
                      >
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">Test it in market</div>
                        <div className="mt-0.5 text-[13px] font-semibold text-neutral-900">Search live roles from this narrative</div>
                      </button>
                    </div>
                  </div>
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Narrative checklist</div>
                        <h3 className="mt-1 text-sm font-semibold">What is strong and what still needs work</h3>
                      </div>
                      <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Open gaps</div>
                        <div className="mt-0.5 text-base font-semibold">{positioningGapItems.length}</div>
                      </div>
                    </div>
                    <div className="mt-2 grid gap-1.5 md:grid-cols-2">
                      <CompactNarrativeStatus
                        label="Career identity"
                        status={latestProfile.career_identity ? "Ready" : "Missing"}
                        detail={latestProfile.career_identity ? "Identity anchor is set." : "Create the core identity first."}
                        tone={latestProfile.career_identity ? "success" : "warning"}
                      />
                      <CompactNarrativeStatus
                        label="Market positioning"
                        status={latestProfile.market_positioning ? "Ready" : "Missing"}
                        detail={latestProfile.market_positioning ? "Positioning story is reusable." : "Add a clear positioning summary."}
                        tone={latestProfile.market_positioning ? "success" : "warning"}
                      />
                      <CompactNarrativeStatus
                        label="Role families"
                        status={latestProfile.role_families?.length ? "Ready" : "Missing"}
                        detail={latestProfile.role_families?.length ? "Role clusters are mapped." : "Clarify role families."}
                        tone={latestProfile.role_families?.length ? "success" : "warning"}
                      />
                      <CompactNarrativeStatus
                        label="Recommended roles"
                        status={latestProfile.recommended_target_roles?.length ? "Ready" : "Missing"}
                        detail={latestProfile.recommended_target_roles?.length ? "Role targets are suggested." : "Add role recommendations."}
                        tone={latestProfile.recommended_target_roles?.length ? "success" : "warning"}
                      />
                    </div>
                    {positioningGapItems.length > 0 ? (
                      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">Refine next</div>
                        <div className="mt-1.5 space-y-1">
                          {positioningGapItems.map((item) => (
                            <div key={item} className="text-xs leading-5 text-neutral-700">
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <ListBlock title="Core strengths" items={latestProfile.core_strengths} />
                    <ListBlock title="Signature achievements" items={latestProfile.signature_achievements} />
                    <ListBlock title="Role families" items={latestProfile.role_families} />
                    <ListBlock title="Skills" items={latestProfile.skills} />
                    <ListBlock title="Risks or gaps" items={latestProfile.risks_or_gaps} />
                    <ListBlock title="Recommended target roles" items={latestProfile.recommended_target_roles} />
                  </div>
                </div>
              )}
                </section>

                <HistoryArchiveSection
                  eyebrow="Version trail"
                  title="Positioning history"
                  countLabel="Saved positioning versions"
                  count={profiles.length}
                  emptyMessage="Version history will appear here once you generate positioning outputs."
                >
                  {profiles.map((profile) => (
                    <CompactHistoryCard
                      key={profile.id}
                      title={`Version ${profile.profile_version ?? "?"}`}
                      subtitle={profile.career_identity || "No career identity"}
                      timestamp={profile.created_at ? new Date(profile.created_at).toLocaleString() : ""}
                      preview={profile.market_positioning || ""}
                      actionLabel="Open current positioning brief"
                      onClick={() => openAndScroll("positioning", "#positioning")}
                    />
                  ))}
                </HistoryArchiveSection>

                <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm md:p-5">
                  <h2 className="text-xl font-semibold">Learning and course search</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                    Search for relevant courses and certifications based on the CV, Gallup Strengths, and target-role direction so the candidate can close the right gaps.
                  </p>
                  <div className="mt-5">
                    <CareerCourseRecommendations candidateId={candidate.id} suggestedTargetRole={suggestedTargetRole} />
                  </div>
                </section>

                <section id="current-course-recommendations" className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm md:p-5">
                  <h2 className="text-xl font-semibold">Current course recommendations</h2>
                  {latestCourseRecommendations.length === 0 ? (
                    <p className="mt-3 text-sm text-neutral-600">Generate course recommendations and the latest learning plan will appear here.</p>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {latestCourseRecommendations.map((asset) => (
                        <div key={asset.id} className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-neutral-400">
                            <span>
                              {formatAssetType(asset.asset_type)} | v{asset.version ?? "?"}
                            </span>
                            <span>{asset.created_at ? new Date(asset.created_at).toLocaleString() : ""}</span>
                          </div>
                          <CareerAssetEditor
                            candidateId={candidate.id}
                            assetType={asset.asset_type || "course_recommendations"}
                            initialTitle={asset.title || "Untitled course recommendations"}
                            initialContent={asset.content || ""}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <HistoryArchiveSection
                  eyebrow="Version trail"
                  title="Course recommendation history"
                  countLabel="Saved learning plans"
                  count={courseRecommendationHistory.length}
                  emptyMessage="Saved learning recommendations will appear here after the first course search run."
                >
                  {courseRecommendationHistory.map((asset) => (
                    <CompactHistoryCard
                      key={asset.id}
                      title={asset.title || "Untitled course recommendations"}
                      subtitle={`${formatAssetType(asset.asset_type)} | Version ${asset.version ?? "?"}`}
                      timestamp={asset.created_at ? new Date(asset.created_at).toLocaleString() : ""}
                      preview={summarizeAssetContent(asset.content)}
                      actionLabel="Open current learning plan"
                      onClick={() => openAndScroll("positioning", "#current-course-recommendations")}
                    />
                  ))}
                </HistoryArchiveSection>
                </div>
              ) : null}
            </section>

            <section id="document-workbench" className={`rounded-[1.25rem] border border-[#d8ebe4] bg-[linear-gradient(180deg,#fcfffd_0%,#f1fbf7_100%)] p-2.5 shadow-sm ${activeStep === "documents" ? "" : "hidden"}`}>
              <button
                type="button"
                onClick={() => toggleSection("documents")}
                aria-expanded={openSections.documents}
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">Step 3</span>
                    <h2 className="text-base font-semibold tracking-tight text-[#0f172a]">Create CV + LinkedIn assets</h2>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${sectionHeaderMeta.documents.badgeClass}`}>
                      {sectionHeaderMeta.documents.badgeLabel}
                    </span>
                    {openSections.documents ? <span className="break-words text-xs text-neutral-600">{sectionHeaderMeta.documents.prompt}</span> : null}
                  </div>
                </div>
                <span className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
                  {openSections.documents ? "Collapse" : "Expand"}
                </span>
              </button>

              {openSections.documents ? (
                <div className={stepContentCompactClass}>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-2 py-1.5">
                <div className="text-[11px] text-neutral-700">
                  <span className="font-semibold">Next:</span> Generate base CV + LinkedIn assets. Tailor them to a role when you have one.
                </div>
                <button
                  type="button"
                  onClick={() => toggleSectionContext("documents")}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  {showSectionContext.documents ? "Hide details" : "Show details"}
                </button>
              </div>
              {showSectionContext.documents && showStepGuidance ? (
                <>
                  <SectionGuideBanner
                    className="mb-3"
                    statusLabel={sectionActionGuides.documents.statusLabel}
                    summary={sectionActionGuides.documents.summary}
                    actionLabel={sectionActionGuides.documents.actionLabel}
                    tone="documents"
                    onClick={() => openAndScroll("documents", sectionActionGuides.documents.href)}
                  />
                  <SectionSubnav
                    className="mb-3"
                    title="Inside asset builder"
                    items={[
                      { label: "Generate base assets", href: "#base-asset-generator" },
                      { label: "Tailor to a role", href: "#target-role-tracker" },
                      { label: "Current documents", href: "#current-application-documents" },
                      { label: "Cover letters", href: "#current-cover-letters" },
                    ]}
                    onClick={(href) => openAndScroll("documents", href)}
                  />
                </>
              ) : null}
              <section id="base-asset-generator" className="mb-2.5 rounded-xl border border-sky-200 bg-sky-50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-3xl">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Recommended next move</div>
                    <h3 className="mt-1 text-base font-semibold text-sky-950">Your profile is ready. Create the base assets first.</h3>
                    <p className="mt-1 text-xs leading-5 text-sky-950">
                      Generate the reusable CV and LinkedIn drafts before asking the user for a target role. Role tracking and tailored cover letters can come after the base materials exist.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openAndScroll("documents", "#base-asset-generator-action")}
                      className="rounded-full bg-black px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-neutral-800"
                    >
                      Open generator
                    </button>
                    <button
                      type="button"
                      onClick={() => openAndScroll("documents", "#target-role-tracker")}
                      className="rounded-full border border-sky-300 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-sky-800 hover:bg-sky-100"
                    >
                      Add target role first
                    </button>
                  </div>
                </div>
              </section>
              <div id="base-asset-generator-action" className="mb-2.5">
                <CareerGenerateAssetsButton candidateId={candidate.id} />
              </div>
              {showSectionContext.documents ? (
              <section className="mb-2.5 rounded-xl border border-neutral-200 bg-neutral-50 p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Application lane</div>
                    <p className="mt-1 text-xs text-neutral-700">Pick role, align company language, tailor assets, then track and follow up.</p>
                  </div>
                  <div className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700">
                    Ready {applicationFlowSteps.filter((step) => step.ready).length}/{applicationFlowSteps.length}
                  </div>
                </div>
                <div className="mt-2 grid gap-1.5 md:grid-cols-2 xl:grid-cols-4">
                  {applicationFlowSteps.map((step) => (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => openAndScroll(step.sectionKey, step.href)}
                      className={`rounded-lg border px-2 py-1.5 text-left transition ${
                        step.ready ? "border-emerald-300 bg-emerald-50" : "border-neutral-200 bg-white hover:border-neutral-300"
                      }`}
                    >
                      <div className="text-[11px] font-semibold text-neutral-900">{step.title}</div>
                      <div className="mt-1 text-[10px] leading-4 text-neutral-600">{step.description}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-2 rounded-lg border border-sky-200 bg-white px-2.5 py-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-700">Next action</div>
                  <div className="mt-0.5 text-xs font-semibold text-neutral-900">
                    {applicationFlowSteps.find((step) => !step.ready)?.title || "Application lane is set up well."}
                  </div>
                </div>
              </section>
              ) : null}

              <section id="target-role-tracker" className="mb-2.5 rounded-xl border border-neutral-200 bg-neutral-50 p-2.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Optional tailoring path</div>
                    <h3 className="mt-0.5 text-sm font-semibold">Add a target role when ready</h3>
                    <p className="mt-0.5 max-w-2xl text-[11px] leading-4 text-neutral-600">
                      Use this when the user has a real role to tailor against. It is not required before generating the base CV and LinkedIn drafts.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Tracked roles</div>
                      <div className="mt-0.5 text-base font-semibold">{applications.length}</div>
                    </div>
                    <div className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Active roles</div>
                      <div className="mt-0.5 text-base font-semibold">{activeApplications.length}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-2.5">
                  <CareerApplicationTracker
                    candidateId={candidate.id}
                    applications={applications}
                    coverLetterOptions={coverLetterHistory.map((asset) => ({ id: asset.id, title: asset.title }))}
                    companyDossierOptions={companyDossiers.map((asset) => ({ id: asset.id, title: asset.title }))}
                    outreachStrategyOptions={outreachStrategyHistory.map((asset) => ({ id: asset.id, title: asset.title }))}
                    recruiterMatchSearchOptions={recruiterMatchSearchHistory.map((asset) => ({ id: asset.id, title: asset.title }))}
                    salaryAnalysisOptions={salaryAnalysisHistory.map((asset) => ({ id: asset.id, title: asset.title }))}
                    fitAnalysisOptions={fitAnalysisHistory.map((asset) => ({ id: asset.id, title: asset.title, content: asset.content }))}
                  />
                </div>
              </section>

              <div id="document-actions" className="space-y-3">
                <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Document tools</div>
                      <h3 className="mt-0.5 text-sm font-semibold">Create application outputs</h3>
                    </div>
                    <div className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Order</div>
                      <div className="mt-0.5 text-[11px] font-semibold text-neutral-900">Assets → Letter → Support</div>
                    </div>
                  </div>
                  {showSectionContext.documents ? (
                    <div className="mt-2 grid gap-1.5 md:grid-cols-3">
                      <div className="rounded-lg border border-white/80 bg-white p-2.5">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">1. Base assets</div>
                        <p className="mt-0.5 text-[11px] leading-4 text-neutral-600">Generate CV and LinkedIn drafts first.</p>
                      </div>
                      <div className="rounded-lg border border-white/80 bg-white p-2.5">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">2. Tailored letter</div>
                        <p className="mt-0.5 text-[11px] leading-4 text-neutral-600">Create role or dossier-matched letter next.</p>
                      </div>
                      <div className="rounded-lg border border-white/80 bg-white p-2.5">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">3. Support documents</div>
                        <p className="mt-0.5 text-[11px] leading-4 text-neutral-600">Generate packs only when needed.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] text-neutral-700">
                      Order: Base assets, then tailored letter, then support documents.
                    </div>
                  )}
                </section>
                <CurrentTargetBriefCard
                  title="Current target brief"
                  brief={currentTargetBrief}
                  statusBadge={targetStatusBadgeLabel}
                />
                <CareerApplicationSprint
                  candidateId={candidate.id}
                  applicationSprintStatus={latestApplicationSprintJob?.status ?? null}
                  initialPrefill={currentTargetBrief}
                />
                <CareerCoverLetterGenerator candidateId={candidate.id} companyDossiers={companyDossiers} />
                <CareerStrategicDocumentGenerator candidateId={candidate.id} assetType="executive_interview_playbook" />
                <CareerStrategicDocumentGenerator candidateId={candidate.id} assetType="interview_training_pack" />
                <CareerStrategicDocumentGenerator candidateId={candidate.id} assetType="job_hit_list" />
              </div>

              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#b9d8c8] bg-[#ecf9f1] px-3 py-2 text-[11px] text-[#166534]">
                <span>
                  Secondary document panels are hidden to keep this workspace focused. Open when you want to review history or edit older versions.
                </span>
                <button
                  type="button"
                  onClick={() => setShowDocumentSecondaryPanels((current) => !current)}
                  className="rounded-full border border-[#2f855a] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#166534] hover:bg-[#f3fff8]"
                >
                  {showDocumentSecondaryPanels ? "Hide secondary panels" : "Show secondary panels"}
                </button>
              </div>

              {showDocumentSecondaryPanels ? (
              <>
              <div className="mt-4">
                <section id="current-application-documents" className="rounded-3xl border border-neutral-200 bg-white p-3 shadow-sm sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Document workbench</div>
                  <h2 className="mt-1 text-lg font-semibold">Current application documents</h2>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-600">
                    Open and edit the latest CV, LinkedIn, and strategy drafts.
                  </p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 sm:px-3 sm:py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Latest types</div>
                  <div className="mt-0.5 text-lg font-semibold">{[...latestDraftsByType.values()].length}</div>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-700">CV</div>
                  <div className="mt-1 truncate text-xs font-semibold text-neutral-900">{latestCvDraft?.title || "No CV draft yet"}</div>
                </div>
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-700">LinkedIn</div>
                  <div className="mt-1 truncate text-xs font-semibold text-neutral-900">{latestLinkedInDraft?.title || "No LinkedIn draft yet"}</div>
                </div>
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">Strategy</div>
                  <div className="mt-1 truncate text-xs font-semibold text-neutral-900">{latestStrategyDraft?.title || "No strategy doc yet"}</div>
                </div>
              </div>

              {draftHistory.length === 0 ? (
                <p className="mt-3 text-xs text-neutral-600">Generate CV, LinkedIn, or strategy drafts and they will appear here.</p>
              ) : (
                <details className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 p-2 sm:mt-3 sm:p-3" open={!isFirstTimeMinimalMode}>
                  <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 sm:text-xs">
                    Open editable drafts ({[...latestDraftsByType.values()].length})
                  </summary>
                  <div className="mt-3 space-y-4">
                    {[...latestDraftsByType.values()].map((asset) => (
                      <div key={asset.id} className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-neutral-400">
                          <span>
                            {formatAssetType(asset.asset_type)} | v{asset.version ?? "?"}
                          </span>
                          <span>{asset.created_at ? new Date(asset.created_at).toLocaleString() : ""}</span>
                        </div>
                        <CareerAssetEditor
                          candidateId={candidate.id}
                          assetType={asset.asset_type || "cv_summary"}
                          initialTitle={asset.title || "Untitled asset"}
                          initialContent={asset.content || ""}
                        />
                      </div>
                    ))}
                  </div>
                </details>
              )}
                </section>
              </div>

              <div className="mt-6">
                <section id="current-cover-letters" className="rounded-3xl border border-neutral-200 bg-white p-3 shadow-sm sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Letter workbench</div>
                  <h2 className="mt-1 text-lg font-semibold">Current cover letters</h2>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-600">
                    Refine the latest letter and reuse earlier versions when needed.
                  </p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 sm:px-3 sm:py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Saved letters</div>
                  <div className="mt-0.5 text-lg font-semibold">{coverLetterHistory.length}</div>
                </div>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Latest letter</div>
                  <div className="mt-1 text-xs font-semibold text-neutral-900">{latestCoverLetters[0]?.title || "No cover letter yet"}</div>
                </div>
                <button
                  type="button"
                  onClick={() => openAndScroll("company", latestCompanyDossiers[0] ? "#current-company-dossiers" : "#company-dossier")}
                  className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-left transition hover:border-sky-300"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">Tone matching</div>
                  <div className="mt-1 text-xs font-semibold text-neutral-900">
                    {latestCompanyDossiers[0] ? "Company dossier linked" : "No company dossier linked"}
                  </div>
                </button>
              </div>

              {latestCoverLetters.length === 0 ? (
                <p className="mt-3 text-xs text-neutral-600">Generate a cover letter and it will appear here.</p>
              ) : (
                <details className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 p-2 sm:mt-3 sm:p-3" open={!isFirstTimeMinimalMode}>
                  <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 sm:text-xs">
                    Open editable letters ({latestCoverLetters.length})
                  </summary>
                  <div className="mt-3 space-y-4">
                    {latestCoverLetters.map((asset) => (
                      <div key={asset.id} className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-neutral-400">
                          <span>
                            {formatAssetType(asset.asset_type)} | v{asset.version ?? "?"}
                          </span>
                          <span>{asset.created_at ? new Date(asset.created_at).toLocaleString() : ""}</span>
                        </div>
                        <CareerAssetEditor
                          candidateId={candidate.id}
                          assetType={asset.asset_type || "cover_letter"}
                          initialTitle={asset.title || "Untitled cover letter"}
                          initialContent={asset.content || ""}
                        />
                      </div>
                    ))}
                  </div>
                </details>
              )}
                </section>
              </div>

              <div className="mt-6">
                <HistoryArchiveSection
                  eyebrow="Version trail"
                  title="Application document history"
                  countLabel="Saved versions"
                  count={draftHistory.length}
                  emptyMessage="Document history will appear here after the first CV, LinkedIn, or strategy document generation run."
                >
                  {draftHistory.map((asset) => (
                    <CompactHistoryCard
                      key={asset.id}
                      title={asset.title || "Untitled asset"}
                      subtitle={`${formatAssetType(asset.asset_type)} | Version ${asset.version ?? "?"}`}
                      timestamp={asset.created_at ? new Date(asset.created_at).toLocaleString() : ""}
                      preview={summarizeAssetContent(asset.content)}
                      actionLabel="Open current document area"
                      onClick={() => openAndScroll("documents", "#current-application-documents")}
                    />
                  ))}
                </HistoryArchiveSection>
              </div>
              </>
              ) : null}
                </div>
              ) : null}
            </section>

            <section id="company-dossier" className={`rounded-[1.5rem] border border-[#d6eaf0] bg-[linear-gradient(180deg,#fbfeff_0%,#eef8fb_100%)] p-3 shadow-sm ${activeStep === "company" ? "" : "hidden"}`}>
              <button
                type="button"
                onClick={() => toggleSection("company")}
                aria-expanded={openSections.company}
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">Step 4</span>
                    <h2 className="text-base font-semibold tracking-tight text-[#0f172a]">Research target companies</h2>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${sectionHeaderMeta.company.badgeClass}`}>
                      {sectionHeaderMeta.company.badgeLabel}
                    </span>
                    {openSections.company ? <span className="break-words text-xs text-neutral-600">{sectionHeaderMeta.company.prompt}</span> : null}
                  </div>
                </div>
                <span className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
                  {openSections.company ? "Collapse" : "Expand"}
                </span>
              </button>

              {openSections.company ? (
                <div className={stepContentCompactClass}>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-2 py-1.5">
                    <div className="text-[11px] text-neutral-700">
                      <span className="font-semibold">Next:</span> Generate company dossier, then align message and outreach.
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSectionContext("company")}
                      className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                    >
                      {showSectionContext.company ? "Hide details" : "Show details"}
                    </button>
                  </div>
                  {showSectionContext.company && showStepGuidance ? (
                    <>
                      <SectionGuideBanner
                        className="mt-5"
                        statusLabel={sectionActionGuides.company.statusLabel}
                        summary={sectionActionGuides.company.summary}
                        actionLabel={sectionActionGuides.company.actionLabel}
                        tone="company"
                        onClick={() => openAndScroll("company", sectionActionGuides.company.href)}
                      />
                      <SectionSubnav
                        className="mt-4"
                        title="Inside company research"
                        items={[
                          { label: "Workflow", href: "#company-dossier" },
                          { label: "Dossiers", href: "#current-company-dossiers" },
                          { label: "Outreach", href: "#outreach-strategy" },
                        ]}
                        onClick={(href) => openAndScroll("company", href)}
                      />
                    </>
                  ) : null}
                  {showSectionContext.company ? (
                    <>
                      <p className="mt-4 max-w-2xl text-xs leading-5 text-neutral-600">
                        Research employer language first, then tailor letters and outreach from the same source.
                      </p>
                      <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-[11px] text-neutral-700">
                        Fast path: dossier first, outreach second, then letter edits.
                      </div>
                    </>
                  ) : null}
                  <div className="mt-5">
                    <CurrentTargetBriefCard
                      title="Current company focus"
                      description="Company research tools pick up the live target brief below. Update any field before running if this dossier is for a different employer."
                      brief={currentTargetBrief}
                      statusBadge={targetStatusBadgeLabel}
                    />
                  </div>
                  <div className="mt-5">
                    <CareerTargetCompanyWorkflow
                      candidateId={candidate.id}
                      targetWorkflowStatus={latestTargetCompanyWorkflowJob?.status ?? null}
                      initialPrefill={currentTargetBrief}
                    />
                  </div>
                  <div className="mt-5">
                    <CareerCompanyDossierGenerator candidateId={candidate.id} initialPrefill={currentTargetBrief} />
                  </div>
                  <div id="outreach-strategy" className="mt-5">
                    <CareerOutreachStrategyGenerator
                      candidateId={candidate.id}
                      completedCount={outreachStrategyHistory.length}
                      initialPrefill={currentTargetBrief}
                    />
                  </div>
                  {showSectionContext.company ? (
                    <>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => openAndScroll("company", latestCompanyDossiers[0] ? "#current-company-dossiers" : "#company-dossier")}
                      className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-left transition hover:border-sky-300"
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">Dossier</div>
                      <div className="mt-1 truncate text-xs font-semibold text-neutral-900">{latestCompanyDossiers[0]?.title || "No dossier yet"}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => openAndScroll("company", latestOutreachStrategies[0] ? "#current-outreach-strategies" : "#outreach-strategy")}
                      className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-left transition hover:border-cyan-300"
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-700">Outreach</div>
                      <div className="mt-1 truncate text-xs font-semibold text-neutral-900">{latestOutreachStrategies[0]?.title || "No outreach plan yet"}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => openAndScroll("documents", latestCoverLetters[0] ? "#current-cover-letters" : "#document-actions")}
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-left transition hover:border-emerald-300"
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Letter match</div>
                      <div className="mt-1 truncate text-xs font-semibold text-neutral-900">{latestCoverLetters[0]?.title || "No linked letter yet"}</div>
                    </button>
                  </div>
                  <div className="mt-4">
                    <section id="current-company-dossiers" className="rounded-3xl border border-neutral-200 bg-white p-3 shadow-sm sm:p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Research workbench</div>
                          <h2 className="mt-1 text-lg font-semibold">Current employer insight dossier</h2>
                          <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-600">
                            Review and refine the latest employer research.
                          </p>
                        </div>
                        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 sm:px-3 sm:py-2">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Saved dossiers</div>
                          <div className="mt-0.5 text-lg font-semibold">{companyDossiers.length}</div>
                        </div>
                      </div>
                      {latestCompanyDossiers.length === 0 ? (
                        <p className="mt-3 text-xs text-neutral-600">Generate a company dossier and it will appear here.</p>
                      ) : (
                        <details className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 p-2 sm:mt-3 sm:p-3" open={!isFirstTimeMinimalMode}>
                          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 sm:text-xs">
                            Open editable dossiers ({latestCompanyDossiers.length})
                          </summary>
                          <div className="mt-3 space-y-4">
                            {latestCompanyDossiers.map((asset) => (
                              <div key={asset.id} className="space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-neutral-400">
                                  <span>
                                    {formatAssetType(asset.asset_type)} | v{asset.version ?? "?"}
                                  </span>
                                  <span>{asset.created_at ? new Date(asset.created_at).toLocaleString() : ""}</span>
                                </div>
                                <CareerAssetEditor
                                  candidateId={candidate.id}
                                  assetType={asset.asset_type || "company_dossier"}
                                  initialTitle={asset.title || "Untitled company dossier"}
                                  initialContent={asset.content || ""}
                                />
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </section>
                  </div>
                  <div className="mt-4">
                    <section id="current-outreach-strategies" className="rounded-3xl border border-neutral-200 bg-white p-3 shadow-sm sm:p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Warm route workbench</div>
                          <h2 className="mt-1 text-lg font-semibold">Current outreach strategy</h2>
                          <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-600">
                            Keep the latest outreach plan ready for execution.
                          </p>
                        </div>
                        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 sm:px-3 sm:py-2">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Saved plans</div>
                          <div className="mt-0.5 text-lg font-semibold">{outreachStrategyHistory.length}</div>
                        </div>
                      </div>
                      {latestOutreachStrategies.length === 0 ? (
                        <p className="mt-3 text-xs text-neutral-600">Generate an outreach strategy and it will appear here.</p>
                      ) : (
                        <details className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 p-2 sm:mt-3 sm:p-3" open={!isFirstTimeMinimalMode}>
                          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 sm:text-xs">
                            Open editable outreach plans ({latestOutreachStrategies.length})
                          </summary>
                          <div className="mt-3 space-y-4">
                            {latestOutreachStrategies.map((asset) => (
                              <div key={asset.id} className="space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-neutral-400">
                                  <span>
                                    {formatAssetType(asset.asset_type)} | v{asset.version ?? "?"}
                                  </span>
                                  <span>{asset.created_at ? new Date(asset.created_at).toLocaleString() : ""}</span>
                                </div>
                                <CareerAssetEditor
                                  candidateId={candidate.id}
                                  assetType={asset.asset_type || "outreach_strategy"}
                                  initialTitle={asset.title || "Untitled outreach strategy"}
                                  initialContent={asset.content || ""}
                                />
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </section>
                  </div>
                  <div className="mt-4">
                    <HistoryArchiveSection
                      eyebrow="Version trail"
                      title="Outreach strategy history"
                      countLabel="Saved plans"
                      count={outreachStrategyHistory.length}
                      emptyMessage="Outreach strategy history will appear here after the first targeting plan is created."
                    >
                      {outreachStrategyHistory.map((asset) => (
                        <CompactHistoryCard
                          key={asset.id}
                          title={asset.title || "Untitled outreach strategy"}
                          subtitle={`${formatAssetType(asset.asset_type)} | Version ${asset.version ?? "?"}`}
                          timestamp={asset.created_at ? new Date(asset.created_at).toLocaleString() : ""}
                          preview={summarizeAssetContent(asset.content)}
                          actionLabel="Open current outreach plan"
                          onClick={() => openAndScroll("company", "#current-outreach-strategies")}
                        />
                      ))}
                    </HistoryArchiveSection>
                  </div>
                  <div className="mt-4">
                    <HistoryArchiveSection
                      eyebrow="Version trail"
                      title="Employer insight dossier history"
                      countLabel="Saved dossiers"
                      count={companyDossiers.length}
                      emptyMessage="Saved company research will appear here after the first dossier is generated."
                    >
                      {companyDossiers.map((asset) => (
                        <CompactHistoryCard
                          key={asset.id}
                          title={asset.title || "Untitled company dossier"}
                          subtitle={`${formatAssetType(asset.asset_type)} | Version ${asset.version ?? "?"}`}
                          timestamp={asset.created_at ? new Date(asset.created_at).toLocaleString() : ""}
                          preview={summarizeAssetContent(asset.content)}
                          actionLabel="Open current dossier"
                          onClick={() => openAndScroll("company", "#current-company-dossiers")}
                        />
                      ))}
                    </HistoryArchiveSection>
                  </div>
                    </>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section id="interview" className={`rounded-[1.5rem] border border-[#ede2c7] bg-[linear-gradient(180deg,#fffdf9_0%,#fbf6e9_100%)] p-3 shadow-sm ${activeStep === "interview" ? "" : "hidden"}`}>
              <button
                type="button"
                onClick={() => toggleSection("interview")}
                aria-expanded={openSections.interview}
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">Step 5</span>
                    <h2 className="text-base font-semibold tracking-tight text-[#0f172a]">Prepare interviews</h2>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${sectionHeaderMeta.interview.badgeClass}`}>
                      {sectionHeaderMeta.interview.badgeLabel}
                    </span>
                    {openSections.interview ? <span className="break-words text-xs text-neutral-600">{sectionHeaderMeta.interview.prompt}</span> : null}
                  </div>
                </div>
                <span className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
                  {openSections.interview ? "Collapse" : "Expand"}
                </span>
              </button>

              {openSections.interview ? (
                <div className={stepContentCompactClass}>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-2 py-1.5">
                    <div className="text-[11px] text-neutral-700">
                      <span className="font-semibold">Next:</span> Generate interview prep, then save reflections after interviews.
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSectionContext("interview")}
                      className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                    >
                      {showSectionContext.interview ? "Hide details" : "Show details"}
                    </button>
                  </div>
                  {showSectionContext.interview && showStepGuidance ? (
                    <>
                      <SectionGuideBanner
                        statusLabel={sectionActionGuides.interview.statusLabel}
                        summary={sectionActionGuides.interview.summary}
                        actionLabel={sectionActionGuides.interview.actionLabel}
                        tone="interview"
                        onClick={() => openAndScroll("interview", sectionActionGuides.interview.href)}
                      />
                      <SectionSubnav
                        title="Inside interview prep"
                        items={[
                          { label: "Prep generator", href: "#interview" },
                          { label: "Saved interview prep", href: "#current-interview-prep" },
                          { label: "Interview notes", href: "#recent-interview-assessments" },
                        ]}
                        onClick={(href) => openAndScroll("interview", href)}
                      />
                    </>
                  ) : null}
                  {showSectionContext.interview ? (
                    <>
                      <p className="max-w-2xl text-xs leading-5 text-neutral-600">
                        Build prep packs, then log interview reflections to improve the next round.
                      </p>
                      <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-[11px] text-neutral-700">
                        Fast path: prep pack first, reflection after interview.
                      </div>
                    </>
                  ) : null}
                <CurrentTargetBriefCard
                  title="Current interview brief"
                  description="Interview prep starts with the active target details already loaded, so the user only needs to adjust if this prep is for another role."
                  brief={currentTargetBrief}
                  statusBadge={targetStatusBadgeLabel}
                />
                <CareerInterviewPrepGenerator
                  candidateId={candidate.id}
                  interviewPrepStatus={latestInterviewPrepJob?.status ?? null}
                  initialPrefill={currentTargetBrief}
                />
                <CareerInterviewReflectionForm candidateId={candidate.id} />

                {showSectionContext.interview ? (
                  <>
                <div className="grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => openAndScroll("interview", "#current-interview-prep")}
                    className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left transition hover:border-amber-300"
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">Practice pack</div>
                    <div className="mt-1 truncate text-xs font-semibold text-neutral-900">{latestInterviewPrep[0]?.title || "No prep pack yet"}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => openAndScroll("interview", "#recent-interview-assessments")}
                    className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left transition hover:border-amber-300"
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">Reflection</div>
                    <div className="mt-1 truncate text-xs font-semibold text-neutral-900">{latestInterviewReflections[0]?.title || "No reflection yet"}</div>
                  </button>
                  <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">Coaching loop</div>
                    <div className="mt-1 text-xs font-semibold text-neutral-900">
                      {interviewReflections.length > 0 ? `${interviewReflections.length} reflections saved` : "Not started"}
                    </div>
                  </div>
                </div>

                <section id="current-interview-prep" className="rounded-3xl border border-neutral-200 bg-white p-3 shadow-sm sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Interview workbench</div>
                  <h2 className="mt-1 text-lg font-semibold">Current interview prep</h2>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-600">
                    Open and refine the latest prep pack.
                  </p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 sm:px-3 sm:py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Saved packs</div>
                  <div className="mt-0.5 text-lg font-semibold">{interviewPrepHistory.length}</div>
                </div>
              </div>
              {latestInterviewPrep.length === 0 ? (
                <p className="mt-3 text-xs text-neutral-600">Generate interview prep and it will appear here.</p>
              ) : (
                <details className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 p-2 sm:mt-3 sm:p-3" open={!isFirstTimeMinimalMode}>
                  <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 sm:text-xs">
                    Open editable prep packs ({latestInterviewPrep.length})
                  </summary>
                  <div className="mt-3 space-y-4">
                    {latestInterviewPrep.map((asset) => (
                      <div key={asset.id} className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-neutral-400">
                          <span>
                            {formatAssetType(asset.asset_type)} | v{asset.version ?? "?"}
                          </span>
                          <span>{asset.created_at ? new Date(asset.created_at).toLocaleString() : ""}</span>
                        </div>
                        <CareerAssetEditor
                          candidateId={candidate.id}
                          assetType={asset.asset_type || "interview_prep"}
                          initialTitle={asset.title || "Untitled interview prep"}
                          initialContent={asset.content || ""}
                        />
                      </div>
                    ))}
                  </div>
                </details>
              )}
                </section>

                <section id="recent-interview-assessments" className="rounded-3xl border border-neutral-200 bg-white p-3 shadow-sm sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Learning loop</div>
                  <h2 className="mt-1 text-lg font-semibold">Recent interview assessments</h2>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-600">
                    Capture what happened so next prep gets sharper.
                  </p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 sm:px-3 sm:py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Saved assessments</div>
                  <div className="mt-0.5 text-lg font-semibold">{interviewReflections.length}</div>
                </div>
              </div>
              {latestInterviewReflections.length === 0 ? (
                <p className="mt-3 text-xs text-neutral-600">Save an interview assessment and it will appear here.</p>
              ) : (
                <details className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 p-2 sm:mt-3 sm:p-3" open={!isFirstTimeMinimalMode}>
                  <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 sm:text-xs">
                    Open editable assessments ({latestInterviewReflections.length})
                  </summary>
                  <div className="mt-3 space-y-4">
                    {latestInterviewReflections.map((doc) => (
                      <div key={doc.id} className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-neutral-400">
                          <span>Interview Reflection</span>
                          <span>{doc.created_at ? new Date(doc.created_at).toLocaleString() : ""}</span>
                        </div>
                        <CareerSourceDocumentEditor
                          documentId={doc.id}
                          initialSourceType={doc.source_type || "interview_reflection"}
                          initialTitle={doc.title || "Interview reflection"}
                          initialContent={doc.content_text || ""}
                        />
                      </div>
                    ))}
                  </div>
                </details>
              )}
                </section>

                <HistoryArchiveSection
                  eyebrow="Version trail"
                  title="Interview prep history"
                  countLabel="Saved interview packs"
                  count={interviewPrepHistory.length}
                  emptyMessage="Interview prep history will appear here after the first interview prep generation run."
                >
                  {interviewPrepHistory.map((asset) => (
                    <CompactHistoryCard
                      key={asset.id}
                      title={asset.title || "Untitled interview prep"}
                      subtitle={`${formatAssetType(asset.asset_type)} | Version ${asset.version ?? "?"}`}
                      timestamp={asset.created_at ? new Date(asset.created_at).toLocaleString() : ""}
                      preview={summarizeAssetContent(asset.content)}
                      actionLabel="Open current interview prep"
                      onClick={() => openAndScroll("interview", "#current-interview-prep")}
                    />
                  ))}
                </HistoryArchiveSection>

                <HistoryArchiveSection
                  eyebrow="Learning trail"
                  title="Interview assessment history"
                  countLabel="Saved reflections"
                  count={interviewReflections.length}
                  emptyMessage="Interview assessment history will appear here after the first real interview reflection is saved."
                >
                  {interviewReflections.map((doc) => (
                    <CompactHistoryCard
                      key={doc.id}
                      title={doc.title || "Interview reflection"}
                      subtitle="Interview reflection"
                      timestamp={doc.created_at ? new Date(doc.created_at).toLocaleString() : ""}
                      preview={summarizeAssetContent(doc.content_text)}
                      actionLabel="Open current assessment area"
                      onClick={() => openAndScroll("interview", "#recent-interview-assessments")}
                    />
                  ))}
                </HistoryArchiveSection>
                  </>
                ) : null}
                </div>
              ) : null}
            </section>

            <section id="jobs" className={`rounded-[1.5rem] border border-[#dddff7] bg-[linear-gradient(180deg,#fcfcff_0%,#f2f4ff_100%)] p-3 shadow-sm ${activeStep === "jobs" ? "" : "hidden"}`}>
              <button
                type="button"
                onClick={() => toggleSection("jobs")}
                aria-expanded={openSections.jobs}
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">Step 6</span>
                    <h2 className="text-base font-semibold tracking-tight text-[#0f172a]">Search live opportunities</h2>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${sectionHeaderMeta.jobs.badgeClass}`}>
                      {sectionHeaderMeta.jobs.badgeLabel}
                    </span>
                    {openSections.jobs ? <span className="break-words text-xs text-neutral-600">{sectionHeaderMeta.jobs.prompt}</span> : null}
                  </div>
                </div>
                <span className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
                  {openSections.jobs ? "Collapse" : "Expand"}
                </span>
              </button>

              {openSections.jobs ? (
                <div className={stepContentCompactClass}>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-2 py-1.5">
                <div className="text-[11px] text-neutral-700">
                  <span className="font-semibold">Next:</span> Run live search, then shortlist and apply from saved roles.
                </div>
                <button
                  type="button"
                  onClick={() => toggleSectionContext("jobs")}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  {showSectionContext.jobs ? "Hide details" : "Show details"}
                </button>
              </div>
              <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-900">
                Search scope is currently <span className="font-semibold">New Zealand only</span>. International targeting is coming soon.
              </div>
              {showSectionContext.jobs && showStepGuidance ? (
                <>
                  <SectionGuideBanner
                    className="mt-3"
                    statusLabel={sectionActionGuides.jobs.statusLabel}
                    summary={sectionActionGuides.jobs.summary}
                    actionLabel={sectionActionGuides.jobs.actionLabel}
                    tone="jobs"
                    onClick={() => openAndScroll("jobs", sectionActionGuides.jobs.href)}
                  />
                  <SectionSubnav
                    className="mt-2"
                    title="Inside live jobs"
                    items={[
                      { label: "Start search", href: "#live-job-search" },
                      { label: "Premium autopilot", href: "#premium-autopilot" },
                      { label: "Live opportunities", href: "#current-live-opportunities" },
                      { label: "Recruiter routes", href: "#current-recruiter-match-searches" },
                      { label: "Salary analysis", href: latestSalaryAnalysis[0] ? "#current-salary-analysis" : "#salary-analysis" },
                      { label: "Fit analysis", href: latestFitAnalysis[0] ? "#current-fit-analysis" : "#fit-analysis" },
                    ]}
                    onClick={(href) => openAndScroll("jobs", href)}
                  />
                </>
              ) : null}
              {showSectionContext.jobs ? (
                <>
                  <p className="mt-3 max-w-2xl text-sm leading-5 text-neutral-600">
                    Search live openings, compare compensation, and map hidden-market targets before they advertise.
                  </p>
                  <div className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
                    Run search after profile + documents are ready. Results save below and background jobs keep running.
                  </div>
                </>
              ) : null}
              <div className="mt-3 rounded-2xl border border-[#c7dcff] bg-[#eef6ff] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0a66c2]">Premium automation</div>
                    <div className="mt-1 text-sm font-semibold text-[#0f172a]">Weekly Autopilot: search + dossier + cover letter drafts</div>
                    <p className="mt-1 text-xs text-neutral-700">
                      Set it once, then review weekly outputs before applying.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openAndScroll("jobs", "#premium-autopilot")}
                    className="rounded-xl border border-[#0a66c2] bg-[#0a66c2] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0958a8]"
                  >
                    Open Autopilot
                  </button>
                </div>
              </div>

              <div className="mt-5 rounded-3xl border border-neutral-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Pipeline lane</div>
                    <h3 className="mt-1 text-base font-semibold text-neutral-900">Search, review, then apply</h3>
                    <p className="mt-1 text-xs text-neutral-600">Use this lane to run jobs, auto-create drafts, then approve in queue.</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${latestLiveJobSearches[0] ? "border border-emerald-300 bg-emerald-50 text-emerald-800" : "border border-amber-300 bg-amber-50 text-amber-900"}`}>
                      {latestLiveJobSearches[0] ? "Live search ready" : "Run live search"}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${latestCompanyDossiers[0] ? "border border-emerald-300 bg-emerald-50 text-emerald-800" : "border border-sky-300 bg-sky-50 text-sky-800"}`}>
                      {latestCompanyDossiers[0] ? "Dossier ready" : "Dossier pending"}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${latestCoverLetters[0] ? "border border-emerald-300 bg-emerald-50 text-emerald-800" : "border border-violet-300 bg-violet-50 text-violet-800"}`}>
                      {latestCoverLetters[0] ? "Letter draft ready" : "Letter draft pending"}
                    </span>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "1. Live search", href: "#live-job-search", hint: "Find matching open roles." },
                    { label: "2. Autopilot", href: "#premium-autopilot", hint: "Automate dossier + letters." },
                    { label: "3. Review queue", href: "#premium-autopilot", hint: "Approve or reject bundles." },
                    { label: "4. Application tracker", href: "#document-workbench", hint: "Push approved roles to apply." },
                  ].map((item) => (
                    <button
                      key={item.href + item.label}
                      type="button"
                      onClick={() => openAndScroll("jobs", item.href)}
                      className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-left transition hover:border-neutral-300 hover:bg-white"
                    >
                      <div className="text-xs font-semibold text-neutral-900">{item.label}</div>
                      <div className="mt-1 text-[11px] leading-4 text-neutral-600">{item.hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <CurrentTargetBriefCard
                  title="Current market brief"
                  description="Market tools below preload the strongest active role in this workspace so recruiter search, salary analysis, and fit scoring can start from the same target."
                  brief={currentTargetBrief}
                  statusBadge={targetStatusBadgeLabel}
                />
              </div>

              <div id="premium-autopilot" className="mt-5">
                <CareerPremiumAutopilotPanel
                  candidateId={candidate.id}
                  suggestedTargetRole={suggestedTargetRole}
                  defaultLocation={candidate.city || ""}
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#cfcfe9] bg-[#f7f7ff] px-3 py-2 text-[11px] text-[#3730a3]">
                <span>
                  Advanced job analysis panels are hidden by default so you can focus on live search first.
                </span>
                <button
                  type="button"
                  onClick={() => setShowJobsSecondaryPanels((current) => !current)}
                  className="rounded-full border border-[#4f46e5] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#3730a3] hover:bg-[#f3f2ff]"
                >
                  {showJobsSecondaryPanels ? "Hide advanced panels" : "Show advanced panels"}
                </button>
              </div>

              {showJobsSecondaryPanels ? (
              <>
              <details className="mt-5 rounded-3xl border border-neutral-200 bg-neutral-50 p-5" open={!isFirstTimeMinimalMode}>
                <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Saved market comparisons</div>
                    <h3 className="mt-2 text-lg font-semibold">Recent live-search and market outputs</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                      Compare the latest live roles, recruiter routes, salary views, and fit analyses without needing to open each section first.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Visible comparisons</div>
                    <div className="mt-1 text-2xl font-semibold">{savedMarketComparisons.length}</div>
                  </div>
                </div>
                </summary>
                {savedMarketComparisons.length === 0 ? (
                  <EmptyStateActionCard
                    className="mt-4"
                    title="No market outputs saved yet"
                    description="Run live jobs, recruiter routes, salary analysis, or fit analysis and the newest market outputs will appear here for comparison."
                    actionLabel="Open market tools"
                    onClick={() => openAndScroll("jobs", "#jobs")}
                  />
                ) : (
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {savedMarketComparisons.map((asset) => {
                      return (
                        <button
                          key={`market-compare-${asset.id}`}
                          type="button"
                          onClick={() => openSavedAsset(asset)}
                          className={`rounded-2xl border p-4 text-left transition hover:shadow-sm ${assetToneClass(asset.asset_type)}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-600">
                              {formatAssetType(asset.asset_type)}
                            </div>
                            <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                              v{asset.version ?? "?"}
                            </span>
                          </div>
                          <div className="mt-3 font-semibold text-neutral-900">{asset.title || "Untitled market output"}</div>
                          <p className="mt-2 text-sm leading-6 text-neutral-600">{summarizeAssetContent(asset.content)}</p>
                          <div className="mt-3 text-xs text-neutral-500">
                            {asset.created_at ? new Date(asset.created_at).toLocaleString() : "Saved recently"}
                          </div>
                          <div className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700">Open comparison source</div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </details>

              <div id="deep-prospect-research" className="mt-5">
                <CareerDeepProspectResearch candidateId={candidate.id} suggestedTargetRole={suggestedTargetRole} />
              </div>

              <div className="mt-5">
                <CareerProfileJobSearchButton
                  candidateId={candidate.id}
                  targetRole={suggestedTargetRole}
                  location={candidate.city || ""}
                  supportingRoles={supportingTargetRoles}
                  careerIdentity={latestProfile?.career_identity || ""}
                />
              </div>

              <div id="live-job-search" className="mt-5">
                <CareerLiveJobFinder candidateId={candidate.id} />
              </div>

              <div id="recruiter-match-search" className="mt-5">
                <CareerRecruiterMatchSearch
                  candidateId={candidate.id}
                  suggestedTargetRole={suggestedTargetRole}
                  initialPrefill={currentTargetBrief}
                  applications={applications.map((application) => ({
                    id: application.id,
                    company_name: application.company_name,
                    job_title: application.job_title,
                    location: application.location,
                    notes: application.notes,
                  }))}
                />
              </div>

              <div id="salary-analysis" className="mt-5">
                <CareerSalaryAnalyzer
                  candidateId={candidate.id}
                  initialPrefill={currentTargetBrief}
                  applications={applications.map((application) => ({
                    id: application.id,
                    company_name: application.company_name,
                    job_title: application.job_title,
                    location: application.location,
                    job_url: application.job_url,
                    notes: application.notes,
                  }))}
                />
              </div>

              <div id="fit-analysis" className="mt-5">
                <CareerApplicationFitAnalyzer
                  candidateId={candidate.id}
                  initialPrefill={currentTargetBrief}
                  applications={applications.map((application) => ({
                    id: application.id,
                    company_name: application.company_name,
                    job_title: application.job_title,
                    location: application.location,
                    job_url: application.job_url,
                    notes: application.notes,
                  }))}
                />
              </div>

              <div className="mt-6">
                <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm md:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Search operations</div>
                      <h2 className="mt-2 text-xl font-semibold">Background job search runs</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                        These searches continue in the background, so the user can move around the workspace without losing progress.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Search runs</div>
                      <div className="mt-1 text-2xl font-semibold">{liveJobRuns.length}</div>
                    </div>
                  </div>
                  {liveJobRuns.length === 0 ? (
                    <p className="mt-3 text-sm text-neutral-600">Background live job searches will appear here after the first run is started.</p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {liveJobRuns.map((run) => (
                        <div key={run.id} className={`rounded-2xl border p-4 ${backgroundStatusCardClass(run.status)}`}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold">{run.target_role || "Untitled role search"}</div>
                              <div className="mt-1 text-sm text-neutral-700">
                                {run.location || "Any location"} | {formatRunStatus(run.status)}
                              </div>
                              {run.error_message ? <p className="mt-2 text-sm text-rose-700">{run.error_message}</p> : null}
                            </div>
                            <div
                              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${
                                run.status === "completed"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : run.status === "failed"
                                    ? "bg-rose-100 text-rose-700"
                                    : "bg-sky-100 text-sky-700"
                              }`}
                            >
                              {formatRunStatus(run.status)}
                            </div>
                          </div>
                          <div className="mt-3 text-xs text-neutral-400">
                            Started: {run.created_at ? new Date(run.created_at).toLocaleString() : "Unknown"}
                            {run.completed_at ? ` | Finished: ${new Date(run.completed_at).toLocaleString()}` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <div className="mt-6">
                <section id="current-deep-prospect-research" className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm md:p-5">
              <h2 className="text-xl font-semibold">Latest prospect research</h2>
              {latestDeepProspectResearch.length === 0 ? (
                <EmptyStateActionCard
                  className="mt-3"
                  title="No hidden-market prospect map yet"
                  description="Run deep prospect research to build a saved list of promising companies that may need this candidate before they advertise."
                  actionLabel="Start deep research"
                  onClick={() => openAndScroll("jobs", "#deep-prospect-research")}
                />
              ) : (
                <div className="mt-4 space-y-4">
                  {latestDeepProspectResearch.map((asset) => (
                    <div key={asset.id} className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-neutral-400">
                        <span>
                          {formatAssetType(asset.asset_type)} | v{asset.version ?? "?"}
                        </span>
                        <span>{asset.created_at ? new Date(asset.created_at).toLocaleString() : ""}</span>
                      </div>
                      <CareerAssetEditor
                        candidateId={candidate.id}
                        assetType={asset.asset_type || "deep_prospect_research"}
                        initialTitle={asset.title || "Untitled prospect research"}
                        initialContent={asset.content || ""}
                      />
                      <CareerProspectActionBoard candidateId={candidate.id} content={asset.content || ""} roleFamily={suggestedTargetRole} />
                    </div>
                  ))}
                </div>
              )}
                </section>
              </div>

              <div className="mt-6">
                <section id="current-recruiter-match-searches" className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Access workbench</div>
                  <h2 className="mt-2 text-xl font-semibold">Latest recruiter match search</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                    Keep the newest recruiter route here so the user can work beyond cold applications and widen access into the market.
                  </p>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Saved recruiter routes</div>
                  <div className="mt-1 text-2xl font-semibold">{recruiterMatchSearchHistory.length}</div>
                </div>
              </div>
              {latestRecruiterMatchSearches.length === 0 ? (
                <p className="mt-3 text-sm text-neutral-600">Generate recruiter market research and the latest recruiter-access report will appear here.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {latestRecruiterMatchSearches.map((asset) => (
                    <div key={asset.id} className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-neutral-400">
                        <span>
                          {formatAssetType(asset.asset_type)} | v{asset.version ?? "?"}
                        </span>
                        <span>{asset.created_at ? new Date(asset.created_at).toLocaleString() : ""}</span>
                      </div>
                      <CareerAssetEditor
                        candidateId={candidate.id}
                        assetType={asset.asset_type || "recruiter_match_search"}
                        initialTitle={asset.title || "Untitled recruiter match search"}
                        initialContent={asset.content || ""}
                      />
                    </div>
                  ))}
                </div>
              )}
                </section>
              </div>

              <div className="mt-6">
                <section id="current-fit-analysis" className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Decision workbench</div>
                  <h2 className="mt-2 text-xl font-semibold">Latest role fit analysis</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                    Use the newest fit analysis to decide which opportunities deserve energy now and which ones should wait.
                  </p>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Saved fit analyses</div>
                  <div className="mt-1 text-2xl font-semibold">{fitAnalysisHistory.length}</div>
                </div>
              </div>
              {latestFitAnalysis.length === 0 ? (
                <p className="mt-3 text-sm text-neutral-600">Generate a fit score for a target role and the latest analysis will appear here.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {latestFitAnalysis.map((asset) => (
                    <div key={asset.id} className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-neutral-400">
                        <span>
                          {formatAssetType(asset.asset_type)} | v{asset.version ?? "?"}
                        </span>
                        <span>{asset.created_at ? new Date(asset.created_at).toLocaleString() : ""}</span>
                      </div>
                      <CareerAssetEditor
                        candidateId={candidate.id}
                        assetType={asset.asset_type || "application_fit_analysis"}
                        initialTitle={asset.title || "Untitled fit analysis"}
                        initialContent={asset.content || ""}
                      />
                    </div>
                  ))}
                </div>
              )}
                </section>
              </div>

              <div className="mt-6">
                <section id="current-salary-analysis" className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Compensation workbench</div>
                  <h2 className="mt-2 text-xl font-semibold">Latest salary analysis</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                    Review pay bands, leverage points, and negotiation guidance before the user applies or enters salary conversations.
                  </p>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Saved salary analyses</div>
                  <div className="mt-1 text-2xl font-semibold">{salaryAnalysisHistory.length}</div>
                </div>
              </div>
              {latestSalaryAnalysis.length === 0 ? (
                <p className="mt-3 text-sm text-neutral-600">Generate salary analysis for a target role and the latest market guidance will appear here.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {latestSalaryAnalysis.map((asset) => (
                    <div key={asset.id} className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-neutral-400">
                        <span>
                          {formatAssetType(asset.asset_type)} | v{asset.version ?? "?"}
                        </span>
                        <span>{asset.created_at ? new Date(asset.created_at).toLocaleString() : ""}</span>
                      </div>
                      <CareerAssetEditor
                        candidateId={candidate.id}
                        assetType={asset.asset_type || "salary_analysis"}
                        initialTitle={asset.title || "Untitled salary analysis"}
                        initialContent={asset.content || ""}
                      />
                    </div>
                  ))}
                </div>
              )}
                </section>
              </div>

              <div className="mt-6">
                <section id="current-live-opportunities" className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Opportunity workbench</div>
                  <h2 className="mt-2 text-xl font-semibold">Latest live opportunities</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                    The newest live role search is saved here so the user can compare openings without rerunning the search each time.
                  </p>
                </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Saved live searches</div>
                  <div className="mt-1 text-2xl font-semibold">{liveJobSearchHistory.length}</div>
                </div>
              </div>
              {parsedLatestLiveOpportunities.length > 0 ? (
                <div className="mt-4 rounded-3xl border border-violet-200 bg-violet-50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">Shortlist from results</div>
                      <h3 className="mt-2 text-lg font-semibold text-neutral-900">Best opportunities extracted from the latest search</h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                        Move strong roles straight into the application tracker with one click so users do not lose momentum or retype role details.
                      </p>
                      <p className="mt-1 text-xs text-violet-700">Saving stays on this screen so users can shortlist multiple roles before moving on.</p>
                    </div>
                    <div className="rounded-2xl border border-violet-200 bg-white px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Parsed roles</div>
                      <div className="mt-1 text-2xl font-semibold">{parsedLatestLiveOpportunities.length}</div>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {parsedLatestLiveOpportunities.slice(0, 6).map((opportunity, index) => (
                      <div key={`${opportunity.company}-${opportunity.title}-${index}`} className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm">
                        {(() => {
                          const opportunityKey = `${opportunity.company}-${opportunity.title}-${index}`
                          const isSavingThisOpportunity = savingOpportunityKey === opportunityKey
                          const trackedApplication = applications.find((application) => applicationMatchesOpportunity(application, opportunity))
                          const savedStatus =
                            quickSavedOpportunityStatuses[opportunityKey] ||
                            (trackedApplication?.status === "shortlisted"
                              ? "shortlisted"
                              : trackedApplication
                                ? "targeting"
                                : null)
                          const isShortlisted = savedStatus === "shortlisted"
                          const isTracked = Boolean(savedStatus)
                          return (
                            <>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-700">Opportunity {index + 1}</div>
                            <div className="mt-2 text-base font-semibold text-neutral-900">{opportunity.title}</div>
                            <div className="mt-1 text-sm text-neutral-700">
                              {opportunity.company}
                              {opportunity.location ? ` | ${opportunity.location}` : ""}
                            </div>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${
                              isShortlisted
                                ? "bg-emerald-100 text-emerald-700"
                                : isTracked
                                  ? "bg-sky-100 text-sky-700"
                                  : "bg-violet-100 text-violet-700"
                            }`}
                          >
                            {isShortlisted ? "Shortlisted" : isTracked ? "In tracker" : "Shortlist ready"}
                          </span>
                        </div>
                        {opportunity.whyFit ? <p className="mt-3 text-sm leading-6 text-neutral-600">{opportunity.whyFit}</p> : null}
                        {isTracked ? (
                          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                            {isShortlisted
                              ? "Saved to the priority shortlist. You can open the tracker to tailor or apply."
                              : "Saved in the tracker. Open the tracker when you are ready to prioritise it."}
                          </div>
                        ) : null}
                        <div className="ui-action-row mt-4">
                          <button
                            type="button"
                            onClick={() => void handleQuickSaveOpportunity(opportunityKey, opportunity, "shortlisted")}
                            disabled={isSavingThisOpportunity || isTracked}
                            className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] ${
                              isTracked
                                ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                                : "border-violet-300 bg-violet-600 text-white hover:bg-violet-700"
                            }`}
                          >
                            {isSavingThisOpportunity ? "Saving..." : isShortlisted ? "Shortlisted" : isTracked ? "Saved" : "Save to shortlist"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleQuickSaveOpportunity(opportunityKey, opportunity, "targeting")}
                            disabled={isSavingThisOpportunity || isTracked}
                            className="rounded-full border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                          >
                            {isSavingThisOpportunity ? "Saving..." : isTracked ? "Already saved" : "Save as targeting"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              navigateCareerWorkspace("documents", "#document-workbench", {
                                companyName: opportunity.company,
                                location: opportunity.location,
                                roleFamily: opportunity.title,
                                jobUrl: opportunity.applyUrl,
                                status: "targeting",
                                notes: opportunity.whyFit,
                                nextAction: "Review this role in the tracker when ready.",
                              })
                            }
                            className="rounded-full border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                          >
                            Open tracker
                          </button>
                          {opportunity.applyUrl ? (
                            <a
                              href={opportunity.applyUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                            >
                              View posting
                            </a>
                          ) : null}
                        </div>
                            </>
                          )
                        })()}
                      </div>
                    ))}
                  </div>
                  {quickSavedApplications.length > 0 ? (
                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Quick shortlist tray</div>
                          <p className="mt-1 text-sm text-emerald-900">Roles saved in this session. Update status fast, then open tracker when ready.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setQuickSavedApplicationIds([])}
                          className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700 hover:bg-emerald-100"
                        >
                          Clear tray
                        </button>
                      </div>
                      <div className="mt-3 grid gap-2">
                        {quickSavedApplications.map((application) => {
                          const statusUpdating = savingOpportunityKey === `status-${application.id}`
                          return (
                            <div key={`quick-tray-${application.id}`} className="rounded-xl border border-emerald-200 bg-white p-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <div className="text-sm font-semibold text-neutral-900">{application.job_title || "Untitled role"}</div>
                                  <div className="text-xs text-neutral-600">
                                    {application.company_name || "Unknown company"}
                                    {application.location ? ` | ${application.location}` : ""}
                                  </div>
                                </div>
                                <span className="rounded-full border border-neutral-300 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                                  {formatRunStatus(application.status)}
                                </span>
                              </div>
                              <div className="ui-action-row mt-2">
                                <button
                                  type="button"
                                  onClick={() => void handleQuickUpdateApplicationStatus(application.id, "targeting")}
                                  disabled={statusUpdating}
                                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Targeting
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleQuickUpdateApplicationStatus(application.id, "shortlisted")}
                                  disabled={statusUpdating}
                                  className="rounded-full border border-violet-300 bg-violet-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Shortlist
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleQuickUpdateApplicationStatus(application.id, "applied")}
                                  disabled={statusUpdating}
                                  className="rounded-full border border-emerald-300 bg-emerald-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Applied
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCareerWorkspaceTarget(application.id)
                                    navigateCareerWorkspace("documents", "#document-workbench", {
                                      companyName: application.company_name || "",
                                      location: application.location || "",
                                      roleFamily: application.job_title || "",
                                      jobUrl: application.job_url || "",
                                      status: application.status || "targeting",
                                      notes: application.notes || "",
                                      nextAction: application.next_action || "",
                                    })
                                  }}
                                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                                >
                                  Open tracker
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigateCareerWorkspace("documents", "#document-actions", {
                                      companyName: application.company_name || "",
                                      location: application.location || "",
                                      roleFamily: application.job_title || "",
                                      notes: application.notes || "",
                                      jobUrl: application.job_url || "",
                                      nextAction: application.next_action || "",
                                      status: application.status || "targeting",
                                    })
                                  }
                                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                                >
                                  Build letter
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigateCareerWorkspace("company", "#company-dossier", {
                                      companyName: application.company_name || "",
                                      location: application.location || "",
                                      roleFamily: application.job_title || "",
                                      notes: application.notes || "",
                                      jobUrl: application.job_url || "",
                                      nextAction: application.next_action || "",
                                      status: application.status || "targeting",
                                    })
                                  }
                                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                                >
                                  Build dossier
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {latestLiveJobSearches.length === 0 ? (
                <EmptyStateActionCard
                  className="mt-3"
                  title="No live opportunity report yet"
                  description="Run a live job search to save the first opportunity report and start shortlisting real roles from the current profile."
                  actionLabel="Run live search"
                  onClick={() => openAndScroll("jobs", "#live-job-search")}
                />
              ) : (
                <div className="mt-4 space-y-4">
                  {latestLiveJobSearches.map((asset) => (
                    <div key={asset.id} className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-neutral-400">
                        <span>
                          {formatAssetType(asset.asset_type)} | v{asset.version ?? "?"}
                        </span>
                        <span>{asset.created_at ? new Date(asset.created_at).toLocaleString() : ""}</span>
                      </div>
                      <CareerAssetEditor
                        candidateId={candidate.id}
                        assetType={asset.asset_type || "live_job_search"}
                        initialTitle={asset.title || "Untitled live job search"}
                        initialContent={asset.content || ""}
                      />
                    </div>
                  ))}
                </div>
              )}
                </section>
              </div>

              <div className="mt-6">
                <HistoryArchiveSection
                  eyebrow="Version trail"
                  title="Prospect research history"
                  countLabel="Saved research runs"
                  count={deepProspectResearchHistory.length}
                  emptyMessage="Prospect research history will appear here after the first hidden-market research run."
                >
                  {deepProspectResearchHistory.map((asset) => (
                    <CompactHistoryCard
                      key={asset.id}
                      title={asset.title || "Untitled prospect research"}
                      subtitle={`${formatAssetType(asset.asset_type)} | Version ${asset.version ?? "?"}`}
                      timestamp={asset.created_at ? new Date(asset.created_at).toLocaleString() : ""}
                      preview={summarizeAssetContent(asset.content)}
                      actionLabel="Open current prospect research"
                      onClick={() => openAndScroll("jobs", "#current-deep-prospect-research")}
                    />
                  ))}
                </HistoryArchiveSection>
              </div>

              <div className="mt-6">
                <HistoryArchiveSection
                  eyebrow="Version trail"
                  title="Recruiter match search history"
                  countLabel="Saved recruiter routes"
                  count={recruiterMatchSearchHistory.length}
                  emptyMessage="Recruiter match search history will appear here after the first recruiter-market search run."
                >
                  {recruiterMatchSearchHistory.map((asset) => (
                    <CompactHistoryCard
                      key={asset.id}
                      title={asset.title || "Untitled recruiter match search"}
                      subtitle={`${formatAssetType(asset.asset_type)} | Version ${asset.version ?? "?"}`}
                      timestamp={asset.created_at ? new Date(asset.created_at).toLocaleString() : ""}
                      preview={summarizeAssetContent(asset.content)}
                      actionLabel="Open current recruiter route"
                      onClick={() => openAndScroll("jobs", "#current-recruiter-match-searches")}
                    />
                  ))}
                </HistoryArchiveSection>
              </div>

              <div className="mt-6">
                <HistoryArchiveSection
                  eyebrow="Version trail"
                  title="Role fit analysis history"
                  countLabel="Saved fit analyses"
                  count={fitAnalysisHistory.length}
                  emptyMessage="Fit analysis history will appear here after the first role-fit scoring run."
                >
                  {fitAnalysisHistory.map((asset) => (
                    <CompactHistoryCard
                      key={asset.id}
                      title={asset.title || "Untitled fit analysis"}
                      subtitle={`${formatAssetType(asset.asset_type)} | Version ${asset.version ?? "?"}`}
                      timestamp={asset.created_at ? new Date(asset.created_at).toLocaleString() : ""}
                      preview={summarizeAssetContent(asset.content)}
                      actionLabel="Open current fit analysis"
                      onClick={() => openAndScroll("jobs", "#current-fit-analysis")}
                    />
                  ))}
                </HistoryArchiveSection>
              </div>

              <div className="mt-6">
                <HistoryArchiveSection
                  eyebrow="Version trail"
                  title="Salary analysis history"
                  countLabel="Saved salary analyses"
                  count={salaryAnalysisHistory.length}
                  emptyMessage="Salary analysis history will appear here after the first compensation research run."
                >
                  {salaryAnalysisHistory.map((asset) => (
                    <CompactHistoryCard
                      key={asset.id}
                      title={asset.title || "Untitled salary analysis"}
                      subtitle={`${formatAssetType(asset.asset_type)} | Version ${asset.version ?? "?"}`}
                      timestamp={asset.created_at ? new Date(asset.created_at).toLocaleString() : ""}
                      preview={summarizeAssetContent(asset.content)}
                      actionLabel="Open current salary analysis"
                      onClick={() => openAndScroll("jobs", "#current-salary-analysis")}
                    />
                  ))}
                </HistoryArchiveSection>
              </div>

              <div className="mt-6">
                <HistoryArchiveSection
                  eyebrow="Version trail"
                  title="Live opportunity history"
                  countLabel="Saved live searches"
                  count={liveJobSearchHistory.length}
                  emptyMessage="Live opportunity history will appear here after the first live search run."
                >
                  {liveJobSearchHistory.map((asset) => (
                    <CompactHistoryCard
                      key={asset.id}
                      title={asset.title || "Untitled live job search"}
                      subtitle={`${formatAssetType(asset.asset_type)} | Version ${asset.version ?? "?"}`}
                      timestamp={asset.created_at ? new Date(asset.created_at).toLocaleString() : ""}
                      preview={summarizeAssetContent(asset.content)}
                      actionLabel="Open current live opportunities"
                      onClick={() => openAndScroll("jobs", "#current-live-opportunities")}
                    />
                  ))}
                </HistoryArchiveSection>
              </div>
              </>
              ) : null}
                </div>
              ) : null}
            </section>

            {activeStep === "documents" ? (
              <HistoryArchiveSection
                eyebrow="Version trail"
                title="Saved cover letter history"
                countLabel="Saved letters"
                count={coverLetterHistory.length}
                emptyMessage="Cover letter history will appear here after the first cover letter generation run."
              >
                {coverLetterHistory.map((asset) => (
                  <CompactHistoryCard
                    key={asset.id}
                    title={asset.title || "Untitled cover letter"}
                    subtitle={`${formatAssetType(asset.asset_type)} | Version ${asset.version ?? "?"}`}
                    timestamp={asset.created_at ? new Date(asset.created_at).toLocaleString() : ""}
                    preview={summarizeAssetContent(asset.content)}
                    actionLabel="Open current cover letter"
                    onClick={() => openAndScroll("documents", "#current-cover-letters")}
                  />
                ))}
              </HistoryArchiveSection>
            ) : null}
          </div>
      </div>
      </div>
      <aside
        id="career-left-nav"
        className={`fixed left-0 top-0 z-20 hidden h-screen w-[220px] flex-col border-r border-[#d8e4f2] bg-white/95 px-2.5 pb-4 pt-20 shadow-sm backdrop-blur lg:flex ${
          isWizardFocusActive ? "ring-2 ring-[#0a66c2]/20" : ""
        }`}
      >
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5b6b7c]">Career nav</div>
        <div className="mt-0.5 text-[10px] text-neutral-600">
          {completionCount}/{preparationSteps.length} steps done
        </div>
        <div className="mt-1.5">
          <div className="rounded-xl border border-neutral-200 bg-white px-2 py-1.5">
            <button
              type="button"
              onClick={() => setQuickSettingsOpen((current) => !current)}
              className="flex w-full items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-neutral-700"
            >
              Quick actions
              <span className="text-[9px] text-neutral-500">{quickSettingsOpen ? "Collapse" : "Expand"}</span>
            </button>
            {quickSettingsOpen ? (
              <div className="mt-1.5 space-y-1.5">
                <button
                  type="button"
                  onClick={openWizardFlow}
                  className={`w-full rounded-full border border-[#0a66c2] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] ${
                    showOnboardingGuide
                      ? "wizard-spotlight-soft bg-[#0a66c2] text-white hover:bg-[#004182]"
                      : "bg-[#e8f3ff] text-[#0a66c2] hover:bg-[#dcecff]"
                  }`}
                >
                  Guided setup
                </button>
                {!hideWorkspaceGuideToggle ? (
                  <button
                    type="button"
                    onClick={() => setGuidedModeEnabled(!isGuidedMode)}
                    className={`w-full rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] ${
                      isGuidedMode
                        ? "border-[#0a66c2] bg-[#0a66c2] text-white"
                        : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    {isGuidedMode ? "Agent tips on" : "Agent tips off"}
                  </button>
                ) : null}
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={resetWorkspaceView}
                    className="flex-1 rounded-full border border-neutral-300 bg-white px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                  >
                    Reset
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-0.5">
          {displayedLeftWorkflowLinks.map((link) => {
            const sectionKey = link.sectionKey as keyof typeof expandedLeftSections
            const isExpanded = Boolean(expandedLeftSections[sectionKey]) || link.isActive
            const submenuItems = sectionSubmenuLinks[link.sectionKey] ?? []

            return (
              <div
                key={`left-step-${link.href}`}
                className={`rounded-lg border bg-white transition ${
                  link.isActive
                    ? "border-sky-300 shadow-sm"
                    : link.isUrgent
                      ? "border-amber-200"
                      : "border-neutral-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => activateLeftNavigation(link.sectionKey, link.href)}
                  aria-expanded={isExpanded}
                  className={`flex w-full items-start justify-between gap-2 rounded-lg px-2 py-1 text-left transition ${
                    link.isActive
                      ? "bg-sky-50 text-sky-950"
                      : link.complete
                        ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                        : "bg-white text-neutral-800 hover:bg-neutral-50"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[10px] font-semibold">{cleanWorkflowLabel(link.label)}</span>
                    <span className="mt-0.5 block line-clamp-1 text-[9px] font-normal leading-3 text-neutral-500">
                      {link.description}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] ${link.badgeClass}`}>
                      {link.badgeLabel}
                    </span>
                    <span className="text-[8px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                      {isExpanded ? "Hide" : "Open"}
                    </span>
                  </span>
                </button>
                {isExpanded ? (
                  <div className="space-y-0.5 border-t border-neutral-100 px-2 py-1">
                    {submenuItems.length > 0 ? (
                      submenuItems.map((item) => {
                        const isSubActive = item.sectionKey === activeStep && item.href === activeAnchor
                        return (
                          <button
                            key={`left-sub-${item.sectionKey}-${item.href}-${item.label}`}
                            type="button"
                            onClick={() => {
                              revealLeftSection(link.sectionKey, true)
                              openAndScroll(item.sectionKey, item.href)
                            }}
                            className={`block w-full rounded-md px-2 py-1 text-left text-[9px] font-semibold transition ${
                              isSubActive
                                ? "bg-sky-100 text-sky-900"
                                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                            }`}
                          >
                            {item.label}
                          </button>
                        )
                      })
                    ) : (
                      <button
                        type="button"
                        onClick={() => openAndScroll(link.sectionKey, link.href)}
                        className="block w-full rounded-md px-2 py-1 text-left text-[9px] font-semibold text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                      >
                        Open section
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </aside>
      {isMyFilesDrawerOpen && !isWizardFocusActive ? (
        <aside className="fixed right-4 top-24 z-40 hidden w-[340px] rounded-2xl border border-neutral-200 bg-white/95 p-4 shadow-xl backdrop-blur lg:block">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">My files</div>
              <div className="mt-1 text-sm font-semibold text-neutral-900">Quick access to saved outputs</div>
            </div>
            <button
              type="button"
              onClick={() => setIsMyFilesDrawerOpen(false)}
              className="rounded-full border border-neutral-300 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
            >
              Close
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {savedLibraryLinks.map((link) => (
              <button
                key={`my-files-link-${link.href}`}
                type="button"
                onClick={() => {
                  setIsMyFilesDrawerOpen(false)
                  openAndScroll(getSectionKeyForSavedLink(link.href), link.href)
                }}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-left hover:bg-white"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">{link.label}</div>
                <div className="mt-1 text-sm font-semibold text-neutral-900">{link.description}</div>
              </button>
            ))}
          </div>
          <div className="mt-3 border-t border-neutral-200 pt-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Recent files</div>
            {recentSavedAssets.length === 0 ? (
              <p className="mt-2 text-xs text-neutral-600">No saved files yet.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {recentSavedAssets.map((asset) => {
                  return (
                    <button
                      key={`my-files-recent-${asset.id}`}
                      type="button"
                      onClick={() => openSavedAsset(asset, { closeMyFilesDrawer: true })}
                      className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-left hover:bg-neutral-50"
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                        {formatAssetType(asset.asset_type)}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-neutral-900 truncate">
                        {asset.title || "Untitled file"}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </aside>
      ) : null}
      {showAdvancedTools && !isWizardFocusActive ? (
        <aside
          className={`fixed top-24 z-40 hidden w-[320px] rounded-2xl border border-neutral-200 bg-white/95 p-4 shadow-xl backdrop-blur lg:block ${
            isContextRailOpen ? "right-[344px]" : "right-4"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Advanced tools</div>
              <div className="mt-1 text-sm font-semibold text-neutral-900">Navigation and workflow controls</div>
            </div>
            <button
              type="button"
              onClick={() => setShowAdvancedTools(false)}
              className="rounded-full border border-neutral-300 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
            >
              Close
            </button>
          </div>
          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={() => setShowWorkflowMap((current) => !current)}
              className={`w-full rounded-xl border px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] ${
                showWorkflowMap ? "border-sky-300 bg-sky-50 text-sky-800" : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              {showWorkflowMap ? "Workflow map on" : "Workflow map off"}
            </button>
            <button
              type="button"
              onClick={() => setShowStepGuidance((current) => !current)}
              className={`w-full rounded-xl border px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] ${
                showStepGuidance ? "border-sky-300 bg-sky-50 text-sky-800" : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              {showStepGuidance ? "Guidance on" : "Guidance off"}
            </button>
          </div>
          {activeSectionSubmenuLinks.length > 0 ? (
            <div className="mt-3 border-t border-neutral-200 pt-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Quick open section</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {activeSectionSubmenuLinks.map((item) => (
                  <button
                    key={`drawer-submenu-${item.sectionKey}-${item.href}-${item.label}`}
                    type="button"
                    onClick={() => openAndScroll(item.sectionKey, item.href)}
                    className="rounded-full border border-neutral-300 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-100"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {showWorkflowMap ? (
            <div className="mt-3 border-t border-neutral-200 pt-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Workflow map</div>
              <div className="mt-2 space-y-2">
                {workflowMapSections.map((section) => (
                  <button
                    key={`drawer-map-${section.sectionKey}`}
                    type="button"
                    onClick={() => openAndScroll(section.sectionKey, section.href)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] ${
                      activeStep === section.sectionKey
                        ? "border-sky-300 bg-sky-50 text-sky-800"
                        : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    {section.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      ) : null}
      {isContextRailOpen && !isWizardFocusActive ? (
        <aside className="fixed right-4 top-24 z-40 hidden w-[320px] rounded-2xl border border-neutral-200 bg-white/95 p-4 shadow-xl backdrop-blur lg:block">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Context panel</div>
              <div className="mt-1 text-sm font-semibold text-neutral-900">{candidate.full_name || "Candidate workspace"}</div>
            </div>
            <button
              type="button"
              onClick={() => setIsContextRailOpen(false)}
              className="rounded-full border border-neutral-300 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
            >
              Close
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {contextRailItems.map((item) => (
              <button
                key={`rail-item-${item.label}`}
                type="button"
                onClick={() => openAndScroll(item.sectionKey, item.href)}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-left hover:bg-white"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">{item.label}</div>
                <div className={`mt-1 text-sm font-semibold ${item.tone}`}>{item.value}</div>
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">{item.actionLabel}</div>
              </button>
            ))}
          </div>
          <div className="mt-3 border-t border-neutral-200 pt-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Quick jump</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {workflowLinkStatuses.map((link) => (
                <button
                  key={`rail-jump-${link.href}`}
                  type="button"
                  onClick={() => openAndScroll(link.sectionKey, link.href)}
                  className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
                    link.isActive
                      ? "border-sky-300 bg-sky-50 text-sky-800"
                      : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
                  }`}
                >
                  {link.label.replace(/^\d+\.\s*/, "")}
                </button>
              ))}
            </div>
          </div>
        </aside>
      ) : null}
      {isReportIssueOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/35 px-4"
          onClick={() => setIsReportIssueOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Report an issue"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Report issue</div>
                <h3 className="mt-1 text-base font-semibold text-neutral-900">Tell us what is blocking you</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReportIssueOpen(false)}
                className="rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                Close
              </button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
                Type
                <select
                  value={issueType}
                  onChange={(event) => setIssueType(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-normal normal-case text-neutral-800"
                >
                  <option>Workflow confusion</option>
                  <option>Button or link not working</option>
                  <option>Missing saved file</option>
                  <option>Data issue</option>
                  <option>Other</option>
                </select>
              </label>
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
                Contact email
                <input
                  value={issueContactEmail}
                  onChange={(event) => setIssueContactEmail(event.target.value)}
                  placeholder="Optional"
                  className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-normal normal-case text-neutral-800"
                />
              </label>
            </div>
            <label className="mt-2 block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
              What happened?
              <textarea
                value={issueDetail}
                onChange={(event) => setIssueDetail(event.target.value)}
                placeholder="Example: I clicked Generate cover letter and nothing happened."
                rows={4}
                className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-normal normal-case text-neutral-800"
              />
            </label>
            <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-[11px] text-neutral-600">
              We will include your current step ({activeSectionLabel} / {activeSubsectionLabel}) automatically.
            </div>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsReportIssueOpen(false)}
                className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitIssueReport()}
                className="rounded-full bg-[#0a66c2] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#004182]"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {toast ? (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 max-w-sm">
          <div
            className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-lg ${
              toast.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : toast.tone === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-900"
                  : "border-sky-200 bg-sky-50 text-sky-900"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm leading-6">{toast.message}</p>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="rounded-full border border-current/30 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] opacity-80 hover:opacity-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function SummaryCard({
  label,
  value,
  tone = "neutral",
  actionLabel,
  onClick,
}: {
  label: string
  value: string
  tone?: "neutral" | "success" | "warning" | "info"
  actionLabel?: string
  onClick?: () => void
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50"
        : tone === "info"
          ? "border-sky-200 bg-sky-50"
          : "border-neutral-200 bg-neutral-50"
  const content = (
    <>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{label}</div>
      <div className="mt-1 text-base font-semibold">{value}</div>
      {actionLabel ? <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-600">{actionLabel}</div> : null}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`rounded-xl border px-2.5 py-2 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${toneClass}`}
      >
        {content}
      </button>
    )
  }

  return <div className={`rounded-xl border px-2.5 py-2 ${toneClass}`}>{content}</div>
}

function WorkspaceCampaignLane({
  steps,
  compact = false,
  onStepClick,
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
  onStepClick: (sectionKey: string, href: string) => void
}) {
  return (
    <div className={`grid gap-3 ${compact ? "grid-cols-2" : "md:grid-cols-5"}`}>
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
            onClick={() => onStepClick(step.sectionKey, step.href)}
            className={`rounded-2xl border px-4 py-4 text-left transition hover:shadow-sm ${toneClass}`}
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
            {step.note ? <div className="mt-1 text-xs leading-5 text-current/80">{step.note}</div> : null}
          </button>
        )
      })}
    </div>
  )
}

function PriorityCard({
  title,
  description,
  tone,
  actionLabel,
  onClick,
}: {
  title: string
  description: string
  tone: "danger" | "warning" | "info"
  actionLabel: string
  onClick: () => void
}) {
  const toneClass =
    tone === "danger"
      ? "border-rose-200 bg-rose-50"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50"
        : "border-sky-200 bg-sky-50"

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="break-words font-semibold text-neutral-900">{title}</div>
      <p className="mt-2 break-words text-sm leading-6 text-neutral-700">{description}</p>
      <button
        type="button"
        onClick={onClick}
        className="mt-4 inline-flex rounded-full border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
      >
        {actionLabel}
      </button>
    </div>
  )
}

function SourceStatusCard({
  label,
  status,
  description,
  tone,
}: {
  label: string
  status: string
  description: string
  tone: "success" | "warning" | "info"
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50"
        : "border-sky-200 bg-sky-50"

  return (
    <div className={`rounded-2xl border p-3 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 break-words text-sm font-semibold text-neutral-900">{label}</div>
        <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
          {status}
        </span>
      </div>
      <p className="mt-1.5 break-words text-xs leading-5 text-neutral-700">{description}</p>
    </div>
  )
}

function formatAssetType(assetType: string | null | undefined) {
  if (!assetType) return "Asset"
  return assetType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function cleanWorkflowLabel(label: string) {
  const cleaned = label
    .replace(/^[✓✔]\s*/, "")
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .trim()

  if (cleaned.toLowerCase() === "step guide") return "Overview"
  if (cleaned.toLowerCase() === "saved files") return "Files"
  return cleaned
}

function formatRunStatus(status: string | null | undefined) {
  if (!status) return "Unknown"
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function formatBackgroundJobType(jobType: string | null | undefined) {
  if (!jobType) return "Background job"
  return jobType
    .replace(/^generate_/, "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function ListBlock({ title, items }: { title: string; items: string[] | null | undefined }) {
  if (!items || items.length === 0) return null
  const preview = items.slice(0, 2)
  return (
    <details className="group rounded-xl border border-neutral-200 bg-neutral-50 p-2.5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">{title}</div>
        <span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-600">
          {items.length}
        </span>
      </summary>
      <ul className="mt-2 space-y-1.5 text-sm text-neutral-800 group-open:hidden">
        {preview.map((item, index) => (
          <li key={`${title}-preview-${index}`} className="rounded-lg bg-white px-2.5 py-1.5 leading-5 shadow-sm">
            {item}
          </li>
        ))}
      </ul>
      {items.length > 2 ? (
        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500 group-open:hidden">
          Open to view all
        </div>
      ) : null}
      <ul className="mt-2 hidden space-y-1.5 text-sm text-neutral-800 group-open:block">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="rounded-lg bg-white px-2.5 py-1.5 leading-5 shadow-sm">
            {item}
          </li>
        ))}
      </ul>
    </details>
  )
}

function CompactNarrativeStatus({
  label,
  status,
  detail,
  tone,
}: {
  label: string
  status: "Ready" | "Missing"
  detail: string
  tone: "success" | "warning"
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-amber-200 bg-amber-50 text-amber-900"

  return (
    <div className={`rounded-xl border px-2.5 py-2 ${toneClass}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.12em]">{label}</div>
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]">
          {status}
        </span>
      </div>
      <div className="mt-1 text-xs leading-5">{detail}</div>
    </div>
  )
}

function CompactHistoryCard({
  title,
  subtitle,
  timestamp,
  preview,
  actionLabel,
  onClick,
}: {
  title: string
  subtitle: string
  timestamp: string
  preview?: string
  actionLabel: string
  onClick: () => void
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="break-words font-semibold text-neutral-900">{title}</div>
          <div className="mt-1 break-words text-sm text-neutral-700">{subtitle}</div>
        </div>
        <div className="text-xs text-neutral-400">{timestamp}</div>
      </div>
      {preview ? <p className="mt-3 break-words text-sm leading-6 text-neutral-600">{preview}</p> : null}
      <button
        type="button"
        onClick={onClick}
        className="mt-3 rounded-full border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
      >
        {actionLabel}
      </button>
    </div>
  )
}

function CurrentTargetBriefCard({
  title,
  description,
  brief,
  statusBadge,
}: {
  title: string
  description?: string
  statusBadge?: string
  brief: {
    jobTitle?: string
    companyName?: string
    companyWebsite?: string
    location?: string
    jobUrl?: string
  }
}) {
  const formatBriefValue = (label: string, value: string) => {
    if (!value) return "Not set yet"
    if (label === "Website" || label === "Job link") {
      try {
        const parsed = new URL(value)
        return parsed.hostname.replace(/^www\./, "")
      } catch {
        return value
      }
    }
    return value
  }
  const primaryRows = [
    { label: "Role", value: brief.jobTitle || "Not set yet" },
    { label: "Company", value: brief.companyName || "Not set yet" },
    { label: "Location", value: brief.location || "Not set yet" },
  ]
  const secondaryRows = [
    { label: "Website", value: brief.companyWebsite || "" },
    { label: "Job link", value: brief.jobUrl || "" },
  ].filter((item) => item.value)

  return (
    <section className="rounded-2xl border border-[#d7e8f0] bg-[linear-gradient(180deg,#ffffff_0%,#f5fbfd_100%)] p-2.5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0f766e]">Shared target brief</div>
          <h3 className="mt-0.5 text-sm font-semibold text-[#0f172a]">{title}</h3>
          {description ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-600">{description}</p> : null}
        </div>
        <div className="rounded-full border border-[#bfdbfe] bg-white px-3 py-1 text-xs font-semibold text-[#1d4ed8]">
          {statusBadge || "Editable in each tool"}
        </div>
      </div>
      <dl className="mt-1.5 flex flex-wrap gap-1.5">
        {primaryRows.map((row) => (
          <div key={`${title}-${row.label}`} className="inline-flex items-center gap-1 rounded-full border border-white/80 bg-white px-2.5 py-1">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">{row.label}:</dt>
            <dd className="max-w-[220px] truncate text-xs font-semibold text-neutral-900" title={row.value}>
              {formatBriefValue(row.label, row.value)}
            </dd>
          </div>
        ))}
      </dl>
      {secondaryRows.length > 0 ? (
        <dl className="mt-1.5 flex flex-wrap gap-1.5">
          {secondaryRows.map((row) => (
            <div key={`${title}-${row.label}`} className="inline-flex max-w-full items-center gap-1 rounded-full border border-white/80 bg-white px-2.5 py-1">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">{row.label}:</dt>
              <dd className="max-w-[220px] truncate text-xs font-semibold text-neutral-900" title={row.value}>
                {formatBriefValue(row.label, row.value)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  )
}

function EmptyStateActionCard({
  title,
  description,
  actionLabel,
  onClick,
  className = "",
}: {
  title: string
  description: string
  actionLabel: string
  onClick: () => void
  className?: string
}) {
  return (
    <div className={`rounded-2xl border border-sky-200 bg-sky-50 p-4 ${className}`.trim()}>
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Recommended next move</div>
      <div className="mt-2 text-base font-semibold text-sky-950">{title}</div>
      <p className="mt-2 text-sm leading-6 text-sky-950">{description}</p>
      <button
        type="button"
        onClick={onClick}
        className="mt-3 inline-flex rounded-full border border-sky-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-sky-800 hover:bg-sky-100"
      >
        {actionLabel}
      </button>
    </div>
  )
}

function SectionGuideBanner({
  statusLabel,
  summary,
  actionLabel,
  onClick,
  tone,
  className = "",
}: {
  statusLabel: string
  summary: string
  actionLabel: string
  onClick: () => void
  tone: "source" | "positioning" | "documents" | "company" | "interview" | "jobs"
  className?: string
}) {
  return (
    <div className={`rounded-3xl border p-5 ${sectionGuideToneClass(tone)} ${className}`.trim()}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Section guide</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-800">
              {statusLabel}
            </span>
          </div>
          <p className="mt-3 break-words text-sm leading-6 text-neutral-700">{summary}</p>
        </div>
        <button
          type="button"
          onClick={onClick}
          className="rounded-full border border-white/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-800 hover:bg-neutral-50"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  )
}

function SectionSubnav({
  title,
  items,
  onClick,
  className = "",
}: {
  title: string
  items: { label: string; href: string }[]
  onClick: (href: string) => void
  className?: string
}) {
  return (
    <div className={`rounded-2xl border border-neutral-200 bg-white/85 p-4 ${className}`.trim()}>
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">{title}</div>
      <div className="ui-action-row mt-3">
        {items.map((item) => (
          <button
            key={`${title}-${item.href}-${item.label}`}
            type="button"
            onClick={() => onClick(item.href)}
            className="rounded-full border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function HistoryArchiveSection({
  eyebrow,
  title,
  countLabel,
  count,
  emptyMessage,
  description = "Open this archive when you want to review older versions without crowding the main working area.",
  actionLabel = "Open archive",
  children,
}: {
  eyebrow: string
  title: string
  countLabel: string
  count: number
  emptyMessage: string
  description?: string
  actionLabel?: string
  children: ReactNode
}) {
  return (
    <details className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm md:p-5">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">{eyebrow}</div>
            <h2 className="mt-2 text-xl font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">{description}</p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">{countLabel}</div>
            <div className="mt-1 text-2xl font-semibold">{count}</div>
          </div>
        </div>
        <div className="mt-4 inline-flex rounded-full border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700">
          {actionLabel}
        </div>
      </summary>
      {count === 0 ? <p className="mt-4 text-sm text-neutral-600">{emptyMessage}</p> : <div className="mt-4 space-y-3">{children}</div>}
    </details>
  )
}

function sectionGuideToneClass(tone: "source" | "positioning" | "documents" | "company" | "interview" | "jobs") {
  switch (tone) {
    case "source":
      return "border-sky-200 bg-sky-50"
    case "positioning":
      return "border-indigo-200 bg-indigo-50"
    case "documents":
      return "border-emerald-200 bg-emerald-50"
    case "company":
      return "border-cyan-200 bg-cyan-50"
    case "interview":
      return "border-amber-200 bg-amber-50"
    case "jobs":
      return "border-violet-200 bg-violet-50"
    default:
      return "border-neutral-200 bg-neutral-50"
  }
}

function assetToneClass(assetType: string | null | undefined) {
  switch (assetType) {
    case "company_dossier":
    case "deep_prospect_research":
      return "border-sky-200 bg-sky-50 hover:border-sky-300 hover:bg-white"
    case "outreach_strategy":
      return "border-cyan-200 bg-cyan-50 hover:border-cyan-300 hover:bg-white"
    case "cover_letter":
    case "application_fit_analysis":
      return "border-emerald-200 bg-emerald-50 hover:border-emerald-300 hover:bg-white"
    case "interview_prep":
    case "executive_interview_playbook":
    case "interview_training_pack":
    case "job_hit_list":
      return "border-amber-200 bg-amber-50 hover:border-amber-300 hover:bg-white"
    case "salary_analysis":
    case "live_job_search":
      return "border-violet-200 bg-violet-50 hover:border-violet-300 hover:bg-white"
    case "course_recommendations":
    case "cv_summary":
    case "cv_experience":
    case "linkedin_headline":
    case "linkedin_about":
      return "border-indigo-200 bg-indigo-50 hover:border-indigo-300 hover:bg-white"
    default:
      return "border-neutral-200 bg-neutral-50 hover:border-neutral-300 hover:bg-white"
  }
}

function savedLinkToneClass(tone: "neutral" | "research" | "outreach" | "execution" | "interview" | "market" | "positioning") {
  switch (tone) {
    case "research":
      return "border-sky-200 bg-sky-50 hover:border-sky-300 hover:bg-white"
    case "outreach":
      return "border-cyan-200 bg-cyan-50 hover:border-cyan-300 hover:bg-white"
    case "execution":
      return "border-emerald-200 bg-emerald-50 hover:border-emerald-300 hover:bg-white"
    case "interview":
      return "border-amber-200 bg-amber-50 hover:border-amber-300 hover:bg-white"
    case "market":
      return "border-violet-200 bg-violet-50 hover:border-violet-300 hover:bg-white"
    case "positioning":
      return "border-indigo-200 bg-indigo-50 hover:border-indigo-300 hover:bg-white"
    default:
      return "border-neutral-200 bg-neutral-50 hover:border-neutral-300 hover:bg-white"
  }
}

function workflowActionToneClass(tone: "sky" | "rose" | "amber" | "emerald" | "neutral") {
  switch (tone) {
    case "sky":
      return "border-sky-200 bg-sky-50 hover:border-sky-300 hover:bg-white"
    case "rose":
      return "border-rose-200 bg-rose-50 hover:border-rose-300 hover:bg-white"
    case "amber":
      return "border-amber-200 bg-amber-50 hover:border-amber-300 hover:bg-white"
    case "emerald":
      return "border-emerald-200 bg-emerald-50 hover:border-emerald-300 hover:bg-white"
    default:
      return "border-neutral-200 bg-white hover:border-neutral-300"
  }
}

function workflowLinkToneClass(sectionKey: string) {
  switch (sectionKey) {
    case "source":
    case "positioning":
      return "border-[#dcdff8] bg-[#f3f4ff] hover:border-[#c8d0f5] hover:bg-white"
    case "documents":
      return "border-[#d9ebe4] bg-[#f1fbf7] hover:border-[#bfdccf] hover:bg-white"
    case "company":
      return "border-[#d7e8f0] bg-[#eef8fb] hover:border-[#bdd9e4] hover:bg-white"
    case "interview":
      return "border-[#eadfbe] bg-[#fbf6e8] hover:border-[#dccb97] hover:bg-white"
    case "jobs":
      return "border-[#dcdff8] bg-[#f2f4ff] hover:border-[#c8d0f5] hover:bg-white"
    default:
      return "border-[#d8e4f2] bg-[#f4f8fc] hover:border-[#bfd1e5] hover:bg-white"
  }
}

function backgroundStatusCardClass(status: string | null | undefined) {
  if (status === "completed") return "border-emerald-200 bg-emerald-50"
  if (status === "failed") return "border-rose-200 bg-rose-50"
  return "border-sky-200 bg-sky-50"
}

const LONG_RUNNING_WARNING_MINUTES = 20

function getRunStartedTimestamp(value: { created_at: string | null; started_at?: string | null; completed_at?: string | null }) {
  return Date.parse(value.started_at || value.created_at || value.completed_at || "") || 0
}

function isRunTakingLongerThanExpected(
  value: { status: string | null; created_at: string | null; started_at?: string | null; completed_at?: string | null },
  thresholdMinutes = LONG_RUNNING_WARNING_MINUTES
) {
  if (!["queued", "running"].includes(value.status || "")) return false
  const started = getRunStartedTimestamp(value)
  if (!started) return false
  return Date.now() - started > thresholdMinutes * 60 * 1000
}

function formatElapsedRunTime(
  value: { created_at: string | null; started_at?: string | null; completed_at?: string | null },
  now = Date.now()
) {
  const started = getRunStartedTimestamp(value)
  if (!started) return ""
  const diffMinutes = Math.max(1, Math.round((now - started) / 60000))
  if (diffMinutes < 60) return `${diffMinutes} min`
  const hours = Math.floor(diffMinutes / 60)
  const minutes = diffMinutes % 60
  return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`
}

function backgroundRunBadgeClass(status: string | null | undefined, takingLongerThanExpected = false) {
  if (status === "completed") return "bg-emerald-100 text-emerald-700"
  if (status === "failed") return "bg-rose-100 text-rose-700"
  if (takingLongerThanExpected) return "bg-amber-100 text-amber-800"
  return "bg-sky-100 text-sky-700"
}

function backgroundRunCardClass(status: string | null | undefined, takingLongerThanExpected = false) {
  if (status === "completed") return "border-emerald-200 bg-emerald-50"
  if (status === "failed") return "border-rose-200 bg-rose-50"
  if (takingLongerThanExpected) return "border-amber-200 bg-amber-50"
  return "border-sky-200 bg-sky-50"
}

function getBackgroundRunStage(status: string | null | undefined, takingLongerThanExpected = false) {
  if (takingLongerThanExpected) return "Queued -> Generating -> Saving -> Needs attention"
  if (status === "queued") return "Queued -> Generating -> Saving"
  if (status === "running") return "Generating -> Saving"
  if (status === "completed") return "Ready"
  if (status === "failed") return "Stopped before save"
  return "Processing"
}

function getWhileYouWaitSuggestionForBackgroundJob(jobType: string | null | undefined) {
  switch (jobType) {
    case "generate_company_dossier":
      return "While you wait: review the target role and company notes so the dossier is easier to apply when it lands."
    case "generate_cover_letter":
      return "While you wait: tighten the tracked role details so the final letter is easier to review quickly."
    case "generate_assets":
      return "While you wait: gather one strong achievement example you want to see reflected in the drafts."
    case "generate_application_fit_analysis":
      return "While you wait: open the role brief so you can compare the fit score against the actual requirements."
    case "generate_salary_analysis":
      return "While you wait: note your target range and negotiation angle so the salary view is easier to act on."
    case "generate_interview_prep":
      return "While you wait: jot down the real interview concerns you want the prep pack to answer."
    default:
      return "While you wait: keep moving in the workspace. This result will save back into the right section when it finishes."
  }
}

function getWhileYouWaitSuggestionForLiveRun(run: LiveJobRunRow) {
  if (run.target_role || run.location) {
    return `While you wait: confirm the search target${run.target_role ? ` (${run.target_role})` : ""}${run.location ? ` and location (${run.location})` : ""} before the next run.`
  }
  return "While you wait: tighten the role or location filters so the next search is even cleaner."
}

const GALLUP_THEME_KEYWORDS = [
  "achiever",
  "adaptability",
  "analytical",
  "arranger",
  "belief",
  "command",
  "communication",
  "competition",
  "connectedness",
  "consistency",
  "context",
  "deliberative",
  "developer",
  "discipline",
  "empathy",
  "focus",
  "futuristic",
  "harmony",
  "ideation",
  "includer",
  "individualization",
  "input",
  "intellection",
  "learner",
  "maximizer",
  "positivity",
  "relator",
  "responsibility",
  "restorative",
  "self-assurance",
  "significance",
  "strategic",
  "woo",
] as const

function toTitleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

function formatThemeList(themes: string[]) {
  if (themes.length === 0) return ""
  if (themes.length === 1) return themes[0]
  if (themes.length === 2) return `${themes[0]} and ${themes[1]}`
  return `${themes.slice(0, -1).join(", ")}, and ${themes[themes.length - 1]}`
}

function extractGallupStrengthThemes({
  profileStrengths,
  sourceText,
}: {
  profileStrengths: string[]
  sourceText: string
}) {
  const found = new Set<string>()

  for (const strength of profileStrengths) {
    if (!strength?.trim()) continue
    found.add(toTitleCase(strength.trim()))
  }

  const normalized = sourceText.toLowerCase()
  for (const keyword of GALLUP_THEME_KEYWORDS) {
    const pattern = new RegExp(`\\b${keyword.replace("-", "[-\\s]?")}\\b`, "i")
    if (pattern.test(normalized)) {
      found.add(toTitleCase(keyword))
    }
  }

  return Array.from(found)
}

function inferStrengthWorkflowStyle(themes: string[]) {
  const normalized = themes.map((theme) => theme.toLowerCase())
  const hasAny = (set: string[]) => set.some((value) => normalized.includes(value))

  if (hasAny(["achiever", "arranger", "restorative", "maximizer", "discipline", "focus"])) {
    return "execution"
  }

  if (hasAny(["strategic", "analytical", "deliberative", "context", "responsibility", "consistency"])) {
    return "strategic"
  }

  if (hasAny(["relator", "empathy", "developer", "harmony", "includer", "connectedness", "individualization"])) {
    return "relational"
  }

  if (hasAny(["communication", "woo", "command", "significance", "self assurance", "competition"])) {
    return "influence"
  }

  if (hasAny(["learner", "input", "intellection", "ideation", "futuristic"])) {
    return "learning"
  }

  return "balanced"
}

function getStrengthWorkflowLabel(style: string) {
  switch (style) {
    case "execution":
      return "Execution-first"
    case "strategic":
      return "Strategy-first"
    case "relational":
      return "Connection-first"
    case "influence":
      return "Momentum-first"
    case "learning":
      return "Insight-first"
    default:
      return "Balanced"
  }
}

function getWorkflowStepPriority(style: string, stepId: string) {
  const prioritiesByStyle: Record<string, string[]> = {
    execution: ["cv", "strengths", "documents", "jobs", "positioning", "company", "proof"],
    strategic: ["cv", "strengths", "positioning", "company", "documents", "proof", "jobs"],
    relational: ["strengths", "proof", "positioning", "documents", "company", "jobs", "cv"],
    influence: ["proof", "documents", "company", "jobs", "positioning", "cv", "strengths"],
    learning: ["strengths", "cv", "positioning", "company", "proof", "documents", "jobs"],
    balanced: ["cv", "strengths", "proof", "positioning", "documents", "company", "jobs"],
  }

  const order = prioritiesByStyle[style] || prioritiesByStyle.balanced
  const index = order.indexOf(stepId)
  return index === -1 ? 999 : index
}

function safePercent(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round((value / total) * 100)))
}

function summarizeAssetContent(content: string | null | undefined) {
  const normalized = (content || "").replace(/\s+/g, " ").trim()

  if (!normalized) {
    return "Open the saved file to review the full content."
  }

  if (normalized.length <= 140) {
    return normalized
  }

  return `${normalized.slice(0, 137).trimEnd()}...`
}

function parseLiveJobSearchContent(content: string) {
  const sectionMatch = content.match(/Best-fit live opportunities\s*([\s\S]*?)\n\s*Recommended next steps/i)
  if (!sectionMatch) return [] as ParsedLiveOpportunity[]

  const section = sectionMatch[1].trim()
  if (!section || /No strong live opportunities were returned\./i.test(section)) {
    return [] as ParsedLiveOpportunity[]
  }

  return section
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean)
      const header = lines[0] || ""
      const headerMatch = header.match(/^\d+\.\s*(.+?)(?:\s*\|\s*(.+?))?(?:\s*\|\s*(.+))?$/)

      return {
        title: headerMatch?.[1]?.trim() || "Untitled role",
        company: headerMatch?.[2]?.trim() || "Untitled company",
        location: headerMatch?.[3]?.trim() || "",
        whyFit: lines.find((line) => line.startsWith("Why it fits:"))?.replace(/^Why it fits:\s*/i, "").trim() || "",
        applyUrl: lines.find((line) => line.startsWith("Apply:"))?.replace(/^Apply:\s*/i, "").trim() || "",
      }
    })
    .filter((opportunity) => opportunity.title || opportunity.company)
}

function buildWorkspaceCampaignLane({
  hasResearch,
  hasOutreach,
  hasApplicationAssets,
  hasApplications,
  hasInterviewReadiness,
  hasFollowUpMotion,
  researchCount,
  outreachCount,
  applicationCount,
  interviewCount,
  overdueFollowUpCount,
  dueTodayFollowUpCount,
}: {
  hasResearch: boolean
  hasOutreach: boolean
  hasApplicationAssets: boolean
  hasApplications: boolean
  hasInterviewReadiness: boolean
  hasFollowUpMotion: boolean
  researchCount: number
  outreachCount: number
  applicationCount: number
  interviewCount: number
  overdueFollowUpCount: number
  dueTodayFollowUpCount: number
}) {
  return [
    {
      label: "Research",
      complete: hasResearch,
      active: !hasResearch,
      sectionKey: "company",
      href: "#company-dossier",
      badge: researchCount > 0 ? String(researchCount) : undefined,
      note: hasResearch ? "Saved company intelligence is available." : "No dossier or prospect research saved yet.",
    },
    {
      label: "Outreach",
      complete: hasOutreach,
      active: hasResearch && !hasOutreach,
      sectionKey: "company",
      href: "#outreach-strategy",
      badge: outreachCount > 0 ? String(outreachCount) : undefined,
      note: hasOutreach ? "Warm-route strategy is ready." : "No outreach plan created yet.",
    },
    {
      label: "Apply",
      complete: hasApplicationAssets && hasApplications,
      active: (hasResearch || hasOutreach) && !(hasApplicationAssets && hasApplications),
      sectionKey: "documents",
      href: "#document-workbench",
      badge: applicationCount > 0 ? String(applicationCount) : undefined,
      note:
        hasApplicationAssets && hasApplications
          ? "Tracked applications and tailored assets are in motion."
          : "Applications or tailored assets still need to be linked up.",
    },
    {
      label: "Interview",
      complete: hasInterviewReadiness,
      active: hasApplications && !hasInterviewReadiness,
      sectionKey: "interview",
      href: "#interview",
      badge: interviewCount > 0 ? String(interviewCount) : undefined,
      note: hasInterviewReadiness ? "Interview preparation or reflections are saved." : "Interview pack still needs to be built.",
    },
    {
      label: "Follow-up",
      complete: hasFollowUpMotion,
      active: hasApplications && !hasFollowUpMotion,
      sectionKey: "documents",
      href: "#document-workbench",
      badge:
        overdueFollowUpCount > 0
          ? `${overdueFollowUpCount} overdue`
          : dueTodayFollowUpCount > 0
            ? `${dueTodayFollowUpCount} today`
            : undefined,
      note:
        overdueFollowUpCount > 0
          ? "Some applications need immediate follow-up."
          : dueTodayFollowUpCount > 0
            ? "Follow-up actions are due today."
            : hasFollowUpMotion
              ? "Follow-up rhythm is active."
              : "No follow-up dates or next actions are set yet.",
    },
  ]
}

