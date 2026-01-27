'use server';
/**
 * @fileOverview This file defines the Genkit flow for generating restock suggestions based on sales data.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import {
    SalesDataSchema,
    InventoryDataSchema,
    AnalysisResultSchema,
    GenerateRestockSuggestionsOutputSchema,
    MissingProductSchema,
    UbicacionSugeridaSchema
} from '../schemas';

const GenerateSalesAnalysisInputSchema = z.object({
  salesData: SalesDataSchema.describe('Sales data from the invoicing file.'),
  inventoryData: InventoryDataSchema.describe('Inventory data from the WMS file.'),
});
export type GenerateSalesAnalysisInput = z.infer<typeof GenerateSalesAnalysisInputSchema>;
export type GenerateRestockSuggestionsOutput = z.infer<typeof GenerateRestockSuggestionsOutputSchema>;
export type MissingProductsOutput = z.infer<typeof MissingProductSchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export async function generateSalesAnalysis(input: GenerateSalesAnalysisInput): Promise<AnalysisResult> {
  return salesAnalysisFlow(input);
}

const salesAnalysisFlow = ai.defineFlow(
  {
    name: 'salesAnalysisFlow',
    inputSchema: GenerateSalesAnalysisInputSchema,
    outputSchema: AnalysisResultSchema,
  },
  async (input) => {
    const { salesData, inventoryData } = input;

    // A list of valid inventory statuses to be considered as available stock.
    // Add new statuses from different clients/ERPs here.
    const VALID_STATUSES = ['STOCK EN ALMACEN LIBRE', 'DISPONIBLE'];

    // A list of locations to ignore completely from the analysis.
    const IGNORED_LOCATIONS = ['PDIF-INV-1-10'];

    // 1. Filter inventory to only include stock that is free to use and not in the discrepancy location.
    const freeStockInventory = inventoryData.filter(
      (item) => item.estado && VALID_STATUSES.includes(item.estado.toUpperCase()) && !IGNORED_LOCATIONS.includes(item.localizacion)
    );

    // 2. Aggregate inventory by SKU, separating picking and reserve locations.
    const inventoryBySku = freeStockInventory.reduce((acc, item) => {
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
      const lastPart = locationStr.split('-').pop();
      if (['5', '10', '15'].includes(lastPart || '')) {
        acc[sku].totalEnPicking += item.disponible;
        acc[sku].pickingLocations.push({ lpn: item.lpn, localizacion: locationStr, disponible: item.disponible, fechaVencimiento: item.fechaVencimiento, diasFPC: item.diasFPC });
      } else if (['20', '30', '40', '50', '60', '70'].includes(lastPart || '')) {
        acc[sku].totalEnReserva += item.disponible;
        acc[sku].reserveLocations.push({ lpn: item.lpn, localizacion: locationStr, disponible: item.disponible, fechaVencimiento: item.fechaVencimiento, diasFPC: item.diasFPC });
      }
      
      return acc;
    }, {} as Record<string, { 
        descripcion: string; 
        totalEnPicking: number; 
        totalEnReserva: number; 
        pickingLocations: { lpn: string; localizacion: string; disponible: number; fechaVencimiento?: string | null; diasFPC?: number | null; }[];
        reserveLocations: { lpn: string; localizacion: string; disponible: number; fechaVencimiento?: string | null; diasFPC?: number | null; }[];
    }>);

    const sortByFefo = (a: any, b: any) => {
        const aFpc = a.diasFPC;
        const bFpc = b.diasFPC;
        if (aFpc != null && bFpc != null) {
            if (aFpc !== bFpc) return aFpc - bFpc;
        }
        if (aFpc != null && bFpc == null) return -1;
        if (aFpc == null && bFpc != null) return 1;

        const aDate = a.fechaVencimiento ? new Date(a.fechaVencimiento).getTime() : null;
        const bDate = b.fechaVencimiento ? new Date(b.fechaVencimiento).getTime() : null;
        if (aDate && bDate) {
            if (aDate !== bDate) return aDate - bDate;
        }
        if (aDate && !bDate) return -1;
        if (!aDate && bDate) return 1;
        return 0;
    };

    const createSuggestionsForSales = (candidates: any[]) => {
      return candidates.map(candidate => {
        const sortedReserveLocations = [...candidate.ubicacionesDeReserva].sort(sortByFefo);

        let cantidadARestockear = 0;
        const ubicacionesSugeridas: z.infer<typeof UbicacionSugeridaSchema>[] = [];

        for (const location of sortedReserveLocations) {
            cantidadARestockear += location.disponible;
            ubicacionesSugeridas.push({
                lpn: location.lpn,
                localizacion: location.localizacion,
                diasFPC: location.diasFPC,
                fechaVencimiento: location.fechaVencimiento,
                cantidad: location.disponible,
            });

            if (candidate.cantidadVendida > 0) {
                if (cantidadARestockear > candidate.cantidadVendida) {
                    break; 
                }
            } else {
                break;
            }
        }
        
        return {
            sku: candidate.sku,
            descripcion: candidate.descripcion,
            cantidadVendida: candidate.cantidadVendida || 0,
            cantidadDisponible: candidate.stockEnPicking,
            cantidadARestockear: cantidadARestockear,
            ubicacionesSugeridas: ubicacionesSugeridas
        };
      });
    };
    
    const salesBySku = salesData.reduce((acc, item) => {
      const sku = item.material;
      if (!acc[sku]) {
        acc[sku] = {
          descripcion: item.descripcion,
          totalVendida: 0,
        };
      }
      acc[sku].totalVendida += item.cantidadConfirmada;
      return acc;
    }, {} as Record<string, { descripcion: string; totalVendida: number }>);

    const candidates = [];
    const missingProducts: MissingProductsOutput[] = [];
    const okProducts: z.infer<typeof GenerateRestockSuggestionsOutputSchema> = [];
    
    for (const sku in salesBySku) {
        const inventory = inventoryBySku[sku];
        const sale = salesBySku[sku];

        if (!inventory) {
          missingProducts.push({ sku, descripcion: sale.descripcion, cantidadVendida: sale.totalVendida });
        } else if (inventory.totalEnPicking < sale.totalVendida && inventory.totalEnReserva > 0) {
            candidates.push({
                sku: sku,
                descripcion: inventory.descripcion || sale.descripcion,
                cantidadVendida: sale.totalVendida,
                stockEnPicking: inventory.totalEnPicking,
                ubicacionesDeReserva: inventory.reserveLocations.filter(loc => loc.disponible > 0),
            });
        } else if (inventory.totalEnPicking >= sale.totalVendida) {
            okProducts.push({
                sku: sku,
                descripcion: inventory.descripcion || sale.descripcion,
                cantidadVendida: sale.totalVendida,
                cantidadDisponible: inventory.totalEnPicking,
                cantidadARestockear: 0,
                ubicacionesSugeridas: inventory.pickingLocations.map(loc => ({
                    lpn: loc.lpn, localizacion: loc.localizacion, fechaVencimiento: loc.fechaVencimiento, diasFPC: loc.diasFPC, cantidad: loc.disponible,
                })),
            });
        }
    }
    
    const suggestions = createSuggestionsForSales(candidates);
    const allSuggestions = [...suggestions, ...okProducts].sort((a,b) => {
        if (a.cantidadARestockear > 0 && b.cantidadARestockear === 0) return -1;
        if (a.cantidadARestockear === 0 && b.cantidadARestockear > 0) return 1;
        return a.sku.localeCompare(b.sku);
    });

    return { suggestions: allSuggestions, missingProducts };
  }
);
