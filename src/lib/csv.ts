import * as XLSX from "xlsx";

function normalizeHeaderValue(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00a0/g, " ")
    .toLowerCase()
    .replace(/["'`´‘’“”.,:;()/\\_-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function findHeaderIndex(headers: string[], possibleHeaders: string[]): number {
  for (const possibleHeader of possibleHeaders) {
    const index = headers.indexOf(normalizeHeaderValue(possibleHeader));
    if (index !== -1) {
      return index;
    }
  }
  return -1;
}

function getMissingRequiredColumns(
  columnMapping: Record<string, string[]>,
  headerIndices: Record<string, number>,
  optionalInternalKeys: string[],
): string[] {
  return Object.keys(columnMapping).filter(
    (internalKey) =>
      !(internalKey in headerIndices) &&
      !optionalInternalKeys.includes(internalKey.toLowerCase()),
  );
}

function normalizeDateCell(value: unknown): string {
  if (value instanceof Date) {
    try {
      return value.toISOString().split("T")[0];
    } catch {
      return String(value || "");
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const parsedDate = new Date(
      excelEpoch.getTime() + Math.round(value * 86400 * 1000),
    );

    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().split("T")[0];
    }
  }

  return String(value ?? "").trim();
}

function preserveCodeValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  
  if (typeof value === "number") {
    return String(value);
  }
  
  if (typeof value === "string") {
    return value.trim();
  }
  
  return String(value).trim();
}

function parseTextData(
  fileContent: string,
  columnMapping: Record<string, string[]>,
  numericColumns: string[],
): Record<string, any>[] {
  const lines = fileContent.trim().replace(/\r/g, "").split("\n");
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const delimiter = headerLine.includes("\t") ? "\t" : ",";
  const headers = headerLine.split(delimiter).map(normalizeHeaderValue);

  const headerIndices: Record<string, number> = {};
  const internalKeys = Object.keys(columnMapping);
  const optionalInternalKeys = [
    "fechaentrada",
    "fechavencimiento",
    "diasfpc",
    "lote",
  ];

  internalKeys.forEach((internalKey) => {
    const foundIndex = findHeaderIndex(headers, columnMapping[internalKey]);
    if (foundIndex !== -1) {
      headerIndices[internalKey] = foundIndex;
    }
  });

  const missingRequiredColumns = getMissingRequiredColumns(
    columnMapping,
    headerIndices,
    optionalInternalKeys,
  );

  if (missingRequiredColumns.length > 0) {
    const details = missingRequiredColumns
      .map(
        (internalKey) =>
          `"${internalKey}": "${columnMapping[internalKey].join('", "')}"`,
      )
      .join(", ");

    throw new Error(
      `Columnas requeridas no encontradas. Se esperaba alguna de estas opciones por campo: ${details}`,
    );
  }

  const codeFields = ["codigo", "sku", "Codigo", "Cod", "SKU", "material"];

  const data = lines
    .slice(1)
    .map((line) => {
      const values = line.split(delimiter);
      const record: Record<string, any> = {};

      for (const jsonKey in headerIndices) {
        const index = headerIndices[jsonKey];
        if (index < values.length && values[index] !== undefined) {
          let value: any = values[index].trim();

          if (numericColumns.includes(jsonKey)) {
            value = parseFloat(value.replace(/\./g, "").replace(",", ".")) || 0;
          } else if (codeFields.includes(jsonKey.toLowerCase())) {
            value = preserveCodeValue(value);
          }
          record[jsonKey] = value;
        }
      }
      return record;
    })
    .filter((record) => {
      return Object.values(record).some(
        (val) => val !== "" && val !== 0 && val !== null && val !== undefined,
      );
    });

  return data;
}

function parseExcelData(
  fileBuffer: Buffer,
  columnMapping: Record<string, string[]>,
  numericColumns: string[],
): Record<string, any>[] {
  const workbook = XLSX.read(fileBuffer, { 
    type: "buffer", 
    cellDates: true,
    cellText: true,
    raw: true
  });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    blankrows: false,
    raw: true,
    defval: ""
  }) as any[][];

  if (jsonData.length < 1) return [];

  const headerIndices: Record<string, number> = {};
  const internalKeys = Object.keys(columnMapping);
  const optionalInternalKeys = [
    "fechaentrada",
    "fechavencimiento",
    "diasfpc",
    "lote",
  ];

  let headerRowIndex = -1;
  const maxRowsToScan = Math.min(jsonData.length, 200);

  for (let r = 0; r < maxRowsToScan; r++) {
    const row = jsonData[r] || [];
    const headers = row.map(normalizeHeaderValue);

    const candidateIndices: Record<string, number> = {};
    let missingRequired = false;

    internalKeys.forEach((internalKey) => {
      const foundIndex = findHeaderIndex(headers, columnMapping[internalKey]);
      if (foundIndex !== -1) {
        candidateIndices[internalKey] = foundIndex;
      } else if (!optionalInternalKeys.includes(internalKey.toLowerCase())) {
        missingRequired = true;
      }
    });

    if (!missingRequired) {
      headerRowIndex = r;
      Object.assign(headerIndices, candidateIndices);
      break;
    }
  }

  if (headerRowIndex === -1) {
    const missingRequiredColumns = getMissingRequiredColumns(
      columnMapping,
      headerIndices,
      optionalInternalKeys,
    );
    const details = missingRequiredColumns
      .map(
        (internalKey) =>
          `"${internalKey}": "${columnMapping[internalKey].join('", "')}"`,
      )
      .join(", ");

    throw new Error(
      `No se encontró una fila de encabezados válida en Excel. Se esperaba alguna de estas opciones por campo: ${details}`,
    );
  }

  const codeFields = ["codigo", "sku", "Codigo", "Cod", "SKU", "material"];

  const data = jsonData
    .slice(headerRowIndex + 1)
    .map((row) => {
      const record: Record<string, any> = {};
      for (const jsonKey in headerIndices) {
        const index = headerIndices[jsonKey];
        let value = row[index];

        if (jsonKey === "fechaVencimiento" || jsonKey === "fechaEntrada") {
          value = normalizeDateCell(value);
        } else if (numericColumns.includes(jsonKey)) {
          if (typeof value === "string") {
            value = parseFloat(value.replace(/\./g, "").replace(",", ".")) || 0;
          } else if (typeof value !== "number") {
            value = 0;
          }
        } else if (codeFields.includes(jsonKey.toLowerCase())) {
          value = preserveCodeValue(value);
        } else if (value !== undefined && value !== null) {
          value = String(value).trim();
        } else {
          value = "";
        }
        record[jsonKey] = value;
      }
      return record;
    })
    .filter((record) => {
      return Object.values(record).some(
        (val) => val !== "" && val !== 0 && val !== null && val !== undefined,
      );
    });

  return data;
}

export function parseData(
  content: string | ArrayBuffer,
  columnMapping: Record<string, string[]>,
  numericColumns: string[],
): Record<string, any>[] {
  if (content instanceof ArrayBuffer) {
    return parseExcelData(Buffer.from(content), columnMapping, numericColumns);
  } else if (typeof content === "string") {
    return parseTextData(content, columnMapping, numericColumns);
  }
  throw new Error("Tipo de contenido de archivo no compatible.");
}

export function parseRawData(content: string | ArrayBuffer): {
  headers: string[];
  rows: any[];
} {
  let jsonData: any[][] = [];
  if (content instanceof ArrayBuffer) {
    const workbook = XLSX.read(Buffer.from(content), { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      blankrows: false,
    }) as any[][];
  } else {
    const lines = content.trim().replace(/\r/g, "").split("\n");
    const delimiter = lines[0].includes("\t") ? "\t" : ",";
    jsonData = lines.map((line) => line.split(delimiter));
  }

  if (jsonData.length === 0) return { headers: [], rows: [] };

  const headers = jsonData[0].map((h) => String(h || "").trim());
  const rows = jsonData.slice(1).map((row) => {
    const record: Record<string, any> = {};
    headers.forEach((header, index) => {
      let value = row[index] !== undefined ? row[index] : "";
      if (typeof value === "number") {
        value = String(value);
      }
      record[header] = value;
    });
    return record;
  });

  return { headers, rows };
}