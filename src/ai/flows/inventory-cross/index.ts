'use server';
/**
 * @fileOverview Flujo para realizar el cruce de inventarios entre SAP (Cliente) y WMS.
 * Permite agrupar por SKU + Lote o solo por SKU.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { InventoryCrossResultSchema } from '../schemas';

const InventoryCrossInputSchema = z.object({
  sapData: z.array(z.any()),
  wmsData: z.array(z.any()),
  groupByLot: z.boolean().default(true),
});

export async function runInventoryCross(input: z.infer<typeof InventoryCrossInputSchema>): Promise<z.infer<typeof InventoryCrossResultSchema>> {
  return inventoryCrossFlow(input);
}

const inventoryCrossFlow = ai.defineFlow(
  {
    name: 'inventoryCrossFlow',
    inputSchema: InventoryCrossInputSchema,
    outputSchema: InventoryCrossResultSchema,
  },
  async (input) => {
    const { sapData, wmsData, groupByLot } = input;
    const norm = (v: any) => String(v || '').trim().toUpperCase();

    // Agregación SAP
    const sapAggregated = sapData.reduce((acc, item) => {
      const sku = norm(item.sku);
      const lote = groupByLot ? norm(item.lote) : 'UNIFICADO';
      const key = `${sku}__${lote}`;
      if (!acc[key]) {
        acc[key] = { sku, lote, cantidad: 0, descripcion: item.descripcion };
      }
      acc[key].cantidad += Number(item.cantidad) || 0;
      return acc;
    }, {} as Record<string, any>);

    // Agregación WMS
    const wmsAggregated = wmsData.reduce((acc, item) => {
      const sku = norm(item.sku);
      const lote = groupByLot ? norm(item.lote) : 'UNIFICADO';
      const key = `${sku}__${lote}`;
      if (!acc[key]) {
        acc[key] = { sku, lote, cantidad: 0, descripcion: item.descripcion };
      }
      acc[key].cantidad += Number(item.cantidad) || 0;
      return acc;
    }, {} as Record<string, any>);

    const allKeys = new Set([...Object.keys(sapAggregated), ...Object.keys(wmsAggregated)]);
    
    const results = Array.from(allKeys).map(key => {
      const sap = sapAggregated[key];
      const wms = wmsAggregated[key];
      
      const sku = sap?.sku || wms?.sku;
      const lote = sap?.lote || wms?.lote;
      const descripcion = sap?.descripcion || wms?.descripcion || '';
      const cantidadSap = sap?.cantidad || 0;
      const cantidadWms = wms?.cantidad || 0;
      const diferencia = cantidadSap - cantidadWms;

      return {
        sku,
        lote,
        descripcion,
        cantidadSap,
        cantidadWms,
        diferencia
      };
    });

    results.sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia) || a.sku.localeCompare(b.sku));

    return { results };
  }
);
