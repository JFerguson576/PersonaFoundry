import { NextResponse } from "next/server"
import { getRequestAuth } from "@/lib/supabase/auth"
import { createRouteClient } from "@/lib/supabase/route"

type TeamSyncMemberPayload = {
  id?: string
  name?: string
  role?: string
  strengths?: string
}

type TeamSyncRunPayload = {
  runId?: string
  timestamp?: string
  notes?: string
  reviewed?: boolean
  scenarioTitle?: string
  scenarioCategory?: string
  pressureLevel?: number
  groupSummary?: string
  semanticLens?: string
  likelyBehaviors?: string[]
  roleReactions?: Array<{
    audience?: string
    likelyResponse?: string
    supportAction?: string
  }>
  risks?: string[]
  adjustments?: string[]
  actions?: string[]
  actionChecklist?: Array<{
    id?: string
    label?: string
    done?: boolean
    owner?: string
    dueDate?: string
  }>
  memberSupportPriorities?: Array<{
    memberId?: string
    memberName?: string
    role?: string
    score?: number
    level?: string
    rationale?: string
    supportMove?: string
  }>
}

type TeamSyncSavedScenarioPayload = {
  id?: string
  title?: string
  category?: string
  focus?: string
  promptText?: string
  visibility?: string
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") return ""
  return value.trim()
}

function normalizeScenarioCategory(value: unknown) {
  const normalized = normalizeText(value)
  if (["Professional", "Family", "Learning", "Executive", "Boardroom"].includes(normalized)) {
    return normalized
  }
  return "Professional"
}

function normalizeScenarioVisibility(value: unknown) {
  const normalized = normalizeText(value).toLowerCase()
  return normalized === "shared" ? "shared" : "private"
}

function normalizeRoleReactions(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const row = item as Record<string, unknown>
      return {
        audience: normalizeText(row?.audience),
        likelyResponse: normalizeText(row?.likelyResponse),
        supportAction: normalizeText(row?.supportAction),
      }
    })
    .filter((item) => item.audience && item.likelyResponse && item.supportAction)
}

function normalizeActionChecklist(value: unknown, fallbackActions: string[]) {
  if (!Array.isArray(value)) {
    return fallbackActions.map((label, index) => ({
      id: `task-${index + 1}`,
      label,
      done: false,
      owner: "",
      dueDate: "",
    }))
  }

  const cleaned = value
    .map((item, index) => {
      const row = item as Record<string, unknown>
      const label = normalizeText(row?.label)
      if (!label) return null
      return {
        id: normalizeText(row?.id) || `task-${index + 1}`,
        label,
        done: Boolean(row?.done),
        owner: normalizeText(row?.owner),
        dueDate: normalizeText(row?.dueDate),
      }
    })
    .filter(Boolean)

  if (cleaned.length > 0) return cleaned

  return fallbackActions.map((label, index) => ({
    id: `task-${index + 1}`,
    label,
    done: false,
    owner: "",
    dueDate: "",
  }))
}

function normalizeMemberSupportPriorities(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const row = item as Record<string, unknown>
      const levelRaw = normalizeText(row?.level).toLowerCase()
      const level = levelRaw === "high" || levelRaw === "medium" || levelRaw === "low" ? levelRaw : "medium"
      const scoreRaw = Number(row?.score)
      const score = Number.isFinite(scoreRaw) ? Math.max(0, Math.min(100, Math.round(scoreRaw))) : 50
      return {
        memberId: normalizeText(row?.memberId),
        memberName: normalizeText(row?.memberName),
        role: normalizeText(row?.role),
        score,
        level,
        rationale: normalizeText(row?.rationale),
        supportMove: normalizeText(row?.supportMove),
      }
    })
    .filter((item) => item.memberName && item.rationale && item.supportMove)
}

export async function GET(req: Request) {
  try {
    const { user, accessToken, errorMessage } = await getRequestAuth(req)

    if (!user) {
      return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
    }

    const supabase = createRouteClient(accessToken ?? undefined)
    const { searchParams } = new URL(req.url)
    const requestedGroupId = normalizeText(searchParams.get("group_id"))

    const { data: workspaces, error: workspaceError } = await supabase
      .from("teamsync_workspaces")
      .select("id, group_name, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })

    if (workspaceError) {
      return NextResponse.json({ error: workspaceError.message }, { status: 400 })
    }

    const groups = (workspaces ?? []).map((row) => ({
      id: row.id,
      group_name: row.group_name ?? "",
      updated_at: row.updated_at ?? null,
    }))

    if (groups.length === 0) {
      return NextResponse.json({ groups: [], active_group_id: null, group_name: "", members: [], runs: [] })
    }

    const activeGroup = groups.find((group) => group.id === requestedGroupId) ?? groups[0]

    const [membersResult, runsResult, scenariosResult] = await Promise.all([
      supabase
        .from("teamsync_members")
        .select("id, full_name, role_title, strengths_text")
        .eq("workspace_id", activeGroup.id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("teamsync_runs")
        .select("id, created_at, scenario_title, scenario_category, pressure_level, result_json")
        .eq("workspace_id", activeGroup.id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("teamsync_saved_scenarios")
        .select("id, user_id, title, category, focus, prompt_text, visibility, updated_at")
        .or(`user_id.eq.${user.id},visibility.eq.shared`)
        .order("updated_at", { ascending: false }),
    ])

    if (membersResult.error) {
      return NextResponse.json({ error: membersResult.error.message }, { status: 400 })
    }

    if (runsResult.error) {
      return NextResponse.json({ error: runsResult.error.message }, { status: 400 })
    }

    const scenarioQueryFailed = Boolean(scenariosResult.error && scenariosResult.error.code !== "42P01")
    if (scenarioQueryFailed) {
      return NextResponse.json({ error: scenariosResult.error?.message || "Could not load saved scenarios" }, { status: 400 })
    }

    const members = (membersResult.data ?? []).map((row) => ({
      id: row.id,
      name: row.full_name ?? "",
      role: row.role_title ?? "",
      strengths: row.strengths_text ?? "",
    }))

    const runs = (runsResult.data ?? []).map((row) => {
      const payload = (row.result_json ?? {}) as Record<string, unknown>
      const actions = Array.isArray(payload.actions) ? payload.actions : []
      return {
        runId: row.id,
        timestamp: row.created_at ?? new Date().toISOString(),
        notes: typeof payload.notes === "string" ? payload.notes : "",
        reviewed: Boolean(payload.reviewed),
        scenarioTitle: row.scenario_title ?? "",
        scenarioCategory: row.scenario_category ?? "Professional",
        pressureLevel: row.pressure_level ?? 3,
        groupSummary: typeof payload.groupSummary === "string" ? payload.groupSummary : "",
        semanticLens: typeof payload.semanticLens === "string" ? payload.semanticLens : "",
        likelyBehaviors: Array.isArray(payload.likelyBehaviors) ? payload.likelyBehaviors : [],
        roleReactions: normalizeRoleReactions(payload.roleReactions),
        risks: Array.isArray(payload.risks) ? payload.risks : [],
        adjustments: Array.isArray(payload.adjustments) ? payload.adjustments : [],
        actions,
        actionChecklist: normalizeActionChecklist(payload.actionChecklist, actions),
        memberSupportPriorities: normalizeMemberSupportPriorities(payload.memberSupportPriorities),
      }
    })

    const customScenarios =
      scenariosResult.error?.code === "42P01"
        ? []
        : (scenariosResult.data ?? []).map((row) => ({
            id: row.id,
            title: row.title ?? "",
            category: normalizeScenarioCategory(row.category),
            focus: row.focus ?? "Saved TeamSync scenario",
            promptText: row.prompt_text ?? "",
            visibility: normalizeScenarioVisibility(row.visibility),
            ownerUserId: row.user_id ?? "",
            updatedAt: row.updated_at ?? null,
          }))

    return NextResponse.json({
      groups,
      active_group_id: activeGroup.id,
      group_name: activeGroup.group_name ?? "",
      members,
      runs,
      custom_scenarios: customScenarios,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const { user, accessToken, errorMessage } = await getRequestAuth(req)

    if (!user) {
      return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const incomingGroupId = normalizeText(body?.group_id)
    const groupName = normalizeText(body?.group_name)
    const incomingMembers = Array.isArray(body?.members) ? (body.members as TeamSyncMemberPayload[]) : []
    const incomingRuns = Array.isArray(body?.runs) ? (body.runs as TeamSyncRunPayload[]) : []
    const incomingCustomScenarios = Array.isArray(body?.custom_scenarios) ? (body.custom_scenarios as TeamSyncSavedScenarioPayload[]) : []
    const normalizedGroupName = groupName || "My Team"

    const supabase = createRouteClient(accessToken ?? undefined)

    let workspaceId = ""
    if (incomingGroupId) {
      const { data: existingWorkspace, error: existingWorkspaceError } = await supabase
        .from("teamsync_workspaces")
        .select("id")
        .eq("id", incomingGroupId)
        .eq("user_id", user.id)
        .maybeSingle()

      if (existingWorkspaceError) {
        return NextResponse.json({ error: existingWorkspaceError.message }, { status: 400 })
      }

      if (existingWorkspace?.id) {
        const { error: renameError } = await supabase
          .from("teamsync_workspaces")
          .update({ group_name: normalizedGroupName })
          .eq("id", existingWorkspace.id)
          .eq("user_id", user.id)
        if (renameError) {
          return NextResponse.json({ error: renameError.message }, { status: 400 })
        }
        workspaceId = existingWorkspace.id
      }
    }

    if (!workspaceId) {
      const { data: existingByName, error: existingByNameError } = await supabase
        .from("teamsync_workspaces")
        .select("id")
        .eq("user_id", user.id)
        .eq("group_name", normalizedGroupName)
        .maybeSingle()

      if (existingByNameError) {
        return NextResponse.json({ error: existingByNameError.message }, { status: 400 })
      }

      if (existingByName?.id) {
        workspaceId = existingByName.id
      } else {
        const { data: insertedWorkspace, error: insertWorkspaceError } = await supabase
          .from("teamsync_workspaces")
          .insert([
            {
              user_id: user.id,
              group_name: normalizedGroupName,
            },
          ])
          .select("id")
          .single()

        if (insertWorkspaceError || !insertedWorkspace?.id) {
          return NextResponse.json({ error: insertWorkspaceError?.message || "Failed to prepare TeamSync workspace" }, { status: 400 })
        }

        workspaceId = insertedWorkspace.id
      }
    }

    const { error: deleteMembersError } = await supabase.from("teamsync_members").delete().eq("workspace_id", workspaceId).eq("user_id", user.id)
    if (deleteMembersError) {
      return NextResponse.json({ error: deleteMembersError.message }, { status: 400 })
    }

    const { error: deleteRunsError } = await supabase.from("teamsync_runs").delete().eq("workspace_id", workspaceId).eq("user_id", user.id)
    if (deleteRunsError) {
      return NextResponse.json({ error: deleteRunsError.message }, { status: 400 })
    }

    const memberRows = incomingMembers
      .slice(0, 150)
      .filter((member) => normalizeText(member.name) && normalizeText(member.strengths))
      .map((member) => ({
        user_id: user.id,
        workspace_id: workspaceId,
        full_name: normalizeText(member.name),
        role_title: normalizeText(member.role) || null,
        strengths_text: normalizeText(member.strengths),
      }))

    if (memberRows.length > 0) {
      const { error: insertMembersError } = await supabase.from("teamsync_members").insert(memberRows)
      if (insertMembersError) {
        return NextResponse.json({ error: insertMembersError.message }, { status: 400 })
      }
    }

    const runRows = incomingRuns.slice(0, 200).map((run) => ({
      user_id: user.id,
      workspace_id: workspaceId,
      scenario_title: normalizeText(run.scenarioTitle) || "Untitled scenario",
      scenario_category: normalizeText(run.scenarioCategory) || "Professional",
      pressure_level: typeof run.pressureLevel === "number" ? Math.min(5, Math.max(1, Math.round(run.pressureLevel))) : 3,
      created_at: normalizeText(run.timestamp) || new Date().toISOString(),
      result_json: {
        notes: normalizeText(run.notes),
        reviewed: Boolean(run.reviewed),
        groupSummary: normalizeText(run.groupSummary),
        semanticLens: normalizeText(run.semanticLens),
        likelyBehaviors: Array.isArray(run.likelyBehaviors) ? run.likelyBehaviors : [],
        roleReactions: normalizeRoleReactions(run.roleReactions),
        risks: Array.isArray(run.risks) ? run.risks : [],
        adjustments: Array.isArray(run.adjustments) ? run.adjustments : [],
        actions: Array.isArray(run.actions) ? run.actions : [],
        actionChecklist: normalizeActionChecklist(run.actionChecklist, Array.isArray(run.actions) ? run.actions : []),
        memberSupportPriorities: normalizeMemberSupportPriorities(run.memberSupportPriorities),
      },
    }))

    if (runRows.length > 0) {
      const { error: insertRunsError } = await supabase.from("teamsync_runs").insert(runRows)
      if (insertRunsError) {
        return NextResponse.json({ error: insertRunsError.message }, { status: 400 })
      }
    }

    const removeSavedScenarios = await supabase
      .from("teamsync_saved_scenarios")
      .delete()
      .eq("user_id", user.id)
    const missingSavedScenariosTable = removeSavedScenarios.error?.code === "42P01"
    if (removeSavedScenarios.error && !missingSavedScenariosTable) {
      return NextResponse.json({ error: removeSavedScenarios.error.message }, { status: 400 })
    }

    if (!missingSavedScenariosTable) {
      const scenarioRows = incomingCustomScenarios
        .slice(0, 120)
        .map((scenario, index) => {
          const title = normalizeText(scenario.title)
          const promptText = normalizeText(scenario.promptText)
          if (!title || !promptText) return null
          return {
            user_id: user.id,
            title,
            category: normalizeScenarioCategory(scenario.category),
            focus: normalizeText(scenario.focus) || "Saved TeamSync scenario",
            prompt_text: promptText,
            visibility: normalizeScenarioVisibility(scenario.visibility),
          }
        })
        .filter(Boolean)

      if (scenarioRows.length > 0) {
        const { error: insertScenariosError } = await supabase.from("teamsync_saved_scenarios").insert(scenarioRows)
        if (insertScenariosError) {
          return NextResponse.json({ error: insertScenariosError.message }, { status: 400 })
        }
      }
    }

    return NextResponse.json({
      ok: true,
      workspace_id: workspaceId,
      group_name: normalizedGroupName,
      member_count: memberRows.length,
      run_count: runRows.length,
      custom_scenario_count: incomingCustomScenarios.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
