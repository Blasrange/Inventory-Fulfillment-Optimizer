# 📋 ARCHIVOS FINALES - Inventory Fulfillment Optimizer Print Connector

**Fecha de limpieza:** 20 de marzo de 2026
**Estado:** Solo archivos de producción mantienen

---

## 📁 public/ (Descargables para usuarios)

| Archivo | Tipo | Propósito | Acción del usuario |
|---------|------|----------|-------------------|
| **install-print-connector.exe** | EXE (compilado) | Instalador del print connector local | Descargar y ejecutar (1 vez por PC) |
| **uninstall-print-connector.exe** | EXE (compilado) | Desinstalador del print connector | Descargar y ejecutar (si necesita desinstalar) |
| **local-print-agent.mjs** | Node.js | Agente HTTP que ejecuta instalador (respaldo) | Usado por instalador; usuarios no interactúan |

---

## 📁 scripts/windows/ (Herramientas de desarrollo)

| Archivo | Tipo | Propósito | Uso en desarrollo |
|---------|------|----------|-------------------|
| **install-print-connector-simple.ps1** | PowerShell | Script fuente del instalador | Compilado a .exe con build-installer-exe.ps1 |
| **uninstall-print-connector-simple.ps1** | PowerShell | Script fuente del desinstalador | Compilado a .exe con build-uninstaller-exe.ps1 |
| **build-installer-exe.ps1** | PowerShell | Constructor: PS → EXE para instalador | \
pm run connector:build-exe\ |
| **build-uninstaller-exe.ps1** | PowerShell | Constructor: PS → EXE para desinstalador | \
pm run connector:build-uninstaller\ |

---

## ✅ Archivos Eliminados (Legacy/Intermedios)

Removidos de public/:
- ~~install-print-connector.ps1~~ (legacy)
- ~~status-print-connector.ps1~~ (legacy)
- ~~uninstall-print-connector.ps1~~ (legacy)
- ~~install-print-connector-final.exe~~ (versión antigua)
- ~~install-print-connector-v2.exe~~ (versión antigua)
- ~~install-print-connector-v3.exe~~ (versión antigua)

Removidos de scripts/windows/:
- ~~install-print-connector.ps1~~ (legacy)
- ~~uninstall-print-connector.ps1~~ (legacy)
- ~~status-print-connector.ps1~~ (legacy)

---

## 🚀 Distribución para usuarios finales

`
URL: https://inventory-fulfillment-optimizer.vercel.app/

Descargas necesarias:
1. install-print-connector.exe (REQUERIDO - ejecutar 1 vez)
2. uninstall-print-connector.exe (Opcional - solo si desinstala)
`

---

## 🔄 Flujo de compilación (desarrolladores)

`
PowerShell Script (.ps1)
    ↓
build-*.ps1 (ps2exe compiler)
    ↓
Ejecutable (.exe) con agente embebido (Base64)
    ↓
Publicado en /public/ → Descargable por usuarios
`

---

## 📝 Comandos npm configurados

`ash
npm run connector:build-exe           # Compile install-print-connector-simple.ps1 → .exe
npm run connector:build-uninstaller   # Compile uninstall-print-connector-simple.ps1 → .exe
npm run connector:install             # Test: ejecutar instalador localmente
npm run connector:uninstall           # Test: ejecutar desinstalador localmente
npm run connector:status              # Test: verificar estado del agente
`

---

**Nota:** No eliminar archivos de scripts/windows/. Estos son fuentes necesarios para recompilar .exe si hay cambios.
