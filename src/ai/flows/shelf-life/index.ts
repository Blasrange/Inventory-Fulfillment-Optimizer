"use server";
/**
 * @fileOverview Flujo para el análisis de Vida Útil (Shelf Life).
 * El producto no puede superar en el inventario (FPC) el tiempo estipulado en la maestra.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";
import {
  InventoryDataSchema,
  ShelfLifeMasterSchema,
  ShelfLifeResultSchema,
} from "../schemas";

const ShelfLifeInputSchema = z.object({
  inventoryData: InventoryDataSchema,
  shelfLifeMasterData: ShelfLifeMasterSchema,
});

export async function runShelfLifeAnalysis(
  input: z.infer<typeof ShelfLifeInputSchema>,
): Promise<z.infer<typeof ShelfLifeResultSchema>> {
  return shelfLifeFlow(input);
}

const shelfLifeFlow = ai.defineFlow(
  {
    name: "shelfLifeFlow",
    inputSchema: ShelfLifeInputSchema,
    outputSchema: ShelfLifeResultSchema,
  },
  async (input) => {
    const { inventoryData, shelfLifeMasterData } = input;
    const norm = (v: any) =>
      String(v || "")
        .trim()
        .toUpperCase();

    // Crear un mapa de la maestra para búsqueda rápida
    const masterMap = shelfLifeMasterData.reduce(
      (acc, item) => {
        acc[norm(item.sku)] = item.diasMinimos;
        return acc;
      },
      {} as Record<string, number>,
    );

    const results = inventoryData.map((item) => {
      const sku = norm(item.sku);
      const diasLimiteMaestra = masterMap[sku] || 0;
      const diasFPC = Number(item.diasFPC) || 0;

      // REGLA: El FPC del inventario NO puede superar el de la maestra
      const cumple = diasFPC <= diasLimiteMaestra;

      return {
        sku: item.sku,
        descripcion: item.descripcion,
        lpn: item.lpn,
        localizacion: item.localizacion,
        lote: item.lote,
        fechaVencimiento: item.fechaVencimiento,
        diasFPC: diasFPC,
        diasMinimosMaestra: diasLimiteMaestra,
        cumple: cumple,
        estado: cumple ? "OK" : "ALERTA",
      };
    });

    // Ordenar para mostrar primero las alertas (los que superaron el límite)
    results.sort((a, b) => {
      if (a.cumple !== b.cumple) return a.cumple ? 1 : -1;
      return b.diasFPC - a.diasFPC;
    });

    return { results };
  },
);
