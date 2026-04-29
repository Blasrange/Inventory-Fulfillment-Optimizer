// ──────────────────────────────────────────────────────────────
// Surtido Inteligente: Schemas de ventas y stock
// ──────────────────────────────────────────────────────────────
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

const COERCE_NUMBER = z.preprocess((val) => {
  if (val === null || val === undefined || val === "") return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}, z.number());

const COERCE_NUMBER_OPTIONAL = z.preprocess((val) => {
  if (val === null || val === undefined || val === "") return undefined;
  const num = Number(val);
  return isNaN(num) ? undefined : num;
}, z.number().optional());

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
    fechaEntrada: z.string().optional().nullable(),
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

export const ShelfLifeMasterSchema = z.array(
  z.object({
    sku: z.string(),
    diasMinimos: z
      .number()
      .describe("Días máximos permitidos de vida útil según la maestra."),
  }),
);

export const UbicacionSugeridaSchema = z.object({
  lpn: z
    .string()
    .optional()
    .describe("The License Plate Number (LPN) for the stock at this location."),
  localizacion: z.string().describe("El código de la ubicación."),
  lote: z.string().optional().describe("Lote del producto en esta ubicación."),
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

export const LotCrossItemSchema = z.object({
  sku: z.string(),
  descripcion: z.string().optional(),
  lotesSap: z.array(z.string()),
  lotesWms: z.array(z.string()),
  lotesSoloSap: z.array(z.string()),
  lotesSoloWms: z.array(z.string()),
  cantidadSap: z.number(),
  cantidadWms: z.number(),
  estado: z.enum(["OK", "DIFERENTE"]),
});

export const LotCrossResultSchema = z.object({
  results: z.array(LotCrossItemSchema),
});

export const ShelfLifeResultItemSchema = z.object({
  sku: z.string(),
  descripcion: z.string(),
  lpn: z.string(),
  localizacion: z.string(),
  lote: z.string().optional().nullable(),
  fechaVencimiento: z.string().optional().nullable(),
  diasFPC: z.number(),
  diasMinimosMaestra: z.number(),
  cumple: z.boolean(),
  estado: z.string(),
});

export const ShelfLifeResultSchema = z.object({
  results: z.array(ShelfLifeResultItemSchema),
});

export const InventoryAgeResultItemSchema = z.object({
  sku: z.string(),
  descripcion: z.string(),
  lpn: z.string(),
  localizacion: z.string(),
  lote: z.string().optional().nullable(),
  disponible: z.number(),
  estado: z.string(),
  fechaEntrada: z.string().optional().nullable(),
  diasEnInventario: z.number().nullable(),
  rangoEdad: z.enum([
    "0-3 meses",
    "3-6 meses",
    "6-12 meses",
    "> 12 meses",
    "Sin fecha de entrada",
  ]),
});

export const InventoryAgeResultSchema = z.object({
  results: z.array(InventoryAgeResultItemSchema),
});

export type InventoryAgeResult = z.infer<typeof InventoryAgeResultSchema>;

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

// ──────────────────────────────────────────────────────────────────────────
// ESQUEMAS PARA ETIQUETAS ÉXITO
// ──────────────────────────────────────────────────────────────────────────
export const ExitoLabelItemSchema = z.object({
  nc: z.string(),
  ct: z.string(),
  codigoBarra: z.string(),
  tienda: z.string(),
  depto: z.string(),
  ciudad: z.string(),
  orden: z.string(),
  direccion: z.string(),
  numeroCaja: z.number(),
  totalCajas: z.number(),
  cedi: z.string(),
  desc: z.string(),
});

export const ExitoLabelsResultSchema = z.object({
  labels: z.array(ExitoLabelItemSchema),
  warnings: z.array(z.string()),
});

export const ParseExitoExcelResultSchema = z.object({
  ordenCompra: z.string(),
  cedi: z.string(),
  labels: z.array(ExitoLabelItemSchema),
  warnings: z.array(z.string()),
});

export const SurtidoInteligenteSalesSchema = z.array(
  z.object({
    oboId: COERCE_STRING,
    oboOrder: COERCE_STRING,
    oboOrder2: COERCE_STRING.optional(),
    oboInvoice: COERCE_STRING.optional(),
    oboPurchaseOrder: COERCE_STRING.optional(),
    oboTrackingNumber: COERCE_STRING.optional(),
    carrier: COERCE_STRING.optional(),
    oboOrderDatetime: COERCE_STRING.optional(),
    obtDescription: COERCE_STRING.optional(),
    cstCode: COERCE_STRING.optional(),
    cstName: COERCE_STRING.optional(),
    soldCode: COERCE_STRING.optional(),
    soldName: COERCE_STRING.optional(),
    strCode: COERCE_STRING.optional(),
    strName: COERCE_STRING.optional(),
    oboOrderDate: COERCE_STRING.optional(),
    oboState: COERCE_STRING.optional(),
    oboNote: COERCE_STRING.optional(),
    oosDescription: COERCE_STRING.optional(),
    sku: COERCE_STRING,
    descripcion: COERCE_STRING,
    ean13: COERCE_STRING.optional(),
    qtyHandling: z.number(),
    uomHandling: COERCE_STRING.optional(),
    qtyOrder: z.number(),
    uomOrder: COERCE_STRING.optional(),
    qtyBooked: z.number().optional(),
    qtyPicked: z.number().optional(),
    qtyDelivery: z.number().optional(),
    channel: COERCE_STRING.optional(),
    division: COERCE_STRING.optional(),
    qtyContainers: z.number().optional(),
    oboRemittance: COERCE_STRING.optional(),
    oboRemittanceDate: COERCE_STRING.optional(),
    dia: COERCE_STRING.optional(),
    mes: COERCE_STRING.optional(),
    anio: COERCE_STRING.optional(),
    clienteEsp: COERCE_STRING.optional(),
  })
);

export const SurtidoInteligenteStockSchema = z.array(
  z.object({
    Codigo: COERCE_STRING,
    LPN: COERCE_STRING,
    Localizacion: COERCE_STRING,
    "Area Picking": COERCE_STRING.optional(),
    SKU: COERCE_STRING,
    SKU2: COERCE_STRING.optional(),
    Descripcion: COERCE_STRING,
    Precio: COERCE_NUMBER.optional(),
    "Tipo de Material": COERCE_STRING.optional(),
    "Categoría de Material": COERCE_STRING.optional(),
    Unidades: COERCE_NUMBER,
    Cajas: COERCE_NUMBER.optional(),
    Reserva: COERCE_NUMBER.optional(),
    Disponible: COERCE_NUMBER,
    UDM: COERCE_STRING.optional(),
    Embalaje: COERCE_STRING.optional(),
    "Fecha de entrada": COERCE_STRING.optional(),
    Estado: COERCE_STRING,
    Lote: COERCE_STRING.optional(),
    "Fecha de fabricacion": COERCE_STRING.optional(),
    "Fecha de vencimiento": COERCE_STRING.optional(),
    FPC: COERCE_NUMBER_OPTIONAL,
    Peso: COERCE_NUMBER.optional(),
    Serial: COERCE_STRING.optional(),
  })
);

// ─────────────────────────────────────────────
// Maestra de Materiales para Surtido Inteligente
// ─────────────────────────────────────────────
export const MaterialMaestraSchema = z.array(
  z.object({
    lpn: COERCE_STRING,
    localizacion: COERCE_STRING,
    sku: COERCE_STRING,
    descripcion: COERCE_STRING,
    tipoMaterial: COERCE_STRING,
  })
);

// ─────────────────────────────────────────────
// Schemas para Exportación de Inventario (Pasillo P10)
// ─────────────────────────────────────────────
export const MaestraExportacionSchema = z.array(
  z.object({
    Cod: COERCE_STRING,
    REFERENCIA: COERCE_STRING,
  })
);

export const InventarioExportacionSchema = z.array(
  z.object({
    Codigo: COERCE_STRING,
    LPN: COERCE_STRING.optional(),
    Localizacion: COERCE_STRING,
  })
);

export interface ResultadoExportacion {
  codigo: string;
  referencia: string;
  localizacionActual: string | null;
  estado: string;
  localizacionSugerida: string | null;
  sugerencia?: string;
  lpn?: string | null;
}

export type MaterialMaestra = z.infer<typeof MaterialMaestraSchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
export type InventoryCrossResult = z.infer<typeof InventoryCrossResultSchema>;
export type LotCrossResult = z.infer<typeof LotCrossResultSchema>;
export type InboundResult = z.infer<typeof InboundResultSchema>;
export type ShelfLifeResult = z.infer<typeof ShelfLifeResultSchema>;
export type ExitoLabelsResult = z.infer<typeof ExitoLabelsResultSchema>;
export type ExitoLabelData = z.infer<typeof ExitoLabelItemSchema>;
export type ParseExitoExcelResult = z.infer<typeof ParseExitoExcelResultSchema>;
export type SurtidoInteligenteSalesData = z.infer<typeof SurtidoInteligenteSalesSchema>;
export type SurtidoInteligenteStockData = z.infer<typeof SurtidoInteligenteStockSchema>;
export type MaestraExportacion = z.infer<typeof MaestraExportacionSchema>;
export type InventarioExportacion = z.infer<typeof InventarioExportacionSchema>;
