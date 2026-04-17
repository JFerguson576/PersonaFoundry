"use client"

type Props = {
  message: string
  tone?: "success" | "info" | "notice" | "progress" | "error"
  className?: string
}

export function CareerStatusBanner({ message, tone = "info", className = "" }: Props) {
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
              label: "Running",
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
