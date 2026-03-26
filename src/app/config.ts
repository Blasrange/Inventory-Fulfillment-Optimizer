/**
 * @fileOverview Este archivo contiene la configuración de mapeo de columnas para analizar archivos subidos.
 * Al centralizar estos mapeos, puedes adaptar fácilmente la aplicación a diferentes
 * formatos de archivos de varios clientes sin modificar el código central de la interfaz.
 *
 * Para cada campo interno (por ejemplo, 'material'), proporciona una lista de posibles
 * nombres de encabezado de columna que puedan aparecer en los archivos de los clientes.
 * El sistema buscará estos nombres en orden y usará el primero que encuentre.
 */

// Modulo: Analisis por Ventas
export const salesColumnMapping = {
  material: ["Material", "ID de Producto", "codigo", "Material"],
  descripcion: ["Descripción", "Nombre de Artículo"],
  cantidadConfirmada: ["cantidad confirmada", "Cant. Facturada", "Cantidad"],
};

// Modulo: Inventario base (WMS) para Ventas, Niveles y Vida Util
export const inventoryColumnMapping = {
  sku: ["SKU", "Item Code"],
  lpn: ["LPN", "Pallet ID"],
  descripcion: ["Descripcion", "Description"],
  localizacion: ["Localizacion", "Location"],
  disponible: ["Disponible", "Available"],
  estado: ["Estado", "Status"],
  fechaVencimiento: ["Fecha de vencimiento", "Expiration", "fecha caducidad"],
  diasFPC: ["FPC", "Days to Exp", "DIAS FPC"],
  lote: ["Lote", "Batch", "Ce. Lote"],
};

// Modulo: Analisis por Niveles (Min/Max)
export const minMaxColumnMapping = {
  sku: ["sku", "item"],
  lpn: ["lpn", "pallet"],
  localizacion: ["localizacion", "loc"],
  cantidadMinima: ["cantidad minima", "min"],
  cantidadMaxima: ["cantidad maxima", "max"],
};

// Modulo: Analisis de Vida Util
export const shelfLifeColumnMapping = {
  sku: [
    "Código de articulo",
    "Código de artículo",
    "Codigo de articulo",
    "Codigo de artículo",
    "Material",
    "SKU",
    "Codigo",
  ],
  diasMinimos: [
    "Vida util del producto",
    "Vida útil del producto",
    "Vida Util",
    "Dias Minimos",
    "Requerido",
    "VIDA UTIL REQUERIDA",
  ],
};

// Modulo: Cruce de Inventario (fuente SAP)
export const sapInventoryMapping = {
  sku: ["Material", "Material"],
  descripcion: ["Texto breve material"],
  lote: ["Ce. Lote", "Lote"],
  cantidad: ["Stock disponible", "WM stock disp.", "Stock total"],
};

// Modulo: Cruce de Inventario (fuente WMS)
export const wmsInventoryCrossMapping = {
  sku: ["SKU", "Codigo"],
  descripcion: ["Descripcion", "Descripción"],
  lote: ["Lote", "Batch", "Ce. Lote"],
  cantidad: ["Disponible", "Unidades"],
};

// Modulo: Cruce de Lotes (fuente SAP - entrada)
export const sapLotCrossMapping = {
  sku: ["Material", "SKU", "Codigo", "Código", "Material"],
  descripcion: ["Texto breve de material", "Descripcion", "Descripción"],
  lote: ["Lote", "Ce. Lote"],
  cantidad: [
    "Ctd teórica 'desde'",
    "Ctd Teórica",
    "Cantidad Teórica",
    "Stock disponible",
    "Ctd. teór. hacia",
    "Ctd real 'desde'",
  ],
};

// Modulo: Cruce de Lotes (fuente WMS - albaran)
export const wmsLotCrossMapping = {
  sku: ["Sku", "SKU", "Sku 2", "Sku2", "Codigo", "Código"],
  descripcion: ["Descripción", "Descripcion", "Desc"],
  lote: ["Lote", "Batch", "Ce. Lote"],
  cantidad: ["Unidades", "Cajas", "Cantidad"],
};

// Modulo: Etiquetas Exito (homologacion de columnas)
export const exitoLabelsColumnMapping = {
  ocMarker: ["OC", "O/C", "ORDEN DE COMPRA", "ORDEN COMPRA", "NRO OC"],
  barcode: [
    "COD. BARRA",
    "COD BARRA",
    "CODIGO BARRA",
    "CÓDIGO BARRA",
    "CODBARRA",
    "BARCODE",
    "EAN",
    "GTIN",
  ],
  dependencia: [
    "DEPENDENCIAS",
    "DEPENDENCIA",
    "COD DEPENDENCIA",
    "CODIGO DEPENDENCIA",
    "DEP",
    "TIENDA CODIGO",
  ],
  tienda: [
    "DESC. ITEM",
    "DESC ITEM",
    "DESCRIPCION",
    "DESCRIPCIÓN",
    "TIENDA",
    "NOMBRE TIENDA",
    "DESTINO",
  ],
  cantidad: ["CJ/UN", "CANT", "QTY", "UNIDADES", "CAJAS"],
};
