import { NextResponse } from "next/server"
import { createAdminClient, getAdminCapabilities } from "@/lib/admin"
import { getRequestAuth } from "@/lib/supabase/auth"
import { logUsageEvent } from "@/lib/telemetry"

type OutreachPayload = {
  action?: "queue_from_teamsync" | "send_campaign"
  audience_status?: "queued" | "contacted" | "responded"
  audience_segment?: string
  subject?: string
  message?: string
  support_name?: string
  calendly_url?: string
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase()
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

async function checkSuperuser(request: Request) {
  const { user, errorMessage } = await getRequestAuth(request)
  if (!user) {
    return { error: NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 }), user: null, admin: null }
  }

  const capabilities = await getAdminCapabilities({ userId: user.id, email: user.email })
  if (!capabilities.isSuperuser) {
    return { error: NextResponse.json({ error: "Superuser access required." }, { status: 403 }), user: null, admin: null }
  }

  const admin = createAdminClient()
  if (!admin) {
    return { error: NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 }), user: null, admin: null }
  }

  return { error: null, user, admin }
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
  const auth = await checkSuperuser(request)
  if (auth.error) return auth.error

  const [{ data: queueRows, error: queueError }, { data: campaigns, error: campaignsError }] = await Promise.all([
    auth.admin
      .from("teamsync_outreach_queue")
      .select("id, user_id, user_email, user_name, segment, source, status, last_teamsync_event_at, last_contacted_at, next_action_at, notes, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(500),
    auth.admin
      .from("teamsync_outreach_campaigns")
      .select("id, created_by_email, audience_status, audience_segment, support_name, calendly_url, subject, message, recipient_count, sent_count, status, created_at")
      .order("created_at", { ascending: false })
      .limit(60),
  ])

  if (queueError) return NextResponse.json({ error: queueError.message }, { status: 400 })
  if (campaignsError) return NextResponse.json({ error: campaignsError.message }, { status: 400 })

  return NextResponse.json({ queue: queueRows ?? [], campaigns: campaigns ?? [] })
}

export async function POST(request: Request) {
  const auth = await checkSuperuser(request)
  if (auth.error) return auth.error

  let payload: OutreachPayload = {}
  try {
    payload = (await request.json()) as OutreachPayload
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 })
  }

  const action = payload.action
  if (!action) {
    return NextResponse.json({ error: "Action is required." }, { status: 400 })
  }

  if (action === "queue_from_teamsync") {
    const cutoffIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: events, error: eventsError } = await auth.admin
      .from("usage_events")
      .select("user_id, module, event_type, created_at")
      .gte("created_at", cutoffIso)
      .or("module.eq.teamsync,module.eq.teamsync_premium")
      .order("created_at", { ascending: false })
      .limit(4000)

    if (eventsError) {
      return NextResponse.json({ error: eventsError.message }, { status: 400 })
    }

    const latestByUser = new Map<string, { created_at: string; segment: string }>()
    for (const event of events ?? []) {
      if (!event.user_id || !event.created_at) continue
      if (latestByUser.has(event.user_id)) continue
      const eventType = normalizeText(event.event_type).toLowerCase()
      const segment =
        event.module === "teamsync_premium" || eventType.includes("executive") || eventType.includes("premium")
          ? "gallup_coach_or_exec"
          : "teamsync_user"
      latestByUser.set(event.user_id, { created_at: event.created_at, segment })
    }

    if (latestByUser.size === 0) {
      return NextResponse.json({ queued: 0, skipped: 0 })
    }

    const usersResponse = await auth.admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const users = usersResponse.data?.users ?? []
    const userMap = new Map(users.map((entry) => [entry.id, entry]))

    const upserts: Array<Record<string, unknown>> = []
    for (const [userId, entry] of latestByUser.entries()) {
      const authUser = userMap.get(userId)
      const email = normalizeEmail(authUser?.email)
      if (!email || !isValidEmail(email)) continue
      const metadata = (authUser?.user_metadata ?? {}) as Record<string, unknown>
      const fullName =
        (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
        (typeof metadata.name === "string" && metadata.name.trim()) ||
        null
      upserts.push({
        user_id: userId,
        user_email: email,
        user_name: fullName,
        segment: entry.segment,
        source: "usage_events",
        status: "queued",
        last_teamsync_event_at: entry.created_at,
        next_action_at: new Date().toISOString(),
      })
    }

    if (upserts.length > 0) {
      const { error: upsertError } = await auth.admin
        .from("teamsync_outreach_queue")
        .upsert(upserts, { onConflict: "user_id" })
      if (upsertError) {
        return NextResponse.json({ error: upsertError.message }, { status: 400 })
      }
    }

    await logUsageEvent(auth.admin, {
      userId: auth.user.id,
      module: "admin",
      eventType: "teamsync_outreach_queue_refreshed",
      metadata: {
        candidates_found: latestByUser.size,
        queued: upserts.length,
      },
    })

    return NextResponse.json({ queued: upserts.length, skipped: Math.max(0, latestByUser.size - upserts.length) })
  }

  const audienceStatus =
    payload.audience_status === "contacted" || payload.audience_status === "responded" ? payload.audience_status : "queued"
  const audienceSegment = normalizeText(payload.audience_segment) || "all"
  const subject = normalizeText(payload.subject)
  const message = normalizeText(payload.message)
  const supportName = normalizeText(payload.support_name)
  const calendlyUrl = normalizeText(payload.calendly_url)

  if (!subject || !message) {
    return NextResponse.json({ error: "Subject and message are required." }, { status: 400 })
  }

  let queueQuery = auth.admin
    .from("teamsync_outreach_queue")
    .select("id, user_id, user_email, user_name, segment, status")
    .eq("status", audienceStatus)
    .order("updated_at", { ascending: false })

  if (audienceSegment !== "all") {
    queueQuery = queueQuery.eq("segment", audienceSegment)
  }

  const { data: queueRows, error: queueError } = await queueQuery.limit(250)
  if (queueError) {
    return NextResponse.json({ error: queueError.message }, { status: 400 })
  }

  const recipients = (queueRows ?? []).filter((row) => isValidEmail(normalizeEmail(row.user_email)))
  if (recipients.length === 0) {
    return NextResponse.json({ error: "No eligible TeamSync outreach recipients found." }, { status: 400 })
  }

  const resendApiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.CONTACT_FROM_EMAIL || "Personara <onboarding@resend.dev>"
  const calendarLine = calendlyUrl ? `<p>Book time here: <a href="${calendlyUrl}">${calendlyUrl}</a></p>` : ""
  const signedBy = supportName || "Personara Support"
  const html = `
    <h2>Personara TeamSync support</h2>
    <p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>
    ${calendarLine}
    <p>Regards,<br />${escapeHtml(signedBy)}</p>
  `

  let sentCount = 0
  const attempted = recipients.length
  const eventRows: Array<Record<string, unknown>> = []

  for (const recipient of recipients) {
    let status = "skipped"
    let providerMessage = "RESEND_API_KEY not configured"
    if (resendApiKey) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [recipient.user_email],
          subject,
          html,
        }),
      })

      if (response.ok) {
        sentCount += 1
        status = "success"
        providerMessage = "sent"
      } else {
        status = "failed"
        providerMessage = `status_${response.status}`
      }
    }

    eventRows.push({
      campaign_id: null,
      queue_id: recipient.id,
      user_id: recipient.user_id,
      user_email: recipient.user_email,
      event_type: "email_sent",
      status,
      provider_message: providerMessage,
    })
  }

  const campaignStatus = resendApiKey ? "sent" : "draft"
  const { data: campaign, error: campaignError } = await auth.admin
    .from("teamsync_outreach_campaigns")
    .insert([
      {
        created_by_user_id: auth.user.id,
        created_by_email: auth.user.email ?? null,
        audience_status: audienceStatus,
        audience_segment: audienceSegment,
        support_name: supportName || null,
        calendly_url: calendlyUrl || null,
        subject,
        message,
        recipient_count: attempted,
        sent_count: sentCount,
        status: campaignStatus,
      },
    ])
    .select("id, created_by_email, audience_status, audience_segment, support_name, calendly_url, subject, message, recipient_count, sent_count, status, created_at")
    .single()

  if (campaignError) {
    return NextResponse.json({ error: campaignError.message }, { status: 400 })
  }

  if (eventRows.length > 0) {
    const withCampaign = eventRows.map((row) => ({ ...row, campaign_id: campaign.id }))
    await auth.admin.from("teamsync_outreach_events").insert(withCampaign)
  }

  if (sentCount > 0) {
    const contactedIds = recipients.map((row) => row.id)
    await auth.admin
      .from("teamsync_outreach_queue")
      .update({
        status: "contacted",
        last_contacted_at: new Date().toISOString(),
      })
      .in("id", contactedIds)
  }

  await logUsageEvent(auth.admin, {
    userId: auth.user.id,
    module: "admin",
    eventType: "teamsync_outreach_campaign_sent",
    metadata: {
      audience_status: audienceStatus,
      audience_segment: audienceSegment,
      recipient_count: attempted,
      sent_count: sentCount,
      campaign_id: campaign.id,
    },
  })

  return NextResponse.json({
    campaign,
    recipients_attempted: attempted,
    recipients_sent: sentCount,
    delivery_mode: resendApiKey ? "email" : "draft_only",
  })
}
