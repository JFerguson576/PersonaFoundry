import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { PlatformModuleNav } from "@/components/navigation/PlatformModuleNav"
import { findResourceById, formatResourceType, resourceSections } from "@/lib/resource-hub"

function safeSitePath(href: string) {
  return href.startsWith("/") ? href : "/resources"
}

type MarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }

function normalizeMdText(text: string) {
  return text.replaceAll(/\*\*/g, "").replaceAll(/`/g, "").trim()
}

function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.split(/\r?\n/)
  const blocks: MarkdownBlock[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index].trim()
    if (!line) {
      index += 1
      continue
    }

    if (line.startsWith("### ")) {
      blocks.push({ type: "heading", level: 3, text: normalizeMdText(line.slice(4)) })
      index += 1
      continue
    }

    if (line.startsWith("## ")) {
      blocks.push({ type: "heading", level: 2, text: normalizeMdText(line.slice(3)) })
      index += 1
      continue
    }

    if (line.startsWith("# ")) {
      blocks.push({ type: "heading", level: 1, text: normalizeMdText(line.slice(2)) })
      index += 1
      continue
    }

    if (line.startsWith("- ")) {
      const items: string[] = []
      while (index < lines.length && lines[index].trim().startsWith("- ")) {
        items.push(normalizeMdText(lines[index].trim().slice(2)))
        index += 1
      }
      blocks.push({ type: "list", items })
      continue
    }

    const current = lines[index].trim()
    const next = lines[index + 1]?.trim() || ""
    if (current.startsWith("|") && next.startsWith("|") && next.includes("---")) {
      const headers = current
        .split("|")
        .map((cell) => normalizeMdText(cell))
        .filter(Boolean)

      index += 2
      const rows: string[][] = []
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        const row = lines[index]
          .trim()
          .split("|")
          .map((cell) => normalizeMdText(cell))
          .filter(Boolean)
        if (row.length > 0) rows.push(row)
        index += 1
      }
      blocks.push({ type: "table", headers, rows })
      continue
    }

    const paragraphLines: string[] = []
    while (index < lines.length) {
      const candidate = lines[index].trim()
      if (!candidate) break
      if (candidate.startsWith("#") || candidate.startsWith("- ")) break
      if (candidate.startsWith("|") && (lines[index + 1]?.trim() || "").startsWith("|")) break
      paragraphLines.push(candidate)
      index += 1
    }

    if (paragraphLines.length > 0) {
      blocks.push({ type: "paragraph", text: normalizeMdText(paragraphLines.join(" ")) })
    } else {
      index += 1
    }
  }

  return blocks
}

function renderMarkdownBlocks(blocks: MarkdownBlock[]) {
  return blocks.map((block, blockIndex) => {
    if (block.type === "heading") {
      if (block.level === 1) {
        return (
          <h2 key={`md-h1-${blockIndex}`} className="text-xl font-semibold text-[#142c4f]">
            {block.text}
          </h2>
        )
      }
      if (block.level === 2) {
        return (
          <h3 key={`md-h2-${blockIndex}`} className="text-lg font-semibold text-[#193861]">
            {block.text}
          </h3>
        )
      }
      return (
        <h4 key={`md-h3-${blockIndex}`} className="text-base font-semibold text-[#244972]">
          {block.text}
        </h4>
      )
    }

    if (block.type === "list") {
      return (
        <ul key={`md-list-${blockIndex}`} className="space-y-1 text-sm text-[#374f73]">
          {block.items.map((item, itemIndex) => (
            <li key={`md-list-item-${blockIndex}-${itemIndex}`} className="flex gap-2">
              <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-[#2e5f9e]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )
    }

    if (block.type === "table") {
      return (
        <div key={`md-table-${blockIndex}`} className="overflow-x-auto rounded-xl border border-[#d2deef]">
          <table className="min-w-full divide-y divide-[#d7e3f4] text-left text-sm">
            <thead className="bg-[#f4f8ff]">
              <tr>
                {block.headers.map((header, headerIndex) => (
                  <th key={`md-th-${blockIndex}-${headerIndex}`} className="px-3 py-2 font-semibold text-[#21456f]">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf3fb] bg-white">
              {block.rows.map((row, rowIndex) => (
                <tr key={`md-row-${blockIndex}-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`md-cell-${blockIndex}-${rowIndex}-${cellIndex}`} className="px-3 py-2 text-[#415a7d]">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    return (
      <p key={`md-p-${blockIndex}`} className="text-sm text-[#415b7d]">
        {block.text}
      </p>
    )
  })
}

export default async function ResourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const resource = findResourceById(id)
  if (!resource) notFound()

  const section = resourceSections.find((item) => item.key === resource.sectionKey)
  const fileHref = safeSitePath(resource.href)
  const previewHref = resource.thumbnailHref ? safeSitePath(resource.thumbnailHref) : fileHref
  let markdownBlocks: MarkdownBlock[] = []

  if (resource.type === "md") {
    const localDocsPath = path.join(process.cwd(), "public", resource.href.replace(/^\//, ""))
    try {
      const markdown = await readFile(localDocsPath, "utf8")
      markdownBlocks = parseMarkdownBlocks(markdown)
    } catch {
      markdownBlocks = [{ type: "paragraph", text: "Could not load this markdown resource file." }]
    }
  }

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
          ) : resource.type === "md" ? (
            <div className="space-y-3 rounded-xl border border-[#d7e3f4] bg-[#f8fbff] p-5">
              {renderMarkdownBlocks(markdownBlocks)}
            </div>
          ) : resource.type === "xlsx" ? (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-xl border border-[#c9d8ef]">
                <Image src={previewHref} alt={`${resource.title} preview`} width={1600} height={1000} className="h-auto w-full" />
              </div>
              <div className="rounded-xl border border-[#d7e3f4] bg-[#f8fbff] p-6 text-sm text-[#42597f]">
                <p className="font-semibold text-[#1d355d]">This spreadsheet opens best in Excel, Google Sheets, or Numbers.</p>
                <p className="mt-2">Use the download button above to open and edit this matrix.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {resource.thumbnailHref ? (
                <div className="overflow-hidden rounded-xl border border-[#c9d8ef]">
                  <Image src={previewHref} alt={`${resource.title} preview`} width={1600} height={1000} className="h-auto w-full" />
                </div>
              ) : (
                <div className="rounded-xl border border-[#d2deef] bg-[linear-gradient(145deg,#eef4ff_0%,#f8fbff_100%)] p-6">
                  <div className="inline-flex rounded-full border border-[#c2d3ea] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#526986]">
                    {formatResourceType(resource.type)}
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-[#1a3a64]">{resource.title}</h3>
                  <p className="mt-1 text-sm text-[#4c6589]">{resource.description}</p>
                </div>
              )}
              <div className="rounded-xl border border-[#d7e3f4] bg-[#f8fbff] p-6 text-sm text-[#42597f]">
                <p className="font-semibold text-[#1d355d]">This resource is available as a downloadable document.</p>
                <p className="mt-2">Use the download button above to open it in your preferred editor or document viewer.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
