"use client";

import { useState, useMemo } from "react";
import {
  Bot,
  FileWarning,
  Loader2,
  Warehouse,
  AlertTriangle,
  Download,
  Settings,
  ChevronDown,
  RefreshCcw,
  FileSearch,
  Sparkles,
  TrendingUp,
  BarChart3,
  GitCompare,
  Zap,
  Filter,
  Layers,
  Upload,
  FileText,
  FileSpreadsheet,
  Database,
  CheckCircle2,
  Clock,
  Calendar,
  Activity,
  ArrowRight,
  Menu,
  X,
  Moon,
  Sun,
  Bell,
  User,
  LogOut,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/ai/flows/schemas";
import { Logo } from "@/components/icons";
import { ResultsTable } from "@/components/results-table";
import { MissingStockTable } from "@/components/missing-stock-table";
import { InventoryCrossTable } from "@/components/inventory-cross-table";
import { InboundMapper } from "@/components/inbound-mapper";
import { InboundResultsTable } from "@/components/inbound-results-table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuShortcut,
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
} from "./config";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function Home() {
  const [analysisMode, setAnalysisMode] = useState<
    "sales" | "levels" | "cross" | "inbound"
  >("sales");
  const [salesData, setSalesData] = useState<any[] | null>(null);
  const [inventoryData, setInventoryData] = useState<any[] | null>(null);
  const [minMaxData, setMinMaxData] = useState<any[] | null>(null);
  const [sapData, setSapData] = useState<any[] | null>(null);
  const [wmsData, setWmsData] = useState<any[] | null>(null);
  const [groupByLot, setGroupByLot] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

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
  const [crossResults, setCrossResults] = useState<any | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
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
    setSortConfig(null);

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
      } else if (type === "inventory") {
        mapping = inventoryColumnMapping;
        numericCols = ["disponible", "diasFPC"];
      } else if (type === "minMax") {
        mapping = minMaxColumnMapping;
        numericCols = ["cantidadMinima", "cantidadMaxima"];
      } else if (type === "sap") {
        mapping = sapInventoryMapping;
        numericCols = ["cantidad"];
      } else {
        // wms
        mapping = wmsInventoryCrossMapping;
        numericCols = ["cantidad"];
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
      } else if (type === "inventory") {
        setInventoryData(data);
        // Resetear resultados si estamos en modo sales o levels (que usan inventoryData)
        if (analysisMode === "sales" || analysisMode === "levels") {
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
      } else if (type === "wms") {
        setWmsData(data);
        // Resetear resultados si estamos en modo cross
        if (analysisMode === "cross") {
          resetResultsForMode(analysisMode);
        }
      }

      toast({
        title: "✅ Archivo Cargado",
        description: `Se cargaron ${recordCount} registros correctamente.`,
        className:
          "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
      });

      // Ya no reseteamos aquí porque lo hacemos específicamente según el tipo
      // setSuggestions(null);
      // setMissingProducts(null);
      // setCrossResults(null);
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
    } else if (type === "wms") {
      setWmsData(null);
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

    setIsLoading(true);
    setSuggestions(null);
    setMissingProducts(null);
    setCrossResults(null);
    setSortConfig(null);

    const result = await runAnalysis(
      analysisMode as any,
      inventoryData,
      salesData,
      minMaxData,
      sapData,
      wmsData,
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
        setCrossResults(result.data);
      } else {
        setSuggestions((result.data as any).suggestions);
        setMissingProducts((result.data as any).missingProducts);
      }
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
          toastDescription += `📈 ${actionableSuggestions} sugerencias de surtido generadas. `;
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
  };

  const handleDownloadReport = async () => {
    setIsDownloading(true);
    const result = await generateFullReportFile(
      suggestions,
      missingProducts,
      analysisMode as any,
      crossResults?.results,
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
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      toast({
        title: "📥 Archivo WMS Descargado",
        description: "El archivo se ha guardado en tu dispositivo",
        className:
          "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
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
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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
    setIsDownloading(true);

    try {
      // Descargar reporte completo primero
      const fullReport = await generateFullReportFile(
        suggestions,
        missingProducts,
        analysisMode as any,
        crossResults?.results,
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
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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
    if (analysisMode === "inbound") return !!inboundResults;
    return !!(suggestions || missingProducts);
  }, [
    suggestions,
    missingProducts,
    crossResults,
    inboundResults,
    analysisMode,
  ]);

  const getModeIcon = () => {
    switch (analysisMode) {
      case "sales":
        return <TrendingUp className="h-5 w-5" />;
      case "levels":
        return <BarChart3 className="h-5 w-5" />;
      case "cross":
        return <GitCompare className="h-5 w-5" />;
      case "inbound":
        return <Upload className="h-5 w-5" />;
    }
  };

  const getModeColor = () => {
    switch (analysisMode) {
      case "sales":
        return "from-blue-500 to-indigo-500";
      case "levels":
        return "from-emerald-500 to-teal-500";
      case "cross":
        return "from-slate-500 to-slate-600";
      case "inbound":
        return "from-amber-500 to-orange-500";
    }
  };

  const getModeBadgeColor = () => {
    switch (analysisMode) {
      case "sales":
        return "bg-blue-500";
      case "levels":
        return "bg-emerald-500";
      case "cross":
        return "bg-slate-500";
      case "inbound":
        return "bg-amber-500";
    }
  };

  return (
    <TooltipProvider>
      <div className="flex min-h-screen w-full flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100/50">
        {/* Header Mejorado - Sin perfil de usuario */}
        <header className="sticky top-0 z-50 flex h-20 items-center justify-between border-b border-slate-200 bg-white/95 backdrop-blur-xl px-4 md:px-8 shadow-sm">
          {/* Logo y Marca */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-500 rounded-full blur-md opacity-70"></div>
              <Logo className="h-10 w-10 text-blue-500 relative z-10" />
            </div>
            <div className="hidden md:block">
              <h1 className="font-headline text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                Optimizador de Surtido
              </h1>
              <p className="text-xs text-slate-500">Versión 1.0.1</p>
            </div>
          </div>

          {/* Navegación Principal - Desktop */}
          <div className="hidden lg:flex items-center gap-2">
            <Tabs
              value={analysisMode}
              onValueChange={(v: any) => {
                setAnalysisMode(v);
                // Resetear todos los resultados al cambiar de modo
                resetResultsForMode(v);
                setRawInbound(null);
                // No resetear los datos de archivos al cambiar de modo
                // setSalesData(null);
                // setInventoryData(null);
                // setMinMaxData(null);
                // setSapData(null);
                // setWmsData(null);
              }}
            >
              <TabsList className="bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
                <TabsTrigger
                  value="sales"
                  className="text-xs font-medium rounded-lg px-4 py-2 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md transition-all duration-200 text-slate-600"
                >
                  <TrendingUp className="h-3.5 w-3.5 mr-2" />
                  Ventas
                </TabsTrigger>
                <TabsTrigger
                  value="levels"
                  className="text-xs font-medium rounded-lg px-4 py-2 data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-md transition-all duration-200 text-slate-600"
                >
                  <BarChart3 className="h-3.5 w-3.5 mr-2" />
                  Niveles
                </TabsTrigger>
                <TabsTrigger
                  value="inbound"
                  className="text-xs font-medium rounded-lg px-4 py-2 data-[state=active]:bg-white data-[state=active]:text-amber-600 data-[state=active]:shadow-md transition-all duration-200 text-slate-600"
                >
                  <Upload className="h-3.5 w-3.5 mr-2" />
                  Entradas
                </TabsTrigger>
                <TabsTrigger
                  value="cross"
                  className="text-xs font-medium rounded-lg px-4 py-2 data-[state=active]:bg-white data-[state=active]:text-slate-600 data-[state=active]:shadow-md transition-all duration-200 text-slate-600"
                >
                  <GitCompare className="h-3.5 w-3.5 mr-2" />
                  Cruce
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Lote Selection - Solo visible en modo Cross */}
            {analysisMode === "cross" && (
              <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200">
                <Switch
                  checked={groupByLot}
                  onCheckedChange={setGroupByLot}
                  id="lot-toggle"
                  className="data-[state=checked]:bg-slate-500 h-5 w-9"
                />
                <Label
                  htmlFor="lot-toggle"
                  className="text-xs font-medium text-slate-600 cursor-pointer flex items-center gap-1.5"
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Agrupar por Lote</span>
                </Label>
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2">
            {/* Único Botón de Análisis */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleAnalyzeClick}
                  disabled={
                    isLoading ||
                    (analysisMode === "inbound" && !rawInbound) ||
                    (analysisMode === "sales" &&
                      (!salesData || !inventoryData)) ||
                    (analysisMode === "levels" &&
                      (!inventoryData || !minMaxData)) ||
                    (analysisMode === "cross" && (!sapData || !wmsData))
                  }
                  size="default"
                  className={cn(
                    "relative bg-gradient-to-r shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] rounded-xl px-6 py-5 text-white",
                    getModeColor(),
                  )}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span className="font-semibold">Procesando...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      <span className="font-semibold">Ejecutar Análisis</span>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Iniciar análisis con los datos cargados</p>
              </TooltipContent>
            </Tooltip>

            {/* Botón de Descarga */}
            {hasResults && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="default"
                    disabled={isDownloading}
                    className="relative border-2 border-emerald-500 bg-white hover:bg-emerald-50 text-emerald-600 rounded-xl px-6 py-5 hover:shadow-lg transition-all duration-200 hover:scale-[1.02] group"
                  >
                    {isDownloading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
                        <span className="font-semibold hidden sm:inline">
                          Descargar
                        </span>
                        <ChevronDown className="h-4 w-4 ml-2 opacity-80" />
                      </>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-80 rounded-xl border border-slate-200 shadow-xl bg-white p-2"
                  align="end"
                >
                  <DropdownMenuLabel className="font-bold text-base flex items-center gap-2 text-slate-700 px-3 py-2">
                    <Database className="h-4 w-4 text-emerald-500" />
                    Opciones de Descarga
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-200" />

                  <DropdownMenuGroup>
                    {analysisMode !== "inbound" && (
                      <DropdownMenuItem
                        onClick={handleDownloadReport}
                        className="flex items-center gap-3 py-3 px-3 cursor-pointer hover:bg-blue-50 rounded-lg transition-all group"
                      >
                        <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                          <FileSpreadsheet className="h-5 w-5 text-blue-500" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-700">
                            Reporte Completo
                          </p>
                          <p className="text-xs text-slate-500">
                            Análisis detallado en Excel
                          </p>
                        </div>
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuItem
                      onClick={handleDownloadWMS}
                      className="flex items-center gap-3 py-3 px-3 cursor-pointer hover:bg-emerald-50 rounded-lg transition-all group"
                    >
                      <div className="p-2 bg-emerald-100 rounded-lg group-hover:bg-emerald-200 transition-colors">
                        <FileText className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-700">
                          {analysisMode === "inbound"
                            ? "Plantilla Entradas WMS"
                            : "Archivo WMS"}
                        </p>
                        <p className="text-xs text-slate-500">
                          Formato para sistema de almacén
                        </p>
                      </div>
                    </DropdownMenuItem>

                    {(analysisMode === "sales" ||
                      analysisMode === "levels") && (
                      <>
                        <DropdownMenuSeparator className="bg-slate-200" />
                        <DropdownMenuItem
                          onClick={handleDownloadBoth}
                          className="flex items-center gap-3 py-3 px-3 cursor-pointer bg-gradient-to-r from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-200 rounded-lg border border-slate-200 transition-all group"
                        >
                          <div className="p-2 bg-slate-200 rounded-lg group-hover:bg-slate-300 transition-colors">
                            <Download className="h-5 w-5 text-slate-600" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-700">
                              Descargar Ambos
                            </p>
                            <p className="text-xs text-slate-500">
                              Reporte completo + WMS
                            </p>
                          </div>
                          <Badge className="bg-gradient-to-r from-slate-500 to-slate-600 text-white text-xs px-2 py-0.5">
                            Recomendado
                          </Badge>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuGroup>

                  <DropdownMenuSeparator className="bg-slate-200" />

                  <div className="px-3 py-2">
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Última actualización: hoy
                    </p>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Botón Menú Móvil */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-10 w-10"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </header>

        {/* Menú Móvil */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-x-0 top-20 z-40 bg-white border-b border-slate-200 shadow-lg p-4 animate-in slide-in-from-top">
            <div className="space-y-4">
              <Tabs
                value={analysisMode}
                onValueChange={(v: any) => {
                  setAnalysisMode(v);
                  resetResultsForMode(v);
                  setMobileMenuOpen(false);
                }}
                className="w-full"
              >
                <TabsList className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <TabsTrigger value="sales" className="text-xs">
                    Ventas
                  </TabsTrigger>
                  <TabsTrigger value="levels" className="text-xs">
                    Niveles
                  </TabsTrigger>
                  <TabsTrigger value="cross" className="text-xs">
                    Cruce
                  </TabsTrigger>
                  <TabsTrigger value="inbound" className="text-xs">
                    Entradas
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {analysisMode === "cross" && (
                <div className="flex items-center justify-between bg-slate-100 p-3 rounded-xl">
                  <Label
                    htmlFor="lot-toggle-mobile"
                    className="text-sm font-medium"
                  >
                    Agrupar por Lote
                  </Label>
                  <Switch
                    checked={groupByLot}
                    onCheckedChange={setGroupByLot}
                    id="lot-toggle-mobile"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        <main className="flex-1 p-4 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
          {/* Barra de Estado */}
          <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "p-2 rounded-lg bg-gradient-to-r text-white",
                  getModeColor(),
                )}
              >
                {getModeIcon()}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-700">
                  Modo:{" "}
                  {analysisMode === "sales"
                    ? "Análisis por Ventas"
                    : analysisMode === "levels"
                      ? "Surtido por Niveles"
                      : analysisMode === "cross"
                        ? "Cruce SAP vs WMS"
                        : "Entradas de Mercancía"}
                </h2>
                <p className="text-xs text-slate-500">
                  {analysisMode === "sales" &&
                    "Analiza ventas vs inventario para optimizar surtido"}
                  {analysisMode === "levels" &&
                    "Compara inventario actual con niveles mínimos y máximos"}
                  {analysisMode === "cross" &&
                    "Identifica discrepancias entre sistemas SAP y WMS"}
                  {analysisMode === "inbound" &&
                    "Transforma archivos de proveedores a formato WMS"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                <Activity className="h-3 w-3 mr-1" />
                En Curso 🟢
              </Badge>
            </div>
          </div>

          {/* Área de Carga de Archivos */}
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
            {analysisMode === "inbound" && (
              <div className="col-span-full max-w-2xl mx-auto w-full">
                <FileUploader
                  title="Archivo Fuente de Proveedor"
                  onFileRead={(c) => handleFileRead(c, "inbound")}
                  onFileReset={() => handleFileReset("inbound")}
                  recordCount={rawInbound?.rows.length}
                />
              </div>
            )}
          </div>

          {/* Tarjeta de Resultados */}
          <Card className="min-h-[500px] border border-slate-200 shadow-xl rounded-2xl overflow-hidden bg-white">
            <div
              className={cn("h-1.5 w-full bg-gradient-to-r", getModeColor())}
            ></div>
            <CardContent className="p-6 md:p-8">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-[400px] gap-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full blur-xl opacity-30"></div>
                    <RefreshCcw className="h-16 w-16 animate-spin text-blue-500 relative z-10" />
                  </div>
                  <div className="text-center space-y-3">
                    <p className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                      Procesando datos...
                    </p>
                    <p className="text-slate-500">
                      Analizando patrones y generando perspectivas
                    </p>
                    <Progress
                      value={65}
                      className={cn("w-64 h-2", getModeColor())}
                    />
                  </div>
                </div>
              ) : hasResults ? (
                <div className="space-y-8">
                  {missingProducts && missingProducts.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-rose-50 rounded-xl border border-rose-200">
                            <AlertTriangle className="h-6 w-6 text-rose-500" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-rose-600">
                              Faltantes Críticos
                            </h3>
                            <p className="text-sm text-rose-500">
                              Productos que requieren atención inmediata
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="destructive"
                          className="px-3 py-1.5 text-sm font-medium bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg"
                        >
                          {missingProducts.length} alertas
                        </Badge>
                      </div>
                      <div className="border border-rose-200 rounded-xl overflow-hidden bg-rose-50/50 shadow-inner">
                        <MissingStockTable products={missingProducts} />
                      </div>
                    </div>
                  )}
                  {suggestions && suggestions.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-50 rounded-xl border border-blue-200">
                            <TrendingUp className="h-6 w-6 text-blue-500" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-blue-600">
                              Sugerencias de Surtido
                            </h3>
                            <p className="text-sm text-blue-500">
                              Oportunidades de optimización identificadas
                            </p>
                          </div>
                        </div>
                        <Badge className="px-3 py-1.5 text-sm font-medium bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg">
                          {suggestions.length} oportunidades
                        </Badge>
                      </div>
                      <div className="border border-blue-200 rounded-xl overflow-hidden bg-blue-50/50 shadow-inner">
                        <ResultsTable
                          results={suggestions}
                          analysisMode={analysisMode as any}
                        />
                      </div>
                    </div>
                  )}
                  {crossResults && (
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-50 rounded-xl border border-slate-200">
                            <GitCompare className="h-6 w-6 text-slate-500" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-slate-600">
                              Discrepancias SAP vs WMS
                            </h3>
                            <p className="text-sm text-slate-500">
                              Comparación entre sistemas de inventario
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className="px-3 py-1.5 text-sm font-medium border-slate-300 text-slate-600 bg-slate-50 shadow-sm"
                        >
                          {crossResults.results?.length || 0} diferencias
                        </Badge>
                      </div>
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50 shadow-inner">
                        <InventoryCrossTable data={crossResults} />
                      </div>
                    </div>
                  )}
                  {inboundResults && (
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
                <div className="flex flex-col items-center justify-center h-[400px] text-slate-500 gap-8">
                  <div className="relative">
                    <Warehouse className="h-32 w-32 text-slate-300" />
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-100 to-slate-200 rounded-full blur-xl"></div>
                  </div>
                  <div className="text-center space-y-3 max-w-md">
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-slate-700 to-slate-500 bg-clip-text text-transparent">
                      {analysisMode === "cross" &&
                        "¡Listo para cruzar sistemas!"}
                      {analysisMode === "sales" &&
                        "Analiza tus ventas e inventario"}
                      {analysisMode === "levels" &&
                        "Optimiza tus niveles de stock"}
                      {analysisMode === "inbound" &&
                        "Mapea tus entradas de mercancía"}
                    </h3>
                    <p className="text-slate-500">
                      {analysisMode === "cross" &&
                        "Sube los archivos SAP y WMS para identificar discrepancias"}
                      {analysisMode === "sales" &&
                        "Carga los datos de facturación e inventario para obtener sugerencias"}
                      {analysisMode === "levels" &&
                        "Sube el inventario actual y los parámetros mín/máx"}
                      {analysisMode === "inbound" &&
                        "Carga el archivo del proveedor para transformarlo al formato WMS"}
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse"></div>
                      <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse delay-100"></div>
                      <div className="h-2 w-2 rounded-full bg-slate-400 animate-pulse delay-200"></div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </TooltipProvider>
  );
}
