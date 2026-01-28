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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  salesColumnMapping,
  inventoryColumnMapping,
  minMaxColumnMapping,
} from "./config";

export default function Home() {
  const [analysisMode, setAnalysisMode] = useState<"sales" | "levels">("sales");
  const [salesData, setSalesData] = useState<any[] | null>(null);
  const [inventoryData, setInventoryData] = useState<any[] | null>(null);
  const [minMaxData, setMinMaxData] = useState<any[] | null>(null);
  const [suggestions, setSuggestions] =
    useState<GenerateRestockSuggestionsOutput | null>(null);
  const [missingProducts, setMissingProducts] = useState<
    MissingProductsOutput[] | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "ascending" | "descending";
  } | null>(null);
  const { toast } = useToast();

  const handleFileRead = (
    content: string | ArrayBuffer,
    type: "sales" | "inventory" | "minMax",
  ) => {
    try {
      let mapping;
      let numericCols: string[] = [];
      if (type === "sales") {
        mapping = salesColumnMapping;
        numericCols = ["cantidadConfirmada"];
      } else if (type === "inventory") {
        mapping = inventoryColumnMapping;
        numericCols = ["disponible", "diasFPC"];
      } else {
        // type === 'minMax'
        mapping = minMaxColumnMapping;
        numericCols = ["cantidadMinima", "cantidadMaxima"];
      }

      const data = parseData(content, mapping, numericCols);
      const recordCount = data.length;

      if (recordCount === 0) {
        toast({
          variant: "destructive",
          title: "Archivo Vacío o Inválido",
          description:
            "El archivo no contiene datos o el formato es incorrecto.",
        });
        return handleFileReset(type, true);
      }

      if (type === "sales") {
        setSalesData(data);
        toast({
          title: "Éxito",
          description: `Archivo de facturación cargado con ${recordCount} registros.`,
        });
      } else if (type === "inventory") {
        setInventoryData(data);
        toast({
          title: "Éxito",
          description: `Archivo de inventario cargado con ${recordCount} registros.`,
        });
      } else {
        setMinMaxData(data);
        toast({
          title: "Éxito",
          description: `Archivo de Mín/Máx cargado con ${recordCount} registros.`,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido";
      toast({
        variant: "destructive",
        title: "Error al procesar el archivo",
        description: message,
      });
      handleFileReset(type, true);
    }
  };

  const handleFileReset = (
    type: "sales" | "inventory" | "minMax",
    silent = false,
  ) => {
    if (type === "sales") {
      if (salesData !== null && !silent)
        toast({ title: "Archivo de facturación quitado." });
      setSalesData(null);
    } else if (type === "inventory") {
      if (inventoryData !== null && !silent)
        toast({ title: "Archivo de inventario quitado." });
      setInventoryData(null);
    } else {
      if (minMaxData !== null && !silent)
        toast({ title: "Archivo de Mín/Máx quitado." });
      setMinMaxData(null);
    }
    setSuggestions(null);
    setMissingProducts(null);
  };

  const handleSort = (key: string) => {
    let direction: "ascending" | "descending" = "ascending";
    if (sortConfig?.key === key && sortConfig?.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const sortedSuggestions = useMemo(() => {
    if (!suggestions) return null;
    if (sortConfig) {
      const sortableItems = [...suggestions];
      sortableItems.sort((a, b) => {
        const key = sortConfig.key as keyof typeof a;
        // Type assertion for safety
        const valA = a[key as keyof typeof a] as number;
        const valB = b[key as keyof typeof b] as number;

        if (valA < valB) {
          return sortConfig.direction === "ascending" ? -1 : 1;
        }
        if (valA > valB) {
          return sortConfig.direction === "ascending" ? 1 : -1;
        }
        return 0;
      });
      return sortableItems;
    }
    return suggestions;
  }, [suggestions, sortConfig]);

  const handleAnalyzeClick = async () => {

    if (analysisMode === "sales") {
      if (!salesData || !inventoryData) {
        toast({
          variant: "destructive",
          title: "Faltan archivos",
          description: "Por favor, carga ambos archivos antes de analizar.",
        });
        return;
      }
    }

    if (analysisMode === "levels") {
      if (!inventoryData || !minMaxData) {
        toast({
          variant: "destructive",
          title: "Faltan archivos",
          description:
            "Por favor, carga el archivo de inventario y el de niveles Mín/Máx.",
        });
        return;
      }
    }

    setIsLoading(true);
    setSuggestions(null);
    setMissingProducts(null);
    setSortConfig(null);

    const result = await runAnalysis(
      analysisMode,
      inventoryData,
      salesData,
      minMaxData,
    );

    setIsLoading(false);

    if (result.error) {
      toast({
        variant: "destructive",
        title: "Error de Análisis",
        description: result.error,
      });
    } else if (result.data) {
      setSuggestions(result.data.suggestions);
      setMissingProducts(result.data.missingProducts);

      const actionableSuggestions = result.data.suggestions.filter(
        (s) => s.cantidadARestockear > 0,
      ).length;

      let toastDescription = "";

      if (analysisMode === "levels") {
        if (actionableSuggestions > 0) {
          toastDescription = `Se encontraron ${actionableSuggestions} oportunidades de surtido por nivel de stock.`;
        } else {
          toastDescription =
            "No se encontraron ubicaciones que necesiten surtido según los niveles de stock actuales.";
        }
      } else {
        // Sales mode
        if (actionableSuggestions > 0) {
          toastDescription += `Se generaron ${actionableSuggestions} sugerencias de surtido. `;
        }
        if (result.data.missingProducts.length > 0) {
          toastDescription += `Se encontraron ${result.data.missingProducts.length} productos sin stock.`;
        }
        if (toastDescription === "") {
          toastDescription =
            "El análisis se completó sin encontrar discrepancias que requieran acción.";
        }
      }

      toast({
        title: "Análisis Completado",
        description: toastDescription.trim(),
      });
    }
  };

  const handleDownloadWMS = async () => {
    if (!suggestions) return;

    const actionableSuggestions = suggestions.filter(
      (s) => s.cantidadARestockear > 0,
    );
    if (actionableSuggestions.length === 0) {
      toast({
        variant: "destructive",
        title: "Sin acciones",
        description: "No hay sugerencias de surtido para descargar.",
      });
      return;
    }

    setIsDownloading(true);
    const result = await generateWmsFiles(actionableSuggestions, analysisMode);
    setIsDownloading(false);

    if (result.error) {
      toast({
        variant: "destructive",
        title: "Error de Descarga",
        description: result.error,
      });
    } else if (result.data) {
      downloadFile(
        result.data.file,
        result.data.filename,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      toast({
        title: "Descarga Exitosa",
        description: `El archivo ${result.data.filename} ha sido generado.`,
      });
    }
  };

  const handleDownloadReport = async () => {
    if (!hasResults) {
      toast({
        variant: "destructive",
        title: "Sin datos",
        description: "No hay resultados para generar un reporte.",
      });
      return;
    }

    setIsDownloading(true);
    const result = await generateFullReportFile(
      suggestions,
      missingProducts,
      analysisMode,
    );
    setIsDownloading(false);

    if (result.error) {
      toast({
        variant: "destructive",
        title: "Error de Descarga",
        description: result.error,
      });
    } else if (result.data) {
      downloadFile(
        result.data.file,
        result.data.filename,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      toast({
        title: "Descarga Exitosa",
        description: `El archivo ${result.data.filename} ha sido generado.`,
      });
    }
  };

  const isAnalyzeDisabled =
    isLoading ||
    !inventoryData ||
    (analysisMode === "sales" && !salesData) ||
    (analysisMode === "levels" && !minMaxData);
  const hasResults =
    (suggestions && suggestions.length > 0) ||
    (missingProducts && missingProducts.length > 0);
  const actionableSuggestionsCount =
    suggestions?.filter((s) => s.cantidadARestockear > 0).length ?? 0;

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
        <div className="flex items-center gap-2">
          <Logo className="h-8 w-8 text-primary" />
          <h1 className="font-headline text-lg sm:text-xl md:text-2xl font-bold text-primary">
            Optimizador de Surtido
          </h1>
        </div>

        <div>
          <Tabs
            value={analysisMode}
            onValueChange={(value) => {
              if (!value) return;
              const newMode = value as "sales" | "levels";
              setAnalysisMode(newMode);
              // Do not reset files when mode changes to allow switching back and forth
              setSuggestions(null);
              setMissingProducts(null);
            }}
          >
            <TabsList>
              <TabsTrigger
                value="sales"
                className="px-2 sm:px-3 text-xs sm:text-sm"
              >
                Análisis por Ventas
              </TabsTrigger>
              <TabsTrigger
                value="levels"
                className="px-2 sm:px-3 text-xs sm:text-sm"
              >
                Surtido por Niveles
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleAnalyzeClick}
            disabled={isAnalyzeDisabled}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bot className="h-4 w-4" />
            )}
            <span className="hidden md:inline">Analizar</span>
          </Button>
          {hasResults && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={isDownloading}>
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  <span className="hidden md:inline">Descargar</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {actionableSuggestionsCount > 0 && (
                  <DropdownMenuItem onClick={handleDownloadWMS}>
                    Archivo WMS ({analysisMode === "sales" ? "LRLD" : "LTLD"})
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleDownloadReport}>
                  Reporte Completo (Excel)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-8 p-4 md:gap-8 md:p-8">
        <div className="w-full">
          <h2 className="text-lg font-semibold text-center text-primary mb-4">
            1. Carga los Archivos
          </h2>
          <div
            className={cn(
              "grid gap-4 md:grid-cols-2",
              (analysisMode === "sales" || analysisMode === "levels") &&
                "lg:grid-cols-2",
              analysisMode === "sales" && "lg:grid-cols-2",
            )}
          >
            {analysisMode === "sales" && (
              <FileUploader
                title="Archivo de Facturación (ERP)"
                onFileRead={(content) => handleFileRead(content, "sales")}
                onFileReset={() => handleFileReset("sales")}
                recordCount={salesData?.length}
              />
            )}
            <FileUploader
              title="Archivo de Inventario (WMS)"
              onFileRead={(content) => handleFileRead(content, "inventory")}
              onFileReset={() => handleFileReset("inventory")}
              recordCount={inventoryData?.length}
            />
            {analysisMode === "levels" && (
              <FileUploader
                title="Archivo de Niveles (Mín/Máx)"
                onFileRead={(content) => handleFileRead(content, "minMax")}
                onFileReset={() => handleFileReset("minMax")}
                recordCount={minMaxData?.length}
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            El sistema detectará automáticamente las columnas basándose en la
            configuración interna.
          </p>
        </div>

        <Card className="flex-1">
          <CardContent className="p-4 md:p-6 h-full">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-4 text-center min-h-[300px] h-full">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <h3 className="font-headline text-2xl font-bold tracking-tight">
                  Generando sugerencias...
                </h3>
                <p className="text-muted-foreground">
                  La IA está analizando tus datos. Esto puede tardar unos
                  momentos.
                </p>
              </div>
            ) : hasResults ? (
              <div className="space-y-8">
                {missingProducts && missingProducts.length > 0 && (
                  <div>
                    <h3 className="font-headline text-xl font-bold tracking-tight mb-4 flex items-center gap-2 text-destructive">
                      <AlertTriangle />
                      Productos Facturados Sin Stock
                    </h3>
                    <MissingStockTable products={missingProducts} />
                  </div>
                )}
                {sortedSuggestions && sortedSuggestions.length > 0 && (
                  <div>
                    <h3 className="font-headline text-xl font-bold tracking-tight mb-4">
                      Sugerencias de Surtido y Estado
                    </h3>
                    <ResultsTable
                      results={sortedSuggestions}
                      analysisMode={analysisMode}
                      onSort={handleSort}
                      sortConfig={sortConfig}
                    />
                  </div>
                )}
              </div>
            ) : !isAnalyzeDisabled && !isLoading ? (
              <div className="flex flex-col items-center justify-center gap-4 text-center min-h-[300px] h-full">
                <FileWarning className="h-16 w-16 text-muted-foreground" />
                <h3 className="font-headline text-2xl font-bold tracking-tight">
                  {analysisMode === "sales"
                    ? "Análisis completado sin acciones"
                    : "Todo en orden"}
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {analysisMode === "sales"
                    ? "El inventario disponible en picking cubre la demanda de las ventas. No se necesitan surtidos ni se encontraron productos sin stock."
                    : "No se encontraron ubicaciones de picking que necesiten reabastecimiento según sus niveles Mín/Máx."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 text-center min-h-[300px] h-full">
                <Warehouse className="h-16 w-16 text-muted-foreground" />
                <h3 className="font-headline text-2xl font-bold tracking-tight">
                  Esperando archivos...
                </h3>
                <p className="text-muted-foreground">
                  Selecciona un modo de análisis y carga los archivos para
                  comenzar.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
