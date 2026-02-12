"use server";
/**
 * @fileOverview This file defines the Genkit flow for generating restock suggestions based on sales data.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";
import {
  SalesDataSchema,
  InventoryDataSchema,
  AnalysisResultSchema,
  RestockSuggestionSchema,
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

    // 1. Filter inventory to only include stock that is free to use and not in the discrepancy location.
    const freeStockInventory = inventoryData.filter(
      (item) =>
        item.estado &&
        VALID_STATUSES.includes(item.estado.toUpperCase()) &&
        !IGNORED_LOCATIONS.includes(item.localizacion),
    );

    // 2. Aggregate inventory by SKU, separating picking and different types of reserve locations.
    const inventoryBySku = freeStockInventory.reduce(
      (acc, item) => {
        const sku = item.sku.toUpperCase();
        if (!acc[sku]) {
          acc[sku] = {
            descripcion: item.descripcion,
            totalEnPicking: 0,
            totalPrimaryReserve: 0,
            totalAdditionalReserve: 0,
            pickingLocations: [],
            primaryReserveLocations: [],
            additionalReserveLocations: [],
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

        const locationData = {
          lpn: item.lpn,
          localizacion: locationStr,
          disponible: item.disponible,
          fechaVencimiento: item.fechaVencimiento,
          diasFPC: item.diasFPC,
        };

        if (isPicking) {
          acc[sku].totalEnPicking += item.disponible;
          acc[sku].pickingLocations.push(locationData);
        } else if (isReserveByLevel) {
          acc[sku].totalPrimaryReserve += item.disponible;
          acc[sku].primaryReserveLocations.push(locationData);
        } else if (isReserveByAdditional) {
          acc[sku].totalAdditionalReserve += item.disponible;
          acc[sku].additionalReserveLocations.push(locationData);
        }

        return acc;
      },
      {} as Record<
        string,
        {
          descripcion: string;
          totalEnPicking: number;
          totalPrimaryReserve: number;
          totalAdditionalReserve: number;
          pickingLocations: {
            lpn: string;
            localizacion: string;
            disponible: number;
            fechaVencimiento?: string | null;
            diasFPC?: number | null;
          }[];
          primaryReserveLocations: {
            lpn: string;
            localizacion: string;
            disponible: number;
            fechaVencimiento?: string | null;
            diasFPC?: number | null;
          }[];
          additionalReserveLocations: {
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
          if (cantidadARestockear >= needed) break;

          let amountToTake;

          // Validación de estiba completa
          if (candidate.isHighTurnover) {
            // High turnover: tomar pallets completos
            amountToTake = location.disponible;
          } else {
            // Bajo turnover: tomar solo lo necesario
            amountToTake = Math.min(
              location.disponible,
              needed - cantidadARestockear,
            );
          }

          cantidadARestockear += amountToTake;

          ubicacionesSugeridas.push({
            lpn: location.lpn,
            localizacion: location.localizacion,
            diasFPC: location.diasFPC,
            fechaVencimiento: location.fechaVencimiento,
            cantidad: amountToTake,
            esEstibaCompleta: amountToTake === location.disponible,
          });
        }

        // Calcular cantidad faltante
        const cantidadFaltante = Math.max(
          0,
          candidate.amountToRestock - cantidadARestockear,
        );

        return {
          sku: candidate.sku,
          descripcion: candidate.descripcion,
          cantidadVendida: candidate.cantidadVendida || 0,
          cantidadDisponible: candidate.stockEnPicking,
          cantidadARestockear: cantidadARestockear,
          cantidadTotalCubierta: cantidadARestockear,
          cantidadFaltante: cantidadFaltante,
          ubicacionesSugeridas: ubicacionesSugeridas,
          lpnDestino: null,
          localizacionDestino: null,
        };
      });
    };

    const salesBySku = salesData.reduce(
      (acc, item) => {
        const sku = item.material.toUpperCase();
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

    const candidates: any[] = [];
    const missingProducts: MissingProductsOutput[] = [];
    const okProducts: z.infer<typeof RestockSuggestionSchema>[] = [];

    const THRESHOLD_VENTAS_ALTAS = 10;

    for (const sku in salesBySku) {
      const inventory = inventoryBySku[sku];
      const sale = salesBySku[sku];

      // Case 1: Product sold but has NO inventory AT ALL
      if (!inventory) {
        missingProducts.push({
          sku,
          descripcion: sale.descripcion,
          cantidadVendida: sale.totalVendida,
          cantidadFaltante: sale.totalVendida,
          stockEnPicking: 0,
          stockEnReserva: 0,
          cantidadCubierta: 0,
          tipoFalta: "SIN_INVENTARIO",
        });
        continue;
      }

      // Case 2: Stock in picking is insufficient to cover sales.
      if (inventory.totalEnPicking < sale.totalVendida) {
        const amountToRestock = sale.totalVendida - inventory.totalEnPicking;

        // Prioritize primary reserve levels first
        const usePrimaryReserve = inventory.totalPrimaryReserve > 0;
        const reserveLocationsToUse = usePrimaryReserve
          ? inventory.primaryReserveLocations
          : inventory.additionalReserveLocations;

        const totalReserveDisponible = reserveLocationsToUse.reduce(
          (sum, loc) => sum + loc.disponible,
          0,
        );

        const hasAnyReserve = totalReserveDisponible > 0;

        // Subcase 2a: Reserve can help
        if (hasAnyReserve) {
          const isHighTurnover = amountToRestock >= THRESHOLD_VENTAS_ALTAS;
          const cantidadCubierta = Math.min(
            totalReserveDisponible,
            amountToRestock,
          );
          const cantidadFaltante = amountToRestock - cantidadCubierta;

          candidates.push({
            sku: sku,
            descripcion: inventory.descripcion || sale.descripcion,
            cantidadVendida: sale.totalVendida,
            stockEnPicking: inventory.totalEnPicking,
            stockEnReserva: totalReserveDisponible,
            ubicacionesDeReserva: reserveLocationsToUse.filter(
              (loc) => loc.disponible > 0,
            ),
            amountToRestock: amountToRestock,
            cantidadCubierta: cantidadCubierta,
            cantidadFaltante: cantidadFaltante,
            isHighTurnover: isHighTurnover,
          });

          // Si hay cantidad faltante, agregar a missing products
          if (cantidadFaltante > 0) {
            missingProducts.push({
              sku,
              descripcion: inventory.descripcion || sale.descripcion,
              cantidadVendida: sale.totalVendida,
              cantidadFaltante: cantidadFaltante,
              stockEnPicking: inventory.totalEnPicking,
              stockEnReserva: totalReserveDisponible,
              cantidadCubierta: cantidadCubierta,
              tipoFalta: "RESERVA_INSUFICIENTE",
            });
          }
        }
        // Subcase 2b: No reserve stock at all
        else {
          missingProducts.push({
            sku,
            descripcion: inventory.descripcion || sale.descripcion,
            cantidadVendida: sale.totalVendida,
            cantidadFaltante: amountToRestock,
            stockEnPicking: inventory.totalEnPicking,
            stockEnReserva: 0,
            cantidadCubierta: 0,
            tipoFalta: "SIN_RESERVA",
          });
        }
      }
      // Case 3: Picking stock is sufficient
      else {
        okProducts.push({
          sku: sku,
          descripcion: inventory.descripcion || sale.descripcion,
          cantidadVendida: sale.totalVendida,
          cantidadDisponible: inventory.totalEnPicking,
          cantidadARestockear: 0,
          cantidadTotalCubierta: 0,
          cantidadFaltante: 0,
          ubicacionesSugeridas: inventory.pickingLocations.map((loc) => ({
            lpn: loc.lpn,
            localizacion: loc.localizacion,
            fechaVencimiento: loc.fechaVencimiento,
            diasFPC: loc.diasFPC,
            cantidad: loc.disponible,
            esEstibaCompleta: false,
          })),
          lpnDestino: null,
          localizacionDestino: null,
        });
      }
    }

    const suggestions = createSuggestionsForSales(candidates);
    const allSuggestions = [...suggestions, ...okProducts].sort((a, b) => {
      if (a.cantidadARestockear > 0 && b.cantidadARestockear === 0) return -1;
      if (a.cantidadARestockear === 0 && b.cantidadARestockear > 0) return 1;
      return a.sku.localeCompare(b.sku);
    });

    return {
      suggestions: allSuggestions,
      missingProducts,
    };
  },
);
