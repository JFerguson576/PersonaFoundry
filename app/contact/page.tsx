"use client"

import { useState } from "react"
import type { FormEvent } from "react"
import Link from "next/link"
import { PlatformModuleNav } from "@/components/navigation/PlatformModuleNav"

export default function ContactPage() {
  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactCompany, setContactCompany] = useState("")
  const [contactTopic, setContactTopic] = useState("General enquiry")
  const [contactMessage, setContactMessage] = useState("")
  const [contactStatus, setContactStatus] = useState("")
  const [contactBusy, setContactBusy] = useState(false)

  async function handleContactSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!contactName.trim() || !contactEmail.trim() || !contactMessage.trim()) {
      setContactStatus("Please complete name, email, and message.")
      return
    }

    setContactBusy(true)
    setContactStatus("")

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contactName.trim(),
          email: contactEmail.trim(),
          company: contactCompany.trim(),
          topic: contactTopic.trim(),
          message: contactMessage.trim(),
        }),
      })

      const payload = (await response.json()) as { error?: string; message?: string }
      if (!response.ok) {
        setContactStatus(payload.error || "Unable to send your enquiry right now.")
        return
      }

      setContactStatus(payload.message || "Thanks. Your message has been sent.")
      setContactName("")
      setContactEmail("")
      setContactCompany("")
      setContactTopic("General enquiry")
      setContactMessage("")
    } catch {
      setContactStatus("Unable to send your enquiry right now.")
    } finally {
      setContactBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f8fc] text-[#0f172a]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <PlatformModuleNav />

        <section className="rounded-3xl border border-[#d8e4f2] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748b]">Personara</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#0f172a]">Contact</h1>
              <p className="mt-2 text-sm text-[#475569]">
                Send partnerships, enterprise, support, or general enquiries to the Personara team.
              </p>
            </div>
            <Link
              href="/platform"
              className="inline-flex items-center rounded-xl border border-[#d8e4f2] bg-white px-3.5 py-2 text-sm font-semibold text-[#334155] hover:bg-[#f8fbff]"
            >
              Back to Overview
            </Link>
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-[#d8e4f2] bg-white p-5 shadow-sm">
          <form onSubmit={handleContactSubmit} className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Name</span>
              <input
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
                className="mt-1 w-full rounded-xl border border-[#d8e4f2] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none ring-[#0a66c2] focus:ring-2"
                placeholder="Your full name"
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Email</span>
              <input
                type="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                className="mt-1 w-full rounded-xl border border-[#d8e4f2] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none ring-[#0a66c2] focus:ring-2"
                placeholder="you@company.com"
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Company (optional)</span>
              <input
                value={contactCompany}
                onChange={(event) => setContactCompany(event.target.value)}
                className="mt-1 w-full rounded-xl border border-[#d8e4f2] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none ring-[#0a66c2] focus:ring-2"
                placeholder="Company or organization"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Topic</span>
              <select
                value={contactTopic}
                onChange={(event) => setContactTopic(event.target.value)}
                className="mt-1 w-full rounded-xl border border-[#d8e4f2] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none ring-[#0a66c2] focus:ring-2"
              >
                <option>General enquiry</option>
                <option>Sales and pricing</option>
                <option>Enterprise partnership</option>
                <option>Product support</option>
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Message</span>
              <textarea
                value={contactMessage}
                onChange={(event) => setContactMessage(event.target.value)}
                className="mt-1 min-h-[160px] w-full rounded-xl border border-[#d8e4f2] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none ring-[#0a66c2] focus:ring-2"
                placeholder="How can we help?"
                required
              />
            </label>
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={contactBusy}
                className="inline-flex items-center rounded-xl bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {contactBusy ? "Sending..." : "Send message"}
              </button>
              {contactStatus ? <p className="text-sm text-[#334155]">{contactStatus}</p> : null}
            </div>
          </form>
        </section>
      </div>
    </main>
  )
}
