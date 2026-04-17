import Link from "next/link"
import { PlatformModuleNav } from "@/components/navigation/PlatformModuleNav"

const plans = [
  {
    name: "Starter",
    audience: "Individuals testing Personara",
    price: "$0 / month",
    note: "or free trial entry point",
    detail: "Core workspace access with guided setup, foundational AI outputs, and basic exports.",
  },
  {
    name: "Professional",
    audience: "Career-focused operators",
    price: "$XX / month",
    note: "final price to be confirmed",
    detail: "Full Career Intelligence workflows, richer AI generation limits, and advanced workflow tools.",
  },
  {
    name: "Teams",
    audience: "Families, leadership teams, and organizations",
    price: "Custom pricing",
    note: "based on group size and use case",
    detail: "TeamSync dynamics analysis, shared workspaces, and deeper collaboration intelligence.",
  },
] as const

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#f4f8fc] text-[#0f172a]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <PlatformModuleNav />
        <section className="rounded-3xl border border-[#d8e4f2] bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748b]">Pricing</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Choose the right Personara plan</h1>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <article key={plan.name} className="rounded-2xl border border-[#d8e4f2] bg-[#f8fbff] p-4">
                <h2 className="text-base font-semibold">{plan.name}</h2>
                <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-[#64748b]">{plan.audience}</p>
                <p className="mt-2 text-xl font-semibold">{plan.price}</p>
                <p className="text-xs text-[#64748b]">{plan.note}</p>
                <p className="mt-2 text-sm leading-6 text-[#475569]">{plan.detail}</p>
              </article>
            ))}
          </div>
          <div className="mt-5">
            <Link href="/contact" className="inline-flex items-center rounded-xl bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e293b]">
              Contact sales
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
