"use client"

import { navigateCareerWorkspace } from "@/lib/career-client"

type Props = {
  message: string
  tone?: "success" | "info" | "notice" | "progress" | "error"
  className?: string
}

export function CareerStatusBanner({ message, tone = "info", className = "" }: Props) {
  const isProgress = tone === "progress"
  const toneMeta =
    tone === "success"
      ? {
          className: "border-emerald-200 bg-emerald-50 text-emerald-950",
          label: "Saved",
        }
      : tone === "notice"
        ? {
            className: "border-violet-200 bg-violet-50 text-violet-950",
            label: "Prefilled",
          }
        : tone === "progress"
          ? {
              className: "border-amber-200 bg-amber-50 text-amber-950",
              label: "Processing",
            }
          : tone === "error"
            ? {
                className: "border-rose-200 bg-rose-50 text-rose-950",
                label: "Needs attention",
              }
            : {
                className: "border-sky-200 bg-sky-50 text-sky-950",
                label: "Info",
              }

  if (isProgress) {
    const processingStages = ["Queued", "Generating", "Saving"]
    const waitingActions = [
      { label: "Review saved outputs", sectionKey: "documents", href: "#saved-library" },
      { label: "Check target role", sectionKey: "documents", href: "#document-workbench" },
      { label: "Add more context", sectionKey: "source", href: "#source-material" },
    ]

    return (
      <div
        role="status"
        aria-live="polite"
        className={`rounded-2xl border px-4 py-3 text-sm leading-6 shadow-sm ${toneMeta.className} ${className}`.trim()}
      >
        <div className="flex flex-wrap items-start gap-3">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-current/15 bg-white/80" aria-hidden>
            <span className="absolute h-9 w-9 animate-spin rounded-full border-2 border-current/15 border-t-current" />
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-current/80" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-current/80">
                {toneMeta.label}
              </span>
              <span className="text-xs font-medium text-current/75">Background task in progress</span>
            </div>
            <div className="mt-2">{message}</div>
            <div className="mt-3 grid gap-1.5 sm:grid-cols-3">
              {processingStages.map((stage, index) => (
                <div key={stage} className="flex items-center gap-2 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-current/75">
                  <span
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-current/65"
                    style={{ animationDelay: `${index * 180}ms` }}
                    aria-hidden
                  />
                  {stage}
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-current/10 bg-white/70 p-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-current/70">Useful while you wait</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {waitingActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => navigateCareerWorkspace(action.sectionKey, action.href)}
                    className="rounded-full border border-current/15 bg-white px-2.5 py-1 text-[11px] font-semibold text-current/80 transition hover:bg-current/5"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 text-xs text-current/75">This can take up to a minute. Results save automatically, so you do not need to stay on this exact card.</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm leading-6 shadow-sm ${toneMeta.className} ${className}`.trim()}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-current/80">
          {toneMeta.label}
        </span>
      </div>
      <div className="mt-2">{message}</div>
    </div>
  )
}
