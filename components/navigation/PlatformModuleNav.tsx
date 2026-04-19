"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { supabase } from "@/lib/supabase"
import { getAuthHeaders } from "@/lib/career-client"
import { getAuthProviderLabel, type AuthProviderLabel } from "@/lib/auth-provider"
import { TesterNotesWidget } from "@/components/navigation/TesterNotesWidget"
import { ExperienceAgentWidget } from "@/components/navigation/ExperienceAgentWidget"

type NavChild = { label: string; href: string; detail?: string; badge?: string }
type NavItem = { key: string; label: string; href: string; items?: NavChild[] }

const navItems: NavItem[] = [
  {
    key: "tools",
    label: "Tools",
    href: "/platform#modules",
    items: [
      { label: "Career Intelligence", href: "/career-intelligence", detail: "Career strategy and execution" },
      { label: "Persona Foundry", href: "/persona-foundry", detail: "Custom AI personality studio" },
      { label: "TeamSync", href: "/teamsync", detail: "Team and executive simulations" },
      { label: "Module overview", href: "/platform#modules", detail: "Compare all modules", badge: "Platform" },
    ],
  },
  {
    key: "resources",
    label: "Resources",
    href: "/resources",
    items: [
      { label: "Resource hub", href: "/resources", detail: "Guides, decks, and explainers" },
      { label: "Help center", href: "/help", detail: "How to use each module" },
      { label: "Community", href: "/community", detail: "Ideas and success stories" },
      { label: "Pricing", href: "/pricing", detail: "Plans and tiers", badge: "Plans" },
    ],
  },
  { key: "pricing", label: "Pricing", href: "/pricing" },
  {
    key: "about",
    label: "About",
    href: "/about",
    items: [
      { label: "Mission and story", href: "/about", detail: "Why Personara exists" },
      { label: "Investors/Partners", href: "/investors-partners", detail: "Partner opportunities" },
      { label: "Contact", href: "/contact", detail: "Talk to the team" },
    ],
  },
  { key: "investors-partners", label: "Investors/Partners", href: "/investors-partners" },
  { key: "community", label: "Community", href: "/community" },
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
  const [showReturnMenu, setShowReturnMenu] = useState(false)
  const [openDropdownKey, setOpenDropdownKey] = useState<string | null>(null)
  const dropdownWrapRef = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    setOpenDropdownKey(null)
    setShowReturnMenu(false)
  }, [pathname])

  useEffect(() => {
    function closeMenus(event: MouseEvent) {
      if (dropdownWrapRef.current && !dropdownWrapRef.current.contains(event.target as Node)) {
        setOpenDropdownKey(null)
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenDropdownKey(null)
        setShowReturnMenu(false)
      }
    }

    window.addEventListener("mousedown", closeMenus)
    window.addEventListener("keydown", closeOnEscape)
    return () => {
      window.removeEventListener("mousedown", closeMenus)
      window.removeEventListener("keydown", closeOnEscape)
    }
  }, [])

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
      className={`sticky top-3 z-40 mb-4 rounded-2xl border border-[var(--border-soft)] bg-[color:var(--surface)]/95 px-4 py-3 backdrop-blur transition-shadow ${
        scrolled ? "shadow-[0_14px_34px_-22px_rgba(15,30,70,0.45)]" : "shadow-[0_8px_20px_-18px_rgba(15,30,70,0.35)]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[180px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5b6d8f]">Personara</p>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--brand-navy)]">Identity. Decisions. Intelligence.</p>
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
              <span className="rounded-full border border-[#c9dafb] bg-[#edf3ff] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--brand-blue-deep)]">
                {roleBadge}
              </span>
            ) : null}
          </div>
        </div>
        <div ref={dropdownWrapRef} className="flex flex-wrap items-center gap-2">
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
                      { label: "Operations Hub", href: "/operations" },
                      { label: "Operations Summary", href: "/control-center" },
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
                const hasMenu = Boolean(item.items?.length)
                const menuOpen = openDropdownKey === item.key

                if (!hasMenu) {
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      className={`inline-flex items-center rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? "border-[#8fb0f5] bg-[#edf3ff] text-[var(--brand-blue-deep)]"
                          : "border-[#c9d4e8] bg-white text-[#243a63] hover:bg-[#f4f7ff]"
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                }

                return (
                  <div
                    key={item.key}
                    className="relative"
                    onMouseEnter={() => setOpenDropdownKey(item.key)}
                    onMouseLeave={() => setOpenDropdownKey((current) => (current === item.key ? null : current))}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenDropdownKey((current) => (current === item.key ? null : item.key))}
                      className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                        active || menuOpen
                          ? "border-[#8fb0f5] bg-[#edf3ff] text-[var(--brand-blue-deep)]"
                          : "border-[#c9d4e8] bg-white text-[#243a63] hover:bg-[#f4f7ff]"
                      }`}
                      aria-expanded={menuOpen}
                      aria-haspopup="menu"
                    >
                      {item.label}
                      <span className={`text-[10px] transition-transform ${menuOpen ? "rotate-180" : ""}`}>▼</span>
                    </button>
                    {menuOpen ? (
                      <div className="nav-dropdown-enter absolute left-0 top-10 z-[80] w-[320px] rounded-2xl border border-[#cfdbf3] bg-white p-2.5 shadow-[0_24px_44px_-30px_rgba(15,30,70,0.45)]">
                        <div className="mb-1.5 rounded-xl border border-[#dde8fb] bg-[#f6f9ff] px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5f7294]">{item.label}</p>
                          <p className="mt-0.5 text-[11px] text-[#556788]">Quick paths to high-value pages.</p>
                        </div>
                        {item.items?.map((menuItem) => (
                          <Link
                            key={`${item.key}-${menuItem.href}`}
                            href={menuItem.href}
                            onClick={() => setOpenDropdownKey(null)}
                            className="block rounded-xl border border-transparent px-3 py-2 transition hover:border-[#d6e2f7] hover:bg-[#f5f8ff]"
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="block text-sm font-semibold text-[var(--brand-navy)]">{menuItem.label}</span>
                              {menuItem.badge ? (
                                <span className="rounded-full border border-[#d1ddf3] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5e7398]">
                                  {menuItem.badge}
                                </span>
                              ) : null}
                            </span>
                            {menuItem.detail ? (
                              <span className="mt-0.5 block text-[11px] font-medium text-[#5f7294]">{menuItem.detail}</span>
                            ) : null}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
              })
            : null}
          {roleBadge && showGlobalMarketingNav ? (
            <Link
              href="/operations"
              className={`inline-flex items-center rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                isActive(pathname, "/operations")
                  ? "border-[#8fb0f5] bg-[#edf3ff] text-[var(--brand-blue-deep)]"
                  : "border-[#c9d4e8] bg-white text-[#243a63] hover:bg-[#f4f7ff]"
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
    </nav>
  )
}
