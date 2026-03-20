import { type NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";

function runPowerShellScript(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ps = spawn("powershell", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      script,
    ]);
    let out = "";
    let err = "";
    ps.stdout?.on("data", (d: Buffer) => (out += d.toString()));
    ps.stderr?.on("data", (d: Buffer) => (err += d.toString()));
    ps.on("close", (code: number | null) => {
      if (code !== 0) reject(new Error(err.trim() || `Exit ${code}`));
      else resolve(out.trim());
    });
    ps.on("error", reject);
    const timer = setTimeout(() => {
      ps.kill();
      reject(new Error("Timeout de impresión"));
    }, 60_000);
    ps.on("close", () => clearTimeout(timer));
  });
}

/**
 * Envía datos RAW a la impresora usando la API Win32 winspool.Drv a través de PowerShell.
 * El printerName ya viene con comillas simples escapadas ('' en lugar de ').
 */
function buildRawPrintScript(escapedPrinterName: string, zplFilePath: string): string {
  // En PowerShell, las cadenas con comillas simples son literales (sin escape de backslash).
  // Por eso la ruta de Windows con backslashes es segura aquí.
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

export async function POST(req: NextRequest) {
  let tmpFile: string | null = null;
  try {
    const body = await req.json();
    const { printerName, zpl } = body as { printerName: unknown; zpl: unknown };

    // Validación de entrada
    if (
      typeof printerName !== "string" ||
      printerName.trim().length === 0 ||
      printerName.length > 256
    ) {
      return NextResponse.json(
        { error: "Nombre de impresora inválido." },
        { status: 400 },
      );
    }
    if (typeof zpl !== "string" || zpl.trim().length === 0) {
      return NextResponse.json(
        { error: "Contenido ZPL inválido o vacío." },
        { status: 400 },
      );
    }
    if (zpl.length > 20_000_000) {
      return NextResponse.json(
        { error: "El ZPL supera el límite permitido (20 MB)." },
        { status: 400 },
      );
    }

    // Escribir ZPL en archivo temporal
    const tmpName = `zpl_${randomBytes(8).toString("hex")}.prn`;
    tmpFile = join(tmpdir(), tmpName);
    await writeFile(tmpFile, zpl, "ascii");

    // Escapar comillas simples del nombre de impresora para PowerShell
    const escapedName = printerName.replace(/'/g, "''");

    const script = buildRawPrintScript(escapedName, tmpFile);
    const result = await runPowerShellScript(script);

    return NextResponse.json({ success: true, message: result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { error: `Error al imprimir: ${msg}` },
      { status: 500 },
    );
  } finally {
    if (tmpFile) {
      unlink(tmpFile).catch(() => undefined);
    }
  }
}
