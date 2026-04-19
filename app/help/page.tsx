import Link from "next/link"
import { PlatformModuleNav } from "@/components/navigation/PlatformModuleNav"
import { WalkthroughStatusPanel } from "@/components/navigation/WalkthroughStatusPanel"
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

const tourLaunchByPath: Record<string, string> = {
  "/platform": "/platform",
  "/career": "/career?tour=1",
  "/persona-foundry": "/persona-foundry?tour=1",
  "/teamsync": "/teamsync?tour=1",
  "/community": "/community",
}

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-[#eef3fb] text-[#142c4f]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <PlatformModuleNav />
        <section className="rounded-3xl border border-[#c9d8ef] bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748b]">Help</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Guided Help Center</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#475569]">
            Guidance is available inside every module via the <span className="font-semibold">Guide me</span> button in the top navigation so users can get step-by-step help while they work.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {moduleItems.map((item) => (
              <article key={item.path} className="rounded-2xl border border-[#c9d8ef] bg-[#f5f9ff] p-4">
                <h2 className="text-base font-semibold">{item.context.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#475569]">{item.context.purpose}</p>
                <div className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Suggested flow</div>
                <ol className="mt-1 space-y-1 text-sm text-[#334155]">
                  {item.context.workflowSteps.slice(0, 3).map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <Link href={item.path} className="mt-3 inline-flex text-xs font-semibold text-[#2a63e5] hover:underline">
                  Open {item.context.title}
                </Link>
                {tourLaunchByPath[item.path] ? (
                  <Link href={tourLaunchByPath[item.path]} className="ml-3 mt-3 inline-flex text-xs font-semibold text-[#2a63e5] hover:underline">
                    Relaunch walkthrough
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
          <div className="mt-5">
            <Link href="/contact" className="inline-flex items-center rounded-xl border border-[#c3d4ea] bg-white px-4 py-2 text-sm font-semibold text-[#2f4a73] hover:bg-[#f4f8ff]">
              Go to Contact
            </Link>
          </div>
        </section>
        <WalkthroughStatusPanel />
      </div>
    </main>
  )
}
