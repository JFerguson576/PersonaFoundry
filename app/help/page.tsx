import Link from "next/link"
import { PlatformModuleNav } from "@/components/navigation/PlatformModuleNav"
import { resolveHelpModule } from "@/lib/help-context"

const modulePaths = [
  "/platform",
  "/career",
  "/persona-foundry",
  "/teamsync",
  "/community",
] as const

const moduleItems = modulePaths.map((path) => ({
  path,
  context: resolveHelpModule(path),
}))

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-[#f4f8fc] text-[#0f172a]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <PlatformModuleNav />
        <section className="rounded-3xl border border-[#d8e4f2] bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748b]">Help</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Step Coach Help Center</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#475569]">
            Guidance is available inside every module via the <span className="font-semibold">Step Coach</span> button in the top navigation so users can get step-by-step help while they work.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {moduleItems.map((item) => (
              <article key={item.path} className="rounded-2xl border border-[#d8e4f2] bg-[#f8fbff] p-4">
                <h2 className="text-base font-semibold">{item.context.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#475569]">{item.context.purpose}</p>
                <div className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Suggested flow</div>
                <ol className="mt-1 space-y-1 text-sm text-[#334155]">
                  {item.context.workflowSteps.slice(0, 3).map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <Link href={item.path} className="mt-3 inline-flex text-xs font-semibold text-[#0a66c2] hover:underline">
                  Open {item.context.title}
                </Link>
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
