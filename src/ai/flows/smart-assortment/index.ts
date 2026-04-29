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
  ventas: SurtidoInteligenteSalesSchema.describe("Datos de ventas del cliente."),
  stock: SurtidoInteligenteStockSchema.describe("Datos de inventario del WMS."),
  maestra: MaterialMaestraSchema.optional().describe(
    "Maestra de materiales con ubicaciones sugeridas.",
  ),
});

export type SmartAssortmentInput = z.infer<typeof SmartAssortmentInputSchema>;
export type SmartAssortmentOutput = z.infer<typeof AnalysisResultSchema>;

// ============================================================================
// FUNCIÓN PRINCIPAL DE ANÁLISIS DE SURTIDO INTELIGENTE
// ============================================================================

export async function runSmartAssortmentAnalysis(
  input: SmartAssortmentInput,
): Promise<SmartAssortmentOutput> {
  return smartAssortmentFlow(input);
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

    // 1.1 Normalizar ventas (SKU y descripción en mayúsculas y sin espacios)
    const ventasNormalizadas = ventas.map((v: any) => {
      let sku = v.sku ?? v.SKU ?? v.MAI_SKU ?? v.codigo ?? v.Codigo ?? v.Material ?? "";
      sku = typeof sku === "string" ? sku.trim().toUpperCase() : "";
      let descripcion = v.descripcion ?? v.Descripcion ?? v.MAI_DESCRIPTION ?? v.description ?? "";
      descripcion = typeof descripcion === "string" ? descripcion.trim().toUpperCase() : "";
      const cantidad = Number(v.qtyOrder ?? v.QTY_ORDER ?? v.cantidad ?? v.Cantidad ?? v.cantidadConfirmada ?? 0);
      return { sku, descripcion, cantidad };
    }).filter((v) => v.sku && v.cantidad > 0);

    // 1.2 Construir mapa de maestra de materiales (SKU normalizado)
    const maestraMap = new Map<string, {
      lpn: string;
      localizacion: string;
      descripcion: string;
      tipoMaterial: string;
    }>();

    if (maestra && maestra.length > 0) {
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

    // 1.3 Normalizar y filtrar stock
    const debeOmitirsePorKeyword = (ubicacion: string) => {
      const upper = ubicacion.toUpperCase();
      return IGNORED_LOCATION_KEYWORDS.some((keyword) =>
        upper.includes(keyword.toUpperCase()),
      );
    };

    const validStatuses = VALID_STATUSES.map((s) => s.toUpperCase());

    // Helper para obtener el último segmento de la ubicación (ej: "P40-56-8" -> "8")
    const getLastSegment = (ubicacion: string): string => {
      const parts = ubicacion.split("-");
      return parts[parts.length - 1];
    };

    // Helper para verificar si es ubicación de picking (P30/P40)
    const isPickingLocation = (ubicacion: string): boolean => {
      const upper = ubicacion.toUpperCase();
      return PICKING_PREFIXES.some((prefix) => upper.startsWith(prefix.toUpperCase()));
    };

    // Helper para verificar si es ubicación de reserva válida (termina en 20, 30, 40, etc., excluyendo 10)
    const isValidReserveLocation = (ubicacion: string): boolean => {
      const lastSegment = getLastSegment(ubicacion);
      // Excluir ubicaciones que terminan en "10" o "10-2" (incluye variantes como "10-2")
      if (lastSegment === "10" || lastSegment.startsWith("10-")) {
        return false;
      }
      // Verificar si el último segmento está en los niveles de reserva
      return RESERVE_LEVELS.some((level) => lastSegment === level);
    };

    // Helper para obtener ubicaciones de reserva disponibles (excluyendo las que terminan en 10)
    const getReserveLocations = (items: any[]): any[] => {
      return items.filter((item) => {
        const ubicacion = item.localizacion || "";
        return isValidReserveLocation(ubicacion) && item.disponible > 0;
      });
    };

    // 1.3 Normalizar y filtrar stock (SKU y campos clave en mayúsculas y sin espacios)
    const stockNormalizado = stock
      .map((item: any) => {
        let sku = item.SKU ?? item.Codigo ?? "";
        sku = typeof sku === "string" ? sku.trim().toUpperCase() : "";
        let descripcion = item.Descripcion ?? "";
        descripcion = typeof descripcion === "string" ? descripcion.trim().toUpperCase() : "";
        let localizacion = item.Localizacion ?? "";
        localizacion = typeof localizacion === "string" ? localizacion.trim().toUpperCase() : "";
        let lote = item.Lote ?? "";
        lote = typeof lote === "string" ? lote.trim().toUpperCase() : "";
        let estado = item.Estado ?? "";
        estado = typeof estado === "string" ? estado.trim().toUpperCase() : "";
        return {
          sku,
          descripcion,
          localizacion,
          lpn: item.LPN ?? "",
          disponible: Number(item.Disponible ?? 0),
          lote,
          fechaVencimiento: item["Fecha de vencimiento"] ?? "",
          fechaEntrada: item["Fecha de entrada"] ?? "",
          estado,
        };
      })
      .filter((item: any) => {
        const esEstadoValido = validStatuses.some(vs =>
          item.estado.includes(vs)
        );
        const esUbicacionIgnorada = debeOmitirsePorKeyword(item.localizacion || "");
        return item.sku && esEstadoValido && !esUbicacionIgnorada && (item.disponible || 0) > 0;
      });

    // ========================================================================
    // 2. AGRUPAR DATOS
    // ========================================================================

    // 2.1 Agrupar ventas por SKU
    const ventasPorSku = new Map<string, { total: number; descripcion: string; tendencia: "alta" | "media" | "baja" }>();
    for (const venta of ventasNormalizadas) {
      if (!venta.sku) continue;
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

    // 2.2 Agrupar stock por SKU
    const stockPorSku = new Map<string, any[]>();
    for (const item of stockNormalizado) {
      if (!item.sku) continue;
      if (!stockPorSku.has(item.sku)) {
        stockPorSku.set(item.sku, []);
      }
      stockPorSku.get(item.sku)!.push(item);
    }

    // ========================================================================
    // 3. ANÁLISIS PREDICTIVO - IDENTIFICAR SKUS DE ALTA ROTACIÓN
    // ========================================================================

    const ventasArray = Array.from(ventasPorSku.entries())
      .map(([sku, info]) => ({ sku, total: info.total }))
      .sort((a, b) => b.total - a.total);

    const topCount = Math.max(1, Math.ceil(ventasArray.length * 0.2));
    const skusAltaRotacion = new Set(ventasArray.slice(0, topCount).map((item) => item.sku));
    
    // Calcular promedio de ventas para análisis predictivo
    const promedioVentas = ventasArray.reduce((sum, item) => sum + item.total, 0) / ventasArray.length;
    
    // Identificar SKUs con tendencia al alza (ventas > promedio * 1.5)
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
    // 4. GENERAR SUGERENCIAS POR SKU
    // ========================================================================

    const suggestions: z.infer<typeof RestockSuggestionSchema>[] = [];
    const missingProducts: any[] = [];
    const analisisPredictivo: any[] = [];

    for (const [sku, ventaInfo] of ventasPorSku) {
      const stockItems = stockPorSku.get(sku) || [];
      const existeEnMaestra = maestraMap.has(sku);
      const ubicacionDestinoMaestra = maestraMap.get(sku)?.localizacion;
      const descripcionMaestra = maestraMap.get(sku)?.descripcion;

      // Verificar que la ubicación destino sea válida (P30 o P40)
      const destinoValido = ubicacionDestinoMaestra && isPickingLocation(ubicacionDestinoMaestra);

      // ========================================================================
      // 4.1 Calcular cantidad a surtir con factor predictivo
      // ========================================================================
      let cantidadVendidaOriginal = ventaInfo.total;
      let cantidadVendida = cantidadVendidaOriginal;
      let factorMultiplicador = 1.0;
      let razonMultiplicador = "";

      // Proyección de días futuros para SKUs de alta rotación/tendencia
      let proyeccionDias = 0;
      let cantidadProyectada = 0;
      let esProyeccion = false;
      if (skusAltaRotacion.has(sku)) {
        factorMultiplicador = 1.2;
        razonMultiplicador = "Alta rotación (top 20%)";
        proyeccionDias = 2; // cubrir 2 días futuros
        cantidadProyectada = Math.ceil(cantidadVendidaOriginal * (1 + proyeccionDias));
        cantidadVendida = cantidadProyectada;
        esProyeccion = true;
      } else if (skusTendenciaAlza.has(sku)) {
        factorMultiplicador = 1.15;
        razonMultiplicador = "Tendencia al alza (>50% sobre promedio)";
        proyeccionDias = 1; // cubrir 1 día futuro
        cantidadProyectada = Math.ceil(cantidadVendidaOriginal * (1 + proyeccionDias));
        cantidadVendida = cantidadProyectada;
        esProyeccion = true;
      }
      // Si no es alta rotación ni tendencia, solo cubrir venta actual
      if (!esProyeccion) {
        cantidadProyectada = cantidadVendidaOriginal;
      }

      // Proyección a futuro (próximos 30 y 60 días, para reporte)
      const proyeccion30Dias = Math.ceil(cantidadVendidaOriginal * 1.5);
      const proyeccion60Dias = Math.ceil(cantidadVendidaOriginal * 2.0);

      // ========================================================================
      // 4.2 Separar stock por tipo de ubicación
      // ========================================================================
      
      // Stock actual en ubicaciones de picking destino (P30/P40)
      const pickingItems = stockItems.filter((item) => isPickingLocation(item.localizacion));
      const cantidadDisponiblePicking = pickingItems.reduce((sum, i) => sum + i.disponible, 0);

      // Stock en ubicaciones de reserva VÁLIDAS (excluye terminaciones en 10)
      const reservaItemsValidos = getReserveLocations(stockItems);
      const cantidadEnReserva = reservaItemsValidos.reduce((sum, i) => sum + i.disponible, 0);

      // Stock en ubicaciones NO VÁLIDAS (terminan en 10) - no se pueden usar para surtir
      const ubicacionesNoValidas = stockItems.filter((item) => {
        const lastSegment = getLastSegment(item.localizacion);
        return lastSegment === "10" || lastSegment.startsWith("10-");
      });
      const cantidadNoDisponible = ubicacionesNoValidas.reduce((sum, i) => sum + i.disponible, 0);

      // ========================================================================
      // 4.3 Calcular necesidad de surtido
      // ========================================================================
      
      let cantidadNecesaria = Math.max(0, cantidadVendida - cantidadDisponiblePicking);
      const ubicacionesSugeridas: z.infer<typeof UbicacionSugeridaSchema>[] = [];

      // Solo intentar surtir si hay necesidad Y hay stock en reserva Y hay destino válido
      if (cantidadNecesaria > 0 && reservaItemsValidos.length > 0 && destinoValido) {
        // Ordenar reserva por FEFO (fecha de vencimiento), luego FIFO (fecha de entrada), luego lote ascendente
        const reservaOrdenada = [...reservaItemsValidos].sort((a, b) => {
          const fechaVencA = a.fechaVencimiento || "9999-12-31";
          const fechaVencB = b.fechaVencimiento || "9999-12-31";
          const timeVencA = new Date(fechaVencA).getTime();
          const timeVencB = new Date(fechaVencB).getTime();
          if (timeVencA !== timeVencB) return timeVencA - timeVencB;
          // Si empate, ordenar por fecha de entrada
          const fechaEntA = a.fechaEntrada || "9999-12-31";
          const fechaEntB = b.fechaEntrada || "9999-12-31";
          const timeEntA = new Date(fechaEntA).getTime();
          const timeEntB = new Date(fechaEntB).getTime();
          if (timeEntA !== timeEntB) return timeEntA - timeEntB;
          // Si sigue empate, ordenar por lote ascendente (alfanumérico)
          const loteA = a.lote || "";
          const loteB = b.lote || "";
          if (loteA < loteB) return -1;
          if (loteA > loteB) return 1;
          return 0;
        });

        let restantePorCubrir = cantidadNecesaria;
        for (const item of reservaOrdenada) {
          if (restantePorCubrir <= 0) break;

          const tomar = Math.min(item.disponible, restantePorCubrir);
          
          ubicacionesSugeridas.push({
            lpn: item.lpn,
            localizacion: item.localizacion,
            lote: item.lote ?? "",
            diasFPC: null,
            fechaVencimiento: item.fechaVencimiento,
            cantidad: tomar,
            esEstibaCompleta: false,
          });

          restantePorCubrir -= tomar;
        }
        cantidadNecesaria = restantePorCubrir;
      }

      // Calcular faltante final
      const cantidadARestockear = ubicacionesSugeridas.reduce((sum, u) => sum + u.cantidad, 0);
      const cantidadFaltante = Math.max(0, cantidadVendida - cantidadDisponiblePicking - cantidadARestockear);
      
      const tieneStockSuficiente = cantidadFaltante === 0 && cantidadDisponiblePicking >= cantidadVendida;
      const necesitaSurtir = cantidadARestockear > 0 && destinoValido;
      const prioridadAlta = skusAltaRotacion.has(sku);

      // ========================================================================
      // 4.4 Construir sugerencia con todos los campos para el frontend
      // ========================================================================
      
      const suggestion = {
        sku,
        descripcion: descripcionMaestra || ventaInfo.descripcion || "",
        cantidadVendida,
        cantidadVendidaOriginal,

        // 🔥 MANTENER ESTE (schema lo exige)
        cantidadDisponible: cantidadDisponiblePicking,

        // 🔥 AGREGAR ESTE (frontend lo usa)
        cantidadDisponiblePicking: cantidadDisponiblePicking,

        cantidadEnReserva,
        cantidadARestockear: necesitaSurtir ? cantidadARestockear : 0,
        cantidadTotalCubierta: cantidadARestockear,
        cantidadFaltante,

        ubicacionesSugeridas,

        lpnDestino: pickingItems[0]?.lpn || maestraMap.get(sku)?.lpn || null,

        // 🔥 MISMA LÓGICA AQUÍ
        localizacionDestino: destinoValido ? ubicacionDestinoMaestra : null,
        ubicacionDestino: destinoValido ? ubicacionDestinoMaestra : null,

        tieneStockSuficiente,
        prioridadAlta,
        existeEnMaestra,

        // Campos de proyección
        proyeccion: esProyeccion,
        proyeccionDias,
        cantidadProyectada,
      };

      suggestions.push(suggestion);

      // ========================================================================
      // 4.5 Almacenar análisis predictivo para reporte futuro
      // ========================================================================
      
      analisisPredictivo.push({
        sku,
        descripcion: descripcionMaestra || ventaInfo.descripcion || "",
        ventasActuales: cantidadVendidaOriginal,
        tendencia: ventaInfo.tendencia,
        proyeccion30Dias,
        proyeccion60Dias,
        stockActualPicking: cantidadDisponiblePicking,
        stockReservaDisponible: cantidadEnReserva,
        stockNoDisponible: cantidadNoDisponible,
        recomendacion: cantidadFaltante > 0 ? "REQUIERE REABASTECIMIENTO URGENTE" : 
                        necesitaSurtir ? "SURTIR DESDE RESERVA" : 
                        "STOCK SUFICIENTE",
      });

      // ========================================================================
      // 4.6 Si hay faltante, agregar a missingProducts
      // ========================================================================
      
      if (cantidadFaltante > 0) {
        let tipoFalta: "SIN_INVENTARIO" | "SIN_RESERVA" | "RESERVA_INSUFICIENTE";
        if (stockItems.length === 0) {
          tipoFalta = "SIN_INVENTARIO";
        } else if (cantidadEnReserva === 0) {
          tipoFalta = "SIN_RESERVA";
        } else {
          tipoFalta = "RESERVA_INSUFICIENTE";
        }

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

    // ========================================================================
    // 5. LOGS FINALES Y RETORNO
    // ========================================================================

    // Ordenar sugerencias: primero las que necesitan surtir, luego las OK
    const sortedSuggestions = suggestions.sort((a, b) => {
      if (a.cantidadARestockear > 0 && b.cantidadARestockear === 0) return -1;
      if (a.cantidadARestockear === 0 && b.cantidadARestockear > 0) return 1;
      return a.sku.localeCompare(b.sku);
    });

    return {
      suggestions: sortedSuggestions,
      missingProducts,
    };
  },
);

// ============================================================================
// FUNCIÓN DE EXPORTACIÓN PARA ACCIONES
// ============================================================================

export async function runSurtidoInteligenteAnalysis(
  ventas: any[],
  stock: any[],
  maestra?: any[]
): Promise<{ data?: AnalysisResult; error?: string }> {
  try {
    // Transformar stock al formato esperado por el schema
    const stockTransformado = stock.map((item: any) => ({
      Codigo: item.Codigo,
      LPN: item.LPN,
      Localizacion: item.Localizacion,
      SKU: item.SKU,
      Descripcion: item.Descripcion,
      Disponible: Number(item.Disponible),
      Estado: item.Estado,
      Lote: item.Lote,
      "Fecha de vencimiento": item["Fecha de vencimiento"],
      "Fecha de entrada": item["Fecha de entrada"],
    }));

    const stockValidados = SurtidoInteligenteStockSchema.parse(stockTransformado);
    
    let maestraValida = undefined;
    if (maestra && maestra.length > 0) {
      maestraValida = MaterialMaestraSchema.parse(maestra);
    }

    const result = await runSmartAssortmentAnalysis({
      ventas: ventas as any,
      stock: stockValidados,
      maestra: maestraValida,
    });
    
    return { data: result };
  } catch (e) {
    return {
      error: `❌ Error en análisis de Surtido Inteligente: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}