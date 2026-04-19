"use client"

import { useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { getAuthHeaders } from "@/lib/career-client"

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

function modulePromptChips(moduleName: string): string[] {
  switch (moduleName) {
    case "career-intelligence":
      return [
        "What should I do next in this candidate workflow?",
        "Help me load source files correctly.",
        "What is the fastest path to a good cover letter?",
      ]
    case "persona-foundry":
      return [
        "What should I tune first in my persona?",
        "How do I use Gallup strengths as baseline?",
        "What is the quickest export path?",
      ]
    case "teamsync":
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

function inferActionFromAssistantReply(moduleName: string, reply: string): SuggestedAction | null {
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

function jumpToAction(href: string) {
  if (typeof window === "undefined") return
  if (!href || href === "#") {
    window.scrollTo({ top: 0, behavior: "smooth" })
    return
  }
  const id = href.replace(/^#/, "")
  const target = document.getElementById(id)
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" })
  } else {
    window.location.hash = href
  }
}

export function ExperienceAgentWidget({ enabled = true }: { enabled?: boolean }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
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
  const moduleName = useMemo(() => mapModuleFromPath(pathname), [pathname])
  const quickPrompts = useMemo(() => modulePromptChips(moduleName), [moduleName])
  const missingTableMessage = "Agent storage is not enabled yet. Guidance still works."

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
          context: {
            page_title: typeof document !== "undefined" ? document.title : "",
          },
        }),
      })
      const postJson = await postResponse.json()
      if (postJson?.table_missing) {
        showMissingTableInfo()
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

  async function sendMessage() {
    const trimmed = input.trim()
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
      if (!activeSessionId) return

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
          context: {
            page_title: typeof document !== "undefined" ? document.title : "",
            section_anchor: currentSectionAnchor(),
            full_url:
              typeof window !== "undefined"
                ? `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`
                : pathname,
          },
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
      const suggested = inferActionFromAssistantReply(moduleName, typeof json.message === "string" ? json.message : "")
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
    <>
      <button
        type="button"
        onClick={async () => {
          const nextOpen = !open
          setOpen(nextOpen)
          if (nextOpen && !sessionId) {
            await ensureSession()
          }
        }}
        className={`fixed right-4 top-[max(3.75rem,env(safe-area-inset-top))] z-[220] inline-flex items-center rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
          open ? "border-[#0a66c2] bg-[#e8f3ff] text-[#0a66c2]" : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
        }`}
      >
        Ask Agent
      </button>

      {open ? (
        <div className="fixed right-4 top-[max(6rem,env(safe-area-inset-top))] z-[222] max-h-[calc(100dvh-6.5rem)] w-[390px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[#d8e4f2] bg-white shadow-xl">
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
                  onClick={() => setInput(prompt)}
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
    </>
  )
}
