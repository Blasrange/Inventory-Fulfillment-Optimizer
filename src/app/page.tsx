
'use client';

import { useState } from 'react';
import { Bot, FileWarning, Loader2, Warehouse, AlertTriangle, Download, Settings, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileUploader } from '@/components/file-uploader';
import { parseData } from '@/lib/csv';
import { downloadFile } from '@/lib/download';
import { useToast } from '@/hooks/use-toast';
import { runAnalysis, generateWmsFiles, generateFullReportFile } from '@/app/actions';
import type { GenerateRestockSuggestionsOutput, MissingProductsOutput } from '@/ai/flows/schemas';
import { Logo } from '@/components/icons';
import { ResultsTable } from '@/components/results-table';
import { MissingStockTable } from '@/components/missing-stock-table';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';


// --- CONFIGURACIÓN DE COLUMNAS ---
// Para cada campo interno (ej: 'material'), provee una lista de posibles
// nombres de columna que pueden aparecer en los archivos de tus clientes.
// El sistema buscará estos nombres en orden y usará el primero que encuentre.
const salesColumnMapping = {
  material: ['Material', 'ID de Producto', 'codigo'],
  descripcion: ['Descripción', 'Nombre de Artículo'],
  cantidadConfirmada: ['cantidad confirmada', 'Cant. Facturada'],
};

const inventoryColumnMapping = {
  sku: ['SKU', 'Item Code'],
  lpn: ['LPN', 'Pallet ID'],
  descripcion: ['Descripcion', 'Description'],
  localizacion: ['Localizacion', 'Location'],
  disponible: ['Disponible', 'Available'],
  estado: ['Estado', 'Status'],
  fechaVencimiento: ['Fecha de vencimiento', 'Expiration', 'fecha caducidad'],
  diasFPC: ['FPC', 'Days to Exp'],
};

const minMaxColumnMapping = {
    sku: ['sku', 'item'],
    lpn: ['lpn', 'pallet'],
    localizacion: ['localizacion', 'loc'],
    cantidadMinima: ['cantidad minima', 'min'],
    cantidadMaxima: ['cantidad maxima', 'max'],
};


export default function Home() {
  const [analysisMode, setAnalysisMode] = useState<'sales' | 'levels'>('sales');
  const [salesData, setSalesData] = useState<any[] | null>(null);
  const [inventoryData, setInventoryData] = useState<any[] | null>(null);
  const [minMaxData, setMinMaxData] = useState<any[] | null>(null);
  const [suggestions, setSuggestions] = useState<GenerateRestockSuggestionsOutput | null>(null);
  const [missingProducts, setMissingProducts] = useState<MissingProductsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const handleFileRead = (
    content: string | ArrayBuffer,
    type: 'sales' | 'inventory' | 'minMax'
  ) => {
    try {
      let mapping;
      let numericCols: string[] = [];
      if (type === 'sales') {
        mapping = salesColumnMapping;
        numericCols = ['cantidadConfirmada'];
      } else if (type === 'inventory') {
        mapping = inventoryColumnMapping;
        numericCols = ['disponible', 'diasFPC'];
      } else { // type === 'minMax'
        mapping = minMaxColumnMapping;
        numericCols = ['cantidadMinima', 'cantidadMaxima'];
      }

      const data = parseData(content, mapping, numericCols);
      
      if (type === 'sales') {
        setSalesData(data);
        toast({ title: 'Éxito', description: `Archivo de facturación cargado con ${data.length} registros.` });
      } else if (type === 'inventory') {
        setInventoryData(data);
        toast({ title: 'Éxito', description: `Archivo de inventario cargado con ${data.length} registros.` });
      } else {
        setMinMaxData(data);
        toast({ title: 'Éxito', description: `Archivo de Mín/Máx cargado con ${data.length} registros.` });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      toast({
        variant: 'destructive',
        title: 'Error al procesar el archivo',
        description: message,
      });
    }
  };

  const handleFileReset = (type: 'sales' | 'inventory' | 'minMax') => {
    if (type === 'sales') {
      setSalesData(null);
    } else if (type === 'inventory') {
      setInventoryData(null);
    } else {
      setMinMaxData(null);
    }
    setSuggestions(null);
    setMissingProducts(null);
  };
  
  const handleAnalyzeClick = async () => {
    if (analysisMode === 'sales') {
        if (!salesData || !inventoryData) {
          toast({
            variant: 'destructive',
            title: 'Faltan archivos',
            description: 'Por favor, carga ambos archivos antes de analizar.',
          });
          return;
        }
    }
    
    if (analysisMode === 'levels') {
       if (!inventoryData || !minMaxData) {
        toast({
          variant: 'destructive',
          title: 'Faltan archivos',
          description: 'Por favor, carga el archivo de inventario y el de niveles Mín/Máx.',
        });
        return;
      }
    }


    setIsLoading(true);
    setSuggestions(null);
    setMissingProducts(null);

    const result = await runAnalysis(analysisMode, inventoryData, salesData, minMaxData);
    
    setIsLoading(false);

    if (result.error) {
      toast({
        variant: 'destructive',
        title: 'Error de Análisis',
        description: result.error,
      });
    } else if (result.data) {
      setSuggestions(result.data.suggestions);
      setMissingProducts(result.data.missingProducts);
      
      const actionableSuggestions = result.data.suggestions.filter(s => s.cantidadARestockear > 0).length;

      let toastDescription = '';

      if (analysisMode === 'levels') {
        if (actionableSuggestions > 0) {
            toastDescription = `Se encontraron ${actionableSuggestions} oportunidades de surtido por nivel de stock.`;
        } else {
            toastDescription = 'No se encontraron ubicaciones que necesiten surtido según los niveles de stock actuales.';
        }
      } else { // Sales mode
        if (actionableSuggestions > 0) {
          toastDescription += `Se generaron ${actionableSuggestions} sugerencias de surtido. `;
        }
        if (result.data.missingProducts.length > 0) {
          toastDescription += `Se encontraron ${result.data.missingProducts.length} productos sin stock.`;
        }
        if (toastDescription === '') {
          toastDescription = 'El análisis se completó sin encontrar discrepancias que requieran acción.';
        }
      }


      toast({
        title: 'Análisis Completado',
        description: toastDescription.trim(),
      });
    }
  };

  const handleDownloadWMS = async () => {
    if (!suggestions) return;
    
    const actionableSuggestions = suggestions.filter(s => s.cantidadARestockear > 0);
    if (actionableSuggestions.length === 0) {
        toast({
            variant: 'destructive',
            title: 'Sin acciones',
            description: 'No hay sugerencias de surtido para descargar.',
        });
        return;
    }

    setIsDownloading(true);
    const result = await generateWmsFiles(actionableSuggestions, analysisMode);
    setIsDownloading(false);

    if (result.error) {
        toast({
            variant: 'destructive',
            title: 'Error de Descarga',
            description: result.error,
        });
    } else if (result.data) {
        downloadFile(result.data.file, result.data.filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        toast({
            title: 'Descarga Exitosa',
            description: `El archivo ${result.data.filename} ha sido generado.`,
        });
    }
  };

  const handleDownloadReport = async () => {
    if (!hasResults) {
        toast({
            variant: 'destructive',
            title: 'Sin datos',
            description: 'No hay resultados para generar un reporte.',
        });
        return;
    }

    setIsDownloading(true);
    const result = await generateFullReportFile(suggestions, missingProducts, analysisMode);
    setIsDownloading(false);

    if (result.error) {
        toast({
            variant: 'destructive',
            title: 'Error de Descarga',
            description: result.error,
        });
    } else if (result.data) {
        downloadFile(result.data.file, result.data.filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        toast({
            title: 'Descarga Exitosa',
            description: `El archivo ${result.data.filename} ha sido generado.`,
        });
    }
  };


  const isAnalyzeDisabled = isLoading || !inventoryData || (analysisMode === 'sales' && !salesData) || (analysisMode === 'levels' && !minMaxData);
  const hasResults = (suggestions && suggestions.length > 0) || (missingProducts && missingProducts.length > 0);
  const actionableSuggestionsCount = suggestions?.filter(s => s.cantidadARestockear > 0).length ?? 0;

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
              const newMode = value as 'sales' | 'levels';
              setAnalysisMode(newMode);
              // Reset files and results when mode changes
              setSalesData(null);
              setInventoryData(null);
              setMinMaxData(null);
              setSuggestions(null);
              setMissingProducts(null);
            }}
          >
            <TabsList>
              <TabsTrigger value="sales" className="px-2 sm:px-3 text-xs sm:text-sm">Análisis por Ventas</TabsTrigger>
              <TabsTrigger value="levels" className="px-2 sm:px-3 text-xs sm:text-sm">Surtido por Niveles</TabsTrigger>
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
                        Archivo WMS ({analysisMode === 'sales' ? 'LRLD' : 'LTLD'})
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
            <div className={cn("grid gap-4 md:grid-cols-2", (analysisMode === 'sales' || analysisMode === 'levels') && "lg:grid-cols-2", analysisMode === 'sales' && 'lg:grid-cols-2' )}>
              {analysisMode === 'sales' && (
                <FileUploader
                  title="Archivo de Facturación (ERP)"
                  onFileRead={(content) => handleFileRead(content, 'sales')}
                  onFileReset={() => handleFileReset('sales')}
                  recordCount={salesData?.length}
                />
              )}
              <FileUploader
                title="Archivo de Inventario (WMS)"
                onFileRead={(content) => handleFileRead(content, 'inventory')}
                onFileReset={() => handleFileReset('inventory')}
                recordCount={inventoryData?.length}
              />
              {analysisMode === 'levels' && (
                <FileUploader
                  title="Archivo de Niveles (Mín/Máx)"
                  onFileRead={(content) => handleFileRead(content, 'minMax')}
                  onFileReset={() => handleFileReset('minMax')}
                  recordCount={minMaxData?.length}
                />
              )}
            </div>
             <p className="text-xs text-muted-foreground text-center mt-2">
                El sistema detectará automáticamente las columnas basándose en la configuración interna.
              </p>
        </div>

        <Card className="flex-1">
          <CardContent className="p-4 md:p-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-4 text-center min-h-[400px]">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <h3 className="font-headline text-2xl font-bold tracking-tight">
                  Generando sugerencias...
                </h3>
                <p className="text-muted-foreground">
                  La IA está analizando tus datos. Esto puede tardar unos momentos.
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
                {suggestions && suggestions.length > 0 && (
                  <div>
                    <h3 className="font-headline text-xl font-bold tracking-tight mb-4">Sugerencias de Surtido y Estado</h3>
                    <ResultsTable results={suggestions} analysisMode={analysisMode}/>
                  </div>
                )}
              </div>
            ) : (inventoryData && (analysisMode === 'sales' ? salesData : minMaxData)) ? (
              <div className="flex flex-col items-center justify-center gap-4 text-center min-h-[400px]">
                <FileWarning className="h-16 w-16 text-muted-foreground" />
                <h3 className="font-headline text-2xl font-bold tracking-tight">
                  {analysisMode === 'sales' ? 'No se encontraron acciones requeridas' : 'Todo en orden'}
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {analysisMode === 'sales' ? 'El inventario parece estar alineado con las ventas recientes. No se necesitan surtidos ni se encontraron productos sin stock.' : 'No se encontraron ubicaciones de picking que necesiten reabastecimiento según sus niveles Mín/Máx.'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 text-center min-h-[400px]">
                <Warehouse className="h-16 w-16 text-muted-foreground" />
                <h3 className="font-headline text-2xl font-bold tracking-tight">
                  Esperando archivos...
                </h3>
                <p className="text-muted-foreground">
                  Selecciona un modo de análisis y carga los archivos para comenzar.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
