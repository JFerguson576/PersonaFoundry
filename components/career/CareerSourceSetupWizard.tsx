"use client"

import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { CareerStatusBanner } from "@/components/career/CareerStatusBanner"
import { careerActionErrorMessage, getAuthHeaders, getCareerMessageTone, notifyCareerWorkspaceRefresh, toCareerUserMessage } from "@/lib/career-client"
import { CAREER_SOURCE_TYPE_OPTIONS, CAREER_SOURCE_WIZARD_STEPS, type CareerSourceTypeValue } from "@/lib/career-workflow"
import { validateCareerUploadFile } from "@/lib/career-upload-client"
const UPLOAD_REQUEST_TIMEOUT_MS = 90_000

type Props = {
  candidateId: string
  existingDocuments?: Array<{ source_type: string | null }>
}

export function CareerSourceSetupWizard({ candidateId, existingDocuments = [] }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [wizardMode, setWizardMode] = useState(true)
  const [stepIndex, setStepIndex] = useState(0)
  const [sourceType, setSourceType] = useState<CareerSourceTypeValue>(CAREER_SOURCE_WIZARD_STEPS[0])
  const [title, setTitle] = useState("")
  const [contentText, setContentText] = useState("")
  const [selectedFileName, setSelectedFileName] = useState("")
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [fileLoading, setFileLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [localCompletions, setLocalCompletions] = useState<Set<CareerSourceTypeValue>>(new Set())

  const completedTypes = useMemo(() => {
    const completed = new Set<CareerSourceTypeValue>()
    for (const row of existingDocuments) {
      if (row.source_type && CAREER_SOURCE_WIZARD_STEPS.includes(row.source_type as CareerSourceTypeValue)) {
        completed.add(row.source_type as CareerSourceTypeValue)
      }
    }
    for (const row of localCompletions) completed.add(row)
    return completed
  }, [existingDocuments, localCompletions])

  const nextIncompleteIndex = useMemo(() => {
    const found = CAREER_SOURCE_WIZARD_STEPS.findIndex((step) => !completedTypes.has(step))
    return found >= 0 ? found : CAREER_SOURCE_WIZARD_STEPS.length - 1
  }, [completedTypes])

  const selectedOption = CAREER_SOURCE_TYPE_OPTIONS.find((option) => option.value === sourceType) ?? CAREER_SOURCE_TYPE_OPTIONS[0]
  const remainingWizardSteps = Math.max(CAREER_SOURCE_WIZARD_STEPS.length - completedTypes.size, 0)

  function moveToNextMissing() {
    const nextType = CAREER_SOURCE_WIZARD_STEPS[nextIncompleteIndex] ?? CAREER_SOURCE_WIZARD_STEPS[0]
    setStepIndex(nextIncompleteIndex)
    setSourceType(nextType)
  }

  function markDone(type: CareerSourceTypeValue) {
    setLocalCompletions((current) => new Set(current).add(type))
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const validationError = validateCareerUploadFile(file)
    if (validationError) {
      setPendingFile(null)
      setSelectedFileName("")
      setMessage(validationError)
      if (event.target) event.target.value = ""
      return
    }
    setPendingFile(file)
    setSelectedFileName(file.name)
    setMessage("File ready to upload. Click 'Upload selected file' to continue.")
    if (event.target) event.target.value = ""
  }

  async function handleUploadSelectedFile() {
    if (fileLoading) return
    if (!pendingFile) {
      setMessage("Choose a file first.")
      return
    }

    setFileLoading(true)
    setMessage("")
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), UPLOAD_REQUEST_TIMEOUT_MS)

    try {
      const formData = new FormData()
      formData.append("file", pendingFile)
      formData.append("candidate_id", candidateId)
      formData.append("source_type", sourceType)
      if (title.trim()) formData.append("title", title.trim())

      const headers = await getAuthHeaders()
      delete headers["Content-Type"]

      const response = await fetch("/api/career/upload-source-file", { method: "POST", headers, body: formData, signal: controller.signal })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to upload file")

      setSelectedFileName(json.file_name || pendingFile.name)
      setPendingFile(null)
      setTitle("")
      setContentText("")
      markDone(sourceType)
      setMessage(`Uploaded and saved ${json.file_name || pendingFile.name} into the workspace.`)
      notifyCareerWorkspaceRefresh()
      router.refresh()
      if (wizardMode) moveToNextMissing()
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setMessage("Upload timed out. Please try a smaller file or retry in a moment.")
        return
      }
      setMessage(toCareerUserMessage(error instanceof Error ? error.message : null, careerActionErrorMessage("upload the file")))
    } finally {
      window.clearTimeout(timeout)
      setFileLoading(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage("")

    try {
      const response = await fetch("/api/career/documents", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ candidate_id: candidateId, source_type: sourceType, title, content_text: contentText }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to save source material")

      setTitle("")
      setContentText("")
      setSelectedFileName("")
      markDone(sourceType)
      setMessage("Source material saved.")
      notifyCareerWorkspaceRefresh()
      router.refresh()
      if (wizardMode) moveToNextMissing()
    } catch (error) {
      setMessage(toCareerUserMessage(error instanceof Error ? error.message : null, careerActionErrorMessage("save the source material")))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Load content</h2>
          <p className="mt-1 text-sm text-neutral-600">Wizard mode stays available and guides any unfinished source steps.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setWizardMode(true)
              moveToNextMissing()
            }}
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${
              wizardMode
                ? "border-[#0a66c2] bg-[#0a66c2] text-white shadow-[0_0_0_2px_rgba(10,102,194,0.18)]"
                : "border-neutral-300 bg-white text-neutral-700"
            }`}
          >
            Wizard
          </button>
          <button type="button" onClick={() => setWizardMode(false)} className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${!wizardMode ? "border-sky-300 bg-sky-50 text-sky-900" : "border-neutral-300 bg-white text-neutral-700"}`}>Manual</button>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-600">
        Setup progress {completedTypes.size}/{CAREER_SOURCE_WIZARD_STEPS.length}
      </div>
      {remainingWizardSteps > 0 ? (
        <div className="rounded-xl border border-[#c7dcff] bg-[#eef6ff] px-3 py-2 text-xs text-[#0a4a82]">
          Wizard active: {remainingWizardSteps} source {remainingWizardSteps === 1 ? "step" : "steps"} still recommended.
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          Core source setup is complete. Wizard can still guide updates any time.
        </div>
      )}

      {wizardMode ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Current step</div>
              <div className="mt-1 text-base font-semibold text-sky-950">{selectedOption.label}</div>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-sky-900">{selectedOption.guidance}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { const prev = Math.max(0, stepIndex - 1); setStepIndex(prev); setSourceType(CAREER_SOURCE_WIZARD_STEPS[prev]) }} disabled={stepIndex === 0} className="rounded-full border border-sky-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-sky-900 disabled:opacity-50">Back</button>
              <button type="button" onClick={() => { const next = Math.min(CAREER_SOURCE_WIZARD_STEPS.length - 1, stepIndex + 1); setStepIndex(next); setSourceType(CAREER_SOURCE_WIZARD_STEPS[next]) }} disabled={stepIndex >= CAREER_SOURCE_WIZARD_STEPS.length - 1} className="rounded-full border border-sky-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-sky-900 disabled:opacity-50">Skip</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-neutral-200 bg-white p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Choose content type</div>
          <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {CAREER_SOURCE_TYPE_OPTIONS.map((option) => (
              <button key={option.value} type="button" onClick={() => setSourceType(option.value)} className={`rounded-xl border px-3 py-2 text-left ${sourceType === option.value ? "border-sky-300 bg-sky-50" : "border-neutral-200 bg-neutral-50 hover:bg-white"}`}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">{option.priority}</div>
                <div className="mt-1 text-sm font-semibold text-neutral-900">{option.label}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">Title</label>
        <input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-xl border border-neutral-300 px-3 py-2" placeholder={selectedOption.suggestedTitle} />
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <label className="block text-sm font-medium">Import file</label>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={fileLoading} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">{fileLoading ? "Importing..." : "Choose file"}</button>
            <button
              type="button"
              onClick={() => void handleUploadSelectedFile()}
              disabled={fileLoading || !pendingFile}
              className="rounded-xl border border-[#0a66c2] bg-[#0a66c2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0958a8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {fileLoading ? "Uploading..." : "Upload selected file"}
            </button>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept=".txt,.md,.rtf,.docx,.pdf" onChange={handleFileUpload} className="hidden" />
        <p className="text-xs text-neutral-500">Supported: `.txt`, `.md`, `.rtf`, `.docx`, `.pdf` (up to 10MB).</p>
        {selectedFileName ? <p className="text-xs text-neutral-600">Last uploaded: <span className="font-medium">{selectedFileName}</span></p> : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Content</label>
        <textarea value={contentText} onChange={(event) => setContentText(event.target.value)} className="min-h-[220px] w-full rounded-xl border border-neutral-300 px-3 py-2" placeholder={`Paste ${selectedOption.label.toLowerCase()} content here, or import a file above...`} />
      </div>

      <button type="submit" disabled={loading || fileLoading || !contentText.trim()} className="rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {loading ? "Saving..." : "Save source material"}
      </button>

      {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} /> : null}
      <p className="text-xs text-neutral-500">Next step: generate the profile in Step 3.</p>
    </form>
  )
}
