"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { CareerStatusBanner } from "@/components/career/CareerStatusBanner"
import { careerActionErrorMessage, getAuthHeaders, getCareerMessageTone, notifyCareerWorkspaceRefresh, toCareerUserMessage } from "@/lib/career-client"
import { CAREER_SOURCE_TYPE_OPTIONS, CAREER_SOURCE_WIZARD_STEPS, type CareerSourceTypeValue } from "@/lib/career-workflow"
import { validateCareerUploadFile } from "@/lib/career-upload-client"
const UPLOAD_REQUEST_TIMEOUT_MS = 90_000
const DRAFT_KEY_PREFIX = "career-source-draft"

type Props = {
  candidateId: string
  existingDocuments?: Array<{
    id?: string
    source_type: string | null
    title?: string | null
    created_at?: string | null
  }>
}

export function CareerSourceSetupWizard({ candidateId, existingDocuments = [] }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const contentTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [wizardMode, setWizardMode] = useState(true)
  const [showAdvancedTypeSelector, setShowAdvancedTypeSelector] = useState(false)
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
  const [openWizardPanel, setOpenWizardPanel] = useState<"progress" | "file" | "paste" | "status">("progress")

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
  const sourceDocuments = useMemo(
    () => existingDocuments.filter((row) => row.source_type === sourceType),
    [existingDocuments, sourceType]
  )
  const latestSourceDocument = sourceDocuments[0] ?? null
  const hasUploadedSourceForCurrentStep = sourceDocuments.length > 0
  const remainingWizardSteps = Math.max(CAREER_SOURCE_WIZARD_STEPS.length - completedTypes.size, 0)
  const wizardPercent = Math.round((completedTypes.size / Math.max(CAREER_SOURCE_WIZARD_STEPS.length, 1)) * 100)
  const stepCountLabel = `${Math.min(stepIndex + 1, CAREER_SOURCE_WIZARD_STEPS.length)}/${CAREER_SOURCE_WIZARD_STEPS.length}`
  const normalizedMessage = message.trim().toLowerCase()
  const showUploadRecoveryActions =
    Boolean(normalizedMessage) &&
    (normalizedMessage.includes("timed out") ||
      normalizedMessage.includes("failed to upload") ||
      normalizedMessage.includes("upload the file"))
  const nextRecommendedType = CAREER_SOURCE_WIZARD_STEPS.find((step) => !completedTypes.has(step)) ?? null
  const nextRecommendedOption = nextRecommendedType
    ? CAREER_SOURCE_TYPE_OPTIONS.find((option) => option.value === nextRecommendedType) ?? null
    : null
  const sourceSetupComplete = nextRecommendedType === null
  const nextActionLabel = sourceSetupComplete
    ? "Go to Step 3: Build profile"
    : `Open next required file: ${nextRecommendedOption?.label || "Continue source setup"}`
  const saveSuccessMessage = (savedFileName: string) => {
    if (sourceType === "strengths") {
      return `Strengths report loaded and mapped: ${savedFileName}. Open My files > Recent files to view it.`
    }
    return `${selectedOption.label} loaded and saved: ${savedFileName}. Open My files > Recent files to view it.`
  }

  const activeDraftKey = `${DRAFT_KEY_PREFIX}:${candidateId}:${sourceType}`

  function moveToNextMissing() {
    const nextType = CAREER_SOURCE_WIZARD_STEPS[nextIncompleteIndex] ?? CAREER_SOURCE_WIZARD_STEPS[0]
    setStepIndex(nextIncompleteIndex)
    setSourceType(nextType)
    setPendingFile(null)
    setSelectedFileName("")
  }

  function openStep(type: CareerSourceTypeValue) {
    const nextIndex = CAREER_SOURCE_WIZARD_STEPS.indexOf(type)
    if (nextIndex >= 0) setStepIndex(nextIndex)
    setSourceType(type)
    setOpenWizardPanel("progress")
  }

  function jumpToCreateProfileStep() {
    if (typeof window === "undefined") return
    const target = document.querySelector("#generate-profile") as HTMLElement | null
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" })
      return
    }
    window.location.hash = "generate-profile"
  }

  function markDone(type: CareerSourceTypeValue) {
    setLocalCompletions((current) => new Set(current).add(type))
  }

  function clearActiveDraft() {
    if (typeof window === "undefined") return
    window.localStorage.removeItem(activeDraftKey)
  }

  function skipCurrentStep() {
    const next = Math.min(CAREER_SOURCE_WIZARD_STEPS.length - 1, stepIndex + 1)
    setStepIndex(next)
    setSourceType(CAREER_SOURCE_WIZARD_STEPS[next])
    setPendingFile(null)
    setSelectedFileName("")
    setMessage(`Skipped ${selectedOption.label}. You can come back to this step any time.`)
  }

  function markCurrentStepComplete() {
    markDone(sourceType)
    clearActiveDraft()
    setTitle("")
    setContentText("")
    setPendingFile(null)
    setSelectedFileName("")
    setMessage(`${selectedOption.label} marked complete.`)
    if (wizardMode) {
      window.setTimeout(() => moveToNextMissing(), 60)
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const saved = window.localStorage.getItem(activeDraftKey)
      if (!saved) {
        setTitle("")
        setContentText("")
        return
      }
      const parsed = JSON.parse(saved) as { title?: string; contentText?: string } | null
      setTitle(typeof parsed?.title === "string" ? parsed.title : "")
      setContentText(typeof parsed?.contentText === "string" ? parsed.contentText : "")
    } catch {
      setTitle("")
      setContentText("")
    }
  }, [activeDraftKey])

  useEffect(() => {
    if (typeof window === "undefined") return
    const hasDraft = title.trim().length > 0 || contentText.trim().length > 0
    if (!hasDraft) {
      window.localStorage.removeItem(activeDraftKey)
      return
    }
    const payload = JSON.stringify({ title, contentText, updatedAt: new Date().toISOString() })
    window.localStorage.setItem(activeDraftKey, payload)
  }, [activeDraftKey, title, contentText])

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
    setMessage(`File selected for ${selectedOption.label}. Click 'Upload and save' to continue.`)
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
      clearActiveDraft()
      markDone(sourceType)
      setMessage(saveSuccessMessage(json.file_name || pendingFile.name))
      notifyCareerWorkspaceRefresh()
      router.refresh()
      if (wizardMode) {
        moveToNextMissing()
        setOpenWizardPanel("file")
      } else {
        setOpenWizardPanel("status")
      }
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

  function clearSelectedPendingFile() {
    setPendingFile(null)
    setSelectedFileName("")
    setMessage("Selected file cleared. Choose a different file when ready.")
  }

  async function handleDeleteLatestSourceDocument() {
    if (!latestSourceDocument?.id || fileLoading || loading) return

    const shouldDelete = window.confirm(`Delete the latest ${selectedOption.label} file for this candidate?`)
    if (!shouldDelete) return

    setLoading(true)
    setMessage("")

    try {
      const response = await fetch(`/api/career/documents/${latestSourceDocument.id}`, {
        method: "DELETE",
        headers: await getAuthHeaders(),
      })

      const json = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof json?.error === "string" ? json.error : "Failed to delete source document")
      }

      setPendingFile(null)
      setSelectedFileName("")
      setLocalCompletions((current) => {
        if (sourceDocuments.length > 1) return current
        const next = new Set(current)
        next.delete(sourceType)
        return next
      })
      setMessage(`${selectedOption.label} deleted. You can upload a corrected file now.`)
      notifyCareerWorkspaceRefresh()
      router.refresh()
    } catch (error) {
      setMessage(toCareerUserMessage(error instanceof Error ? error.message : null, careerActionErrorMessage("delete the source file")))
    } finally {
      setLoading(false)
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
      clearActiveDraft()
      markDone(sourceType)
      setMessage(
        sourceType === "strengths"
          ? "Strengths report text loaded and mapped. You can find it in My files > Recent files."
          : "Text saved. You can find it in My files > Recent files."
      )
      notifyCareerWorkspaceRefresh()
      router.refresh()
      if (wizardMode) {
        moveToNextMissing()
        setOpenWizardPanel("file")
      } else {
        setOpenWizardPanel("status")
      }
    } catch (error) {
      setMessage(toCareerUserMessage(error instanceof Error ? error.message : null, careerActionErrorMessage("save the source material")))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Load source files</h2>
        <button
          type="button"
          onClick={() => {
            setWizardMode(true)
            moveToNextMissing()
            setOpenWizardPanel("progress")
          }}
          className="rounded-full border border-[#0a66c2] bg-[#0a66c2] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white shadow-[0_0_0_2px_rgba(10,102,194,0.18)]"
        >
          Guided setup
        </button>
      </div>
      <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-sky-950">
            <span className="font-semibold">Do next:</span>{" "}
            {sourceSetupComplete ? "Build the profile from these inputs." : "Finish the next source step."}
          </p>
          <button
            type="button"
            onClick={() => {
              if (sourceSetupComplete) {
                jumpToCreateProfileStep()
                return
              }
              if (nextRecommendedType) {
                openStep(nextRecommendedType)
              }
            }}
            className="rounded-full border border-[#0a66c2] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0a66c2] hover:bg-[#e8f3ff]"
          >
            {nextActionLabel}
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white">
        <button
          type="button"
          onClick={() => setOpenWizardPanel("progress")}
          className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left ${
            openWizardPanel === "progress" ? "rounded-t-2xl border-b border-sky-200 bg-sky-50" : "rounded-2xl"
          }`}
        >
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-700">Current step</span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Step {stepCountLabel}</span>
        </button>
        {openWizardPanel === "progress" ? (
          <div className="space-y-2.5 px-3 py-2.5">
            <div className="rounded-2xl border border-sky-200 bg-white px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-sky-800">
                <span>Setup {completedTypes.size}/{CAREER_SOURCE_WIZARD_STEPS.length}</span>
                <span>Step {stepCountLabel}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sky-100">
                <div className="h-full rounded-full bg-[#0a66c2] transition-all duration-300" style={{ width: `${wizardPercent}%` }} />
              </div>
              <div className="mt-1 text-[11px] text-neutral-600">
                {remainingWizardSteps > 0
                  ? `${remainingWizardSteps} recommended ${remainingWizardSteps === 1 ? "item" : "items"} left.`
                  : "Core setup complete. You can update these files any time."}
              </div>
            </div>

            <div className="rounded-xl border border-sky-200 bg-sky-50 p-2.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Current step</div>
                  <div className="mt-1 text-sm font-semibold text-sky-950">{selectedOption.label}</div>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-sky-900">{selectedOption.guidance}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const prev = Math.max(0, stepIndex - 1)
                      setStepIndex(prev)
                      setSourceType(CAREER_SOURCE_WIZARD_STEPS[prev])
                      setPendingFile(null)
                      setSelectedFileName("")
                    }}
                    disabled={stepIndex === 0}
                    className="rounded-full border border-sky-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-900 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={skipCurrentStep}
                    disabled={stepIndex >= CAREER_SOURCE_WIZARD_STEPS.length - 1}
                    className="rounded-full border border-sky-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-900 disabled:opacity-50"
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    onClick={markCurrentStepComplete}
                    className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-800 hover:bg-emerald-100"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-3">
              <button
                type="button"
                onClick={() => setShowAdvancedTypeSelector((current) => !current)}
                className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                {showAdvancedTypeSelector ? "Hide source list" : "Choose a different source type"}
              </button>
              {showAdvancedTypeSelector ? (
                <div className="mt-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Source type picker</div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <label className="text-xs font-medium text-neutral-700">
                      Source type
                      <select
                        value={sourceType}
                        onChange={(event) => {
                          setSourceType(event.target.value as CareerSourceTypeValue)
                          setPendingFile(null)
                          setSelectedFileName("")
                        }}
                        className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                      >
                        {CAREER_SOURCE_TYPE_OPTIONS.map((option) => {
                          const isLoaded = completedTypes.has(option.value)
                          return (
                            <option key={option.value} value={option.value}>
                              {option.label} - {isLoaded ? "Loaded" : "Missing"}
                            </option>
                          )
                        })}
                      </select>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                        {selectedOption.priority}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                          completedTypes.has(sourceType)
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border border-amber-200 bg-amber-50 text-amber-800"
                        }`}
                      >
                        {completedTypes.has(sourceType) ? "Loaded" : "Missing"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
                    {selectedOption.guidance}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white">
        <button
          type="button"
          onClick={() => setOpenWizardPanel("file")}
          className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left ${
            openWizardPanel === "file" ? "rounded-t-2xl border-b border-neutral-200 bg-neutral-50" : "rounded-2xl"
          }`}
        >
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-700">2. Upload a file</span>
          <span className="text-[11px] text-neutral-500">{pendingFile ? pendingFile.name : "Choose + upload"}</span>
        </button>
        {openWizardPanel === "file" ? (
          <div className="space-y-3 px-3 py-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Title</label>
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-xl border border-neutral-300 px-3 py-2" placeholder={selectedOption.suggestedTitle} />
              <p className="mt-1 text-[11px] text-neutral-500">Draft autosaves for this step.</p>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <label className="block text-sm font-medium">Upload from your computer</label>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={fileLoading} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
                    {fileLoading ? "Preparing..." : "Select file"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleUploadSelectedFile()}
                    disabled={fileLoading || !pendingFile}
                    className="rounded-xl border border-[#0a66c2] bg-[#0a66c2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0958a8] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {fileLoading ? "Uploading..." : "Upload and save"}
                  </button>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept=".txt,.md,.rtf,.docx,.pdf" onChange={handleFileUpload} className="hidden" />
              <p className="text-xs text-neutral-500">Supported: `.txt`, `.md`, `.rtf`, `.docx`, `.pdf` (up to 10MB).</p>
              {pendingFile ? (
                <p className="mt-1 text-xs text-amber-800">
                  Selected (not uploaded yet): <span className="font-medium">{pendingFile.name}</span>
                </p>
              ) : null}
              {selectedFileName && !pendingFile ? (
                <p className="mt-1 text-xs text-neutral-600">
                  Latest uploaded file ({selectedOption.label}): <span className="font-medium">{selectedFileName}</span>
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white">
        <button
          type="button"
          onClick={() => setOpenWizardPanel("paste")}
          className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left ${
            openWizardPanel === "paste" ? "rounded-t-2xl border-b border-neutral-200 bg-neutral-50" : "rounded-2xl"
          }`}
        >
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-700">3. Paste text (optional)</span>
          <span className="text-[11px] text-neutral-500">Manual entry</span>
        </button>
        {openWizardPanel === "paste" ? (
          <div className="space-y-3 px-3 py-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Content</label>
              <textarea
                ref={contentTextareaRef}
                value={contentText}
                onChange={(event) => setContentText(event.target.value)}
                className="min-h-[220px] w-full rounded-xl border border-neutral-300 px-3 py-2"
                placeholder={`Paste ${selectedOption.label.toLowerCase()} content here, or import a file above...`}
              />
            </div>
            <button type="submit" disabled={loading || fileLoading || !contentText.trim()} className="rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {loading ? "Saving..." : "Save pasted text"}
            </button>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white">
        <button
          type="button"
          onClick={() => setOpenWizardPanel("status")}
          className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left ${
            openWizardPanel === "status" ? "rounded-t-2xl border-b border-neutral-200 bg-neutral-50" : "rounded-2xl"
          }`}
        >
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-700">4. Review and continue</span>
          <span className="text-[11px] text-neutral-500">{hasUploadedSourceForCurrentStep ? "Ready" : "Needs upload"}</span>
        </button>
        {openWizardPanel === "status" ? (
          <div className="space-y-3 px-3 py-3">
            <div
              className={`rounded-2xl border px-3 py-2 text-xs ${
                hasUploadedSourceForCurrentStep ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              <div className="font-semibold uppercase tracking-[0.08em]">{hasUploadedSourceForCurrentStep ? "Uploaded status" : "Needs upload"}</div>
              {hasUploadedSourceForCurrentStep ? (
                <div className="mt-1">
                  <span className="font-semibold">{selectedOption.label} is loaded.</span>{" "}
                  {latestSourceDocument?.title ? (
                    <>
                      Latest file: <span className="font-semibold">{latestSourceDocument.title}</span>.
                    </>
                  ) : null}{" "}
                  {latestSourceDocument?.created_at ? `Saved ${new Date(latestSourceDocument.created_at).toLocaleString()}.` : ""}
                </div>
              ) : (
                <div className="mt-1">{selectedOption.label} has not been uploaded yet for this candidate.</div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {pendingFile ? (
                  <button
                    type="button"
                    onClick={clearSelectedPendingFile}
                    className="rounded-full border border-amber-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-900 hover:bg-amber-100"
                  >
                    Clear selected file
                  </button>
                ) : null}
                {hasUploadedSourceForCurrentStep && latestSourceDocument?.id ? (
                  <button
                    type="button"
                    onClick={() => void handleDeleteLatestSourceDocument()}
                    disabled={loading || fileLoading}
                    className="rounded-full border border-rose-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Delete latest {selectedOption.label}
                  </button>
                ) : null}
              </div>
            </div>

            {message ? <CareerStatusBanner message={message} tone={getCareerMessageTone(message)} /> : null}
            {showUploadRecoveryActions ? (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                <button
                  type="button"
                  onClick={() => void handleUploadSelectedFile()}
                  disabled={fileLoading || !pendingFile}
                  className="rounded-full border border-amber-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Retry upload
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenWizardPanel("paste")
                    contentTextareaRef.current?.focus()
                    contentTextareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
                  }}
                  className="rounded-full border border-amber-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-900 hover:bg-amber-100"
                >
                  Paste text instead
                </button>
              </div>
            ) : null}
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700">Continue with</div>
              {!sourceSetupComplete && nextRecommendedOption ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <p className="text-xs text-neutral-600">Continue setup with <span className="font-semibold">{nextRecommendedOption.label}</span>.</p>
                  <button
                    type="button"
                    onClick={() => openStep(nextRecommendedOption.value)}
                    className="rounded-full border border-[#0a66c2] bg-[#e8f3ff] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0a66c2] hover:bg-[#dcecff]"
                  >
                    Open next source step
                  </button>
                </div>
              ) : (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <p className="text-xs text-neutral-600">Core source setup is complete. Generate the profile next.</p>
                  <button
                    type="button"
                    onClick={jumpToCreateProfileStep}
                    className="rounded-full border border-[#0a66c2] bg-[#0a66c2] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#004182]"
                  >
                    Go to create profile
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </form>
  )
}
