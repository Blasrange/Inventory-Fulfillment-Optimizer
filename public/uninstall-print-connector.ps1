Param(
  [string]$ConnectorName = "IFO Print Connector"
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) {
  Write-Host "[IFO] $msg" -ForegroundColor Yellow
}

$installRoot = Join-Path $env:LOCALAPPDATA "InventoryFulfillmentOptimizer\print-connector"

Write-Step "Eliminando tarea programada"
schtasks /Delete /TN "$ConnectorName" /F | Out-Null 2>&1

Write-Step "Deteniendo procesos node del conector"
Get-CimInstance Win32_Process |
  Where-Object { $_.Name -eq "node.exe" -and $_.CommandLine -like "*local-print-agent.mjs*" } |
  ForEach-Object {
    try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {}
  }

if (Test-Path $installRoot) {
  Write-Step "Eliminando archivos en $installRoot"
  Remove-Item -Path $installRoot -Recurse -Force
}

Write-Host ""
Write-Host "Conector desinstalado." -ForegroundColor Green
Write-Host ""
