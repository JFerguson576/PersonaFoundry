# Feature Flags

## Purpose

Feature flags let Personara.ai add internal or unfinished features without exposing them everywhere by default.

## File

```txt
lib/featureFlags.ts
```

## Current Flags

```ts
export const featureFlags = {
  personaFoundry: true,
  careerIntelligence: true,
  teamSync: true,
  marketingEngine: false,
  practitionerPortal: false,
  investorPortal: false,
  codexDiagnostics: true,
} as const
```

Use the helper:

```ts
import { isFeatureEnabled } from "@/lib/featureFlags"

if (!isFeatureEnabled("codexDiagnostics")) {
  return null
}
```

## Rules

- New experimental modules should be behind a flag.
- Do not remove flags without checking usage.
- Avoid hardcoding unfinished features into public navigation.
- Server/admin diagnostics must still perform auth checks; a feature flag is not an access-control mechanism.
