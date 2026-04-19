"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState, type FormEvent } from "react"
import { supabase } from "@/lib/supabase"
import { getAuthHeaders } from "@/lib/career-client"
import { getAuthProviderLabel, type AuthProviderLabel } from "@/lib/auth-provider"
import { TesterNotesWidget } from "@/components/navigation/TesterNotesWidget"
import { ExperienceAgentWidget } from "@/components/navigation/ExperienceAgentWidget"

type NavItem = { key: string; label: string; href: string }

const navItems: NavItem[] = [
  { key: "tools", label: "Tools", href: "/platform#modules" },
  { key: "resources", label: "Resources", href: "/resources" },
  { key: "pricing", label: "Pricing", href: "/pricing" },
  { key: "community", label: "Community", href: "/community" },
  { key: "investors-partners", label: "Investors/Partners", href: "/investors-partners" },
  { key: "about", label: "About", href: "/about" },
  { key: "help", label: "Help Center", href: "/help" },
  { key: "contact", label: "Contact", href: "/contact" },
]

function isActive(pathname: string, href: string) {
  const baseHref = href.split("#")[0] || href
  if (baseHref === "/") return pathname === "/"
  return pathname === baseHref || pathname.startsWith(`${baseHref}/`)
}

export function PlatformModuleNav() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [roleBadge, setRoleBadge] = useState<"Superuser" | "Admin" | "Support" | null>(null)
  const [authProviderBadge, setAuthProviderBadge] = useState<AuthProviderLabel>(null)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [showReferralModal, setShowReferralModal] = useState(false)
  const [inviteeName, setInviteeName] = useState("")
  const [inviteeEmail, setInviteeEmail] = useState("")
  const [relationship, setRelationship] = useState("friend")
  const [note, setNote] = useState("")
  const [isSendingReferral, setIsSendingReferral] = useState(false)
  const [referralMessage, setReferralMessage] = useState("")
  const [referralTone, setReferralTone] = useState<"success" | "error" | "info">("info")
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false)
  const [showSuperuserQuickActions, setShowSuperuserQuickActions] = useState(true)
  const [showReturnMenu, setShowReturnMenu] = useState(false)

  const isModulePage = useMemo(() => {
    return pathname.startsWith("/career") || pathname.startsWith("/teamsync") || pathname.startsWith("/persona-foundry")
  }, [pathname])
  const isInternalWorkspace = useMemo(
    () =>
      pathname.startsWith("/admin") ||
      pathname.startsWith("/operations") ||
      pathname.startsWith("/control-center"),
    [pathname]
  )
  const showGlobalMarketingNav = !isInternalWorkspace && !isModulePage
  const showSectionReturnMenu = isSignedIn && (isModulePage || isInternalWorkspace)

  const superuserDockVisible = isSignedIn && roleBadge === "Superuser"

  useEffect(() => {
    if (typeof document === "undefined") return
    document.body.dataset.hideCommandButton = superuserDockVisible ? "1" : "0"
    return () => {
      delete document.body.dataset.hideCommandButton
    }
  }, [superuserDockVisible])

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8)
    }

    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    let mounted = true

    async function loadRoleBadge() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        if (mounted) setIsSignedIn(false)
        if (mounted) setRoleBadge(null)
        if (mounted) setAuthProviderBadge(null)
        return
      }
      if (mounted) setIsSignedIn(true)

      if (mounted) setAuthProviderBadge(getAuthProviderLabel(session.user))

      const response = await fetch("/api/auth/role", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const json = await response.json()
      if (!mounted) return

      const roles = Array.isArray(json.roles) ? json.roles : []
      if (roles.includes("superuser")) {
        setRoleBadge("Superuser")
      } else if (roles.includes("admin")) {
        setRoleBadge("Admin")
      } else if (roles.includes("support")) {
        setRoleBadge("Support")
      } else {
        setRoleBadge(null)
      }
    }

    void loadRoleBadge()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setIsSignedIn(Boolean(nextSession?.access_token))
      void loadRoleBadge()
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleReferralSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setReferralMessage("")

    if (!inviteeEmail.trim()) {
      setReferralTone("error")
      setReferralMessage("Please enter an email address.")
      return
    }

    setIsSendingReferral(true)
    try {
      const response = await fetch("/api/referrals", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invitee_name: inviteeName,
          invitee_email: inviteeEmail,
          relationship,
          note,
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to send referral")
      }

      setReferralTone(json.email_sent ? "success" : "info")
      setReferralMessage(json.email_sent ? "Invite sent." : "Invite saved. Email delivery is not configured yet.")
      setInviteeName("")
      setInviteeEmail("")
      setRelationship("friend")
      setNote("")
    } catch (error) {
      setReferralTone("error")
      setReferralMessage(error instanceof Error ? error.message : "Could not send referral")
    } finally {
      setIsSendingReferral(false)
    }
  }

  function buildReferralEmailDraft() {
    const recipient = inviteeEmail.trim()
    const appUrl = typeof window !== "undefined" ? window.location.origin : "https://www.personara.ai"
    const subject = encodeURIComponent("Invitation to Personara")
    const lines = [
      `Hi ${inviteeName.trim() || "there"},`,
      "",
      "I’d like to invite you to try Personara.",
      "",
      `You can start here: ${appUrl}/platform`,
      relationship ? `Relationship: ${relationship.replace("_", " ")}` : "",
      note.trim() ? `Personal note: ${note.trim()}` : "",
      "",
      "Regards,",
      "Sent via Personara refer-a-friend",
    ].filter(Boolean)
    const body = encodeURIComponent(lines.join("\n"))
    const href = `mailto:${encodeURIComponent(recipient)}?subject=${subject}&body=${body}`
    return { href, hasRecipient: Boolean(recipient) }
  }

  async function copyReferralLink() {
    const appUrl = typeof window !== "undefined" ? window.location.origin : "https://www.personara.ai"
    const link = `${appUrl}/platform`
    try {
      await navigator.clipboard.writeText(link)
      setReferralTone("success")
      setReferralMessage("Referral link copied.")
    } catch {
      setReferralTone("info")
      setReferralMessage(`Copy this link: ${link}`)
    }
  }

  async function handleSwitchAccount() {
    setIsSwitchingAccount(true)
    await supabase.auth.signOut()
    if (typeof window !== "undefined") {
      window.location.href = "/platform"
    }
  }

  return (
    <nav
      className={`sticky top-3 z-40 mb-4 rounded-2xl border border-[#d8e4f2] bg-white/95 px-4 py-3 backdrop-blur transition-shadow ${
        scrolled ? "shadow-md" : "shadow-sm"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[180px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">Personara</p>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[#0f172a]">Identity. Decisions. Intelligence.</p>
            {authProviderBadge ? (
              <span className="rounded-full border border-neutral-300 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                {authProviderBadge} login
              </span>
            ) : null}
            {isSignedIn ? (
              <button
                type="button"
                onClick={() => void handleSwitchAccount()}
                disabled={isSwitchingAccount}
                className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSwitchingAccount ? "Switching..." : "Switch account"}
              </button>
            ) : null}
            {roleBadge ? (
              <span className="rounded-full border border-[#c7d8ea] bg-[#edf5ff] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0a66c2]">
                {roleBadge}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showSectionReturnMenu ? (
            <>
              <div className="flex flex-col items-start gap-1">
                <Link
                  href="/platform#modules"
                  className="inline-flex items-center rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                  title="Return to main modules"
                >
                  Main menu
                </Link>
                <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-neutral-500">Need another area? Use Go to.</p>
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowReturnMenu((current) => !current)}
                  className="inline-flex items-center rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                  title="Jump to another section"
                >
                  Go to
                </button>
                {showReturnMenu ? (
                  <div className="absolute right-0 top-10 z-[75] w-56 rounded-xl border border-[#d8e4f2] bg-white p-2 shadow-lg">
                    {[
                      { label: "Platform hub", href: "/platform#modules" },
                      { label: "Career Intelligence", href: "/career-intelligence" },
                      { label: "Persona Foundry", href: "/persona-foundry" },
                      { label: "TeamSync", href: "/teamsync" },
                      { label: "Operations", href: "/operations" },
                      { label: "Control center", href: "/control-center" },
                    ].map((item) => (
                      <Link
                        key={`goto-${item.href}`}
                        href={item.href}
                        onClick={() => setShowReturnMenu(false)}
                        className="block rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
          {isSignedIn ? <ExperienceAgentWidget enabled /> : null}
          {isSignedIn ? <TesterNotesWidget enabled /> : null}
          {isSignedIn && isModulePage ? (
            <button
              type="button"
              onClick={() => {
                setReferralMessage("")
                setShowReferralModal(true)
              }}
              className="inline-flex items-center rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
              title="Refer a friend or business partner"
            >
              Refer
            </button>
          ) : null}
          {showGlobalMarketingNav
            ? navItems.map((item) => {
                const active = isActive(pathname, item.href)
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`inline-flex items-center rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? "border-[#0a66c2] bg-[#e8f3ff] text-[#0a66c2]"
                        : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })
            : null}
          {roleBadge && showGlobalMarketingNav ? (
            <Link
              href="/operations"
              className={`inline-flex items-center rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                isActive(pathname, "/operations")
                  ? "border-[#0a66c2] bg-[#e8f3ff] text-[#0a66c2]"
                  : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              Operations
            </Link>
          ) : null}
        </div>
      </div>
      {showReferralModal ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 px-4 py-6">
          <div className="w-full max-w-lg rounded-3xl border border-[#d8e4f2] bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[#0f172a]">Refer someone to Personara</h3>
                <p className="mt-1 text-sm text-neutral-600">Send a quick invite to a friend, colleague, or business partner.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowReferralModal(false)}
                className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                Close
              </button>
            </div>
            <form onSubmit={handleReferralSubmit} className="mt-4 space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">Name</label>
                  <input
                    value={inviteeName}
                    onChange={(event) => setInviteeName(event.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">Email</label>
                  <input
                    value={inviteeEmail}
                    onChange={(event) => setInviteeEmail(event.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                    placeholder="name@example.com"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">Relationship</label>
                <select
                  value={relationship}
                  onChange={(event) => setRelationship(event.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                >
                  <option value="friend">Friend</option>
                  <option value="business_partner">Business partner</option>
                  <option value="colleague">Colleague</option>
                  <option value="client">Client</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">Personal note</label>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="min-h-[80px] w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                  placeholder="Optional message"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="submit"
                  disabled={isSendingReferral}
                  className="rounded-xl border border-[#0a66c2] bg-[#0a66c2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#004182] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSendingReferral ? "Sending..." : "Send invite"}
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={buildReferralEmailDraft().hasRecipient ? buildReferralEmailDraft().href : undefined}
                    onClick={(event) => {
                      if (!buildReferralEmailDraft().hasRecipient) {
                        event.preventDefault()
                        setReferralTone("info")
                        setReferralMessage("Add an email address first, then open draft email.")
                      }
                    }}
                    className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    Open email draft
                  </a>
                  <button
                    type="button"
                    onClick={() => void copyReferralLink()}
                    className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    Copy link
                  </button>
                </div>
                {referralMessage ? (
                  <p
                    className={`text-sm ${
                      referralTone === "success"
                        ? "text-emerald-700"
                        : referralTone === "error"
                          ? "text-rose-700"
                          : "text-neutral-700"
                    }`}
                  >
                    {referralMessage}
                  </p>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {superuserDockVisible ? (
        <div className="fixed right-4 top-20 z-[65] w-[248px] max-w-[calc(100vw-2rem)]">
          <div className="rounded-2xl border border-[#d8e4f2] bg-white/95 p-3 shadow-lg backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Command + control</div>
              <button
                type="button"
                onClick={() => setShowSuperuserQuickActions((current) => !current)}
                className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                {showSuperuserQuickActions ? "Hide" : "Show"}
              </button>
            </div>
            {showSuperuserQuickActions ? (
              <div className="mt-2 grid gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("personara:open-command"))
                  }}
                  className="rounded-xl border border-[#0a66c2] bg-[#e8f3ff] px-3 py-2 text-left text-sm font-semibold text-[#0a66c2] hover:bg-[#dcecff]"
                >
                  Command + control
                </button>
                <Link href="/control-center" className="rounded-xl border border-[#0a66c2] bg-[#e8f3ff] px-3 py-2 text-sm font-semibold text-[#0a66c2] hover:bg-[#dcecff]">
                  Control center
                </Link>
                <Link href="/admin" className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100">
                  Admin dashboard
                </Link>
                <Link href="/operations" className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100">
                  Operations monitor
                </Link>
                <Link
                  href="/control-center/marketing-engine"
                  className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
                >
                  Marketing engine
                </Link>
                <Link href="/career?view=control" className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100">
                  Career control view
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </nav>
  )
}
