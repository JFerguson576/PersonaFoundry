"use client"

import { useEffect, useMemo, useState } from "react"

type TourModule = "career" | "persona" | "teamsync"

type TourStep = {
  id: string
  title: string
  body: string
  selectors: string[]
}

const TOUR_VERSION = "2026-04-20-v1"

const moduleLabels: Record<TourModule, string> = {
  career: "Career Intelligence",
  persona: "Persona Foundry",
  teamsync: "TeamSync",
}

const tourStepsByModule: Record<TourModule, TourStep[]> = {
  career: [
    {
      id: "left-nav",
      title: "Use the left workflow navigator",
      body: "This is your control rail. Click any step to jump directly to that workspace section.",
      selectors: ["#career-left-nav"],
    },
    {
      id: "start-panel",
      title: "Start from the current action panel",
      body: "This panel shows what is ready, what is blocked, and the best next move.",
      selectors: ["#workflow-guide", "#source-material", "#positioning", "#document-workbench", "#jobs"],
    },
    {
      id: "files",
      title: "Load source files early",
      body: "CV + Gallup strengths are the highest-impact inputs. Add those first for better outputs.",
      selectors: ["#source-material"],
    },
    {
      id: "documents",
      title: "Create application assets",
      body: "Generate profile, CV, cover letter, and application assets from one workbench.",
      selectors: ["#document-workbench"],
    },
    {
      id: "jobs",
      title: "Run live opportunity search",
      body: "Search live jobs and move strong matches into your tracked application flow.",
      selectors: ["#live-job-search", "#jobs", "#current-live-opportunities"],
    },
  ],
  persona: [
    {
      id: "hero",
      title: "Start from your persona base",
      body: "This is your anchor area for baseline mode, Gallup input, and readiness.",
      selectors: ["#persona-hero"],
    },
    {
      id: "step-menu",
      title: "Follow the step-by-step menu",
      body: "Use this navigator to move from presets to traits, testing, exports, and sharing.",
      selectors: ["#persona-step-menu"],
    },
    {
      id: "analysis",
      title: "Analyze source writing",
      body: "Import source writing to generate a recommended tone and trait starting point.",
      selectors: ["#persona-analysis"],
    },
    {
      id: "traits",
      title: "Tune traits with sliders",
      body: "Dial in communication style by adjusting warmth, directness, structure, and depth.",
      selectors: ["#persona-traits"],
    },
    {
      id: "exports",
      title: "Export production-ready profile",
      body: "Choose your target format and export clean persona instructions for deployment.",
      selectors: ["#persona-exports", "#persona-share"],
    },
  ],
  teamsync: [
    {
      id: "left-nav",
      title: "Use TeamSync side navigation",
      body: "Move quickly across Overview, Intake, Scenario, Run, Insights, and History.",
      selectors: ["#teamsync-left-nav"],
    },
    {
      id: "overview",
      title: "Review readiness first",
      body: "This view tells you whether your group, scenario, and run state are ready.",
      selectors: ["#teamsync-overview"],
    },
    {
      id: "intake",
      title: "Load members and strengths",
      body: "Add members with Gallup strengths to build a stronger simulation model.",
      selectors: ["#teamsync-intake"],
    },
    {
      id: "scenario",
      title: "Select a scenario path",
      body: "Use prompt packs or custom scenarios to model pressure and decision behavior.",
      selectors: ["#teamsync-scenario", "#teamsync-run"],
    },
    {
      id: "insights",
      title: "Use insights and history",
      body: "Insights guide action. History helps compare runs, refine response plans, and share outcomes.",
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

export function AdaptiveProductTour({ moduleKey }: { moduleKey: TourModule }) {
  const steps = tourStepsByModule[moduleKey]
  const [hasCompleted, setHasCompleted] = useState(() => {
    if (typeof window === "undefined") return true
    return window.localStorage.getItem(storageKey(moduleKey)) === "1"
  })
  const [isOpen, setIsOpen] = useState(() => !hasCompleted)
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
    if (markCompleted && typeof window !== "undefined") {
      window.localStorage.setItem(storageKey(moduleKey), "1")
      setHasCompleted(true)
    }
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
  const panelTop = targetRect ? Math.min(viewport.height - 220, Math.max(90, targetRect.bottom + 12)) : 120
  const panelLeft = targetRect ? Math.min(Math.max(16, targetRect.left), viewport.width - 360) : 16

  return (
    <>
      {!isOpen ? (
        <button
          type="button"
          onClick={startTour}
          className={`fixed bottom-6 left-4 z-[62] rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] shadow-sm transition ${
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
              className="pointer-events-none fixed z-[60] rounded-2xl border-2 border-[#2f6df6] shadow-[0_0_0_9999px_rgba(8,21,54,0.22)] transition-all"
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
            <div className="mt-2 rounded-lg border border-[#dde8fb] bg-[#f6f9ff] px-2.5 py-1.5 text-[11px] text-[#42597f]">
              Step {activeCount === 0 ? 0 : activeAvailablePosition + 1} of {activeCount}
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
