"use client"

import { useEffect, useMemo, useState } from "react"
import { scrollToElementWithOffset } from "@/lib/scroll"

type TourModule = "career" | "persona" | "teamsync"

type TourStep = {
  id: string
  title: string
  body: string
  why: string
  selectors: string[]
}

const TOUR_VERSION = "2026-04-20-v1"

const moduleLabels: Record<TourModule, string> = {
  career: "Career Intelligence",
  persona: "Persona Foundry",
  teamsync: "TeamSync",
}

const moduleResourceLinks: Record<TourModule, { href: string; label: string }> = {
  career: { href: "/docs/personara-candidate-explainer-v2.docx", label: "Open Candidate explainer" },
  persona: { href: "/docs/personara-user-explainer-v2.docx", label: "Open User explainer" },
  teamsync: { href: "/docs/personara-analyst-explainer-v2.docx", label: "Open Analyst explainer" },
}

const tourStepsByModule: Record<TourModule, TourStep[]> = {
  career: [
    {
      id: "left-nav",
      title: "Use the left workflow navigator",
      body: "This is your control rail. Click any step to jump directly to that workspace section.",
      why: "Users who navigate by clear steps complete setup faster and avoid getting lost.",
      selectors: ["#career-left-nav"],
    },
    {
      id: "start-panel",
      title: "Start from the current action panel",
      body: "This panel shows what is ready, what is blocked, and the best next move.",
      why: "This keeps momentum high by reducing decision fatigue at the start of each session.",
      selectors: ["#workflow-guide", "#source-material", "#positioning", "#document-workbench", "#jobs"],
    },
    {
      id: "files",
      title: "Load source files early",
      body: "CV + Gallup strengths are the highest-impact inputs. Add those first for better outputs.",
      why: "Higher-quality source inputs improve profile quality, writing tone, and job-fit guidance.",
      selectors: ["#source-material"],
    },
    {
      id: "documents",
      title: "Create application assets",
      body: "Generate profile, CV, cover letter, and application assets from one workbench.",
      why: "Consolidating assets in one flow reduces rework and keeps applications consistent.",
      selectors: ["#document-workbench"],
    },
    {
      id: "jobs",
      title: "Run live opportunity search",
      body: "Search live jobs and move strong matches into your tracked application flow.",
      why: "Linking search to tracked actions turns discovery into measurable execution.",
      selectors: ["#live-job-search", "#jobs", "#current-live-opportunities"],
    },
  ],
  persona: [
    {
      id: "hero",
      title: "Start from your persona base",
      body: "This is your anchor area for baseline mode, Gallup input, and readiness.",
      why: "A strong baseline ensures your AI voice remains consistent across use cases.",
      selectors: ["#persona-hero"],
    },
    {
      id: "step-menu",
      title: "Follow the step-by-step menu",
      body: "Use this navigator to move from presets to traits, testing, exports, and sharing.",
      why: "A guided build sequence lowers cognitive load for first-time users.",
      selectors: ["#persona-step-menu"],
    },
    {
      id: "analysis",
      title: "Analyze source writing",
      body: "Import source writing to generate a recommended tone and trait starting point.",
      why: "Source analysis reduces manual tuning and helps the assistant sound naturally like the user.",
      selectors: ["#persona-analysis"],
    },
    {
      id: "traits",
      title: "Tune traits with sliders",
      body: "Dial in communication style by adjusting warmth, directness, structure, and depth.",
      why: "Trait tuning is where generic AI becomes personal and high-trust.",
      selectors: ["#persona-traits"],
    },
    {
      id: "exports",
      title: "Export production-ready profile",
      body: "Choose your target format and export clean persona instructions for deployment.",
      why: "Export-ready profiles let users move quickly from design to real-world use.",
      selectors: ["#persona-exports", "#persona-share"],
    },
  ],
  teamsync: [
    {
      id: "left-nav",
      title: "Use TeamSync side navigation",
      body: "Move quickly across Overview, Intake, Scenario, Run, Insights, and History.",
      why: "Sequential navigation helps teams move from setup to insight without missing steps.",
      selectors: ["#teamsync-left-nav"],
    },
    {
      id: "overview",
      title: "Review readiness first",
      body: "This view tells you whether your group, scenario, and run state are ready.",
      why: "Readiness checks reduce false starts and improve simulation quality.",
      selectors: ["#teamsync-overview"],
    },
    {
      id: "intake",
      title: "Load members and strengths",
      body: "Add members with Gallup strengths to build a stronger simulation model.",
      why: "Member-level strengths improve prediction quality for support priorities and team friction.",
      selectors: ["#teamsync-intake"],
    },
    {
      id: "scenario",
      title: "Select a scenario path",
      body: "Use prompt packs or custom scenarios to model pressure and decision behavior.",
      why: "Better scenarios produce more actionable leadership and governance insights.",
      selectors: ["#teamsync-scenario", "#teamsync-run"],
    },
    {
      id: "insights",
      title: "Use insights and history",
      body: "Insights guide action. History helps compare runs, refine response plans, and share outcomes.",
      why: "Tracking insight over time turns simulation into a repeatable executive operating habit.",
      selectors: ["#teamsync-insights", "#teamsync-history"],
    },
  ],
}

function findStepElement(step: TourStep): HTMLElement | null {
  if (typeof document === "undefined") return null
  for (const selector of step.selectors) {
    const element = document.querySelector(selector)
    if (element instanceof HTMLElement) return element
  }
  return null
}

function findAvailableIndices(steps: TourStep[]) {
  return steps
    .map((step, index) => ({ index, element: findStepElement(step) }))
    .filter((entry) => entry.element !== null)
    .map((entry) => entry.index)
}

function storageKey(moduleKey: TourModule) {
  return `personara-tour-complete-${moduleKey}-${TOUR_VERSION}`
}

function forceOpenKey(moduleKey: TourModule) {
  return `personara-tour-force-open-${moduleKey}`
}

function getInitialTourState(moduleKey: TourModule) {
  if (typeof window === "undefined") {
    return { hasCompleted: true, isOpen: false, forcedOnLoad: false }
  }

  const params = new URLSearchParams(window.location.search)
  const shouldForceByQuery = params.get("tour") === "1"
  const shouldForceByStorage = window.localStorage.getItem(forceOpenKey(moduleKey)) === "1"
  const forcedOnLoad = shouldForceByQuery || shouldForceByStorage

  if (forcedOnLoad) {
    window.localStorage.removeItem(forceOpenKey(moduleKey))
    window.localStorage.removeItem(storageKey(moduleKey))
    return { hasCompleted: false, isOpen: true, forcedOnLoad: true }
  }

  const hasCompleted = window.localStorage.getItem(storageKey(moduleKey)) === "1"
  return { hasCompleted, isOpen: !hasCompleted, forcedOnLoad: false }
}

export function AdaptiveProductTour({ moduleKey }: { moduleKey: TourModule }) {
  const steps = tourStepsByModule[moduleKey]
  const initialState = getInitialTourState(moduleKey)
  const [hasCompleted, setHasCompleted] = useState(initialState.hasCompleted)
  const [isOpen, setIsOpen] = useState(initialState.isOpen)
  const [stepIndex, setStepIndex] = useState(0)
  const [availableStepIndices, setAvailableStepIndices] = useState<number[]>([])
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [viewport, setViewport] = useState(() => {
    if (typeof window === "undefined") return { width: 1280, height: 720 }
    return { width: window.innerWidth, height: window.innerHeight }
  })

  const activeAvailablePosition = useMemo(
    () => Math.max(0, availableStepIndices.findIndex((index) => index === stepIndex)),
    [availableStepIndices, stepIndex]
  )

  const activeStep = steps[stepIndex]
  const activeCount = availableStepIndices.length

  useEffect(() => {
    if (!initialState.forcedOnLoad) return
    void fetch("/api/user/tour-progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: moduleKey, completed: false }),
    })
  }, [initialState.forcedOnLoad, moduleKey])

  useEffect(() => {
    let isCancelled = false

    async function loadRemoteProgress() {
      const response = await fetch(`/api/user/tour-progress?module=${encodeURIComponent(moduleKey)}`, { cache: "no-store" })
      if (!response.ok) return
      const payload = (await response.json()) as { completed?: boolean | null; table_missing?: boolean }
      if (isCancelled || payload.table_missing || payload.completed === null || payload.completed === undefined) return

      const remoteCompleted = payload.completed === true
      if (typeof window !== "undefined") {
        if (remoteCompleted) {
          window.localStorage.setItem(storageKey(moduleKey), "1")
        } else {
          window.localStorage.removeItem(storageKey(moduleKey))
        }
      }
      setHasCompleted(remoteCompleted)
      setIsOpen(!remoteCompleted)
    }

    void loadRemoteProgress()
    return () => {
      isCancelled = true
    }
  }, [moduleKey])

  useEffect(() => {
    if (!isOpen) return

    const refresh = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
      const nextAvailable = findAvailableIndices(steps)
      setAvailableStepIndices(nextAvailable)

      const currentTarget = findStepElement(steps[stepIndex])
      setTargetRect(currentTarget?.getBoundingClientRect() ?? null)

      if (nextAvailable.length === 0) return
      if (!nextAvailable.includes(stepIndex)) {
        setStepIndex(nextAvailable[0])
      }
    }

    refresh()

    const observer = new MutationObserver(() => {
      refresh()
    })
    observer.observe(document.body, { childList: true, subtree: true, attributes: true })
    window.addEventListener("resize", refresh)
    window.addEventListener("scroll", refresh, true)

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", refresh)
      window.removeEventListener("scroll", refresh, true)
    }
  }, [isOpen, stepIndex, steps])

  useEffect(() => {
    if (!isOpen) return
    const target = findStepElement(steps[stepIndex])
    if (!target) return
    const rect = target.getBoundingClientRect()
    const isVisible = rect.top >= 96 && rect.bottom <= window.innerHeight - 96
    if (isVisible) return
    scrollToElementWithOffset(target, { offsetPx: 128 })
  }, [isOpen, stepIndex, steps])

  function startTour() {
    const nextAvailable = findAvailableIndices(steps)
    setAvailableStepIndices(nextAvailable)
    if (nextAvailable.length > 0) {
      setStepIndex(nextAvailable[0])
      setIsOpen(true)
    }
  }

  function closeTour(markCompleted: boolean) {
    setIsOpen(false)
    if (typeof window !== "undefined") {
      if (markCompleted) {
        window.localStorage.setItem(storageKey(moduleKey), "1")
      } else {
        window.localStorage.removeItem(storageKey(moduleKey))
      }
      setHasCompleted(markCompleted)
    }
    void fetch("/api/user/tour-progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: moduleKey, completed: markCompleted }),
    })
  }

  function moveStep(direction: "next" | "back") {
    if (availableStepIndices.length === 0) return
    const currentPosition = availableStepIndices.findIndex((index) => index === stepIndex)
    const safePosition = currentPosition < 0 ? 0 : currentPosition
    const delta = direction === "next" ? 1 : -1
    const nextPosition = Math.min(Math.max(safePosition + delta, 0), availableStepIndices.length - 1)
    setStepIndex(availableStepIndices[nextPosition])
  }

  const isLastStep = activeCount > 0 && activeAvailablePosition >= activeCount - 1

  const top = targetRect ? Math.max(82, targetRect.top - 12) : 96
  const left = targetRect ? Math.min(Math.max(16, targetRect.left), viewport.width - 380) : 16
  const panelWidthEstimate = 340
  const panelHeightEstimate = 430
  let panelTop = Math.max(86, viewport.height - panelHeightEstimate - 16)
  let panelLeft = Math.max(16, viewport.width - panelWidthEstimate - 18)

  const rectsOverlap = (a: { left: number; top: number; width: number; height: number }, b: DOMRect) =>
    a.left < b.right && a.left + a.width > b.left && a.top < b.bottom && a.top + a.height > b.top

  if (targetRect) {
    const rightSideFits = targetRect.right + panelWidthEstimate + 20 <= viewport.width
    const leftSideFits = targetRect.left - panelWidthEstimate - 20 >= 0

    if (rightSideFits) {
      panelLeft = targetRect.right + 12
    } else if (leftSideFits) {
      panelLeft = targetRect.left - panelWidthEstimate - 12
    } else {
      panelLeft = Math.min(Math.max(16, targetRect.left), viewport.width - panelWidthEstimate - 16)
    }

    panelTop = Math.min(Math.max(90, targetRect.top), viewport.height - panelHeightEstimate - 16)

    const candidatePlacements = [
      { left: panelLeft, top: panelTop },
      { left: Math.max(16, viewport.width - panelWidthEstimate - 16), top: Math.max(86, viewport.height - panelHeightEstimate - 16) },
      { left: Math.max(16, viewport.width - panelWidthEstimate - 16), top: 90 },
      { left: 16, top: Math.max(86, viewport.height - panelHeightEstimate - 16) },
      { left: 16, top: 90 },
    ]

    const firstSafePlacement = candidatePlacements.find((placement) =>
      !rectsOverlap(
        { left: placement.left, top: placement.top, width: panelWidthEstimate, height: panelHeightEstimate },
        targetRect
      )
    )

    if (firstSafePlacement) {
      panelLeft = firstSafePlacement.left
      panelTop = firstSafePlacement.top
    }
  }

  return (
    <>
      {!isOpen ? (
        <button
          type="button"
          onClick={startTour}
          className={`fixed bottom-5 left-4 z-[260] rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] shadow-[0_12px_30px_-20px_rgba(15,30,70,0.7)] transition ${
            moduleKey === "career" ? "lg:left-[216px]" : ""
          } ${
            hasCompleted
              ? "border-[#c9d4e8] bg-white text-[#243a63] hover:bg-[#f4f7ff]"
              : "border-[#2f6df6] bg-[#2f6df6] text-white hover:bg-[#1f56d5] wizard-spotlight-soft"
          }`}
        >
          {hasCompleted ? "Open product tour" : "Start product tour"}
        </button>
      ) : null}

      {isOpen ? (
        <>
          <div className="pointer-events-none fixed inset-0 z-[58] bg-[rgba(8,21,54,0.2)]" />
          {targetRect ? (
            <div
              className="pointer-events-none fixed z-[60] rounded-2xl border-[3px] border-[#2f6df6] ring-4 ring-[#2f6df6]/20 shadow-[0_0_0_9999px_rgba(8,21,54,0.22)] transition-all"
              style={{
                top,
                left,
                width: targetRect.width,
                height: targetRect.height,
              }}
            />
          ) : null}
          <section
            className="fixed z-[61] w-[340px] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-[#cfdbf3] bg-white p-3 shadow-[0_28px_46px_-26px_rgba(15,30,70,0.5)]"
            style={{ top: panelTop, left: panelLeft }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5f7294]">
                  {moduleLabels[moduleKey]} tour
                </p>
                <h3 className="mt-0.5 text-sm font-semibold text-[var(--brand-navy)]">{activeStep.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => closeTour(false)}
                className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                Close
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-[#475569]">{activeStep.body}</p>
            <div className="mt-2 rounded-lg border border-[#d9e5fb] bg-[#f8fbff] px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#5f7294]">Why this matters</p>
              <p className="mt-1 text-[11px] leading-5 text-[#42597f]">{activeStep.why}</p>
            </div>
            <div className="mt-2 rounded-lg border border-[#dde8fb] bg-[#f6f9ff] px-2.5 py-1.5 text-[11px] text-[#42597f]">
              Step {activeCount === 0 ? 0 : activeAvailablePosition + 1} of {activeCount}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <a
                href={moduleResourceLinks[moduleKey].href}
                target="_blank"
                rel="noreferrer"
                className="personara-explainer-chip"
              >
                {moduleResourceLinks[moduleKey].label}
              </a>
              <a
                href="/resources"
                className="personara-explainer-chip"
              >
                Open Resource Hub
              </a>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => moveStep("back")}
                disabled={activeAvailablePosition <= 0}
                className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => closeTour(false)}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  Skip
                </button>
                {isLastStep ? (
                  <button
                    type="button"
                    onClick={() => closeTour(true)}
                    className="rounded-full border border-[#2f6df6] bg-[#2f6df6] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#1f56d5]"
                  >
                    Finish
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => moveStep("next")}
                    className="rounded-full border border-[#2f6df6] bg-[#2f6df6] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#1f56d5]"
                  >
                    Next
                  </button>
                )}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </>
  )
}
