import { z } from "genkit";

export const SalesDataSchema = z.array(
  z.object({
    material: z.string(),
    descripcion: z.string(),
    cantidadConfirmada: z.number(),
  }),
);

export const InventoryDataSchema = z.array(
  z.object({
    sku: z.string(),
    lpn: z.string(),
    descripcion: z.string(),
    localizacion: z.string(),
    disponible: z.number(),
    estado: z
      .string()
      .describe(
        'Estado del stock: solo se considera utilizable el marcado como "Disponible en facturación según el cliente".',
      ),
    fechaVencimiento: z.string().optional().nullable(),
    diasFPC: z.number().optional().nullable(),
    lote: z.string().optional().nullable(),
  }),
);

export const MinMaxDataSchema = z.array(
  z.object({
    sku: z.string(),
    lpn: z.string(),
    localizacion: z.string(),
    cantidadMinima: z.number(),
    cantidadMaxima: z.number(),
  }),
);

export const UbicacionSugeridaSchema = z.object({
  lpn: z
    .string()
    .optional()
    .describe("The License Plate Number (LPN) for the stock at this location."),
  localizacion: z.string().describe("El código de la ubicación."),
  diasFPC: z
    .number()
    .optional()
    .nullable()
    .describe("Días para la expiración del stock en esta ubicación."),
  fechaVencimiento: z
    .string()
    .optional()
    .nullable()
    .describe("Fecha de expiración del stock en esta ubicación."),
  cantidad: z.number().describe("La cantidad del artículo en esta ubicación."),
});

export const RestockSuggestionSchema = z.object({
  sku: z.string().describe("El SKU del producto."),
  descripcion: z.string().describe("La descripción del producto."),
  cantidadVendida: z
    .number()
    .describe(
      "La cantidad total vendida recientemente. Esto proporciona contexto para la cantidad de reabastecimiento.",
    ),
  cantidadDisponible: z
    .number()
    .describe(
      "La cantidad total actualmente disponible en las ubicaciones de picking. Esto será bajo o cero.",
    ),
  cantidadARestockear: z
    .number()
    .describe(
      "La cantidad sugerida para mover de las ubicaciones de reserva a las de picking.",
    ),
  ubicacionesSugeridas: z
    .array(UbicacionSugeridaSchema)
    .describe(
      'Para los artículos a reabastecer, estas son las ubicaciones de reserva de las que se debe extraer, ordenadas por FEFO. Para los artículos "OK", estas son las ubicaciones de picking donde el stock está actualmente disponible.',
    ),
  lpnDestino: z
    .string()
    .optional()
    .nullable()
    .describe("El LPN de destino para el reabastecimiento, proveniente del archivo de mínimos/máximos."),
  localizacionDestino: z
    .string()
    .optional()
    .nullable()
    .describe(
      "La ubicación de destino para el reabastecimiento, proveniente del archivo de mínimos/máximos.",
    ),
});

export const GenerateRestockSuggestionsOutputSchema = z.array(
  RestockSuggestionSchema,
);
export type GenerateRestockSuggestionsOutput = z.infer<
  typeof GenerateRestockSuggestionsOutputSchema
>;

export const MissingProductSchema = z.object({
  sku: z.string().describe("El SKU del producto."),
  descripcion: z.string().describe("La descripción del producto."),
  cantidadVendida: z.number().describe("La cantidad vendida."),
});
export type MissingProductsOutput = z.infer<typeof MissingProductSchema>;

export const AnalysisResultSchema = z.object({
  suggestions: GenerateRestockSuggestionsOutputSchema.describe(
    "Sugerencias para el reabastecimiento de stock.",
  ),
  missingProducts: z
    .array(MissingProductSchema)
    .describe("Productos que se vendieron pero no tienen inventario en absoluto."),
});

export const InventoryCrossItemSchema = z.object({
  sku: z.string(),
  descripcion: z.string().optional(),
  lote: z.string(),
  cantidadSap: z.number(),
  cantidadWms: z.number(),
  diferencia: z.number(),
});

export const InventoryCrossResultSchema = z.object({
  results: z.array(InventoryCrossItemSchema),
});


export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
export type InventoryCrossResult = z.infer<typeof InventoryCrossResultSchema>;
