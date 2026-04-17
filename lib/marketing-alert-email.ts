type MarketingAlertEmailParams = {
  severity: "watch" | "critical" | "info" | string
  alertType: string
  message: string
  recommendationId: string
  campaignId?: string | null
  actorEmail?: string | null
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export async function sendCriticalMarketingAlertEmail(params: MarketingAlertEmailParams) {
  if (params.severity !== "critical") {
    return { sent: false, reason: "not_critical" as const }
  }

  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    return { sent: false, reason: "resend_not_configured" as const }
  }

  const toEmail =
    process.env.MARKETING_ALERT_TO_EMAIL ||
    process.env.CONTACT_TO_EMAIL ||
    "johnliamferguson@gmail.com"

  const fromEmail = process.env.CONTACT_FROM_EMAIL || "Personara <onboarding@resend.dev>"
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  const engineUrl = `${baseUrl}/control-center/marketing-engine`

  const subject = `Personara Critical Alert: ${params.alertType.replaceAll("_", " ")}`
  const html = `
    <h2>Critical Marketing Engine Alert</h2>
    <p><strong>Severity:</strong> ${escapeHtml(params.severity)}</p>
    <p><strong>Type:</strong> ${escapeHtml(params.alertType)}</p>
    <p><strong>Message:</strong> ${escapeHtml(params.message)}</p>
    <p><strong>Recommendation ID:</strong> ${escapeHtml(params.recommendationId)}</p>
    <p><strong>Campaign ID:</strong> ${escapeHtml(params.campaignId || "N/A")}</p>
    <p><strong>Triggered by:</strong> ${escapeHtml(params.actorEmail || "Unknown")}</p>
    <p><a href="${engineUrl}">Open Marketing Engine</a></p>
  `

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      subject,
      html,
    }),
  })

  if (!response.ok) {
    return { sent: false, reason: "provider_error" as const }
  }

  return { sent: true as const }
}
