import { NextResponse } from "next/server"
import { createAdminClient, getAdminCapabilities } from "@/lib/admin"
import { getRequestAuth } from "@/lib/supabase/auth"
import { logUsageEvent } from "@/lib/telemetry"

type OutreachPayload = {
  audience_status?: "all" | "open" | "in_review" | "resolved"
  audience_module?: string
  subject?: string
  message?: string
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export async function GET(request: Request) {
  const { user, errorMessage } = await getRequestAuth(request)
  if (!user) {
    return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
  }

  const capabilities = await getAdminCapabilities({ userId: user.id, email: user.email })
  if (!capabilities.isSuperuser) {
    return NextResponse.json({ error: "Superuser access required." }, { status: 403 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 })
  }

  const { data, error } = await admin
    .from("tester_feedback_outreach")
    .select("id, sent_by_email, audience_status, audience_module, recipient_count, subject, message, created_at")
    .order("created_at", { ascending: false })
    .limit(30)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ campaigns: data ?? [] })
}

export async function POST(request: Request) {
  const { user, errorMessage } = await getRequestAuth(request)
  if (!user) {
    return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
  }

  const capabilities = await getAdminCapabilities({ userId: user.id, email: user.email })
  if (!capabilities.isSuperuser) {
    return NextResponse.json({ error: "Superuser access required." }, { status: 403 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 })
  }

  let payload: OutreachPayload = {}
  try {
    payload = (await request.json()) as OutreachPayload
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 })
  }

  const audienceStatus =
    payload.audience_status === "open" || payload.audience_status === "in_review" || payload.audience_status === "resolved"
      ? payload.audience_status
      : "all"
  const audienceModule = normalizeText(payload.audience_module) || null
  const subject = normalizeText(payload.subject)
  const message = normalizeText(payload.message)

  if (!subject || !message) {
    return NextResponse.json({ error: "Subject and message are required." }, { status: 400 })
  }

  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    return NextResponse.json({ error: "RESEND_API_KEY is not configured." }, { status: 500 })
  }

  let notesQuery = admin.from("tester_feedback_notes").select("user_email, status, module")
  if (audienceStatus !== "all") {
    notesQuery = notesQuery.eq("status", audienceStatus)
  }
  if (audienceModule) {
    notesQuery = notesQuery.eq("module", audienceModule)
  }

  const { data: noteRows, error: notesError } = await notesQuery.limit(1000)
  if (notesError) {
    return NextResponse.json({ error: notesError.message }, { status: 400 })
  }

  const recipients = Array.from(
    new Set((noteRows ?? []).map((row) => (row.user_email || "").trim().toLowerCase()).filter((email) => email && isValidEmail(email)))
  )

  if (recipients.length === 0) {
    return NextResponse.json({ error: "No eligible tester emails found for this audience." }, { status: 400 })
  }

  const fromEmail = process.env.CONTACT_FROM_EMAIL || "Personara <onboarding@resend.dev>"
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000")
  const appLink = `${siteUrl.replace(/\/$/, "")}/platform`
  const html = `
    <h2>Personara tester update</h2>
    <p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>
    <p><a href="${appLink}">Open Personara</a></p>
  `

  let sentCount = 0
  for (const recipient of recipients.slice(0, 200)) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipient],
        subject,
        html,
      }),
    })
    if (response.ok) {
      sentCount += 1
    }
  }

  const { data: campaign, error: campaignError } = await admin
    .from("tester_feedback_outreach")
    .insert([
      {
        sent_by_user_id: user.id,
        sent_by_email: user.email ?? null,
        audience_status: audienceStatus,
        audience_module: audienceModule,
        recipient_count: sentCount,
        subject,
        message,
      },
    ])
    .select("id, sent_by_email, audience_status, audience_module, recipient_count, subject, message, created_at")
    .single()

  if (campaignError) {
    return NextResponse.json({ error: campaignError.message }, { status: 400 })
  }

  await logUsageEvent(admin, {
    userId: user.id,
    module: "admin",
    eventType: "tester_feedback_outreach_sent",
    metadata: {
      audience_status: audienceStatus,
      audience_module: audienceModule,
      recipient_count: sentCount,
      campaign_id: campaign.id,
    },
  })

  return NextResponse.json({ campaign, recipients_attempted: recipients.length, recipients_sent: sentCount })
}

