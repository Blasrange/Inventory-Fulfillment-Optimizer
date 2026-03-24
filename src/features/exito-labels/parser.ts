import * as XLSX from "xlsx";
import type { ExitoLabelData, ParseExitoExcelResult } from "@/ai/flows/schemas";
import storesData from "./store.json";
import { exitoLabelsColumnMapping } from "@/app/config";

type StoreRecord = {
  Codigo: string;
  Tienda: string;
  Dirección: string;
  Ciudad: string;
  Departamento: string;
};

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function asNumber(value: unknown): number {
  const raw = asText(value);
  const normalized = raw
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(/,/g, ".");
  const num = Number(normalized);
  if (Number.isNaN(num)) return 0;
  return num;
}

function normalizeHeader(value: string): string {
  return value
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const normalizeCandidates = (values: string[]): string[] =>
  values.map(normalizeHeader);

const includesAny = (value: string, candidates: string[]): boolean =>
  candidates.some((candidate) => value === candidate);

const findColumnIndex = (headerRow: string[], candidates: string[]): number => {
  for (let i = 0; i < headerRow.length; i += 1) {
    if (includesAny(headerRow[i], candidates)) {
      return i;
    }
  }
  return -1;
};

const barcodeCandidates = normalizeCandidates(exitoLabelsColumnMapping.barcode);
const dependenciaCandidates = normalizeCandidates(
  exitoLabelsColumnMapping.dependencia,
);
const tiendaCandidates = normalizeCandidates(exitoLabelsColumnMapping.tienda);
const cantidadCandidates = normalizeCandidates(
  exitoLabelsColumnMapping.cantidad,
);
const ocCandidates = normalizeCandidates(exitoLabelsColumnMapping.ocMarker);

function normalizeStoreCode(value: unknown): string {
  const raw = asText(value);
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  return digits.padStart(4, "0");
}

const stores = storesData as StoreRecord[];
const storeByCode = new Map<string, StoreRecord>(
  stores.map((store) => [normalizeStoreCode(store.Codigo), store]),
);

export function parseExitoExcel(
  content: string | ArrayBuffer,
): ParseExitoExcelResult {
  if (!(content instanceof ArrayBuffer)) {
    throw new Error("El archivo debe ser Excel (.xlsx).");
  }

  const workbook = XLSX.read(content, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("No se encontro ninguna hoja en el archivo.");
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];

  if (rows.length === 0) {
    throw new Error("El archivo Excel esta vacio.");
  }

  let ordenCompra = "";
  let cedi = "";
  const warnings: string[] = [];

  const ocRowIndex = rows.findIndex((row) =>
    row.some((cell) =>
      includesAny(normalizeHeader(asText(cell)), ocCandidates),
    ),
  );
  if (ocRowIndex >= 0) {
    const ocRow = rows[ocRowIndex];
    const ocCellIndex = ocRow.findIndex((cell) =>
      includesAny(normalizeHeader(asText(cell)), ocCandidates),
    );
    if (ocCellIndex >= 0) {
      ordenCompra = asText(ocRow[ocCellIndex + 1]);
      cedi = asText(ocRow[ocCellIndex + 2]);
    }
  } else {
    warnings.push("No se encontro la fila de OC. Se usaran valores vacios.");
  }

  const tableHeaderIndex = rows.findIndex(
    (row) =>
      row.some((cell) =>
        includesAny(normalizeHeader(asText(cell)), barcodeCandidates),
      ) &&
      row.some((cell) =>
        includesAny(normalizeHeader(asText(cell)), dependenciaCandidates),
      ),
  );

  if (tableHeaderIndex < 0) {
    throw new Error(
      "No se encontro la cabecera de detalle (COD. BARRA, DEPENDENCIAS, etc).",
    );
  }

  const headerRow = rows[tableHeaderIndex].map((h) =>
    normalizeHeader(asText(h)),
  );
  const barcodeIndex = findColumnIndex(headerRow, barcodeCandidates);
  const dependenciaIndex = findColumnIndex(headerRow, dependenciaCandidates);
  const tiendaIndex = findColumnIndex(headerRow, tiendaCandidates);
  const cantidadIndex = findColumnIndex(headerRow, cantidadCandidates);

  if (
    barcodeIndex < 0 ||
    dependenciaIndex < 0 ||
    tiendaIndex < 0 ||
    cantidadIndex < 0
  ) {
    throw new Error(
      "El encabezado no tiene todas las columnas requeridas: COD. BARRA, DEPENDENCIAS, DESC. ITEM y CJ/UN.",
    );
  }

  const labels: ExitoLabelData[] = [];
  let currentBarcode = "";
  let currentDescription = "";
  const missingStoreCodes = new Set<string>();

  for (let i = tableHeaderIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    const barcodeCell = asText(row[barcodeIndex]);
    const dependenciaCell = asText(row[dependenciaIndex]);
    const tiendaCell = asText(row[tiendaIndex]);
    const cantidad = asNumber(row[cantidadIndex]);

    const isCompletelyEmpty =
      [barcodeCell, dependenciaCell, tiendaCell].every((v) => v === "") &&
      cantidad === 0;
    if (isCompletelyEmpty) {
      continue;
    }

    if (barcodeCell) {
      currentBarcode = barcodeCell;
      currentDescription = tiendaCell || currentDescription;
      continue;
    }

    if (!dependenciaCell || cantidad <= 0) {
      continue;
    }

    const totalCajas = Math.max(1, Math.round(cantidad));
    const dependenciaCode = normalizeStoreCode(dependenciaCell);
    const store = storeByCode.get(dependenciaCode);

    if (!store && dependenciaCode) {
      missingStoreCodes.add(dependenciaCode);
    }

    const tienda = store?.Tienda || tiendaCell || "Localizacion no registrada";
    const direccion = store?.["Dirección"] || "N/A";
    const ciudad = store?.Ciudad || "N/A";
    const departamento = store?.Departamento || "N/A";

    for (let caja = 1; caja <= totalCajas; caja += 1) {
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

  if (missingStoreCodes.size > 0) {
    warnings.push(
      `No se encontraron ${missingStoreCodes.size} codigos de tienda en store.json. Ejemplos: ${Array.from(missingStoreCodes).slice(0, 5).join(", ")}`,
    );
  }

  if (labels.length === 0) {
    warnings.push(
      "No se encontraron filas de tiendas con cantidad para generar etiquetas.",
    );
  }

  return {
    ordenCompra,
    cedi,
    labels,
    warnings,
  };
}
