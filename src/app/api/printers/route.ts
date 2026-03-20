import { NextResponse } from "next/server";
import { spawn } from "child_process";

function runPowerShell(script: string): Promise<string> {
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
      if (code !== 0) reject(new Error(err || `Exit ${code}`));
      else resolve(out.trim());
    });
    ps.on("error", reject);
    const timer = setTimeout(() => {
      ps.kill();
      reject(new Error("Timeout al listar impresoras"));
    }, 10_000);
    ps.on("close", () => clearTimeout(timer));
  });
}

export async function GET() {
  try {
    const out = await runPowerShell(
      "Get-WmiObject -Query 'SELECT Name,Status FROM Win32_Printer' | Select-Object Name,Status | ConvertTo-Json",
    );

    if (!out) return NextResponse.json({ printers: [] });

    const raw = JSON.parse(out);
    const list: { Name: string; Status: string }[] = Array.isArray(raw)
      ? raw
      : [raw];

    return NextResponse.json({
      printers: list
        .filter((p) => p?.Name)
        .map((p) => ({ name: String(p.Name), status: String(p.Status ?? "") })),
    });
  } catch {
    return NextResponse.json(
      { error: "No se pudieron obtener las impresoras." },
      { status: 500 },
    );
  }
}
