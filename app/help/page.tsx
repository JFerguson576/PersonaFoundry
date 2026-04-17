import Link from "next/link"
import { PlatformModuleNav } from "@/components/navigation/PlatformModuleNav"

const helpItems = [
  {
    title: "Getting started",
    detail: "Begin at Tools, then open Career Intelligence, Persona Foundry, or TeamSync based on your priority.",
  },
  {
    title: "Account and sign in",
    detail: "Use the account panel to sign in once. Your session carries across all modules.",
  },
  {
    title: "Support and contact",
    detail: "For partnerships, enterprise, or technical help, use the Contact page.",
  },
] as const

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-[#f4f8fc] text-[#0f172a]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <PlatformModuleNav />
        <section className="rounded-3xl border border-[#d8e4f2] bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748b]">Help</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Support and guidance</h1>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {helpItems.map((item) => (
              <article key={item.title} className="rounded-2xl border border-[#d8e4f2] bg-[#f8fbff] p-4">
                <h2 className="text-base font-semibold">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#475569]">{item.detail}</p>
              </article>
            ))}
          </div>
          <div className="mt-5">
            <Link href="/contact" className="inline-flex items-center rounded-xl border border-[#d8e4f2] bg-white px-4 py-2 text-sm font-semibold text-[#334155] hover:bg-[#f8fbff]">
              Go to Contact
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
