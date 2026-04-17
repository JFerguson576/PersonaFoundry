import { NextResponse } from "next/server"
import { createAdminClient, getAdminCapabilities } from "@/lib/admin"
import { getRequestAuth } from "@/lib/supabase/auth"

type IntegrationHealth = {
  key: string
  label: string
  status: "connected" | "partial" | "not_configured"
  detail: string
}

function hasEnv(...keys: string[]) {
  return keys.some((key) => {
    const value = process.env[key]
    return typeof value === "string" && value.trim().length > 0
  })
}

export async function GET(request: Request) {
  const { user, errorMessage } = await getRequestAuth(request)
  if (!user) {
    return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
  }

  const capabilities = await getAdminCapabilities({ userId: user.id, email: user.email })
  if (!capabilities.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 })
  }

  const supabaseConnected =
    hasEnv("NEXT_PUBLIC_SUPABASE_URL") &&
    hasEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") &&
    hasEnv("SUPABASE_SERVICE_ROLE_KEY")

  const stripeConnected = hasEnv("STRIPE_SECRET_KEY")
  const posthogConnected = hasEnv("NEXT_PUBLIC_POSTHOG_KEY", "POSTHOG_API_KEY")
  const resendConnected = hasEnv("RESEND_API_KEY")
  const googleAdsConnected = hasEnv("GOOGLE_ADS_DEVELOPER_TOKEN")
  const metaConnected = hasEnv("FACEBOOK_APP_ID", "FACEBOOK_CLIENT_ID")
  const linkedinConnected = hasEnv("LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET")

  const integrations: IntegrationHealth[] = [
    {
      key: "supabase",
      label: "Supabase",
      status: supabaseConnected ? "connected" : "partial",
      detail: supabaseConnected ? "Core DB/auth and admin service key are configured." : "Missing one or more Supabase keys.",
    },
    {
      key: "stripe",
      label: "Stripe",
      status: stripeConnected ? "connected" : "not_configured",
      detail: stripeConnected ? "Billing event sync can be enabled." : "Add STRIPE_SECRET_KEY for billing events.",
    },
    {
      key: "posthog",
      label: "PostHog",
      status: posthogConnected ? "connected" : "not_configured",
      detail: posthogConnected ? "Event telemetry is configured." : "Add PostHog key for analytics signals.",
    },
    {
      key: "resend",
      label: "Resend",
      status: resendConnected ? "connected" : "not_configured",
      detail: resendConnected ? "Operational email alerts are enabled." : "Add RESEND_API_KEY for alert emails.",
    },
    {
      key: "google_ads",
      label: "Google Ads",
      status: googleAdsConnected ? "connected" : "not_configured",
      detail: googleAdsConnected ? "Ready for reporting adapter setup." : "Configure developer token later (optional).",
    },
    {
      key: "meta",
      label: "Meta",
      status: metaConnected ? "partial" : "not_configured",
      detail: metaConnected ? "Login credentials exist; marketing adapter still pending." : "Configure Facebook app credentials later.",
    },
    {
      key: "linkedin",
      label: "LinkedIn",
      status: linkedinConnected ? "partial" : "not_configured",
      detail: linkedinConnected ? "Credentials present; marketing API setup still pending." : "Configure LinkedIn app credentials later.",
    },
  ]

  return NextResponse.json({
    checked_at: new Date().toISOString(),
    integrations,
  })
}

