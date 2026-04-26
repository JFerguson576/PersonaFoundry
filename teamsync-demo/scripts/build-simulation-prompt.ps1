param(
  [string]$OutputName = "teamsync-simulation-prompt.txt"
)

$root = Split-Path -Parent $PSScriptRoot
$configDir = Join-Path $root "config"
$promptsDir = Join-Path $root "prompts"
$runsDir = Join-Path $root "runs"

if (-not (Test-Path -LiteralPath $runsDir)) {
  New-Item -ItemType Directory -Path $runsDir -Force | Out-Null
}

$workflow = Get-Content -Raw -LiteralPath (Join-Path $configDir "workflow.json") | ConvertFrom-Json
$participants = Get-Content -Raw -LiteralPath (Join-Path $configDir "participants.json") | ConvertFrom-Json
$scenario = Get-Content -Raw -LiteralPath (Join-Path $configDir "scenario.json") | ConvertFrom-Json
$systemPrompt = Get-Content -Raw -LiteralPath (Join-Path $promptsDir "system.simulation.md")
$scenarioPrompt = Get-Content -Raw -LiteralPath (Join-Path $promptsDir "scenario.corporate-change.md")

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

$participantBlock = ($participants.participants | ForEach-Object {
  $summary = if ($_.strengthsSummary) { ($_.strengthsSummary -join "; ") } else { "No summary provided." }
  "- Name: $($_.name)`n  Role: $($_.role)`n  Source PDF: $($_.sourcePdf)`n  Strengths Summary: $summary"
}) -join "`n`
"

$phaseBlock = ($workflow.phases | ForEach-Object {
  $inputs = ($_.inputs -join ", ")
  $outputs = ($_.outputs -join ", ")
  $rules = ($_.adaptationRules -join " | ")
  "- [$($_.id)] $($_.name)`n  Objective: $($_.objective)`n  Inputs: $inputs`n  Outputs: $outputs`n  Adaptation Rules: $rules"
}) -join "`n`
"

$gateBlock = ($workflow.decisionGates | ForEach-Object {
  "- $($_.id): $($_.condition)`n  If true: $($_.ifTrue)`n  If false: $($_.ifFalse)"
}) -join "`n`
"

$compiled = @"
TEAMSYNC SIMULATION PACKET
Generated: $timestamp

=== SYSTEM PROMPT ===
$systemPrompt

=== SCENARIO MODULE ===
$scenarioPrompt

=== SCENARIO CONFIG ===
Title: $($scenario.title)
Industry: $($scenario.industry)
Context: $($scenario.companyContext)
Trigger Event: $($scenario.triggerEvent)
Constraints: $($scenario.constraints -join '; ')
Success Criteria: $($scenario.successCriteria -join '; ')
Expected Outputs: $($scenario.simulationOutputs -join '; ')

=== WORKFLOW CONFIG ===
Version: $($workflow.workflowVersion)
Operating Mode: $($workflow.operatingMode)

Phases:
$phaseBlock

Decision Gates:
$gateBlock

=== PARTICIPANT CONFIG ===
Team: $($participants.teamName)
$participantBlock

=== RUN INSTRUCTIONS FOR CODEX ===
1) Simulate a full walkthrough using the above configuration.
2) If any strengths entries remain TODO, make conservative assumptions and tag them as ASSUMPTION.
3) Include adaptation behavior when any workflow step changes mid-run.
4) Produce facilitator-ready output in the required section structure.
"@

$outPath = Join-Path $runsDir $OutputName
$compiled | Set-Content -LiteralPath $outPath -Encoding utf8

Write-Output "Created: $outPath"
