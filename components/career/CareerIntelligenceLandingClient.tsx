"use client"

import Link from "next/link"
import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { getAuthHeaders, toCareerUserMessage } from "@/lib/career-client"
import { PlatformModuleNav } from "@/components/navigation/PlatformModuleNav"
import { ModuleExplainerPanel } from "@/components/navigation/ModuleExplainerPanel"
import { ModuleIntroGuide } from "@/components/navigation/ModuleIntroGuide"
import { WelcomeBackNotice } from "@/components/navigation/WelcomeBackNotice"
import { extractLinkedInProfile } from "@/lib/linkedin-profile"
import { clearOAuthReturnParamsFromUrl, getOAuthRedirectTo, getOAuthReturnErrorFromUrl } from "@/lib/oauth-return"
import type { AuthProviderStatus } from "@/lib/auth-provider-status"

const DRAFT_KEY = "career-intelligence-onboarding-draft-v1"

type CareerCandidateSummary = {
  id: string
  full_name: string | null
  city: string | null
  primary_goal: string | null
  created_at: string | null
  latest_activity_at?: string | null
  readiness_score?: number | null
  active_application_count?: number | null
  document_count?: number | null
  profile_count?: number | null
  asset_count?: number | null
  active_run_count?: number | null
}

function formatLandingGoal(value: string | null | undefined) {
  if (!value) return "Goal not set"
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatLandingActivity(value: string | null | undefined) {
  if (!value) return "No recent activity"

  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return "No recent activity"

  const diffDays = Math.floor((Date.now() - time) / 86400000)
  if (diffDays <= 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays} days ago`

  return new Date(value).toLocaleDateString()
}

export function CareerIntelligenceLandingClient() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [busyProvider, setBusyProvider] = useState<"google" | "facebook" | "linkedin_oidc" | null>(null)
  const [providerStatus, setProviderStatus] = useState<Record<"google" | "facebook" | "linkedin_oidc", AuthProviderStatus>>({
    google: { key: "google", label: "Google", enabled: true },
    facebook: { key: "facebook", label: "Facebook", enabled: false, reason: "Not configured yet" },
    linkedin_oidc: { key: "linkedin_oidc", label: "LinkedIn", enabled: false, reason: "Not configured yet" },
  })
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [city, setCity] = useState("")
  const [primaryGoal, setPrimaryGoal] = useState("new_role")
  const [linkedInAutoFilled, setLinkedInAutoFilled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingCareerCandidates, setLoadingCareerCandidates] = useState(false)
  const [careerCandidates, setCareerCandidates] = useState<CareerCandidateSummary[]>([])
  const [isLocalTestLoginAvailable, setIsLocalTestLoginAvailable] = useState(false)
  const [testLoginLoading, setTestLoginLoading] = useState(false)
  const [message, setMessage] = useState("")
  const linkedInProfile = extractLinkedInProfile(session?.user)

  useEffect(() => {
    const rawDraft = typeof window !== "undefined" ? window.localStorage.getItem(DRAFT_KEY) : null
    if (rawDraft) {
      try {
        const draft = JSON.parse(rawDraft) as {
          fullName?: string
          email?: string
          city?: string
          primaryGoal?: string
        }
        if (draft.fullName) setFullName(draft.fullName)
        if (draft.email) setEmail(draft.email)
        if (draft.city) setCity(draft.city)
        if (draft.primaryGoal) setPrimaryGoal(draft.primaryGoal)
      } catch {}
    }

    async function loadSession() {
      const oauthError = getOAuthReturnErrorFromUrl()
      if (oauthError) {
        setMessage(oauthError)
        clearOAuthReturnParamsFromUrl()
      }
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()
      setSession(currentSession)
      setBusyProvider(null)
      if (currentSession?.user?.email) {
        setEmail((current) => current || currentSession.user.email || "")
      }
    }
    async function loadProviderStatus() {
      try {
        const response = await fetch("/api/auth/provider-status")
        const json = await response.json()
        const providers = Array.isArray(json.providers) ? (json.providers as AuthProviderStatus[]) : []
        setProviderStatus((current) => {
          const next = { ...current }
          for (const provider of providers) {
            next[provider.key] = provider
          }
          return next
        })
      } catch {}
    }

    void loadSession()
    void loadProviderStatus()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setBusyProvider(null)
      if (nextSession?.user?.email) {
        setEmail((current) => current || nextSession.user.email || "")
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    setIsLocalTestLoginAvailable(["localhost", "127.0.0.1", "::1"].includes(window.location.hostname))
  }, [])

  useEffect(() => {
    if (!linkedInProfile.available || linkedInAutoFilled) return

    if (linkedInProfile.fullName && !fullName) {
      setFullName(linkedInProfile.fullName)
    }
    if (linkedInProfile.city && !city) {
      setCity(linkedInProfile.city)
    }
    setLinkedInAutoFilled(true)
  }, [city, fullName, linkedInAutoFilled, linkedInProfile.available, linkedInProfile.city, linkedInProfile.fullName])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        fullName,
        email,
        city,
        primaryGoal,
      })
    )
  }, [fullName, email, city, primaryGoal])

  useEffect(() => {
    if (!session?.user) {
      setCareerCandidates([])
      return
    }

    let isMounted = true

    async function loadCareerCandidates() {
      setLoadingCareerCandidates(true)
      try {
        const response = await fetch("/api/career/candidates?scope=mine", {
          headers: await getAuthHeaders(),
        })
        const json = await response.json()
        if (!response.ok) {
          throw new Error(json.error || "Could not load Career workspaces")
        }
        if (isMounted) {
          setCareerCandidates(Array.isArray(json.candidates) ? (json.candidates as CareerCandidateSummary[]) : [])
        }
      } catch {
        if (isMounted) {
          setCareerCandidates([])
        }
      } finally {
        if (isMounted) {
          setLoadingCareerCandidates(false)
        }
      }
    }

    void loadCareerCandidates()

    return () => {
      isMounted = false
    }
  }, [session?.user])

  const latestCareerWorkspace =
    [...careerCandidates].sort((a, b) => {
      const aTime = Date.parse(a.latest_activity_at || a.created_at || "") || 0
      const bTime = Date.parse(b.latest_activity_at || b.created_at || "") || 0
      return bTime - aTime
    })[0] ?? null
  const recentCareerWorkspaces = [...careerCandidates]
    .sort((a, b) => {
      const aTime = Date.parse(a.latest_activity_at || a.created_at || "") || 0
      const bTime = Date.parse(b.latest_activity_at || b.created_at || "") || 0
      return bTime - aTime
    })
    .slice(0, 3)
  const activeCareerApplicationCount = careerCandidates.reduce((sum, candidate) => sum + (candidate.active_application_count ?? 0), 0)
  const readyCareerWorkspaceCount = careerCandidates.filter((candidate) => (candidate.readiness_score ?? 0) >= 70).length
  const runningCareerWorkspaceCount = careerCandidates.filter((candidate) => (candidate.active_run_count ?? 0) > 0).length
  const careerCommandCenterStats = [
    { label: "Career workspaces", value: String(careerCandidates.length) },
    { label: "Active roles", value: String(activeCareerApplicationCount) },
    { label: "Market ready", value: String(readyCareerWorkspaceCount) },
    { label: "Running now", value: String(runningCareerWorkspaceCount) },
  ]
  const careerRecommendedAction = latestCareerWorkspace
    ? {
        title: `Open ${latestCareerWorkspace.full_name || "latest Career workspace"}`,
        detail:
          activeCareerApplicationCount > 0
            ? "Review active roles, follow-ups, and saved outputs before creating anything new."
            : "Continue from the most recent Career workspace and keep the workflow moving.",
        href: `/career/${latestCareerWorkspace.id}`,
        action: "Open latest workspace",
      }
    : {
        title: "Create your first Career workspace",
        detail: "Start with name, city, and career goal. CV and supporting files can be loaded after creation.",
        href: "#career-workspace-create",
        action: "Create workspace",
      }
  const sessionMetadata = session?.user?.user_metadata as Record<string, unknown> | undefined
  const signedInDisplayName =
    linkedInProfile.fullName ||
    (typeof sessionMetadata?.full_name === "string" ? sessionMetadata.full_name : "") ||
    (typeof sessionMetadata?.name === "string" ? sessionMetadata.name : "") ||
    fullName ||
    session?.user?.email?.split("@")[0] ||
    "there"
  const signedInDestinationCards = [
    {
      title: "Career Intelligence",
      detail: latestCareerWorkspace
        ? `${latestCareerWorkspace.full_name || "Career workspace"}${latestCareerWorkspace.active_application_count ? ` | ${latestCareerWorkspace.active_application_count} active role${latestCareerWorkspace.active_application_count === 1 ? "" : "s"}` : ""}`
        : loadingCareerCandidates
          ? "Checking for your saved workspace..."
          : "Create your first career workspace.",
      action: latestCareerWorkspace ? "Open workspace" : "Create workspace",
      href: latestCareerWorkspace ? `/career/${latestCareerWorkspace.id}` : "#career-workspace-create",
      tone: "border-sky-200 bg-sky-50 text-sky-950",
      status: latestCareerWorkspace
        ? `${latestCareerWorkspace.readiness_score ?? 0}/100 ready`
        : loadingCareerCandidates
          ? "Checking"
          : "Not started",
    },
    {
      title: "Persona Foundry",
      detail: "Build or refine identity, voice, and decision profiles.",
      action: "Open Persona Foundry",
      href: "/persona-foundry",
      tone: "border-violet-200 bg-violet-50 text-violet-950",
      status: "Available",
    },
    {
      title: "TeamSync",
      detail: "Work on team dynamics, shared strengths, and communication.",
      action: "Open TeamSync",
      href: "/teamsync",
      tone: "border-teal-200 bg-teal-50 text-teal-950",
      status: "Available",
    },
  ]

  async function signInWithProvider(provider: "google" | "facebook" | "linkedin_oidc") {
    if (!providerStatus[provider]?.enabled) {
      setMessage(`${providerStatus[provider]?.label || "This provider"} login is not configured yet.`)
      return
    }
    setBusyProvider(provider)
    const redirectTo = getOAuthRedirectTo("/career-intelligence")

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: redirectTo ? { redirectTo } : undefined,
    })

    if (error) {
      const text = (error.message || "").toLowerCase()
      if (text.includes("unsupported provider") || text.includes("provider is not enabled")) {
        setProviderStatus((current) => ({
          ...current,
          [provider]: {
            ...current[provider],
            enabled: false,
            reason: "Provider not enabled in Supabase",
          },
        }))
      }
      setMessage(error.message)
      setBusyProvider(null)
    }
  }

  async function handleSwitchAccount() {
    setMessage("")
    await supabase.auth.signOut()
    setSession(null)
  }

  async function handleTestLogin() {
    setMessage("")
    setTestLoginLoading(true)
    try {
      const response = await fetch("/api/auth/test-login", { method: "POST" })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Test login failed")
      }

      const accessToken = json.session?.access_token as string | undefined
      const refreshToken = json.session?.refresh_token as string | undefined
      if (!accessToken || !refreshToken) {
        throw new Error("Test login did not return a usable session")
      }

      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      if (error) throw error

      setSession(data.session)
      if (data.session?.user?.email) {
        setEmail((current) => current || data.session?.user?.email || "")
      }
      setMessage("Signed in with the local test account.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Test login failed")
    } finally {
      setTestLoginLoading(false)
    }
  }

  async function handleCreateWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage("")

    if (!session?.user) {
      setMessage("Please sign in first, then create your workspace.")
      return
    }
    if (!fullName.trim()) {
      setMessage("Please enter your full name.")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/career/candidates", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          full_name: fullName,
          city,
          primary_goal: primaryGoal,
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to create workspace")
      }

      const candidateId = json.candidate?.id as string | undefined
      if (!candidateId) throw new Error("Workspace created but no id was returned")

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(DRAFT_KEY)
      }
      router.push(`/career/${candidateId}`)
      router.refresh()
    } catch (error) {
      setMessage(toCareerUserMessage(error instanceof Error ? error.message : null))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-neutral-900">
      <ModuleIntroGuide
        moduleKey="career-intelligence"
        title="How to use Career Intelligence"
        subtitle="See the flow from source files to profile, documents, interviews, and role execution."
        imageSrc="/images/module-guides/how-to-use-career-intelligence.png"
        startLabel="Start Career Intelligence"
        accent="blue"
      />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <PlatformModuleNav />
        <WelcomeBackNotice userId={session?.user?.id} moduleLabel="Career Intelligence" />
        <section className="rounded-[2rem] border border-[#d9e2ec] bg-[linear-gradient(135deg,#ffffff_0%,#eef6ff_45%,#f3f8ff_100%)] p-7 shadow-sm">
          {!session?.user ? (
            <div className="mb-4 rounded-2xl border border-[#d8e4f2] bg-white px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">Auth rollout status</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-emerald-700">Google live</span>
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-amber-800">Facebook on hold</span>
                <span className="rounded-full border border-sky-300 bg-sky-50 px-2.5 py-1 text-sky-800">LinkedIn deferred (branding setup)</span>
              </div>
            </div>
          ) : (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <div>
                <span className="font-semibold">Signed in</span>
                {session.user.email ? ` as ${session.user.email}` : ""}
              </div>
              <button
                type="button"
                onClick={() => void handleSwitchAccount()}
                className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-800 hover:bg-emerald-100"
              >
                Switch account
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5b6b7c]">
                {session?.user ? "Personara workspace" : "Career Intelligence"}
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0f172a]">
                {session?.user ? `Welcome back, ${signedInDisplayName}` : "From profile to real job outcomes"}
              </h1>
              <p className="mt-3 text-sm leading-6 text-[#475569]">
                {session?.user
                  ? "Choose where you want to continue today. Career Intelligence, Persona Foundry, and TeamSync all use the same signed-in account."
                  : "Sign in, create one workspace, then generate profile, documents, and interview prep in sequence."}
              </p>
              <ModuleExplainerPanel
                buttonLabel="Why Career Intelligence Works"
                title="Why Career Intelligence Works"
                summary="Career Intelligence combines your identity profile, strengths signals, and role evidence into one guided execution flow so every output is more targeted, coherent, and interview-ready."
                docHref="/docs/personara-ai-career-intelligence-explainer.docx"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <a
                  href="/docs/personara-ai-career-intelligence-explainer.docx"
                  target="_blank"
                  rel="noreferrer"
                  className="personara-explainer-chip"
                >
                  Open career explainer
                </a>
                <a
                  href="/docs/personara-candidate-explainer-v2.docx"
                  target="_blank"
                  rel="noreferrer"
                  className="personara-explainer-chip"
                >
                  Open candidate guide
                </a>
                <a
                  href="/docs/personara-ai-gallup-strengths-explainer.docx"
                  target="_blank"
                  rel="noreferrer"
                  className="personara-explainer-chip"
                >
                  Open Gallup explainer
                </a>
                <Link
                  href="/resources#career"
                  className="personara-explainer-chip"
                >
                  Open resource hub
                </Link>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/career" className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
                Open workspace hub
              </Link>
              <Link href="/platform" className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
                Back to homepage
              </Link>
            </div>
          </div>

          {!session?.user ? (
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Step 1</div>
                <div className="mt-1 text-sm font-semibold text-neutral-900">Sign in</div>
                <p className="mt-1 text-xs text-neutral-600">Use Google now. Facebook and LinkedIn can be enabled later.</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Step 2</div>
                <div className="mt-1 text-sm font-semibold text-neutral-900">Create workspace</div>
                <p className="mt-1 text-xs text-neutral-600">Add your basic details to open your candidate space.</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Step 3</div>
                <div className="mt-1 text-sm font-semibold text-neutral-900">Load and generate</div>
                <p className="mt-1 text-xs text-neutral-600">Upload CV/Strengths first, then generate outputs.</p>
              </div>
            </div>
          ) : null}
        </section>

        {session?.user ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748b]">Command center</div>
                  <h2 className="mt-2 text-2xl font-semibold text-[#0f172a]">Continue where the work is warm</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                    You are already signed in. Pick the right module, reopen the most recent Career workspace, or create a new one only when it is truly needed.
                  </p>
                </div>
                <Link
                  href="/platform"
                  className="rounded-full border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-white"
                >
                  All modules
                </Link>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                {careerCommandCenterStats.map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">{stat.label}</div>
                    <div className="mt-1 text-lg font-semibold text-neutral-900">{loadingCareerCandidates ? "..." : stat.value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">Recommended next move</div>
                    <div className="mt-1 text-base font-semibold text-sky-950">{careerRecommendedAction.title}</div>
                    <p className="mt-1 text-sm leading-5 text-sky-900">{careerRecommendedAction.detail}</p>
                  </div>
                  <Link
                    href={careerRecommendedAction.href}
                    className="rounded-full border border-[#0a66c2] bg-[#0a66c2] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#0958a8]"
                  >
                    {careerRecommendedAction.action}
                  </Link>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {signedInDestinationCards.map((destination) => (
                  <Link
                    key={destination.title}
                    href={destination.href}
                    className={`block rounded-2xl border px-4 py-3 transition hover:shadow-sm ${destination.tone}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-base font-semibold">{destination.title}</div>
                          <span className="rounded-full border border-white/80 bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                            {destination.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-5 opacity-85">{destination.detail}</p>
                      </div>
                      <span className="rounded-full border border-white/80 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-800">
                        {destination.action}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>

              {recentCareerWorkspaces.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Recent Career workspaces</div>
                    <Link href="/career" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:text-neutral-950">
                      View hub
                    </Link>
                  </div>
                  <div className="mt-2 divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
                    {recentCareerWorkspaces.map((workspace) => (
                      <Link
                        key={workspace.id}
                        href={`/career/${workspace.id}`}
                        className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 hover:bg-neutral-50"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-neutral-900">{workspace.full_name || "Untitled workspace"}</div>
                          <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-neutral-600">
                            <span>{formatLandingGoal(workspace.primary_goal)}</span>
                            <span>{workspace.city || "Location not set"}</span>
                            <span>{formatLandingActivity(workspace.latest_activity_at || workspace.created_at)}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                            {workspace.readiness_score ?? 0}/100
                          </span>
                          {(workspace.active_application_count ?? 0) > 0 ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              {workspace.active_application_count} active
                            </span>
                          ) : null}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs leading-5 text-neutral-600">
                  No Career workspace yet. Create one on the right, or open Persona Foundry or TeamSync if that is the work for today.
                </div>
              )}
            </div>

            <div id="career-workspace-create" className="scroll-mt-24 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">
                {latestCareerWorkspace ? "Create another Career workspace" : "Create your Career workspace"}
              </h2>
              <p className="mt-2 text-sm text-neutral-600">
                {latestCareerWorkspace
                  ? "Use this only when you want a separate candidate or scenario workspace."
                  : "Quick setup now. You can add detailed files after creation."}
              </p>
              {latestCareerWorkspace ? (
                <Link
                  href={`/career/${latestCareerWorkspace.id}`}
                  className="mt-3 inline-flex rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100"
                >
                  Open latest Career workspace
                </Link>
              ) : null}
              {linkedInProfile.available ? (
                <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900">
                  LinkedIn sign-in detected. We pre-filled what we could from your profile, and you can adjust anything before creating your workspace.
                </div>
              ) : null}

              <form onSubmit={handleCreateWorkspace} className="mt-4 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Full name</label>
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                    placeholder="Jane Smith"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Email</label>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                    placeholder="jane@email.com"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">City</label>
                    <input
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                      placeholder="Auckland"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Primary goal</label>
                    <select
                      value={primaryGoal}
                      onChange={(event) => setPrimaryGoal(event.target.value)}
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                    >
                      <option value="new_role">Land a new role</option>
                      <option value="promotion">Position for promotion</option>
                      <option value="career_change">Change direction</option>
                      <option value="board_portfolio">Board or advisory work</option>
                      <option value="consulting">Consulting or fractional work</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !fullName.trim()}
                  className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Creating workspace..." : latestCareerWorkspace ? "Create another workspace" : "Create workspace"}
                </button>
              </form>

              {message ? <p className="mt-3 text-sm text-rose-700">{message}</p> : null}
            </div>
          </section>
        ) : (
          <section className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Step 1: Sign in</h2>
            <p className="text-sm text-neutral-600">Sign in first, then return to Step 2 to create the workspace.</p>

            {session?.user ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                Signed in as <span className="font-semibold">{session.user.email}</span>
              </div>
            ) : null}

            <div className="space-y-2">
              {session?.user ? (
                <button
                  type="button"
                  onClick={() => void handleSwitchAccount()}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Switch account
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void signInWithProvider("google")}
                disabled={busyProvider !== null || testLoginLoading || !providerStatus.google.enabled}
                className="w-full rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyProvider === "google" ? "Connecting..." : "Continue with Google"}
              </button>
              {isLocalTestLoginAvailable ? (
                <button
                  type="button"
                  onClick={() => void handleTestLogin()}
                  disabled={busyProvider !== null || testLoginLoading}
                  className="w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {testLoginLoading ? "Signing in..." : "Test login"}
                </button>
              ) : null}
              {!providerStatus.google.enabled ? <p className="text-[11px] text-neutral-500">{providerStatus.google.reason || "Not configured yet."}</p> : null}
              <button
                type="button"
                onClick={() => void signInWithProvider("facebook")}
                disabled={busyProvider !== null || testLoginLoading || !providerStatus.facebook.enabled}
                className="w-full rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyProvider === "facebook" ? "Connecting..." : "Continue with Facebook"}
              </button>
              {!providerStatus.facebook.enabled ? <p className="text-[11px] text-neutral-500">{providerStatus.facebook.reason || "Not configured yet."}</p> : null}
              <button
                type="button"
                onClick={() => void signInWithProvider("linkedin_oidc")}
                disabled={busyProvider !== null || testLoginLoading || !providerStatus.linkedin_oidc.enabled}
                className="w-full rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyProvider === "linkedin_oidc" ? "Connecting..." : "Continue with LinkedIn"}
              </button>
              {!providerStatus.linkedin_oidc.enabled ? <p className="text-[11px] text-neutral-500">{providerStatus.linkedin_oidc.reason || "Not configured yet."}</p> : null}
            </div>

            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-5 text-sky-900">
              Product roadmap: this page is designed to become the main entry point for three modules - GPT Personality Builder, Career Intelligence, and Gallup Strengths Team/Family Dynamics.
            </div>
            </div>

            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Step 2: Create your workspace</h2>
            <p className="mt-2 text-sm text-neutral-600">Quick setup now. You can add detailed files after creation.</p>
            {linkedInProfile.available ? (
              <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900">
                LinkedIn sign-in detected. We pre-filled what we could from your profile, and you can adjust anything before creating your workspace.
              </div>
            ) : null}

            <form onSubmit={handleCreateWorkspace} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Full name</label>
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                  placeholder="Jane Smith"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Email</label>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                  placeholder="jane@email.com"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">City</label>
                  <input
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                    placeholder="Auckland"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Primary goal</label>
                  <select
                    value={primaryGoal}
                    onChange={(event) => setPrimaryGoal(event.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                  >
                    <option value="new_role">Land a new role</option>
                    <option value="promotion">Position for promotion</option>
                    <option value="career_change">Change direction</option>
                    <option value="board_portfolio">Board or advisory work</option>
                    <option value="consulting">Consulting or fractional work</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !fullName.trim() || !session?.user}
                className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {!session?.user ? "Sign in to create workspace" : loading ? "Creating workspace..." : "Create workspace"}
              </button>
              {!session?.user ? <p className="text-xs text-neutral-500">Complete Step 1 sign-in before creating a workspace.</p> : null}
            </form>

            {message ? <p className="mt-3 text-sm text-rose-700">{message}</p> : null}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
