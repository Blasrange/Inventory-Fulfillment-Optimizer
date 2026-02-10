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
  FileText,
  FileSpreadsheet,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUploader } from "@/components/file-uploader";
import { parseData } from "@/lib/csv";
import { downloadFile } from "@/lib/download";
import { useToast } from "@/hooks/use-toast";
import {
  runAnalysis,
  generateWmsFiles,
  generateFullReportFile,
} from "@/app/actions";
import type {
  GenerateRestockSuggestionsOutput,
  MissingProductsOutput,
} from "@/ai/flows/schemas";
import { Logo } from "@/components/icons";
import { ResultsTable } from "@/components/results-table";
import { MissingStockTable } from "@/components/missing-stock-table";
import { InventoryCrossTable } from "@/components/inventory-cross-table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "./config";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function Home() {
  const [analysisMode, setAnalysisMode] = useState<
    "sales" | "levels" | "cross"
  >("sales");
  const [salesData, setSalesData] = useState<any[] | null>(null);
  const [inventoryData, setInventoryData] = useState<any[] | null>(null);
  const [minMaxData, setMinMaxData] = useState<any[] | null>(null);
  const [sapData, setSapData] = useState<any[] | null>(null);
  const [wmsData, setWmsData] = useState<any[] | null>(null);
  const [groupByLot, setGroupByLot] = useState(true);

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

  const handleFileRead = (content: string | ArrayBuffer, type: string) => {
    try {
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
          title: "Archivo Vacío o Inválido",
          description:
            "El archivo no contiene datos o el formato es incorrecto.",
          className: "bg-gradient-to-r from-red-400 to-red-500 text-white",
        });
        return;
      }

      if (type === "sales") setSalesData(data);
      else if (type === "inventory") setInventoryData(data);
      else if (type === "minMax") setMinMaxData(data);
      else if (type === "sap") setSapData(data);
      else if (type === "wms") setWmsData(data);

      toast({
        title: "✅ Archivo Cargado",
        description: `Se cargaron ${recordCount} registros correctamente.`,
        className: "bg-gradient-to-r from-green-400 to-green-500 text-white",
      });

      setSuggestions(null);
      setMissingProducts(null);
      setCrossResults(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al procesar el archivo",
        description:
          error instanceof Error ? error.message : "Error desconocido",
        className: "bg-gradient-to-r from-red-400 to-red-500 text-white",
      });
    }
  };

  const handleAnalyzeClick = async () => {
    if (analysisMode === "sales" && (!salesData || !inventoryData)) {
      return toast({
        variant: "destructive",
        title: "Faltan archivos",
        description: "Carga facturación e inventario para continuar.",
        className: "bg-gradient-to-r from-red-400 to-red-500 text-white",
      });
    }
    if (analysisMode === "levels" && (!inventoryData || !minMaxData)) {
      return toast({
        variant: "destructive",
        title: "Faltan archivos",
        description: "Carga inventario y niveles Mín/Máx para continuar.",
        className: "bg-gradient-to-r from-red-400 to-red-500 text-white",
      });
    }
    if (analysisMode === "cross" && (!sapData || !wmsData)) {
      return toast({
        variant: "destructive",
        title: "Faltan archivos",
        description: "Carga inventario SAP e inventario WMS para continuar.",
        className: "bg-gradient-to-r from-red-400 to-red-500 text-white",
      });
    }

    setIsLoading(true);
    setSuggestions(null);
    setMissingProducts(null);
    setCrossResults(null);
    setSortConfig(null);

    const result = await runAnalysis(
      analysisMode,
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
        title: "Error en el análisis",
        description: result.error,
        className: "bg-gradient-to-r from-red-400 to-red-500 text-white",
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
        className: "bg-gradient-to-r from-green-400 to-green-500 text-white",
      });
    }
  };

  const handleDownloadReport = async () => {
    setIsDownloading(true);
    const result = await generateFullReportFile(
      suggestions,
      missingProducts,
      analysisMode,
      crossResults?.results,
    );
    setIsDownloading(false);

    if (result.error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: result.error,
        className: "bg-gradient-to-r from-red-400 to-red-500 text-white",
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
        className: "bg-gradient-to-r from-green-400 to-green-500 text-white",
      });
    }
  };

  const handleDownloadWMS = async () => {
    if (!suggestions) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No hay sugerencias de surtido para exportar.",
        className: "bg-gradient-to-r from-red-400 to-red-500 text-white",
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
        title: "Error",
        description: result.error,
        className: "bg-gradient-to-r from-red-400 to-red-500 text-white",
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
        className: "bg-gradient-to-r from-green-400 to-green-500 text-white",
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
        analysisMode,
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
              "bg-gradient-to-r from-orange-400 to-orange-500 text-white",
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
          className: "bg-gradient-to-r from-green-400 to-green-500 text-white",
        });
      }, 1000);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error en la descarga",
        description:
          error instanceof Error ? error.message : "Error desconocido",
        className: "bg-gradient-to-r from-red-400 to-red-500 text-white",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const hasResults = suggestions || missingProducts || crossResults;

  return (
    <div className="flex min-h-screen w-full flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100/50">
      <header className="sticky top-0 z-50 flex h-20 items-center justify-between border-b border-slate-200 bg-white/95 backdrop-blur-xl px-4 md:px-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Logo className="h-10 w-10 text-blue-500" />
            <div className="absolute -top-1 -right-1 h-3 w-3 bg-gradient-to-r from-blue-400 to-blue-500 rounded-full"></div>
          </div>
          <div>
            <h1 className="font-headline text-2xl font-bold text-blue-600">
              Optimizador de Surtido
            </h1>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-3">
            <Tabs
              value={analysisMode}
              onValueChange={(v: any) => {
                setAnalysisMode(v);
                setSuggestions(null);
                setMissingProducts(null);
                setCrossResults(null);
              }}
            >
              <TabsList className="bg-blue-50 p-1 rounded-lg border border-blue-200">
                <TabsTrigger
                  value="sales"
                  className="text-xs sm:text-sm rounded-md px-4 py-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white transition-all duration-200 text-blue-700"
                >
                  <TrendingUp className="h-3.5 w-3.5 mr-2" />
                  Análisis por Ventas
                </TabsTrigger>
                <TabsTrigger
                  value="levels"
                  className="text-xs sm:text-sm rounded-md px-4 py-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white transition-all duration-200 text-blue-700"
                >
                  <BarChart3 className="h-3.5 w-3.5 mr-2" />
                  Surtido por Niveles
                </TabsTrigger>
                <TabsTrigger
                  value="cross"
                  className="text-xs sm:text-sm rounded-md px-4 py-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white transition-all duration-200 text-blue-700"
                >
                  <GitCompare className="h-3.5 w-3.5 mr-2" />
                  Cruce SAP vs WMS
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Lote Selection - Solo visible en modo Cross */}
            {analysisMode === "cross" && (
              <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-md border border-blue-200">
                <Switch
                  checked={groupByLot}
                  onCheckedChange={setGroupByLot}
                  id="lot-toggle"
                  className="data-[state=checked]:bg-blue-500 h-5 w-9"
                />
                <Label
                  htmlFor="lot-toggle"
                  className="text-xs font-medium text-blue-600 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Agrupar por Lote</span>
                    <span className="sm:hidden">Por Lote</span>
                  </div>
                </Label>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleAnalyzeClick}
            disabled={isLoading}
            size="default"
            className="relative bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.02] rounded-lg px-6 py-5 text-white"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="font-semibold">Analizando...</span>
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                <span className="font-semibold">Ejecutar Análisis</span>
              </>
            )}
          </Button>

          {hasResults && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="default"
                  disabled={isDownloading}
                  className="relative border border-green-500 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg px-6 py-5 hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      <span className="font-semibold">Descargar</span>
                      <ChevronDown className="h-4 w-4 ml-2 opacity-80" />
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-72 rounded-lg border border-blue-200 shadow-lg bg-white"
                align="end"
              >
                <DropdownMenuLabel className="font-bold text-base flex items-center gap-2 text-blue-600">
                  <Database className="h-4 w-4 text-blue-500" />
                  Opciones de Descarga
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-blue-200" />

                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={handleDownloadReport}
                    className="flex items-center gap-3 py-3 cursor-pointer hover:bg-blue-50 rounded-md transition-colors"
                  >
                    <div className="p-2 bg-blue-100 rounded-md">
                      <FileSpreadsheet className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-blue-700">
                        Reporte Completo
                      </p>
                      <p className="text-xs text-blue-600">
                        Análisis detallado en Excel
                      </p>
                    </div>
                  </DropdownMenuItem>

                  {analysisMode === "sales" || analysisMode === "levels" ? (
                    <DropdownMenuItem
                      onClick={handleDownloadWMS}
                      className="flex items-center gap-3 py-3 cursor-pointer hover:bg-green-50 rounded-md transition-colors"
                    >
                      <div className="p-2 bg-green-100 rounded-md">
                        <FileText className="h-5 w-5 text-green-500" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-green-700">
                          Archivo WMS
                        </p>
                        <p className="text-xs text-green-600">
                          Formato para sistema de almacén
                        </p>
                      </div>
                    </DropdownMenuItem>
                  ) : null}

                  {analysisMode === "sales" || analysisMode === "levels" ? (
                    <>
                      <DropdownMenuSeparator className="bg-blue-200" />

                      <DropdownMenuItem
                        onClick={handleDownloadBoth}
                        className="flex items-center gap-3 py-3 cursor-pointer hover:bg-purple-50 rounded-md transition-colors bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200"
                      >
                        <div className="p-2 bg-gradient-to-r from-purple-100 to-blue-100 rounded-md">
                          <Download className="h-5 w-5 text-purple-500" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-purple-700">
                            Descargar Ambos
                          </p>
                          <p className="text-xs text-purple-600">
                            Reporte completo + archivo WMS
                          </p>
                        </div>
                        <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs">
                          Recomendado
                        </Badge>
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuGroup>

                <DropdownMenuSeparator className="bg-blue-200" />

                <div className="px-2 py-1.5">
                  <p className="text-xs text-blue-600">
                    {analysisMode === "cross"
                      ? "Disponible: Reporte de discrepancias"
                      : "Disponible: Reporte completo y WMS"}
                  </p>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
          {analysisMode === "sales" && (
            <>
              <FileUploader
                title="Facturación (ERP)"
                onFileRead={(c) => handleFileRead(c, "sales")}
                onFileReset={() => setSalesData(null)}
                recordCount={salesData?.length}
              />
              <FileUploader
                title="Inventario (WMS)"
                onFileRead={(c) => handleFileRead(c, "inventory")}
                onFileReset={() => setInventoryData(null)}
                recordCount={inventoryData?.length}
              />
            </>
          )}
          {analysisMode === "levels" && (
            <>
              <FileUploader
                title="Inventario (WMS)"
                onFileRead={(c) => handleFileRead(c, "inventory")}
                onFileReset={() => setInventoryData(null)}
                recordCount={inventoryData?.length}
              />
              <FileUploader
                title="Niveles (Mín/Máx)"
                onFileRead={(c) => handleFileRead(c, "minMax")}
                onFileReset={() => setMinMaxData(null)}
                recordCount={minMaxData?.length}
              />
            </>
          )}
          {analysisMode === "cross" && (
            <>
              <FileUploader
                title="Inventario (SAP)"
                onFileRead={(c) => handleFileRead(c, "sap")}
                onFileReset={() => setSapData(null)}
                recordCount={sapData?.length}
              />
              <FileUploader
                title="Inventario (WMS)"
                onFileRead={(c) => handleFileRead(c, "wms")}
                onFileReset={() => setWmsData(null)}
                recordCount={wmsData?.length}
              />
            </>
          )}
        </div>

        <Card className="min-h-[500px] border border-blue-200 shadow-lg rounded-xl overflow-hidden bg-white">
          <div className="h-1 bg-gradient-to-r from-blue-400 to-blue-500 w-full"></div>
          <CardContent className="p-6 md:p-8">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-[400px] gap-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-100 rounded-full"></div>
                  <RefreshCcw className="h-16 w-16 animate-spin text-blue-500 relative z-10" />
                </div>
                <div className="text-center space-y-3">
                  <p className="text-2xl font-bold text-blue-600">
                    Procesando datos...
                  </p>
                  <p className="text-blue-500">
                    Analizando patrones y generando insights
                  </p>
                  <Progress value={65} className="w-64 h-2 bg-blue-200">
                    <div className="h-full bg-gradient-to-r from-blue-400 to-blue-500"></div>
                  </Progress>
                </div>
              </div>
            ) : hasResults ? (
              <div className="space-y-8">
                {missingProducts && missingProducts.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-50 rounded-lg border border-red-200">
                          <AlertTriangle className="h-6 w-6 text-red-500" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-red-600">
                            Faltantes Críticos
                          </h3>
                          <p className="text-sm text-red-500">
                            Productos que requieren atención inmediata
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="destructive"
                        className="px-3 py-1.5 text-sm font-medium bg-gradient-to-r from-red-400 to-red-500 text-white"
                      >
                        {missingProducts.length} alertas
                      </Badge>
                    </div>
                    <div className="border border-red-200 rounded-lg overflow-hidden bg-red-50/50">
                      <MissingStockTable products={missingProducts} />
                    </div>
                  </div>
                )}
                {suggestions && suggestions.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
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
                      <Badge className="px-3 py-1.5 text-sm font-medium bg-gradient-to-r from-blue-400 to-blue-500 text-white">
                        {suggestions.length} oportunidades
                      </Badge>
                    </div>
                    <div className="border border-blue-200 rounded-lg overflow-hidden bg-blue-50/50">
                      <ResultsTable
                        results={suggestions}
                        analysisMode={analysisMode as any}
                        onSort={() => {}}
                        sortConfig={null}
                      />
                    </div>
                  </div>
                )}
                {crossResults && (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-50 rounded-lg border border-purple-200">
                          <GitCompare className="h-6 w-6 text-purple-500" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-purple-600">
                            Discrepancias SAP vs WMS
                          </h3>
                          <p className="text-sm text-purple-500">
                            Comparación entre sistemas de inventario
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="px-3 py-1.5 text-sm font-medium border-purple-300 text-purple-600 bg-purple-50"
                      >
                        {crossResults.results?.length || 0} diferencias
                      </Badge>
                    </div>
                    <div className="border border-purple-200 rounded-lg overflow-hidden bg-purple-50/50">
                      <InventoryCrossTable data={crossResults} />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px] text-blue-500 gap-8">
                <div className="relative">
                  <Warehouse className="h-32 w-32 opacity-20" />
                  <div className="absolute inset-0 bg-blue-100 rounded-full"></div>
                </div>
                <div className="text-center space-y-3 max-w-md">
                  <h3 className="text-2xl font-bold text-blue-600">
                    {analysisMode === "cross" && "¡Listo para cruzar sistemas!"}
                    {analysisMode === "sales" &&
                      "Analiza tus ventas e inventario"}
                    {analysisMode === "levels" &&
                      "Optimiza tus niveles de stock"}
                  </h3>
                  <p className="text-blue-600">
                    {analysisMode === "cross" &&
                      "Sube los archivos SAP y WMS para identificar discrepancias"}
                    {analysisMode === "sales" &&
                      "Carga los datos de facturación e inventario para obtener sugerencias"}
                    {analysisMode === "levels" &&
                      "Sube el inventario actual y los parámetros mín/máx"}
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse"></div>
                    <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse delay-100"></div>
                    <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse delay-200"></div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
