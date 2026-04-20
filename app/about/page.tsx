import { PlatformModuleNav } from "@/components/navigation/PlatformModuleNav"

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-6xl px-5 py-7">
        <PlatformModuleNav />
        <section className="rounded-2xl border border-[#c9d8ef] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748b]">About Personara</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">Identity. Decisions. Intelligence.</h1>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-[#475569]">
            Most AI tools treat people as interchangeable. Personara exists to build intelligence that starts with who people actually are, then
            turns that identity into practical outcomes across career, AI behavior, and team coordination.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <article className="rounded-xl border border-[#c9d8ef] bg-[#f7faff] p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Persona Foundry</div>
              <p className="mt-2 text-sm leading-6 text-[#334155]">
                Builds an AI personality aligned to a user&apos;s Gallup strengths and working style.
              </p>
              <p className="mt-2 text-xs text-[#475569]">Primary value: AI feels natural, trusted, and productive from day one.</p>
            </article>
            <article className="rounded-xl border border-[#c9d8ef] bg-[#f7faff] p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Career Intelligence</div>
              <p className="mt-2 text-sm leading-6 text-[#334155]">
                Translates strengths into positioning, career documents, interview guidance, and live job execution.
              </p>
              <p className="mt-2 text-xs text-[#475569]">Primary value: clearer decisions, stronger market traction, and better outcomes.</p>
            </article>
            <article className="rounded-xl border border-[#c9d8ef] bg-[#f7faff] p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">TeamSync</div>
              <p className="mt-2 text-sm leading-6 text-[#334155]">
                Applies strengths intelligence to teams, families, and groups to improve communication and coordination.
              </p>
              <p className="mt-2 text-xs text-[#475569]">Primary value: less friction, faster alignment, and better shared decisions.</p>
            </article>
          </div>
          <div className="mt-4 rounded-xl border border-[#c9d8ef] bg-[#f7faff] p-3">
            <h2 className="text-lg font-semibold tracking-tight text-[#142c4f]">Our mission</h2>
            <p className="mt-2 text-sm leading-7 text-[#475569]">
              Build a strengths-based intelligence platform where identity becomes infrastructure for growth. Personara helps people and groups
              use AI in a way that is more human, more aligned, and more effective.
            </p>
          </div>
          <div className="mt-4 rounded-xl border border-[#c9d8ef] bg-white p-3">
            <h2 className="text-lg font-semibold tracking-tight text-[#142c4f]">Where this is headed</h2>
            <p className="mt-2 text-sm leading-7 text-[#475569]">
              We are building the layer between human potential and human performance. As users move across life and work moments, Personara
              compounds understanding with every interaction, so intelligence becomes more personal, more precise, and more useful over time.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
