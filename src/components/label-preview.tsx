"use client";

import React, { useEffect, useRef } from "react";
import type { ExitoLabelData } from "@/ai/flows/schemas";

// ── Code128B minimal encoder ────────────────────────────────────────────────
const C128_START_B = 104;
const C128_STOP = 106;

const C128_WIDTHS: number[][] = [
  [2, 1, 2, 2, 2, 2],
  [2, 2, 2, 1, 2, 2],
  [2, 2, 2, 2, 2, 1],
  [1, 2, 1, 2, 2, 3],
  [1, 2, 1, 3, 2, 2],
  [1, 3, 1, 2, 2, 2],
  [1, 2, 2, 2, 1, 3],
  [1, 2, 2, 3, 1, 2],
  [1, 3, 2, 2, 1, 2],
  [2, 2, 1, 2, 1, 3],
  [2, 2, 1, 3, 1, 2],
  [2, 3, 1, 2, 1, 2],
  [1, 1, 2, 2, 3, 2],
  [1, 2, 2, 1, 3, 2],
  [1, 2, 2, 2, 3, 1],
  [1, 1, 3, 2, 2, 2],
  [1, 2, 3, 1, 2, 2],
  [1, 2, 3, 2, 2, 1],
  [2, 2, 3, 2, 1, 1],
  [2, 2, 1, 1, 3, 2],
  [2, 2, 1, 2, 3, 1],
  [2, 1, 3, 2, 1, 2],
  [2, 2, 3, 1, 1, 2],
  [3, 1, 2, 1, 3, 1],
  [3, 1, 1, 2, 2, 2],
  [3, 2, 1, 1, 2, 2],
  [3, 2, 1, 2, 2, 1],
  [3, 1, 2, 2, 1, 2],
  [3, 2, 2, 1, 1, 2],
  [3, 2, 2, 2, 1, 1],
  [2, 1, 2, 1, 2, 3],
  [2, 1, 2, 3, 2, 1],
  [2, 3, 2, 1, 2, 1],
  [1, 1, 1, 3, 2, 3],
  [1, 3, 1, 1, 2, 3],
  [1, 3, 1, 3, 2, 1],
  [1, 1, 2, 3, 1, 3],
  [1, 3, 2, 1, 1, 3],
  [1, 3, 2, 3, 1, 1],
  [2, 1, 1, 3, 1, 3],
  [2, 3, 1, 1, 1, 3],
  [2, 3, 1, 3, 1, 1],
  [1, 1, 2, 1, 3, 3],
  [1, 1, 2, 3, 3, 1],
  [1, 3, 2, 1, 3, 1],
  [1, 1, 3, 1, 2, 3],
  [1, 1, 3, 3, 2, 1],
  [1, 3, 3, 1, 2, 1],
  [3, 1, 3, 1, 2, 1],
  [2, 1, 1, 3, 3, 1],
  [2, 3, 1, 1, 3, 1],
  [2, 1, 3, 1, 1, 3],
  [2, 1, 3, 3, 1, 1],
  [2, 1, 3, 1, 3, 1],
  [3, 1, 1, 1, 2, 3],
  [3, 1, 1, 3, 2, 1],
  [3, 3, 1, 1, 2, 1],
  [3, 1, 2, 1, 1, 3],
  [3, 1, 2, 3, 1, 1],
  [3, 3, 2, 1, 1, 1],
  [3, 1, 4, 1, 1, 1],
  [2, 2, 1, 4, 1, 1],
  [4, 3, 1, 1, 1, 1],
  [1, 1, 1, 2, 2, 4],
  [1, 1, 1, 4, 2, 2],
  [1, 2, 1, 1, 2, 4],
  [1, 2, 1, 4, 2, 1],
  [1, 4, 1, 1, 2, 2],
  [1, 4, 1, 2, 2, 1],
  [1, 1, 2, 2, 1, 4],
  [1, 1, 2, 4, 1, 2],
  [1, 2, 2, 1, 1, 4],
  [1, 2, 2, 4, 1, 1],
  [1, 4, 2, 1, 1, 2],
  [1, 4, 2, 2, 1, 1],
  [2, 4, 1, 2, 1, 1],
  [2, 2, 1, 1, 1, 4],
  [4, 1, 3, 1, 1, 1],
  [2, 4, 1, 1, 1, 2],
  [1, 3, 4, 1, 1, 1],
  [1, 1, 1, 2, 4, 2],
  [1, 2, 1, 1, 4, 2],
  [1, 2, 1, 2, 4, 1],
  [1, 1, 4, 2, 1, 2],
  [1, 2, 4, 1, 1, 2],
  [1, 2, 4, 2, 1, 1],
  [4, 1, 1, 2, 1, 2],
  [4, 2, 1, 1, 1, 2],
  [4, 2, 1, 2, 1, 1],
  [2, 1, 2, 1, 4, 1],
  [2, 1, 4, 1, 2, 1],
  [4, 1, 2, 1, 2, 1],
  [1, 1, 1, 1, 4, 3],
  [1, 1, 1, 3, 4, 1],
  [1, 3, 1, 1, 4, 1],
  [1, 1, 4, 1, 1, 3],
  [1, 1, 4, 3, 1, 1],
  [4, 1, 1, 1, 1, 3],
  [4, 1, 1, 3, 1, 1],
  [1, 1, 3, 1, 4, 1],
  [1, 1, 4, 1, 3, 1],
  [3, 1, 1, 1, 4, 1],
  [4, 1, 1, 1, 3, 1],
  [2, 1, 1, 4, 1, 2],
  [2, 1, 1, 2, 1, 4],
  [2, 1, 1, 2, 3, 2],
  [2, 3, 3, 1, 1, 1],
  [1, 1, 2, 1, 4, 2],
];

function encodeCode128(text: string): boolean[] {
  const chars = text.split("").map((c) => c.charCodeAt(0) - 32);
  const codes = [C128_START_B, ...chars];
  const check =
    (C128_START_B + chars.reduce((s, c, i) => s + c * (i + 1), 0)) % 103;
  codes.push(check, C128_STOP);

  const bits: boolean[] = [];
  const pushPattern = (idx: number) => {
    const w = C128_WIDTHS[idx] ?? C128_WIDTHS[0];
    w.forEach((width, i) => {
      const dark = i % 2 === 0;
      for (let j = 0; j < width; j++) bits.push(dark);
    });
  };
  codes.forEach(pushPattern);
  // termination bar
  bits.push(true, true);
  return bits;
}

interface BarcodeProps {
  value: string;
  height?: number;
}

function Barcode({ value, height = 60 }: BarcodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bits = encodeCode128(value.replace(/[^ -~]/g, "?"));
    const scale = 2;
    canvas.width = bits.length * scale;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    bits.forEach((dark, i) => {
      if (dark) {
        ctx.fillStyle = "#000";
        ctx.fillRect(i * scale, 0, scale, height);
      }
    });
  }, [value, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ height, imageRendering: "pixelated", width: "100%" }}
    />
  );
}

// ── Label Preview ────────────────────────────────────────────────────────────
interface LabelPreviewProps {
  label: ExitoLabelData;
}

export function LabelPreview({ label }: LabelPreviewProps) {
  return (
    <div
      className="bg-white font-mono"
      style={{
        width: 400,
        border: "1px solid #ccc",
        padding: "10px 12px",
        fontSize: 11,
        lineHeight: "1.5",
        color: "#000",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: 4 }}>
        {label.nc}
      </div>

      {/* Barcode zone */}
      <div
        style={{
          borderTop: "2px solid #000",
          borderBottom: "2px solid #000",
          paddingTop: 6,
          paddingBottom: 4,
          marginBottom: 4,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 10 }}>CCL</span>
          <div style={{ flex: 1 }}>
            <Barcode value={label.ct || "0000000000000"} height={56} />
          </div>
          {/* <span style={{ fontSize: 10, whiteSpace: "nowrap" }}>
            {label.cedi}
          </span> */}
        </div>
        <div
          style={{
            textAlign: "center",
            fontSize: 12,
            fontWeight: "bold",
            letterSpacing: 2,
            marginTop: 2,
          }}
        >
          {label.ct}
        </div>
      </div>

      {/* Info fields */}
      <div
        style={{
          borderBottom: "1px solid #000",
          paddingBottom: 3,
          marginBottom: 3,
        }}
      >
        <div>
          <strong>TIENDA:</strong> {label.tienda}
        </div>
        <div>
          <strong>DIRECCION:</strong> {label.direccion}
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <span>
            <strong>DEPARTAMENTO:</strong> {label.depto}
          </span>
          <span>
            <strong>CIUDAD:</strong> {label.ciudad}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>
            <strong>CAJAS:</strong> {label.numeroCaja} de {label.totalCajas}
          </span>
          <span>
            <strong>ORD COMPRA:</strong> {label.orden}
          </span>
          <span>
            <strong>ALMACENES EXITO</strong>
          </span>
        </div>
      </div>

      {/* Description */}
      <div style={{ fontSize: 11, fontWeight: "bold" }}>{label.desc}</div>
      <div style={{ fontSize: 11, marginTop: 2 }}>
        <strong>COD BARRA:</strong> {label.codigoBarra}
      </div>
    </div>
  );
}
