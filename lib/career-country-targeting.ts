import { normalizeString } from "@/lib/career"

export type CareerTargetCountry = {
  code: string
  name: string
}

export const CAREER_TARGET_COUNTRIES: CareerTargetCountry[] = [
  { code: "NZ", name: "New Zealand" },
  { code: "AU", name: "Australia" },
  { code: "SG", name: "Singapore" },
  { code: "GB", name: "United Kingdom" },
  { code: "IE", name: "Ireland" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "DE", name: "Germany" },
  { code: "NL", name: "Netherlands" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "JP", name: "Japan" },
  { code: "IN", name: "India" },
  { code: "ZA", name: "South Africa" },
]

const CODE_SET = new Set(CAREER_TARGET_COUNTRIES.map((country) => country.code))
const NAME_BY_CODE = new Map(CAREER_TARGET_COUNTRIES.map((country) => [country.code, country.name]))
const COUNTRY_MARKER = "[target_countries:"

export function sanitizeCareerTargetCountries(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const unique: string[] = []

  for (const item of raw) {
    const code = normalizeString(item).toUpperCase()
    if (!code || !CODE_SET.has(code)) continue
    if (!unique.includes(code)) {
      unique.push(code)
    }
  }

  return unique
}

export function formatCareerTargetCountries(codes: string[]): string[] {
  return codes.map((code) => NAME_BY_CODE.get(code) || code)
}

export function appendTargetCountriesToMarketNotes(notes: string, countryCodes: string[]): string {
  const cleaned = stripTargetCountriesFromMarketNotes(notes)
  if (countryCodes.length === 0) return cleaned
  const marker = `${COUNTRY_MARKER} ${countryCodes.join(",")}]`
  return [cleaned, marker].filter(Boolean).join("\n\n")
}

export function stripTargetCountriesFromMarketNotes(notes: string): string {
  const raw = normalizeString(notes)
  if (!raw) return ""
  return raw
    .split("\n")
    .filter((line) => !line.trim().toLowerCase().startsWith(COUNTRY_MARKER))
    .join("\n")
    .trim()
}

export function extractTargetCountriesFromMarketNotes(notes: string): string[] {
  const raw = normalizeString(notes)
  if (!raw) return []

  const line = raw
    .split("\n")
    .map((entry) => entry.trim())
    .find((entry) => entry.toLowerCase().startsWith(COUNTRY_MARKER))

  if (!line) return []
  const match = line.match(/\[target_countries:\s*([A-Za-z,\s]+)\]/i)
  if (!match?.[1]) return []

  const candidateCodes = match[1]
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean)

  return sanitizeCareerTargetCountries(candidateCodes)
}
