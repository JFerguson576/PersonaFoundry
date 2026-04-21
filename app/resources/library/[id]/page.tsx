import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { PlatformModuleNav } from "@/components/navigation/PlatformModuleNav"
import { findResourceById, formatResourceType, resourceSections } from "@/lib/resource-hub"

function safeSitePath(href: string) {
  return href.startsWith("/") ? href : "/resources"
}

export default async function ResourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const resource = findResourceById(id)
  if (!resource) notFound()

  const section = resourceSections.find((item) => item.key === resource.sectionKey)
  const fileHref = safeSitePath(resource.href)
  const previewHref = resource.thumbnailHref ? safeSitePath(resource.thumbnailHref) : fileHref

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-5xl px-5 py-7">
        <PlatformModuleNav />

        <section className="rounded-2xl border border-[#c9d8ef] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
                {section?.label || "Resource"} - {formatResourceType(resource.type)}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#142c4f]">{resource.title}</h1>
              <p className="mt-2 text-sm text-[#475569]">{resource.description}</p>
            </div>
            <div className="flex gap-2">
              <Link href="/resources" className="personara-explainer-chip">
                Back to hub
              </Link>
              <a href={fileHref} download className="personara-explainer-chip">
                Download file
              </a>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-[#c9d8ef] bg-white p-4 shadow-sm">
          {resource.type === "image" ? (
            <div className="overflow-hidden rounded-xl border border-[#c9d8ef]">
              <Image src={fileHref} alt={resource.title} width={1600} height={1000} className="h-auto w-full" />
            </div>
          ) : resource.type === "pdf" ? (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-xl border border-[#c9d8ef]">
                <Image src={previewHref} alt={`${resource.title} preview`} width={1600} height={1000} className="h-auto w-full" />
              </div>
              <iframe
                src={fileHref}
                title={resource.title}
                className="h-[66vh] w-full rounded-xl border border-[#c9d8ef] bg-white"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-xl border border-[#c9d8ef]">
                <Image src={previewHref} alt={`${resource.title} preview`} width={1600} height={1000} className="h-auto w-full" />
              </div>
              <div className="rounded-xl border border-[#d7e3f4] bg-[#f8fbff] p-6 text-sm text-[#42597f]">
                <p className="font-semibold text-[#1d355d]">This document is available as a downloadable Word file.</p>
                <p className="mt-2">Use the download button above to open it in Word, Pages, or Google Docs.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
