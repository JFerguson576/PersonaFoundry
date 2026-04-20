import Image from "next/image"
import Link from "next/link"
import { PlatformModuleNav } from "@/components/navigation/PlatformModuleNav"
import { formatResourceType, resourceItems, resourceSections } from "@/lib/resource-hub"

function safeSitePath(href: string) {
  return href.startsWith("/") ? href : "/resources"
}

function sectionTone(sectionKey: string) {
  if (sectionKey === "career") return "border-[#cae3ff] bg-[#f4f9ff]"
  if (sectionKey === "persona") return "border-[#d7e7ff] bg-[#f7f9ff]"
  return "border-[#cfe8dd] bg-[#f4fbf8]"
}

function ResourceTile({
  id,
  title,
  description,
  href,
  type,
}: {
  id: string
  title: string
  description: string
  href: string
  type: "doc" | "pdf" | "image"
}) {
  const fileHref = safeSitePath(href)

  return (
    <article className="rounded-xl border border-[#d7e3f4] bg-white p-3 shadow-[0_10px_22px_-18px_rgba(15,30,70,0.35)]">
      <div className="relative overflow-hidden rounded-lg border border-[#d5e2f6] bg-[linear-gradient(145deg,#f8fbff_0%,#eef4ff_100%)]">
        {type === "image" ? (
          <Image src={fileHref} alt={title} width={1200} height={760} className="h-28 w-full object-cover" />
        ) : (
          <div className="flex h-28 items-center justify-center text-xs font-semibold uppercase tracking-[0.14em] text-[#55709a]">
            {formatResourceType(type)} preview
          </div>
        )}
      </div>
      <div className="mt-2.5 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#142c4f]">{title}</h3>
          <p className="mt-1 text-xs text-[#52627b]">{description}</p>
        </div>
        <span className="rounded-full border border-[#cfdbef] bg-[#f7fbff] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5f7397]">
          {formatResourceType(type)}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/resources/library/${id}`} className="personara-explainer-chip">
          View page
        </Link>
        <a href={fileHref} download className="personara-explainer-chip">
          Download
        </a>
      </div>
    </article>
  )
}

export default function ResourcesPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-6xl px-5 py-7">
        <PlatformModuleNav />

        <section className="rounded-3xl border border-[#bfd2ed] bg-[linear-gradient(130deg,#ffffff_0%,#edf4ff_64%,#f0f6ff_100%)] px-5 py-5 shadow-[0_14px_30px_-26px_rgba(26,54,93,0.5)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5b6b7c]">Resources Hub</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-[#142c4f]">Guides, explainers, decks, and visuals</h1>
          <p className="mt-2 max-w-3xl text-sm text-[#475569]">
            Every asset is available as a readable resource page and as a direct download from Personara paths.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {resourceSections.map((section) => (
              <a key={section.key} href={`#${section.key}`} className="personara-explainer-chip">
                {section.label}
              </a>
            ))}
            <a href="#visual-library" className="personara-explainer-chip">
              Visual library
            </a>
          </div>
        </section>

        <section className="mt-4 space-y-4">
          {resourceSections.map((section) => (
            <article key={section.key} id={section.key} className={`rounded-2xl border p-4 shadow-sm ${sectionTone(section.key)}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">{section.label}</p>
                  <p className="mt-1 text-sm text-[#475569]">{section.summary}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={section.workspaceHref} className="personara-explainer-chip">
                    Open workspace
                  </Link>
                  {section.tourHref ? (
                    <Link href={section.tourHref} className="personara-explainer-chip">
                      Start tour
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {resourceItems
                  .filter((item) => item.sectionKey === section.key)
                  .map((resource) => (
                    <ResourceTile key={resource.id} {...resource} />
                  ))}
              </div>
            </article>
          ))}
        </section>

        <section id="visual-library" className="mt-4 rounded-2xl border border-[#c9d8ef] bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Visual library</p>
          <h2 className="mt-1 text-xl font-semibold text-[#142c4f]">Architecture and ecosystem visuals</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {resourceItems
              .filter((item) => item.sectionKey === "visual")
              .map((visual) => (
                <ResourceTile key={visual.id} {...visual} />
              ))}
          </div>
        </section>
      </div>
    </main>
  )
}
