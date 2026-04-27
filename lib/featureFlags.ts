export const featureFlags = {
  personaFoundry: true,
  careerIntelligence: true,
  teamSync: true,
  marketingEngine: false,
  practitionerPortal: false,
  investorPortal: false,
  codexDiagnostics: true,
} as const

export type FeatureFlag = keyof typeof featureFlags

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return featureFlags[flag] === true
}
