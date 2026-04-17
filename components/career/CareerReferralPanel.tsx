"use client"

import { useEffect, useState, type FormEvent } from "react"
import { getAuthHeaders, toCareerUserMessage } from "@/lib/career-client"

type ReferralRow = {
  id: string
  invitee_email: string
  invitee_name: string | null
  relationship: string | null
  note: string | null
  status: string
  sent_at: string | null
  created_at: string | null
}

export function CareerReferralPanel() {
  const [inviteeName, setInviteeName] = useState("")
  const [inviteeEmail, setInviteeEmail] = useState("")
  const [relationship, setRelationship] = useState("friend")
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [referrals, setReferrals] = useState<ReferralRow[]>([])

  useEffect(() => {
    async function loadReferrals() {
      try {
        const response = await fetch("/api/referrals", {
          headers: await getAuthHeaders(),
        })
        const json = await response.json()
        if (!response.ok) {
          throw new Error(json.error || "Failed to load referrals")
        }
        setReferrals((json.referrals ?? []) as ReferralRow[])
      } catch {
        setReferrals([])
      }
    }

    void loadReferrals()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage("")

    try {
      const response = await fetch("/api/referrals", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invitee_name: inviteeName,
          invitee_email: inviteeEmail,
          relationship,
          note,
        }),
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to send invite")
      }

      const nextReferral = json.referral as ReferralRow
      setReferrals((current) => [nextReferral, ...current].slice(0, 20))
      setInviteeName("")
      setInviteeEmail("")
      setRelationship("friend")
      setNote("")
      setMessage(json.email_sent ? "Invite sent successfully." : "Invite saved. Email delivery is not configured yet.")
    } catch (error) {
      setMessage(toCareerUserMessage(error instanceof Error ? error.message : null))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">Refer a friend or business partner</h3>
          <p className="mt-1 text-sm text-neutral-600">Invite people directly into Personara Career Intelligence with a personal note.</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-right">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Recent invites</div>
          <div className="mt-0.5 text-lg font-semibold text-neutral-900">{referrals.length}</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Name (optional)</label>
          <input
            value={inviteeName}
            onChange={(event) => setInviteeName(event.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
            placeholder="Sam Taylor"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Email</label>
          <input
            value={inviteeEmail}
            onChange={(event) => setInviteeEmail(event.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
            placeholder="sam@example.com"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Relationship</label>
          <select
            value={relationship}
            onChange={(event) => setRelationship(event.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="friend">Friend</option>
            <option value="business_partner">Business partner</option>
            <option value="colleague">Colleague</option>
            <option value="client">Client</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Personal note (optional)</label>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
            placeholder="Thought this would help your next move."
          />
        </div>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={loading || !inviteeEmail.trim()}
            className="rounded-xl border border-[#0a66c2] bg-[#0a66c2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#004182] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Sending invite..." : "Send invite"}
          </button>
        </div>
      </form>

      {message ? <p className="mt-3 text-sm text-neutral-700">{message}</p> : null}

      {referrals.length > 0 ? (
        <div className="mt-4 space-y-2">
          {referrals.slice(0, 5).map((referral) => (
            <div key={referral.id} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium text-neutral-900">{referral.invitee_name || referral.invitee_email}</div>
                <span className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
                  {referral.status}
                </span>
              </div>
              <div className="mt-1 text-xs text-neutral-600">
                {referral.invitee_email} | {referral.relationship || "friend"} |{" "}
                {referral.created_at ? new Date(referral.created_at).toLocaleString() : "Unknown"}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
