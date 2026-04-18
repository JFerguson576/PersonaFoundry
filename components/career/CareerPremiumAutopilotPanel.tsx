"use client"

import { useCallback, useEffect, useState } from "react"
import { getAuthHeaders, notifyCareerWorkspaceRefresh } from "@/lib/career-client"

type Props = {
  candidateId: string
  suggestedTargetRole?: string
  defaultLocation?: string
}

type PremiumAutopilotSettings = {
  id: string | null
  is_enabled: boolean
  schedule_weekday: number
  schedule_hour: number
  schedule_timezone: string
  target_role: string
  location: string
  market_notes: string
  company_name: string
  job_title: string
  job_description: string
  dossier_influence: string
  role_match_tightness: number
  auto_research_from_matches: boolean
  auto_generate_cover_letters: boolean
  last_run_at: string | null
  next_run_at: string | null
}

type PremiumAutopilotReviewItem = {
  id: string
  trigger_source: string | null
  target_role: string | null
  company_name: string | null
  job_title: string | null
  location: string | null
  job_url: string | null
  live_search_asset_id: string | null
  company_dossier_asset_id: string | null
  cover_letter_asset_id: string | null
  status: "pending" | "approved" | "rejected"
  review_notes: string | null
  created_at: string | null
  reviewed_at: string | null
}

const weekdayOptions = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
]

function defaultSettings(suggestedTargetRole?: string, defaultLocation?: string): PremiumAutopilotSettings {
  return {
    id: null,
    is_enabled: false,
    schedule_weekday: 1,
    schedule_hour: 9,
    schedule_timezone: "UTC",
    target_role: suggestedTargetRole || "",
    location: defaultLocation || "",
    market_notes: "",
    company_name: "",
    job_title: "",
    job_description: "",
    dossier_influence: "medium",
    role_match_tightness: 60,
    auto_research_from_matches: true,
    auto_generate_cover_letters: true,
    last_run_at: null,
    next_run_at: null,
  }
}

function asInputString(value: string | null | undefined) {
  return typeof value === "string" ? value : ""
}

export function CareerPremiumAutopilotPanel({ candidateId, suggestedTargetRole = "", defaultLocation = "" }: Props) {
  const [settings, setSettings] = useState<PremiumAutopilotSettings>(defaultSettings(suggestedTargetRole, defaultLocation))
  const [loading, setLoading] = useState(false)
  const [queueLoading, setQueueLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [queueItems, setQueueItems] = useState<PremiumAutopilotReviewItem[]>([])
  const [actingQueueId, setActingQueueId] = useState("")
  const [message, setMessage] = useState("")
  const [messageTone, setMessageTone] = useState<"info" | "success" | "error">("info")

  const loadQueue = useCallback(async () => {
    setQueueLoading(true)
    try {
      const response = await fetch(`/api/career/premium-autopilot-review/${candidateId}`, {
        headers: await getAuthHeaders(),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Could not load review queue.")
      }
      setQueueItems((json.queue ?? []) as PremiumAutopilotReviewItem[])
    } catch (error) {
      setMessageTone("error")
      setMessage(error instanceof Error ? error.message : "Could not load review queue.")
    } finally {
      setQueueLoading(false)
    }
  }, [candidateId])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const response = await fetch(`/api/career/premium-autopilot/${candidateId}`, {
          headers: await getAuthHeaders(),
        })
        const json = await response.json()
        if (!response.ok) {
          throw new Error(json.error || "Could not load premium autopilot settings.")
        }
        const next = json.settings as PremiumAutopilotSettings
        setSettings({
          ...defaultSettings(suggestedTargetRole, defaultLocation),
          ...next,
          target_role: asInputString(next.target_role) || suggestedTargetRole || "",
          location: asInputString(next.location) || defaultLocation || "",
          market_notes: asInputString(next.market_notes),
          company_name: asInputString(next.company_name),
          job_title: asInputString(next.job_title),
          job_description: asInputString(next.job_description),
          dossier_influence: asInputString(next.dossier_influence) || "medium",
          role_match_tightness: Number.isFinite(Number(next.role_match_tightness)) ? Math.max(0, Math.min(100, Number(next.role_match_tightness))) : 60,
        })
      } catch (error) {
        setMessageTone("error")
        setMessage(error instanceof Error ? error.message : "Could not load premium autopilot settings.")
      } finally {
        setLoading(false)
      }
    }

    void load()
    void loadQueue()
  }, [candidateId, defaultLocation, loadQueue, suggestedTargetRole])

  async function saveSettings() {
    setSaving(true)
    setMessage("")
    try {
      const response = await fetch(`/api/career/premium-autopilot/${candidateId}`, {
        method: "PUT",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Could not save premium autopilot settings.")
      }
      setSettings(json.settings as PremiumAutopilotSettings)
      setMessageTone("success")
      setMessage("Premium autopilot settings saved.")
    } catch (error) {
      setMessageTone("error")
      setMessage(error instanceof Error ? error.message : "Could not save premium autopilot settings.")
    } finally {
      setSaving(false)
    }
  }

  async function runNow() {
    setRunning(true)
    setMessage("")
    try {
      const response = await fetch(`/api/career/premium-autopilot/${candidateId}`, {
        method: "POST",
        headers: await getAuthHeaders(),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Could not start premium autopilot run.")
      }
      setMessageTone("success")
      setMessage("Premium autopilot started in the background. You can keep working while it runs.")
      notifyCareerWorkspaceRefresh()
      void loadQueue()
    } catch (error) {
      setMessageTone("error")
      setMessage(error instanceof Error ? error.message : "Could not start premium autopilot run.")
    } finally {
      setRunning(false)
    }
  }

  async function reviewQueueItem(item: PremiumAutopilotReviewItem, action: "approve" | "reject") {
    setActingQueueId(item.id)
    setMessage("")
    try {
      const response = await fetch(`/api/career/premium-autopilot-review/${candidateId}`, {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          queue_id: item.id,
          action,
          review_notes:
            action === "approve"
              ? "Approved for application workflow."
              : "Rejected from review queue.",
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Could not update review queue.")
      }
      setMessageTone("success")
      setMessage(action === "approve" ? "Review item approved and added to applications." : "Review item rejected.")
      await loadQueue()
      notifyCareerWorkspaceRefresh()
    } catch (error) {
      setMessageTone("error")
      setMessage(error instanceof Error ? error.message : "Could not update review queue.")
    } finally {
      setActingQueueId("")
    }
  }

  return (
    <section id="premium-autopilot" className="rounded-3xl border border-[#d8e4f2] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748b]">Premium feature</div>
          <h3 className="mt-2 text-xl font-semibold">Weekly autopilot applications</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
            Set a weekly schedule so Candidate can run live job search, company research, and draft-ready cover letters automatically.
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Status</div>
          <div className="mt-1 text-sm font-semibold">{settings.is_enabled ? "Autopilot enabled" : "Autopilot disabled"}</div>
        </div>
      </div>

      {message ? (
        <div
          className={`mt-4 rounded-2xl border px-3 py-2 text-sm ${
            messageTone === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : messageTone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-sky-200 bg-sky-50 text-sky-700"
          }`}
        >
          {message}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
          Target role
          <input
            value={asInputString(settings.target_role)}
            onChange={(event) => setSettings((current) => ({ ...current, target_role: event.target.value }))}
            className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-normal normal-case text-neutral-900"
            placeholder="Senior Data Analyst"
            disabled={loading}
          />
        </label>
        <label className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
          Location
          <input
            value={asInputString(settings.location)}
            onChange={(event) => setSettings((current) => ({ ...current, location: event.target.value }))}
            className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-normal normal-case text-neutral-900"
            placeholder="Auckland / Remote"
            disabled={loading}
          />
        </label>
        <label className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
          Market notes
          <input
            value={asInputString(settings.market_notes)}
            onChange={(event) => setSettings((current) => ({ ...current, market_notes: event.target.value }))}
            className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-normal normal-case text-neutral-900"
            placeholder="ANZ fintech, analytics leadership"
            disabled={loading}
          />
        </label>
        <label className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
          Company (optional)
          <input
            value={asInputString(settings.company_name)}
            onChange={(event) => setSettings((current) => ({ ...current, company_name: event.target.value }))}
            className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-normal normal-case text-neutral-900"
            placeholder="Target employer for auto-dossier"
            disabled={loading}
          />
        </label>
        <label className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
          Job title (optional)
          <input
            value={asInputString(settings.job_title)}
            onChange={(event) => setSettings((current) => ({ ...current, job_title: event.target.value }))}
            className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-normal normal-case text-neutral-900"
            placeholder="Role title for auto-cover-letter"
            disabled={loading}
          />
        </label>
        <label className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
          Dossier influence
          <select
            value={asInputString(settings.dossier_influence)}
            onChange={(event) => setSettings((current) => ({ ...current, dossier_influence: event.target.value }))}
            className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-normal normal-case text-neutral-900"
            disabled={loading}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <label className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
          Automation choices
          <div className="mt-2 space-y-2 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-normal normal-case text-neutral-900">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={settings.auto_research_from_matches}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    auto_research_from_matches: event.target.checked,
                  }))
                }
                className="mt-0.5 h-4 w-4 rounded border-neutral-300"
                disabled={loading}
              />
              <span>Auto-research company dossier from top matched role</span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={settings.auto_generate_cover_letters}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    auto_generate_cover_letters: event.target.checked,
                  }))
                }
                className="mt-0.5 h-4 w-4 rounded border-neutral-300"
                disabled={loading}
              />
              <span>Auto-generate tailored cover letters from profile + dossier</span>
            </label>
          </div>
        </label>
        <label className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
          Role match strictness
          <div className="mt-2">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={settings.role_match_tightness}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  role_match_tightness: Math.max(0, Math.min(100, Number(event.target.value || 60))),
                }))
              }
              className="w-full accent-[#0a66c2]"
              disabled={loading}
            />
            <div className="mt-1 flex items-center justify-between text-[11px] font-semibold normal-case tracking-normal text-neutral-600">
              <span>Loose (adjacent/stretch roles)</span>
              <span>{settings.role_match_tightness}%</span>
              <span>Tight (close role match)</span>
            </div>
          </div>
        </label>
      </div>

      <label className="mt-3 block rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
        Job description (optional, needed for auto-cover-letter quality)
        <textarea
          rows={4}
          value={asInputString(settings.job_description)}
          onChange={(event) => setSettings((current) => ({ ...current, job_description: event.target.value }))}
          className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-normal normal-case text-neutral-900"
          placeholder="Paste target role description to let autopilot draft stronger cover letters."
          disabled={loading}
        />
      </label>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <label className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
          Weekday
          <select
            value={String(settings.schedule_weekday)}
            onChange={(event) => setSettings((current) => ({ ...current, schedule_weekday: Number(event.target.value) }))}
            className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-normal normal-case text-neutral-900"
            disabled={loading}
          >
            {weekdayOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
          Hour (24h)
          <input
            type="number"
            min={0}
            max={23}
            value={settings.schedule_hour}
            onChange={(event) => setSettings((current) => ({ ...current, schedule_hour: Number(event.target.value || 0) }))}
            className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-normal normal-case text-neutral-900"
            disabled={loading}
          />
        </label>
        <label className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
          Timezone
          <input
            value={settings.schedule_timezone}
            onChange={(event) => setSettings((current) => ({ ...current, schedule_timezone: event.target.value }))}
            className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-normal normal-case text-neutral-900"
            placeholder="Pacific/Auckland"
            disabled={loading}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d8e4f2] bg-[#f8fbff] px-4 py-3">
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-800">
          <input
            type="checkbox"
            checked={settings.is_enabled}
            onChange={(event) => setSettings((current) => ({ ...current, is_enabled: event.target.checked }))}
            className="h-4 w-4 rounded border-neutral-300"
            disabled={loading}
          />
          Enable weekly premium autopilot
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void saveSettings()}
            disabled={saving || loading}
            className="rounded-xl border border-[#0a66c2] bg-[#0a66c2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0958a8] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save settings"}
          </button>
          <button
            type="button"
            onClick={() => void runNow()}
            disabled={running || loading}
            className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {running ? "Starting..." : "Run now"}
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
          Last run: {settings.last_run_at ? new Date(settings.last_run_at).toLocaleString() : "No runs yet"}
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
          Next scheduled run: {settings.next_run_at ? new Date(settings.next_run_at).toLocaleString() : "Will be activated in scheduler phase"}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-[#d8e4f2] bg-[#f8fbff] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Review queue</div>
            <div className="mt-1 text-sm text-neutral-700">Approve or reject autopilot batches before applying.</div>
          </div>
          <button
            type="button"
            onClick={() => void loadQueue()}
            disabled={queueLoading}
            className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
          >
            {queueLoading ? "Refreshing..." : "Refresh queue"}
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {queueItems.length === 0 ? (
            <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600">
              No review items yet. Run autopilot and new batches will appear here.
            </div>
          ) : (
            queueItems.map((item) => (
              <div key={item.id} className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-neutral-900">
                    {item.job_title || item.target_role || "Autopilot role batch"}
                    {item.company_name ? ` | ${item.company_name}` : ""}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                      item.status === "pending"
                        ? "bg-amber-100 text-amber-800"
                        : item.status === "approved"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <div className="mt-1 text-xs text-neutral-600">
                  {item.location || "Location not set"} | {item.created_at ? new Date(item.created_at).toLocaleString() : "Unknown time"}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.job_url ? (
                    <a
                      href={item.job_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50"
                    >
                      Open job link
                    </a>
                  ) : null}
                  {item.status === "pending" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void reviewQueueItem(item, "approve")}
                        disabled={actingQueueId === item.id}
                        className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                      >
                        {actingQueueId === item.id ? "Saving..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void reviewQueueItem(item, "reject")}
                        disabled={actingQueueId === item.id}
                        className="rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-60"
                      >
                        {actingQueueId === item.id ? "Saving..." : "Reject"}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
