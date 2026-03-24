"use server";
/**
 * @fileOverview Flujo para validar diferencias de lotes entre archivo SAP de entrada y albaran WMS.
 * Compara lotes por SKU y devuelve estado OK o DIFERENTE.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";
import { LotCrossResultSchema } from "../schemas";

const LotCrossInputSchema = z.object({
  sapData: z.array(z.any()),
  wmsData: z.array(z.any()),
});

export async function runLotCross(
  input: z.infer<typeof LotCrossInputSchema>,
): Promise<z.infer<typeof LotCrossResultSchema>> {
  return lotCrossFlow(input);
}

const lotCrossFlow = ai.defineFlow(
  {
    name: "lotCrossFlow",
    inputSchema: LotCrossInputSchema,
    outputSchema: LotCrossResultSchema,
  },
  async (input) => {
    const { sapData, wmsData } = input;

    const norm = (value: any) =>
      String(value || "")
        .trim()
        .toUpperCase();
    const toNumber = (value: any) => {
      if (typeof value === "number") return value;
      if (value === null || value === undefined) return 0;
      const cleaned = String(value)
        .replace(/\s/g, "")
        .replace(/\./g, "")
        .replace(",", ".");
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    type Aggregate = {
      descripcion: string;
      lotes: Set<string>;
      cantidad: number;
    };

    const sapBySku = new Map<string, Aggregate>();
    const wmsBySku = new Map<string, Aggregate>();

    for (const row of sapData) {
      const sku = norm(row.sku);
      const lote = norm(row.lote);
      if (!sku || !lote) continue;

      const current = sapBySku.get(sku) ?? {
        descripcion: norm(row.descripcion),
        lotes: new Set<string>(),
        cantidad: 0,
      };

      current.lotes.add(lote);
      current.cantidad +=
        row.cantidad !== undefined && row.cantidad !== null
          ? toNumber(row.cantidad)
          : 1;
      if (!current.descripcion && row.descripcion) {
        current.descripcion = norm(row.descripcion);
      }
      sapBySku.set(sku, current);
    }

    for (const row of wmsData) {
      const sku = norm(row.sku);
      const lote = norm(row.lote);
      if (!sku || !lote) continue;

      const current = wmsBySku.get(sku) ?? {
        descripcion: norm(row.descripcion),
        lotes: new Set<string>(),
        cantidad: 0,
      };

      current.lotes.add(lote);
      current.cantidad +=
        row.cantidad !== undefined && row.cantidad !== null
          ? toNumber(row.cantidad)
          : 1;
      if (!current.descripcion && row.descripcion) {
        current.descripcion = norm(row.descripcion);
      }
      wmsBySku.set(sku, current);
    }

    const allSkus = new Set([...sapBySku.keys(), ...wmsBySku.keys()]);

    const results = Array.from(allSkus).map((sku) => {
      const sap = sapBySku.get(sku);
      const wms = wmsBySku.get(sku);

      const lotesSap = Array.from(sap?.lotes ?? []).sort();
      const lotesWms = Array.from(wms?.lotes ?? []).sort();

      const sapSet = new Set(lotesSap);
      const wmsSet = new Set(lotesWms);

      const lotesSoloSap = lotesSap.filter((l) => !wmsSet.has(l));
      const lotesSoloWms = lotesWms.filter((l) => !sapSet.has(l));

      const estado: "OK" | "DIFERENTE" =
        lotesSoloSap.length === 0 && lotesSoloWms.length === 0
          ? "OK"
          : "DIFERENTE";

      return {
        sku,
        descripcion: sap?.descripcion || wms?.descripcion || "",
        lotesSap,
        lotesWms,
        lotesSoloSap,
        lotesSoloWms,
        cantidadSap: sap?.cantidad ?? 0,
        cantidadWms: wms?.cantidad ?? 0,
        estado,
      };
    });

    results.sort((a, b) => {
      if (a.estado !== b.estado) {
        return a.estado === "DIFERENTE" ? -1 : 1;
      }
      return a.sku.localeCompare(b.sku);
    });

    return { results };
  },
);
