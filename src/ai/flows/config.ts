/**
 * @fileOverview Este archivo contiene la configuración compartida para los flujos de análisis.
 * Al centralizar estas configuraciones, puedes adaptar fácilmente la lógica a diferentes
 * requerimientos de clientes sin modificar el código base del análisis.
 */

export const analysisConfig = {
  /**
   * Lista de estados de inventario válidos que se consideran como stock disponible.
   * Agrega aquí nuevos estados provenientes de diferentes clientes/ERPs. Los valores serán
   * convertidos a mayúsculas para comparación sin distinción entre mayúsculas y minúsculas.
   * @example ["DISPONIBLE", "EN STOCK", "LIBRE UTILIZACION"]
   */
  VALID_STATUSES: ["STOCK EN ALMACEN LIBRE", "DISPONIBLE"],

  /**
   * Lista de ubicaciones específicas de almacén que deben ignorarse completamente en el análisis.
   * Esto es útil para excluir control de calidad, mercancía dañada o ubicaciones virtuales.
   * @example ["PDIF-INV-1-10", "QA-HOLD", "DAMAGED"]
   */
  IGNORED_LOCATIONS: ["PDIF-INV-1-10", "DEV-1-10"],

   /**
   * Última parte de un código de ubicación que lo identifica como ubicación de picking.
   * Ejemplo: Para una ubicación "P1-A-1-5", "5" es la última parte.
   */
  PICKING_LEVELS: ['5', '10', '15'],

  /**
   * Última parte de un código de ubicación que lo identifica como ubicación de reserva.
   * Ejemplo: Para una ubicación "P2-B-3-20", "20" es la última parte.
   */
  RESERVE_LEVELS: ['20', '30', '40', '50', '60', '70'],

  /**
   * Lista de prefijos de ubicación (o nombres completos) que se considerarán como ubicaciones de stock de reserva.
   * El sistema verificará si el nombre de la ubicación comienza con alguno de estos valores (sin distinción entre mayúsculas y minúsculas).
   * @example ["MUELLE ENTRADA", "ZONA DE RESERVA"]
   */
  ADDITIONAL_RESERVE_LOCATIONS: ["MUELLE ENTRADA"],
};
