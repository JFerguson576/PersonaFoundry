"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react"
import type { Session } from "@supabase/supabase-js"
import { getAuthHeaders, toCareerUserMessage } from "@/lib/career-client"
import { extractLinkedInProfile } from "@/lib/linkedin-profile"
import { supabase } from "@/lib/supabase"

export function CareerCandidateForm() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [fullName, setFullName] = useState("")
  const [city, setCity] = useState("Auckland")
  const [primaryGoal, setPrimaryGoal] = useState("new_role")
  const [cvText, setCvText] = useState("")
  const [pendingCvFile, setPendingCvFile] = useState<File | null>(null)
  const [selectedCvFileName, setSelectedCvFileName] = useState("")
  const [cvFileLoading, setCvFileLoading] = useState(false)
  const [linkedInSummary, setLinkedInSummary] = useState("")
  const [linkedInImported, setLinkedInImported] = useState(false)
  const [useLinkedInImport, setUseLinkedInImport] = useState(true)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    async function loadSession() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()
      setSession(currentSession)
    }

    void loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const linkedIn = extractLinkedInProfile(session?.user)
    if (!linkedIn.available || linkedInImported) return

    if (linkedIn.fullName && !fullName) {
      setFullName(linkedIn.fullName)
    }
    if (linkedIn.city && (!city || city === "Auckland")) {
      setCity(linkedIn.city)
    }
    if (linkedIn.summaryText && !linkedInSummary) {
      setLinkedInSummary(linkedIn.summaryText)
    }
    setLinkedInImported(true)
  }, [city, fullName, linkedInImported, linkedInSummary, session?.user])

  function handleCvFilePick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setPendingCvFile(file)
    setSelectedCvFileName(file.name)
    setMessage(`Selected file: ${file.name}. Click 'Load file text' to continue.`)
    if (event.target) event.target.value = ""
  }

  async function handleLoadCvFromFile() {
    if (!pendingCvFile || cvFileLoading) {
      if (!pendingCvFile) {
        setMessage("Choose a CV file first.")
      }
      return
    }

    setCvFileLoading(true)
    setMessage("")

    try {
      const formData = new FormData()
      formData.append("file", pendingCvFile)

      const headers = await getAuthHeaders()
      delete headers["Content-Type"]

      const response = await fetch("/api/career/parse-upload", {
        method: "POST",
        headers,
        body: formData,
      })
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || "Could not read the uploaded CV file")
      }

      const parsedText = typeof json.content_text === "string" ? json.content_text.trim() : ""
      if (!parsedText) {
        throw new Error("We could not extract readable text from that file.")
      }

      setCvText(parsedText)
      setSelectedCvFileName(json.file_name || pendingCvFile.name)
      setPendingCvFile(null)
      setMessage("CV file loaded. Review the text below, then create candidate workspace.")
    } catch (error) {
      setMessage(toCareerUserMessage(error instanceof Error ? error.message : null))
    } finally {
      setCvFileLoading(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage("")

    try {
      const candidateRes = await fetch("/api/career/candidates", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          full_name: fullName,
          city,
          primary_goal: primaryGoal,
        }),
      })

      const candidateJson = await candidateRes.json()

      if (!candidateRes.ok) {
        throw new Error(candidateJson.error || "Failed to create candidate")
      }

      const candidateId = candidateJson.candidate?.id as string | undefined

      if (!candidateId) {
        throw new Error("Candidate was created but no id was returned")
      }

      if (cvText.trim()) {
        const documentRes = await fetch("/api/career/documents", {
          method: "POST",
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            candidate_id: candidateId,
            source_type: "cv",
            title: "Pasted CV",
            content_text: cvText,
          }),
        })

        const documentJson = await documentRes.json()

        if (!documentRes.ok) {
          throw new Error(documentJson.error || "Failed to save source document")
        }
      }

      if (useLinkedInImport && linkedInSummary.trim()) {
        const linkedInRes = await fetch("/api/career/documents", {
          method: "POST",
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            candidate_id: candidateId,
            source_type: "linkedin",
            title: "LinkedIn profile import",
            content_text: linkedInSummary,
          }),
        })

        const linkedInJson = await linkedInRes.json()

        if (!linkedInRes.ok) {
          throw new Error(linkedInJson.error || "Failed to save LinkedIn profile import")
        }
      }

      router.push(`/career/${candidateId}`)
      router.refresh()
    } catch (error) {
      setMessage(toCareerUserMessage(error instanceof Error ? error.message : null))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold">Start a candidate workspace</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Create a career workspace for one person, then keep their CV, Gallup Strengths report, notes, profile versions, and generated outputs together in one place.
        </p>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Best results come from loading strong source material early.
        Start with the current CV, then add the Gallup Strengths report and LinkedIn text as soon as the workspace opens.
      </div>

      <div className="grid gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-3">
        <ChecklistItem title="CV" description="Current resume or career history" />
        <ChecklistItem title="Strengths report" description="Gallup Strengths or similar material" />
        <ChecklistItem title="Proof points" description="LinkedIn, letters, wins, recruiter notes" />
      </div>

      {linkedInSummary ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-sky-900">LinkedIn profile detected</div>
              <p className="mt-1 text-xs text-sky-900/80">
                We can automatically add your LinkedIn profile snapshot into this workspace.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 rounded-full border border-sky-300 bg-white px-3 py-1 text-xs font-semibold text-sky-800">
              <input
                type="checkbox"
                checked={useLinkedInImport}
                onChange={(event) => setUseLinkedInImport(event.target.checked)}
                className="h-4 w-4 rounded border-sky-300"
              />
              Auto-import LinkedIn
            </label>
          </div>
        </div>
      ) : null}

      <div>
        <label className="mb-1 block text-sm font-medium">Full name</label>
        <input
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
          placeholder="Nigel Smith"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">City</label>
        <input
          value={city}
          onChange={(event) => setCity(event.target.value)}
          className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
          placeholder="Auckland"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Primary goal</label>
        <select
          value={primaryGoal}
          onChange={(event) => setPrimaryGoal(event.target.value)}
          className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
        >
          <option value="new_role">Land a new role</option>
          <option value="promotion">Position for promotion</option>
          <option value="career_change">Change direction</option>
          <option value="board_portfolio">Board or advisory work</option>
          <option value="consulting">Consulting or fractional work</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Paste one starting document now</label>
        <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.rtf,.md"
            onChange={handleCvFilePick}
            className="hidden"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-100"
            >
              Upload CV from computer
            </button>
            <button
              type="button"
              onClick={handleLoadCvFromFile}
              disabled={!pendingCvFile || cvFileLoading}
              className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cvFileLoading ? "Loading..." : "Load file text"}
            </button>
            <span className="text-xs text-neutral-600">
              {pendingCvFile ? `Selected: ${pendingCvFile.name}` : selectedCvFileName ? `Loaded: ${selectedCvFileName}` : "No file selected"}
            </span>
          </div>
        </div>
        <textarea
          value={cvText}
          onChange={(event) => setCvText(event.target.value)}
          className="min-h-[220px] w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
          placeholder="Paste the current CV, Gallup Strengths summary, LinkedIn text, or other starting notes. More files can be uploaded inside the workspace after creation."
        />
        <p className="mt-2 text-xs text-neutral-500">
          Optional, but helpful. This gives the workspace an immediate starting point before the user uploads more material.
        </p>
      </div>

      <button
        type="submit"
        disabled={loading || !fullName.trim()}
        className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Creating workspace..." : "Create candidate workspace"}
      </button>

      {message ? <p className="text-sm text-rose-700">{message}</p> : null}
    </form>
  )
}

function ChecklistItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3">
      <div className="text-sm font-semibold text-neutral-900">{title}</div>
      <p className="mt-1 text-xs leading-5 text-neutral-600">{description}</p>
    </div>
  )
}
