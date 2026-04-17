import { NextResponse } from "next/server"

type ContactPayload = {
  name?: string
  email?: string
  company?: string
  topic?: string
  message?: string
}

const CONTACT_TO_EMAIL = "johnliamferguson@gmail.com"

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export async function POST(request: Request) {
  let payload: ContactPayload
  try {
    payload = (await request.json()) as ContactPayload
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 })
  }

  const name = text(payload.name)
  const email = text(payload.email)
  const company = text(payload.company)
  const topic = text(payload.topic) || "General enquiry"
  const message = text(payload.message)

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Name, email, and message are required." }, { status: 400 })
  }

  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    return NextResponse.json(
      { error: "Contact form is not configured yet. Add RESEND_API_KEY to enable sending." },
      { status: 500 }
    )
  }

  const fromEmail = process.env.CONTACT_FROM_EMAIL || "Personara <onboarding@resend.dev>"
  const subject = `Personara contact: ${topic}`
  const html = `
    <h2>New Personara Contact Enquiry</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Company:</strong> ${escapeHtml(company || "Not provided")}</p>
    <p><strong>Topic:</strong> ${escapeHtml(topic)}</p>
    <p><strong>Message:</strong></p>
    <p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>
  `

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [CONTACT_TO_EMAIL],
      reply_to: email,
      subject,
      html,
    }),
  })

  if (!resendResponse.ok) {
    const responseText = await resendResponse.text()
    return NextResponse.json(
      { error: `Unable to send email. ${responseText || "Please try again later."}` },
      { status: 502 }
    )
  }

  return NextResponse.json({ message: "Message sent successfully." })
}
