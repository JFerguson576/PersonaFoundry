export function getOAuthReturnErrorFromUrl() {
  if (typeof window === "undefined") return null

  const url = new URL(window.location.href)
  const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash)
  const queryParams = url.searchParams

  const errorDescription =
    hashParams.get("error_description") ||
    queryParams.get("error_description") ||
    hashParams.get("error") ||
    queryParams.get("error")

  if (!errorDescription) return null

  return decodeURIComponent(errorDescription.replaceAll("+", " "))
}

export function clearOAuthReturnParamsFromUrl() {
  if (typeof window === "undefined") return

  const url = new URL(window.location.href)
  const keys = ["error", "error_code", "error_description", "code"]

  for (const key of keys) {
    url.searchParams.delete(key)
  }

  const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash)
  for (const key of keys) {
    hashParams.delete(key)
  }

  const hashString = hashParams.toString()
  const next = `${url.pathname}${url.search}${hashString ? `#${hashString}` : ""}`
  window.history.replaceState({}, "", next)
}

