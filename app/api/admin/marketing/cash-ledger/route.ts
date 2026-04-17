import { NextResponse } from "next/server"
import { createAdminClient, getAdminCapabilities } from "@/lib/admin"
import { getRequestAuth } from "@/lib/supabase/auth"

type CashLedgerPayload = {
  source?: string
  event_type?: string
  amount?: number
  note?: string
  occurred_at?: string
}

function numeric(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export async function GET(request: Request) {
  const { user, errorMessage } = await getRequestAuth(request)
  if (!user) {
    return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
  }

  const capabilities = await getAdminCapabilities({ userId: user.id, email: user.email })
  if (!capabilities.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 })
  }

  const { data, error } = await admin
    .from("mkt_cash_ledger")
    .select("id, source, event_type, amount, note, occurred_at, entered_by_email, created_at")
    .order("occurred_at", { ascending: false })
    .limit(150)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const rows = data ?? []
  const cashOnHand = rows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0)
  const cashCollected7d = rows
    .filter((row) => {
      const occurred = row.occurred_at ? new Date(row.occurred_at).getTime() : 0
      return occurred >= Date.now() - 7 * 24 * 60 * 60 * 1000
    })
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0)

  return NextResponse.json({
    ledger: rows,
    totals: {
      cash_on_hand: Number(cashOnHand.toFixed(2)),
      cash_collected_7d: Number(cashCollected7d.toFixed(2)),
    },
  })
}

export async function POST(request: Request) {
  const { user, errorMessage } = await getRequestAuth(request)
  if (!user) {
    return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
  }

  const capabilities = await getAdminCapabilities({ userId: user.id, email: user.email })
  if (!capabilities.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 })
  }

  let payload: CashLedgerPayload
  try {
    payload = (await request.json()) as CashLedgerPayload
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 })
  }

  const source = text(payload.source) || "manual"
  const eventType = text(payload.event_type)
  const amount = numeric(payload.amount, 0)
  const note = text(payload.note) || null
  const occurredAt = text(payload.occurred_at)

  if (!eventType) {
    return NextResponse.json({ error: "event_type is required." }, { status: 400 })
  }
  if (!Number.isFinite(amount) || amount === 0) {
    return NextResponse.json({ error: "amount must be a non-zero number." }, { status: 400 })
  }

  const { data, error } = await admin
    .from("mkt_cash_ledger")
    .insert([
      {
        source,
        event_type: eventType,
        amount,
        note,
        occurred_at: occurredAt || new Date().toISOString(),
        entered_by_user_id: user.id,
        entered_by_email: user.email ?? null,
      },
    ])
    .select("id, source, event_type, amount, note, occurred_at, entered_by_email, created_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ entry: data })
}

