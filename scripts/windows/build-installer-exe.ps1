Param(
  [string]$InputScript = "",
  [string]$AgentScript = "",
  [string]$OutputExe = ""
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) {
  Write-Host "[IFO-BUILD] $msg" -ForegroundColor Cyan
}

if ([string]::IsNullOrWhiteSpace($InputScript)) {
  $InputScript = Join-Path $PSScriptRoot "install-print-connector-simple.ps1"
}
if ([string]::IsNullOrWhiteSpace($AgentScript)) {
  $AgentScript = Join-Path $PSScriptRoot "..\..\local-print-agent.mjs"
  $AgentScript = [System.IO.Path]::GetFullPath($AgentScript)
}
if ([string]::IsNullOrWhiteSpace($OutputExe)) {
  $OutputExe = Join-Path $PSScriptRoot "..\..\public\install-print-connector.exe"
  $OutputExe = [System.IO.Path]::GetFullPath($OutputExe)
}

$InputScript = [System.IO.Path]::GetFullPath($InputScript)
$AgentScript = [System.IO.Path]::GetFullPath($AgentScript)
$OutputExe = [System.IO.Path]::GetFullPath($OutputExe)

if (-not (Test-Path $InputScript)) {
  Write-Error "No existe script base: $InputScript"
  exit 1
}
if (-not (Test-Path $AgentScript)) {
  Write-Error "No existe agente: $AgentScript"
  exit 1
}

Write-Step "Cargando instalador base"
$scriptText = Get-Content -Path $InputScript -Raw -Encoding UTF8
$agentBytes = [System.IO.File]::ReadAllBytes($AgentScript)
$agentBase64 = [Convert]::ToBase64String($agentBytes)

Write-Step "Inyectando agente embebido"
$scriptText = $scriptText -replace '\$EmbeddedAgentBase64\s*=\s*""', ('$EmbeddedAgentBase64 = "' + $agentBase64 + '"')

$tempScript = Join-Path $env:TEMP ("install-print-connector-embedded-" + [Guid]::NewGuid().ToString("N") + ".ps1")
Set-Content -Path $tempScript -Value $scriptText -Encoding UTF8

try {
  Write-Step "Asegurando proveedor NuGet"
  Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force -Scope CurrentUser | Out-Null

  Write-Step "Configurando PSGallery como repositorio confiable"
  Set-PSRepository -Name PSGallery -InstallationPolicy Trusted -ErrorAction SilentlyContinue

  if (-not (Get-Module -ListAvailable -Name ps2exe)) {
    Write-Step "Instalando módulo ps2exe"
    Install-Module -Name ps2exe -Scope CurrentUser -Force -AllowClobber -Confirm:$false -ErrorAction Stop
  }

  Import-Module ps2exe -ErrorAction Stop

  Write-Step "Compilando instalador .exe"
  Invoke-ps2exe -inputFile $tempScript -outputFile $OutputExe -title "IFO Print Connector Installer" -description "Instalador del conector local de impresión" -company "Inventory Fulfillment Optimizer" -product "IFO Print Connector" -version "1.0.0" -noConsole

  Write-Host ""
  Write-Host "EXE generado correctamente:" -ForegroundColor Green
  Write-Host $OutputExe
  Write-Host ""
} finally {
  if (Test-Path $tempScript) {
    Remove-Item -Path $tempScript -Force
  }
}
