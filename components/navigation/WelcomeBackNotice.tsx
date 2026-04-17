"use client"

import { useEffect, useState } from "react"

const INACTIVITY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

type WelcomeBackNoticeProps = {
  userId?: string | null
  moduleLabel: string
}

export function WelcomeBackNotice({ userId, moduleLabel }: WelcomeBackNoticeProps) {
  const [dismissed, setDismissed] = useState(false)
  const [notice, setNotice] = useState({ show: false, lastSeenDateLabel: "" })

  useEffect(() => {
    if (!userId || typeof window === "undefined") return

    const now = Date.now()
    const storageKey = `personara-last-seen-global-${userId}`
    const previousRaw = window.localStorage.getItem(storageKey)
    const previous = previousRaw ? Number(previousRaw) : NaN
    const show = Number.isFinite(previous) && now - previous >= INACTIVITY_WINDOW_MS
    const lastSeenDateLabel = show ? new Date(previous).toLocaleDateString() : ""
    window.localStorage.setItem(storageKey, String(now))

    const timer = window.setTimeout(() => {
      setNotice({ show, lastSeenDateLabel })
      setDismissed(false)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [userId])

  if (!notice.show || dismissed) return null

  return (
    <div className="mb-3 rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-sky-900 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          Welcome back to {moduleLabel}. It has been over 2 weeks since your last visit
          {notice.lastSeenDateLabel ? ` (last seen ${notice.lastSeenDateLabel})` : ""}. Start with the highlighted “Do this next” action to continue quickly.
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-full border border-sky-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-800 hover:bg-sky-100"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
