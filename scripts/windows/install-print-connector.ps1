Param(
  [string]$ConnectorName = "IFO Print Connector",
  [string]$SourceAgentPath = "",
  [string]$AgentDownloadUrl = ""
)

$ErrorActionPreference = "Stop"

# Este marcador es reemplazado automáticamente al generar el instalador .exe
# para incluir el contenido de local-print-agent.mjs dentro del binario.
$EmbeddedAgentBase64 = ""

function Write-Step($msg) {
  Write-Host "[IFO] $msg" -ForegroundColor Cyan
}

function Resolve-SystemCommandPath {
  Param(
    [Parameter(Mandatory = $true)]
    [string]$CommandName
  )

  try {
    $cmd = Get-Command $CommandName -ErrorAction Stop
    if ($cmd -and $cmd.Source -and (Test-Path $cmd.Source)) {
      return $cmd.Source
    }
  } catch {}

  $system32 = Join-Path $env:WINDIR "System32"
  $candidate = Join-Path $system32 $CommandName
  if (Test-Path $candidate) {
    return $candidate
  }

  return $null
}

function Get-NodePath {
  try {
    return (Get-Command node -ErrorAction Stop).Source
  } catch {
    return $null
  }
}

function Refresh-PathFromRegistry {
  $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$machinePath;$userPath"
}

function Ensure-NodeInstalled {
  $nodePath = Get-NodePath
  if ($nodePath) {
    Write-Step "Node.js detectado: $nodePath"
    return $nodePath
  }

  Write-Step "Node.js no encontrado. Intentando instalar con winget..."
  $wingetPath = Resolve-SystemCommandPath -CommandName "winget.exe"
  if (-not $wingetPath) {
    $wingetAliasPath = Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps\winget.exe"
    if (Test-Path $wingetAliasPath) {
      $wingetPath = $wingetAliasPath
    }
  }

  if (-not $wingetPath) {
    Write-Error "No se encontró winget. Instala Node.js manualmente desde https://nodejs.org y vuelve a ejecutar el instalador."
    exit 1
  }

  $installArgs = @(
    "install",
    "--id", "OpenJS.NodeJS.LTS",
    "--silent",
    "--accept-source-agreements",
    "--accept-package-agreements",
    "--disable-interactivity"
  )

  $installProc = Start-Process -FilePath $wingetPath -ArgumentList $installArgs -Wait -NoNewWindow -PassThru
  if ($installProc.ExitCode -ne 0) {
    Write-Error "No se pudo instalar Node.js automáticamente (winget exit code $($installProc.ExitCode))."
    exit 1
  }

  Refresh-PathFromRegistry
  $nodePath = Get-NodePath
  if (-not $nodePath) {
    Write-Error "Node.js se instaló pero no fue detectado en PATH. Reinicia sesión y vuelve a intentar."
    exit 1
  }

  Write-Step "Node.js instalado correctamente: $nodePath"
  return $nodePath
}

$nodePath = Ensure-NodeInstalled

$scriptBase = ""
if (-not [string]::IsNullOrWhiteSpace($PSScriptRoot)) {
  $scriptBase = $PSScriptRoot
} elseif ($MyInvocation.MyCommand.Path) {
  $scriptBase = Split-Path -Parent $MyInvocation.MyCommand.Path
}

if ([string]::IsNullOrWhiteSpace($SourceAgentPath)) {
  if (-not [string]::IsNullOrWhiteSpace($scriptBase)) {
    $repoGuess = Join-Path $scriptBase "..\..\local-print-agent.mjs"
    $repoGuess = [System.IO.Path]::GetFullPath($repoGuess)
    if (Test-Path $repoGuess) {
      $SourceAgentPath = $repoGuess
    } else {
      $sameDirGuess = Join-Path $scriptBase "local-print-agent.mjs"
      if (Test-Path $sameDirGuess) {
        $SourceAgentPath = [System.IO.Path]::GetFullPath($sameDirGuess)
      }
    }
  }
}

$installRoot = Join-Path $env:LOCALAPPDATA "InventoryFulfillmentOptimizer\print-connector"
$agentTarget = Join-Path $installRoot "local-print-agent.mjs"
$launcherVbs = Join-Path $installRoot "launch-connector.vbs"
$logOut = Join-Path $installRoot "connector.out.log"
$logErr = Join-Path $installRoot "connector.err.log"

Write-Step "Creando carpeta de instalación: $installRoot"
New-Item -ItemType Directory -Path $installRoot -Force | Out-Null

if (-not [string]::IsNullOrWhiteSpace($SourceAgentPath)) {
  $SourceAgentPath = [System.IO.Path]::GetFullPath($SourceAgentPath)
}

if (-not [string]::IsNullOrWhiteSpace($SourceAgentPath) -and (Test-Path $SourceAgentPath)) {
  Write-Step "Copiando agente desde archivo local"
  Copy-Item -Path $SourceAgentPath -Destination $agentTarget -Force
} else {
  if (-not [string]::IsNullOrWhiteSpace($EmbeddedAgentBase64)) {
    Write-Step "Escribiendo agente embebido"
    $agentBytes = [Convert]::FromBase64String($EmbeddedAgentBase64)
    [System.IO.File]::WriteAllBytes($agentTarget, $agentBytes)
  } else {
    if ([string]::IsNullOrWhiteSpace($AgentDownloadUrl)) {
      $AgentDownloadUrl = "https://inventory-fulfillment-optimizer.vercel.app/local-print-agent.mjs"
    }
    Write-Step "Descargando agente desde: $AgentDownloadUrl"
    Invoke-WebRequest -Uri $AgentDownloadUrl -OutFile $agentTarget -UseBasicParsing
  }
}

# VBS para arrancar en segundo plano sin ventana de consola
$vbs = @"
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "$installRoot"
cmd = "\"$nodePath\" \"$agentTarget\" 1>>\"$logOut\" 2>>\"$logErr\""
shell.Run cmd, 0, False
"@
Set-Content -Path $launcherVbs -Value $vbs -Encoding ASCII

Write-Step "Eliminando tarea previa (si existe)"
$schtasksPath = Resolve-SystemCommandPath -CommandName "schtasks.exe"
if (-not $schtasksPath) {
  Write-Error "No se encontró schtasks.exe en este equipo."
  exit 1
}

$wscriptPath = Resolve-SystemCommandPath -CommandName "wscript.exe"
if (-not $wscriptPath) {
  Write-Error "No se encontró wscript.exe en este equipo."
  exit 1
}

& $schtasksPath /Delete /TN "$ConnectorName" /F | Out-Null 2>&1

Write-Step "Creando tarea de inicio de sesión"
$taskRun = "$wscriptPath `"$launcherVbs`""
$createArgs = @(
  "/Create",
  "/SC", "ONLOGON",
  "/TN", "$ConnectorName",
  "/TR", "$taskRun",
  "/RL", "LIMITED",
  "/F"
)
$null = Start-Process -FilePath $schtasksPath -ArgumentList $createArgs -Wait -NoNewWindow -PassThru

Write-Step "Lanzando conector ahora"
Start-Process -FilePath $wscriptPath -ArgumentList "`"$launcherVbs`"" -WindowStyle Hidden

Write-Host ""
Write-Host "Instalación completada." -ForegroundColor Green
Write-Host "Conector: $ConnectorName"
Write-Host "Agente:    $agentTarget"
Write-Host ""
Write-Host "Verifica estado en: http://localhost:3021/health"
Write-Host ""
