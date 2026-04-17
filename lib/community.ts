export type CommunityPostType = "idea" | "success_story"

export function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function toNullableText(value: unknown) {
  const normalized = normalizeText(value)
  return normalized.length > 0 ? normalized : null
}

export function normalizeCommunityType(value: unknown): CommunityPostType {
  return value === "success_story" ? "success_story" : "idea"
}

export function getAuthorName(params: { metadata?: Record<string, unknown> | null; email?: string | null }) {
  const metadata = params.metadata ?? {}
  const explicitName = typeof metadata.full_name === "string"
    ? metadata.full_name
    : typeof metadata.name === "string"
      ? metadata.name
      : null

  if (explicitName && explicitName.trim().length > 0) {
    return explicitName.trim()
  }

  if (params.email && params.email.includes("@")) {
    return params.email.split("@")[0]
  }

  return "Community member"
}
