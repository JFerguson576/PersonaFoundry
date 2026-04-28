import Image from "next/image"
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

const guideCards = [
  {
    title: "How to use Career Intelligence",
    description: "See how career inputs become profiles, applications, interview prep, and role execution.",
    imageSrc: "/images/module-guides/how-to-use-career-intelligence.png",
    href: "/career-intelligence?guide=1",
  },
  {
    title: "How to use Persona Foundry",
    description: "See how strengths, goals, and context become a custom AI personality profile.",
    imageSrc: "/images/module-guides/how-to-use-persona-foundry.png",
    href: "/persona-foundry?guide=1",
  },
  {
    title: "How to use TeamSync",
    description: "See how group strengths, scenarios, and outputs support better coordination.",
    imageSrc: "/images/module-guides/how-to-use-teamsync.png",
    href: "/teamsync?guide=1",
  },
]

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-6xl px-5 py-7">
        <PlatformModuleNav />
        <section className="rounded-2xl border border-[#c9d8ef] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748b]">Help</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">Agent Help Center</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#475569]">
            Support is available inside every module via the <span className="font-semibold">Ask Agent</span> button in the top navigation so users can get real-time, in-context help while they work.
          </p>
          <section className="mt-4 rounded-2xl border border-[#d8e4f2] bg-[#f7fbff] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Start with the visual guides</p>
                <h2 className="mt-1 text-lg font-semibold text-[#142c4f]">Before users enter a module</h2>
              </div>
              <Link href="/resources#module-guides" className="personara-explainer-chip">
                Open in Resources
              </Link>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {guideCards.map((guide) => (
                <Link
                  key={guide.href}
                  href={guide.href}
                  className="group overflow-hidden rounded-xl border border-[#c9d8ef] bg-white shadow-[0_10px_22px_-18px_rgba(15,30,70,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_30px_-24px_rgba(15,30,70,0.45)]"
                >
                  <Image src={guide.imageSrc} alt={guide.title} width={900} height={1200} className="h-36 w-full object-cover object-top" />
                  <div className="p-3">
                    <h3 className="text-sm font-semibold text-[#142c4f]">{guide.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-[#52627b]">{guide.description}</p>
                    <span className="mt-2 inline-flex text-xs font-semibold text-[#2a63e5] group-hover:underline">Open guide</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {moduleItems.map((item) => (
              <article key={item.path} className="rounded-xl border border-[#c9d8ef] bg-[#f7faff] p-3">
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
                    Start module tour
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
