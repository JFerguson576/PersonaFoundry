"use client"

import { useEffect, useMemo, useState } from "react"

type ModuleIntroGuideProps = {
  moduleKey: "persona-foundry" | "career-intelligence" | "teamsync"
  title: string
  subtitle: string
  imageSrc: string
  startLabel: string
  accent?: "blue" | "teal"
}

const GUIDE_STORAGE_PREFIX = "personara-module-intro-dismissed:"

export function ModuleIntroGuide({
  moduleKey,
  title,
  subtitle,
  imageSrc,
  startLabel,
  accent = "blue",
}: ModuleIntroGuideProps) {
  const [mounted, setMounted] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const storageKey = `${GUIDE_STORAGE_PREFIX}${moduleKey}`
  const tone = useMemo(
    () =>
      accent === "teal"
        ? {
            badge: "border-teal-200 bg-teal-50 text-teal-800",
            button: "border-teal-700 bg-teal-700 text-white hover:bg-teal-800",
            ring: "border-teal-200",
          }
        : {
            badge: "border-blue-200 bg-blue-50 text-blue-800",
            button: "border-blue-700 bg-blue-700 text-white hover:bg-blue-800",
            ring: "border-blue-200",
          },
    [accent]
  )

  useEffect(() => {
    setMounted(true)
    try {
      const forceGuide = new URLSearchParams(window.location.search).get("guide") === "1"
      const dismissed = window.localStorage.getItem(storageKey) === "true"
      setIsOpen(forceGuide || !dismissed)
    } catch {
      setIsOpen(true)
    }
  }, [storageKey])

  function closeGuide() {
    try {
      window.localStorage.setItem(storageKey, "true")
    } catch {}
    setIsOpen(false)
  }

  if (!mounted || !isOpen) return null

  return (
    <div className="fixed inset-0 z-[90] overflow-hidden bg-[#07162b]/75 px-3 py-4 backdrop-blur-sm sm:px-5 sm:py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="mx-auto flex h-[calc(100dvh-2rem)] max-w-5xl items-center"
      >
        <section className={`relative flex h-full max-h-full w-full flex-col overflow-hidden rounded-3xl border ${tone.ring} bg-white shadow-2xl`}>
          <div className="absolute left-4 top-3 z-10">
            <div className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] shadow-sm ${tone.badge}`}>
              Start here
            </div>
          </div>
          <div className="absolute right-4 top-3 z-10">
            <button
              type="button"
              onClick={closeGuide}
              className="rounded-full border border-slate-300 bg-white/95 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-700 shadow-sm hover:bg-white"
            >
              Skip
            </button>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-50 px-3 py-3 sm:px-5">
            <img
              src={imageSrc}
              alt={title}
              className="block h-full max-h-full w-auto max-w-full rounded-2xl border border-slate-200 bg-white object-contain shadow-sm"
            />
          </div>

          <div className="absolute bottom-4 right-4 z-10">
            <button
              type="button"
              onClick={closeGuide}
              className={`rounded-full border px-4 py-2 text-sm font-semibold shadow-lg ${tone.button}`}
            >
              {startLabel}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
