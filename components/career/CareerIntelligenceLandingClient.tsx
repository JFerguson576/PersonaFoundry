"use client"

import Link from "next/link"
import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { getAuthHeaders, toCareerUserMessage } from "@/lib/career-client"
import { PlatformModuleNav } from "@/components/navigation/PlatformModuleNav"
import { ModuleExplainerPanel } from "@/components/navigation/ModuleExplainerPanel"
import { WelcomeBackNotice } from "@/components/navigation/WelcomeBackNotice"
import { extractLinkedInProfile } from "@/lib/linkedin-profile"
import { clearOAuthReturnParamsFromUrl, getOAuthReturnErrorFromUrl } from "@/lib/oauth-return"
import type { AuthProviderStatus } from "@/lib/auth-provider-status"

const DRAFT_KEY = "career-intelligence-onboarding-draft-v1"

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

  async function signInWithProvider(provider: "google" | "facebook" | "linkedin_oidc") {
    if (!providerStatus[provider]?.enabled) {
      setMessage(`${providerStatus[provider]?.label || "This provider"} login is not configured yet.`)
      return
    }
    setBusyProvider(provider)
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/career-intelligence`
        : process.env.NEXT_PUBLIC_SITE_URL
          ? `${process.env.NEXT_PUBLIC_SITE_URL}/career-intelligence`
          : undefined

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
      <div className="mx-auto max-w-6xl px-6 py-10">
        <PlatformModuleNav />
        <WelcomeBackNotice userId={session?.user?.id} moduleLabel="Career Intelligence" />
        <section className="rounded-[2rem] border border-[#d9e2ec] bg-[linear-gradient(135deg,#ffffff_0%,#eef6ff_45%,#f3f8ff_100%)] p-7 shadow-sm">
          <div className="mb-4 rounded-2xl border border-[#d8e4f2] bg-white px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">Auth rollout status</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-emerald-700">Google live</span>
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-amber-800">Facebook on hold</span>
              <span className="rounded-full border border-sky-300 bg-sky-50 px-2.5 py-1 text-sky-800">LinkedIn deferred (branding setup)</span>
            </div>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5b6b7c]">Career Intelligence</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0f172a]">From profile to real job outcomes</h1>
              <p className="mt-3 text-sm leading-6 text-[#475569]">Sign in, create one workspace, then generate profile, documents, and interview prep in sequence.</p>
              <ModuleExplainerPanel
                buttonLabel="Why Career Intelligence Works"
                title="Why Career Intelligence Works"
                summary="Career Intelligence combines your identity profile, strengths signals, and role evidence into one guided execution flow so every output is more targeted, coherent, and interview-ready."
                docHref="/docs/personara-ai-career-intelligence-explainer.docx"
              />
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
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
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
                disabled={busyProvider !== null || !providerStatus.google.enabled}
                className="w-full rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyProvider === "google" ? "Connecting..." : "Continue with Google"}
              </button>
              {!providerStatus.google.enabled ? <p className="text-[11px] text-neutral-500">{providerStatus.google.reason || "Not configured yet."}</p> : null}
              <button
                type="button"
                onClick={() => void signInWithProvider("facebook")}
                disabled={busyProvider !== null || !providerStatus.facebook.enabled}
                className="w-full rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyProvider === "facebook" ? "Connecting..." : "Continue with Facebook"}
              </button>
              {!providerStatus.facebook.enabled ? <p className="text-[11px] text-neutral-500">{providerStatus.facebook.reason || "Not configured yet."}</p> : null}
              <button
                type="button"
                onClick={() => void signInWithProvider("linkedin_oidc")}
                disabled={busyProvider !== null || !providerStatus.linkedin_oidc.enabled}
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
        </section>
      </div>
    </main>
  )
}
