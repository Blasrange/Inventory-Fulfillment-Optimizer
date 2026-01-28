/**
 * @fileOverview This file contains shared configuration for the analysis flows.
 * By centralizing these settings, you can easily adapt the logic to different
 * client requirements without modifying the core analysis code.
 */

export const analysisConfig = {
  /**
   * A list of valid inventory statuses to be considered as available stock.
   * Add new statuses from different clients/ERPs here. The values will be
   * converted to uppercase for case-insensitive comparison.
   * @example ["DISPONIBLE", "EN STOCK", "LIBRE UTILIZACION"]
   */
  VALID_STATUSES: ["STOCK EN ALMACEN LIBRE", "DISPONIBLE"],

  /**
   * A list of specific warehouse locations to ignore completely from the analysis.
   * This is useful for excluding quality control, damaged goods, or virtual locations.
   * @example ["PDIF-INV-1-10", "QA-HOLD", "DAMAGED"]
   */
  IGNORED_LOCATIONS: ["PDIF-INV-1-10", "DEV-1-10"],
};
