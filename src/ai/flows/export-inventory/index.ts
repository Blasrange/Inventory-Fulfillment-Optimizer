"use server";

import { 
  MaestraExportacion, 
  InventarioExportacion, 
  ResultadoExportacion 
} from "../schemas";
import { analysisConfig } from "../config";

const { EXPORT_INVENTORY_TARGET_AISLE, IGNORED_LOCATION_KEYWORDS } = analysisConfig;

function esPasilloDestino(localizacion: string | null | undefined): boolean {
  if (!localizacion) return false;
  return localizacion.toUpperCase().startsWith(EXPORT_INVENTORY_TARGET_AISLE);
}

function obtenerPasillo(localizacion: string | null | undefined): string | null {
  if (!localizacion) return null;
  const match = localizacion.toUpperCase().match(/^([A-Za-z0-9]+)/);
  return match ? match[1] : null;
}

export async function validarPasilloP10(
  maestra: MaestraExportacion,
  inventario: InventarioExportacion
): Promise<ResultadoExportacion[]> {
  const resultados: ResultadoExportacion[] = [];

  // Crear un Set con los códigos de la maestra (con ceros a la izquierda preservados)
  const codigosMaestra = new Set<string>();
  const maestraMap = new Map<string, string>();
  
  for (const mat of maestra) {
    const codigoStr = String(mat.Cod).trim();
    codigosMaestra.add(codigoStr);
    maestraMap.set(codigoStr, mat.REFERENCIA);
  }


  // Filtrar inventario: SOLO los códigos que están en la maestra y NO en ubicaciones ignoradas
  const inventarioFiltrado = inventario.filter((inv) => {
    const codigoStr = String(inv.Codigo).trim();
    // Omitir si la localización contiene alguna palabra clave ignorada
    if (inv.Localizacion) {
      const loc = inv.Localizacion.toUpperCase();
      if (IGNORED_LOCATION_KEYWORDS.some((kw) => loc.includes(kw.toUpperCase()))) {
        return false;
      }
    }
    return codigosMaestra.has(codigoStr);
  });

  // Procesar SOLO el inventario filtrado
  for (const inv of inventarioFiltrado) {
    const codigoStr = String(inv.Codigo).trim();
    const referencia = maestraMap.get(codigoStr)!;
    const ubicacionActual = inv.Localizacion || null;
    const pasilloActual = obtenerPasillo(ubicacionActual);
    const enDestino = esPasilloDestino(ubicacionActual);

    if (enDestino) {
      resultados.push({
        codigo: codigoStr,
        referencia: referencia,
        localizacionActual: ubicacionActual,
        estado: 'OK',
        localizacionSugerida: null,
        sugerencia: `✅ Correctamente ubicado en ${ubicacionActual}`,
        lpn: inv.LPN || null,
      });
    } else {
      const sugerencia = pasilloActual
        ? `🚚 Mover de ${pasilloActual} a pasillo ${EXPORT_INVENTORY_TARGET_AISLE}`
        : `🚚 Mover a pasillo ${EXPORT_INVENTORY_TARGET_AISLE} para optimizar la ubicación`;

      resultados.push({
        codigo: codigoStr,
        referencia: referencia,
        localizacionActual: ubicacionActual,
        estado: 'MOVIMIENTO AL PASILLO SUGERIDO',
        localizacionSugerida: EXPORT_INVENTORY_TARGET_AISLE,
        sugerencia: sugerencia,
        lpn: inv.LPN || null,
      });
    }
  }

  return resultados;
}

export async function obtenerEstadisticasPorCodigo(
  maestra: MaestraExportacion,
  inventario: InventarioExportacion
): Promise<{
  porCodigo: Map<string, { total: number; ok: number; movimientos: number }>;
  totalRegistros: number;
  totalOK: number;
  totalMovimientos: number;
}> {
  const resultados = await validarPasilloP10(maestra, inventario);
  const porCodigo = new Map();
  
  let totalOK = 0;
  let totalMovimientos = 0;
  
  for (const r of resultados) {
    if (!porCodigo.has(r.codigo)) {
      porCodigo.set(r.codigo, { total: 0, ok: 0, movimientos: 0 });
    }
    const stats = porCodigo.get(r.codigo);
    stats.total++;
    if (r.estado === 'OK') {
      stats.ok++;
      totalOK++;
    } else {
      stats.movimientos++;
      totalMovimientos++;
    }
  }
  
  return {
    porCodigo,
    totalRegistros: resultados.length,
    totalOK,
    totalMovimientos,
  };
}

export async function obtenerMovimientosSugeridos(
  maestra: MaestraExportacion,
  inventario: InventarioExportacion
): Promise<ResultadoExportacion[]> {
  const resultados = await validarPasilloP10(maestra, inventario);
  return resultados.filter(r => r.estado !== 'OK');
}

export async function generarExportacionPasilloP10Excel(
  maestra: MaestraExportacion,
  inventario: InventarioExportacion,
  soloMovimientos: boolean = false
): Promise<{ resultados: ResultadoExportacion[] }> {
  let resultados = await validarPasilloP10(maestra, inventario);
  
  if (soloMovimientos) {
    resultados = resultados.filter(r => r.estado !== 'OK');
  }
  
  return { resultados };
}