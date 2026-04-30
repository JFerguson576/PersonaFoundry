import { NextResponse } from "next/server"
import { createRouteClient } from "@/lib/supabase/route"
import { getRequestAuth } from "@/lib/supabase/auth"
import { logUsageEvent } from "@/lib/telemetry"

type UsageEventPayload = {
  module?: string
  event_type?: string
  route_path?: string
  full_url?: string | null
  browser_tz?: string | null
  locale?: string | null
  country_code?: string | null
  viewport_width?: number | null
  viewport_height?: number | null
  referrer?: string | null
  metadata?: Record<string, unknown>
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function asFiniteNumber(value: unknown) {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

export async function POST(request: Request) {
  const { user, accessToken } = await getRequestAuth(request)
  if (!user || !accessToken) {
    // Avoid noisy client errors for unauthenticated visitors.
    return NextResponse.json({ ok: true })
  }

  let payload: UsageEventPayload = {}
  try {
    payload = (await request.json()) as UsageEventPayload
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 })
  }

  const eventType = asText(payload.event_type) || "page_view"
  const routePath = asText(payload.route_path) || "/"
  const moduleKey = asText(payload.module) || "platform"
  const countryHeader = asText(request.headers.get("x-vercel-ip-country"))

  const metadata = {
    route_path: routePath,
    full_url: asText(payload.full_url) || null,
    browser_tz: asText(payload.browser_tz) || null,
    locale: asText(payload.locale) || null,
    country_code: asText(payload.country_code) || countryHeader || null,
    viewport_width: asFiniteNumber(payload.viewport_width),
    viewport_height: asFiniteNumber(payload.viewport_height),
    referrer: asText(payload.referrer) || null,
    ...(payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {}),
  }

  const supabase = createRouteClient(accessToken)
  await logUsageEvent(supabase, {
    userId: user.id,
    module: moduleKey,
    eventType,
    metadata,
  })

  return NextResponse.json({ ok: true })
}
