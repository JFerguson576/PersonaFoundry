"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { getAuthHeaders } from "@/lib/career-client"
import { supabase } from "@/lib/supabase"

type Candidate = {
  id: string
  full_name: string | null
  city: string | null
}

type Profile = {
  career_identity: string | null
  market_positioning: string | null
  seniority_level: string | null
  core_strengths: string[] | null
  signature_achievements: string[] | null
  role_families: string[] | null
  skills: string[] | null
  risks_or_gaps: string[] | null
  recommended_target_roles: string[] | null
}

export default function CareerTestPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [fullName, setFullName] = useState("")
  const [city, setCity] = useState("Auckland")
  const [cvText, setCvText] = useState("")
  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    async function loadSession() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

      setSession(currentSession)
    }

    loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function handleCreateAndAnalyze() {
    if (!session?.user) {
      setMessage("Please sign in on the main Persona Foundry page first, then come back here.")
      return
    }

    setLoading(true)
    setMessage("")
    setProfile(null)

    try {
      const createCandidateRes = await fetch("/api/career/candidates", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          full_name: fullName,
          city,
          primary_goal: "new_role",
        }),
      })

      const createCandidateJson = await createCandidateRes.json()

      if (!createCandidateRes.ok) {
        if (createCandidateRes.status === 401) {
          throw new Error("Please sign in on the main Persona Foundry page first, then try again.")
        }
        throw new Error(createCandidateJson.error || "Failed to create candidate")
      }

      const createdCandidate = createCandidateJson.candidate as Candidate
      setCandidate(createdCandidate)

      const saveDocRes = await fetch("/api/career/documents", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          candidate_id: createdCandidate.id,
          source_type: "cv",
          title: "Pasted CV",
          content_text: cvText,
        }),
      })

      const saveDocJson = await saveDocRes.json()

      if (!saveDocRes.ok) {
        throw new Error(saveDocJson.error || "Failed to save document")
      }

      const generateProfileRes = await fetch("/api/career/generate-profile", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          candidate_id: createdCandidate.id,
        }),
      })

      const generateProfileJson = await generateProfileRes.json()

      if (!generateProfileRes.ok) {
        throw new Error(generateProfileJson.error || "Failed to generate profile")
      }

      setProfile(generateProfileJson.profile as Profile)
      setMessage("Career identity generated successfully.")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong"
      setMessage(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold">Career Module Test</h1>
          <p className="mt-2 text-sm text-neutral-600">
            First slice: create candidate, save CV, generate career identity.
          </p>
          <div className="mt-4 rounded-2xl border border-neutral-200 bg-white px-4 py-4 text-sm text-neutral-700">
            <div className="font-medium">
              {session?.user ? `Signed in as ${session.user.email ?? "current user"}` : "Not signed in"}
            </div>
            <p className="mt-1 text-neutral-600">
              {session?.user
                ? "You can run the career test flow now."
                : "This page uses authenticated career routes. Sign in on the main Persona Foundry page before testing."}
            </p>
            {!session?.user ? (
              <Link href="/" className="mt-3 inline-flex rounded-xl border border-neutral-300 px-3 py-2 font-medium hover:bg-neutral-50">
                Go to sign-in page
              </Link>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Candidate Input</h2>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Full name</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
                  placeholder="Nigel Smith"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">City</label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
                  placeholder="Auckland"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">CV text</label>
                <textarea
                  value={cvText}
                  onChange={(e) => setCvText(e.target.value)}
                  className="min-h-[320px] w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
                  placeholder="Paste CV, LinkedIn bio, or notes here..."
                />
              </div>

              <button
                onClick={handleCreateAndAnalyze}
                disabled={loading || !fullName.trim() || !cvText.trim()}
                className="rounded-xl bg-black px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Generating..." : "Create Candidate and Generate Profile"}
              </button>

              {message ? <p className="text-sm text-neutral-700">{message}</p> : null}
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Generated Profile</h2>

            {!profile ? (
              <p className="mt-4 text-sm text-neutral-600">
                Your generated career identity will appear here.
              </p>
            ) : (
              <div className="mt-4 space-y-5">
                {candidate ? (
                  <div className="rounded-xl bg-neutral-50 p-4">
                    <div className="text-sm text-neutral-500">Candidate</div>
                    <div className="font-medium">{candidate.full_name || "Untitled"}</div>
                    <div className="text-sm text-neutral-600">{candidate.city || "No city"}</div>
                  </div>
                ) : null}

                <div>
                  <div className="text-sm text-neutral-500">Career identity</div>
                  <div className="mt-1 text-lg font-semibold">{profile.career_identity}</div>
                </div>

                <div>
                  <div className="text-sm text-neutral-500">Market positioning</div>
                  <p className="mt-1 text-sm leading-6 text-neutral-800">{profile.market_positioning}</p>
                </div>

                <div>
                  <div className="text-sm text-neutral-500">Seniority level</div>
                  <div className="mt-1">{profile.seniority_level}</div>
                </div>

                <ListBlock title="Core strengths" items={profile.core_strengths} />
                <ListBlock title="Signature achievements" items={profile.signature_achievements} />
                <ListBlock title="Role families" items={profile.role_families} />
                <ListBlock title="Skills" items={profile.skills} />
                <ListBlock title="Risks or gaps" items={profile.risks_or_gaps} />
                <ListBlock title="Recommended target roles" items={profile.recommended_target_roles} />
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}

function ListBlock({ title, items }: { title: string; items: string[] | null | undefined }) {
  if (!items || items.length === 0) return null

  return (
    <div>
      <div className="text-sm text-neutral-500">{title}</div>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-800">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
