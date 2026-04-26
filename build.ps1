param(
  [string]$BuildCommand = ""
)

$ErrorActionPreference = "Stop"

Write-Host "[TeamSync] Regenerating simulation packet..."
powershell -ExecutionPolicy Bypass -File ".\teamsync-demo\scripts\build-simulation-prompt.ps1"

if ([string]::IsNullOrWhiteSpace($BuildCommand)) {
  Write-Host "[TeamSync] Done. No app build command provided."
  Write-Host "Usage example: .\build.ps1 \"npm run build\""
  exit 0
}

Write-Host "[Build] Running: $BuildCommand"
Invoke-Expression $BuildCommand
