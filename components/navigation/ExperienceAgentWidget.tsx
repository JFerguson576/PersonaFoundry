"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { getAuthHeaders } from "@/lib/career-client"
import { scrollToElementWithOffset } from "@/lib/scroll"

type AgentMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  serverMessageId?: string
  actionHref?: string
  actionLabel?: string
}

function mapModuleFromPath(pathname: string) {
  if (pathname.startsWith("/career")) return "career-intelligence"
  if (pathname.startsWith("/persona-foundry")) return "persona-foundry"
  if (pathname.startsWith("/teamsync")) return "teamsync"
  if (pathname.startsWith("/control-center") || pathname.startsWith("/admin") || pathname.startsWith("/operations")) return "control-center"
  if (pathname.startsWith("/community")) return "community"
  return "platform"
}

function currentSectionAnchor() {
  if (typeof window === "undefined") return ""
  const nodes = document.querySelectorAll<HTMLElement>("section[id], [data-help-section]")
  for (const node of nodes) {
    const rect = node.getBoundingClientRect()
    if (rect.top <= 180 && rect.bottom >= 150) {
      return node.id || node.getAttribute("data-help-section") || ""
    }
  }
  return window.location.hash.replace("#", "")
}

type SuggestedAction = {
  label: string
  href: string
}

type WorkflowSignal = {
  active_step_label: string
  total_steps: number
  completed_steps: number
  visible_steps: string[]
}

function safeText(value: string | null | undefined, max = 120) {
  if (!value) return ""
  return value.replace(/\s+/g, " ").trim().slice(0, max)
}

function normalizeMatchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function findBestVisibleActionMatch(reply: string, visibleActions: string[]) {
  const normalizedReply = normalizeMatchText(reply)
  if (!normalizedReply) return ""

  let bestLabel = ""
  let bestScore = 0

  for (const action of visibleActions) {
    const normalizedAction = normalizeMatchText(action)
    if (!normalizedAction) continue

    if (normalizedReply.includes(normalizedAction)) {
      return action
    }

    const tokens = normalizedAction.split(" ").filter(Boolean)
    const score = tokens.reduce((acc, token) => (normalizedReply.includes(token) ? acc + 1 : acc), 0)
    if (score > bestScore) {
      bestScore = score
      bestLabel = action
    }
  }

  return bestScore >= 2 ? bestLabel : ""
}

function collectWorkflowSignal(): WorkflowSignal {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { active_step_label: "", total_steps: 0, completed_steps: 0, visible_steps: [] }
  }

  const navRoot =
    document.querySelector<HTMLElement>("#career-left-nav") ||
    document.querySelector<HTMLElement>("#persona-left-nav") ||
    document.querySelector<HTMLElement>("#teamsync-left-nav") ||
    document.querySelector<HTMLElement>("aside")

  if (!navRoot) {
    return { active_step_label: "", total_steps: 0, completed_steps: 0, visible_steps: [] }
  }

  const nodes = Array.from(navRoot.querySelectorAll<HTMLElement>("button, a")).filter((node) => {
    const label = safeText(node.textContent)
    if (!label) return false
    const rect = node.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  })
  const numberedStepNodes = nodes.filter((node) => /\b\d+\.\s/.test(safeText(node.textContent)))
  const stepNodes = numberedStepNodes.length > 0 ? numberedStepNodes : nodes
  const visibleSteps = Array.from(new Set(stepNodes.map((node) => safeText(node.textContent, 90)).filter(Boolean))).slice(0, 8)
  const completedSteps = visibleSteps.filter((label) => label.includes("✓") || /\b(done|ready)\b/i.test(label)).length

  const effectiveCompletedSteps = numberedStepNodes.length > 0 ? completedSteps : 0

  const activeNode =
    stepNodes.find((node) => node.getAttribute("aria-current") === "true") ||
    stepNodes.find((node) => node.className.includes("bg-sky-100") || node.className.includes("bg-sky-50")) ||
    stepNodes[0]

  return {
    active_step_label: safeText(activeNode?.textContent, 90),
    total_steps: stepNodes.length,
    completed_steps: effectiveCompletedSteps,
    visible_steps: visibleSteps,
  }
}

function collectPageContextSnapshot(pathname: string) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      page_title: "",
      section_anchor: "",
      full_url: pathname,
      visible_sections: [] as string[],
      visible_actions: [] as string[],
    }
  }

  const sectionAnchor = currentSectionAnchor()
  const visibleSections: string[] = []
  const sectionNodes = document.querySelectorAll<HTMLElement>("section[id], [data-help-section], [data-tour-section], article[id]")
  for (const node of sectionNodes) {
    const rect = node.getBoundingClientRect()
    if (rect.bottom < 64 || rect.top > window.innerHeight) continue
    const heading =
      safeText(node.querySelector<HTMLElement>("h1, h2, h3, [data-section-title]")?.textContent) ||
      safeText(node.getAttribute("data-help-section")) ||
      safeText(node.id)
    if (heading && !visibleSections.includes(heading)) {
      visibleSections.push(heading)
    }
    if (visibleSections.length >= 6) break
  }

  const visibleActions: string[] = []
  const actionNodes = document.querySelectorAll<HTMLElement>("button, a[role='button'], a[href^='#'], [data-agent-action]")
  for (const node of actionNodes) {
    const rect = node.getBoundingClientRect()
    if (rect.bottom < 64 || rect.top > window.innerHeight || rect.width < 24 || rect.height < 20) continue
    const label =
      safeText(node.getAttribute("data-agent-action")) ||
      safeText(node.getAttribute("aria-label")) ||
      safeText(node.textContent, 60)
    if (!label || visibleActions.includes(label)) continue
    visibleActions.push(label)
    if (visibleActions.length >= 8) break
  }

  return {
    page_title: document.title,
    section_anchor: sectionAnchor,
    full_url: `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`,
    visible_sections: visibleSections,
    visible_actions: visibleActions,
    workflow_signal: collectWorkflowSignal(),
  }
}

function modulePromptChips(moduleName: string, workflowSignal?: WorkflowSignal): string[] {
  const activeStep = normalizeMatchText(workflowSignal?.active_step_label || "")
  switch (moduleName) {
    case "career-intelligence":
      if (activeStep.includes("add your files") || activeStep.includes("files")) {
        return [
          "What file should I upload first?",
          "How do I finish this file step quickly?",
          "What can I add later without blocking progress?",
        ]
      }
      if (activeStep.includes("create your profile") || activeStep.includes("profile")) {
        return [
          "What do I need to generate my profile now?",
          "How do I improve this profile faster?",
          "What should I do after profile generation?",
        ]
      }
      if (activeStep.includes("create documents") || activeStep.includes("documents")) {
        return [
          "Which document should I generate first?",
          "How do I tailor my cover letter quickly?",
          "What is the best document sequence from here?",
        ]
      }
      if (activeStep.includes("search jobs") || activeStep.includes("jobs")) {
        return [
          "What is the fastest path to shortlist quality roles?",
          "How do I prioritize jobs worth applying to first?",
          "What should I save before I leave this step?",
        ]
      }
      return [
        "What should I do next in this candidate workflow?",
        "Help me load source files correctly.",
        "What is the fastest path to a good cover letter?",
      ]
    case "persona-foundry":
      if (activeStep.includes("set baseline") || activeStep.includes("baseline")) {
        return [
          "What should I set in baseline first?",
          "How do I use Gallup strengths in baseline?",
          "What is the minimum baseline before tuning?",
        ]
      }
      if (activeStep.includes("tune") || activeStep.includes("test")) {
        return [
          "Which persona slider should I tune first?",
          "How do I test voice quickly before export?",
          "What is the fastest way to compare versions?",
        ]
      }
      if (activeStep.includes("export") || activeStep.includes("deploy")) {
        return [
          "Which export format should I choose now?",
          "What should I verify before final export?",
          "How do I keep this persona production-ready?",
        ]
      }
      return [
        "What should I tune first in my persona?",
        "How do I use Gallup strengths as baseline?",
        "What is the quickest export path?",
      ]
    case "teamsync":
      if (activeStep.includes("load members") || activeStep.includes("members")) {
        return [
          "Who should I load first in this group?",
          "How do I add members quickly with strengths?",
          "What can be optional during member intake?",
        ]
      }
      if (activeStep.includes("scenario")) {
        return [
          "How do I choose the best scenario to run first?",
          "What scenario detail improves output quality most?",
          "What is the minimum scenario setup for a useful run?",
        ]
      }
      if (activeStep.includes("run")) {
        return [
          "What should I check before I run simulation?",
          "How do I interpret weak signals after this run?",
          "What is the next action right after results?",
        ]
      }
      if (activeStep.includes("insight") || activeStep.includes("history")) {
        return [
          "What are the top decision risks in this output?",
          "How do I turn this insight into a team action plan?",
          "What should I export and share from this run?",
        ]
      }
      return [
        "What is the fastest way to load members?",
        "How do I set up a strong scenario?",
        "What should I do after simulation runs?",
      ]
    case "control-center":
      return [
        "Which dashboard signal needs attention first?",
        "How do I review tester notes quickly?",
        "Where is cost pressure rising?",
      ]
    default:
      return [
        "What should I do next here?",
        "How do I complete this workflow faster?",
        "What is the minimum path to success?",
      ]
  }
}

function buildWelcomeMessage(moduleName: string, workflowSignal: WorkflowSignal) {
  const activeStep = workflowSignal.active_step_label.trim()
  const progressLabel =
    workflowSignal.total_steps > 0
      ? `${workflowSignal.completed_steps}/${workflowSignal.total_steps} steps complete`
      : "Workflow progress is loading"

  if (moduleName === "career-intelligence") {
    return activeStep
      ? `I can guide you through Career Intelligence step-by-step. You are currently on "${activeStep}" (${progressLabel}). Ask me for the fastest next action.`
      : "I can guide you through Career Intelligence step-by-step. Ask me for the fastest next action."
  }
  if (moduleName === "persona-foundry") {
    return activeStep
      ? `I can guide you through Persona Foundry. You are on "${activeStep}" (${progressLabel}). Ask me what to tune first.`
      : "I can guide you through Persona Foundry. Ask me what to tune first."
  }
  if (moduleName === "teamsync") {
    return activeStep
      ? `I can guide you through TeamSync. You are on "${activeStep}" (${progressLabel}). Ask me for the next best move.`
      : "I can guide you through TeamSync. Ask me for the next best move."
  }
  if (moduleName === "control-center") {
    return "I can guide you through Operations. Ask me which signal needs attention first."
  }
  return "I can guide you through this page step-by-step. Ask me what to do next."
}

function suggestedActionsForModule(moduleName: string): SuggestedAction[] {
  switch (moduleName) {
    case "career-intelligence":
      return [
        { label: "Open Candidate Setup", href: "#candidate-workflow" },
        { label: "Open Saved Work", href: "#saved-work-library" },
      ]
    case "persona-foundry":
      return [
        { label: "Open Baseline Step", href: "#persona-baseline" },
        { label: "Open Export Step", href: "#persona-export" },
      ]
    case "teamsync":
      return [
        { label: "Open Load Members", href: "#teamsync-intake" },
        { label: "Open Run Simulation", href: "#teamsync-run" },
      ]
    case "control-center":
      return [
        { label: "Open Unit Economics", href: "#unit-economics" },
        { label: "Open Tester Feedback", href: "#tester-feedback" },
      ]
    default:
      return [{ label: "Open page top", href: "#" }]
  }
}

function inferActionFromAssistantReply(moduleName: string, reply: string, visibleActions: string[]): SuggestedAction | null {
  const visibleActionMatch = findBestVisibleActionMatch(reply, visibleActions)
  if (visibleActionMatch) {
    return {
      label: `Click "${visibleActionMatch}"`,
      href: `@action:${encodeURIComponent(visibleActionMatch)}`,
    }
  }

  const actions = suggestedActionsForModule(moduleName)
  const text = reply.toLowerCase()
  if (text.includes("member") && moduleName === "teamsync") return actions.find((item) => item.href === "#teamsync-intake") ?? actions[0]
  if (text.includes("run") && moduleName === "teamsync") return actions.find((item) => item.href === "#teamsync-run") ?? actions[0]
  if ((text.includes("cost") || text.includes("margin")) && moduleName === "control-center")
    return actions.find((item) => item.href === "#unit-economics") ?? actions[0]
  if (text.includes("feedback") && moduleName === "control-center")
    return actions.find((item) => item.href === "#tester-feedback") ?? actions[0]
  if (text.includes("export") && moduleName === "persona-foundry")
    return actions.find((item) => item.href === "#persona-export") ?? actions[0]
  if ((text.includes("upload") || text.includes("file")) && moduleName === "career-intelligence")
    return actions.find((item) => item.href === "#candidate-workflow") ?? actions[0]
  return actions[0] ?? null
}

function findVisibleActionElementByLabel(label: string) {
  if (typeof document === "undefined") return null
  const normalizedLabel = normalizeMatchText(label)
  if (!normalizedLabel) return null
  const candidates = document.querySelectorAll<HTMLElement>("button, a, [role='button'], [data-agent-action]")
  for (const node of candidates) {
    const rect = node.getBoundingClientRect()
    if (rect.bottom < 64 || rect.top > window.innerHeight || rect.width < 24 || rect.height < 20) continue
    const candidateLabel =
      safeText(node.getAttribute("data-agent-action")) ||
      safeText(node.getAttribute("aria-label")) ||
      safeText(node.textContent, 80)
    if (!candidateLabel) continue
    if (normalizeMatchText(candidateLabel) === normalizedLabel) return node
  }
  return null
}

function jumpToAction(href: string) {
  if (typeof window === "undefined") return
  if (href.startsWith("@action:")) {
    const label = decodeURIComponent(href.replace("@action:", ""))
    const target = findVisibleActionElementByLabel(label)
    if (target) {
      scrollToElementWithOffset(target)
      target.focus({ preventScroll: true })
    }
    return
  }
  if (!href || href === "#") {
    window.scrollTo({ top: 0, behavior: "smooth" })
    return
  }
  const id = href.replace(/^#/, "")
  const target = document.getElementById(id)
  if (target) {
    scrollToElementWithOffset(target)
  } else {
    window.location.hash = href
  }
}

export function ExperienceAgentWidget({ enabled = true, inline = true }: { enabled?: boolean; inline?: boolean }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const workflowSignal = collectWorkflowSignal()
  const moduleName = useMemo(() => mapModuleFromPath(pathname), [pathname])
  const welcomeMessage = useMemo(() => buildWelcomeMessage(moduleName, workflowSignal), [moduleName, workflowSignal])
  const [sessionId, setSessionId] = useState("")
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [loadingSession, setLoadingSession] = useState(false)
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "I can guide you through this page step-by-step. Ask me what to do next.",
    },
  ])
  const [statusMessage, setStatusMessage] = useState("")
  const [statusTone, setStatusTone] = useState<"error" | "info">("error")
  const [feedbackTableMissing, setFeedbackTableMissing] = useState(false)
  const [feedbackByMessageId, setFeedbackByMessageId] = useState<Record<string, "up" | "down">>({})
  const quickPrompts = useMemo(() => modulePromptChips(moduleName, workflowSignal), [moduleName, workflowSignal])
  const missingTableMessage = "Agent storage is not enabled yet. Guidance still works."
  const signInRequiredMessage = "Sign in to use the live Agent. I can then read this page context and guide your next step."

  useEffect(() => {
    setMessages((current) => {
      if (current.length === 0) {
        return [
          {
            id: "welcome",
            role: "assistant",
            content: welcomeMessage,
          },
        ]
      }
      if (current.length === 1 && current[0]?.id === "welcome") {
        return [{ ...current[0], content: welcomeMessage }]
      }
      return current
    })
  }, [welcomeMessage])

  function showMissingTableInfo(message = missingTableMessage) {
    setStatusTone("info")
    setStatusMessage(message)
    setFeedbackTableMissing(true)
  }

  async function ensureSession() {
    if (sessionId) return sessionId
    setLoadingSession(true)
    try {
      const basePayload = {
        module: moduleName,
        route_path: pathname,
      }

      const getResponse = await fetch(
        `/api/agent/session?module=${encodeURIComponent(moduleName)}&route_path=${encodeURIComponent(pathname)}`,
        { headers: await getAuthHeaders() }
      )
      const getJson = await getResponse.json()
      if (getJson?.table_missing) {
        showMissingTableInfo()
      }
      if (getResponse.status === 401) {
        setStatusTone("info")
        setStatusMessage(signInRequiredMessage)
        return ""
      }
      if (getResponse.ok && getJson?.session?.id) {
        setSessionId(getJson.session.id)
        return getJson.session.id as string
      }

      const postResponse = await fetch("/api/agent/session", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...basePayload,
          context: collectPageContextSnapshot(pathname),
        }),
      })
      const postJson = await postResponse.json()
      if (postJson?.table_missing) {
        showMissingTableInfo()
      }
      if (postResponse.status === 401) {
        setStatusTone("info")
        setStatusMessage(signInRequiredMessage)
        return ""
      }
      if (!postResponse.ok || !postJson?.session?.id) {
        throw new Error(postJson?.error || "Could not start an agent session")
      }
      setSessionId(postJson.session.id)
      return postJson.session.id as string
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start agent"
      if (message.toLowerCase().includes("missing table")) {
        showMissingTableInfo()
      } else {
        setStatusTone("error")
        setStatusMessage(message)
      }
      return ""
    } finally {
      setLoadingSession(false)
    }
  }

  async function sendMessage(overrideMessage?: string) {
    const trimmed = (overrideMessage ?? input).trim()
    if (!trimmed || busy) return

    const userMessage: AgentMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
    }
    setMessages((current) => [...current, userMessage])
    setInput("")
    setBusy(true)
    setStatusTone("error")
    setStatusMessage("")

    try {
      const activeSessionId = await ensureSession()
      if (!activeSessionId) {
        setMessages((current) => [
          ...current,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: signInRequiredMessage,
          },
        ])
        return
      }

      const pageContext = collectPageContextSnapshot(pathname)
      const response = await fetch("/api/agent/respond", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: activeSessionId,
          module: moduleName,
          route_path: pathname,
          message: trimmed,
          context: pageContext,
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        if (json?.table_missing) {
          showMissingTableInfo()
          return
        }
        throw new Error(json?.error || "Agent could not respond")
      }
      const suggested = inferActionFromAssistantReply(moduleName, typeof json.message === "string" ? json.message : "", pageContext.visible_actions ?? [])
      const assistantMessage: AgentMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: typeof json.message === "string" && json.message.trim() ? json.message : "I can help with this. Try asking for the next best action.",
        serverMessageId: typeof json.message_id === "string" ? json.message_id : undefined,
        actionHref: suggested?.href,
        actionLabel: suggested?.label ? `Do this now: ${suggested.label}` : undefined,
      }
      setMessages((current) => [...current, assistantMessage])
    } catch (error) {
      const message = error instanceof Error ? error.message : "Agent could not respond"
      if (message.toLowerCase().includes("missing table")) {
        showMissingTableInfo()
      } else {
        setStatusTone("error")
        setStatusMessage(message)
      }
    } finally {
      setBusy(false)
    }
  }

  if (!enabled) return null

  async function sendFeedback(message: AgentMessage, rating: "up" | "down") {
    if (!sessionId || feedbackTableMissing) return
    const messageKey = message.serverMessageId || message.id
    setFeedbackByMessageId((current) => ({ ...current, [messageKey]: rating }))
    try {
      const response = await fetch("/api/agent/feedback", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
          message_id: message.serverMessageId || null,
          rating,
        }),
      })
      const json = await response.json()
      if (json?.table_missing) {
        showMissingTableInfo()
        return
      }
      if (!response.ok) {
        throw new Error(json?.error || "Could not save feedback")
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save feedback"
      if (message.toLowerCase().includes("missing table")) {
        showMissingTableInfo()
      } else {
        setStatusTone("error")
        setStatusMessage(message)
      }
    }
  }

  return (
    <div className={inline ? "relative" : ""}>
      <button
        type="button"
        onClick={async () => {
          const nextOpen = !open
          setOpen(nextOpen)
          if (nextOpen && !sessionId) {
            await ensureSession()
          }
        }}
        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
          open ? "border-[#0a66c2] bg-[#e8f3ff] text-[#0a66c2]" : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
        } ${inline ? "" : "fixed bottom-4 right-4 z-[220]"}`}
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 10h8M8 14h5" />
          <path d="M21 12a8.5 8.5 0 0 1-8.5 8.5A8.47 8.47 0 0 1 8 19.3L3 21l1.7-5A8.47 8.47 0 0 1 3.5 12 8.5 8.5 0 0 1 12 3.5 8.5 8.5 0 0 1 21 12Z" />
        </svg>
        Ask Agent
      </button>

      {open ? (
        <div
          className={`${inline ? "absolute right-0 top-10 z-[222]" : "fixed bottom-[4.5rem] right-4 z-[222]"} max-h-[min(70dvh,560px)] w-[390px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[#d8e4f2] bg-white shadow-xl`}
        >
          <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2.5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Ask Agent</div>
              <div className="text-[11px] text-neutral-500">{moduleName} · {pathname}</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
            >
              Close
            </button>
          </div>

          <div className="max-h-[320px] overflow-y-auto px-3 py-2">
            <div className="space-y-2">
              {messages.slice(-14).map((message) => (
                <div
                  key={message.id}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    message.role === "assistant"
                      ? "border-[#d8e4f2] bg-[#f8fbff] text-[#0f172a]"
                      : "border-neutral-300 bg-white text-neutral-800"
                  }`}
                >
                  <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                    {message.role === "assistant" ? "Agent" : "You"}
                  </div>
                  <p className="whitespace-pre-wrap leading-5">{message.content}</p>
                  {message.role === "assistant" && message.actionHref && message.actionLabel ? (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          jumpToAction(message.actionHref as string)
                          setOpen(false)
                        }}
                        className="rounded-lg border border-[#0a66c2] bg-[#e8f3ff] px-2.5 py-1 text-xs font-semibold text-[#0a66c2] hover:bg-[#dcecff]"
                      >
                        {message.actionLabel}
                      </button>
                    </div>
                  ) : null}
                  {message.role === "assistant" ? (
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="text-[10px] uppercase tracking-[0.08em] text-neutral-500">Helpful?</span>
                      <button
                        type="button"
                        onClick={() => void sendFeedback(message, "up")}
                        disabled={feedbackTableMissing}
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          feedbackByMessageId[message.serverMessageId || message.id] === "up"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                            : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        👍
                      </button>
                      <button
                        type="button"
                        onClick={() => void sendFeedback(message, "down")}
                        disabled={feedbackTableMissing}
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          feedbackByMessageId[message.serverMessageId || message.id] === "down"
                            ? "border-rose-300 bg-rose-50 text-rose-700"
                            : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        👎
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-neutral-200 px-3 py-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Quick prompts</div>
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((prompt) => (
                <button
                  key={`agent-prompt-${prompt}`}
                  type="button"
                  onClick={() => {
                    if (busy || loadingSession) return
                    setInput(prompt)
                    void sendMessage(prompt)
                  }}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-neutral-200 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void sendMessage()
                  }
                }}
                placeholder={loadingSession ? "Starting agent session..." : "Ask what to do next..."}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={busy || loadingSession || !input.trim()}
                className="rounded-xl border border-[#0a66c2] bg-[#0a66c2] px-3 py-2 text-xs font-semibold text-white hover:bg-[#004182] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "..." : "Send"}
              </button>
            </div>
            {statusMessage ? (
              <p className={`mt-1.5 text-xs ${statusTone === "info" ? "text-sky-700" : "text-rose-700"}`}>{statusMessage}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
