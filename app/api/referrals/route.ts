import { NextResponse } from "next/server"
import { getRequestAuth } from "@/lib/supabase/auth"
import { createRouteClient } from "@/lib/supabase/route"
import { logUsageEvent } from "@/lib/telemetry"

type ReferralPayload = {
  invitee_email?: string
  invitee_name?: string
  relationship?: string
  note?: string
}

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeEmail(value: unknown) {
  return normalize(value).toLowerCase()
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isMissingReferralTableError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? ""
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    (message.includes("referral_invites") && (message.includes("schema cache") || message.includes("does not exist")))
  )
}

export async function GET(request: Request) {
  const { user, accessToken, errorMessage } = await getRequestAuth(request)

  if (!user) {
    return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
  }

  const supabase = createRouteClient(accessToken ?? undefined)

  const { data, error } = await supabase
    .from("referral_invites")
    .select("id, invitee_email, invitee_name, relationship, note, status, sent_at, created_at")
    .eq("inviter_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) {
    if (isMissingReferralTableError(error)) {
      return NextResponse.json({ referrals: [], unavailable: true })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ referrals: data ?? [] })
}

export async function POST(request: Request) {
  const { user, accessToken, errorMessage } = await getRequestAuth(request)

  if (!user) {
    return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
  }

  const supabase = createRouteClient(accessToken ?? undefined)
  let body: ReferralPayload = {}

  try {
    body = (await request.json()) as ReferralPayload
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 })
  }

  const inviteeEmail = normalizeEmail(body.invitee_email)
  const inviteeName = normalize(body.invitee_name)
  const relationship = normalize(body.relationship) || "friend"
  const note = normalize(body.note)

  if (!inviteeEmail || !isValidEmail(inviteeEmail)) {
    return NextResponse.json({ error: "A valid invitee email is required." }, { status: 400 })
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  const inviterEmail = authUser?.email ?? user.email ?? null

  const referralInsert = {
    inviter_user_id: user.id,
    inviter_email: inviterEmail,
    invitee_email: inviteeEmail,
    invitee_name: inviteeName || null,
    relationship,
    note: note || null,
  }

  const { data: savedReferral, error } = await supabase
    .from("referral_invites")
    .insert([referralInsert])
    .select("id, invitee_email, invitee_name, relationship, note, status, sent_at, created_at")
    .single()

  let inviteSaved = true
  let referral =
    savedReferral ??
    ({
      id: null,
      invitee_email: inviteeEmail,
      invitee_name: inviteeName || null,
      relationship,
      note: note || null,
      status: "not_saved",
      sent_at: null,
      created_at: new Date().toISOString(),
    } as const)

  if (error) {
    if (isMissingReferralTableError(error)) {
      inviteSaved = false
    } else {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
  }

  if (!referral) {
    return NextResponse.json({ error: "Could not prepare referral invite." }, { status: 400 })
  }

  let emailSent = false
  const resendApiKey = process.env.RESEND_API_KEY
  if (resendApiKey) {
    const fromEmail = process.env.CONTACT_FROM_EMAIL || "Personara <onboarding@resend.dev>"
    const toName = inviteeName || "there"
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
    const inviteUrl = `${baseUrl}/career-intelligence`
    const subject = `${inviterEmail || "A Personara user"} invited you to Personara Career Intelligence`
    const html = `
      <h2>You were invited to Personara</h2>
      <p>Hello ${toName},</p>
      <p>${inviterEmail || "A Personara user"} invited you to explore Personara Career Intelligence.</p>
      ${note ? `<p><strong>Personal note:</strong> ${note.replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</p>` : ""}
      <p><a href="${inviteUrl}">Open Personara Career Intelligence</a></p>
      <p>Relationship: ${relationship}</p>
    `

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [inviteeEmail],
        reply_to: inviterEmail ?? undefined,
        subject,
        html,
      }),
    })

    if (resendResponse.ok) {
      emailSent = true
      if (inviteSaved && referral.id) {
        await supabase.from("referral_invites").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", referral.id)
      }
    }
  }

  await logUsageEvent(supabase, {
    userId: user.id,
    module: "platform",
    eventType: "referral_invite_created",
    metadata: {
      invitee_email: inviteeEmail,
      relationship,
      email_sent: emailSent,
      invite_saved: inviteSaved,
    },
  })

  return NextResponse.json({
    referral: {
      ...referral,
      status: emailSent ? "sent" : referral.status,
      sent_at: emailSent ? new Date().toISOString() : referral.sent_at,
    },
    email_sent: emailSent,
    invite_saved: inviteSaved,
    fallback_required: !emailSent && !inviteSaved,
  })
}
