export type AuthProviderKey = "google" | "facebook" | "linkedin_oidc"

export type AuthProviderStatus = {
  key: AuthProviderKey
  label: string
  enabled: boolean
  reason?: string
}

function envEnabled(value: string | undefined, fallback: boolean) {
  if (typeof value !== "string") return fallback
  const normalized = value.trim().toLowerCase()
  if (["1", "true", "yes", "on"].includes(normalized)) return true
  if (["0", "false", "no", "off"].includes(normalized)) return false
  return fallback
}

export function getAuthProviderStatusesFromEnv() {
  const googleEnabled = envEnabled(process.env.NEXT_PUBLIC_AUTH_PROVIDER_GOOGLE_ENABLED, true)
  const facebookEnabled = envEnabled(process.env.NEXT_PUBLIC_AUTH_PROVIDER_FACEBOOK_ENABLED, false)
  const linkedInEnabled = envEnabled(process.env.NEXT_PUBLIC_AUTH_PROVIDER_LINKEDIN_ENABLED, false)

  return [
    {
      key: "google" as const,
      label: "Google",
      enabled: googleEnabled,
      reason: googleEnabled ? undefined : "Disabled by environment flag",
    },
    {
      key: "facebook" as const,
      label: "Facebook",
      enabled: facebookEnabled,
      reason: facebookEnabled ? undefined : "Enable in Supabase Providers and set NEXT_PUBLIC_AUTH_PROVIDER_FACEBOOK_ENABLED=true",
    },
    {
      key: "linkedin_oidc" as const,
      label: "LinkedIn",
      enabled: linkedInEnabled,
      reason: linkedInEnabled ? undefined : "Enable in Supabase Providers and set NEXT_PUBLIC_AUTH_PROVIDER_LINKEDIN_ENABLED=true",
    },
  ] satisfies AuthProviderStatus[]
}
