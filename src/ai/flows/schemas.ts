import {z} from 'genkit';

export const SalesDataSchema = z.array(z.object({
  material: z.string(),
  descripcion: z.string(),
  cantidadConfirmada: z.number(),
}));

export const InventoryDataSchema = z.array(z.object({
  sku: z.string(),
  lpn: z.string(),
  descripcion: z.string(),
  localizacion: z.string(),
  disponible: z.number(),
  estado: z.string().describe('El estado del stock. Solo "STOCK EN ALMACEN LIBRE" es utilizable.'),
  fechaVencimiento: z.string().optional().nullable(),
  diasFPC: z.number().optional().nullable(),
}));

export const MinMaxDataSchema = z.array(z.object({
  sku: z.string(),
  lpn: z.string(),
  localizacion: z.string(),
  cantidadMinima: z.number(),
  cantidadMaxima: z.number(),
}));

export const UbicacionSugeridaSchema = z.object({
  lpn: z.string().optional().describe("The License Plate Number (LPN) for the stock at this location."),
  localizacion: z.string().describe("The location code."),
  diasFPC: z.number().optional().nullable().describe("Days to expiration for the stock in this location."),
  fechaVencimiento: z.string().optional().nullable().describe("Expiration date for the stock in this location."),
  cantidad: z.number().describe("The quantity of the item at this location."),
});

export const RestockSuggestionSchema = z.object({
  sku: z.string().describe('The SKU of the product.'),
  descripcion: z.string().describe('The description of the product.'),
  cantidadVendida: z.number().describe('The total quantity sold recently. This provides context for the replenishment amount.'),
  cantidadDisponible: z.number().describe('The total quantity currently available in picking locations. This will be low or zero.'),
  cantidadARestockear: z.number().describe('The suggested quantity to move from reserve to picking locations.'),
  ubicacionesSugeridas: z.array(UbicacionSugeridaSchema).describe('For items to restock, these are the reserve locations to pull from, ordered by FEFO. For "OK" items, these are the picking locations where stock is currently available.'),
  lpnDestino: z.string().optional().nullable().describe("The destination LPN for the restock, from the Min/Max file."),
  localizacionDestino: z.string().optional().nullable().describe("The destination location for the restock, from the Min/Max file."),
});

export const GenerateRestockSuggestionsOutputSchema = z.array(RestockSuggestionSchema);
export type GenerateRestockSuggestionsOutput = z.infer<typeof GenerateRestockSuggestionsOutputSchema>;

export const MissingProductSchema = z.object({
  sku: z.string().describe('The SKU of the product.'),
  descripcion: z.string().describe('The description of the product.'),
  cantidadVendida: z.number().describe('The quantity sold.'),
});
export type MissingProductsOutput = z.infer<typeof MissingProductSchema>;

export const AnalysisResultSchema = z.object({
    suggestions: GenerateRestockSuggestionsOutputSchema.describe('Suggestions for stock replenishment.'),
    missingProducts: z.array(MissingProductSchema).describe('Products that were sold but have no inventory at all.'),
});
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
