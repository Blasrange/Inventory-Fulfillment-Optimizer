import * as XLSX from "xlsx";

function parseTextData(
  fileContent: string,
  columnMapping: Record<string, string[]>,
  numericColumns: string[],
): Record<string, any>[] {
  const lines = fileContent.trim().replace(/\r/g, "").split("\n");
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const delimiter = headerLine.includes("\t") ? "\t" : ",";
  const headers = headerLine
    .split(delimiter)
    .map((h) => h.trim().toLowerCase());

  const headerIndices: Record<string, number> = {};
  const internalKeys = Object.keys(columnMapping);
  const optionalInternalKeys = ["fechavencimiento", "diasfpc"];

  internalKeys.forEach((internalKey) => {
    const possibleHeaders = columnMapping[internalKey].map((h) =>
      h.toLowerCase(),
    );
    let foundIndex = -1;

    for (const pHeader of possibleHeaders) {
      const index = headers.indexOf(pHeader);
      if (index !== -1) {
        foundIndex = index;
        break;
      }
    }

    if (foundIndex !== -1) {
      headerIndices[internalKey] = foundIndex;
    } else if (!optionalInternalKeys.includes(internalKey.toLowerCase())) {
      throw new Error(
        `Columna requerida no encontrada. Para "${internalKey}", se esperaba una de: "${columnMapping[internalKey].join('", "')}"`,
      );
    }
  });

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
            // Handles formats like "1.234,56" -> 1234.56 and "1234.56" -> 1234.56
            value = parseFloat(value.replace(/\./g, "").replace(",", ".")) || 0;
          }
          record[jsonKey] = value;
        }
      }
      return record;
    })
    .filter((record) => {
      // Filter out rows that are essentially empty
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
  const workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    blankrows: false,
  }) as any[][];

  if (jsonData.length < 1) return [];

  const headerRow = jsonData[0];
  const headers = headerRow.map((h) =>
    String(h || "")
      .trim()
      .toLowerCase(),
  );

  const headerIndices: Record<string, number> = {};
  const internalKeys = Object.keys(columnMapping);
  const optionalInternalKeys = ["fechavencimiento", "diasfpc"];

  internalKeys.forEach((internalKey) => {
    const possibleHeaders = columnMapping[internalKey].map((h) =>
      h.toLowerCase(),
    );
    let foundIndex = -1;

    for (const pHeader of possibleHeaders) {
      const index = headers.indexOf(pHeader);
      if (index !== -1) {
        foundIndex = index;
        break;
      }
    }

    if (foundIndex !== -1) {
      headerIndices[internalKey] = foundIndex;
    } else if (!optionalInternalKeys.includes(internalKey.toLowerCase())) {
      throw new Error(
        `Columna requerida no encontrada en Excel. Para "${internalKey}", se esperaba una de: "${columnMapping[internalKey].join('", "')}"`,
      );
    }
  });

  const data = jsonData
    .slice(1)
    .map((row) => {
      const record: Record<string, any> = {};
      for (const jsonKey in headerIndices) {
        const index = headerIndices[jsonKey];
        let value = row[index];

        if (jsonKey === "fechaVencimiento" && value instanceof Date) {
          try {
            value = value.toISOString().split("T")[0];
          } catch (e) {
            value = String(row[index] || "");
          }
        } else if (numericColumns.includes(jsonKey)) {
          if (typeof value === "string") {
            value = parseFloat(value.replace(/\./g, "").replace(",", ".")) || 0;
          } else if (typeof value !== "number") {
            value = 0;
          }
        } else if (value !== undefined && value !== null) {
          value = String(value);
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
