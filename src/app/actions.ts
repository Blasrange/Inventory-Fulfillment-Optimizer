'use server';

import { generateSalesAnalysis, type AnalysisResult } from '@/ai/flows/sales-analysis';
import { generateLevelsAnalysis } from '@/ai/flows/levels-analysis';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import type { GenerateRestockSuggestionsOutput, MissingProductsOutput } from '@/ai/flows/schemas';


const SalesDataSchema = z.array(z.object({
  material: z.any().transform(String),
  descripcion: z.string(),
  cantidadConfirmada: z.number(),
}));

const InventoryDataSchema = z.array(z.object({
  sku: z.any().transform(String),
  lpn: z.any().transform(String),
  descripcion: z.string(),
  localizacion: z.string(),
  disponible: z.number(),
  estado: z.string(),
  fechaVencimiento: z.string().optional().nullable(),
  diasFPC: z.number().optional().nullable(),
}));

const MinMaxDataSchema = z.array(z.object({
    sku: z.any().transform(String),
    lpn: z.any().transform(String),
    localizacion: z.string(),
    cantidadMinima: z.number(),
    cantidadMaxima: z.number(),
}));


export async function runAnalysis(
    analysisMode: 'sales' | 'levels',
    inventoryData: unknown,
    salesData: unknown | null,
    minMaxData: unknown | null
): Promise<{ data?: AnalysisResult; error?: string }> {
    try {
        const parsedInventory = InventoryDataSchema.parse(inventoryData);
        
        let analysisResult: AnalysisResult;

        if (analysisMode === 'sales') {
            if (!salesData) {
                return { error: 'Para el análisis por ventas, se requiere el archivo de facturación.' };
            }
            const parsedSales = SalesDataSchema.parse(salesData);
            analysisResult = await generateSalesAnalysis({
                inventoryData: parsedInventory,
                salesData: parsedSales
            });
        } else { // analysisMode === 'levels'
            if (!minMaxData) {
                return { error: 'Para el análisis por niveles, se requiere el archivo de Mín/Máx.' };
            }
            const parsedMinMax = MinMaxDataSchema.parse(minMaxData);
            analysisResult = await generateLevelsAnalysis({
                inventoryData: parsedInventory,
                minMaxData: parsedMinMax
            });
        }


        if (!analysisResult) {
            return { error: 'No se pudieron generar sugerencias. El análisis no devolvió una respuesta válida.' };
        }

        return { data: analysisResult };
    } catch (e) {
        if (e instanceof z.ZodError) {
            console.error('Zod validation error:', e.errors);
            return { error: `Error de validación de datos: ${e.errors.map(err => `${err.path.join('.')} - ${err.message}`).join(', ')}` };
        }
        console.error('Error running analysis:', e);
        const errorMessage = e instanceof Error ? e.message : 'Ocurrió un error inesperado.';
        return { error: `Ocurrió un error al procesar los datos. ${errorMessage}` };
    }
}

export async function generateWmsFiles(
    suggestions: GenerateRestockSuggestionsOutput,
    analysisMode: 'sales' | 'levels'
): Promise<{ data?: { file: string; filename: string }; error?: string }> {
    try {
        const tasks = suggestions.filter(s => s.cantidadARestockear > 0);

        if (tasks.length === 0) {
            return { error: 'No hay sugerencias de surtido para exportar.' };
        }

        if (analysisMode === 'sales') {
            const file1Data: { LRLD_LPN_CODE: string, LRLD_LOCATION: string }[] = [];
            tasks.forEach(task => {
                task.ubicacionesSugeridas.forEach(ubicacion => {
                    file1Data.push({
                        'LRLD_LPN_CODE': ubicacion.lpn || '',
                        'LRLD_LOCATION': ubicacion.localizacion,
                    });
                });
            });

            if (file1Data.length === 0) {
                return { error: 'No se encontraron datos para generar el archivo LRLD.' };
            }

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(file1Data);
            XLSX.utils.book_append_sheet(wb, ws, 'LRLD');
            const fileBase64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
            
            return { data: { file: fileBase64, filename: 'LRLD.xlsx' } };
        }
        
        // This 'else' covers 'levels' analysis
        const file2Data: { 
            LTLD_LPN_SRC: string, 
            LTLD_SKU: string, 
            LTLD_LOT: string, 
            LTLD_QTY: number, 
            LTLD_LPN_DST: string, 
            LTLD_LOCATION_DST: string 
        }[] = [];

        tasks.forEach(task => {
            task.ubicacionesSugeridas.forEach(ubicacion => {
                file2Data.push({
                    'LTLD_LPN_SRC': ubicacion.lpn || '',
                    'LTLD_SKU': task.sku,
                    'LTLD_LOT': '', // LOT is not available in the source data
                    'LTLD_QTY': ubicacion.cantidad,
                    'LTLD_LPN_DST': task.lpnDestino || '',
                    'LTLD_LOCATION_DST': task.localizacionDestino || '',
                });
            });
        });

        if (file2Data.length === 0) {
            return { error: 'No se encontraron datos para generar el archivo LTLD.' };
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(file2Data);
        XLSX.utils.book_append_sheet(wb, ws, 'LTLD');
        const fileBase64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

        return { data: { file: fileBase64, filename: 'LTLD.xlsx' } };

    } catch (e) {
        console.error('Error generating WMS files:', e);
        const errorMessage = e instanceof Error ? e.message : 'Ocurrió un error inesperado.';
        return { error: `Error al generar los archivos: ${errorMessage}` };
    }
}

export async function generateFullReportFile(
    suggestions: GenerateRestockSuggestionsOutput | null,
    missingProducts: MissingProductsOutput | null,
    analysisMode: 'sales' | 'levels'
): Promise<{ data?: { file: string; filename: string }; error?: string }> {
    try {
        const wb = XLSX.utils.book_new();

        if (suggestions && suggestions.length > 0) {
            const sheetData: any[] = [];
            suggestions.forEach(s => {
                const commonData: { [key: string]: any } = {
                    'SKU': s.sku,
                    'Descripción': s.descripcion,
                };
                if (analysisMode === 'levels') {
                    commonData['Destino'] = s.localizacionDestino || '';
                    commonData['LPN Destino'] = s.lpnDestino || '';
                }
                commonData['Cant. en Picking'] = s.cantidadDisponible;

                if (s.ubicacionesSugeridas && s.ubicacionesSugeridas.length > 0) {
                    s.ubicacionesSugeridas.forEach(u => {
                        const cantASurtir = s.cantidadARestockear > 0 ? u.cantidad : 0;
                        sheetData.push({
                            ...commonData,
                            'Cant. a Surtir': cantASurtir,
                            'Acción / Ubicaciones Origen': `${u.localizacion}${u.lpn ? ` (LPN: ${u.lpn})` : ''} (Cant: ${u.cantidad})`
                        });
                    });
                } else {
                     sheetData.push({
                        ...commonData,
                        'Cant. a Surtir': s.cantidadARestockear,
                        'Acción / Ubicaciones Origen': s.cantidadARestockear > 0 ? 'Sin Origen' : 'OK'
                    });
                }
            });
            
            const ws = XLSX.utils.json_to_sheet(sheetData);
            XLSX.utils.book_append_sheet(wb, ws, 'Sugerencias de Surtido');
        }

        if (missingProducts && missingProducts.length > 0) {
            const ws = XLSX.utils.json_to_sheet(missingProducts);
            XLSX.utils.book_append_sheet(wb, ws, 'Productos Faltantes');
        }
        
        if (wb.SheetNames.length === 0) {
            return { error: 'No hay datos para exportar.' };
        }

        const fileBase64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
        return { data: { file: fileBase64, filename: 'Reporte_Analisis_Surtido.xlsx' } };
    } catch (e) {
        console.error('Error generating report file:', e);
        const errorMessage = e instanceof Error ? e.message : 'Ocurrió un error inesperado.';
        return { error: `Error al generar el archivo de reporte: ${errorMessage}` };
    }
}
