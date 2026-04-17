import type { User } from "@supabase/supabase-js"

export type AuthProviderLabel = "Google" | "LinkedIn" | "Facebook" | "Email" | null

export function getAuthProviderLabel(user: User | null | undefined): AuthProviderLabel {
  if (!user) return null

  const appMetadata = (user.app_metadata ?? {}) as { providers?: unknown[]; provider?: unknown }
  const providersFromAppMeta = Array.isArray(appMetadata.providers)
    ? appMetadata.providers.filter((value): value is string => typeof value === "string").map((value) => value.toLowerCase())
    : []
  const identityProviders = (user.identities ?? [])
    .map((identity) => (typeof identity.provider === "string" ? identity.provider.toLowerCase() : ""))
    .filter(Boolean)
  const providerSet = new Set<string>([
    ...providersFromAppMeta,
    ...identityProviders,
    typeof appMetadata.provider === "string" ? appMetadata.provider.toLowerCase() : "",
  ])

  if (providerSet.has("linkedin") || providerSet.has("linkedin_oidc")) return "LinkedIn"
  if (providerSet.has("google")) return "Google"
  if (providerSet.has("facebook")) return "Facebook"
  if (providerSet.has("email") || providerSet.has("magiclink")) return "Email"
  return "Email"
}
