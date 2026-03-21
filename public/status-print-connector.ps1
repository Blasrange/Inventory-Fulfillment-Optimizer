Param(
  [string]$ConnectorName = "IFO Print Connector"
)

$ErrorActionPreference = "SilentlyContinue"

$task = schtasks /Query /TN "$ConnectorName" /FO LIST 2>$null
if ($LASTEXITCODE -eq 0) {
  Write-Host "Tarea: instalada" -ForegroundColor Green
} else {
  Write-Host "Tarea: no instalada" -ForegroundColor Red
}

try {
  $health = Invoke-RestMethod -Uri "http://localhost:3021/health" -Method Get -TimeoutSec 2
  if ($health.ok -eq $true) {
    Write-Host "Agente: activo" -ForegroundColor Green
  } else {
    Write-Host "Agente: responde, pero estado inesperado" -ForegroundColor Yellow
  }
} catch {
  Write-Host "Agente: inactivo" -ForegroundColor Red
}
