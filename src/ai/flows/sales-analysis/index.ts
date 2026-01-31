"use server";
/**
 * @fileOverview Este archivo contiene la configuración de mapeo de columnas para analizar archivos subidos.
 * Al centralizar estos mapeos, puedes adaptar fácilmente la aplicación a diferentes
 * formatos de archivos de varios clientes sin modificar el código central de la interfaz.
 *
 * Para cada campo interno (por ejemplo, 'material'), proporciona una lista de posibles
 * nombres de encabezado de columna que puedan aparecer en los archivos de los clientes. 
 * El sistema buscará estos nombres en orden y usará el primero que encuentre.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";
import {
  SalesDataSchema,
  InventoryDataSchema,
  AnalysisResultSchema,
  GenerateRestockSuggestionsOutputSchema,
  MissingProductSchema,
  UbicacionSugeridaSchema,
} from "../schemas";
import { analysisConfig } from "../config";

const GenerateSalesAnalysisInputSchema = z.object({
  salesData: SalesDataSchema.describe("Sales data from the invoicing file."),
  inventoryData: InventoryDataSchema.describe(
    "Inventory data from the WMS file.",
  ),
});
export type GenerateSalesAnalysisInput = z.infer<
  typeof GenerateSalesAnalysisInputSchema
>;
export type GenerateRestockSuggestionsOutput = z.infer<
  typeof GenerateRestockSuggestionsOutputSchema
>;
export type MissingProductsOutput = z.infer<typeof MissingProductSchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export async function generateSalesAnalysis(
  input: GenerateSalesAnalysisInput,
): Promise<AnalysisResult> {
  return salesAnalysisFlow(input);
}

const salesAnalysisFlow = ai.defineFlow(
  {
    name: "salesAnalysisFlow",
    inputSchema: GenerateSalesAnalysisInputSchema,
    outputSchema: AnalysisResultSchema,
  },
  async (input) => {
    const { salesData, inventoryData } = input;

    const {
      VALID_STATUSES,
      IGNORED_LOCATIONS,
      PICKING_LEVELS,
      RESERVE_LEVELS,
      ADDITIONAL_RESERVE_LOCATIONS,
    } = analysisConfig;

    // 1. Filtrar el inventario para incluir solo el stock que está libre para usar y no está en la ubicación de discrepancia.
    const freeStockInventory = inventoryData.filter(
      (item) =>
        item.estado &&
        VALID_STATUSES.includes(item.estado.toUpperCase()) &&
        !IGNORED_LOCATIONS.includes(item.localizacion),
    );

    // 2. Agregar el inventario por SKU, separando las ubicaciones de picking y reserva.
    const inventoryBySku = freeStockInventory.reduce(
      (acc, item) => {
        const sku = item.sku;
        if (!acc[sku]) {
          acc[sku] = {
            descripcion: item.descripcion,
            totalEnPicking: 0,
            totalEnReserva: 0,
            pickingLocations: [],
            reserveLocations: [],
          };
        }

        const locationStr = String(item.localizacion);
        const locationUpper = locationStr.toUpperCase();
        const lastPart = locationStr.split("-").pop() || "";

        const isPicking = PICKING_LEVELS.includes(lastPart);
        const isReserveByLevel = RESERVE_LEVELS.includes(lastPart);
        const isReserveByAdditional = ADDITIONAL_RESERVE_LOCATIONS.some(
          (prefix) => locationUpper.startsWith(prefix.toUpperCase()),
        );

        if (isPicking) {
          acc[sku].totalEnPicking += item.disponible;
          acc[sku].pickingLocations.push({
            lpn: item.lpn,
            localizacion: locationStr,
            disponible: item.disponible,
            fechaVencimiento: item.fechaVencimiento,
            diasFPC: item.diasFPC,
          });
        } else if (isReserveByLevel || isReserveByAdditional) {
          acc[sku].totalEnReserva += item.disponible;
          acc[sku].reserveLocations.push({
            lpn: item.lpn,
            localizacion: locationStr,
            disponible: item.disponible,
            fechaVencimiento: item.fechaVencimiento,
            diasFPC: item.diasFPC,
          });
        }

        return acc;
      },
      {} as Record<
        string,
        {
          descripcion: string;
          totalEnPicking: number;
          totalEnReserva: number;
          pickingLocations: {
            lpn: string;
            localizacion: string;
            disponible: number;
            fechaVencimiento?: string | null;
            diasFPC?: number | null;
          }[];
          reserveLocations: {
            lpn: string;
            localizacion: string;
            disponible: number;
            fechaVencimiento?: string | null;
            diasFPC?: number | null;
          }[];
        }
      >,
    );

    const sortByFefo = (a: any, b: any) => {
      const aFpc = a.diasFPC;
      const bFpc = b.diasFPC;
      if (aFpc != null && bFpc != null) {
        if (aFpc !== bFpc) return aFpc - bFpc;
      }
      if (aFpc != null && bFpc == null) return -1;
      if (aFpc == null && bFpc != null) return 1;

      const aDate = a.fechaVencimiento
        ? new Date(a.fechaVencimiento).getTime()
        : null;
      const bDate = b.fechaVencimiento
        ? new Date(b.fechaVencimiento).getTime()
        : null;
      if (aDate && bDate) {
        if (aDate !== bDate) return aDate - bDate;
      }
      if (aDate && !bDate) return -1;
      if (!aDate && bDate) return 1;
      return 0;
    };

    const createSuggestionsForSales = (candidates: any[]) => {
      return candidates.map((candidate) => {
        const sortedReserveLocations = [...candidate.ubicacionesDeReserva].sort(
          sortByFefo,
        );

        let cantidadARestockear = 0;
        const ubicacionesSugeridas: z.infer<typeof UbicacionSugeridaSchema>[] =
          [];
        let needed = candidate.amountToRestock;

        for (const location of sortedReserveLocations) {
          if (needed <= 0) break;

          let amountToTake;
          // Para artículos de alta rotación, sugerir mover todo el LPN/pallet.
          // Para artículos de baja rotación (reposición), sugerir mover solo la cantidad exacta necesaria.
          if (candidate.isHighTurnover) {
            amountToTake = location.disponible;
          } else {
            amountToTake = Math.min(location.disponible, needed);
          }

          cantidadARestockear += amountToTake;
          ubicacionesSugeridas.push({
            lpn: location.lpn,
            localizacion: location.localizacion,
            diasFPC: location.diasFPC,
            fechaVencimiento: location.fechaVencimiento,
            cantidad: amountToTake,
          });
          needed -= amountToTake;
        }

        return {
          sku: candidate.sku,
          descripcion: candidate.descripcion,
          cantidadVendida: candidate.cantidadVendida || 0,
          cantidadDisponible: candidate.stockEnPicking,
          cantidadARestockear: cantidadARestockear,
          ubicacionesSugeridas: ubicacionesSugeridas,
        };
      });
    };

    const salesBySku = salesData.reduce(
      (acc, item) => {
        const sku = item.material;
        if (!acc[sku]) {
          acc[sku] = {
            descripcion: item.descripcion,
            totalVendida: 0,
          };
        }
        acc[sku].totalVendida += item.cantidadConfirmada;
        return acc;
      },
      {} as Record<string, { descripcion: string; totalVendida: number }>,
    );

    const candidates = [];
    const missingProducts: MissingProductsOutput[] = [];
    const okProducts: z.infer<typeof GenerateRestockSuggestionsOutputSchema> =
      [];

    const THRESHOLD_VENTAS_ALTAS = 10;

    for (const sku in salesBySku) {
      const inventory = inventoryBySku[sku];
      const sale = salesBySku[sku];

      if (!inventory) {
        missingProducts.push({
          sku,
          descripcion: sale.descripcion,
          cantidadVendida: sale.totalVendida,
        });
      } else if (
        inventory.totalEnPicking < sale.totalVendida &&
        inventory.totalEnReserva > 0
      ) {
        const amountToRestock = sale.totalVendida - inventory.totalEnPicking;

        // Determinar si es una reposición de alta rotación (pallets completos) o una reposición pequeña (unidades exactas).
        const isHighTurnover = amountToRestock >= THRESHOLD_VENTAS_ALTAS;

        candidates.push({
          sku: sku,
          descripcion: inventory.descripcion || sale.descripcion,
          cantidadVendida: sale.totalVendida,
          stockEnPicking: inventory.totalEnPicking,
          ubicacionesDeReserva: inventory.reserveLocations.filter(
            (loc) => loc.disponible > 0,
          ),
          amountToRestock: amountToRestock,
          isHighTurnover: isHighTurnover, // Pasar la bandera al creador de sugerencias
        });
      } else if (inventory.totalEnPicking >= sale.totalVendida) {
        okProducts.push({
          sku: sku,
          descripcion: inventory.descripcion || sale.descripcion,
          cantidadVendida: sale.totalVendida,
          cantidadDisponible: inventory.totalEnPicking,
          cantidadARestockear: 0,
          ubicacionesSugeridas: inventory.pickingLocations.map((loc) => ({
            lpn: loc.lpn,
            localizacion: loc.localizacion,
            fechaVencimiento: loc.fechaVencimiento,
            diasFPC: loc.diasFPC,
            cantidad: loc.disponible,
          })),
        });
      }
    }

    const suggestions = createSuggestionsForSales(candidates);
    const allSuggestions = [...suggestions, ...okProducts].sort((a, b) => {
      if (a.cantidadARestockear > 0 && b.cantidadARestockear === 0) return -1;
      if (a.cantidadARestockear === 0 && b.cantidadARestockear > 0) return 1;
      return a.sku.localeCompare(b.sku);
    });

    return { suggestions: allSuggestions, missingProducts };
  },
);
