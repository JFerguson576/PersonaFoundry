import { notFound } from "next/navigation"
import { getAdminCapabilities } from "@/lib/admin"
import { featureFlags, isFeatureEnabled } from "@/lib/featureFlags"
import { createClient as createServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

function envStatus(value: string | undefined, configuredLabel = "Present") {
  return value ? configuredLabel : "Missing"
}

function formatFlagName(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase())
}

function AccessRequired() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <section className="rounded-lg border p-6 shadow-sm">
        <p className="text-sm uppercase tracking-wide text-gray-500">Admin diagnostics</p>
        <h1 className="mt-2 text-3xl font-semibold">Codex Diagnostics</h1>
        <p className="mt-3 text-gray-600">
          Sign in with an admin account to view project health checks.
        </p>
      </section>
    </main>
  )
}

export default async function CodexDiagnosticsPage() {
  if (!isFeatureEnabled("codexDiagnostics")) {
    notFound()
  }

  const hasSupabaseClientConfig = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )

  if (!hasSupabaseClientConfig) {
    return <AccessRequired />
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const capabilities = await getAdminCapabilities({
    userId: user?.id ?? null,
    email: user?.email ?? null,
  })

  if (!capabilities.isAdmin) {
    return <AccessRequired />
  }

  const envChecks = [
    {
      name: "NEXT_PUBLIC_SUPABASE_URL",
      value: envStatus(process.env.NEXT_PUBLIC_SUPABASE_URL),
    },
    {
      name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      value: envStatus(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    },
    {
      name: "SUPABASE_SERVICE_ROLE_KEY",
      value: envStatus(process.env.SUPABASE_SERVICE_ROLE_KEY, "Present, server-side"),
    },
    {
      name: "OPENAI_API_KEY",
      value: envStatus(process.env.OPENAI_API_KEY, "Present, server-side"),
    },
    {
      name: "ADMIN_EMAILS",
      value: envStatus(process.env.ADMIN_EMAILS, "Configured"),
    },
    {
      name: "SUPERUSER_EMAILS",
      value: envStatus(process.env.SUPERUSER_EMAILS, "Configured"),
    },
  ]

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <section className="rounded-lg border p-6 shadow-sm">
        <p className="text-sm uppercase tracking-wide text-gray-500">
          Admin Diagnostics
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Codex Diagnostics</h1>
        <p className="mt-3 text-gray-600">
          Lightweight project health panel for Codex-assisted development.
          Secrets are never displayed; this page only reports presence.
        </p>
      </section>

      <section className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Feature Flags</h2>
          <div className="mt-4 space-y-3">
            {Object.entries(featureFlags).map(([key, enabled]) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3"
              >
                <span className="font-medium">{formatFlagName(key)}</span>
                <span>{enabled ? "Enabled" : "Disabled"}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Environment Checks</h2>
          <div className="mt-4 space-y-3">
            {envChecks.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 px-4 py-3"
              >
                <span className="font-medium">{item.name}</span>
                <span className="text-right">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-lg border p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Codex Operating Notes</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-gray-700">
          <li>Read CODEX.md before making changes.</li>
          <li>Use /docs/codex as project memory.</li>
          <li>Prefer small, modular changes.</li>
          <li>Run build checks after edits.</li>
        </ul>
      </section>
    </main>
  )
}
