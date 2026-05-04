"use server";

import { ai } from "@/ai/genkit";
import { z } from "zod";
import {
  SurtidoInteligenteSalesSchema,
  SurtidoInteligenteStockSchema,
  MaterialMaestraSchema,
  RestockSuggestionSchema,
  UbicacionSugeridaSchema,
  AnalysisResultSchema,
  AnalysisResult,
} from "../schemas";
import { analysisConfig } from "../config";

// ============================================================================
// INTERFACES Y ESQUEMAS
// ============================================================================

const SmartAssortmentInputSchema = z.object({
  ventas: z.array(z.any()).describe("Datos de ventas del cliente (ya procesados)."),
  stock: z.array(z.any()).describe("Datos de inventario del WMS (ya procesados y validados)."),
  maestra: z.array(z.any()).optional().describe("Maestra de materiales con ubicaciones sugeridas."),
});

export type SmartAssortmentInput = z.infer<typeof SmartAssortmentInputSchema>;
export type SmartAssortmentOutput = z.infer<typeof AnalysisResultSchema>;

// ============================================================================
// FUNCIÓN PRINCIPAL DE ANÁLISIS DE SURTIDO INTELIGENTE
// ============================================================================

export async function runSmartAssortmentAnalysis(
  input: SmartAssortmentInput,
): Promise<SmartAssortmentOutput> {
  if (!input?.ventas?.length || !input?.stock?.length) {
    throw new Error("Datos de ventas o stock no proporcionados o vacíos");
  }
  return await smartAssortmentFlow(input);
}

const smartAssortmentFlow = ai.defineFlow(
  {
    name: "smartAssortmentFlow",
    inputSchema: SmartAssortmentInputSchema,
    outputSchema: AnalysisResultSchema,
  },
  async (input) => {
    const { ventas, stock, maestra } = input;
    const {
      VALID_STATUSES,
      IGNORED_LOCATION_KEYWORDS,
      PICKING_PREFIXES,
      RESERVE_LEVELS,
    } = analysisConfig;

    // ========================================================================
    // 1. NORMALIZAR Y FILTRAR DATOS
    // ========================================================================

    const ventasNormalizadas = ventas.map((v: any) => {
      let sku = v.sku ?? v.SKU ?? v.MAI_SKU ?? v.codigo ?? v.Codigo ?? v.Material ?? "";
      sku = typeof sku === "string" ? sku.trim().toUpperCase() : "";
      let descripcion = v.descripcion ?? v.Descripcion ?? v.MAI_DESCRIPTION ?? v.description ?? "";
      descripcion = typeof descripcion === "string" ? descripcion.trim().toUpperCase() : "";
      const cantidad = Number(v.qtyOrder ?? v.QTY_ORDER ?? v.cantidad ?? v.Cantidad ?? v.cantidadConfirmada ?? 0);
      return { sku, descripcion, cantidad };
    }).filter((v) => v.sku && v.cantidad > 0);

    const maestraMap = new Map<string, any>();
    if (maestra?.length) {
      for (const m of maestra) {
        let sku = m.sku || "";
        sku = typeof sku === "string" ? sku.trim().toUpperCase() : "";
        if (sku && !maestraMap.has(sku)) {
          maestraMap.set(sku, {
            lpn: m.lpn || "",
            localizacion: m.localizacion || "",
            descripcion: m.descripcion || "",
            tipoMaterial: m.tipoMaterial || "",
          });
        }
      }
    }

    const debeOmitirsePorKeyword = (ubicacion: string) => {
      return IGNORED_LOCATION_KEYWORDS.some((keyword) =>
        ubicacion.toUpperCase().includes(keyword.toUpperCase())
      );
    };

    const validStatuses = VALID_STATUSES.map((s) => s.toUpperCase());
    const getLastSegment = (ubicacion: string): string => ubicacion.split("-").pop() || "";
    const isPickingLocation = (ubicacion: string): boolean => {
      return PICKING_PREFIXES.some((prefix) => ubicacion.toUpperCase().startsWith(prefix.toUpperCase()));
    };
    const isValidReserveLocation = (ubicacion: string): boolean => {
      const lastSegment = getLastSegment(ubicacion);
      if (lastSegment === "10" || lastSegment.startsWith("10-")) return false;
      return RESERVE_LEVELS.some((level) => lastSegment === level);
    };
    const getReserveLocations = (items: any[]): any[] => {
      return items.filter((item) => {
        const ubicacion = item.Localizacion || "";
        return isValidReserveLocation(ubicacion) && item.Disponible > 0;
      });
    };

    const stockNormalizado = stock
      .map((item: any) => ({
        SKU: item.SKU ?? item.Codigo ?? "",
        LPN: item.LPN ?? "",
        Localizacion: item.Localizacion ?? "",
        Descripcion: item.Descripcion ?? "",
        Estado: item.Estado ?? "",
        Disponible: Number(item.Disponible ?? 0),
        Lote: item.Lote ?? "",
        fechaVencimiento: item["Fecha de vencimiento"] ?? item.fechaVencimiento ?? "",
        fechaEntrada: item["Fecha de entrada"] ?? item.fechaEntrada ?? "",
      }))
      .filter((item: any) => {
        const esEstadoValido = validStatuses.some(vs => item.Estado.includes(vs));
        const esUbicacionIgnorada = debeOmitirsePorKeyword(item.Localizacion || "");
        return item.SKU && esEstadoValido && !esUbicacionIgnorada && item.Disponible > 0;
      });

    // ========================================================================
    // 2. AGRUPAR DATOS
    // ========================================================================

    const ventasPorSku = new Map<string, { total: number; descripcion: string; tendencia: string }>();
    for (const venta of ventasNormalizadas) {
      const existing = ventasPorSku.get(venta.sku);
      if (existing) {
        existing.total += venta.cantidad;
      } else {
        ventasPorSku.set(venta.sku, {
          total: venta.cantidad,
          descripcion: venta.descripcion,
          tendencia: "media",
        });
      }
    }

    const stockPorSku = new Map<string, any[]>();
    for (const item of stockNormalizado) {
      if (!item.SKU) continue;
      if (!stockPorSku.has(item.SKU)) stockPorSku.set(item.SKU, []);
      stockPorSku.get(item.SKU)!.push(item);
    }

    // ========================================================================
    // 3. ANÁLISIS PREDICTIVO
    // ========================================================================

    const ventasArray = Array.from(ventasPorSku.entries())
      .map(([sku, info]) => ({ sku, total: info.total }))
      .sort((a, b) => b.total - a.total);

    const topCount = Math.max(1, Math.ceil(ventasArray.length * 0.2));
    const skusAltaRotacion = new Set(ventasArray.slice(0, topCount).map((i) => i.sku));
    const promedioVentas = ventasArray.reduce((sum, i) => sum + i.total, 0) / ventasArray.length;
    
    const skusTendenciaAlza = new Set<string>();
    for (const [sku, info] of ventasPorSku) {
      if (info.total > promedioVentas * 1.5) {
        skusTendenciaAlza.add(sku);
        info.tendencia = "alta";
      } else if (info.total < promedioVentas * 0.5) {
        info.tendencia = "baja";
      }
    }

    // ========================================================================
    // 4. GENERAR SUGERENCIAS
    // ========================================================================

    const suggestions: any[] = [];
    const missingProducts: any[] = [];

    for (const [sku, ventaInfo] of ventasPorSku) {
      const stockItems = stockPorSku.get(sku) || [];
      const existeEnMaestra = maestraMap.has(sku);
      const ubicacionDestinoMaestra = maestraMap.get(sku)?.localizacion;
      const descripcionMaestra = maestraMap.get(sku)?.descripcion;
      const destinoValido = ubicacionDestinoMaestra && isPickingLocation(ubicacionDestinoMaestra);

      let cantidadVendidaOriginal = ventaInfo.total;
      let cantidadVendida = cantidadVendidaOriginal;
      let esProyeccion = false;
      let proyeccionDias = 0;
      let cantidadProyectada = cantidadVendidaOriginal;

      if (skusAltaRotacion.has(sku)) {
        proyeccionDias = 2;
        cantidadProyectada = Math.ceil(cantidadVendidaOriginal * 3);
        cantidadVendida = cantidadProyectada;
        esProyeccion = true;
      } else if (skusTendenciaAlza.has(sku)) {
        proyeccionDias = 1;
        cantidadProyectada = Math.ceil(cantidadVendidaOriginal * 2);
        cantidadVendida = cantidadProyectada;
        esProyeccion = true;
      }

      const pickingItems = stockItems.filter((i) => isPickingLocation(i.Localizacion));
      const cantidadDisponiblePicking = pickingItems.reduce((sum, i) => sum + i.Disponible, 0);
      const reservaItemsValidos = getReserveLocations(stockItems);
      const cantidadEnReserva = reservaItemsValidos.reduce((sum, i) => sum + i.Disponible, 0);

      let cantidadNecesaria = Math.max(0, cantidadVendida - cantidadDisponiblePicking);
      const ubicacionesSugeridas: any[] = [];

      if (cantidadNecesaria > 0 && reservaItemsValidos.length > 0 && destinoValido) {
        const reservaOrdenada = [...reservaItemsValidos].sort((a, b) => {
          const fechaVencA = a.fechaVencimiento || "9999-12-31";
          const fechaVencB = b.fechaVencimiento || "9999-12-31";
          const timeVencA = new Date(fechaVencA).getTime();
          const timeVencB = new Date(fechaVencB).getTime();
          if (timeVencA !== timeVencB) return timeVencA - timeVencB;
          const fechaEntA = a.fechaEntrada || "9999-12-31";
          const fechaEntB = b.fechaEntrada || "9999-12-31";
          const timeEntA = new Date(fechaEntA).getTime();
          const timeEntB = new Date(fechaEntB).getTime();
          if (timeEntA !== timeEntB) return timeEntA - timeEntB;
          return (a.Lote || "").localeCompare(b.Lote || "");
        });

        let restantePorCubrir = cantidadNecesaria;
        for (const item of reservaOrdenada) {
          if (restantePorCubrir <= 0) break;
          const tomar = Math.min(item.Disponible, restantePorCubrir);
          ubicacionesSugeridas.push({
            lpn: item.LPN,
            localizacion: item.Localizacion,
            lote: item.Lote || "",
            diasFPC: null,
            fechaVencimiento: item.fechaVencimiento,
            cantidad: tomar,
            esEstibaCompleta: false,
          });
          restantePorCubrir -= tomar;
        }
        cantidadNecesaria = restantePorCubrir;
      }

      const cantidadARestockear = ubicacionesSugeridas.reduce((sum, u) => sum + u.cantidad, 0);
      const cantidadFaltante = Math.max(0, cantidadVendida - cantidadDisponiblePicking - cantidadARestockear);
      const necesitaSurtir = cantidadARestockear > 0 && destinoValido;

      suggestions.push({
        sku,
        descripcion: descripcionMaestra || ventaInfo.descripcion || "",
        cantidadVendida,
        cantidadVendidaOriginal,
        cantidadDisponible: cantidadDisponiblePicking,
        cantidadDisponiblePicking,
        cantidadEnReserva,
        cantidadARestockear: necesitaSurtir ? cantidadARestockear : 0,
        cantidadTotalCubierta: cantidadARestockear,
        cantidadFaltante,
        ubicacionesSugeridas,
        lpnDestino: pickingItems[0]?.LPN || maestraMap.get(sku)?.lpn || null,
        localizacionDestino: destinoValido ? ubicacionDestinoMaestra : null,
        ubicacionDestino: destinoValido ? ubicacionDestinoMaestra : null,
        tieneStockSuficiente: cantidadFaltante === 0 && cantidadDisponiblePicking >= cantidadVendida,
        prioridadAlta: skusAltaRotacion.has(sku),
        existeEnMaestra,
        proyeccion: esProyeccion,
        proyeccionDias,
        cantidadProyectada,
      });

      if (cantidadFaltante > 0) {
        let tipoFalta: "SIN_INVENTARIO" | "SIN_RESERVA" | "RESERVA_INSUFICIENTE";
        if (stockItems.length === 0) tipoFalta = "SIN_INVENTARIO";
        else if (cantidadEnReserva === 0) tipoFalta = "SIN_RESERVA";
        else tipoFalta = "RESERVA_INSUFICIENTE";

        missingProducts.push({
          sku,
          descripcion: descripcionMaestra || ventaInfo.descripcion || "",
          cantidadVendida,
          cantidadFaltante,
          stockEnPicking: cantidadDisponiblePicking,
          stockEnReserva: cantidadEnReserva,
          cantidadCubierta: cantidadARestockear,
          tipoFalta,
        });
      }
    }

    suggestions.sort((a, b) => {
      if (a.cantidadARestockear > 0 && b.cantidadARestockear === 0) return -1;
      if (a.cantidadARestockear === 0 && b.cantidadARestockear > 0) return 1;
      return a.sku.localeCompare(b.sku);
    });

    return { suggestions, missingProducts };
  },
);

// ============================================================================
// FUNCIÓN DE EXPORTACIÓN
// ============================================================================

export async function runSurtidoInteligenteAnalysis(
  ventas: any[],
  stock: any[],
  maestra?: any[]
): Promise<{ data?: AnalysisResult; error?: string }> {
  try {
    if (!ventas?.length) return { error: "El archivo de ventas está vacío o mal formateado" };
    if (!stock?.length) return { error: "El archivo de stock está vacío o mal formateado" };

    const stockTransformado = stock.map((item: any) => ({
      Codigo: String(item.Codigo || item.codigo || ""),
      LPN: String(item.LPN || item.lpn || ""),
      Localizacion: String(item.Localizacion || item.localizacion || ""),
      "Area Picking": String(item["Area Picking"] || item.areaPicking || ""),
      SKU: String(item.SKU || item.sku || ""),
      SKU2: String(item.SKU2 || item.sku2 || ""),
      Descripcion: String(item.Descripcion || item.descripcion || ""),
      "Tipo de Material": String(item["Tipo de Material"] || item.tipoMaterial || ""),
      "Categoría de Material": String(item["Categoría de Material"] || item.categoriaMaterial || ""),
      Unidades: Number(item.Unidades || item.unidades || 0),
      Cajas: Number(item.Cajas || item.cajas || 0),
      Reserva: Number(item.Reserva || item.reserva || 0),
      Disponible: Number(item.Disponible || item.disponible || 0),
      UDM: String(item.UDM || item.udm || ""),
      Embalaje: String(item.Embalaje || item.embalaje || ""),
      "Fecha de entrada": String(item["Fecha de entrada"] || item.fechaEntrada || ""),
      Estado: String(item.Estado || item.estado || ""),
      Lote: String(item.Lote || item.lote || ""),
      "Fecha de fabricacion": String(item["Fecha de fabricacion"] || item.fechaFabricacion || ""),
      "Fecha de vencimiento": String(item["Fecha de vencimiento"] || item.fechaVencimiento || ""),
      FPC: Number(item.FPC || item.fpc || 0),
      Peso: Number(item.Peso || item.peso || 0),
      Serial: String(item.Serial || item.serial || ""),
    }));

    const stockValidados = SurtidoInteligenteStockSchema.parse(stockTransformado);
    
    let maestraValida = undefined;
    if (maestra?.length) {
      const maestraTransformada = maestra.map((m: any) => ({
        lpn: String(m.lpn || m.LPN || ""),
        localizacion: String(m.localizacion || m.Localizacion || ""),
        sku: String(m.sku || m.SKU || m.Codigo || ""),
        descripcion: String(m.descripcion || m.Descripcion || ""),
        tipoMaterial: String(m.tipoMaterial || m.TipoMaterial || ""),
      }));
      maestraValida = MaterialMaestraSchema.parse(maestraTransformada);
    }

    const result = await runSmartAssortmentAnalysis({
      ventas: ventas as any,
      stock: stockValidados,
      maestra: maestraValida,
    });
    
    return { data: result };
  } catch (e) {
    return { error: `Error: ${e instanceof Error ? e.message : String(e)}` };
  }
}