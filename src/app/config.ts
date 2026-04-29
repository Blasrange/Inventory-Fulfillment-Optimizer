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
  fechaEntrada: [
    "Fecha de entrada",
    "Fecha Entrada",
    "Fecha ingreso",
    "Fecha de ingreso",
    "Fecha recepcion",
    "Fecha recepción",
    "Entry Date",
    "Receipt Date",
  ],
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
  sku: ["Material", "Material", "Item"],
  descripcion: ["Texto breve material", "Descripcion", "Descripción"],
  lote: ["Ce. Lote", "Lote"],
  cantidad: ["Stock disponible", "WM stock disp.", "Stock total", "Disponible", "Existencia"],
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
  sku: ["Material", "SKU", "Codigo", "Código", "Material", "Material"],
  descripcion: ["Texto breve de material", "Descripcion", "Descripción"],
  lote: ["Lote", "Ce. Lote"],
  cantidad: [
    "Ctd.real dest.",
    "Ctd.real dest",
    "Ctd real dest.",
    "Ctd real dest",
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

// Module: Smart Assortment (Ventas y Stock)
export const smartAssortmentSalesMapping = {
  oboId: ["OBO_ID"],
  oboOrder: ["OBO_ORDER"],
  oboOrder2: ["OBO_ORDER2"],
  oboInvoice: ["OBO_INVOICE"],
  oboPurchaseOrder: ["OBO_PURCHASE_ORDER"],
  oboTrackingNumber: ["OBO_TRACKING_NUMBER"],
  carrier: ["CARRIER"],
  oboOrderDatetime: ["OBO_ORDER_DATETIME"],
  obtDescription: ["OBT_DESCRIPTION"],
  cstCode: ["CST_CODE"],
  cstName: ["CST_NAME"],
  soldCode: ["SOLD_CODE"],
  soldName: ["SOLD_NAME"],
  strCode: ["STR_CODE"],
  strName: ["STR_NAME"],
  oboOrderDate: ["OBO_ORDER_DATE"],
  oboState: ["OBO_STATE"],
  oboNote: ["OBO_NOTE"],
  oosDescription: ["OOS_DESCRIPTION"],
  sku: ["MAI_SKU"],
  description: ["MAI_DESCRIPTION"],
  ean13: ["EAN13"],
  qtyHandling: ["QTY_HANDLING"],
  uomHandling: ["UOM_HANDLING"],
  qtyOrder: ["QTY_ORDER"],
  uomOrder: ["UOM_ORDER"],
  qtyBooked: ["OOL_QTY_BOOKED"],
  qtyPicked: ["OOL_QTY_PICKED"],
  qtyDelivery: ["OOL_QTY_DELIVERY"],
  channel: ["OBO_CHANNEL_DESCRIPTION"],
  division: ["OBO_DIVISION_DESCRIPTION"],
  qtyContainers: ["QTY_CONTAINERS"],
  oboRemittance: ["OBO_REMITTANCE"],
  oboRemittanceDate: ["OBO_REMITTANCE_DATE"],
  day: ["DIA"],
  month: ["MES"],
  year: ["AÑO"],
  specialClient: ["CLIENTE.ESP"],
};

export const smartAssortmentStockMapping = {
  Codigo: ["Codigo", "codigo"],
  LPN: ["LPN", "lpn"],
  Localizacion: ["Localizacion", "localizacion"],
  "Area Picking": ["Area Picking", "areaPicking"],
  SKU: ["SKU", "sku"],
  SKU2: ["SKU2", "sku2"],
  Descripcion: ["Descripcion", "descripcion"],
  Precio: ["Precio", "precio"],
  "Tipo de Material": ["Tipo de Material", "tipoMaterial"],
  "Categoría de Material": ["Categoría de Material", "categoriaMaterial"],
  Unidades: ["Unidades", "unidades"],
  Cajas: ["Cajas", "cajas"],
  Reserva: ["Reserva", "reserva"],
  Disponible: ["Disponible", "disponible"],
  UDM: ["UDM", "udm"],
  Embalaje: ["Embalaje", "embalaje"],
  "Fecha de entrada": ["Fecha de entrada", "fechaEntrada"],
  Estado: ["Estado", "estado"],
  Lote: ["Lote", "lote"],
  "Fecha de fabricacion": ["Fecha de fabricacion", "fechaFabricacion"],
  "Fecha de vencimiento": ["Fecha de vencimiento", "fechaVencimiento"],
  FPC: ["FPC", "fpc"],
  Peso: ["Peso", "peso"],
  Serial: ["Serial", "serial"],
};

export const smartAssortmentMaterialMasterMapping = {
  lpn: ["LPN"],
  localizacion: ["Localizacion", "Ubicacion"],
  sku: ["SKU", "sku", "Codigo", "Material"],
  descripcion: ["Descripcion", "Descripción", "Description"],
  tipoMaterial: ["Tipo de Material", "TipoMaterial"],
};

// Modulo: Exportación de Inventario (Pasillo P10)
export const exportInventoryMasterMapping = {
  Cod: ["Cod"],
  REFERENCIA: ["REFERENCIA", "Referencia", "Descripción", "Descripcion", "Nombre"],
};

export const exportInventoryMapping = {
  Codigo: ["SKU", "Material"],
  LPN: ["LPN", "Pallet", "Pallet ID"],
  Localizacion: ["Localizacion", "Localización", "Ubicacion", "Location"],
};