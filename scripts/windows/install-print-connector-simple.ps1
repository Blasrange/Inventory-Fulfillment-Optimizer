Param(
  [string]$ConnectorName = "IFO Print Connector",
  [string]$AgentDownloadUrl = "https://inventory-fulfillment-optimizer.vercel.app/local-print-agent.mjs"
)

# Marcar para reemplazo al compilar
$EmbeddedAgentBase64 = ""

$installRoot = Join-Path $env:LOCALAPPDATA "InventoryFulfillmentOptimizer\print-connector"
$agentPath = Join-Path $installRoot "local-print-agent.mjs"
$startupScript = Join-Path $installRoot "start-connector.bat"
$logFile = Join-Path $installRoot "connector.log"

Write-Host "Creando carpeta..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path $installRoot -Force | Out-Null

Write-Host "Obteniendo agente..." -ForegroundColor Cyan
if ($EmbeddedAgentBase64 -and $EmbeddedAgentBase64 -ne "") {
  $agentBytes = [Convert]::FromBase64String($EmbeddedAgentBase64)
  [System.IO.File]::WriteAllBytes($agentPath, $agentBytes)
  Write-Host "Agente embebido instalado" -ForegroundColor Green
} else {
  try {
    Invoke-WebRequest -Uri $AgentDownloadUrl -OutFile $agentPath -UseBasicParsing -TimeoutSec 30
    Write-Host "Agente descargado" -ForegroundColor Green
  } catch {
    Write-Host "Error al descargar agente: $_" -ForegroundColor Red
    exit 1
  }
}

Write-Host "Buscando Node.js..." -ForegroundColor Cyan
$nodePath = $null
try { $nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source } catch {}
if (-not $nodePath) {
  Write-Host "Node.js no encontrado. Abrir: https://nodejs.org" -ForegroundColor Yellow
  exit 1
}
Write-Host "Node.js: $nodePath" -ForegroundColor Green

Write-Host "Creando script de inicio..." -ForegroundColor Cyan
$batContent = @"
@echo off
cd /d "$installRoot"
"$nodePath" "$agentPath" >> "$logFile" 2>&1
"@
Set-Content -Path $startupScript -Value $batContent -Encoding ASCII

Write-Host "Instalando en Inicio..." -ForegroundColor Cyan
$startupDir = [Environment]::GetFolderPath("Startup")
$lnkPath = Join-Path $startupDir "IFO Print Connector.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($lnkPath)
$shortcut.TargetPath = "cmd.exe"
$shortcut.Arguments = "/c `"$startupScript`""
$shortcut.WorkingDirectory = $installRoot
$shortcut.WindowStyle = 7
$shortcut.Save()

Write-Host "Iniciando conector..." -ForegroundColor Cyan
& cmd.exe /c $startupScript

Write-Host ""
Write-Host "Instalacion completada." -ForegroundColor Green
Write-Host "Conector: $ConnectorName"
Write-Host "Carpeta: $installRoot"
Write-Host "Log: $logFile"
Write-Host ""
Start-Sleep -Seconds 2
