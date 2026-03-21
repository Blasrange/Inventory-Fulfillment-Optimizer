$ErrorActionPreference = "SilentlyContinue"

Write-Host "Desinstalando IFO Print Connector..." -ForegroundColor Yellow
Write-Host ""

$installRoot = Join-Path $env:LOCALAPPDATA "InventoryFulfillmentOptimizer\print-connector"
$startupDir = [Environment]::GetFolderPath("Startup")

# 1. Matar procesos node
Write-Host "[1/4] Deteniendo agente..." -ForegroundColor Cyan
try {
  Get-Process node -ErrorAction SilentlyContinue | 
    Where-Object { $_.CommandLine -like "*local-print-agent*" } | 
    Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 500
} catch {
  Write-Host "      (no hay procesos que terminar)" -ForegroundColor Gray
}

# 2. Eliminar archivo de inicio
Write-Host "[2/4] Eliminando acceso directo de inicio..." -ForegroundColor Cyan
try {
  $startupLinks = @(
    (Join-Path $startupDir "IFO Print Connector.lnk"),
    (Join-Path $startupDir "start-connector.lnk"),
    (Join-Path $startupDir "PrintConnector.lnk")
  )
  
  foreach ($link in $startupLinks) {
    if (Test-Path -LiteralPath $link) {
      Remove-Item -LiteralPath $link -Force -ErrorAction SilentlyContinue
      Write-Host "      ✓ Eliminado: $([System.IO.Path]::GetFileName($link))" -ForegroundColor Green
    }
  }
} catch {
  Write-Host "      (error al limpiar startup links)" -ForegroundColor Gray
}

# 3. Eliminar carpeta de instalación
Write-Host "[3/4] Eliminando archivos instalados..." -ForegroundColor Cyan
try {
  if (Test-Path -LiteralPath $installRoot) {
    Remove-Item -LiteralPath $installRoot -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "      ✓ Carpeta eliminada" -ForegroundColor Green
  } else {
    Write-Host "      (carpeta no encontrada)" -ForegroundColor Gray
  }
} catch {
  Write-Host "      (error al eliminar carpeta)" -ForegroundColor Gray
}

# 4. Eliminar entrada de grupo de inicio
Write-Host "[4/4] Limpiando registro..." -ForegroundColor Cyan
try {
  $runPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
  $regItems = @(
    "IFO Print Connector",
    "InventoryFulfillmentOptimizer",
    "PrintConnector"
  )
  
  foreach ($item in $regItems) {
    Remove-ItemProperty -Path $runPath -Name $item -ErrorAction SilentlyContinue
  }
} catch {
  Write-Host "      (no había entradas de registro)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✓ Desinstalación completada exitosamente" -ForegroundColor Green
Write-Host ""
Start-Sleep -Seconds 2
