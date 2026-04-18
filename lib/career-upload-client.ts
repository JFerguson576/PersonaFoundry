export const CAREER_UPLOAD_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

export const CAREER_UPLOAD_ALLOWED_EXTENSIONS = new Set(["txt", "md", "rtf", "docx", "pdf"])

export function getCareerUploadExtension(fileName: string) {
  const parts = fileName.toLowerCase().split(".")
  return parts.length > 1 ? parts.at(-1) || "" : ""
}

export function validateCareerUploadFile(file: File) {
  if (!file) return "Choose a file to continue."
  if (file.size <= 0) return "The selected file is empty."
  if (file.size > CAREER_UPLOAD_MAX_FILE_SIZE_BYTES) {
    return "That file is larger than 10MB. Please choose a smaller file."
  }

  const extension = getCareerUploadExtension(file.name)
  if (!CAREER_UPLOAD_ALLOWED_EXTENSIONS.has(extension)) {
    return "Supported file types are .txt, .md, .rtf, .docx, and .pdf."
  }

  return null
}
