import { NextResponse } from "next/server"
import { createAdminClient, getAdminCapabilities } from "@/lib/admin"
import { sendCriticalMarketingAlertEmail } from "@/lib/marketing-alert-email"
import { getRequestAuth } from "@/lib/supabase/auth"

type CreateRecommendationPayload = {
  entity_type?: string
  entity_id?: string
  recommendation_type?: string
  reason_codes?: string[]
  metric_snapshot?: Record<string, unknown>
  proposed_change?: Record<string, unknown>
}

type UpdateRecommendationPayload = {
  id?: string
  action?: "approve" | "reject" | "apply"
  rejection_note?: string
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

async function checkAdmin(request: Request, options?: { requireSuperuser?: boolean }) {
  const { user, errorMessage } = await getRequestAuth(request)
  if (!user) {
    return { error: NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 }), user: null, admin: null }
  }

  const capabilities = await getAdminCapabilities({ userId: user.id, email: user.email })
  const requireSuperuser = options?.requireSuperuser === true
  if (requireSuperuser ? !capabilities.isSuperuser : !capabilities.isAdmin) {
    return {
      error: NextResponse.json(
        { error: requireSuperuser ? "Superuser access required" : "Admin access required" },
        { status: 403 }
      ),
      user: null,
      admin: null,
    }
  }

  const admin = createAdminClient()
  if (!admin) {
    return { error: NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 }), user: null, admin: null }
  }

  return { error: null, user, admin }
}

async function writeAudit(params: {
  admin: ReturnType<typeof createAdminClient>
  userId: string
  userEmail: string | null | undefined
  actionType: string
  entityType: string
  entityId: string
  metadata?: Record<string, unknown>
}) {
  if (!params.admin) return
  await params.admin.from("mkt_audit_log").insert([
    {
      actor_user_id: params.userId,
      actor_email: params.userEmail ?? null,
      action_type: params.actionType,
      entity_type: params.entityType,
      entity_id: params.entityId,
      metadata_json: params.metadata ?? {},
    },
  ])
}

export async function GET(request: Request) {
  const auth = await checkAdmin(request)
  if (auth.error) return auth.error

  const [{ data: recommendations, error: recommendationsError }, { data: approvals, error: approvalsError }, { data: audit, error: auditError }] = await Promise.all([
    auth.admin
      .from("mkt_recommendations")
      .select(
        "id, entity_type, entity_id, recommendation_type, reason_codes_json, metric_snapshot_json, proposed_change_json, status, created_by_email, approved_by_email, approved_at, applied_at, rejected_at, rejection_note, created_at, updated_at"
      )
      .order("created_at", { ascending: false })
      .limit(150),
    auth.admin
      .from("mkt_approvals")
      .select("id, recommendation_id, decision, decision_note, requested_by_email, assigned_to_email, decided_at, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(150),
    auth.admin
      .from("mkt_audit_log")
      .select("id, actor_email, action_type, entity_type, entity_id, metadata_json, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ])

  if (recommendationsError) return NextResponse.json({ error: recommendationsError.message }, { status: 400 })
  if (approvalsError) return NextResponse.json({ error: approvalsError.message }, { status: 400 })
  if (auditError) return NextResponse.json({ error: auditError.message }, { status: 400 })

  return NextResponse.json({
    recommendations: recommendations ?? [],
    approvals: approvals ?? [],
    audit: audit ?? [],
  })
}

export async function POST(request: Request) {
  const auth = await checkAdmin(request, { requireSuperuser: true })
  if (auth.error) return auth.error

  let payload: CreateRecommendationPayload = {}
  try {
    payload = (await request.json()) as CreateRecommendationPayload
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 })
  }

  const entityType = text(payload.entity_type) || "campaign"
  const entityId = text(payload.entity_id) || null
  const recommendationType = text(payload.recommendation_type)
  const reasonCodes = Array.isArray(payload.reason_codes) ? payload.reason_codes.map((item) => text(item)).filter(Boolean) : []
  const metricSnapshot = payload.metric_snapshot && typeof payload.metric_snapshot === "object" ? payload.metric_snapshot : {}
  const proposedChange = payload.proposed_change && typeof payload.proposed_change === "object" ? payload.proposed_change : {}

  if (!recommendationType) {
    return NextResponse.json({ error: "recommendation_type is required." }, { status: 400 })
  }

  const { data: recommendation, error: recommendationError } = await auth.admin
    .from("mkt_recommendations")
    .insert([
      {
        entity_type: entityType,
        entity_id: entityId,
        recommendation_type: recommendationType,
        reason_codes_json: reasonCodes,
        metric_snapshot_json: metricSnapshot,
        proposed_change_json: proposedChange,
        status: "proposed",
        created_by_user_id: auth.user.id,
        created_by_email: auth.user.email ?? null,
      },
    ])
    .select(
      "id, entity_type, entity_id, recommendation_type, reason_codes_json, metric_snapshot_json, proposed_change_json, status, created_by_email, approved_by_email, approved_at, applied_at, rejected_at, rejection_note, created_at, updated_at"
    )
    .single()

  if (recommendationError || !recommendation) {
    return NextResponse.json({ error: recommendationError?.message || "Failed to create recommendation." }, { status: 400 })
  }

  const { data: approval, error: approvalError } = await auth.admin
    .from("mkt_approvals")
    .insert([
      {
        recommendation_id: recommendation.id,
        requested_by_user_id: auth.user.id,
        requested_by_email: auth.user.email ?? null,
        assigned_to_user_id: auth.user.id,
        assigned_to_email: auth.user.email ?? null,
        decision: "pending",
      },
    ])
    .select("id, recommendation_id, decision, decision_note, requested_by_email, assigned_to_email, decided_at, created_at, updated_at")
    .single()

  if (approvalError) {
    return NextResponse.json({ error: approvalError.message }, { status: 400 })
  }

  await writeAudit({
    admin: auth.admin,
    userId: auth.user.id,
    userEmail: auth.user.email,
    actionType: "recommendation_created",
    entityType: "mkt_recommendation",
    entityId: recommendation.id,
    metadata: { recommendation_type: recommendationType, entity_type: entityType, entity_id: entityId },
  })

  // Policy safety checks on proposed campaign changes.
  if (entityType === "campaign" && entityId) {
    const proposedBudget = Number((proposedChange as Record<string, unknown>).daily_budget ?? Number.NaN)
    if (Number.isFinite(proposedBudget)) {
      const [{ data: latestPolicy }, { data: latestSnapshot }] = await Promise.all([
        auth.admin
          .from("mkt_policy_settings")
          .select("max_weekly_spend, reserve_floor_amount")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        auth.admin
          .from("mkt_budget_snapshots")
          .select("safe_budget_daily, reserve_status")
          .order("computed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      const maxDailyFromPolicy = Number(latestPolicy?.max_weekly_spend ?? 0) > 0 ? Number(latestPolicy?.max_weekly_spend ?? 0) / 7 : null
      const safeDaily = Number(latestSnapshot?.safe_budget_daily ?? Number.NaN)

      let breachMessage: string | null = null
      let severity: "watch" | "critical" = "watch"

      if (maxDailyFromPolicy !== null && proposedBudget > maxDailyFromPolicy) {
        breachMessage = `Proposed daily budget ${proposedBudget.toFixed(2)} is above policy daily max ${maxDailyFromPolicy.toFixed(2)}.`
        severity = "critical"
      } else if (Number.isFinite(safeDaily) && proposedBudget > safeDaily) {
        breachMessage = `Proposed daily budget ${proposedBudget.toFixed(2)} is above latest safe daily budget ${safeDaily.toFixed(2)}.`
        severity = latestSnapshot?.reserve_status === "critical" ? "critical" : "watch"
      }

      if (breachMessage) {
        const { data: createdAlert } = await auth.admin.from("mkt_alerts").insert([
          {
            alert_type: "policy_breach_risk",
            severity,
            message: breachMessage,
            related_entity_type: "mkt_recommendation",
            related_entity_id: recommendation.id,
            status: "open",
            metadata_json: {
              campaign_id: entityId,
              recommendation_id: recommendation.id,
              proposed_daily_budget: proposedBudget,
              max_daily_from_policy: maxDailyFromPolicy,
              safe_daily_from_snapshot: Number.isFinite(safeDaily) ? safeDaily : null,
              reserve_floor_amount: Number(latestPolicy?.reserve_floor_amount ?? 0),
              reserve_status: latestSnapshot?.reserve_status ?? null,
            },
            created_by_user_id: auth.user.id,
            created_by_email: auth.user.email ?? null,
          },
        ]).select("id").maybeSingle()

        const emailResult = await sendCriticalMarketingAlertEmail({
          severity,
          alertType: "policy_breach_risk",
          message: breachMessage,
          recommendationId: recommendation.id,
          campaignId: entityId,
          actorEmail: auth.user.email ?? null,
        })

        if (createdAlert?.id) {
          await auth.admin
            .from("mkt_alerts")
            .update({
              metadata_json: {
                campaign_id: entityId,
                recommendation_id: recommendation.id,
                proposed_daily_budget: proposedBudget,
                max_daily_from_policy: maxDailyFromPolicy,
                safe_daily_from_snapshot: Number.isFinite(safeDaily) ? safeDaily : null,
                reserve_floor_amount: Number(latestPolicy?.reserve_floor_amount ?? 0),
                reserve_status: latestSnapshot?.reserve_status ?? null,
                email_sent: emailResult.sent,
                email_reason: "reason" in emailResult ? emailResult.reason : null,
              },
            })
            .eq("id", createdAlert.id)
        }

        await writeAudit({
          admin: auth.admin,
          userId: auth.user.id,
          userEmail: auth.user.email,
          actionType: "policy_breach_alert_created",
          entityType: "mkt_alert",
          entityId: createdAlert?.id || recommendation.id,
          metadata: {
            severity,
            email_sent: emailResult.sent,
            email_reason: "reason" in emailResult ? emailResult.reason : null,
            recommendation_id: recommendation.id,
          },
        })
      }
    }
  }

  return NextResponse.json({ recommendation, approval })
}

export async function PATCH(request: Request) {
  const auth = await checkAdmin(request, { requireSuperuser: true })
  if (auth.error) return auth.error

  let payload: UpdateRecommendationPayload = {}
  try {
    payload = (await request.json()) as UpdateRecommendationPayload
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 })
  }

  const id = text(payload.id)
  const action = payload.action

  if (!id || !action) {
    return NextResponse.json({ error: "id and action are required." }, { status: 400 })
  }

  const { data: existing, error: existingError } = await auth.admin
    .from("mkt_recommendations")
    .select("id, status, entity_type, entity_id, proposed_change_json")
    .eq("id", id)
    .maybeSingle()

  if (existingError || !existing) {
    return NextResponse.json({ error: existingError?.message || "Recommendation not found." }, { status: 404 })
  }

  if (action === "approve") {
    const { data, error } = await auth.admin
      .from("mkt_recommendations")
      .update({
        status: "approved",
        approved_by_user_id: auth.user.id,
        approved_by_email: auth.user.email ?? null,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(
        "id, entity_type, entity_id, recommendation_type, reason_codes_json, metric_snapshot_json, proposed_change_json, status, created_by_email, approved_by_email, approved_at, applied_at, rejected_at, rejection_note, created_at, updated_at"
      )
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await auth.admin
      .from("mkt_approvals")
      .update({
        decision: "approved",
        decision_note: null,
        decided_at: new Date().toISOString(),
      })
      .eq("recommendation_id", id)
      .eq("decision", "pending")

    await writeAudit({
      admin: auth.admin,
      userId: auth.user.id,
      userEmail: auth.user.email,
      actionType: "recommendation_approved",
      entityType: "mkt_recommendation",
      entityId: id,
    })

    return NextResponse.json({ recommendation: data })
  }

  if (action === "reject") {
    const rejectionNote = text(payload.rejection_note) || null

    const { data, error } = await auth.admin
      .from("mkt_recommendations")
      .update({
        status: "rejected",
        rejected_at: new Date().toISOString(),
        rejection_note: rejectionNote,
      })
      .eq("id", id)
      .select(
        "id, entity_type, entity_id, recommendation_type, reason_codes_json, metric_snapshot_json, proposed_change_json, status, created_by_email, approved_by_email, approved_at, applied_at, rejected_at, rejection_note, created_at, updated_at"
      )
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await auth.admin
      .from("mkt_approvals")
      .update({
        decision: "rejected",
        decision_note: rejectionNote,
        decided_at: new Date().toISOString(),
      })
      .eq("recommendation_id", id)
      .eq("decision", "pending")

    await writeAudit({
      admin: auth.admin,
      userId: auth.user.id,
      userEmail: auth.user.email,
      actionType: "recommendation_rejected",
      entityType: "mkt_recommendation",
      entityId: id,
      metadata: { rejection_note: rejectionNote },
    })

    return NextResponse.json({ recommendation: data })
  }

  if (action === "apply") {
    if (existing.status !== "approved") {
      return NextResponse.json({ error: "Only approved recommendations can be applied." }, { status: 400 })
    }

    const proposedChange = existing.proposed_change_json && typeof existing.proposed_change_json === "object"
      ? (existing.proposed_change_json as Record<string, unknown>)
      : {}

    if (existing.entity_type === "campaign" && existing.entity_id) {
      const campaignUpdates: Record<string, unknown> = {}
      if (proposedChange.daily_budget !== undefined) {
        const budget = Number(proposedChange.daily_budget)
        if (Number.isFinite(budget) && budget >= 0) campaignUpdates.daily_budget = budget
      }
      if (proposedChange.status !== undefined) {
        const status = text(proposedChange.status)
        if (status) campaignUpdates.status = status
      }

      if (Object.keys(campaignUpdates).length > 0) {
        const { error: campaignUpdateError } = await auth.admin
          .from("mkt_campaigns")
          .update(campaignUpdates)
          .eq("id", existing.entity_id)

        if (campaignUpdateError) {
          return NextResponse.json({ error: campaignUpdateError.message }, { status: 400 })
        }
      }
    }

    const { data, error } = await auth.admin
      .from("mkt_recommendations")
      .update({
        status: "applied",
        applied_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(
        "id, entity_type, entity_id, recommendation_type, reason_codes_json, metric_snapshot_json, proposed_change_json, status, created_by_email, approved_by_email, approved_at, applied_at, rejected_at, rejection_note, created_at, updated_at"
      )
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await writeAudit({
      admin: auth.admin,
      userId: auth.user.id,
      userEmail: auth.user.email,
      actionType: "recommendation_applied",
      entityType: "mkt_recommendation",
      entityId: id,
      metadata: { entity_type: existing.entity_type, entity_id: existing.entity_id, proposed_change: proposedChange },
    })

    return NextResponse.json({ recommendation: data })
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 })
}
