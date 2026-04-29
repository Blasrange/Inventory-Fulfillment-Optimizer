"use client";

import { useState, useMemo } from "react";
import {
  Loader2,
  Warehouse,
  Download,
  ChevronDown,
  RefreshCcw,
  TrendingUp,
  BarChart3,
  GitCompare,
  Layers,
  Upload,
  FileText,
  FileSpreadsheet,
  Database,
  Clock,
  Activity,
  Tag,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileUploader } from "@/components/file-uploader";
import { parseData, parseRawData } from "@/lib/csv";
import { downloadFile } from "@/lib/download";
import { useToast } from "@/hooks/use-toast";
import {
  runAnalysis,
  generateWmsFiles,
  generateFullReportFile,
  generateInboundExcel,
  runSurtidoInteligenteExcel,
  generateExportInventoryExcel,
} from "@/app/actions";
import type {
  GenerateRestockSuggestionsOutput,
  MissingProductsOutput,
  InventoryCrossResult,
  LotCrossResult,
  ShelfLifeResult,
  InventoryAgeResult,
} from "@/ai/flows/schemas";
import { Logo } from "@/components/icons";
import { ResultsTable } from "@/components/results-table";
import { MissingStockTable } from "@/components/missing-stock-table";
import { InventoryCrossTable } from "@/components/inventory-cross-table";
import { LotCrossTable } from "../components/lot-cross-table";
import { InboundMapper } from "@/components/inbound-mapper";
import { InboundResultsTable } from "@/components/inbound-results-table";
import { ShelfLifeTable } from "@/components/shelf-life-table";
import { InventoryAgeTable } from "@/components/inventory-age-table";
import { ExitoLabelsView } from "@/components/exito-labels-view";
import { SurtidoInteligenteView } from "@/components/smart-assortment-table";
import { ExportacionesTable } from "@/components/export-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  salesColumnMapping,
  inventoryColumnMapping,
  minMaxColumnMapping,
  sapInventoryMapping,
  wmsInventoryCrossMapping,
  sapLotCrossMapping,
  wmsLotCrossMapping,
  shelfLifeColumnMapping,
  smartAssortmentSalesMapping,
  smartAssortmentStockMapping,
  smartAssortmentMaterialMasterMapping,
  exportInventoryMapping,
  exportInventoryMasterMapping,
} from "./config";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

type AnalysisMode =
  | "sales"
  | "levels"
  | "cross"
  | "lotCross"
  | "inbound"
  | "shelfLife"
  | "inventoryAge"
  | "exitoLabels"
  | "surtidoInteligente"
  | "exportInventory";

const analysisModes: AnalysisMode[] = [
  "sales",
  "levels",
  "cross",
  "lotCross",
  "inbound",
  "shelfLife",
  "inventoryAge",
  "exitoLabels",
  "surtidoInteligente",
  "exportInventory",
];

function isAnalysisMode(key: string): key is AnalysisMode {
  return analysisModes.includes(key as AnalysisMode);
}

// Configuración de mapeos y columnas numéricas por tipo de archivo
const FILE_CONFIG: Record<string, { mapping: any; numericCols: string[] }> = {
  sales: { mapping: salesColumnMapping, numericCols: ["cantidadConfirmada"] },
  inventory: { mapping: inventoryColumnMapping, numericCols: ["disponible", "diasFPC"] },
  inventoryWms: { mapping: inventoryColumnMapping, numericCols: ["disponible", "diasFPC"] },
  minMax: { mapping: minMaxColumnMapping, numericCols: ["cantidadMinima", "cantidadMaxima"] },
  sap: { mapping: sapInventoryMapping, numericCols: ["cantidad"] },
  sapLot: { mapping: sapLotCrossMapping, numericCols: ["cantidad"] },
  shelfLife: { mapping: shelfLifeColumnMapping, numericCols: ["diasMinimos"] },
  wms: { mapping: wmsInventoryCrossMapping, numericCols: ["cantidad"] },
  wmsLot: { mapping: wmsLotCrossMapping, numericCols: ["cantidad"] },
  surtidoSales: { mapping: smartAssortmentSalesMapping, numericCols: ["qtyOrder", "qtyBooked", "qtyPicked", "qtyDelivery", "qtyHandling", "qtyContainers"] },
  surtidoInventory: { mapping: smartAssortmentStockMapping, numericCols: ["units", "boxes", "reserve", "available", "weight"] },
  surtidoMaterialMaster: { mapping: smartAssortmentMaterialMasterMapping, numericCols: [] },
  exportMaterialInventory: { mapping: exportInventoryMasterMapping, numericCols: [] },
  exportInventory: { mapping: exportInventoryMapping, numericCols: [] },
};

// Módulos que necesitan resetear resultados al cargar ciertos archivos
const RESET_TRIGGERS: Record<string, AnalysisMode[]> = {
  sales: ["sales"],
  inventory: ["sales", "levels", "shelfLife", "inventoryAge"],
  minMax: ["levels"],
  sap: ["cross"],
  sapLot: ["lotCross"],
  wms: ["cross"],
  wmsLot: ["lotCross"],
  shelfLife: ["shelfLife"],
  exportMaster: ["exportInventory"],
  exportInventory: ["exportInventory"],
};

export default function Home() {
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("sales");
  const [selectedModule, setSelectedModule] = useState<AnalysisMode | null>(null);
  
  // Estados de datos
  const [salesData, setSalesData] = useState<any[] | null>(null);
  const [inventoryData, setInventoryData] = useState<any[] | null>(null);
  const [minMaxData, setMinMaxData] = useState<any[] | null>(null);
  const [sapData, setSapData] = useState<any[] | null>(null);
  const [wmsData, setWmsData] = useState<any[] | null>(null);
  const [sapLotData, setSapLotData] = useState<any[] | null>(null);
  const [wmsLotData, setWmsLotData] = useState<any[] | null>(null);
  const [shelfLifeMasterData, setShelfLifeMasterData] = useState<any[] | null>(null);
  const [groupByLot, setGroupByLot] = useState(true);
  const [surtidoSalesData, setSurtidoSalesData] = useState<any[] | null>(null);
  const [surtidoInventoryData, setSurtidoInventoryData] = useState<any[] | null>(null);
  const [surtidoMaterialMaster, setSurtidoMaterialMaster] = useState<any[] | null>(null);
  
  // Estados para Exportación de Inventario
  const [exportMasterData, setExportMasterData] = useState<any[] | null>(null);
  const [exportInventoryData, setExportInventoryData] = useState<any[] | null>(null);
  const [exportResults, setExportResults] = useState<any[] | null>(null);
  
  // Estados específicos para Entradas (Inbound)
  const [rawInbound, setRawInbound] = useState<{ headers: string[]; rows: any[] } | null>(null);
  const [inboundMapping, setInboundMapping] = useState<Record<string, string>>({});
  const [inboundFixedValues, setInboundFixedValues] = useState<Record<string, string>>({});
  const [inboundResults, setInboundResults] = useState<any[] | null>(null);

  // Resultados de análisis
  const [suggestions, setSuggestions] = useState<GenerateRestockSuggestionsOutput | null>(null);
  const [missingProducts, setMissingProducts] = useState<MissingProductsOutput[] | null>(null);
  const [crossResults, setCrossResults] = useState<InventoryCrossResult | null>(null);
  const [lotCrossResults, setLotCrossResults] = useState<LotCrossResult | null>(null);
  const [shelfLifeResults, setShelfLifeResults] = useState<any[] | null>(null);
  const [inventoryAgeResults, setInventoryAgeResults] = useState<any[] | null>(null);
  
  // Estado específico para Surtido Inteligente (vista mejorada)
  const [surtidoSuggestions, setSurtidoSuggestions] = useState<any[] | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [exitoAnalyzeTrigger, setExitoAnalyzeTrigger] = useState(0);
  const [exitoCanAnalyze, setExitoCanAnalyze] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "ascending" | "descending" } | null>(null);
  const { toast } = useToast();

  const resetResultsForMode = (mode: string) => {
    console.log(`🔄 Resetando resultados para modo: ${mode}`);
    setSuggestions(null);
    setMissingProducts(null);
    setCrossResults(null);
    setLotCrossResults(null);
    setSortConfig(null);
    setShelfLifeResults(null);
    setInventoryAgeResults(null);
    setSurtidoSuggestions(null);
    setExportResults(null);
    
    if (mode === "inbound") {
      setInboundResults(null);
      setInboundMapping({});
      setInboundFixedValues({});
    }
  };

  // Actualizadores de estado para cada tipo de dato
  const dataSetters: Record<string, (data: any[] | null) => void> = {
    sales: setSalesData,
    inventory: setInventoryData,
    minMax: setMinMaxData,
    sap: setSapData,
    sapLot: setSapLotData,
    wms: setWmsData,
    wmsLot: setWmsLotData,
    shelfLife: setShelfLifeMasterData,
    surtidoSales: setSurtidoSalesData,
    surtidoInventory: setSurtidoInventoryData,
    surtidoMaterialMaster: setSurtidoMaterialMaster,
    exportMaterialInventory: setExportMasterData,
    exportInventory: setExportInventoryData,
  };

  const handleFileRead = (content: string | ArrayBuffer, type: string) => {
    try {
      // Manejo especial para modo Inbound
      if (type === "inbound") {
        const res = parseRawData(content);
        setRawInbound(res);
        setInboundResults(null);
        setInboundMapping({});
        setInboundFixedValues({});
        
        toast({
          title: "✅ Archivo Cargado",
          description: `Se cargaron ${res?.rows?.length || 0} registros correctamente.\nAhora vincula las columnas para procesar.`,
          className: "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
        });
        return;
      }

      // Surtido Inteligente
      if (analysisMode === "surtidoInteligente" && (type === "surtidoSales" || type === "surtidoInventory" || type === "surtidoMaterialMaster")) {
        const config = FILE_CONFIG[type];
        if (config) {
          const data = parseData(content, config.mapping, config.numericCols);
          dataSetters[type](data);
          resetResultsForMode(analysisMode);
          toast({
            title: "✅ Archivo Cargado",
            description: `Se cargaron ${data.length} registros de ${type === "surtidoSales" ? "ventas" : type === "surtidoInventory" ? "stock" : "maestra de materiales"} correctamente.`,
            className: "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
          });
        }
        return;
      }

      // Exportación de Inventario
      if (analysisMode === "exportInventory" && (type === "exportMaterialInventory" || type === "exportInventory")) {
        const config = FILE_CONFIG[type];
        if (config) {
          const data = parseData(content, config.mapping, config.numericCols);
          dataSetters[type](data);
          
          // Si ya tenemos ambos archivos, procesar automáticamente
          if (type === "exportMaterialInventory") {
            toast({
              title: "✅ Maestra de Exportación Cargada",
              description: `Se cargaron ${data.length} registros de la maestra.`,
              className: "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
            });
          } else if (type === "exportInventory") {
            toast({
              title: "✅ Inventario Cargado",
              description: `Se cargaron ${data.length} registros de inventario.`,
              className: "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
            });
          }
          
          resetResultsForMode(analysisMode);
        }
        return;
      }

      // Resto de módulos
      const config = FILE_CONFIG[type];
      if (!config) throw new Error(`Tipo de archivo no soportado: ${type}`);

      const data = parseData(content, config.mapping, config.numericCols);
      
      if (data.length === 0) {
        toast({
          variant: "destructive",
          title: "❌ Archivo Vacío o Inválido",
          description: "El archivo no contiene datos o el formato es incorrecto.",
          className: "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
        });
        return;
      }

      // Actualizar el estado correspondiente
      if (dataSetters[type]) dataSetters[type](data);
      
      // Resetear resultados si el modo actual lo requiere
      const modesToReset = RESET_TRIGGERS[type];
      if (modesToReset?.includes(analysisMode)) {
        resetResultsForMode(analysisMode);
      }

      toast({
        title: "✅ Archivo Cargado",
        description: `Se cargaron ${data.length} registros correctamente.`,
        className: "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ Error al procesar el archivo",
        description: error instanceof Error ? error.message : "Error desconocido",
        className: "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
      });
    }
  };

  const handleFileReset = (type: string) => {
    console.log(`🗑️ Archivo eliminado: ${type}`);
    
    if (dataSetters[type]) dataSetters[type](null);
    if (type === "inbound") setRawInbound(null);
    if (type === "exportMaterialInventory" || type === "exportInventory") {
      setExportResults(null);
    }
    
    resetResultsForMode(analysisMode);
    
    toast({
      title: "🔄 Archivo eliminado",
      description: "Los resultados han sido restablecidos.",
      className: "bg-gradient-to-r from-slate-400 to-slate-500 text-white border-0 shadow-lg",
      duration: 2000,
    });
  };

  // Validadores de archivos por modo
  const validateFilesForMode = (): boolean => {
    const validations: Record<AnalysisMode, () => boolean> = {
      surtidoInteligente: () => {
        if (!surtidoSalesData || !surtidoInventoryData || !surtidoMaterialMaster) {
          toast({ variant: "destructive", title: "❌ Faltan archivos", description: "Carga ventas, stock y maestra de materiales para continuar.", className: "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg" });
          return false;
        }
        return true;
      },
      exitoLabels: () => {
        if (!exitoCanAnalyze) {
          toast({ variant: "destructive", title: "❌ Falta archivo", description: "Carga el archivo de pedidos Éxito antes de ejecutar el análisis.", className: "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg" });
          return false;
        }
        return true;
      },
      inbound: () => {
        if (!rawInbound) {
          toast({ variant: "destructive", title: "❌ Falta archivo", description: "Carga el archivo del proveedor para continuar.", className: "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg" });
          return false;
        }
        return true;
      },
      shelfLife: () => {
        if (!inventoryData || !shelfLifeMasterData) {
          toast({ variant: "destructive", title: "❌ Faltan archivos", description: "Carga el inventario y la maestra de vida útil para continuar.", className: "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg" });
          return false;
        }
        return true;
      },
      inventoryAge: () => {
        if (!inventoryData) {
          toast({ variant: "destructive", title: "❌ Falta archivo", description: "Carga el inventario WMS con fecha de entrada para continuar.", className: "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg" });
          return false;
        }
        return true;
      },
      sales: () => {
        if (!salesData || !inventoryData) {
          toast({ variant: "destructive", title: "❌ Faltan archivos", description: "Carga facturación e inventario para continuar.", className: "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg" });
          return false;
        }
        return true;
      },
      levels: () => {
        if (!inventoryData || !minMaxData) {
          toast({ variant: "destructive", title: "❌ Faltan archivos", description: "Carga inventario y niveles Mín/Máx para continuar.", className: "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg" });
          return false;
        }
        return true;
      },
      cross: () => {
        if (!sapData || !wmsData) {
          toast({ variant: "destructive", title: "❌ Faltan archivos", description: "Carga inventario SAP e inventario WMS para continuar.", className: "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg" });
          return false;
        }
        return true;
      },
      lotCross: () => {
        if (!sapLotData || !wmsLotData) {
          toast({ variant: "destructive", title: "❌ Faltan archivos", description: "Carga el archivo de entrada SAP y el albarán WMS para continuar.", className: "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg" });
          return false;
        }
        return true;
      },
      exportInventory: () => {
        if (!exportMasterData || !exportInventoryData) {
          toast({ 
            variant: "destructive", 
            title: "❌ Faltan archivos", 
            description: "Carga la maestra de exportación y el inventario para continuar.", 
            className: "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg" 
          });
          return false;
        }
        return true;
      }
    };

    return validations[analysisMode]?.() ?? true;
  };

  // Procesar Exportación de Inventario
    const handleExportInventoryAnalysis = async () => {
    if (!exportMasterData || !exportInventoryData) {
      toast({
        variant: "destructive",
        title: "❌ Faltan archivos",
        description: "Carga la maestra de exportación y el inventario para continuar.",
      });
      return false;
    }

    try {
      // Crear un Set con los códigos de la maestra (preservando ceros)
      const codigosMaestra = new Set<string>();
      const masterMap = new Map<string, string>();
      
      exportMasterData.forEach((item: any) => {
        const codigo = String(item.Cod || item.Código || item.Codigo || item.SKU || item.Material).trim();
        const referencia = item.REFERENCIA || item.Referencia || "";
        codigosMaestra.add(codigo);
        masterMap.set(codigo, referencia);
      });

      // Filtrar inventario: SOLO los códigos que están en la maestra
      const inventarioFiltrado = exportInventoryData.filter((item: any) => {
        const codigo = String(item.Codigo || item.Código || item.SKU || item.Material).trim();
        return codigosMaestra.has(codigo);
      });

      console.log(`📊 Inventario original: ${exportInventoryData.length} registros`);
      console.log(`📊 Inventario filtrado: ${inventarioFiltrado.length} registros (solo códigos en maestra)`);

      // Procesar SOLO el inventario filtrado
      const results = [];

      for (const item of inventarioFiltrado) {
        const codigo = String(item.Codigo || item.Código || item.SKU || item.Material).trim();
        const referencia = masterMap.get(codigo) || "";
        const localizacionActual = item.Localizacion || item.Ubicacion || null;
        const pasilloActual = localizacionActual ? localizacionActual.match(/^([A-Za-z0-9]+)/)?.[1] : null;
        
        const estaEnP10 = localizacionActual && localizacionActual.toUpperCase().startsWith('P10');
        
        if (estaEnP10) {
          results.push({
            codigo: codigo,
            referencia: referencia,
            localizacionActual: localizacionActual,
            estado: 'OK',
            localizacionSugerida: null,
            sugerencia: `✅ Correctamente ubicado en ${localizacionActual}`,
            lpn: item.LPN || null,
          });
        } else {
          results.push({
            codigo: codigo,
            referencia: referencia,
            localizacionActual: localizacionActual,
            estado: 'MOVIMIENTO AL PASILLO SUGERIDO',
            localizacionSugerida: 'P10',
            sugerencia: `🚚 Mover de ${pasilloActual || 'ubicación actual'} a pasillo P10`,
            lpn: item.LPN || null,
          });
        }
      }

      setExportResults(results);
      
      const okCount = results.filter(r => r.estado === 'OK').length;
      const movimientoCount = results.filter(r => r.estado === 'MOVIMIENTO AL PASILLO SUGERIDO').length;
      
      toast({
        title: "✨ Exportación Procesada",
        description: `${results.length} registros procesados (solo códigos en maestra). ✅ ${okCount} OK | 🚚 ${movimientoCount} movimientos`,
      });
      
      return true;
    } catch (error) {
      console.error("❌ Error:", error);
      toast({
        variant: "destructive",
        title: "❌ Error",
        description: error instanceof Error ? error.message : "Error desconocido",
      });
      return false;
    }
  };

  const handleExportInventoryDownload = async () => {
  if (!exportMasterData || !exportInventoryData || exportInventoryData.length === 0) {
    toast({
      variant: "destructive",
      title: "❌ Sin datos",
      description: "No hay datos para exportar. Procesa los archivos primero.",
      className: "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
    });
    return;
  }

  setIsDownloading(true);

  try {
    const result = await generateExportInventoryExcel(exportMasterData, exportInventoryData);

    if (result.error) {
      throw new Error(result.error);
    }

    if (result.file && result.filename) {
      downloadFile(result.file, result.filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      toast({
        title: "📥 Exportación Completada",
        description: "El archivo Excel se ha guardado en tu dispositivo",
        className: "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
      });
    }
  } catch (error) {
    toast({
      variant: "destructive",
      title: "❌ Error en la descarga",
      description: error instanceof Error ? error.message : "Error desconocido",
      className: "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
    });
  } finally {
    setIsDownloading(false);
  }
}

  // 🟢 FUNCIÓN ACTUALIZADA - PROCESAMIENTO LOCAL (SIN SERVIDOR)
  const handleSurtidoInteligenteAnalysisAction = async () => {
    if (!surtidoSalesData || !surtidoInventoryData || !surtidoMaterialMaster) {
      toast({
        variant: "destructive",
        title: "❌ Faltan archivos",
        description: "Carga ventas, stock y maestra de materiales para continuar.",
        className: "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
      });
      return false;
    }

    try {
      setIsLoading(true);
      
      // Crear mapa de stock para búsqueda rápida
      const stockMap = new Map();
      surtidoInventoryData.forEach((item: any) => {
        const sku = item.sku || item.SKU || item.codigo || item.Codigo || item.Material;
        if (sku) {
          const disponible = Number(item.available || item.disponible || item.units || 0);
          const reserva = Number(item.reserve || item.reserva || 0);
          stockMap.set(String(sku), { disponible, reserva });
        }
      });
      
      // Crear mapa de maestra de materiales
      const masterMap = new Map();
      surtidoMaterialMaster.forEach((item: any) => {
        const sku = item.sku || item.SKU || item.codigo || item.Codigo || item.Material;
        if (sku) {
          masterMap.set(String(sku), {
            descripcion: item.descripcion || item.Descripcion || item.desc || item.description || "",
            ubicacion: item.ubicacion || item.Ubicacion || item.localizacion || ""
          });
        }
      });
      
      // Agrupar ventas por SKU
      const ventasMap = new Map();
      surtidoSalesData.forEach((item: any) => {
        const sku = item.sku || item.SKU || item.codigo || item.Codigo || item.Material;
        const cantidad = Number(item.qtyOrder || item.cantidad || item.cantidadConfirmada || 0);
        if (sku && cantidad > 0) {
          ventasMap.set(String(sku), (ventasMap.get(String(sku)) || 0) + cantidad);
        }
      });
      
      // Generar sugerencias
      const suggestionsList = [];
      const missingProductsList = [];
      
      for (const [sku, cantidadVendida] of ventasMap) {
        const stock = stockMap.get(sku) || { disponible: 0, reserva: 0 };
        const master = masterMap.get(sku) || { descripcion: "", ubicacion: "" };
        
        const cantidadDisponible = stock.disponible;
        const cantidadEnReserva = stock.reserva;
        const cantidadTotal = cantidadDisponible + cantidadEnReserva;
        const cantidadARestockear = Math.max(0, cantidadVendida - cantidadDisponible);
        const cantidadFaltante = Math.max(0, cantidadVendida - cantidadTotal);
        
        suggestionsList.push({
          sku: sku,
          descripcion: master.descripcion,
          cantidadVendida: cantidadVendida,
          cantidadVendidaOriginal: cantidadVendida,
          cantidadDisponiblePicking: cantidadDisponible,
          cantidadEnReserva: cantidadEnReserva,
          cantidadARestockear: cantidadARestockear,
          cantidadFaltante: cantidadFaltante,
          ubicacionesSugeridas: [],
          ubicacionDestino: master.ubicacion || undefined,
          alerta: cantidadFaltante > 0 
            ? `Faltante: ${cantidadFaltante} unidades` 
            : cantidadARestockear > 0 
              ? `Surtir ${cantidadARestockear} unidades` 
              : undefined,
          tieneStockSuficiente: cantidadARestockear === 0,
          tieneReservaPendiente: cantidadARestockear > 0,
          prioridadAlta: cantidadARestockear > cantidadVendida * 0.5,
          existeEnMaestra: masterMap.has(sku),
          ubicacionMaestra: master.ubicacion || ""
        });
        
        if (cantidadFaltante > 0) {
          missingProductsList.push({
            sku: String(sku),
            descripcion: String(master.descripcion),
            cantidadVendida: Number(cantidadVendida),
            cantidadFaltante: Number(cantidadFaltante)
          });
        }
      }
      
      // Ordenar por prioridad (mayor cantidad a restockear primero)
      suggestionsList.sort((a, b) => b.cantidadARestockear - a.cantidadARestockear);
      
      // Transformar al formato esperado por SurtidoInteligenteView
      const transformedSuggestions = suggestionsList.map((s: any) => ({
        ...s,
        ubicacionesSugeridas: s.ubicacionesSugeridas || []
      }));
      
      setSurtidoSuggestions(transformedSuggestions);
      setSuggestions(suggestionsList as any);
      setMissingProducts(missingProductsList);
      
      const skusConFaltante = missingProductsList.length;
      const skusPendientes = suggestionsList.filter((s: any) => s.cantidadARestockear > 0).length;
      
      toast({
        title: "✨ Surtido Inteligente Completado",
        description: `Se analizaron ${suggestionsList.length} SKUs. ${skusPendientes} requieren surtido, ${skusConFaltante} con faltante.`,
        className: "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
      });
      
      return true;
    } catch (error) {
      console.error("Error en Surtido Inteligente:", error);
      toast({
        variant: "destructive",
        title: "❌ Error en Surtido Inteligente",
        description: error instanceof Error ? error.message : "Error desconocido",
        className: "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleInboundAnalysis = async () => {
    const res = await runAnalysis("inbound", null, null, null, null, null, null, false, {
      rows: rawInbound!.rows,
      mapping: inboundMapping,
      fixedValues: inboundFixedValues,
    });
    if (res.error) throw new Error(res.error);
    if (res.data) setInboundResults((res.data as any).results);
    return res;
  };

  const handleShelfLifeAnalysis = async () => {
    const result = await runAnalysis("shelfLife", inventoryData, null, null, null, null, shelfLifeMasterData, false);
    if (result.error) throw new Error(result.error);
    if (result.data) {
      setShelfLifeResults((result.data as ShelfLifeResult).results);
      return result.data as ShelfLifeResult;
    }
    return null;
  };

  const handleInventoryAgeAnalysis = async () => {
    const result = await runAnalysis("inventoryAge", inventoryData, null, null, null, null, null, false);
    if (result.error) throw new Error(result.error);
    if (result.data) {
      setInventoryAgeResults((result.data as InventoryAgeResult).results);
      return result.data as InventoryAgeResult;
    }
    return null;
  };

  const handleStandardAnalysis = async () => {
    const result = await runAnalysis(
      analysisMode as any,
      inventoryData,
      salesData,
      minMaxData,
      analysisMode === "lotCross" ? sapLotData : sapData,
      analysisMode === "lotCross" ? wmsLotData : wmsData,
      shelfLifeMasterData,
      groupByLot,
    );
    if (result.error) throw new Error(result.error);
    return result.data;
  };

  const handleAnalyzeClick = async () => {
    if (!validateFilesForMode()) return;

    setIsLoading(true);
    resetResultsForMode(analysisMode);

    try {
      // Caso especial para Exportación de Inventario
      if (analysisMode === "exportInventory") {
        await handleExportInventoryAnalysis();
        setIsLoading(false);
        return;
      }

      // Caso especial para Surtido Inteligente
      if (analysisMode === "surtidoInteligente") {
        await handleSurtidoInteligenteAnalysisAction();
        setIsLoading(false);
        return;
      }

      if (analysisMode === "exitoLabels") {
        setExitoAnalyzeTrigger((prev) => prev + 1);
        setIsLoading(false);
        return;
      }

      if (analysisMode === "shelfLife") {
        const data = await handleShelfLifeAnalysis();
        if (data) {
          const expiredItems = data.results.filter((item) => !item.cumple).length;
          toast({
            title: "✨ Análisis Completado",
            description: `Se analizaron ${data.results.length} lotes. ${expiredItems} exceden la vida útil límite.`,
            className: "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
          });
        }
        setIsLoading(false);
        return;
      }

      if (analysisMode === "inventoryAge") {
        const data = await handleInventoryAgeAnalysis();
        if (data) {
          const oldItems = data.results.filter((item) => item.rangoEdad === "> 12 meses").length;
          toast({
            title: "✨ Análisis Completado",
            description: `Se analizaron ${data.results.length} pallets. ${oldItems} tienen más de 12 meses.`,
            className: "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
          });
        }
        setIsLoading(false);
        return;
      }

      if (analysisMode === "inbound") {
        const result = await handleInboundAnalysis();
        if (result) {
          toast({
            title: "✨ Análisis Completado",
            description: `Se procesaron ${(result.data as any).results?.length || 0} registros.`,
            className: "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
          });
        }
        setIsLoading(false);
        return;
      }

      const data = await handleStandardAnalysis();

      if (analysisMode === "cross") {
        setCrossResults(data as InventoryCrossResult);
        const totalDiff = (data as InventoryCrossResult).results.reduce((sum, item) => sum + Math.abs(item.diferencia), 0);
        toast({
          title: "✨ Análisis Completado",
          description: `Se encontraron ${(data as InventoryCrossResult).results.length} discrepancias. Diferencia total: ${totalDiff} unidades.`,
          className: "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
        });
      } else if (analysisMode === "lotCross") {
        setLotCrossResults(data as LotCrossResult);
        const diferentes = (data as LotCrossResult).results.filter((item) => item.estado === "DIFERENTE").length;
        toast({
          title: "✨ Cruce de lotes completado",
          description: `Se analizaron ${(data as LotCrossResult).results.length} SKU. ${diferentes} con lotes diferentes.`,
          className: "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
        });
      } else {
        setSuggestions((data as any).suggestions);
        setMissingProducts((data as any).missingProducts);

        let toastDescription = "";
        const actionableSuggestions = (data as any).suggestions?.filter((s: any) => s.cantidadARestockear > 0).length || 0;

        if (analysisMode === "levels") {
          toastDescription = actionableSuggestions > 0 
            ? `🎯 ${actionableSuggestions} oportunidades de surtido identificadas`
            : "✅ Niveles de stock óptimos - No se requieren ajustes";
        } else if (analysisMode === "sales") {
          if (actionableSuggestions > 0) toastDescription = `📈 ${actionableSuggestions} sugerencias de surtido generadas. `;
          if ((data as any).missingProducts?.length > 0) toastDescription += `⚠️ ${(data as any).missingProducts.length} productos sin stock`;
          if (toastDescription === "") toastDescription = "✅ Análisis completado - Sin discrepancias críticas";
        }

        toast({
          title: "✨ Análisis Completado",
          description: toastDescription,
          className: "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ Error en el análisis",
        description: error instanceof Error ? error.message : "Error desconocido",
        className: "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadReport = async () => {
    setIsDownloading(true);

    // Caso especial para Exportación de Inventario
    if (analysisMode === "exportInventory") {
      await handleExportInventoryDownload();
      setIsDownloading(false);
      return;
    }

    let result;
    if (analysisMode === "surtidoInteligente") {
      // Usar los datos locales para generar el Excel
      if (!surtidoSuggestions) {
        toast({
          variant: "destructive",
          title: "❌ Error",
          description: "No hay datos para exportar. Ejecuta el análisis primero.",
          className: "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
        });
        setIsDownloading(false);
        return;
      }
      
      // Generar Excel localmente con los datos de surtidoSuggestions
      try {
        // Crear hoja de cálculo simple
        const rows = [
          ["SKU", "Descripción", "Ventas", "Stock Disponible", "Stock Reserva", "A Restockear", "Faltante", "Estado"]
        ];
        
        surtidoSuggestions.forEach((s: any) => {
          rows.push([
            s.sku,
            s.descripcion,
            s.cantidadVendida,
            s.cantidadDisponiblePicking,
            s.cantidadEnReserva,
            s.cantidadARestockear,
            s.cantidadFaltante,
            s.tieneStockSuficiente ? "OK" : (s.cantidadFaltante > 0 ? "FALTANTE" : "PENDIENTE")
          ]);
        });
        
        // Convertir a CSV
        const csvContent = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `surtido_inteligente_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        toast({
          title: "📥 Reporte Descargado",
          description: "El archivo CSV se ha guardado en tu dispositivo",
          className: "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "❌ Error",
          description: "Error al generar el archivo",
          className: "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
        });
      }
      
      setIsDownloading(false);
      return;
    }

    result = await generateFullReportFile(
      suggestions,
      missingProducts,
      analysisMode as any,
      crossResults?.results,
      lotCrossResults?.results,
      shelfLifeResults,
      inventoryAgeResults,
    );
    setIsDownloading(false);

    if (result.error) {
      toast({
        variant: "destructive",
        title: "❌ Error",
        description: result.error,
        className: "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
      });
    } else if (result.data) {
      downloadFile(result.data.file, result.data.filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      toast({
        title: "📥 Reporte Descargado",
        description: "El archivo Excel se ha guardado en tu dispositivo",
        className: "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
      });
    }
  };

  const handleDownloadWMS = async () => {
    if (analysisMode === "inbound") {
      if (!inboundResults) return;
      setIsDownloading(true);
      const { file, filename } = await generateInboundExcel(inboundResults);
      setIsDownloading(false);
      downloadFile(file, filename, "application/vnd.ms-excel");
      toast({
        title: "📥 Archivo WMS Descargado",
        description: "El archivo se ha guardado en tu dispositivo",
        className: "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
      });
      return;
    }

    if (analysisMode === "shelfLife" || analysisMode === "inventoryAge" || analysisMode === "exportInventory") {
      toast({
        variant: "destructive",
        title: "❌ No aplicable",
        description: "Este módulo no genera archivos WMS.",
        className: "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
      });
      return;
    }

    if (!suggestions) {
      toast({
        variant: "destructive",
        title: "❌ Error",
        description: "No hay sugerencias de surtido para exportar.",
        className: "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
      });
      return;
    }

    setIsDownloading(true);
    const result = await generateWmsFiles(suggestions, analysisMode as "sales" | "levels");
    setIsDownloading(false);

    if (result.error) {
      toast({
        variant: "destructive",
        title: "❌ Error",
        description: result.error,
        className: "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
      });
    } else if (result.data) {
      downloadFile(result.data.file, result.data.filename, "application/vnd.ms-excel");
      toast({
        title: "📥 Archivo WMS Descargado",
        description: "El archivo WMS se ha guardado en tu dispositivo",
        className: "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
      });
    }
  };

  const hasResults = useMemo(() => {
    if (analysisMode === "cross") return !!crossResults;
    if (analysisMode === "lotCross") return !!lotCrossResults;
    if (analysisMode === "inbound") return !!inboundResults;
    if (analysisMode === "shelfLife") return !!shelfLifeResults;
    if (analysisMode === "inventoryAge") return !!inventoryAgeResults;
    if (analysisMode === "surtidoInteligente") return !!surtidoSuggestions;
    if (analysisMode === "exportInventory") return !!exportResults;
    return !!(suggestions || missingProducts);
  }, [suggestions, missingProducts, crossResults, lotCrossResults, inboundResults, analysisMode, shelfLifeResults, inventoryAgeResults, surtidoSuggestions, exportResults]);

  const isInModuleView = selectedModule !== null;

  const getModeIcon = (mode: AnalysisMode = analysisMode) => {
    switch (mode) {
      case "sales": return <TrendingUp className="h-5 w-5" />;
      case "levels": return <BarChart3 className="h-5 w-5" />;
      case "cross": return <GitCompare className="h-5 w-5" />;
      case "lotCross": return <Database className="h-5 w-5" />;
      case "inbound": return <Upload className="h-5 w-5" />;
      case "shelfLife": return <Clock className="h-5 w-5" />;
      case "inventoryAge": return <Clock className="h-5 w-5" />;
      case "exitoLabels": return <Tag className="h-5 w-5" />;
      case "surtidoInteligente": return <Sparkles className="h-5 w-5" />;
      case "exportInventory": return <Download className="h-5 w-5" />;
      default: return null;
    }
  };

  const getModeColor = (mode: AnalysisMode = analysisMode) => {
    switch (mode) {
      case "sales": return "from-blue-500 to-indigo-500";
      case "levels": return "from-emerald-500 to-teal-500";
      case "cross": return "from-slate-500 to-slate-600";
      case "lotCross": return "from-cyan-600 to-blue-600";
      case "inbound": return "from-amber-500 to-orange-500";
      case "shelfLife": return "from-red-500 to-red-600";
      case "inventoryAge": return "from-orange-500 to-amber-500";
      case "exitoLabels": return "from-[#7A1F3D] to-[#8F2548]";
      case "surtidoInteligente": return "from-indigo-500 to-blue-500";
      case "exportInventory": return "from-green-500 to-emerald-500";
      default: return "from-gray-500 to-gray-600";
    }
  };

  const getModeTitle = (mode: AnalysisMode = analysisMode): string => {
    switch (mode) {
      case "sales": return "Análisis por Ventas";
      case "levels": return "Surtido por Niveles";
      case "cross": return "Cruce SAP vs WMS";
      case "lotCross": return "Cruce Lotes SAP vs WMS";
      case "inbound": return "Entradas de Mercancía";
      case "shelfLife": return "Análisis de Vida Útil";
      case "inventoryAge": return "Antigüedad del Inventario";
      case "exitoLabels": return "Etiquetas Éxito";
      case "surtidoInteligente": return "Surtido Inteligente";
      case "exportInventory": return "Exportación de Inventario";
      default: return "Sin título";
    }
  };

  const getModeDescription = (mode: AnalysisMode = analysisMode): string => {
    switch (mode) {
      case "sales": return "Analiza ventas vs inventario para optimizar surtido";
      case "levels": return "Compara inventario actual con niveles mínimos y máximos";
      case "cross": return "Identifica discrepancias entre sistemas SAP y WMS";
      case "lotCross": return "Valida por SKU si los lotes de SAP coinciden con los lotes ingresados en WMS";
      case "inbound": return "Transforma archivos de proveedores a formato WMS";
      case "shelfLife": return "Evalúa lotes contra días mínimos de vida útil";
      case "inventoryAge": return "Clasifica pallets por antigüedad desde la fecha de entrada";
      case "exitoLabels": return "Genera etiquetas ZPL desde el Excel de pedidos Éxito";
      case "surtidoInteligente": return "Cruza ventas y stock, FEFO, alertas y sugerencias automáticas.";
      case "exportInventory": return "Compara inventario con maestra y sugiere movimientos a pasillos específicos (P10)";
      default: return "Sin descripción";
    }
  };

  const moduleCategories: {
    name: string;
    icon: React.ReactNode;
    color: string;
    modules: { key: string; title: string; desc: string; icon: React.ReactNode; color: string }[];
  }[] = [
    {
      name: "Inventarios",
      icon: <Warehouse className="h-5 w-5 text-blue-600" />,
      color: "from-blue-500 to-indigo-500",
      modules: [
        { key: "sales", title: getModeTitle("sales"), desc: getModeDescription("sales"), icon: <TrendingUp className="h-5 w-5 text-blue-500" />, color: "from-blue-400 to-indigo-400" },
        { key: "levels", title: getModeTitle("levels"), desc: getModeDescription("levels"), icon: <BarChart3 className="h-5 w-5 text-emerald-600" />, color: "from-emerald-500 to-teal-500" },
        { key: "cross", title: getModeTitle("cross"), desc: getModeDescription("cross"), icon: <GitCompare className="h-5 w-5 text-slate-600" />, color: "from-slate-500 to-slate-700" },
        { key: "inventoryAge", title: getModeTitle("inventoryAge"), desc: getModeDescription("inventoryAge"), icon: <Clock className="h-5 w-5 text-orange-500" />, color: "from-orange-400 to-amber-500" },
        { key: "shelfLife", title: getModeTitle("shelfLife"), desc: getModeDescription("shelfLife"), icon: <Clock className="h-5 w-5 text-red-600" />, color: "from-red-500 to-red-600" },
        { key: "surtidoInteligente", title: "Surtido Inteligente", desc: "Cruza ventas y stock, FEFO, alertas y sugerencias automáticas.", icon: <Sparkles className="h-5 w-5 text-indigo-500" />, color: "from-indigo-500 to-blue-500" },
        { key: "exportInventory", title: "Exportar Inventario", desc: "Compara inventario con maestra y sugiere movimientos a pasillos específicos (P10).", icon: <Download className="h-5 w-5 text-green-600" />, color: "from-green-500 to-green-600" },
      ],
    },
    {
      name: "Entradas",
      icon: <Upload className="h-5 w-5 text-amber-600" />,
      color: "from-amber-500 to-orange-500",
      modules: [
        { key: "inbound", title: getModeTitle("inbound"), desc: getModeDescription("inbound"), icon: <Upload className="h-5 w-5 text-amber-600" />, color: "from-amber-500 to-orange-500" },
        { key: "lotCross", title: getModeTitle("lotCross"), desc: getModeDescription("lotCross"), icon: <Database className="h-5 w-5 text-cyan-700" />, color: "from-cyan-600 to-blue-600" },
      ],
    },
    {
      name: "Etiquetas",
      icon: <Tag className="h-5 w-5 text-pink-800" />,
      color: "from-pink-800 to-pink-600",
      modules: [
        { key: "exitoLabels", title: getModeTitle("exitoLabels"), desc: getModeDescription("exitoLabels"), icon: <Tag className="h-5 w-5 text-pink-800" />, color: "from-pink-800 to-pink-600" },
      ],
    },
  ];

  const openModule = (mode: string) => {
    if (isAnalysisMode(mode)) {
      setAnalysisMode(mode);
      setSelectedModule(mode);
      resetResultsForMode(mode);
      setRawInbound(null);
      if (mode !== "exitoLabels") setExitoCanAnalyze(false);
    }
  };

  const backToModules = () => {
    setSelectedModule(null);
    resetResultsForMode(analysisMode);
  };

  // Determinar qué archivos mostrar según el modo
  const getFileUploadersForMode = () => {
    switch (analysisMode) {
      case "sales":
        return (
          <>
            <FileUploader title="Facturación (ERP)" onFileRead={(c) => handleFileRead(c, "sales")} onFileReset={() => handleFileReset("sales")} recordCount={salesData?.length} />
            <FileUploader title="Inventario (WMS)" onFileRead={(c) => handleFileRead(c, "inventory")} onFileReset={() => handleFileReset("inventory")} recordCount={inventoryData?.length} />
          </>
        );
      case "surtidoInteligente":
        return (
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(380px, 1fr))',
            gap: '30px',
            width: '203%',
            alignItems: 'start'
          }}>
            <FileUploader 
              title="Ventas Surtido (ERP)" 
              onFileRead={(c) => handleFileRead(c, "surtidoSales")} 
              onFileReset={() => handleFileReset("surtidoSales")} 
              recordCount={surtidoSalesData?.length} 
            />
            <FileUploader 
              title="Stock Surtido (WMS)" 
              onFileRead={(c) => handleFileRead(c, "surtidoInventory")} 
              onFileReset={() => handleFileReset("surtidoInventory")} 
              recordCount={surtidoInventoryData?.length} 
            />
            <FileUploader 
              title="Maestra de Materiales" 
              onFileRead={(c) => handleFileRead(c, "surtidoMaterialMaster")} 
              onFileReset={() => handleFileReset("surtidoMaterialMaster")} 
              recordCount={surtidoMaterialMaster?.length} 
            />
          </div>
        );
      case "exportInventory":
        return (
          <>
            <FileUploader title="Maestra de Exportación (Cod → Referencia)" onFileRead={(c) => handleFileRead(c, "exportMaterialInventory")} onFileReset={() => handleFileReset("exportMaterialInventory")} recordCount={exportMasterData?.length}/>
            <FileUploader title="Inventario Actual (WMS)" onFileRead={(c) => handleFileRead(c, "exportInventory")}  onFileReset={() => handleFileReset("exportInventory")} recordCount={exportInventoryData?.length}/>
          </>
        );
      case "levels":
        return (
          <>
            <FileUploader title="Inventario (WMS)" onFileRead={(c) => handleFileRead(c, "inventory")} onFileReset={() => handleFileReset("inventory")} recordCount={inventoryData?.length} />
            <FileUploader title="Niveles (Mín/Máx)" onFileRead={(c) => handleFileRead(c, "minMax")} onFileReset={() => handleFileReset("minMax")} recordCount={minMaxData?.length} />
          </>
        );
      case "cross":
        return (
          <>
            <FileUploader title="Inventario (SAP)" onFileRead={(c) => handleFileRead(c, "sap")} onFileReset={() => handleFileReset("sap")} recordCount={sapData?.length} />
            <FileUploader title="Inventario (WMS)" onFileRead={(c) => handleFileRead(c, "wms")} onFileReset={() => handleFileReset("wms")} recordCount={wmsData?.length} />
          </>
        );
      case "lotCross":
        return (
          <>
            <FileUploader title="Entrada (SAP)" onFileRead={(c) => handleFileRead(c, "sapLot")} onFileReset={() => handleFileReset("sapLot")} recordCount={sapLotData?.length} />
            <FileUploader title="Albarán (WMS)" onFileRead={(c) => handleFileRead(c, "wmsLot")} onFileReset={() => handleFileReset("wmsLot")} recordCount={wmsLotData?.length} />
          </>
        );
      case "inbound":
        return (
          <div className="col-span-full w-full">
            <FileUploader title="Archivo Fuente de Proveedor" onFileRead={(c) => handleFileRead(c, "inbound")} onFileReset={() => handleFileReset("inbound")} recordCount={rawInbound?.rows.length} />
          </div>
        );
      case "shelfLife":
        return (
          <>
            <FileUploader title="Inventario (WMS)" onFileRead={(c) => handleFileRead(c, "inventory")} onFileReset={() => handleFileReset("inventory")} recordCount={inventoryData?.length} />
            <FileUploader title="Maestra Vida Útil (FPC)" onFileRead={(c) => handleFileRead(c, "shelfLife")} onFileReset={() => handleFileReset("shelfLife")} recordCount={shelfLifeMasterData?.length} />
          </>
        );
      case "inventoryAge":
        return (
          <div className="col-span-full w-full">
            <FileUploader title="Inventario (WMS) con Fecha de Entrada" onFileRead={(c) => handleFileRead(c, "inventory")} onFileReset={() => handleFileReset("inventory")} recordCount={inventoryData?.length} />
          </div>
        );
      default:
        return null;
    }
  };

  const isAnalyzeDisabled = () => {
    if (isLoading) return true;
    if (analysisMode === "exitoLabels") return !exitoCanAnalyze;
    if (analysisMode === "inbound") return !rawInbound;
    if (analysisMode === "sales") return !salesData || !inventoryData;
    if (analysisMode === "levels") return !inventoryData || !minMaxData;
    if (analysisMode === "cross") return !sapData || !wmsData;
    if (analysisMode === "lotCross") return !sapLotData || !wmsLotData;
    if (analysisMode === "shelfLife") return !inventoryData || !shelfLifeMasterData;
    if (analysisMode === "inventoryAge") return !inventoryData;
    if (analysisMode === "surtidoInteligente") return !surtidoSalesData || !surtidoInventoryData || !surtidoMaterialMaster;
    if (analysisMode === "exportInventory") return !exportMasterData || !exportInventoryData;
    return false;
  };

  const renderResults = () => {
    // Vista especial para Exportación de Inventario
    if (analysisMode === "exportInventory" && exportResults) {
      return (
        <div>
          <div className="overflow-hidden rounded-xl border border-green-200 bg-green-50/50 shadow-inner">
            <ExportacionesTable 
            resultados={exportResults}
            isLoading={isLoading}
            onRefresh={handleExportInventoryAnalysis}
          />
          </div>
        </div>
      );
    }

    // Vista especial para Surtido Inteligente
    if (analysisMode === "surtidoInteligente" && surtidoSuggestions) {
      return (
        <div>
          <div className="overflow-hidden rounded-xl border border-indigo-200 bg-indigo-50/50 shadow-inner">
            <SurtidoInteligenteView 
              suggestions={surtidoSuggestions} 
              isLoading={isLoading}
              onRefresh={handleAnalyzeClick}
            />
          </div>
        </div>
      );
    }

    if (analysisMode === "shelfLife" && shelfLifeResults) {
      return (
        <div>
          <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/50 shadow-inner">
            <ShelfLifeTable data={shelfLifeResults} />
          </div>
        </div>
      );
    }

    if (analysisMode === "inventoryAge" && inventoryAgeResults) {
      return (
        <div>
          <div className="overflow-hidden rounded-xl border border-orange-200 bg-orange-50/50 shadow-inner">
            <InventoryAgeTable data={inventoryAgeResults} />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {missingProducts && missingProducts.length > 0 && analysisMode !== "shelfLife" && analysisMode !== "inventoryAge" && analysisMode !== "surtidoInteligente" && (
          <div>
            <div className="overflow-hidden rounded-xl border border-rose-200 bg-rose-50/50 shadow-inner">
              <MissingStockTable products={missingProducts} />
            </div>
          </div>
        )}

        {suggestions && suggestions.length > 0 && analysisMode !== "shelfLife" && analysisMode !== "inventoryAge" && analysisMode !== "surtidoInteligente" && (
          <div>
            <div className="overflow-hidden rounded-xl border border-blue-200 bg-blue-50/50 shadow-inner">
              <ResultsTable results={suggestions} analysisMode={analysisMode as any} />
            </div>
          </div>
        )}

        {crossResults && analysisMode === "cross" && (
          <div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50 shadow-inner">
              <InventoryCrossTable data={crossResults} />
            </div>
          </div>
        )}

        {lotCrossResults && analysisMode === "lotCross" && (
          <div>
            <div className="overflow-hidden rounded-xl border border-cyan-200 bg-cyan-50/40 shadow-inner">
              <LotCrossTable data={lotCrossResults} />
            </div>
          </div>
        )}

        {inboundResults && analysisMode === "inbound" && (
          <InboundResultsTable data={inboundResults} />
        )}
      </div>
    );
  };

  const renderEmptyState = () => {
    const titles: Record<AnalysisMode, string> = {
      cross: "¡Listo para cruzar sistemas!",
      lotCross: "Compara lotes entre SAP y WMS",
      sales: "Analiza tus ventas e inventario",
      levels: "Optimiza tus niveles de stock",
      inbound: "Mapea tus entradas de mercancía",
      shelfLife: "Analiza la vida útil de tu inventario",
      inventoryAge: "Analiza la antigüedad de tu inventario",
      exitoLabels: "Genera etiquetas Éxito",
      surtidoInteligente: "Analiza ventas y stock para surtido inteligente",
      exportInventory: "Exportación de Inventario - Pasillo P10",
    };

    const descriptions: Record<AnalysisMode, string> = {
      cross: "Sube los archivos SAP y WMS para identificar discrepancias",
      lotCross: "Carga la entrada SAP y el albarán WMS para validar si cada SKU conserva el mismo lote",
      sales: "Carga los datos de facturación e inventario para obtener sugerencias",
      levels: "Sube el inventario actual y los parámetros mín/máx",
      inbound: "Carga el archivo del proveedor para transformarlo al formato WMS",
      shelfLife: "Carga el inventario WMS y la maestra de vida útil para evaluar lotes",
      inventoryAge: "Carga el inventario WMS con fecha de entrada para clasificar pallets por edad",
      exitoLabels: "Carga el archivo de pedidos Éxito para generar etiquetas ZPL",
      surtidoInteligente: "Carga ventas y stock para obtener sugerencias automáticas",
      exportInventory: "Carga la maestra de exportación (Código → Referencia) y el inventario actual para analizar movimientos al pasillo P10",
    };

    return (
      <div className="flex h-[400px] flex-col items-center justify-center gap-8 text-slate-500">
        <div className="relative">
          <Warehouse className="h-32 w-32 text-slate-300" />
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-slate-100 to-slate-200 blur-xl"></div>
        </div>
        <div className="max-w-md space-y-3 text-center">
          <h3 className="bg-gradient-to-r from-slate-700 to-slate-500 bg-clip-text text-2xl font-bold text-transparent">
            {titles[analysisMode] || getModeTitle()}
          </h3>
          <p className="text-slate-500">{descriptions[analysisMode] || getModeDescription()}</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-blue-400"></div>
            <div className="delay-100 h-2 w-2 animate-pulse rounded-full bg-emerald-400"></div>
            <div className="delay-200 h-2 w-2 animate-pulse rounded-full bg-slate-400"></div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <TooltipProvider>
      <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-gradient-to-br from-[#f7f9fc] via-[#fdfdff] to-[#eef3ff]">
        <div className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-cyan-200/40 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-blue-200/30 blur-3xl" />

        <header className="sticky top-0 z-50 flex h-20 items-center justify-between border-b border-slate-200/70 bg-white/80 px-4 backdrop-blur-xl md:px-8">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 opacity-60 blur-md" />
              <Logo className="relative z-10 h-10 w-10 text-blue-600" />
            </div>
            <div>
              <h1 className="font-headline text-lg font-bold text-slate-800 md:text-xl">Surtido Inteligente</h1>
              <p className="text-xs text-slate-500">v0.1.0 | Blas Rangel Jimenz</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isInModuleView && (
              <div className="flex items-center gap-3">
                <Button
                  onClick={backToModules}
                  variant="ghost"
                  className={cn("p-0 rounded-full text-white hover:scale-105 transition-transform shadow-md border-2 w-14 h-14 flex items-center justify-center text-3xl", "bg-gradient-to-r", getModeColor(), "border-0")}
                  aria-label="Volver al inicio"
                >
                  <ArrowLeft className="h-8 w-8" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="rounded-lg border border-blue-400 bg-white px-4 py-2 font-medium text-blue-700 shadow-sm transition-all duration-300 hover:bg-blue-50 hover:shadow-md active:scale-95 flex items-center gap-2">
                      <span className="sm:inline">Cambiar módulo</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur-sm" align="end">
                    <DropdownMenuLabel className="px-3 py-2 text-sm font-bold text-slate-800">Selecciona un módulo</DropdownMenuLabel>
                    <DropdownMenuSeparator className="my-2 bg-slate-200" />
                    {moduleCategories.map((cat) => (
                      <div key={cat.name}>
                        <div className="flex items-center gap-2 px-3 py-1 text-xs font-semibold text-slate-500">
                          <span className={cn("rounded p-1 text-white", cat.color)}>{cat.icon}</span>
                          <span>{cat.name}</span>
                        </div>
                        {cat.modules.map((mod) => (
                          <DropdownMenuItem
                            key={mod.key}
                            onClick={() => {
                              if (isAnalysisMode(mod.key)) {
                                setAnalysisMode(mod.key);
                                setSelectedModule(mod.key);
                              }
                              resetResultsForMode(mod.key);
                              setRawInbound(null);
                              if (mod.key !== "exitoLabels") setExitoCanAnalyze(false);
                            }}
                            className="flex items-center gap-2 px-6 py-2 rounded-lg cursor-pointer hover:bg-blue-50 text-slate-700"
                          >
                            <span className={cn("rounded p-1", mod.color)}>{mod.icon}</span>
                            <span className="text-sm">{mod.title}</span>
                          </DropdownMenuItem>
                        ))}
                      </div>
                    ))}
                    <DropdownMenuSeparator className="my-2 bg-slate-200" />
                    <DropdownMenuItem onClick={backToModules} className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-100 text-slate-600 font-semibold">
                      <ArrowLeft className="h-4 w-4" />
                      <span>Volver al inicio</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {isInModuleView && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleAnalyzeClick}
                    disabled={isAnalyzeDisabled()}
                    className={cn("group relative rounded-lg bg-gradient-to-r px-5 py-2 font-semibold text-white shadow-lg transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed", getModeColor())}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                        <span className="hidden sm:inline">Procesando...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCcw className="mr-2 inline h-4 w-4 transition-transform group-hover:rotate-180 duration-500" />
                        <span className="hidden sm:inline">Actualizar</span>
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Ejecutar o actualizar análisis del módulo actual</p>
                </TooltipContent>
              </Tooltip>
            )}

            {isInModuleView && hasResults && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    disabled={isDownloading}
                    className="group relative rounded-lg border-2 border-emerald-500 bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2 font-semibold text-white shadow-lg transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDownloading ? (
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Download className="mr-2 inline h-4 w-4 transition-transform group-hover:translate-y-0.5" />
                        <span className="hidden font-semibold sm:inline">Descargar</span>
                        <ChevronDown className="ml-2 inline h-4 w-4 transition-transform group-hover:rotate-180 duration-300" />
                      </>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-80 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur-sm" align="end">
                  <DropdownMenuLabel className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-slate-800">
                    <div className="rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 p-1.5">
                      <Download className="h-4 w-4 text-white" />
                    </div>
                    Opciones de Descarga
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="my-2 bg-slate-200" />

                  <DropdownMenuGroup className="space-y-1.5">
                    {analysisMode !== "inbound" && analysisMode !== "exportInventory" && (
                      <DropdownMenuItem onClick={handleDownloadReport} className="group flex cursor-pointer items-center gap-4 rounded-lg px-3 py-3 transition-all duration-200 hover:bg-blue-50 active:bg-blue-100">
                        <div className="rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 p-2 shadow-md transition-all group-hover:scale-110 duration-200">
                          <FileSpreadsheet className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-800">Reporte Completo</p>
                          <p className="text-xs text-slate-500">Análisis detallado en Excel</p>
                        </div>
                        <Badge className="bg-blue-100 text-blue-700 text-xs">Nuevo</Badge>
                      </DropdownMenuItem>
                    )}

                    {analysisMode === "exportInventory" && exportResults && (
                      <DropdownMenuItem onClick={handleExportInventoryDownload} className="group flex cursor-pointer items-center gap-4 rounded-lg px-3 py-3 transition-all duration-200 hover:bg-green-50 active:bg-green-100">
                        <div className="rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 p-2 shadow-md transition-all group-hover:scale-110 duration-200">
                          <FileSpreadsheet className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-800">Exportar Inventario</p>
                          <p className="text-xs text-slate-500">Reporte con movimientos sugeridos</p>
                        </div>
                        <Badge className="bg-green-100 text-green-700 text-xs">Recomendado</Badge>
                      </DropdownMenuItem>
                    )}

                    {analysisMode !== "shelfLife" && analysisMode !== "cross" && analysisMode !== "lotCross" && analysisMode !== "surtidoInteligente" && analysisMode !== "exportInventory" && (
                      <DropdownMenuItem onClick={handleDownloadWMS} className="group flex cursor-pointer items-center gap-4 rounded-lg px-3 py-3 transition-all duration-200 hover:bg-emerald-50 active:bg-emerald-100">
                        <div className="rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 p-2 shadow-md transition-all group-hover:scale-110 duration-200">
                          <FileText className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-800">{analysisMode === "inbound" ? "Plantilla Entradas WMS" : "Archivo WMS"}</p>
                          <p className="text-xs text-slate-500">Formato para sistema de almacén</p>
                        </div>
                      </DropdownMenuItem>
                    )}

                    {(analysisMode === "sales" || analysisMode === "levels") && (
                      <>
                        <DropdownMenuSeparator className="my-2 bg-slate-200" />
                        <DropdownMenuItem onClick={handleDownloadReport} className="group flex cursor-pointer items-center gap-4 rounded-lg border-2 border-slate-300 bg-gradient-to-r from-slate-50 to-slate-100 px-3 py-3 transition-all duration-200 hover:from-slate-100 hover:to-slate-200 active:scale-95">
                          <div className="rounded-lg bg-gradient-to-r from-slate-600 to-slate-700 p-2 shadow-md transition-all group-hover:scale-110 duration-200">
                            <Download className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-slate-800">Descargar Ambos ⚡</p>
                            <p className="text-xs text-slate-600">Reporte + WMS simultáneamente</p>
                          </div>
                          <Badge className="animate-pulse bg-gradient-to-r from-slate-600 to-slate-700 text-white text-xs px-2">Recomendado</Badge>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>

        <main className={cn("relative z-10 mx-auto w-full flex-1 space-y-8 p-4 md:p-8", isInModuleView ? "max-w-none" : "max-w-7xl", !isInModuleView && "lg:h-[calc(100vh-5rem)] lg:overflow-hidden")}>
          {!isInModuleView ? (
            <>
              <div className="grid gap-6 lg:h-full lg:grid-cols-[1.05fr_1fr] lg:items-stretch">
                <Card className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 shadow-2xl backdrop-blur-sm lg:h-full">
                  <CardContent className="p-6 md:p-8 lg:h-full lg:flex lg:flex-col lg:gap-6">
                    <div className="space-y-5">
                      <div className="flex w-full justify-center md:justify-start">
                        <Badge className="w-fit bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md px-3 py-1 text-xs md:text-sm">✨ Plataforma Inteligente</Badge>
                      </div>
                      <div className="space-y-3">
                        <h2 className="text-3xl font-black leading-tight text-slate-900 md:text-4xl lg:text-5xl">
                          Centro de Operaciones{" "}
                          <span className="bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">Logísticas</span>
                        </h2>
                        <p className="max-w-2xl text-sm text-slate-600 md:text-base lg:text-lg">
                          Ejecuta análisis de surtido, cruces de inventario, transformación de entradas, exportación de inventario y generación de etiquetas en un flujo modular, rápido y listo para operación diaria.
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-xl lg:mt-0">
                      <div className="mb-4 flex items-center gap-2 text-slate-800">
                        <div className="rounded-lg bg-gradient-to-r from-indigo-500 to-blue-500 p-1.5">
                          <Sparkles className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-sm font-bold">Comienza en 3 pasos</span>
                      </div>
                      <ol className="space-y-3 text-sm text-slate-700">
                        <li className="flex items-start gap-3">
                          <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 text-xs font-bold text-white">1</div>
                          <span>Selecciona un módulo de análisis.</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-xs font-bold text-white">2</div>
                          <span>Carga tus archivos en la vista.</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-xs font-bold text-white">3</div>
                          <span>Actualiza y descarga resultados.</span>
                        </li>
                      </ol>
                    </div>

                    <div className="hidden flex-1 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70 shadow-inner lg:block">
                      <img src="/logistics-hero.png" alt="Ilustracion de logistica con almacen, transporte y flujo operativo" className="h-full w-full object-cover" />
                    </div>
                  </CardContent>
                </Card>

                <Accordion type="single" collapsible className="w-full space-y-3">
                  {moduleCategories.map((cat) => (
                    <AccordionItem key={cat.name} value={cat.name} className="rounded-2xl border border-slate-200 bg-white/85 shadow-lg">
                      <AccordionTrigger className="px-6 py-4 text-lg font-bold flex items-center gap-3">
                        <span className={cn("rounded-lg p-2 text-white", cat.color)}>{cat.icon}</span>
                        <span>{cat.name}</span>
                      </AccordionTrigger>
                      <AccordionContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
                        {cat.modules.map((mod) => (
                          isAnalysisMode(mod.key) && (
                            <button
                              key={mod.key}
                              type="button"
                              onClick={() => openModule(mod.key)}
                              className={cn("group relative overflow-hidden rounded-2xl border border-slate-200 shadow-lg transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 active:scale-95", `bg-gradient-to-br ${mod.color}`)}
                            >
                              <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-5" />
                              <div className="relative p-4 md:p-5">
                                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                                  <div className={cn("rounded-xl bg-white/30 p-2.5 text-white shadow-lg transition-all duration-300 group-hover:scale-110")}>{mod.icon}</div>
                                  <div className="flex-1 flex justify-end min-w-[80px]">
                                    <Badge variant="outline" className="bg-white/70 px-2 py-1 text-[10px] md:text-xs font-semibold text-slate-700 whitespace-nowrap text-center max-w-full overflow-hidden text-ellipsis">SUBMÓDULO</Badge>
                                  </div>
                                </div>
                                <h3 className="mb-1.5 text-base font-bold text-white drop-shadow transition-all duration-200 group-hover:text-slate-100 md:text-lg">{mod.title}</h3>
                                <p className="line-clamp-2 text-xs text-white/90 drop-shadow transition-colors duration-200 group-hover:text-slate-100 md:text-sm">{mod.desc}</p>
                                <div className="mt-3 flex items-center gap-2 opacity-0 transition-all duration-300 group-hover:opacity-100">
                                  <span className="text-xs font-semibold text-white/90">Acceder</span>
                                  <ArrowLeft className="h-3 w-3 rotate-180 text-white/80 transition-transform group-hover:translate-x-1" />
                                </div>
                              </div>
                              <div className={cn("h-1 w-full bg-white/30 transition-all duration-300 group-hover:h-1.5")} />
                            </button>
                          )
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={cn("rounded-lg bg-gradient-to-r p-2 text-white", getModeColor())}>{getModeIcon()}</div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-700">Modo: {getModeTitle()}</h2>
                    <p className="text-xs text-slate-500">{getModeDescription()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    <Activity className="mr-1 h-3 w-3" />
                    En Curso 🟢
                  </Badge>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
                {getFileUploadersForMode()}
              </div>

              {analysisMode === "cross" && (
                <div className="group flex w-fit items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-md transition-all duration-200 hover:shadow-lg active:scale-95">
                  <Switch checked={groupByLot} onCheckedChange={setGroupByLot} id="lot-toggle" className="h-6 w-11 data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-emerald-500 data-[state=checked]:to-green-500" />
                  <Label htmlFor="lot-toggle" className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700 transition-colors group-hover:text-slate-900">
                    <Layers className="h-4 w-4 text-slate-600" />
                    <span>Agrupar por Lote</span>
                  </Label>
                </div>
              )}

              {analysisMode === "exitoLabels" && (
                <ExitoLabelsView analyzeTrigger={exitoAnalyzeTrigger} onCanAnalyzeChange={setExitoCanAnalyze} onAnalyzeFinished={() => setIsLoading(false)} />
              )}

              {analysisMode !== "exitoLabels" && (
                <Card className="min-h-[500px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <div className={cn("h-1.5 w-full bg-gradient-to-r", getModeColor())}></div>
                  <CardContent className="p-6 md:p-8">
                    {isLoading ? (
                      <div className="flex h-[400px] flex-col items-center justify-center gap-6">
                        <div className="relative">
                          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 to-indigo-400 opacity-30 blur-xl"></div>
                          <RefreshCcw className="relative z-10 h-16 w-16 animate-spin text-blue-500" />
                        </div>
                        <div className="space-y-3 text-center">
                          <p className="bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-2xl font-bold text-transparent">Procesando datos...</p>
                          <p className="text-slate-500">Analizando patrones y generando perspectivas</p>
                          <Progress value={65} className={cn("h-2 w-64", getModeColor())} />
                        </div>
                      </div>
                    ) : hasResults ? (
                      renderResults()
                    ) : analysisMode === "inbound" && rawInbound ? (
                      <InboundMapper headers={rawInbound.headers} rows={rawInbound.rows} onMappingChange={(map, fixed) => { setInboundMapping(map); setInboundFixedValues(fixed); }} />
                    ) : (
                      renderEmptyState()
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}