import mammoth from "mammoth"
import { extractText, getDocumentProxy } from "unpdf"

export const CAREER_UPLOAD_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
export const CAREER_UPLOAD_MAX_EXTRACTED_TEXT_CHARS = 200_000
const CAREER_UPLOAD_ALLOWED_EXTENSIONS = new Set(["txt", "md", "rtf", "docx", "pdf"])

export function getUploadExtension(fileName: string) {
  const parts = fileName.toLowerCase().split(".")
  return parts.length > 1 ? parts.at(-1) || "" : ""
}

export function normalizeExtractedUploadText(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
}

function clampExtractedUploadText(value: string) {
  const normalized = normalizeExtractedUploadText(value)
  if (normalized.length <= CAREER_UPLOAD_MAX_EXTRACTED_TEXT_CHARS) {
    return normalized
  }

  return `${normalized.slice(0, CAREER_UPLOAD_MAX_EXTRACTED_TEXT_CHARS)}\n\n[Content truncated for stability.]`
}

export async function extractTextFromCareerUpload(file: File) {
  if (file.size === 0) {
    throw new Error("The selected file is empty")
  }

  if (file.size > CAREER_UPLOAD_MAX_FILE_SIZE_BYTES) {
    throw new Error("The selected file is larger than 10MB")
  }

  const extension = getUploadExtension(file.name)
  if (!CAREER_UPLOAD_ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error("Supported file types are .txt, .md, .rtf, .docx, and .pdf")
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  if (extension === "txt" || extension === "md" || extension === "rtf") {
    return clampExtractedUploadText(buffer.toString("utf-8"))
  }

  if (extension === "docx") {
    const result = await mammoth.extractRawText({ buffer })
    return clampExtractedUploadText(result.value)
  }

  if (extension === "pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const result = await extractText(pdf, { mergePages: true })
    return clampExtractedUploadText(result.text)
  }

  throw new Error("Supported file types are .txt, .md, .rtf, .docx, and .pdf")
}
