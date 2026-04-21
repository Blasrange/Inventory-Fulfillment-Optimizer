"use server";

import { ai } from "@/ai/genkit";
import { z } from "zod";
import { InventoryAgeResultSchema, InventoryDataSchema } from "../schemas";

const InventoryAgeInputSchema = z.object({
  inventoryData: InventoryDataSchema,
});

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseInventoryDate(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const rawValue = String(value).trim();
  if (!rawValue) return null;

  const isoCandidate = new Date(rawValue);
  if (!Number.isNaN(isoCandidate.getTime())) {
    return isoCandidate;
  }

  const match = rawValue.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!match) return null;

  const [, day, month, year] = match;
  const normalizedYear = year.length === 2 ? `20${year}` : year;
  const parsedDate = new Date(
    Date.UTC(Number(normalizedYear), Number(month) - 1, Number(day)),
  );

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function getAgeBucket(daysInInventory: number | null) {
  if (daysInInventory === null) return "Sin fecha de entrada" as const;
  if (daysInInventory <= 90) return "0-3 meses" as const;
  if (daysInInventory <= 180) return "3-6 meses" as const;
  if (daysInInventory <= 365) return "6-12 meses" as const;
  return "> 12 meses" as const;
}

export async function runInventoryAgeAnalysis(
  input: z.infer<typeof InventoryAgeInputSchema>,
): Promise<z.infer<typeof InventoryAgeResultSchema>> {
  return inventoryAgeFlow(input);
}

const inventoryAgeFlow = ai.defineFlow(
  {
    name: "inventoryAgeFlow",
    inputSchema: InventoryAgeInputSchema,
    outputSchema: InventoryAgeResultSchema,
  },
  async (input) => {
    const today = new Date();
    const todayUtc = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    );

    const results = input.inventoryData
      .map((item) => {
        const parsedEntryDate = parseInventoryDate(item.fechaEntrada);
        const entryUtc = parsedEntryDate
          ? Date.UTC(
              parsedEntryDate.getUTCFullYear(),
              parsedEntryDate.getUTCMonth(),
              parsedEntryDate.getUTCDate(),
            )
          : null;
        const daysInInventory =
          entryUtc === null ? null : Math.max(0, Math.floor((todayUtc - entryUtc) / MS_PER_DAY));
        const ageBucket = getAgeBucket(daysInInventory);

        return {
          sku: item.sku,
          descripcion: item.descripcion,
          lpn: item.lpn,
          localizacion: item.localizacion,
          lote: item.lote,
          estado: item.estado,
          fechaEntrada: parsedEntryDate
            ? parsedEntryDate.toISOString().split("T")[0]
            : item.fechaEntrada || "",
          diasEnInventario: daysInInventory,
          rangoEdad: ageBucket,
        };
      })
      .sort((a, b) => {
        const rank = {
          "> 12 meses": 0,
          "6-12 meses": 1,
          "3-6 meses": 2,
          "0-3 meses": 3,
          "Sin fecha de entrada": 4,
        } as const;

        if (rank[a.rangoEdad] !== rank[b.rangoEdad]) {
          return rank[a.rangoEdad] - rank[b.rangoEdad];
        }

        return (b.diasEnInventario ?? -1) - (a.diasEnInventario ?? -1);
      });

    return { results };
  },
);