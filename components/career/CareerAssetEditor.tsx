"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx"
import { CareerStatusBanner } from "@/components/career/CareerStatusBanner"
import { careerActionErrorMessage, getAuthHeaders, getCareerMessageTone, notifyCareerWorkspaceRefresh } from "@/lib/career-client"

type Props = {
  candidateId: string
  assetType: string
  initialTitle: string
  initialContent: string
}

export function CareerAssetEditor({ candidateId, assetType, initialTitle, initialContent }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(initialContent)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const hasExportableContent = Boolean(content.trim())

  async function handleSave() {
    setLoading(true)
    setMessage("")

    try {
      const response = await fetch("/api/career/assets", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          candidate_id: candidateId,
          asset_type: assetType,
          title,
          content,
        }),
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to save asset")
      }

      setMessage("Saved as a new version.")
      notifyCareerWorkspaceRefresh()
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : careerActionErrorMessage("save the updated asset"))
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content)
        setMessage("Copied to clipboard.")
        return
      }

      if (typeof document !== "undefined") {
        const textarea = document.createElement("textarea")
        textarea.value = content
        textarea.setAttribute("readonly", "true")
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        document.body.appendChild(textarea)
        textarea.select()
        try {
          document.execCommand("copy")
          setMessage("Copied to clipboard.")
        } finally {
          document.body.removeChild(textarea)
        }
        return
      }

      setMessage("Clipboard is unavailable in this browser.")
    } catch {
      setMessage("Failed to copy.")
    }
  }

  function handleDownloadText() {
    downloadBlob(`${buildFileName(title || assetType, "txt")}`, content, "text/plain;charset=utf-8")
    setMessage("Downloaded as .txt")
  }

  async function handleDownloadDocx() {
    try {
      const doc = new Document({
        sections: [
          {
            children: buildDocxParagraphs(title || formatAssetType(assetType), content),
          },
        ],
      })

      const blob = await Packer.toBlob(doc)
      downloadBlob(
        `${buildFileName(title || assetType, "docx")}`,
        blob,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
      setMessage("Downloaded as polished .docx")
    } catch {
      setMessage("Failed to create .docx file")
    }
  }

  const links = extractLinks(content)

  return (
    <div className="rounded-2xl border border-neutral-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">{formatAssetType(assetType)}</div>
          <div className="mt-1 text-sm text-neutral-500">Edit the content below, then save a new version so earlier drafts stay preserved.</div>
        </div>
        <div className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-600">
          Version-safe editing
        </div>
      </div>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        className="mt-2 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-semibold"
      />
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        className="mt-3 min-h-[180px] w-full rounded-2xl border border-neutral-300 px-3 py-3 text-sm leading-6"
      />
      {links.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Links in this document</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {links.map((link) => (
              <a
                key={link}
                href={link}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
              >
                {truncateLink(link)}
              </a>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
            hasExportableContent
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-neutral-200 bg-neutral-50 text-neutral-500"
          }`}
        >
          {hasExportableContent ? "Ready to export" : "Add content to export"}
        </span>
        <button
          onClick={handleSave}
          disabled={loading || !title.trim() || !content.trim()}
          title="Save this as a new version in the candidate workspace."
          className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save updated version"}
        </button>
        <button
          onClick={handleCopy}
          type="button"
          disabled={!hasExportableContent}
          title="Copy the current asset text to your clipboard."
          className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Copy text
        </button>
        <button
          onClick={handleDownloadText}
          type="button"
          disabled={!hasExportableContent}
          title="Download a plain text (.txt) copy."
          className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Download .txt
        </button>
        <button
          onClick={() => void handleDownloadDocx()}
          type="button"
          disabled={!hasExportableContent}
          title="Download a polished Word (.docx) version with headings."
          className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Download .docx
        </button>
      </div>
      {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} className="mt-3" /> : null}
      <p className="mt-3 text-xs leading-5 text-neutral-500">
        Saving creates a new version inside this candidate workspace. Download actions export a copy for use outside the platform.
      </p>
    </div>
  )
}

function formatAssetType(assetType: string) {
  return assetType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function extractLinks(content: string) {
  const matches = content.match(/https?:\/\/[^\s)\]]+/g) ?? []
  return [...new Set(matches)]
}

function truncateLink(value: string) {
  return value.length > 64 ? `${value.slice(0, 61)}...` : value
}

function buildFileName(value: string, extension: string) {
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return `${safe || "career-document"}.${extension}`
}

function downloadBlob(fileName: string, content: BlobPart, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function buildDocxParagraphs(documentTitle: string, rawContent: string) {
  const lines = rawContent.replace(/\r\n/g, "\n").split("\n")
  const paragraphs: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 260 },
      children: [new TextRun({ text: documentTitle, bold: true })],
    }),
  ]

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      paragraphs.push(new Paragraph({ spacing: { after: 120 } }))
      continue
    }

    if (/^#{1,3}\s+/.test(trimmed)) {
      const level = (trimmed.match(/^#+/)?.[0].length || 1) as 1 | 2 | 3
      const headingText = trimmed.replace(/^#{1,3}\s+/, "")
      paragraphs.push(
        new Paragraph({
          heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 120 },
          children: [new TextRun({ text: headingText, bold: true })],
        })
      )
      continue
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 180, after: 100 },
          children: parseInlineBold(trimmed),
        })
      )
      continue
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      paragraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 80 },
          children: parseInlineBold(trimmed.replace(/^[-*•]\s+/, "")),
        })
      )
      continue
    }

    if (/^[A-Za-z][A-Za-z0-9\s/&+-]{1,60}:$/.test(trimmed)) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 150, after: 80 },
          children: [new TextRun({ text: trimmed.replace(/:$/, ""), bold: true })],
        })
      )
      continue
    }

    paragraphs.push(
      new Paragraph({
        spacing: { after: 110 },
        children: parseInlineBold(trimmed),
      })
    )
  }

  return paragraphs
}

function parseInlineBold(line: string) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  if (parts.length === 0) return [new TextRun(line)]

  return parts.map((part) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return new TextRun({ text: part.slice(2, -2), bold: true })
    }
    return new TextRun(part)
  })
}
