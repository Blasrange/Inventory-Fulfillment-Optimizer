/**
 * @fileOverview Este archivo contiene la configuración de mapeo de columnas para analizar archivos subidos.
 * Al centralizar estos mapeos, puedes adaptar fácilmente la aplicación a diferentes
 * formatos de archivos de varios clientes sin modificar el código central de la interfaz.
 *
 * Para cada campo interno (por ejemplo, 'material'), proporciona una lista de posibles
 * nombres de encabezado de columna que puedan aparecer en los archivos de los clientes.
 * El sistema buscará estos nombres en orden y usará el primero que encuentre.
 */

export const salesColumnMapping = {
  material: ["Material", "ID de Producto", "codigo"],
  descripcion: ["Descripción", "Nombre de Artículo"],
  cantidadConfirmada: ["cantidad confirmada", "Cant. Facturada"],
};

export const inventoryColumnMapping = {
  sku: ["SKU", "Item Code"],
  lpn: ["LPN", "Pallet ID"],
  descripcion: ["Descripcion", "Description"],
  localizacion: ["Localizacion", "Location"],
  disponible: ["Disponible", "Available"],
  estado: ["Estado", "Status"],
  fechaVencimiento: ["Fecha de vencimiento", "Expiration", "fecha caducidad"],
  diasFPC: ["FPC", "Days to Exp"],
};

export const minMaxColumnMapping = {
  sku: ["sku", "item"],
  lpn: ["lpn", "pallet"],
  localizacion: ["localizacion", "loc"],
  cantidadMinima: ["cantidad minima", "min"],
  cantidadMaxima: ["cantidad maxima", "max"],
};

export const sapInventoryMapping = {
  sku: ["Material"],
  descripcion: ["Texto breve material"],
  lote: ["Ce. Lote", "Lote"],
  cantidad: ["Stock disponible", "WM stock disp."],
};

export const wmsInventoryCrossMapping = {
  sku: ["SKU", "Codigo"],
  descripcion: ["Descripcion", "Descripción"],
  lote: ["Lote"],
  cantidad: ["Disponible", "Unidades"],
};
