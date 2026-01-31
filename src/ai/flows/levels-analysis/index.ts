"use server";
/**
 * @fileOverview Este archivo define el flujo de Genkit para generar sugerencias de reabastecimiento
 * basadas en niveles mínimos/máximos.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";
import {
  InventoryDataSchema,
  MinMaxDataSchema,
  AnalysisResultSchema,
  RestockSuggestionSchema,
  GenerateRestockSuggestionsOutputSchema,
  UbicacionSugeridaSchema,
} from "../schemas";
import { analysisConfig } from "../config";

const GenerateLevelsAnalysisInputSchema = z.object({
  inventoryData: InventoryDataSchema.describe(
    "Inventory data from the WMS file.",
  ),
  minMaxData: MinMaxDataSchema.describe("Min/Max levels data."),
});
export type GenerateLevelsAnalysisInput = z.infer<
  typeof GenerateLevelsAnalysisInputSchema
>;
export type GenerateRestockSuggestionsOutput = z.infer<
  typeof GenerateRestockSuggestionsOutputSchema
>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export async function generateLevelsAnalysis(
  input: GenerateLevelsAnalysisInput,
): Promise<AnalysisResult> {
  return levelsAnalysisFlow(input);
}

const levelsAnalysisFlow = ai.defineFlow(
  {
    name: "levelsAnalysisFlow",
    inputSchema: GenerateLevelsAnalysisInputSchema,
    outputSchema: AnalysisResultSchema,
  },
  async (input) => {
    const { inventoryData, minMaxData } = input;

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

    const createSuggestionsForLevels = (candidates: any[]) => {
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

          const amountToTake = Math.min(location.disponible, needed);

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
          cantidadVendida: 0,
          cantidadDisponible: candidate.stockEnPicking,
          cantidadARestockear: cantidadARestockear,
          ubicacionesSugeridas: ubicacionesSugeridas,
          lpnDestino: candidate.lpnDestino,
          localizacionDestino: candidate.localizacionDestino,
        };
      });
    };

    const inventoryMap = freeStockInventory.reduce((acc, item) => {
      const key = `${item.sku}__${item.localizacion}`;
      if (!acc.has(key)) acc.set(key, 0);
      acc.set(key, acc.get(key)! + item.disponible);
      return acc;
    }, new Map<string, number>());

    const candidates: any[] = [];
    const okProducts: z.infer<typeof RestockSuggestionSchema>[] = [];

    for (const rule of minMaxData) {
      const { sku, localizacion, cantidadMinima, cantidadMaxima, lpn } = rule;
      const inventoryKey = `${sku}__${localizacion}`;
      const currentStock = inventoryMap.get(inventoryKey) || 0;
      const generalSkuInventory = inventoryBySku[sku];

      if (
        generalSkuInventory &&
        currentStock < cantidadMinima &&
        generalSkuInventory.totalEnReserva > 0
      ) {
        candidates.push({
          sku: sku,
          descripcion: generalSkuInventory.descripcion,
          amountToRestock: cantidadMaxima - currentStock,
          stockEnPicking: currentStock,
          ubicacionesDeReserva: generalSkuInventory.reserveLocations.filter(
            (loc) => loc.disponible > 0,
          ),
          lpnDestino: lpn,
          localizacionDestino: localizacion,
        });
      } else {
        okProducts.push({
          sku: sku,
          descripcion: generalSkuInventory
            ? generalSkuInventory.descripcion
            : "N/A",
          cantidadVendida: 0,
          cantidadDisponible: currentStock,
          cantidadARestockear: 0,
          ubicacionesSugeridas: [
            {
              lpn,
              localizacion,
              cantidad: currentStock,
              diasFPC: null,
              fechaVencimiento: null,
            },
          ],
          lpnDestino: lpn,
          localizacionDestino: localizacion,
        });
      }
    }

    const suggestions = createSuggestionsForLevels(candidates);
    const allSuggestions = [...suggestions, ...okProducts].sort((a, b) => {
      if (a.cantidadARestockear > 0 && b.cantidadARestockear === 0) return -1;
      if (a.cantidadARestockear === 0 && b.cantidadARestockear > 0) return 1;
      return a.sku.localeCompare(b.sku);
    });

    return {
      suggestions: allSuggestions,
      missingProducts: [],
    };
  },
);
