import mammoth from "mammoth"
import { extractText, getDocumentProxy } from "unpdf"

export const CAREER_UPLOAD_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

export function getUploadExtension(fileName: string) {
  const parts = fileName.toLowerCase().split(".")
  return parts.length > 1 ? parts.at(-1) || "" : ""
}

export function normalizeExtractedUploadText(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
}

export async function extractTextFromCareerUpload(file: File) {
  if (file.size === 0) {
    throw new Error("The selected file is empty")
  }

  if (file.size > CAREER_UPLOAD_MAX_FILE_SIZE_BYTES) {
    throw new Error("The selected file is larger than 10MB")
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const extension = getUploadExtension(file.name)

  if (extension === "txt" || extension === "md" || extension === "rtf") {
    return normalizeExtractedUploadText(buffer.toString("utf-8"))
  }

  if (extension === "docx") {
    const result = await mammoth.extractRawText({ buffer })
    return normalizeExtractedUploadText(result.value)
  }

  if (extension === "pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const result = await extractText(pdf, { mergePages: true })
    return normalizeExtractedUploadText(result.text)
  }

  throw new Error("Supported file types are .txt, .md, .rtf, .docx, and .pdf")
}
