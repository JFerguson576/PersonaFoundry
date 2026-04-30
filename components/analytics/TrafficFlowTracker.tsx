"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"

const TRACKER_THROTTLE_MS = 60_000

function inferModuleFromPath(pathname: string) {
  if (pathname.startsWith("/career") || pathname.startsWith("/career-intelligence")) return "career_intelligence"
  if (pathname.startsWith("/teamsync")) return "teamsync"
  if (pathname.startsWith("/persona-foundry")) return "persona_foundry"
  if (pathname.startsWith("/operations") || pathname.startsWith("/control-center") || pathname.startsWith("/admin")) return "operations"
  return "platform"
}

export function TrafficFlowTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!pathname) return
    const query = searchParams?.toString()
    const routePath = query ? `${pathname}?${query}` : pathname
    const hash = typeof window !== "undefined" ? window.location.hash || "" : ""
    const routeWithHash = `${routePath}${hash}`

    const cacheKey = `personara-flow-track:${routeWithHash}`
    const now = Date.now()

    try {
      const previousTs = Number(window.sessionStorage.getItem(cacheKey) || "0")
      if (Number.isFinite(previousTs) && previousTs > 0 && now - previousTs < TRACKER_THROTTLE_MS) {
        return
      }
      window.sessionStorage.setItem(cacheKey, String(now))
    } catch {
      // If storage is unavailable, continue without throttle persistence.
    }

    const payload = {
      module: inferModuleFromPath(pathname),
      event_type: "page_view",
      route_path: routeWithHash,
      full_url: typeof window !== "undefined" ? window.location.href : null,
      browser_tz: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : null,
      locale: typeof navigator !== "undefined" ? navigator.language : null,
      viewport_width: typeof window !== "undefined" ? window.innerWidth : null,
      viewport_height: typeof window !== "undefined" ? window.innerHeight : null,
      referrer: typeof document !== "undefined" ? document.referrer : null,
    }

    const send = () =>
      fetch("/api/usage/event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => undefined)

    void send()
  }, [pathname, searchParams])

  return null
}
