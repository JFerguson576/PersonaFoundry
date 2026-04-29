"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { PlatformModuleNav } from "@/components/navigation/PlatformModuleNav"
import { ModuleExplainerPanel } from "@/components/navigation/ModuleExplainerPanel"
import { WelcomeBackNotice } from "@/components/navigation/WelcomeBackNotice"
import { clearOAuthReturnParamsFromUrl, getOAuthRedirectTo, getOAuthReturnErrorFromUrl } from "@/lib/oauth-return"
import type { AuthProviderStatus } from "@/lib/auth-provider-status"

type Provider = "google" | "facebook" | "linkedin_oidc"

export default function PlatformLandingPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [busyProvider, setBusyProvider] = useState<Provider | null>(null)
  const [message, setMessage] = useState("")
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [providerStatus, setProviderStatus] = useState<Record<Provider, AuthProviderStatus>>({
    google: { key: "google", label: "Google", enabled: true },
    facebook: { key: "facebook", label: "Facebook", enabled: false, reason: "Not configured yet" },
    linkedin_oidc: { key: "linkedin_oidc", label: "LinkedIn", enabled: false, reason: "Not configured yet" },
  })

  useEffect(() => {
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
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSignIn(provider: Provider) {
    if (!providerStatus[provider]?.enabled) {
      setMessage(`${providerStatus[provider]?.label || "This provider"} login is not configured yet.`)
      return
    }
    setMessage("")
    setBusyProvider(provider)
    const redirectTo = getOAuthRedirectTo("/platform")

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
    }
    setBusyProvider(null)
  }

  async function handleSignOut() {
    setMessage("")
    const { error } = await supabase.auth.signOut()
    if (error) setMessage(error.message)
  }

  const modules = [
    {
      key: "career-intelligence",
      order: "1",
      title: "Career Intelligence",
      subtitle: "From profile to role-ready execution",
      detail:
        "Turn identity into action with candidate onboarding, document generation, interview preparation, company dossiers, and live opportunity workflows.",
      href: "/career-intelligence",
      cta: "Open Workspace",
    },
    {
      key: "teamsync",
      order: "2",
      title: "TeamSync",
      subtitle: "Strengths-aware team intelligence",
      detail:
        "Map how people collaborate under pressure, identify friction patterns, and generate practical playbooks for stronger team dynamics.",
      href: "/teamsync",
      cta: "Open Workspace",
    },
    {
      key: "persona-foundry",
      order: "3",
      title: "Persona Foundry",
      subtitle: "Build your AI operating identity",
      detail:
        "Design and tune communication traits, generate deployment-ready prompts, and test personality behavior in a controlled sandbox.",
      href: "/persona-foundry",
      cta: "Open Studio",
    },
  ] as const

  const isSignedIn = Boolean(session?.user)

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <PlatformModuleNav />
        <WelcomeBackNotice userId={session?.user?.id} moduleLabel="Personara" />
        {!isSignedIn || message ? (
          <section
            id="overview"
            className="rounded-[2rem] border border-[#bfd2ed] bg-[linear-gradient(135deg,#ffffff_0%,#edf4ff_50%,#eef5ff_100%)] p-7 shadow-[0_14px_30px_-26px_rgba(26,54,93,0.5)]"
          >
          <div className="flex justify-end">
            <div className="relative">
              <button
                type="button"
                onClick={() => setAccountMenuOpen((current) => !current)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#c3d4ea] bg-white text-[#2f4a73] shadow-sm hover:bg-[#f4f8ff]"
                aria-label="Account"
                title={session?.user?.email ? "Account" : "Sign in"}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21a8 8 0 0 0-16 0" />
                  <circle cx="12" cy="8" r="4" />
                </svg>
              </button>
              {accountMenuOpen ? (
                <div className="absolute right-0 z-20 mt-2 w-64 rounded-2xl border border-[#c3d4ea] bg-white p-3 shadow-lg">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">Account</p>
                  {session?.user?.email ? (
                    <div className="mt-2 space-y-2">
                      <p className="text-sm text-[#334155]">
                        Signed in as <span className="font-semibold">{session.user.email}</span>
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          await handleSignOut()
                          setAccountMenuOpen(false)
                        }}
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50"
                      >
                        Sign out
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      <button
                        type="button"
                        onClick={() => void handleSignIn("google")}
                        disabled={busyProvider !== null || !providerStatus.google.enabled}
                        className="w-full rounded-xl bg-[#2a63e5] px-3 py-2 text-sm font-medium text-white hover:bg-[#1f56d5] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyProvider === "google" ? "Connecting..." : "Continue with Google"}
                      </button>
                      {!providerStatus.google.enabled ? <p className="text-[11px] text-neutral-500">{providerStatus.google.reason || "Not configured yet."}</p> : null}
                      <p className="text-[11px] text-neutral-500">Google sign-in is the active login path for current user testing.</p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
          {!isSignedIn ? (
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5b6b7c]">Personara.ai</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#142c4f]">Identity. Decisions. Intelligence.</h1>
                <p className="mt-3 text-sm leading-6 text-[#475569]">
                  Personara is the system that defines how humans and AI operate across Career Intelligence, Persona Foundry, and TeamSync.
                </p>
                <ModuleExplainerPanel
                  buttonLabel="Platform Proposition"
                  title="Personara Platform Proposition"
                  summary="Personara creates one identity-aware operating layer across career, AI personality design, and team dynamics so users get consistent outcomes, governance, and measurable growth."
                  docHref="/docs/personara-ai-platform-proposition.docx"
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAccountMenuOpen(true)}
                    className="inline-flex items-center rounded-xl bg-[#142c4f] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#1b355f]"
                  >
                    Start Free
                  </button>
                  <Link
                    href="/pricing"
                    className="inline-flex items-center rounded-xl border border-[#c3d4ea] bg-white px-3.5 py-2 text-sm font-semibold text-[#1b355f] hover:bg-[#f4f8ff]"
                  >
                    View Pricing
                  </Link>
                </div>
              </div>
            </div>
          ) : null}

          {message ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{message}</p> : null}
          </section>
        ) : null}

        <section id="modules" className="mt-5 grid gap-4 md:grid-cols-3">
          {modules.map((module) => (
            <article key={module.key} className="flex h-full flex-col rounded-3xl border border-[#c9d8ef] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Module {module.order}</p>
              </div>
              <h2 className="mt-2 text-xl font-semibold text-[#142c4f]">{module.title}</h2>
              <p className="mt-1 text-sm font-medium text-[#334155]">{module.subtitle}</p>
              <p className="mt-2 grow text-sm leading-6 text-[#475569]">{module.detail}</p>
              <Link
                href={module.href}
                title={isSignedIn ? `Open ${module.title}` : `Open ${module.title} (you can sign in from the account panel)`}
                className={`mt-4 inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium ${
                  isSignedIn
                    ? "bg-[#142c4f] text-white hover:bg-[#1b355f]"
                    : "border border-neutral-300 bg-white text-[#334155] hover:bg-neutral-50"
                }`}
              >
                {module.cta}
              </Link>
            </article>
          ))}
        </section>

        <section className="mt-5 rounded-[2rem] border border-[#bfd2ed] bg-white p-4 shadow-sm">
          <div className="overflow-hidden rounded-2xl border border-[#bfd2ed] bg-[#f3f8ff]">
            <Image
              src="/images/personara-platform-anatomy.png"
              alt="The Anatomy of Personara.ai platform overview"
              width={1366}
              height={768}
              className="h-auto w-full"
              priority
            />
          </div>
        </section>

      </div>
    </main>
  )
}
