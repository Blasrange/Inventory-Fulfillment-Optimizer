/**
 * @fileOverview This file contains the column mapping configuration for parsing uploaded files.
 * By centralizing these mappings, you can easily adapt the application to different
 * file formats from various clients without modifying the core UI code.
 *
 * For each internal field (e.g., 'material'), provide a list of possible
 * column header names that might appear in client files. The system will
 * search for these names in order and use the first one it finds.
 */

export const salesColumnMapping = {
  material: ['Material', 'ID de Producto', 'codigo'],
  descripcion: ['Descripción', 'Nombre de Artículo'],
  cantidadConfirmada: ['cantidad confirmada', 'Cant. Facturada'],
};

export const inventoryColumnMapping = {
  sku: ['SKU', 'Item Code'],
  lpn: ['LPN', 'Pallet ID'],
  descripcion: ['Descripcion', 'Description'],
  localizacion: ['Localizacion', 'Location'],
  disponible: ['Disponible', 'Available'],
  estado: ['Estado', 'Status'],
  fechaVencimiento: ['Fecha de vencimiento', 'Expiration', 'fecha caducidad'],
  diasFPC: ['FPC', 'Days to Exp'],
};

export const minMaxColumnMapping = {
    sku: ['sku', 'item'],
    lpn: ['lpn', 'pallet'],
    localizacion: ['localizacion', 'loc'],
    cantidadMinima: ['cantidad minima', 'min'],
    cantidadMaxima: ['cantidad maxima', 'max'],
};