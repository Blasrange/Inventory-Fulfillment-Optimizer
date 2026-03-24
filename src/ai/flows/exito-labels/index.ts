"use server";
/**
 * @fileOverview Flujo para procesar el Excel de pedidos Éxito y generar
 * las etiquetas en formato estructurado (ZPL se genera en el cliente).
 *
 * Estructura del Excel esperada:
 *  - Fila con OC | número de OC | CEDI
 *  - Cabecera: COD. BARRA | COD. REF | DEPENDENCIAS | DESC. ITEM | MARCA | CANTIDAD | CJ/UN | EMBALAJE
 *  - Filas de producto (COD. BARRA lleno) y Sub-filas de tienda (COD. BARRA vacío)
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";
import { ExitoLabelsResultSchema } from "../schemas";
import storesData from "@/features/exito-labels/store.json";
import { exitoLabelsColumnMapping } from "@/app/config";

const ExitoLabelsInputSchema = z.object({
  rows: z
    .array(z.record(z.any()))
    .describe("Filas crudas del Excel aplanadas como objetos key-value."),
});

type StoreRecord = {
  Codigo: string;
  Tienda: string;
  Dirección: string;
  Ciudad: string;
  Departamento: string;
};

const normalizeStoreCode = (value: unknown): string => {
  const raw = String(value ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  return digits.padStart(4, "0");
};

const stores = storesData as StoreRecord[];
const storeByCode = new Map<string, StoreRecord>(
  stores.map((store) => [normalizeStoreCode(store.Codigo), store]),
);

const normalizeHeader = (value: unknown): string =>
  String(value ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeCandidates = (values: string[]): string[] =>
  values.map((value) => normalizeHeader(value));

const includesAny = (value: string, candidates: string[]): boolean =>
  candidates.some((candidate) => value === candidate);

const findColumnIndex = (values: unknown[], candidates: string[]): number => {
  for (let i = 0; i < values.length; i += 1) {
    if (includesAny(normalizeHeader(values[i]), candidates)) {
      return i;
    }
  }
  return -1;
};

const ocCandidates = normalizeCandidates(exitoLabelsColumnMapping.ocMarker);
const barcodeCandidates = normalizeCandidates(exitoLabelsColumnMapping.barcode);
const dependenciaCandidates = normalizeCandidates(
  exitoLabelsColumnMapping.dependencia,
);
const tiendaCandidates = normalizeCandidates(exitoLabelsColumnMapping.tienda);
const cantidadCandidates = normalizeCandidates(
  exitoLabelsColumnMapping.cantidad,
);

export async function runExitoLabelsProcess(
  input: z.infer<typeof ExitoLabelsInputSchema>,
): Promise<z.infer<typeof ExitoLabelsResultSchema>> {
  return exitoLabelsFlow(input);
}

const exitoLabelsFlow = ai.defineFlow(
  {
    name: "exitoLabelsFlow",
    inputSchema: ExitoLabelsInputSchema,
    outputSchema: ExitoLabelsResultSchema,
  },
  async (input) => {
    const { rows } = input;

    const norm = (v: any) => String(v ?? "").trim();

    // ── 1. Buscar fila de OC ──────────────────────────────────────────────────
    let ordenCompra = "";
    let cedi = "";

    for (const row of rows) {
      const values = Object.values(row);
      const ocIndex = values.findIndex((v) =>
        includesAny(normalizeHeader(v), ocCandidates),
      );
      if (ocIndex >= 0) {
        ordenCompra = norm(values[ocIndex + 1]);
        cedi = norm(values[ocIndex + 2]);
        break;
      }
    }

    // ── 2. Buscar fila de cabecera de detalle ────────────────────────────────
    let headerRow: Record<string, number> | null = null;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const values = Object.values(row);
      if (
        values.some((v) =>
          includesAny(normalizeHeader(v), barcodeCandidates),
        ) &&
        values.some((v) =>
          includesAny(normalizeHeader(v), dependenciaCandidates),
        )
      ) {
        // Construir mapa columna-nombre → índice
        headerRow = {};
        (Object.values(row) as any[]).forEach((val, idx) => {
          const normalized = normalizeHeader(val);
          // Guardamos el nombre original de la columna del objeto como clave
          const key = Object.keys(row)[idx];
          headerRow![normalized] = idx;
          headerRow![normalizeHeader(key)] = idx;
        });
        rows.splice(0, i + 1); // Descartar todo hasta la cabecera inclusive
        break;
      }
    }

    if (!headerRow) {
      return {
        labels: [],
        warnings: ["No se encontró la cabecera de detalle en el archivo."],
      };
    }

    // ── 3. Buscar índices de columnas clave ──────────────────────────────────
    const findIndex = (candidates: string[]): number => {
      for (const c of candidates) {
        const normalizedCandidate = normalizeHeader(c);
        if (headerRow![normalizedCandidate] !== undefined) {
          return headerRow![normalizedCandidate];
        }
      }
      return -1;
    };

    const barcodeIdx = findIndex(exitoLabelsColumnMapping.barcode);
    const dependenciaIdx = findIndex(exitoLabelsColumnMapping.dependencia);
    const tiendaIdx = findIndex(exitoLabelsColumnMapping.tienda);
    const cantidadIdx = findIndex(exitoLabelsColumnMapping.cantidad);

    if ([barcodeIdx, dependenciaIdx, cantidadIdx].includes(-1)) {
      return {
        labels: [],
        warnings: [
          "No se encontraron columnas requeridas: COD. BARRA, DEPENDENCIAS y CANTIDAD.",
        ],
      };
    }

    // ── 4. Procesar filas ────────────────────────────────────────────────────
    const labels: z.infer<typeof ExitoLabelsResultSchema>["labels"] = [];
    const warnings: string[] = [];

    let currentBarcode = "";
    let currentDescription = "";

    for (const row of rows) {
      const values = Object.values(row) as any[];

      const barcodeCell = norm(values[barcodeIdx] ?? "");
      const dependenciaCell = norm(values[dependenciaIdx] ?? "");
      const tiendaCell = tiendaIdx >= 0 ? norm(values[tiendaIdx] ?? "") : "";
      const cantidadRaw = values[cantidadIdx];
      const cantidad = Number(norm(cantidadRaw).replace(/,/g, ".")) || 0;

      const isCompletelyEmpty =
        !barcodeCell && !dependenciaCell && !tiendaCell && cantidad === 0;
      if (isCompletelyEmpty) continue;

      // Fila de producto (tiene código de barras)
      if (barcodeCell) {
        currentBarcode = barcodeCell;
        currentDescription = tiendaCell || currentDescription;
        continue;
      }

      // Fila de tienda
      if (!dependenciaCell || cantidad <= 0) continue;

      const totalCajas = Math.max(1, Math.round(cantidad));
      const dependenciaCode = normalizeStoreCode(dependenciaCell);
      const store = storeByCode.get(dependenciaCode);
      const tienda =
        store?.Tienda || tiendaCell || "Localización No Registrada";
      const direccion = store?.["Dirección"] || "N/A";
      const ciudad = store?.Ciudad || "N/A";
      const departamento = store?.Departamento || "N/A";

      for (let caja = 1; caja <= totalCajas; caja++) {
        labels.push({
          nc: "Corporación Colombiana de Logística",
          ct: dependenciaCode,
          codigoBarra: currentBarcode,
          tienda,
          depto: departamento,
          ciudad,
          orden: ordenCompra,
          direccion,
          numeroCaja: caja,
          totalCajas,
          cedi,
          desc: currentDescription || "SIN DESCRIPCION",
        });
      }
    }

    if (labels.length === 0) {
      warnings.push(
        "No se encontraron filas de tiendas con cantidad para generar etiquetas.",
      );
    }

    return { labels, warnings };
  },
);
