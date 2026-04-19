"use client"

import Link from "next/link"
import { useId, useState } from "react"

type ModuleExplainerPanelProps = {
  buttonLabel: string
  title: string
  summary: string
  docHref: string
}

export function ModuleExplainerPanel({ buttonLabel, title, summary, docHref }: ModuleExplainerPanelProps) {
  const [open, setOpen] = useState(false)
  const dialogId = useId()

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center rounded-full border border-[#cfe0f3] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#425a74] hover:bg-[#f8fbff]"
      >
        {buttonLabel}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#0f172a]/35 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogId}
        >
          <div className="w-full max-w-xl rounded-2xl border border-[#d8e4f2] bg-white p-4 shadow-xl sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 id={dialogId} className="text-base font-semibold text-[#0f172a]">
                {title}
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Close
              </button>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#334155]">{summary}</p>
            <Link
              href={docHref}
              className="personara-explainer-chip mt-3"
            >
              Read full brief (.docx)
            </Link>
          </div>
        </div>
      ) : null}
    </>
  )
}
