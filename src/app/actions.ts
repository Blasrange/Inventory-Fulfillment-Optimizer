"use server";

import {
  generateSalesAnalysis,
  type AnalysisResult,
} from "@/ai/flows/sales-analysis";
import { generateLevelsAnalysis } from "@/ai/flows/levels-analysis";
import { runInventoryCross } from "@/ai/flows/inventory-cross";
import { runInboundProcess } from "@/ai/flows/inbound";
import { runShelfLifeAnalysis } from "@/ai/flows/shelf-life";
import * as XLSX from "xlsx";
import type {
  GenerateRestockSuggestionsOutput,
  MissingProductsOutput,
  InventoryCrossResult,
  InboundResult,
  ShelfLifeResult,
} from "@/ai/flows/schemas";

// ============================================================================
// FORMATO EXCEL
// ============================================================================
function aplicarEstilosModernos(
  ws: XLSX.WorkSheet,
  options: {
    filaTotales?: number;
    columnaEstado?: number;
    columnaValor?: number[];
  } = {},
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
          celda.s = { fill: { fgColor: { rgb: "FFE699" } } }; // Color para lotes mixtos
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

function agregarFilaTotales<T extends Record<string, any>>(
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

// ============================================================================
// ANÁLISIS DE INVENTARIO
// ============================================================================
export async function runAnalysis(
  analysisMode: "sales" | "levels" | "cross" | "inbound" | "shelfLife",
  inventoryData: any[] | null,
  salesData: any[] | null,
  minMaxData: any[] | null,
  sapData: any[] | null,
  wmsData: any[] | null,
  shelfLifeMasterData: any[] | null,
  groupByLot?: boolean,
  inboundInput?: {
    rows: any[];
    mapping: Record<string, string>;
    fixedValues: Record<string, string>;
  },
): Promise<{
  data?:
    | AnalysisResult
    | InventoryCrossResult
    | InboundResult
    | ShelfLifeResult;
  error?: string;
}> {
  try {
    if (analysisMode === "sales") {
      if (!inventoryData || !salesData)
        return { error: "❌ Faltan los datos de inventario o facturación." };
      return {
        data: await generateSalesAnalysis({ inventoryData, salesData }),
      };
    }

    if (analysisMode === "levels") {
      if (!inventoryData || !minMaxData)
        return { error: "❌ Faltan los datos de inventario o Mín/Máx." };
      return {
        data: await generateLevelsAnalysis({ inventoryData, minMaxData }),
      };
    }

    if (analysisMode === "cross") {
      if (!sapData || !wmsData)
        return { error: "❌ Faltan los datos de SAP o WMS para el cruce." };
      return {
        data: await runInventoryCross({
          sapData,
          wmsData,
          groupByLot: !!groupByLot,
        }),
      };
    }

    if (analysisMode === "inbound") {
      if (!inboundInput)
        return { error: "❌ Faltan datos para el mapeo de entrada." };
      return {
        data: await runInboundProcess(inboundInput),
      };
    }

    if (analysisMode === "shelfLife") {
      if (!inventoryData || !shelfLifeMasterData)
        return {
          error: "❌ Faltan los datos de inventario o Maestra de Vida Útil.",
        };
      return {
        data: await runShelfLifeAnalysis({
          inventoryData,
          shelfLifeMasterData,
        }),
      };
    }

    return { error: "❌ Modo de análisis no válido." };
  } catch (e) {
    console.error("Error en análisis:", e);
    return {
      error: `❌ Error al procesar: ${e instanceof Error ? e.message : "Error inesperado"}`,
    };
  }
}

// ============================================================================
// EXPORTACIÓN EXCEL ENTRADAS
// ============================================================================
export async function generateInboundExcel(
  data: any[],
): Promise<{ file: string; filename: string }> {
  // Función auxiliar para formatear fechas
  const formatearFecha = (fecha: any): string => {
    if (!fecha) return "";

    try {
      // Si ya es un string, intentamos parsearlo
      let fechaObj: Date | null = null;

      if (fecha instanceof Date) {
        fechaObj = fecha;
      } else if (typeof fecha === "string") {
        // Intentamos diferentes formatos de fecha
        const timestamp = Date.parse(fecha);
        if (!isNaN(timestamp)) {
          fechaObj = new Date(timestamp);
        }
      } else if (typeof fecha === "number") {
        // Si es número, asumimos que es timestamp
        fechaObj = new Date(fecha);
      }

      if (fechaObj && !isNaN(fechaObj.getTime())) {
        const dia = fechaObj.getUTCDate().toString().padStart(2, "0");
        const mes = (fechaObj.getUTCMonth() + 1).toString().padStart(2, "0");
        const anio = fechaObj.getUTCFullYear();
        return `${dia}/${mes}/${anio}`;
      }
    } catch (e) {
      console.warn("Error formateando fecha:", e);
    }

    // Si no podemos formatear, devolvemos el valor original como string
    return fecha?.toString() || "";
  };

  // Procesamos los datos para formatear las fechas ANTES de convertirlos a hoja
  const datosFormateados = data.map((item) => ({
    N_ORDER: item.N_ORDER || "",
    ORDER2: item.ORDER2 || "",
    PURCHASE_ORDER: item.PURCHASE_ORDER || "",
    INVOICE: item.INVOICE || "",
    PROVIDER_UID: item.PROVIDER_UID || "",
    ORDER_DATE: formatearFecha(item.ORDER_DATE),
    SERVICE_DATE: formatearFecha(item.SERVICE_DATE),
    INBOUNDTYPE_CODE: item.INBOUNDTYPE_CODE || "",
    NOTE: item.NOTE || "",
    SKU: item.SKU || "",
    LOTE: item.LOTE || "",
    FECHA_DE_VENCIMIENTO: formatearFecha(item.FECHA_DE_VENCIMIENTO),
    FECHA_DE_FABRICACION: formatearFecha(item.FECHA_DE_FABRICACION),
    SERIAL: item.SERIAL || "",
    ESTADO_CALIDAD: item.ESTADO_CALIDAD || "",
    QTY: item.QTY || 0,
    UOM_CODE: item.UOM_CODE || "",
    REFERENCE: item.REFERENCE || "",
    PRICE: item.PRICE || "",
    TAXES: item.TAXES || "",
    IBL_LPN_CODE: item.IBL_LPN_CODE || "",
    IBL_WEIGHT: item.IBL_WEIGHT || "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(datosFormateados, {
    header: [
      "N_ORDER",
      "ORDER2",
      "PURCHASE_ORDER",
      "INVOICE",
      "PROVIDER_UID",
      "ORDER_DATE",
      "SERVICE_DATE",
      "INBOUNDTYPE_CODE",
      "NOTE",
      "SKU",
      "LOTE",
      "FECHA_DE_VENCIMIENTO",
      "FECHA_DE_FABRICACION",
      "SERIAL",
      "ESTADO_CALIDAD",
      "QTY",
      "UOM_CODE",
      "REFERENCE",
      "PRICE",
      "TAXES",
      "IBL_LPN_CODE",
      "IBL_WEIGHT",
    ],
  });

  // Opcional: Aplicar formato de texto a las columnas de fecha para asegurar que Excel las trate como texto
  const rango = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");

  // Índices de las columnas de fecha (basado en el header)
  const columnasFecha = [
    "ORDER_DATE",
    "SERVICE_DATE",
    "FECHA_DE_VENCIMIENTO",
    "FECHA_DE_FABRICACION",
  ];

  const headerRow =
    datosFormateados.length > 0 ? Object.keys(datosFormateados[0]) : [];
  const indicesFecha = columnasFecha
    .map((col) => headerRow.indexOf(col))
    .filter((idx) => idx !== -1);

  // Para cada fila de datos (omitimos el header porque ya lo manejamos con json_to_sheet)
  for (let fila = rango.s.r + 1; fila <= rango.e.r; fila++) {
    indicesFecha.forEach((col) => {
      const direccion = XLSX.utils.encode_cell({ r: fila, c: col });
      if (ws[direccion]) {
        // Forzar que la celda sea tratada como texto
        ws[direccion].t = "s"; // 's' significa string en la librería xlsx
      }
    });
  }

  XLSX.utils.book_append_sheet(wb, ws, "INBOUND");

  // ================= DATOS MAESTROS - FORMATO BONITO =====================
  const datos = [
    // Tipos de Entrada
    ["📦 Tipos de pedidos de Entrada"],
    ["Código", "Nombre", "Estado"],
    ["101", "Entr. mercancías EM", "A"],
    ["202", "DM p.centro de cost", "A"],
    ["602", "DM AnulEntregSalMcí", "A"],
    ["653", "EntregMcía:DevLibUt", "A"],
    ["657", "EntregMcía:DevolBlo", "A"],
    ["EXD", "Entrada por Devolucion", "A"],
    ["EXN", "ENTRADA POR NO INGRESO EN TRASLADO", "A"],
    ["ZC1", "Mcía.defect.lib-CS", "A"],
    ["ZJ8", "DM AnulEntregSalMcía", "A"],
    ["ZS2", "DM mcía.def.bloq-CS", "A"],
    ["ZS6", "DM mcía.def.bloq-ES", "A"],
    [],
    ["══════════════════════════"],
    [],

    // Estados de Calidad
    ["✅ Estados de Calidad"],
    ["Código", "Nombre", "Estado"],
    ["X", "LOTE NO LIBRE", "A"],
    ["SV", "SALVAGE", "A"],
    ["BPV", "BLOQUEO X VERIFICACION", "A"],
    ["L", "STOCK EN ALMACEN LIBRE", "A"],
    ["S", "BLOQUEO LOGISTICO", "A"],
    ["Q", "BLOQUEADO CALIDAD", "A"],
    ["AOP", "AVERIA ORIGEN PLANTA", "A"],
    ["AC", "BLOQUEADO POR AVERIA", "A"],
    [],
    ["══════════════════════════"],
    [],

    // Proveedores
    ["🏢 Proveedores"],
    ["Nit", "Proveedor", "Ciudad"],
    ["830050346-8", "NESTLE PURINA PET CARE DE COLOMBIA", "MEDELLIN"],
    ["860002130", "NESTLÉ PURINA PET CARE", "LA ESTRELLA"],
    ["9005222651", "AGRO UNION PURINA S.A.S.", "LA UNION"],
  ];

  // Crear la hoja de Excel
  const wsDatosMaestros = XLSX.utils.aoa_to_sheet(datos);

  // Ajustar ancho de columnas
  wsDatosMaestros["!cols"] = [{ wch: 20 }, { wch: 30 }];

  // Agregar al libro
  XLSX.utils.book_append_sheet(wb, wsDatosMaestros, "Datos Maestros");

  // CAMBIO IMPORTANTE: Usar bookType "xls" para Excel 97-2003
  const fileBase64 = XLSX.write(wb, {
    type: "base64",
    bookType: "xls", // Cambiado de "xlsx" a "xls"
  });

  return {
    file: fileBase64,
    filename: `Entrada_WMS_${new Date().toISOString().slice(0, 10)}.xls`, // Cambiado a .xls
  };
}

// ============================================================================
// ARCHIVOS WMS
// ============================================================================
export async function generateWmsFiles(
  suggestions: GenerateRestockSuggestionsOutput,
  analysisMode: "sales" | "levels",
): Promise<{ data?: { file: string; filename: string }; error?: string }> {
  try {
    const tasks = suggestions.filter((s) => s.cantidadARestockear > 0);
    if (tasks.length === 0)
      return { error: "📦 No hay sugerencias de surtido para exportar." };

    if (analysisMode === "sales") {
      const file1Data = tasks.flatMap((task) =>
        task.ubicacionesSugeridas
          .filter((ubicacion) => !ubicacion.esEstibaCompleta) // Solo unidades parciales para LTLD
          .map((ubicacion) => ({
            LTLD_LPN_SRC: ubicacion.lpn || "",
            LTLD_SKU: task.sku,
            LTLD_LOT: "",
            LTLD_QTY: ubicacion.cantidad,
            LTLD_LPN_DST: task.lpnDestino || "",
            LTLD_LOCATION_DST: task.localizacionDestino || "",
          })),
      );

      if (file1Data.length === 0)
        return {
          error: "📄 No se encontraron datos para generar el archivo LRLD.",
        };

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(file1Data);
      aplicarEstilosModernos(ws);
      XLSX.utils.book_append_sheet(wb, ws, "LRLD");

      return {
        data: {
          file: XLSX.write(wb, {
            type: "base64",
            bookType: "xls",
          }),
          filename: "Traslados_Masivos_WMS.xls",
        },
      };
    }

    const file2Data = tasks.flatMap((task) =>
      task.ubicacionesSugeridas.map((ubicacion) => ({
        LTLD_LPN_SRC: ubicacion.lpn || "",
        LTLD_SKU: task.sku,
        LTLD_LOT: "",
        LTLD_QTY: ubicacion.cantidad,
        LTLD_LPN_DST: task.lpnDestino || "",
        LTLD_LOCATION_DST: task.localizacionDestino || "",
      })),
    );

    if (file2Data.length === 0)
      return {
        error: "📄 No se encontraron datos para generar el archivo LTLD.",
      };

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(file2Data);
    aplicarEstilosModernos(ws);
    XLSX.utils.book_append_sheet(wb, ws, "LTLD");

    return {
      data: {
        file: XLSX.write(wb, {
          type: "base64",
          bookType: "xls",
        }),
        filename: "Traslados_Masivos_WMS.xls",
      },
    };
  } catch (e) {
    console.error("Error generando archivos WMS:", e);
    return {
      error: `❌ Error al generar los archivos: ${e instanceof Error ? e.message : "Error inesperado"}`,
    };
  }
}

// ============================================================================
// REPORTES COMPLETOS
// ============================================================================
export async function generateFullReportFile(
  suggestions: GenerateRestockSuggestionsOutput | null,
  missingProducts: MissingProductsOutput[] | null,
  analysisMode: "sales" | "levels" | "cross" | "shelfLife",
  crossResults?: any[] | null,
  shelfLifeResults?: any[] | null,
): Promise<{ data?: { file: string; filename: string }; error?: string }> {
  try {
    const wb = XLSX.utils.book_new();

    // REPORTE VIDA ÚTIL
    if (analysisMode === "shelfLife" && shelfLifeResults?.length) {
      const sheetData = shelfLifeResults.map((item: any) => ({
        SKU: item.sku,
        Descripción: item.descripcion,
        LPN: item.lpn,
        Ubicación: item.localizacion,
        Lote: item.lote || "S/L",
        "Fecha de Vencimiento": item.fechaVencimiento || "S/F",
        "Días Actuales (FPC)": item.diasFPC,
        "Vida Útil Límite": item.diasMinimosMaestra,
        Estado: item.cumple ? "✅ OK" : "❌ EXCEDIDO",
      }));

      const ws = XLSX.utils.json_to_sheet(sheetData);
      aplicarEstilosModernos(ws, {
        columnaEstado: Object.keys(sheetData[0]).indexOf("Estado"),
      });
      XLSX.utils.book_append_sheet(wb, ws, "Vida Útil");
    }

    // REPORTE CRUCE
    else if (analysisMode === "cross" && crossResults?.length) {
      const sortedCrossResults = [...crossResults].sort(
        (a, b) => b.diferencia - a.diferencia,
      );

      const sheetData = sortedCrossResults.map((item: any) => ({
        SKU: item.sku,
        Lote: item.lote || "S/L",
        Descripción: item.descripcion || "",
        "Stock SAP": item.cantidadSap || 0,
        "Stock WMS": item.cantidadWms || 0,
        Diferencia: item.diferencia || 0,
        Estado:
          item.diferencia > 0
            ? "✅Sobrante"
            : item.diferencia < 0
              ? "❌Faltante"
              : "⏹️ OK",
      }));

      const totales = {
        "Stock SAP": sheetData.reduce(
          (sum, item) => sum + item["Stock SAP"],
          0,
        ),
        "Stock WMS": sheetData.reduce(
          (sum, item) => sum + item["Stock WMS"],
          0,
        ),
        Diferencia: sheetData.reduce((sum, item) => sum + item.Diferencia, 0),
      };

      const dataConTotales = agregarFilaTotales(sheetData, totales);
      const ws = XLSX.utils.json_to_sheet(dataConTotales);

      aplicarEstilosModernos(ws, {
        filaTotales: dataConTotales.length - 1,
        columnaEstado: Object.keys(sheetData[0]).indexOf("Estado"),
      });

      XLSX.utils.book_append_sheet(wb, ws, "📊 Cruce SAP vs WMS");

      // ========================================================================
      // HOJA DE RESUMEN DE VALORES - ANÁLISIS COMPLETO POR SKU Y POR LOTE
      // ========================================================================

      // ------------------------------------------------------------------------
      // 1. ANÁLISIS POR SKU (PRODUCTO)
      // ------------------------------------------------------------------------
      const totalSap = crossResults.reduce(
        (sum, item: any) => sum + (item.cantidadSap || 0),
        0,
      );
      const totalWms = crossResults.reduce(
        (sum, item: any) => sum + (item.cantidadWms || 0),
        0,
      );

      const totalSobranteUnidades = crossResults
        .filter((item: any) => item.diferencia > 0)
        .reduce((sum, item) => sum + item.diferencia, 0);

      const totalFaltanteUnidades = crossResults
        .filter((item: any) => item.diferencia < 0)
        .reduce((sum, item) => sum + Math.abs(item.diferencia), 0);

      const totalSKUsSobrantes = crossResults.filter(
        (item: any) => item.diferencia > 0,
      ).length;
      const totalSKUsFaltantes = crossResults.filter(
        (item: any) => item.diferencia < 0,
      ).length;
      const totalSKUsOK = crossResults.filter(
        (item: any) => item.diferencia === 0,
      ).length;

      // ------------------------------------------------------------------------
      // 2. ANÁLISIS POR LOTE - CON DETECCIÓN DE LOTES MIXTOS
      // ------------------------------------------------------------------------

      // Agrupar por lote para análisis a nivel de lote
      const lotesMap = new Map();

      crossResults.forEach((item: any) => {
        const claveLote = item.lote || "S/L";
        if (!lotesMap.has(claveLote)) {
          lotesMap.set(claveLote, {
            lote: claveLote,
            tieneSobrante: false,
            tieneFaltante: false,
            tieneOK: true,
            totalDiferencia: 0,
            cantidadItems: 0,
            itemsSobrantes: 0,
            itemsFaltantes: 0,
            itemsOK: 0,
            skusSobrantes: [], // Para debug/ análisis detallado
            skusFaltantes: [], // Para debug/ análisis detallado
          });
        }

        const loteInfo = lotesMap.get(claveLote);
        loteInfo.cantidadItems++;
        loteInfo.totalDiferencia += item.diferencia || 0;

        // Clasificar el estado de este item
        if (item.diferencia > 0) {
          loteInfo.tieneSobrante = true;
          loteInfo.tieneOK = false;
          loteInfo.itemsSobrantes++;
          loteInfo.skusSobrantes.push({
            sku: item.sku,
            diferencia: item.diferencia,
          });
        } else if (item.diferencia < 0) {
          loteInfo.tieneFaltante = true;
          loteInfo.tieneOK = false;
          loteInfo.itemsFaltantes++;
          loteInfo.skusFaltantes.push({
            sku: item.sku,
            diferencia: item.diferencia,
          });
        } else {
          loteInfo.itemsOK++;
        }
      });

      const lotesArray = Array.from(lotesMap.values());

      // Clasificar lotes según su estado general
      let lotesSoloSobrantes = 0;
      let lotesSoloFaltantes = 0;
      let lotesMixtos = 0; // Tienen tanto sobrante como faltante
      let lotesOK = 0;

      // Array para almacenar detalles de lotes mixtos (para posible hoja adicional)
      const lotesMixtosDetalle: any[] = [];

      lotesArray.forEach((lote) => {
        if (lote.tieneSobrante && lote.tieneFaltante) {
          lotesMixtos++;
          lotesMixtosDetalle.push({
            Lote: lote.lote,
            "SKUs con Sobrante": lote.itemsSobrantes,
            "SKUs con Faltante": lote.itemsFaltantes,
            "Diferencia Neta": lote.totalDiferencia,
            Estado: "🟡 Mixto",
          });
        } else if (lote.tieneSobrante) {
          lotesSoloSobrantes++;
        } else if (lote.tieneFaltante) {
          lotesSoloFaltantes++;
        } else if (lote.tieneOK) {
          lotesOK++;
        }
      });

      const totalLotes = lotesArray.length;
      const lotesConNovedad =
        lotesSoloSobrantes + lotesSoloFaltantes + lotesMixtos;

      // ------------------------------------------------------------------------
      // CONSTRUCCIÓN DE LA HOJA DE RESUMEN
      // ------------------------------------------------------------------------
      const resumenData = [
        // ========== SECCIÓN 1: STOCK TOTAL ==========
        { Concepto: "🏭 STOCK TOTAL", Valor: "", Unidad: "" },
        { Concepto: "  • Stock SAP", Valor: totalSap, Unidad: "Unidades" },
        { Concepto: "  • Stock WMS", Valor: totalWms, Unidad: "Unidades" },
        {
          Concepto: "  • Diferencia Total",
          Valor: totalSap - totalWms,
          Unidad: "Unidades",
        },
        { Concepto: "", Valor: "", Unidad: "" },

        // ========== SECCIÓN 2: DIFERENCIAS EN UNIDADES ==========
        { Concepto: "💰 DIFERENCIAS EN UNIDADES", Valor: "", Unidad: "" },
        {
          Concepto: "  • Total Sobrante",
          Valor: totalSobranteUnidades,
          Unidad: "Unidades",
        },
        {
          Concepto: "  • Total Faltante",
          Valor: totalFaltanteUnidades,
          Unidad: "Unidades",
        },
        {
          Concepto: "  • Diferencia Neta",
          Valor: totalSobranteUnidades - totalFaltanteUnidades,
          Unidad: "Unidades",
        },
        { Concepto: "", Valor: "", Unidad: "" },

        // ========== SECCIÓN 3: ANÁLISIS POR SKU (PRODUCTO) ==========
        { Concepto: "📦 ANÁLISIS POR SKU", Valor: "", Unidad: "" },
        {
          Concepto: "  • SKUs con Sobrante",
          Valor: totalSKUsSobrantes,
          Unidad: "SKUs",
        },
        {
          Concepto: "  • SKUs con Faltante",
          Valor: totalSKUsFaltantes,
          Unidad: "SKUs",
        },
        { Concepto: "  • SKUs OK", Valor: totalSKUsOK, Unidad: "SKUs" },
        {
          Concepto: "  • TOTAL SKUs",
          Valor: crossResults.length,
          Unidad: "SKUs",
        },
        { Concepto: "", Valor: "", Unidad: "" },

        // ========== SECCIÓN 4: ANÁLISIS POR LOTE ==========
        { Concepto: "📋 ANÁLISIS POR LOTE", Valor: "", Unidad: "" },
        {
          Concepto: "  • Lotes solo con Sobrante",
          Valor: lotesSoloSobrantes,
          Unidad: "Lotes",
        },
        {
          Concepto: "  • Lotes solo con Faltante",
          Valor: lotesSoloFaltantes,
          Unidad: "Lotes",
        },
        {
          Concepto: "  • Lotes Mixtos (Sobrante + Faltante)",
          Valor: lotesMixtos,
          Unidad: "Lotes",
        },
        {
          Concepto: "  • TOTAL LOTES CON NOVEDAD",
          Valor: lotesConNovedad,
          Unidad: "Lotes",
        },
        {
          Concepto: "  • Lotes OK",
          Valor: lotesOK,
          Unidad: "Lotes",
        },
        {
          Concepto: "  • TOTAL LOTES ANALIZADOS",
          Valor: totalLotes,
          Unidad: "Lotes",
        },
      ];

      const wsResumen = XLSX.utils.json_to_sheet(resumenData);

      // Aplicar estilos con formato condicional
      aplicarEstilosModernos(wsResumen);

      // Ajustar ancho de columnas específicamente para mejor visualización
      wsResumen["!cols"] = [
        { wch: 45 }, // Columna Concepto
        { wch: 20 }, // Columna Valor
        { wch: 15 }, // Columna Unidad
      ];

      XLSX.utils.book_append_sheet(wb, wsResumen, "📈 Resumen de Valores");

      // ========================================================================
      // HOJA ADICIONAL: DETALLE DE LOTES MIXTOS (OPCIONAL PERO MUY ÚTIL)
      // ========================================================================
      if (lotesMixtosDetalle.length > 0) {
        const wsLotesMixtos = XLSX.utils.json_to_sheet(lotesMixtosDetalle);
        aplicarEstilosModernos(wsLotesMixtos, {
          columnaEstado: Object.keys(lotesMixtosDetalle[0]).indexOf("Estado"),
        });
        XLSX.utils.book_append_sheet(wb, wsLotesMixtos, "⚠️ Lotes Mixtos");
      }
    }

    // REPORTE SUGERENCIAS
    else if (suggestions?.length) {
      const sortedSuggestions = [...suggestions].sort(
        (a, b) => b.cantidadARestockear - a.cantidadARestockear,
      );
      const sheetData: any[] = [];

      sortedSuggestions.forEach((s) => {
        if (s.ubicacionesSugeridas?.length) {
          s.ubicacionesSugeridas.forEach((u, index) => {
            const cantASurtir = s.cantidadARestockear > 0 ? u.cantidad : 0;
            const row: any = {
              SKU: s.sku,
              Descripción:
                s.descripcion?.substring(0, 83) +
                (s.descripcion?.length > 83 ? "..." : ""),
              ...(analysisMode === "levels" && {
                "Ubicación Destino": s.localizacionDestino || "",
                "LPN Destino": s.lpnDestino || "",
              }),
              ...(analysisMode === "sales" && {
                Vendido: index === 0 ? s.cantidadVendida || 0 : 0,
                "Stock Picking": index === 0 ? s.cantidadDisponible || 0 : 0,
              }),
              ...(analysisMode === "levels" && {
                "Stock Actual": s.cantidadDisponible || 0,
              }),
              "Cant. a Surtir": cantASurtir,
              // Origen: `${u.localizacion}${u.lpn ? ` (${u.lpn})` : ""}`,
              "Ubicación Origen": u.localizacion || "",
              "LPN Origen": u.lpn || "",
              Tipo:
                cantASurtir > 0
                  ? u.esEstibaCompleta
                    ? "✅ Pallet Completo"
                    : "🔄 Unidades Parciales"
                  : "⏹️ OK",
              Estiba: u.esEstibaCompleta ? "📦 SI" : "📦 NO",
              ...(analysisMode === "sales" && {
                Cubierto:
                  index === 0
                    ? s.cantidadTotalCubierta || s.cantidadARestockear || 0
                    : 0,
                Faltante: index === 0 ? s.cantidadFaltante || 0 : 0,
              }),
            };
            sheetData.push(row);
          });
        } else {
          const row: any = {
            SKU: s.sku,
            Descripción: s.descripcion?.substring(0, 83),
            ...(analysisMode === "levels" && {
              "Ubicación Destino": s.localizacionDestino || "",
              "LPN Destino": s.lpnDestino || "",
            }),
            ...(analysisMode === "sales" && {
              Vendido: s.cantidadVendida || 0,
              "Stock Picking": s.cantidadDisponible || 0,
            }),
            ...(analysisMode === "levels" && {
              "Stock Actual": s.cantidadDisponible || 0,
            }),
            "Cant. a Surtir": s.cantidadARestockear || 0,
            Origen: s.cantidadARestockear > 0 ? "⚠️ Sin Origen" : "⏹️ OK",
            Tipo: s.cantidadARestockear > 0 ? "❌ No disponible" : "⏹️ OK",
            Estiba: "N/A",
            ...(analysisMode === "sales" && {
              Cubierto: s.cantidadTotalCubierta || 0,
              Faltante: s.cantidadFaltante || 0,
            }),
          };
          sheetData.push(row);
        }
      });

      const totalCantidadSurtir = sheetData.reduce(
        (sum, row) => sum + (row["Cant. a Surtir"] || 0),
        0,
      );

      if (analysisMode === "sales") {
        sheetData.push({
          SKU: "🔸 RESUMEN",
          Descripción: "TOTALES GENERALES",
          Vendido: sheetData.reduce(
            (sum, row) => sum + (row["Vendido"] || 0),
            0,
          ),
          "Stock Picking": sheetData.reduce(
            (sum, row) => sum + (row["Stock Picking"] || 0),
            0,
          ),
          "Cant. a Surtir": totalCantidadSurtir,
          Origen: "",
          Tipo: "",
          Estiba: "",
          Cubierto: sheetData.reduce(
            (sum, row) => sum + (row["Cubierto"] || 0),
            0,
          ),
          Faltante: sheetData.reduce(
            (sum, row) => sum + (row["Faltante"] || 0),
            0,
          ),
        });
      } else {
        sheetData.push({
          SKU: "🔸 RESUMEN",
          Descripción: "TOTALES GENERALES",
          "Stock Actual": sheetData.reduce(
            (sum, row) => sum + (row["Stock Actual"] || 0),
            0,
          ),
          "Cant. a Surtir": totalCantidadSurtir,
          Origen: "",
          Tipo: "",
          Estiba: "",
        });
      }

      const ws = XLSX.utils.json_to_sheet(sheetData);
      aplicarEstilosModernos(ws, {
        filaTotales: sheetData.length - 1,
        columnaEstado: Object.keys(sheetData[0]).indexOf("Tipo"),
      });

      XLSX.utils.book_append_sheet(wb, ws, "📋 Sugerencias de Surtido");
    }

    // REPORTE FALTANTES
    if (missingProducts?.length) {
      const categorias = [
        { tipo: "SIN_INVENTARIO", nombre: "❌ Sin Inventario" },
        { tipo: "SIN_RESERVA", nombre: "⚠️ Sin Reserva" },
        { tipo: "RESERVA_INSUFICIENTE", nombre: "🔄 Reserva Insuficiente" },
      ];

      categorias.forEach(({ tipo, nombre }) => {
        const productos = missingProducts.filter((p) => p.tipoFalta === tipo);
        if (productos.length === 0) return;

        const data = productos.map((item) => ({
          SKU: item.sku,
          Descripción: item.descripcion?.substring(0, 50),
          Vendido: item.cantidadVendida || 0,
          "Stock Picking": item.stockEnPicking || 0,
          "Stock Reserva": item.stockEnReserva || 0,
          Cubierto: item.cantidadCubierta || 0,
          Faltante: item.cantidadFaltante || item.cantidadVendida || 0,
          Estado:
            tipo === "SIN_INVENTARIO"
              ? "Sin Stock"
              : tipo === "SIN_RESERVA"
                ? "Sin Reserva"
                : "Reserva Insuficiente",
        }));

        const totalFaltante = data.reduce((sum, row) => sum + row.Faltante, 0);
        const dataConTotales = agregarFilaTotales(data, {
          Faltante: totalFaltante,
        });
        const ws = XLSX.utils.json_to_sheet(dataConTotales);

        aplicarEstilosModernos(ws, {
          filaTotales: dataConTotales.length - 1,
          columnaEstado: Object.keys(data[0]).indexOf("Estado"),
        });

        XLSX.utils.book_append_sheet(wb, ws, nombre);
      });
    }

    if (wb.SheetNames.length === 0)
      return { error: "📄 No hay datos para exportar." };

    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    let filename = "";
    if (analysisMode === "cross") {
      filename = `Cruce_Inventarios_${timestamp}.xlsx`;
    } else if (analysisMode === "shelfLife") {
      filename = `Reporte_VidaUtil_${timestamp}.xlsx`;
    } else {
      filename = `Reporte_Surtido_${timestamp}.xlsx`;
    }

    return {
      data: {
        file: XLSX.write(wb, {
          type: "base64",
          bookType: "xlsx",
          compression: true,
        }),
        filename,
      },
    };
  } catch (e) {
    console.error("Error generando reporte:", e);
    return {
      error: `❌ Error al generar el archivo: ${e instanceof Error ? e.message : "Error inesperado"}`,
    };
  }
}
