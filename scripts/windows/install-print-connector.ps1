Param(
  [string]$ConnectorName = "IFO Print Connector",
  [string]$SourceAgentPath = ""
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) {
  Write-Host "[IFO] $msg" -ForegroundColor Cyan
}

try {
  $nodeCmd = Get-Command node -ErrorAction Stop
  $nodePath = $nodeCmd.Source
} catch {
  Write-Error "Node.js no está instalado o no está en PATH. Instálalo desde https://nodejs.org"
  exit 1
}

if ([string]::IsNullOrWhiteSpace($SourceAgentPath)) {
  $repoGuess = Join-Path $PSScriptRoot "..\..\local-print-agent.mjs"
  $repoGuess = [System.IO.Path]::GetFullPath($repoGuess)
  if (Test-Path $repoGuess) {
    $SourceAgentPath = $repoGuess
  } else {
    Write-Error "No se encontró local-print-agent.mjs. Pásalo con -SourceAgentPath"
    exit 1
  }
}

$SourceAgentPath = [System.IO.Path]::GetFullPath($SourceAgentPath)
if (-not (Test-Path $SourceAgentPath)) {
  Write-Error "No existe el archivo del agente: $SourceAgentPath"
  exit 1
}

$installRoot = Join-Path $env:LOCALAPPDATA "InventoryFulfillmentOptimizer\print-connector"
$agentTarget = Join-Path $installRoot "local-print-agent.mjs"
$launcherVbs = Join-Path $installRoot "launch-connector.vbs"
$logOut = Join-Path $installRoot "connector.out.log"
$logErr = Join-Path $installRoot "connector.err.log"

Write-Step "Creando carpeta de instalación: $installRoot"
New-Item -ItemType Directory -Path $installRoot -Force | Out-Null

Write-Step "Copiando agente"
Copy-Item -Path $SourceAgentPath -Destination $agentTarget -Force

# VBS para arrancar en segundo plano sin ventana de consola
$vbs = @"
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "$installRoot"
cmd = "\"$nodePath\" \"$agentTarget\" 1>>\"$logOut\" 2>>\"$logErr\""
shell.Run cmd, 0, False
"@
Set-Content -Path $launcherVbs -Value $vbs -Encoding ASCII

Write-Step "Eliminando tarea previa (si existe)"
schtasks /Delete /TN "$ConnectorName" /F | Out-Null 2>&1

Write-Step "Creando tarea de inicio de sesión"
$taskRun = "wscript.exe \"$launcherVbs\""
$createArgs = @(
  "/Create",
  "/SC", "ONLOGON",
  "/TN", "$ConnectorName",
  "/TR", "$taskRun",
  "/RL", "LIMITED",
  "/F"
)
$null = Start-Process -FilePath "schtasks.exe" -ArgumentList $createArgs -Wait -NoNewWindow -PassThru

Write-Step "Lanzando conector ahora"
Start-Process -FilePath "wscript.exe" -ArgumentList "`"$launcherVbs`"" -WindowStyle Hidden

Write-Host ""
Write-Host "Instalación completada." -ForegroundColor Green
Write-Host "Conector: $ConnectorName"
Write-Host "Agente:    $agentTarget"
Write-Host ""
Write-Host "Verifica estado en: http://localhost:3021/health"
Write-Host ""
