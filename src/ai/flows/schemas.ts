import { z } from "genkit";

/**
 * Helper para asegurar que campos que deben ser texto se conviertan a string
 * de forma segura, incluso si vienen como números desde Excel (ej. 46600).
 */
const COERCE_STRING = z.preprocess((val) => {
  if (val === null || val === undefined) return "";
  return String(val);
}, z.string());

const COERCE_STRING_OPTIONAL = z.preprocess((val) => {
  if (val === null || val === undefined) return "";
  return String(val);
}, z.string().optional());

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
  esEstibaCompleta: z
    .boolean()
    .optional()
    .describe("Indica si se toma toda la estiba completa de esta ubicación."),
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
  cantidadTotalCubierta: z
    .number()
    .optional()
    .describe(
      "La cantidad total que se pudo cubrir con inventario de reserva.",
    ),
  cantidadFaltante: z
    .number()
    .optional()
    .describe(
      "La cantidad total que no se pudo cubrir por falta de inventario.",
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
    .describe(
      "El LPN de destino para el reabastecimiento, proveniente del archivo de mínimos/máximos.",
    ),
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
  cantidadFaltante: z
    .number()
    .optional()
    .describe("La cantidad que falta para completar el pedido."),
  stockEnPicking: z
    .number()
    .optional()
    .describe("La cantidad disponible en ubicaciones de picking."),
  stockEnReserva: z
    .number()
    .optional()
    .describe("La cantidad disponible en ubicaciones de reserva."),
  cantidadCubierta: z
    .number()
    .optional()
    .describe("La cantidad que se pudo cubrir con stock de reserva."),
  tipoFalta: z
    .enum(["SIN_INVENTARIO", "SIN_RESERVA", "RESERVA_INSUFICIENTE"])
    .optional()
    .describe("El tipo de falta de inventario."),
});
export type MissingProductsOutput = z.infer<typeof MissingProductSchema>;

export const AnalysisResultSchema = z.object({
  suggestions: GenerateRestockSuggestionsOutputSchema.describe(
    "Sugerencias para el reabastecimiento de stock.",
  ),
  missingProducts: z
    .array(MissingProductSchema)
    .describe(
      "Productos que se vendieron pero no tienen inventario suficiente.",
    ),
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

// NUEVOS ESQUEMAS PARA ENTRADAS (INBOUND) CON COERCIÓN REFORZADA
export const InboundItemSchema = z.object({
  N_ORDER: COERCE_STRING,
  ORDER2: COERCE_STRING_OPTIONAL,
  PURCHASE_ORDER: COERCE_STRING_OPTIONAL,
  INVOICE: COERCE_STRING_OPTIONAL,
  PROVIDER_UID: COERCE_STRING,
  ORDER_DATE: COERCE_STRING,
  SERVICE_DATE: COERCE_STRING_OPTIONAL,
  INBOUNDTYPE_CODE: COERCE_STRING,
  NOTE: COERCE_STRING_OPTIONAL,
  SKU: COERCE_STRING,
  LOTE: COERCE_STRING_OPTIONAL,
  FECHA_DE_VENCIMIENTO: COERCE_STRING_OPTIONAL,
  FECHA_DE_FABRICACION: COERCE_STRING_OPTIONAL,
  SERIAL: COERCE_STRING_OPTIONAL,
  ESTADO_CALIDAD: COERCE_STRING,
  QTY: z.number(),
  UOM_CODE: COERCE_STRING,
  REFERENCE: COERCE_STRING_OPTIONAL,
  PRICE: z.number().optional(),
  TAXES: z.number().optional(),
  IBL_LPN_CODE: COERCE_STRING_OPTIONAL,
  IBL_WEIGHT: z.number().optional(),
});

export const InboundResultSchema = z.object({
  results: z.array(InboundItemSchema),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
export type InventoryCrossResult = z.infer<typeof InventoryCrossResultSchema>;
export type InboundResult = z.infer<typeof InboundResultSchema>;
