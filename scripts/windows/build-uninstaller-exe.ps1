Param(
  [string]$InputScript = "",
  [string]$OutputExe = ""
)

$ErrorActionPreference = "Continue"

function Write-Step($msg) {
  Write-Host "[IFO-BUILD] $msg" -ForegroundColor Cyan
}

if ([string]::IsNullOrWhiteSpace($InputScript)) {
  $InputScript = Join-Path $PSScriptRoot "uninstall-print-connector-simple.ps1"
}
if ([string]::IsNullOrWhiteSpace($OutputExe)) {
  $OutputExe = Join-Path $PSScriptRoot "..\..\public\uninstall-print-connector.exe"
  $OutputExe = [System.IO.Path]::GetFullPath($OutputExe)
}

$InputScript = [System.IO.Path]::GetFullPath($InputScript)
$OutputExe = [System.IO.Path]::GetFullPath($OutputExe)

if (-not (Test-Path $InputScript)) {
  Write-Error "No existe script: $InputScript"
  exit 1
}

Write-Step "Compilando desinstalador"

try {
  Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force -Scope CurrentUser | Out-Null
  Set-PSRepository -Name PSGallery -InstallationPolicy Trusted -ErrorAction SilentlyContinue

  if (-not (Get-Module -ListAvailable -Name ps2exe)) {
    Install-Module -Name ps2exe -Scope CurrentUser -Force -AllowClobber -Confirm:$false -ErrorAction Stop
  }

  Import-Module ps2exe -ErrorAction Stop

  Invoke-ps2exe -inputFile $InputScript -outputFile $OutputExe -title "IFO Print Connector Uninstaller" -description "Desinstala el conector local de impresion" -company "Inventory Fulfillment Optimizer" -product "IFO Print Connector" -version "1.0.0" -noConsole

  Write-Host ""
  Write-Host "Desinstalador generado:" -ForegroundColor Green
  Write-Host $OutputExe
  Write-Host ""
} catch {
  Write-Host "Error: $_" -ForegroundColor Red
  exit 1
}
