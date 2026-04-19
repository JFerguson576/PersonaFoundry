"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { resolveHelpModule } from "@/lib/help-context"

type SectionHint = {
  id: string
  label: string
}

function normalizeLabel(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

export function ContextualHelpDrawer() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const moduleContext = useMemo(() => resolveHelpModule(pathname), [pathname])

  const sections = useMemo(() => {
    if (!open || typeof window === "undefined") return [] as SectionHint[]
    const discovered: SectionHint[] = []
    const seen = new Set<string>()
    const candidates = document.querySelectorAll<HTMLElement>("section[id], [data-help-section]")

    candidates.forEach((node) => {
      const id = node.id || node.getAttribute("data-help-section") || ""
      if (!id || seen.has(id)) return

      const titleNode =
        node.querySelector("h1, h2, h3, [data-help-title]") ||
        node.querySelector("p, div")
      const label = normalizeLabel((titleNode?.textContent || id).slice(0, 80))
      if (!label) return

      seen.add(id)
      discovered.push({ id, label })
    })
    return discovered.slice(0, 10)
  }, [open])

  useEffect(() => {
    if (!open) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center rounded-xl border border-[#0a66c2]/40 bg-[#e8f3ff] px-3 py-1.5 text-xs font-semibold text-[#0a66c2] transition hover:bg-[#dcecff]"
        title={open ? "Close Step Coach" : "Open Step Coach"}
      >
        {open ? "Close Step Coach" : "Step Coach"}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[120] overflow-y-auto bg-black/35 px-2 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-4 sm:pb-6 sm:pt-20"
          onClick={() => setOpen(false)}
        >
          <div className="flex min-h-full items-start justify-end">
            <div
              className="max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-[#d8e4f2] bg-white p-5 shadow-2xl sm:max-h-[calc(100dvh-6rem)]"
              onClick={(event) => event.stopPropagation()}
            >
            <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-3 flex items-start justify-between gap-3 border-b border-[#e2e8f0] bg-white px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">
                  Step Coach
                </p>
                <h3 className="mt-1 text-lg font-semibold text-[#0f172a]">{moduleContext.title}</h3>
                <p className="mt-1 text-sm leading-6 text-[#475569]">{moduleContext.purpose}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                Close
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-[#d8e4f2] bg-[#f8fbff] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">What to do next</p>
              <ol className="mt-2 space-y-1 text-sm text-[#334155]">
                {moduleContext.workflowSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>

            <div className="mt-3 rounded-2xl border border-[#d8e4f2] bg-white p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">What to prepare</p>
              <ul className="mt-2 space-y-1 text-sm text-[#334155]">
                {moduleContext.prepChecklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            {sections.length > 0 ? (
              <div className="mt-3 rounded-2xl border border-[#d8e4f2] bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">On this page</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => {
                        const target = document.getElementById(section.id)
                        if (target) {
                          target.scrollIntoView({ behavior: "smooth", block: "start" })
                        }
                        setOpen(false)
                      }}
                      className="rounded-full border border-[#d8e4f2] bg-[#f8fbff] px-3 py-1 text-xs font-semibold text-[#425a74] hover:bg-[#eef5ff]"
                    >
                      {section.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex items-center justify-between gap-2">
              <Link href="/help" className="text-xs font-semibold text-[#0a66c2] hover:underline">
                Open full Help center
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                Close
              </button>
            </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
