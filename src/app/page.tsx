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
} from "./config";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type AnalysisMode =
  | "sales"
  | "levels"
  | "cross"
  | "lotCross"
  | "inbound"
  | "shelfLife"
  | "inventoryAge"
  | "exitoLabels";

export default function Home() {
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("sales");
  const [selectedModule, setSelectedModule] = useState<AnalysisMode | null>(
    null,
  );
  const [salesData, setSalesData] = useState<any[] | null>(null);
  const [inventoryData, setInventoryData] = useState<any[] | null>(null);
  const [minMaxData, setMinMaxData] = useState<any[] | null>(null);
  const [sapData, setSapData] = useState<any[] | null>(null);
  const [wmsData, setWmsData] = useState<any[] | null>(null);
  const [sapLotData, setSapLotData] = useState<any[] | null>(null);
  const [wmsLotData, setWmsLotData] = useState<any[] | null>(null);
  const [shelfLifeMasterData, setShelfLifeMasterData] = useState<any[] | null>(
    null,
  );
  const [groupByLot, setGroupByLot] = useState(true);

  // Estados específicos para Entradas (Inbound)
  const [rawInbound, setRawInbound] = useState<{
    headers: string[];
    rows: any[];
  } | null>(null);
  const [inboundMapping, setInboundMapping] = useState<Record<string, string>>(
    {},
  );
  const [inboundFixedValues, setInboundFixedValues] = useState<
    Record<string, string>
  >({});
  const [inboundResults, setInboundResults] = useState<any[] | null>(null);

  const [suggestions, setSuggestions] =
    useState<GenerateRestockSuggestionsOutput | null>(null);
  const [missingProducts, setMissingProducts] = useState<
    MissingProductsOutput[] | null
  >(null);
  const [crossResults, setCrossResults] = useState<InventoryCrossResult | null>(
    null,
  );
  const [lotCrossResults, setLotCrossResults] = useState<LotCrossResult | null>(
    null,
  );
  const [shelfLifeResults, setShelfLifeResults] = useState<any[] | null>(null);
  const [inventoryAgeResults, setInventoryAgeResults] = useState<any[] | null>(
    null,
  );

  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [exitoAnalyzeTrigger, setExitoAnalyzeTrigger] = useState(0);
  const [exitoCanAnalyze, setExitoCanAnalyze] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "ascending" | "descending";
  } | null>(null);
  const { toast } = useToast();

  // Función auxiliar para resetear resultados según el modo actual
  const resetResultsForMode = (mode: string) => {
    console.log(`🔄 Resetando resultados para modo: ${mode}`);

    // Siempre resetear todos los resultados comunes
    setSuggestions(null);
    setMissingProducts(null);
    setCrossResults(null);
    setLotCrossResults(null);
    setSortConfig(null);
    setShelfLifeResults(null);
    setInventoryAgeResults(null);

    // Resetear resultados específicos de inbound
    if (mode === "inbound") {
      setInboundResults(null);
      setInboundMapping({});
      setInboundFixedValues({});
    }
  };

  const handleFileRead = (content: string | ArrayBuffer, type: string) => {
    try {
      // Manejo especial para modo Inbound (Carga cruda para mapeo posterior)
      if (type === "inbound") {
        const res = parseRawData(content);
        setRawInbound(res);

        // IMPORTANTE: Resetear resultados de inbound al cargar un nuevo archivo
        setInboundResults(null);
        setInboundMapping({});
        setInboundFixedValues({});

        const recordCount = res?.rows?.length || 0;
        toast({
          title: "✅ Archivo Cargado",
          description: `Se cargaron ${recordCount} registros correctamente.\nAhora vincula las columnas para procesar.`,
          className:
            "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
        });
        return;
      }

      let mapping;
      let numericCols: string[] = [];
      if (type === "sales") {
        mapping = salesColumnMapping;
        numericCols = ["cantidadConfirmada"];
      } else if (type === "inventory" || type === "inventoryWms") {
        mapping = inventoryColumnMapping;
        numericCols = ["disponible", "diasFPC"];
      } else if (type === "minMax") {
        mapping = minMaxColumnMapping;
        numericCols = ["cantidadMinima", "cantidadMaxima"];
      } else if (type === "sap") {
        mapping = sapInventoryMapping;
        numericCols = ["cantidad"];
      } else if (type === "sapLot") {
        mapping = sapLotCrossMapping;
        numericCols = ["cantidad"];
      } else if (type === "shelfLife") {
        mapping = shelfLifeColumnMapping;
        numericCols = ["diasMinimos"];
      } else if (type === "wmsLot") {
        mapping = wmsLotCrossMapping;
        numericCols = ["cantidad"];
      } else if (type === "wms") {
        mapping = wmsInventoryCrossMapping;
        numericCols = ["cantidad"];
      } else {
        throw new Error(`Tipo de archivo no soportado: ${type}`);
      }

      const data = parseData(content, mapping, numericCols);
      const recordCount = data.length;

      if (recordCount === 0) {
        toast({
          variant: "destructive",
          title: "❌ Archivo Vacío o Inválido",
          description:
            "El archivo no contiene datos o el formato es incorrecto.",
          className:
            "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
        });
        return;
      }

      // Actualizar el estado correspondiente
      if (type === "sales") {
        setSalesData(data);
        // Si estamos en modo sales, resetear resultados al cargar un nuevo archivo
        if (analysisMode === "sales") {
          resetResultsForMode(analysisMode);
        }
      } else if (type === "inventory" || type === "inventoryWms") {
        setInventoryData(data);
        // Resetear resultados si estamos en modo sales, levels o shelfLife (que usan inventoryData)
        if (
          analysisMode === "sales" ||
          analysisMode === "levels" ||
          analysisMode === "shelfLife" ||
          analysisMode === "inventoryAge"
        ) {
          resetResultsForMode(analysisMode);
        }
      } else if (type === "minMax") {
        setMinMaxData(data);
        // Resetear resultados si estamos en modo levels
        if (analysisMode === "levels") {
          resetResultsForMode(analysisMode);
        }
      } else if (type === "sap") {
        setSapData(data);
        // Resetear resultados si estamos en modo cross
        if (analysisMode === "cross") {
          resetResultsForMode(analysisMode);
        }
      } else if (type === "sapLot") {
        setSapLotData(data);
        if (analysisMode === "lotCross") {
          resetResultsForMode(analysisMode);
        }
      } else if (type === "wms") {
        setWmsData(data);
        // Resetear resultados si estamos en modo cross
        if (analysisMode === "cross") {
          resetResultsForMode(analysisMode);
        }
      } else if (type === "wmsLot") {
        setWmsLotData(data);
        if (analysisMode === "lotCross") {
          resetResultsForMode(analysisMode);
        }
      } else if (type === "shelfLife") {
        setShelfLifeMasterData(data);
        // Resetear resultados si estamos en modo shelfLife
        if (analysisMode === "shelfLife") {
          resetResultsForMode(analysisMode);
        }
      }

      toast({
        title: "✅ Archivo Cargado",
        description: `Se cargaron ${recordCount} registros correctamente.`,
        className:
          "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ Error al procesar el archivo",
        description:
          error instanceof Error ? error.message : "Error desconocido",
        className:
          "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
      });
    }
  };

  // Nueva función para manejar el reseteo de archivos
  const handleFileReset = (type: string) => {
    console.log(`🗑️ Archivo eliminado: ${type}`);

    // Resetear el estado del archivo específico
    if (type === "sales") {
      setSalesData(null);
    } else if (type === "inventory") {
      setInventoryData(null);
    } else if (type === "minMax") {
      setMinMaxData(null);
    } else if (type === "sap") {
      setSapData(null);
    } else if (type === "sapLot") {
      setSapLotData(null);
    } else if (type === "wms") {
      setWmsData(null);
    } else if (type === "wmsLot") {
      setWmsLotData(null);
    } else if (type === "shelfLife") {
      setShelfLifeMasterData(null);
    } else if (type === "inbound") {
      setRawInbound(null);
    }

    // Resetear resultados según el modo actual
    resetResultsForMode(analysisMode);

    // Mostrar notificación opcional
    toast({
      title: "🔄 Archivo eliminado",
      description: "Los resultados han sido restablecidos.",
      className:
        "bg-gradient-to-r from-slate-400 to-slate-500 text-white border-0 shadow-lg",
      duration: 2000,
    });
  };

  const handleAnalyzeClick = async () => {
    if (analysisMode === "exitoLabels") {
      if (!exitoCanAnalyze) {
        return toast({
          variant: "destructive",
          title: "❌ Falta archivo",
          description:
            "Carga el archivo de pedidos Éxito antes de ejecutar el análisis.",
          className:
            "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
        });
      }

      setIsLoading(true);
      setExitoAnalyzeTrigger((prev) => prev + 1);
      return;
    }

    // Validación para modo Inbound
    if (analysisMode === "inbound") {
      if (!rawInbound) {
        return toast({
          variant: "destructive",
          title: "❌ Falta archivo",
          description: "Carga el archivo del proveedor para continuar.",
          className:
            "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
        });
      }
      setIsLoading(true);
      const res = await runAnalysis(
        "inbound",
        null,
        null,
        null,
        null,
        null,
        null,
        false,
        {
          rows: rawInbound.rows,
          mapping: inboundMapping,
          fixedValues: inboundFixedValues,
        },
      );
      setIsLoading(false);
      if (res.error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: res.error,
          className: "bg-rose-500 text-white border-0 shadow-lg",
        });
      } else if (res.data) {
        setInboundResults((res.data as any).results);
        toast({
          title: "✨ Entrada Procesada",
          description: "La información ha sido transformada.",
          className:
            "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
        });
      }
      return;
    }

    // Validación para modo Shelf Life
    if (analysisMode === "shelfLife") {
      if (!inventoryData || !shelfLifeMasterData) {
        return toast({
          variant: "destructive",
          title: "❌ Faltan archivos",
          description:
            "Carga el inventario y la maestra de vida útil para continuar.",
          className:
            "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
        });
      }
      setIsLoading(true);
      setShelfLifeResults(null);

      const result = await runAnalysis(
        "shelfLife",
        inventoryData,
        null,
        null,
        null,
        null,
        shelfLifeMasterData,
        false,
      );

      setIsLoading(false);

      if (result.error) {
        toast({
          variant: "destructive",
          title: "❌ Error en el análisis",
          description: result.error,
          className:
            "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
        });
      } else if (result.data) {
        setShelfLifeResults((result.data as ShelfLifeResult).results);
        const totalItems = (result.data as ShelfLifeResult).results.length;
        const expiredItems = (result.data as ShelfLifeResult).results.filter(
          (item) => !item.cumple,
        ).length;

        toast({
          title: "✨ Análisis Completado",
          description: `Se analizaron ${totalItems} lotes. ${expiredItems} exceden la vida útil límite.`,
          className:
            "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
        });
      }
      return;
    }

    if (analysisMode === "inventoryAge") {
      if (!inventoryData) {
        return toast({
          variant: "destructive",
          title: "❌ Falta archivo",
          description:
            "Carga el inventario WMS con fecha de entrada para continuar.",
          className:
            "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
        });
      }

      setIsLoading(true);
      setInventoryAgeResults(null);

      const result = await runAnalysis(
        "inventoryAge",
        inventoryData,
        null,
        null,
        null,
        null,
        null,
        false,
      );

      setIsLoading(false);

      if (result.error) {
        toast({
          variant: "destructive",
          title: "❌ Error en el análisis",
          description: result.error,
          className:
            "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
        });
      } else if (result.data) {
        setInventoryAgeResults((result.data as InventoryAgeResult).results);
        const totalItems = (result.data as InventoryAgeResult).results.length;
        const oldItems = (result.data as InventoryAgeResult).results.filter(
          (item) => item.rangoEdad === "> 12 meses",
        ).length;

        toast({
          title: "✨ Análisis Completado",
          description: `Se analizaron ${totalItems} pallets. ${oldItems} tienen más de 12 meses.`,
          className:
            "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
        });
      }
      return;
    }

    // Validaciones para otros modos
    if (analysisMode === "sales" && (!salesData || !inventoryData)) {
      return toast({
        variant: "destructive",
        title: "❌ Faltan archivos",
        description: "Carga facturación e inventario para continuar.",
        className:
          "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
      });
    }
    if (analysisMode === "levels" && (!inventoryData || !minMaxData)) {
      return toast({
        variant: "destructive",
        title: "❌ Faltan archivos",
        description: "Carga inventario y niveles Mín/Máx para continuar.",
        className:
          "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
      });
    }
    if (analysisMode === "cross" && (!sapData || !wmsData)) {
      return toast({
        variant: "destructive",
        title: "❌ Faltan archivos",
        description: "Carga inventario SAP e inventario WMS para continuar.",
        className:
          "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
      });
    }
    if (analysisMode === "lotCross" && (!sapLotData || !wmsLotData)) {
      return toast({
        variant: "destructive",
        title: "❌ Faltan archivos",
        description:
          "Carga el archivo de entrada SAP y el albarán WMS para continuar.",
        className:
          "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
      });
    }

    setIsLoading(true);
    setSuggestions(null);
    setMissingProducts(null);
    setCrossResults(null);
    setLotCrossResults(null);
    setSortConfig(null);
    setShelfLifeResults(null);
    setInventoryAgeResults(null);

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

    setIsLoading(false);

    if (result.error) {
      toast({
        variant: "destructive",
        title: "❌ Error en el análisis",
        description: result.error,
        className:
          "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
      });
    } else if (result.data) {
      if (analysisMode === "cross") {
        setCrossResults(result.data as InventoryCrossResult);

        const totalDiff = (result.data as InventoryCrossResult).results.reduce(
          (sum, item) => sum + Math.abs(item.diferencia),
          0,
        );

        toast({
          title: "✨ Análisis Completado",
          description: `Se encontraron ${(result.data as InventoryCrossResult).results.length} discrepancias. Diferencia total: ${totalDiff} unidades.`,
          className:
            "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
        });
      } else if (analysisMode === "lotCross") {
        setLotCrossResults(result.data as LotCrossResult);

        const total = (result.data as LotCrossResult).results.length;
        const diferentes = (result.data as LotCrossResult).results.filter(
          (item) => item.estado === "DIFERENTE",
        ).length;

        toast({
          title: "✨ Cruce de lotes completado",
          description: `Se analizaron ${total} SKU. ${diferentes} con lotes diferentes.`,
          className:
            "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
        });
      } else {
        setSuggestions((result.data as any).suggestions);
        setMissingProducts((result.data as any).missingProducts);

        let actionableSuggestions = 0;
        let toastDescription = "";

        if (
          "suggestions" in result.data &&
          Array.isArray(result.data.suggestions)
        ) {
          actionableSuggestions = result.data.suggestions.filter(
            (s) => s.cantidadARestockear > 0,
          ).length;
        }

        if (analysisMode === "levels") {
          if (actionableSuggestions > 0) {
            toastDescription = `🎯 ${actionableSuggestions} oportunidades de surtido identificadas`;
          } else {
            toastDescription =
              "✅ Niveles de stock óptimos - No se requieren ajustes";
          }
        } else if (analysisMode === "sales") {
          if (actionableSuggestions > 0) {
            toastDescription = `📈 ${actionableSuggestions} sugerencias de surtido generadas. `;
          }
          if (
            "missingProducts" in result.data &&
            Array.isArray(result.data.missingProducts) &&
            result.data.missingProducts.length > 0
          ) {
            toastDescription += `⚠️ ${result.data.missingProducts.length} productos sin stock`;
          }
          if (toastDescription === "") {
            toastDescription =
              "✅ Análisis completado - Sin discrepancias críticas";
          }
        }

        toast({
          title: "✨ Análisis Completado",
          description: toastDescription,
          className:
            "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
        });
      }
    }
  };

  const handleDownloadReport = async () => {
    setIsDownloading(true);

    // Para shelf life, pasar los resultados específicos
    const result = await generateFullReportFile(
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
        className:
          "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
      });
    } else if (result.data) {
      downloadFile(
        result.data.file,
        result.data.filename,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      toast({
        title: "📥 Reporte Descargado",
        description: "El archivo Excel se ha guardado en tu dispositivo",
        className:
          "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
      });
    }
  };

  const handleDownloadWMS = async () => {
    // Manejo para modo Inbound
    if (analysisMode === "inbound") {
      if (!inboundResults) return;
      setIsDownloading(true);
      const { file, filename } = await generateInboundExcel(inboundResults);
      setIsDownloading(false);
      downloadFile(
        file,
        filename,
        "application/vnd.ms-excel", // Cambiado a application/vnd.ms-excel para .xls
      );
      toast({
        title: "📥 Archivo WMS Descargado",
        description: "El archivo se ha guardado en tu dispositivo",
        className:
          "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
      });
      return;
    }

    // Para shelf life no hay archivos WMS
    if (analysisMode === "shelfLife" || analysisMode === "inventoryAge") {
      toast({
        variant: "destructive",
        title: "❌ No aplicable",
        description: "Este módulo no genera archivos WMS.",
        className:
          "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
      });
      return;
    }

    if (!suggestions) {
      toast({
        variant: "destructive",
        title: "❌ Error",
        description: "No hay sugerencias de surtido para exportar.",
        className:
          "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
      });
      return;
    }
    setIsDownloading(true);
    const result = await generateWmsFiles(
      suggestions,
      analysisMode as "sales" | "levels",
    );
    setIsDownloading(false);

    if (result.error) {
      toast({
        variant: "destructive",
        title: "❌ Error",
        description: result.error,
        className:
          "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
      });
    } else if (result.data) {
      downloadFile(
        result.data.file,
        result.data.filename,
        "application/vnd.ms-excel",
      );
      toast({
        title: "📥 Archivo WMS Descargado",
        description: "El archivo WMS se ha guardado en tu dispositivo",
        className:
          "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
      });
    }
  };

  const handleDownloadBoth = async () => {
    // No aplicable para shelf life
    if (analysisMode === "shelfLife" || analysisMode === "inventoryAge") {
      handleDownloadReport();
      return;
    }

    setIsDownloading(true);

    try {
      // Descargar reporte completo primero
      const fullReport = await generateFullReportFile(
        suggestions,
        missingProducts,
        analysisMode as any,
        crossResults?.results,
        lotCrossResults?.results,
        shelfLifeResults,
        inventoryAgeResults,
      );

      if (fullReport.error) {
        throw new Error(fullReport.error);
      }

      if (fullReport.data) {
        downloadFile(
          fullReport.data.file,
          fullReport.data.filename,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
      }

      // Solo descargar WMS si tenemos sugerencias (modos sales o levels)
      if (
        suggestions &&
        (analysisMode === "sales" || analysisMode === "levels")
      ) {
        const wmsFiles = await generateWmsFiles(
          suggestions,
          analysisMode as "sales" | "levels",
        );

        if (wmsFiles.error) {
          toast({
            variant: "destructive",
            title: "Error parcial",
            description: `Reporte descargado, pero WMS falló: ${wmsFiles.error}`,
            className:
              "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-lg",
          });
        } else if (
          wmsFiles.data !== undefined &&
          wmsFiles.data.file &&
          wmsFiles.data.filename
        ) {
          // Pequeño delay para evitar problemas con descargas simultáneas
          setTimeout(() => {
            downloadFile(
              wmsFiles.data!.file,
              wmsFiles.data!.filename,
              "application/vnd.ms-excel",
            );
          }, 500);
        }
      }

      // Mostrar toast de éxito
      setTimeout(() => {
        toast({
          title: "📥 Descargas Completadas",
          description:
            suggestions &&
            (analysisMode === "sales" || analysisMode === "levels")
              ? "Ambos archivos se han guardado en tu dispositivo"
              : "Reporte descargado correctamente",
          className:
            "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
        });
      }, 1000);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ Error en la descarga",
        description:
          error instanceof Error ? error.message : "Error desconocido",
        className:
          "bg-gradient-to-r from-red-300 to-red-400 text-white border-0 shadow-lg",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const hasResults = useMemo(() => {
    if (analysisMode === "cross") return !!crossResults;
    if (analysisMode === "lotCross") return !!lotCrossResults;
    if (analysisMode === "inbound") return !!inboundResults;
    if (analysisMode === "shelfLife") return !!shelfLifeResults;
    if (analysisMode === "inventoryAge") return !!inventoryAgeResults;
    return !!(suggestions || missingProducts);
  }, [
    suggestions,
    missingProducts,
    crossResults,
    lotCrossResults,
    inboundResults,
    analysisMode,
    shelfLifeResults,
    inventoryAgeResults,
  ]);

  const isInModuleView = selectedModule !== null;

  const getModeIcon = (mode: AnalysisMode = analysisMode) => {
    switch (mode) {
      case "sales":
        return <TrendingUp className="h-5 w-5" />;
      case "levels":
        return <BarChart3 className="h-5 w-5" />;
      case "cross":
        return <GitCompare className="h-5 w-5" />;
      case "lotCross":
        return <Database className="h-5 w-5" />;
      case "inbound":
        return <Upload className="h-5 w-5" />;
      case "shelfLife":
        return <Clock className="h-5 w-5" />;
      case "inventoryAge":
        return <Clock className="h-5 w-5" />;
      case "exitoLabels":
        return <Tag className="h-5 w-5" />;
    }
  };

  const getModeColor = (mode: AnalysisMode = analysisMode) => {
    switch (mode) {
      case "sales":
        return "from-blue-500 to-indigo-500";
      case "levels":
        return "from-emerald-500 to-teal-500";
      case "cross":
        return "from-slate-500 to-slate-600";
      case "lotCross":
        return "from-cyan-600 to-blue-600";
      case "inbound":
        return "from-amber-500 to-orange-500";
      case "shelfLife":
        return "from-red-500 to-red-600";
      case "inventoryAge":
        return "from-orange-500 to-amber-500";
      case "exitoLabels":
        return "from-[#7A1F3D] to-[#8F2548]";
    }
  };

  const getModeTitle = (mode: AnalysisMode = analysisMode) => {
    switch (mode) {
      case "sales":
        return "Análisis por Ventas";
      case "levels":
        return "Surtido por Niveles";
      case "cross":
        return "Cruce SAP vs WMS";
      case "lotCross":
        return "Cruce Lotes SAP vs WMS";
      case "inbound":
        return "Entradas de Mercancía";
      case "shelfLife":
        return "Análisis de Vida Útil";
      case "inventoryAge":
        return "Edad del Inventario";
      case "exitoLabels":
        return "Etiquetas Éxito";
    }
  };

  const getModeDescription = (mode: AnalysisMode = analysisMode) => {
    switch (mode) {
      case "sales":
        return "Analiza ventas vs inventario para optimizar surtido";
      case "levels":
        return "Compara inventario actual con niveles mínimos y máximos";
      case "cross":
        return "Identifica discrepancias entre sistemas SAP y WMS";
      case "lotCross":
        return "Valida por SKU si los lotes de SAP coinciden con los lotes ingresados en WMS";
      case "inbound":
        return "Transforma archivos de proveedores a formato WMS";
      case "shelfLife":
        return "Evalúa lotes contra días mínimos de vida útil";
      case "inventoryAge":
        return "Clasifica pallets por antigüedad desde la fecha de entrada";
      case "exitoLabels":
        return "Genera etiquetas ZPL desde el Excel de pedidos Éxito";
    }
  };

  const modules: AnalysisMode[] = [
    "sales",
    "levels",
    "cross",
    "lotCross",
    "inbound",
    "shelfLife",
    "inventoryAge",
    "exitoLabels",
  ];

  const openModule = (mode: AnalysisMode) => {
    setAnalysisMode(mode);
    setSelectedModule(mode);
    resetResultsForMode(mode);
    setRawInbound(null);
    if (mode !== "exitoLabels") {
      setExitoCanAnalyze(false);
    }
  };

  const backToModules = () => {
    setSelectedModule(null);
    resetResultsForMode(analysisMode);
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
              <h1 className="font-headline text-lg font-bold text-slate-800 md:text-xl">
                Surtido Inteligente
              </h1>
              <p className="text-xs text-slate-500">
                v0.1.0 | Blas Rangel Jimenz
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isInModuleView && (
              <Button
                onClick={backToModules}
                className="group relative rounded-lg border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 shadow-sm transition-all duration-300 hover:shadow-md active:scale-95 disabled:opacity-50"
              >
                <ArrowLeft className="mr-2 inline h-4 w-4 transition-transform group-hover:-translate-x-1" />
                <span className="hidden sm:inline">Atrás</span>
              </Button>
            )}

            {isInModuleView && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleAnalyzeClick}
                    disabled={
                      isLoading ||
                      (analysisMode === "exitoLabels" && !exitoCanAnalyze) ||
                      (analysisMode === "inbound" && !rawInbound) ||
                      (analysisMode === "sales" &&
                        (!salesData || !inventoryData)) ||
                      (analysisMode === "levels" &&
                        (!inventoryData || !minMaxData)) ||
                      (analysisMode === "cross" && (!sapData || !wmsData)) ||
                      (analysisMode === "lotCross" &&
                        (!sapLotData || !wmsLotData)) ||
                      (analysisMode === "shelfLife" &&
                        (!inventoryData || !shelfLifeMasterData)) ||
                      (analysisMode === "inventoryAge" && !inventoryData)
                    }
                    className={cn(
                      "group relative rounded-lg bg-gradient-to-r px-5 py-2 font-semibold text-white shadow-lg transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                      getModeColor(),
                    )}
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
                        <span className="hidden font-semibold sm:inline">
                          Descargar
                        </span>
                        <ChevronDown className="ml-2 inline h-4 w-4 transition-transform group-hover:rotate-180 duration-300" />
                      </>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-80 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur-sm"
                  align="end"
                >
                  <DropdownMenuLabel className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-slate-800">
                    <div className="rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 p-1.5">
                      <Download className="h-4 w-4 text-white" />
                    </div>
                    Opciones de Descarga
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="my-2 bg-slate-200" />

                  <DropdownMenuGroup className="space-y-1.5">
                    {analysisMode !== "inbound" && (
                      <DropdownMenuItem
                        onClick={handleDownloadReport}
                        className="group flex cursor-pointer items-center gap-4 rounded-lg px-3 py-3 transition-all duration-200 hover:bg-blue-50 active:bg-blue-100"
                      >
                        <div className="rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 p-2 shadow-md transition-all group-hover:scale-110 duration-200">
                          <FileSpreadsheet className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-800">
                            Reporte Completo
                          </p>
                          <p className="text-xs text-slate-500">
                            Análisis detallado en Excel
                          </p>
                        </div>
                        <Badge className="bg-blue-100 text-blue-700 text-xs">
                          Nuevo
                        </Badge>
                      </DropdownMenuItem>
                    )}

                    {analysisMode !== "shelfLife" &&
                      analysisMode !== "cross" &&
                      analysisMode !== "lotCross" && (
                        <DropdownMenuItem
                          onClick={handleDownloadWMS}
                          className="group flex cursor-pointer items-center gap-4 rounded-lg px-3 py-3 transition-all duration-200 hover:bg-emerald-50 active:bg-emerald-100"
                        >
                          <div className="rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 p-2 shadow-md transition-all group-hover:scale-110 duration-200">
                            <FileText className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-800">
                              {analysisMode === "inbound"
                                ? "Plantilla Entradas WMS"
                                : "Archivo WMS"}
                            </p>
                            <p className="text-xs text-slate-500">
                              Formato para sistema de almacén
                            </p>
                          </div>
                        </DropdownMenuItem>
                      )}

                    {(analysisMode === "sales" ||
                      analysisMode === "levels") && (
                      <>
                        <DropdownMenuSeparator className="my-2 bg-slate-200" />
                        <DropdownMenuItem
                          onClick={handleDownloadBoth}
                          className="group flex cursor-pointer items-center gap-4 rounded-lg border-2 border-slate-300 bg-gradient-to-r from-slate-50 to-slate-100 px-3 py-3 transition-all duration-200 hover:from-slate-100 hover:to-slate-200 active:scale-95"
                        >
                          <div className="rounded-lg bg-gradient-to-r from-slate-600 to-slate-700 p-2 shadow-md transition-all group-hover:scale-110 duration-200">
                            <Download className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-slate-800">
                              Descargar Ambos ⚡
                            </p>
                            <p className="text-xs text-slate-600">
                              Reporte + WMS simultáneamente
                            </p>
                          </div>
                          <Badge className="animate-pulse bg-gradient-to-r from-slate-600 to-slate-700 text-white text-xs px-2">
                            Recomendado
                          </Badge>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>

        <main
          className={cn(
            "relative z-10 mx-auto w-full flex-1 space-y-8 p-4 md:p-8",
            isInModuleView ? "max-w-none" : "max-w-7xl",
            !isInModuleView && "lg:h-[calc(100vh-5rem)] lg:overflow-hidden",
          )}
        >
          {!isInModuleView ? (
            <>
              <div className="grid gap-6 lg:h-full lg:grid-cols-[1.05fr_1fr] lg:items-stretch">
                <Card className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 shadow-2xl backdrop-blur-sm lg:h-full">
                  <CardContent className="p-6 md:p-8 lg:h-full lg:flex lg:flex-col lg:gap-6">
                    <div className="space-y-5">
                      <Badge className="w-fit bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md">
                        ✨ Plataforma Inteligente
                      </Badge>
                      <div className="space-y-3">
                        <h2 className="text-3xl font-black leading-tight text-slate-900 md:text-4xl lg:text-5xl">
                          Centro de Operaciones{" "}
                          <span className="bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                            Logísticas
                          </span>
                        </h2>
                        <p className="max-w-2xl text-sm text-slate-600 md:text-base lg:text-lg">
                          Ejecuta análisis de surtido, cruces de inventario,
                          transformación de entradas y generación de etiquetas
                          en un flujo modular, rápido y listo para operación
                          diaria.
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-xl lg:mt-0">
                      <div className="mb-4 flex items-center gap-2 text-slate-800">
                        <div className="rounded-lg bg-gradient-to-r from-indigo-500 to-blue-500 p-1.5">
                          <Sparkles className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-sm font-bold">
                          Comienza en 3 pasos
                        </span>
                      </div>
                      <ol className="space-y-3 text-sm text-slate-700">
                        <li className="flex items-start gap-3">
                          <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 text-xs font-bold text-white">
                            1
                          </div>
                          <span>Selecciona un módulo de análisis.</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-xs font-bold text-white">
                            2
                          </div>
                          <span>Carga tus archivos en la vista.</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-xs font-bold text-white">
                            3
                          </div>
                          <span>Actualiza y descarga resultados.</span>
                        </li>
                      </ol>
                    </div>

                    <div className="hidden flex-1 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70 shadow-inner lg:block">
                      <img
                        src="/logistics-hero.png"
                        alt="Ilustracion de logistica con almacen, transporte y flujo operativo"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </CardContent>
                </Card>

                <div className="grid content-start gap-3 sm:grid-cols-2 lg:grid-cols-2">
                  {modules.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => openModule(mode)}
                      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white/85 shadow-lg transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 active:scale-95"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-5" />
                      <div className="relative p-4 md:p-5">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div
                            className={cn(
                              "rounded-xl bg-gradient-to-r p-2.5 text-white shadow-lg transition-all duration-300 group-hover:scale-110",
                              getModeColor(mode),
                            )}
                          >
                            {getModeIcon(mode)}
                          </div>
                          <Badge
                            variant="outline"
                            className="bg-white text-[10px] font-semibold text-slate-600"
                          >
                            MÓDULO
                          </Badge>
                        </div>
                        <h3 className="mb-1.5 text-base font-bold text-slate-800 transition-all duration-200 group-hover:text-slate-900 md:text-lg">
                          {getModeTitle(mode)}
                        </h3>
                        <p className="line-clamp-2 text-xs text-slate-600 transition-colors duration-200 group-hover:text-slate-700 md:text-sm">
                          {getModeDescription(mode)}
                        </p>
                        <div className="mt-3 flex items-center gap-2 opacity-0 transition-all duration-300 group-hover:opacity-100">
                          <span className="text-xs font-semibold text-slate-500">
                            Acceder
                          </span>
                          <ArrowLeft className="h-3 w-3 rotate-180 text-slate-500 transition-transform group-hover:translate-x-1" />
                        </div>
                      </div>
                      <div
                        className={cn(
                          "h-1 w-full bg-gradient-to-r transition-all duration-300 group-hover:h-1.5",
                          getModeColor(mode),
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "rounded-lg bg-gradient-to-r p-2 text-white",
                      getModeColor(),
                    )}
                  >
                    {getModeIcon()}
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-700">
                      Modo: {getModeTitle()}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {getModeDescription()}
                    </p>
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
                {analysisMode === "sales" && (
                  <>
                    <FileUploader
                      title="Facturación (ERP)"
                      onFileRead={(c) => handleFileRead(c, "sales")}
                      onFileReset={() => handleFileReset("sales")}
                      recordCount={salesData?.length}
                    />
                    <FileUploader
                      title="Inventario (WMS)"
                      onFileRead={(c) => handleFileRead(c, "inventory")}
                      onFileReset={() => handleFileReset("inventory")}
                      recordCount={inventoryData?.length}
                    />
                  </>
                )}
                {analysisMode === "levels" && (
                  <>
                    <FileUploader
                      title="Inventario (WMS)"
                      onFileRead={(c) => handleFileRead(c, "inventory")}
                      onFileReset={() => handleFileReset("inventory")}
                      recordCount={inventoryData?.length}
                    />
                    <FileUploader
                      title="Niveles (Mín/Máx)"
                      onFileRead={(c) => handleFileRead(c, "minMax")}
                      onFileReset={() => handleFileReset("minMax")}
                      recordCount={minMaxData?.length}
                    />
                  </>
                )}
                {analysisMode === "cross" && (
                  <>
                    <FileUploader
                      title="Inventario (SAP)"
                      onFileRead={(c) => handleFileRead(c, "sap")}
                      onFileReset={() => handleFileReset("sap")}
                      recordCount={sapData?.length}
                    />
                    <FileUploader
                      title="Inventario (WMS)"
                      onFileRead={(c) => handleFileRead(c, "wms")}
                      onFileReset={() => handleFileReset("wms")}
                      recordCount={wmsData?.length}
                    />
                  </>
                )}
                {analysisMode === "lotCross" && (
                  <>
                    <FileUploader
                      title="Entrada (SAP)"
                      onFileRead={(c) => handleFileRead(c, "sapLot")}
                      onFileReset={() => handleFileReset("sapLot")}
                      recordCount={sapLotData?.length}
                    />
                    <FileUploader
                      title="Albarán (WMS)"
                      onFileRead={(c) => handleFileRead(c, "wmsLot")}
                      onFileReset={() => handleFileReset("wmsLot")}
                      recordCount={wmsLotData?.length}
                    />
                  </>
                )}
                {analysisMode === "inbound" && (
                  <div className="col-span-full w-full">
                    <FileUploader
                      title="Archivo Fuente de Proveedor"
                      onFileRead={(c) => handleFileRead(c, "inbound")}
                      onFileReset={() => handleFileReset("inbound")}
                      recordCount={rawInbound?.rows.length}
                    />
                  </div>
                )}
                {analysisMode === "shelfLife" && (
                  <>
                    <FileUploader
                      title="Inventario (WMS)"
                      onFileRead={(c) => handleFileRead(c, "inventory")}
                      onFileReset={() => handleFileReset("inventory")}
                      recordCount={inventoryData?.length}
                    />
                    <FileUploader
                      title="Maestra Vida Útil (FPC)"
                      onFileRead={(c) => handleFileRead(c, "shelfLife")}
                      onFileReset={() => handleFileReset("shelfLife")}
                      recordCount={shelfLifeMasterData?.length}
                    />
                  </>
                )}
                {analysisMode === "inventoryAge" && (
                  <div className="col-span-full w-full">
                    <FileUploader
                      title="Inventario (WMS) con Fecha de Entrada"
                      onFileRead={(c) => handleFileRead(c, "inventory")}
                      onFileReset={() => handleFileReset("inventory")}
                      recordCount={inventoryData?.length}
                    />
                  </div>
                )}
              </div>

              {analysisMode === "cross" && (
                <div className="group flex w-fit items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-md transition-all duration-200 hover:shadow-lg active:scale-95">
                  <Switch
                    checked={groupByLot}
                    onCheckedChange={setGroupByLot}
                    id="lot-toggle"
                    className="h-6 w-11 data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-emerald-500 data-[state=checked]:to-green-500"
                  />
                  <Label
                    htmlFor="lot-toggle"
                    className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700 transition-colors group-hover:text-slate-900"
                  >
                    <Layers className="h-4 w-4 text-slate-600" />
                    <span>Agrupar por Lote</span>
                  </Label>
                </div>
              )}

              {analysisMode === "exitoLabels" && (
                <ExitoLabelsView
                  analyzeTrigger={exitoAnalyzeTrigger}
                  onCanAnalyzeChange={setExitoCanAnalyze}
                  onAnalyzeFinished={() => setIsLoading(false)}
                />
              )}

              {analysisMode !== "exitoLabels" && (
                <Card className="min-h-[500px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <div
                    className={cn(
                      "h-1.5 w-full bg-gradient-to-r",
                      getModeColor(),
                    )}
                  ></div>
                  <CardContent className="p-6 md:p-8">
                    {isLoading ? (
                      <div className="flex h-[400px] flex-col items-center justify-center gap-6">
                        <div className="relative">
                          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 to-indigo-400 opacity-30 blur-xl"></div>
                          <RefreshCcw className="relative z-10 h-16 w-16 animate-spin text-blue-500" />
                        </div>
                        <div className="space-y-3 text-center">
                          <p className="bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-2xl font-bold text-transparent">
                            Procesando datos...
                          </p>
                          <p className="text-slate-500">
                            Analizando patrones y generando perspectivas
                          </p>
                          <Progress
                            value={65}
                            className={cn("h-2 w-64", getModeColor())}
                          />
                        </div>
                      </div>
                    ) : hasResults ? (
                      <div className="space-y-8">
                        {analysisMode === "shelfLife" && shelfLifeResults && (
                          <div>
                            <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/50 shadow-inner">
                              <ShelfLifeTable data={shelfLifeResults} />
                            </div>
                          </div>
                        )}

                        {analysisMode === "inventoryAge" && inventoryAgeResults && (
                          <div>
                            <div className="overflow-hidden rounded-xl border border-orange-200 bg-orange-50/50 shadow-inner">
                              <InventoryAgeTable data={inventoryAgeResults} />
                            </div>
                          </div>
                        )}

                        {missingProducts &&
                          missingProducts.length > 0 &&
                          analysisMode !== "shelfLife" &&
                          analysisMode !== "inventoryAge" && (
                            <div>
                              <div className="overflow-hidden rounded-xl border border-rose-200 bg-rose-50/50 shadow-inner">
                                <MissingStockTable products={missingProducts} />
                              </div>
                            </div>
                          )}

                        {suggestions &&
                          suggestions.length > 0 &&
                          analysisMode !== "shelfLife" &&
                          analysisMode !== "inventoryAge" && (
                            <div>
                              <div className="overflow-hidden rounded-xl border border-blue-200 bg-blue-50/50 shadow-inner">
                                <ResultsTable
                                  results={suggestions}
                                  analysisMode={analysisMode as any}
                                />
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
                    ) : analysisMode === "inbound" && rawInbound ? (
                      <InboundMapper
                        headers={rawInbound.headers}
                        rows={rawInbound.rows}
                        onMappingChange={(map, fixed) => {
                          setInboundMapping(map);
                          setInboundFixedValues(fixed);
                        }}
                      />
                    ) : (
                      <div className="flex h-[400px] flex-col items-center justify-center gap-8 text-slate-500">
                        <div className="relative">
                          <Warehouse className="h-32 w-32 text-slate-300" />
                          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-slate-100 to-slate-200 blur-xl"></div>
                        </div>
                        <div className="max-w-md space-y-3 text-center">
                          <h3 className="bg-gradient-to-r from-slate-700 to-slate-500 bg-clip-text text-2xl font-bold text-transparent">
                            {analysisMode === "cross" &&
                              "¡Listo para cruzar sistemas!"}
                            {analysisMode === "lotCross" &&
                              "Compara lotes entre SAP y WMS"}
                            {analysisMode === "sales" &&
                              "Analiza tus ventas e inventario"}
                            {analysisMode === "levels" &&
                              "Optimiza tus niveles de stock"}
                            {analysisMode === "inbound" &&
                              "Mapea tus entradas de mercancía"}
                            {analysisMode === "shelfLife" &&
                              "Analiza la vida útil de tu inventario"}
                            {analysisMode === "inventoryAge" &&
                              "Analiza la antigüedad de tu inventario"}
                          </h3>
                          <p className="text-slate-500">
                            {analysisMode === "cross" &&
                              "Sube los archivos SAP y WMS para identificar discrepancias"}
                            {analysisMode === "lotCross" &&
                              "Carga la entrada SAP y el albarán WMS para validar si cada SKU conserva el mismo lote"}
                            {analysisMode === "sales" &&
                              "Carga los datos de facturación e inventario para obtener sugerencias"}
                            {analysisMode === "levels" &&
                              "Sube el inventario actual y los parámetros mín/máx"}
                            {analysisMode === "inbound" &&
                              "Carga el archivo del proveedor para transformarlo al formato WMS"}
                            {analysisMode === "shelfLife" &&
                              "Carga el inventario WMS y la maestra de vida útil para evaluar lotes"}
                            {analysisMode === "inventoryAge" &&
                              "Carga el inventario WMS con fecha de entrada para clasificar pallets por edad"}
                          </p>
                          <div className="mt-4 flex items-center justify-center gap-2">
                            <div className="h-2 w-2 animate-pulse rounded-full bg-blue-400"></div>
                            <div className="delay-100 h-2 w-2 animate-pulse rounded-full bg-emerald-400"></div>
                            <div className="delay-200 h-2 w-2 animate-pulse rounded-full bg-slate-400"></div>
                          </div>
                        </div>
                      </div>
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
