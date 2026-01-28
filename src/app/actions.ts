"use server";

import {
  generateSalesAnalysis,
  type AnalysisResult,
} from "@/ai/flows/sales-analysis";
import { generateLevelsAnalysis } from "@/ai/flows/levels-analysis";
import * as XLSX from "xlsx";
import type {
  GenerateRestockSuggestionsOutput,
  MissingProductsOutput,
} from "@/ai/flows/schemas";

export async function runAnalysis(
  analysisMode: "sales" | "levels",
  inventoryData: any[] | null,
  salesData: any[] | null,
  minMaxData: any[] | null,
): Promise<{ data?: AnalysisResult; error?: string }> {
  try {
    let analysisResult: AnalysisResult;

    if (!inventoryData) {
      return { error: "Faltan los datos del inventario." };
    }

    if (analysisMode === "sales") {
      if (!salesData) {
        return { error: "Faltan los datos de facturación." };
      }
      analysisResult = await generateSalesAnalysis({
        inventoryData: inventoryData,
        salesData: salesData,
      });
    } else {
      // analysisMode === 'levels'
      if (!minMaxData) {
        return { error: "Faltan los datos de Mín/Máx." };
      }
      analysisResult = await generateLevelsAnalysis({
        inventoryData: inventoryData,
        minMaxData: minMaxData,
      });
    }

    if (!analysisResult) {
      return {
        error:
          "No se pudieron generar sugerencias. El análisis no devolvió una respuesta válida.",
      };
    }

    return { data: analysisResult };
  } catch (e) {
    console.error("Error running analysis:", e);
    const errorMessage =
      e instanceof Error ? e.message : "Ocurrió un error inesperado.";
    return {
      error: `Ocurrió un error al procesar los archivos. ${errorMessage}`,
    };
  }
}

export async function generateWmsFiles(
  suggestions: GenerateRestockSuggestionsOutput,
  analysisMode: "sales" | "levels",
): Promise<{ data?: { file: string; filename: string }; error?: string }> {
  try {
    const tasks = suggestions.filter((s) => s.cantidadARestockear > 0);

    if (tasks.length === 0) {
      return { error: "No hay sugerencias de surtido para exportar." };
    }

    if (analysisMode === "sales") {
      const file1Data: { LRLD_LPN_CODE: string; LRLD_LOCATION: string }[] = [];
      tasks.forEach((task) => {
        task.ubicacionesSugeridas.forEach((ubicacion) => {
          file1Data.push({
            LRLD_LPN_CODE: ubicacion.lpn || "",
            LRLD_LOCATION: ubicacion.localizacion,
          });
        });
      });

      if (file1Data.length === 0) {
        return {
          error: "No se encontraron datos para generar el archivo LRLD.",
        };
      }

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(file1Data);
      XLSX.utils.book_append_sheet(wb, ws, "LRLD");
      const fileBase64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });

      return { data: { file: fileBase64, filename: "LRLD.xlsx" } };
    }

    // This 'else' covers 'levels' analysis
    const file2Data: {
      LTLD_LPN_SRC: string;
      LTLD_SKU: string;
      LTLD_LOT: string;
      LTLD_QTY: number;
      LTLD_LPN_DST: string;
      LTLD_LOCATION_DST: string;
    }[] = [];

    tasks.forEach((task) => {
      task.ubicacionesSugeridas.forEach((ubicacion) => {
        file2Data.push({
          LTLD_LPN_SRC: ubicacion.lpn || "",
          LTLD_SKU: task.sku,
          LTLD_LOT: "", // LOT is not available in the source data
          LTLD_QTY: ubicacion.cantidad,
          LTLD_LPN_DST: task.lpnDestino || "",
          LTLD_LOCATION_DST: task.localizacionDestino || "",
        });
      });
    });

    if (file2Data.length === 0) {
      return { error: "No se encontraron datos para generar el archivo LTLD." };
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(file2Data);
    XLSX.utils.book_append_sheet(wb, ws, "LTLD");
    const fileBase64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });

    return { data: { file: fileBase64, filename: "LTLD.xlsx" } };
  } catch (e) {
    console.error("Error generating WMS files:", e);
    const errorMessage =
      e instanceof Error ? e.message : "Ocurrió un error inesperado.";
    return { error: `Error al generar los archivos: ${errorMessage}` };
  }
}

export async function generateFullReportFile(
  suggestions: GenerateRestockSuggestionsOutput | null,
  missingProducts: MissingProductsOutput[] | null,
  analysisMode: "sales" | "levels",
): Promise<{ data?: { file: string; filename: string }; error?: string }> {
  try {
    const wb = XLSX.utils.book_new();

    if (suggestions && suggestions.length > 0) {
      const sortedSuggestions = [...suggestions].sort(
        (a, b) => b.cantidadARestockear - a.cantidadARestockear,
      );

      const sheetData: any[] = [];
      sortedSuggestions.forEach((s) => {
        if (s.ubicacionesSugeridas && s.ubicacionesSugeridas.length > 0) {
          s.ubicacionesSugeridas.forEach((u, index) => {
            const cantASurtir = s.cantidadARestockear > 0 ? u.cantidad : 0;
            const tipoAbastecimiento =
              cantASurtir > 0
                ? cantASurtir > 10
                  ? "Reabastecimiento Pallets Completos"
                  : "Reabastecimiento de Unidades"
                : "OK";

            const row: { [key: string]: any } = {
              SKU: s.sku,
              Descripción: s.descripcion,
            };

            if (analysisMode === "levels") {
              row["Destino"] = s.localizacionDestino || "";
              row["LPN Destino"] = s.lpnDestino || "";
            }

            if (analysisMode === "sales") {
              if (index === 0) {
                row["Cant. Vendida"] = s.cantidadVendida;
                row["Cant. en Picking"] = s.cantidadDisponible;
              } else {
                row["Cant. Vendida"] = 0;
                row["Cant. en Picking"] = 0;
              }
            } else {
              row["Cant. en Picking"] = s.cantidadDisponible;
            }

            row["Cant. a Surtir"] = cantASurtir;
            row["Acción / Ubicaciones Origen"] =
              `${u.localizacion}${u.lpn ? ` (LPN: ${u.lpn})` : ""} (Cant: ${u.cantidad})`;
            row["Tipo de Abastecimiento"] = tipoAbastecimiento;

            sheetData.push(row);
          });
        } else {
          const cantASurtir = s.cantidadARestockear;
          const tipoAbastecimiento =
            cantASurtir > 0
              ? cantASurtir > 10
                ? "Reabastecimiento Pallets Completos"
                : "Reabastecimiento de Unidades"
              : "OK";

          const row: { [key: string]: any } = {
            SKU: s.sku,
            Descripción: s.descripcion,
          };

          if (analysisMode === "levels") {
            row["Destino"] = s.localizacionDestino || "";
            row["LPN Destino"] = s.lpnDestino || "";
          }

          if (analysisMode === "sales") {
            row["Cant. Vendida"] = s.cantidadVendida;
          }
          row["Cant. en Picking"] = s.cantidadDisponible;
          row["Cant. a Surtir"] = cantASurtir;
          row["Acción / Ubicaciones Origen"] =
            s.cantidadARestockear > 0 ? "Sin Origen" : "OK";
          row["Tipo de Abastecimiento"] = tipoAbastecimiento;
          sheetData.push(row);
        }
      });

      const ws = XLSX.utils.json_to_sheet(sheetData);

      if (sheetData.length > 0) {
        const colIndex = Object.keys(sheetData[0]).indexOf(
          "Tipo de Abastecimiento",
        );

        if (colIndex !== -1) {
          sheetData.forEach((_dataRow, rowIndex) => {
            const cellAddress = XLSX.utils.encode_cell({
              r: rowIndex + 1,
              c: colIndex,
            });
            const cell = ws[cellAddress];

            if (cell && typeof cell.v === "string") {
              if (cell.v === "Reabastecimiento Pallets Completos") {
                cell.s = { fill: { fgColor: { rgb: "C6EFCE" } } };
              } else if (cell.v === "Reabastecimiento de Unidades") {
                cell.s = { fill: { fgColor: { rgb: "FFEB9C" } } };
              }
            }
          });
        }
      }
      XLSX.utils.book_append_sheet(wb, ws, "Sugerencias de Surtido");
    }

    if (missingProducts && missingProducts.length > 0) {
      const ws = XLSX.utils.json_to_sheet(missingProducts);
      XLSX.utils.book_append_sheet(wb, ws, "Productos Faltantes");
    }

    if (wb.SheetNames.length === 0) {
      return { error: "No hay datos para exportar." };
    }

    const fileBase64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
    return {
      data: { file: fileBase64, filename: "Reporte_Analisis_Surtido.xlsx" },
    };
  } catch (e) {
    console.error("Error generating report file:", e);
    const errorMessage =
      e instanceof Error ? e.message : "Ocurrió un error inesperado.";
    return { error: `Error al generar el archivo de reporte: ${errorMessage}` };
  }
}
