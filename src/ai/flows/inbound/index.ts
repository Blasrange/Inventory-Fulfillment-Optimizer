"use server";
/**
 * @fileOverview Flujo para procesar entradas de mercancía basadas en un mapeo dinámico y valores fijos.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";
import { InboundResultSchema } from "../schemas";

const InboundInputSchema = z.object({
  rows: z.array(z.record(z.any())),
  mapping: z.record(z.string()),
  fixedValues: z.record(z.string()),
});

/**
 * Convierte números de fecha de Excel (ej. 46600) a formato YYYY-MM-DD
 */
function formatExcelDate(value: any): string {
  if (typeof value === "number") {
    // Excel base date: Dec 30, 1899
    const date = new Date((value - 25569) * 86400 * 1000);
    return date.toISOString().split("T")[0];
  }
  return String(value || "");
}

export async function runInboundProcess(
  input: z.infer<typeof InboundInputSchema>,
): Promise<z.infer<typeof InboundResultSchema>> {
  return inboundFlow(input);
}

const inboundFlow = ai.defineFlow(
  {
    name: "inboundFlow",
    inputSchema: InboundInputSchema,
    outputSchema: InboundResultSchema,
  },
  async (input) => {
    const { rows, mapping, fixedValues } = input;

    const results = rows.map((row) => {
      const getVal = (key: string, defaultValue: any = "") => {
        const val =
          fixedValues[key] || (mapping[key] ? row[mapping[key]] : defaultValue);

        // Manejo especial para campos de fecha que pueden venir como números de Excel
        if (
          [
            "ORDER_DATE",
            "SERVICE_DATE",
            "FECHA_DE_VENCIMIENTO",
            "FECHA_DE_FABRICACION",
          ].includes(key)
        ) {
          if (typeof val === "number") return formatExcelDate(val);
        }

        // Asegurar que devolvemos string para campos de texto incluso si el mapeo trajo un número
        if (
          typeof val === "number" &&
          !["QTY", "PRICE", "TAXES", "IBL_WEIGHT"].includes(key)
        ) {
          return String(val);
        }

        return val === null || val === undefined ? "" : val;
      };

      const entry: any = {
        N_ORDER: String(getVal("N_ORDER")),
        ORDER2: String(getVal("ORDER2")),
        PURCHASE_ORDER: String(getVal("PURCHASE_ORDER")),
        INVOICE: String(getVal("INVOICE")),
        PROVIDER_UID: String(getVal("PROVIDER_UID")),
        ORDER_DATE: String(getVal("ORDER_DATE")),
        SERVICE_DATE: String(getVal("SERVICE_DATE")),
        INBOUNDTYPE_CODE: String(getVal("INBOUNDTYPE_CODE")),
        NOTE: String(getVal("NOTE")),
        SKU: String(getVal("SKU")),
        LOTE: String(getVal("LOTE")),
        FECHA_DE_VENCIMIENTO: String(getVal("FECHA_DE_VENCIMIENTO")),
        FECHA_DE_FABRICACION: String(getVal("FECHA_DE_FABRICACION")),
        SERIAL: String(getVal("SERIAL")),
        ESTADO_CALIDAD: String(getVal("ESTADO_CALIDAD")),
        QTY: Number(getVal("QTY")) || 0,
        UOM_CODE: String(getVal("UOM_CODE")),
        REFERENCE: String(getVal("REFERENCE")),
        PRICE: Number(getVal("PRICE")) || 0,
        TAXES: Number(getVal("TAXES")) || 0,
        IBL_LPN_CODE: String(getVal("IBL_LPN_CODE")),
        IBL_WEIGHT: Number(getVal("IBL_WEIGHT")) || 0,
      };
      return entry;
    });

    return { results };
  },
);
