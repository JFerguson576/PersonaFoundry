import Image from "next/image"
import Link from "next/link"
import { PlatformModuleNav } from "@/components/navigation/PlatformModuleNav"

const strengths = [
  "Connectedness",
  "Relator",
  "Learner",
  "Intellection",
  "Discipline",
  "Analytical",
  "Consistency",
  "Deliberative",
  "Developer",
  "Input",
]

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-6xl px-5 py-7">
        <PlatformModuleNav />

        <section className="rounded-2xl border border-[#c9d8ef] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748b]">About Personara</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-[#142c4f]">Identity. Decisions. Intelligence.</h1>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-[#475569]">
            Personara.ai began with a personal challenge: helping a new graduate find work that genuinely matched strengths, not just roles listed
            online. That journey grew into a platform built to turn human identity into practical outcomes.
          </p>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <article className="rounded-2xl border border-[#c9d8ef] bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Our story</p>
            <p className="mt-2 text-sm leading-7 text-[#475569]">
              Personara.ai did not begin as a technology project. It began as a family problem. When our son graduated, we faced the same loop many
              families face: more applications, more edits, more repetition, with very little genuine clarity.
            </p>
            <p className="mt-2 text-sm leading-7 text-[#475569]">
              We already had Gallup Strengths language, but we needed a way to turn it into action: better-fit role targeting, stronger positioning,
              sharper narratives, and practical momentum.
            </p>
            <p className="mt-2 text-sm leading-7 text-[#475569]">
              That became the foundational insight for Personara.ai: AI is far more useful when it starts with who a person naturally is, not just
              what they type into a prompt.
            </p>
            <div className="mt-4 rounded-xl border border-[#c9d8ef] bg-[#f7faff] p-4">
              <p className="text-base font-semibold text-[#17345b]">
                AI becomes far more useful when it is shaped around who a person naturally is.
              </p>
            </div>
          </article>

          <aside className="rounded-2xl border border-[#c9d8ef] bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Leadership profile</p>
            <div className="mt-3 overflow-hidden rounded-xl border border-[#cfdaea] bg-[#f8fbff]">
              <Image src="/images/roxy-ferguson-about.jpg" alt="Roxy Ferguson" width={900} height={900} className="h-52 w-full object-cover" />
            </div>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-[#142c4f]">Roxy Ferguson</h2>
            <p className="text-sm font-medium text-[#365b8f]">Communications and Outreach Lead</p>
            <p className="mt-2 text-sm leading-7 text-[#475569]">
              Roxy is the public face of Personara.ai, bringing thoughtful communication, trust, and practical guidance across customer journeys,
              leadership conversations, and outreach.
            </p>
            <p className="mt-2 text-sm leading-7 text-[#475569]">
              Her background includes education, coaching, team leadership, stakeholder coordination, and high-trust communication in complex
              environments.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {strengths.map((strength) => (
                <span
                  key={strength}
                  className="rounded-full border border-[#cdd8eb] bg-[#f8fbff] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4d6283]"
                >
                  {strength}
                </span>
              ))}
            </div>
          </aside>
        </section>

        <section className="mt-4 rounded-2xl border border-[#c9d8ef] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">How this becomes action</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <article className="rounded-xl border border-[#c9d8ef] bg-[#f7faff] p-3">
              <h3 className="text-sm font-semibold text-[#17345b]">Persona Foundry</h3>
              <p className="mt-2 text-sm leading-6 text-[#475569]">Builds an AI personality aligned with strengths, tone, and natural work style.</p>
            </article>
            <article className="rounded-xl border border-[#c9d8ef] bg-[#f7faff] p-3">
              <h3 className="text-sm font-semibold text-[#17345b]">Career Intelligence</h3>
              <p className="mt-2 text-sm leading-6 text-[#475569]">
                Converts strengths into role strategy, profile assets, interview readiness, and market execution.
              </p>
            </article>
            <article className="rounded-xl border border-[#c9d8ef] bg-[#f7faff] p-3">
              <h3 className="text-sm font-semibold text-[#17345b]">TeamSync</h3>
              <p className="mt-2 text-sm leading-6 text-[#475569]">
                Models team communication, pressure response, and decision dynamics for stronger alignment.
              </p>
            </article>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/persona-foundry" className="personara-explainer-chip">
              Explore Persona Foundry
            </Link>
            <Link href="/career-intelligence" className="personara-explainer-chip">
              Explore Career Intelligence
            </Link>
            <Link href="/teamsync" className="personara-explainer-chip">
              Explore TeamSync
            </Link>
            <a href="/docs/personara-codex-about-pack-roxy-ferguson.docx" download className="personara-explainer-chip">
              Download full About pack
            </a>
          </div>
        </section>
      </div>
    </main>
  )
}
