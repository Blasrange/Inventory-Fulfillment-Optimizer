// Interfaz para las filas del Excel de Surtido Inteligente
export interface SurtidoSheetRow {
  SKU: string;
  Descripción: string;
  "Ubicación Destino": string;
  "LPN Destino": string;
  Vendida: number;
  "Stock Picking": number;
  "Cant. a Surtir": number;
  "Ubicación Origen": string;
  "LPN Origen": string;
  Lote?: string;
  "Fecha Vencimiento"?: string;
  Tipo?: string;
  Estiba?: string;
  "Alerta Surtido"?: string;
}
// Lógica compartida para análisis y generación de Excel de Surtido Inteligente
// Este archivo se puede usar tanto en frontend como en backend

import * as XLSX from 'xlsx';

// Utilidad para aplicar estilos modernos a la hoja Excel
export function aplicarEstilosModernos(
  ws: XLSX.WorkSheet,
  options: { filaTotales?: number; columnaEstado?: number; columnaValor?: number[] } = {}
) {
  const { filaTotales, columnaEstado } = options;
  if (filaTotales !== undefined) {
    const rango = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
    for (let col = rango.s.c; col <= rango.e.c; col++) {
      const celda = ws[XLSX.utils.encode_cell({ r: filaTotales, c: col })];
      if (celda) {
        celda.s = {
          font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "5D9B9B" } },
          border: {
            top: { style: "thin", color: { rgb: "CCCCCC" } },
            bottom: { style: "thin", color: { rgb: "CCCCCC" } },
            left: { style: "thin", color: { rgb: "CCCCCC" } },
            right: { style: "thin", color: { rgb: "CCCCCC" } },
          },
        };
      }
    }
  }
  if (columnaEstado !== undefined) {
    const rango = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
    for (let fila = rango.s.r + 1; fila <= rango.e.r; fila++) {
      if (fila === filaTotales) continue;
      const celda = ws[XLSX.utils.encode_cell({ r: fila, c: columnaEstado })];
      if (celda?.v) {
        const valor = String(celda.v);
        if (
          valor.includes("Sobrante") ||
          valor === "OK" ||
          valor.includes("Completos") ||
          valor === "CUMPLE"
        ) {
          celda.s = { fill: { fgColor: { rgb: "E2F0D9" } } };
        } else if (
          valor.includes("Faltante") ||
          valor.includes("Sin origen") ||
          valor === "ALERTA"
        ) {
          celda.s = { fill: { fgColor: { rgb: "FCE4D6" } } };
        } else if (valor.includes("Unidades")) {
          celda.s = { fill: { fgColor: { rgb: "FFF2CC" } } };
        } else if (valor.includes("Reserva")) {
          celda.s = { fill: { fgColor: { rgb: "D9E1F2" } } };
        } else if (valor.includes("Mixto")) {
          celda.s = { fill: { fgColor: { rgb: "FFE699" } } };
        }
      }
    }
  }
  const wscols = [];
  const rango = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
  for (let col = rango.s.c; col <= rango.e.c; col++) {
    let maxLength = 0;
    for (let fila = rango.s.r; fila <= rango.e.r; fila++) {
      const celda = ws[XLSX.utils.encode_cell({ r: fila, c: col })];
      if (celda?.v) maxLength = Math.max(maxLength, String(celda.v).length);
    }
    wscols.push({ wch: Math.min(Math.max(maxLength + 2, 12), 50) });
  }
  ws["!cols"] = wscols;
}

export function agregarFilaTotales<T extends Record<string, any>>(
  data: T[],
  totales: Record<string, number>,
): T[] {
  if (data.length === 0) return data;
  const filaTotales = { ...data[0] } as any;
  Object.keys(filaTotales).forEach((key) => (filaTotales[key] = ""));
  filaTotales[Object.keys(data[0])[0]] = "🔹 TOTALES";
  Object.entries(totales).forEach(([key, valor]) => {
    if (filaTotales.hasOwnProperty(key)) filaTotales[key] = valor;
  });
  return [...data, filaTotales];
}

// Genera el Excel de Surtido Inteligente a partir de las sugerencias
export function generateSurtidoInteligenteExcel(suggestions: any[]) {
  const wb = XLSX.utils.book_new();
  const sheetData: SurtidoSheetRow[] = [];
  suggestions.forEach((s) => {
    const esAltoValor = s.prioridadAlta === true && s.cantidadARestockear > 0;
    const tagAltoValor = esAltoValor ? "🔥 Alto valor, surtido extra" : "";
    if (s.ubicacionesSugeridas?.length) {
      s.ubicacionesSugeridas.forEach((u: { cantidad: any; localizacion: any; lpn: any; lote: any; fechaVencimiento: any; esEstibaCompleta: any; }) => {
        const cantASurtir = s.cantidadARestockear > 0 ? u.cantidad : 0;
        sheetData.push({
          SKU: s.sku,
          Descripción: s.descripcion?.substring(0, 83) + (s.descripcion?.length > 83 ? "..." : ""),
          "Ubicación Destino": s.localizacionDestino || "",
          "LPN Destino": s.lpnDestino || "",
          Vendida: s.cantidadVendida || "",
          "Stock Picking": s.cantidadDisponible || "",
          "Cant. a Surtir": cantASurtir,
          "Ubicación Origen": u.localizacion || "",
          "LPN Origen": u.lpn || "",
          Lote: u.lote || "",
          "Fecha Vencimiento": u.fechaVencimiento || "",
          Tipo: cantASurtir > 0 ? (u.esEstibaCompleta ? "✅ Pallet Completo" : "🔄 Unidades Parciales") : "⏹️ OK",
          Estiba: u.esEstibaCompleta ? "📦 SI" : "📦 NO",
          "Alerta Surtido": tagAltoValor,
        });
      });
    } else {
      sheetData.push({
        SKU: s.sku,
        Descripción: s.descripcion?.substring(0, 83),
        "Ubicación Destino": s.localizacionDestino || "",
        "LPN Destino": s.lpnDestino || "",
        Vendida: s.cantidadVendida || "",
        "Stock Picking": s.cantidadDisponible || "",
        "Cant. a Surtir": s.cantidadARestockear || 0,
        "Ubicación Origen": "",
        "LPN Origen": "",
        Lote: "",
        "Fecha Vencimiento": "",
        Tipo: s.cantidadARestockear > 0 ? "❌ No disponible" : "⏹️ OK",
        Estiba: "N/A",
        "Alerta Surtido": tagAltoValor,
      });
    }
  });
  // Fila de totales
  const totalCantidadSurtir = sheetData.reduce((sum, row) => sum + (row["Cant. a Surtir"] || 0), 0);
  sheetData.push({
    SKU: "🔸 RESUMEN",
    Descripción: "TOTALES GENERALES",
    "Ubicación Destino": "",
    "LPN Destino": "",
    Vendida: sheetData.reduce((sum, row) => sum + (row["Vendida"] || 0), 0),
    "Stock Picking": sheetData.reduce((sum, row) => sum + (row["Stock Picking"] || 0), 0),
    "Cant. a Surtir": totalCantidadSurtir,
    "Ubicación Origen": "",
    "LPN Origen": "",
    Tipo: "",
    Estiba: "",
  });
  const ws = XLSX.utils.json_to_sheet(sheetData);
  aplicarEstilosModernos(ws, {
    filaTotales: sheetData.length - 1,
    columnaEstado: Object.keys(sheetData[0]).indexOf("Tipo"),
  });
  XLSX.utils.book_append_sheet(wb, ws, "Surtido Inteligente");
  const fileBase64 = XLSX.write(wb, {
    type: "base64",
    bookType: "xls",
  });
  return {
    fileBase64,
    filename: `Surtido_Inteligente_${new Date().toISOString().slice(0, 10)}.xls`,
  };
}
