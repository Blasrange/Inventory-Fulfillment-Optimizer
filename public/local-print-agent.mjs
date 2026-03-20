/**
 * Agente local de impresión para Windows
 * ----------------------------------------
 * Ejecuta: node local-print-agent.mjs
 *
 * Expone en http://localhost:3021 los endpoints de impresión ZPL para Zebra.
 * Úsalo cuando el frontend esté desplegado en Vercel (u otro host remoto),
 * ya que la nube no tiene acceso a las impresoras locales.
 *
 * Rutas:
 *   GET  /health          → verifica que el agente está activo
 *   GET  /api/printers    → lista impresoras Windows vía WMI
 *   POST /api/print-label → envía ZPL por RAW a la impresora seleccionada
 */

import http from "node:http";
import { spawn } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const PORT = 3021;

// ─── PowerShell helpers ──────────────────────────────────────────────────────

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    const ps = spawn("powershell", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      script,
    ]);
    let out = "";
    let err = "";
    ps.stdout.on("data", (d) => (out += d.toString()));
    ps.stderr.on("data", (d) => (err += d.toString()));
    ps.on("close", (code) => {
      if (code !== 0) reject(new Error(err.trim() || `Exit ${code}`));
      else resolve(out.trim());
    });
    ps.on("error", reject);
    const timer = setTimeout(() => {
      ps.kill();
      reject(new Error("Timeout"));
    }, 60_000);
    ps.on("close", () => clearTimeout(timer));
  });
}

function buildRawPrintScript(escapedPrinterName, zplFilePath) {
  return `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
public class DocInfo {
  [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
  [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
  [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
}
public class RawPrint {
  [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
  public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr d);
  [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true)]
  public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
  public static extern int StartDocPrinter(IntPtr h, int lv, [In, MarshalAs(UnmanagedType.LPStruct)] DocInfo d);
  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true)]
  public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true)]
  public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true)]
  public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true)]
  public static extern bool WritePrinter(IntPtr h, IntPtr p, int c, out int w);
}
"@

\$printerName = '${escapedPrinterName}'
\$zplPath     = '${zplFilePath}'
\$bytes = [System.IO.File]::ReadAllBytes(\$zplPath)

\$hPrinter = [IntPtr]::Zero
if (-not [RawPrint]::OpenPrinter(\$printerName, [ref]\$hPrinter, [IntPtr]::Zero)) {
  throw "No se pudo abrir la impresora: \$printerName"
}

\$di = New-Object DocInfo
\$di.pDocName    = 'ZPL Label'
\$di.pOutputFile = \$null
\$di.pDataType   = 'RAW'

if ([RawPrint]::StartDocPrinter(\$hPrinter, 1, \$di) -le 0) {
  [RawPrint]::ClosePrinter(\$hPrinter) | Out-Null
  throw "StartDocPrinter falló"
}

[RawPrint]::StartPagePrinter(\$hPrinter) | Out-Null
\$ptr     = [System.Runtime.InteropServices.Marshal]::AllocHGlobal(\$bytes.Length)
[System.Runtime.InteropServices.Marshal]::Copy(\$bytes, 0, \$ptr, \$bytes.Length)
\$written = 0
\$ok      = [RawPrint]::WritePrinter(\$hPrinter, \$ptr, \$bytes.Length, [ref]\$written)
[System.Runtime.InteropServices.Marshal]::FreeHGlobal(\$ptr)
[RawPrint]::EndPagePrinter(\$hPrinter)  | Out-Null
[RawPrint]::EndDocPrinter(\$hPrinter)   | Out-Null
[RawPrint]::ClosePrinter(\$hPrinter)    | Out-Null

if (-not \$ok) { throw "WritePrinter falló — verifique que la impresora acepta datos RAW" }
Write-Output "OK:\$written"
`;
}

// ─── CORS headers ─────────────────────────────────────────────────────────────

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res, status, data) {
  setCors(res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleGetPrinters(res) {
  try {
    const out = await runPowerShell(
      "Get-WmiObject -Query 'SELECT Name,Status FROM Win32_Printer' | Select-Object Name,Status | ConvertTo-Json",
    );
    if (!out) return json(res, 200, { printers: [] });

    const raw = JSON.parse(out);
    const list = Array.isArray(raw) ? raw : [raw];

    json(res, 200, {
      printers: list
        .filter((p) => p?.Name)
        .map((p) => ({ name: String(p.Name), status: String(p.Status ?? "") })),
    });
  } catch (e) {
    json(res, 500, { error: "No se pudieron obtener las impresoras." });
  }
}

async function handlePrintLabel(req, res) {
  let tmpFile = null;
  try {
    // Leer body
    const body = await new Promise((resolve, reject) => {
      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error("JSON inválido"));
        }
      });
      req.on("error", reject);
    });

    const { printerName, zpl } = body;

    // Validaciones
    if (
      typeof printerName !== "string" ||
      printerName.trim().length === 0 ||
      printerName.length > 256
    ) {
      return json(res, 400, { error: "Nombre de impresora inválido." });
    }
    if (typeof zpl !== "string" || zpl.trim().length === 0) {
      return json(res, 400, { error: "Contenido ZPL inválido o vacío." });
    }
    if (zpl.length > 20_000_000) {
      return json(res, 400, { error: "El ZPL supera el límite de 20 MB." });
    }

    // Escribir ZPL en archivo temporal
    const tmpName = `zpl_${randomBytes(8).toString("hex")}.prn`;
    tmpFile = join(tmpdir(), tmpName);
    await writeFile(tmpFile, zpl, "ascii");

    const escapedName = printerName.replace(/'/g, "''");
    const script = buildRawPrintScript(escapedName, tmpFile);
    const result = await runPowerShell(script);

    json(res, 200, { success: true, message: result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    json(res, 500, { error: `Error al imprimir: ${msg}` });
  } finally {
    if (tmpFile) unlink(tmpFile).catch(() => {});
  }
}

// ─── Servidor HTTP ─────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Preflight CORS
  if (req.method === "OPTIONS") {
    setCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    return json(res, 200, { ok: true, version: "1.0" });
  }

  if (req.method === "GET" && url.pathname === "/api/printers") {
    return handleGetPrinters(res);
  }

  if (req.method === "POST" && url.pathname === "/api/print-label") {
    return handlePrintLabel(req, res);
  }

  json(res, 404, { error: "Ruta no encontrada" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n✅ Agente de impresión local corriendo en http://localhost:${PORT}`);
  console.log(`   GET  http://localhost:${PORT}/api/printers`);
  console.log(`   POST http://localhost:${PORT}/api/print-label\n`);
  console.log("   Mantén esta ventana abierta mientras uses la aplicación.");
  console.log("   Presiona Ctrl+C para detener.\n");
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(`\n❌ El puerto ${PORT} ya está en uso. Cierra el proceso anterior.\n`);
  } else {
    console.error("Error en el servidor:", e.message);
  }
  process.exit(1);
});
