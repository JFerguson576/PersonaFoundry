type LooseUser = {
  app_metadata?: Record<string, unknown> | null
  user_metadata?: Record<string, unknown> | null
  identities?: Array<{ provider?: string | null; identity_data?: Record<string, unknown> | null }> | null
}

export type LinkedInProfileSnapshot = {
  available: boolean
  fullName: string
  city: string
  headline: string
  profileUrl: string
  summaryText: string
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function firstNonEmpty(...values: unknown[]) {
  for (const value of values) {
    const next = asText(value)
    if (next) return next
  }
  return ""
}

function getProviderList(user: LooseUser) {
  const appMetadata = user.app_metadata ?? {}
  const fromAppMeta = Array.isArray((appMetadata as { providers?: unknown }).providers)
    ? ((appMetadata as { providers?: unknown[] }).providers ?? [])
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.toLowerCase())
    : []

  const fromIdentities = (user.identities ?? [])
    .map((identity) => asText(identity.provider).toLowerCase())
    .filter(Boolean)

  return [...new Set([...fromAppMeta, ...fromIdentities])]
}

function findLinkedInIdentity(user: LooseUser) {
  return (user.identities ?? []).find((identity) => {
    const provider = asText(identity.provider).toLowerCase()
    return provider === "linkedin" || provider === "linkedin_oidc"
  })
}

export function extractLinkedInProfile(user: LooseUser | null | undefined): LinkedInProfileSnapshot {
  if (!user) {
    return { available: false, fullName: "", city: "", headline: "", profileUrl: "", summaryText: "" }
  }

  const providers = getProviderList(user)
  const hasLinkedInProvider = providers.includes("linkedin") || providers.includes("linkedin_oidc")
  const linkedInIdentity = findLinkedInIdentity(user)
  const identityData = linkedInIdentity?.identity_data ?? {}
  const metadata = user.user_metadata ?? {}

  const fullName = firstNonEmpty(
    metadata.full_name,
    metadata.name,
    [asText(metadata.first_name), asText(metadata.last_name)].filter(Boolean).join(" "),
    identityData.full_name,
    identityData.name,
    [asText(identityData.given_name), asText(identityData.family_name)].filter(Boolean).join(" ")
  )
  const city = firstNonEmpty(
    metadata.city,
    metadata.location,
    identityData.location,
    identityData.locality,
    identityData.region
  )
  const headline = firstNonEmpty(
    metadata.headline,
    metadata.job_title,
    identityData.headline,
    identityData.occupation
  )
  const summary = firstNonEmpty(
    metadata.summary,
    metadata.bio,
    identityData.summary,
    identityData.bio
  )
  const profileUrl = firstNonEmpty(
    metadata.linkedin_url,
    metadata.profile_url,
    identityData.profile_url,
    identityData.public_profile_url,
    identityData.website
  )

  const available = hasLinkedInProvider || Boolean(fullName || headline || summary || profileUrl)
  const lines = [
    fullName ? `Name: ${fullName}` : "",
    headline ? `Headline: ${headline}` : "",
    city ? `Location: ${city}` : "",
    profileUrl ? `LinkedIn URL: ${profileUrl}` : "",
    summary ? `Summary: ${summary}` : "",
  ].filter(Boolean)

  return {
    available,
    fullName,
    city,
    headline,
    profileUrl,
    summaryText: lines.join("\n"),
  }
}
