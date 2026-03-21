"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FileUploader } from "@/components/file-uploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LabelPreview } from "@/components/label-preview";
import { useToast } from "@/hooks/use-toast";
import {
  Download,
  Search,
  Columns,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  FileJson,
  FileSpreadsheet,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Filter,
  X,
  Tag,
  Eye,
  EyeOff,
  LayoutGrid,
  List,
  AlertCircle,
  Warehouse,
  FileCode2,
  Sparkles,
  Printer,
  RefreshCw,
  MonitorDown,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { parseExitoExcel } from "@/features/exito-labels/parser";
import {
  generateExitoBatchZpl,
  generateExitoLabelZpl,
} from "@/features/exito-labels/zpl";
import type { ExitoLabelData } from "@/ai/flows/schemas";

const HEADERS: { key: keyof ExitoLabelData; label: string }[] = [
  { key: "nc", label: "NC" },
  { key: "ct", label: "Código Dependencia" },
  { key: "codigoBarra", label: "Código de Barra Producto" },
  { key: "tienda", label: "Tienda" },
  { key: "depto", label: "Departamento" },
  { key: "ciudad", label: "Ciudad" },
  { key: "orden", label: "Orden Compra" },
  { key: "direccion", label: "Dirección" },
  { key: "numeroCaja", label: "Caja" },
  { key: "totalCajas", label: "Total Cajas" },
  { key: "cedi", label: "CEDI" },
  { key: "desc", label: "Descripción" },
];

function downloadText(content: string, filename: string): void {
  const blob = new Blob([
    content,
    { type: "text/plain;charset=utf-8" },
  ] as BlobPart[]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Cuando la app está desplegada en Vercel (u otro host remoto), las rutas
 * /api/printers y /api/print-label corren en la nube y no tienen acceso a
 * las impresoras locales. En ese caso el browser llama directamente al
 * agente local (local-print-agent.mjs) corriendo en la misma PC del usuario.
 *
 * En desarrollo local ambas rutas funcionan igual porque Next.js corre en
 * localhost también.
 */
function getPrinterApiBase(): string {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1";
  return isLocal ? "" : "http://localhost:3021";
}

export function ExitoLabelsView() {
  const [labels, setLabels] = useState<ExitoLabelData[]>([]);
  const [zpl, setZpl] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  // Tabla state
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof ExitoLabelData;
    direction: "asc" | "desc";
  } | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [copiedRow, setCopiedRow] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Impresión
  const [printers, setPrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState("");
  const [isLoadingPrinters, setIsLoadingPrinters] = useState(false);
  const [isPrintingBatch, setIsPrintingBatch] = useState(false);
  const [printingRows, setPrintingRows] = useState<Set<number>>(new Set());
  const [previewLabel, setPreviewLabel] = useState<ExitoLabelData | null>(null);
  const [agentStatus, setAgentStatus] = useState<
    "unknown" | "online" | "offline"
  >("unknown");
  const isRemoteHost =
    typeof window !== "undefined" && getPrinterApiBase() !== "";

  const { toast } = useToast();

  const openPreview = (label: ExitoLabelData) => {
    // Evita conflicto de foco/lock al abrir Dialog desde DropdownMenu.
    setTimeout(() => setPreviewLabel(label), 0);
  };

  const closePreview = () => {
    setPreviewLabel(null);
    // Mitiga un bug intermitente de Radix donde queda bloqueado el body.
    if (typeof document !== "undefined") {
      requestAnimationFrame(() => {
        if (document.body.style.pointerEvents === "none") {
          document.body.style.pointerEvents = "";
        }
      });
    }
  };

  const fetchPrinters = async () => {
    setIsLoadingPrinters(true);
    const remote = getPrinterApiBase() !== "";
    try {
      const res = await fetch(`${getPrinterApiBase()}/api/printers`);
      const data = await res.json();
      const names: string[] = (data.printers ?? []).map(
        (p: { name: string }) => p.name,
      );
      setPrinters(names);
      if (names.length > 0 && !selectedPrinter) setSelectedPrinter(names[0]);
      if (remote) setAgentStatus("online");
    } catch {
      if (remote) {
        setAgentStatus("offline");
      } else {
        toast({
          variant: "destructive",
          title: "❌ Error al obtener impresoras",
          description: "No se pudieron obtener las impresoras.",
        });
      }
    } finally {
      setIsLoadingPrinters(false);
    }
  };

  const printLabels = async (zplContent: string, rowIndex: number) => {
    if (!selectedPrinter) {
      toast({
        variant: "destructive",
        title: "❌ Sin impresora",
        description: "Selecciona una impresora antes de imprimir.",
      });
      return;
    }
    if (rowIndex === -1) setIsPrintingBatch(true);
    else setPrintingRows((prev) => new Set(prev).add(rowIndex));
    try {
      const res = await fetch(`${getPrinterApiBase()}/api/print-label`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ printerName: selectedPrinter, zpl: zplContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al imprimir");
      toast({
        title: "🖨️ Enviado a imprimir",
        description: `Etiquetas enviadas a "${selectedPrinter}".`,
        className:
          "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ Error al imprimir",
        description:
          error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      if (rowIndex === -1) setIsPrintingBatch(false);
      else
        setPrintingRows((prev) => {
          const next = new Set(prev);
          next.delete(rowIndex);
          return next;
        });
    }
  };

  useEffect(() => {
    fetchPrinters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (typeof document !== "undefined") {
        document.body.style.pointerEvents = "";
      }
    };
  }, []);

  const handleFileRead = (content: string | ArrayBuffer) => {
    try {
      const parsed = parseExitoExcel(content);
      const generatedZpl = generateExitoBatchZpl(parsed.labels);
      setLabels(parsed.labels);
      setZpl(generatedZpl);
      setWarnings(parsed.warnings);
      toast({
        title: "✅ Archivo Procesado",
        description: `Se generaron ${parsed.labels.length} etiquetas ZPL.`,
        className:
          "bg-gradient-to-r from-green-300 to-green-400 text-white border-0 shadow-lg",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ Error al procesar",
        description:
          error instanceof Error ? error.message : "Error desconocido",
      });
    }
  };

  const handleReset = () => {
    setLabels([]);
    setZpl("");
    setWarnings([]);
    setSearchTerm("");
    setSortConfig(null);
    setHiddenColumns(new Set());
    setExpandedRows(new Set());
  };

  const filteredData = useMemo(() => {
    if (!searchTerm) return labels;
    return labels.filter((row) =>
      HEADERS.some((h) =>
        String(row[h.key] ?? "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()),
      ),
    );
  }, [labels, searchTerm]);

  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal === bVal) return 0;
      const cmp = aVal < bVal ? -1 : 1;
      return sortConfig.direction === "asc" ? cmp : -cmp;
    });
  }, [filteredData, sortConfig]);

  const visibleHeaders = HEADERS.filter((h) => !hiddenColumns.has(h.key));

  const handleSort = (key: keyof ExitoLabelData) => {
    setSortConfig((cur) => {
      if (!cur || cur.key !== key) return { key, direction: "asc" };
      if (cur.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  };

  const toggleColumn = (key: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleRow = (index: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const copyRowToClipboard = async (row: ExitoLabelData, index: number) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(row, null, 2));
      setCopiedRow(index);
      setTimeout(() => setCopiedRow(null), 2000);
    } catch {
      // ignore
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSortConfig(null);
  };

  const exportData = (format: "csv" | "json" | "zpl") => {
    if (format === "zpl") {
      downloadText(zpl, "etiquetas-exito.zpl");
      return;
    }
    if (format === "csv") {
      const csv = [
        visibleHeaders.map((h) => h.label).join(","),
        ...sortedData.map((row) =>
          visibleHeaders.map((h) => `"${row[h.key] ?? ""}"`).join(","),
        ),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `etiquetas_exito_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    } else {
      const blob = new Blob([JSON.stringify(sortedData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `etiquetas_exito_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    }
  };

  const activeFiltersCount = (searchTerm ? 1 : 0) + (sortConfig ? 1 : 0);

  const stats = useMemo(() => {
    const uniqueBarcodes = new Set(labels.map((l) => l.ct)).size;
    const uniqueTiendas = new Set(labels.map((l) => l.tienda)).size;
    return { total: labels.length, uniqueBarcodes, uniqueTiendas };
  }, [labels]);

  const renderCardView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {sortedData.map((row, index) => (
        <div
          key={index}
          className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group"
        >
          <div className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <Badge variant="outline" className="text-[10px]">
                Etiqueta #{index + 1}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => copyRowToClipboard(row, index)}
              >
                {copiedRow === index ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
            {visibleHeaders.slice(0, 4).map((h) => (
              <div key={h.key} className="space-y-1">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                  {h.label}
                </p>
                <p className="text-xs text-slate-700 break-words line-clamp-2">
                  {row[h.key] !== undefined && row[h.key] !== "" ? (
                    String(row[h.key])
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </p>
              </div>
            ))}
            {visibleHeaders.length > 4 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs mt-2"
                onClick={() => toggleRow(index)}
              >
                {expandedRows.has(index)
                  ? "Ver menos"
                  : `Ver ${visibleHeaders.length - 4} más`}
                <ChevronDown
                  className={cn(
                    "h-3 w-3 ml-1 transition-transform",
                    expandedRows.has(index) && "rotate-180",
                  )}
                />
              </Button>
            )}
            {expandedRows.has(index) && (
              <div className="mt-3 pt-3 border-t space-y-3">
                {visibleHeaders.slice(4).map((h) => (
                  <div key={h.key} className="space-y-1">
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                      {h.label}
                    </p>
                    <p className="text-xs text-slate-700 break-words">
                      {String(row[h.key] ?? "—")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <TooltipProvider>
      {/* Upload + Advertencias */}
      <div className="space-y-4 mb-4">
        <FileUploader
          title="Excel Pedidos Éxito"
          onFileRead={handleFileRead}
          onFileReset={handleReset}
          recordCount={labels.length > 0 ? labels.length : undefined}
        />
        {warnings.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1">
            {warnings.map((w) => (
              <p key={w} className="text-xs text-amber-800">
                ⚠️ {w}
              </p>
            ))}
          </div>
        )}

        {/* Banner agente de impresión — solo visible en host remoto cuando el agente no está corriendo */}
        {isRemoteHost && agentStatus === "offline" && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <WifiOff className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-orange-800">
                  Agente de impresión no detectado en este equipo
                </p>
                <p className="text-xs text-orange-700 mt-0.5">
                  Para imprimir desde esta PC necesitas ejecutar el agente
                  local. Cada compañero debe hacerlo una vez en su propio
                  equipo.
                </p>
              </div>
            </div>
            <div className="ml-8 space-y-2.5">
              <a
                href="/install-print-connector.exe"
                download="install-print-connector.exe"
                className="inline-flex items-center gap-1.5 text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                <MonitorDown className="h-3.5 w-3.5" />
                Descargar instalador (.exe)
              </a>
              <ol className="text-xs text-orange-700 space-y-0.5 list-decimal list-inside">
                <li>
                  Descarga y ejecuta <strong>install-print-connector.exe</strong>
                </li>
                <li>
                  El instalador detecta Node.js y, si falta, intenta instalarlo
                  automáticamente
                </li>
                <li>
                  Si tu equipo bloquea el .exe, usa la opción PowerShell:
                  <a
                    href="https://nodejs.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline ml-1"
                  >
                    guía de Node.js
                  </a>
                </li>
                <li>
                  Descarga <strong>install-print-connector.ps1</strong> y ejecuta:
                  <code className="bg-orange-100 px-1.5 py-0.5 rounded font-mono">
                    powershell -ExecutionPolicy Bypass -File
                    .\install-print-connector.ps1
                  </code>
                </li>
                <li>Presiona "Reintentar" para detectar el conector activo</li>
              </ol>
              <Button
                size="sm"
                variant="outline"
                onClick={fetchPrinters}
                disabled={isLoadingPrinters}
                className="text-xs h-7 border-orange-300 text-orange-700 hover:bg-orange-100"
              >
                <RefreshCw
                  className={cn(
                    "h-3 w-3 mr-1.5",
                    isLoadingPrinters && "animate-spin",
                  )}
                />
                Reintentar conexión
              </Button>
            </div>
          </div>
        )}

        {/* Chip agente activo */}
        {isRemoteHost && agentStatus === "online" && (
          <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 w-fit">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            Agente de impresión activo en este equipo
          </div>
        )}
      </div>

      {/* Estado vacío */}
      {labels.length === 0 && (
        <div className="flex flex-col items-center justify-center h-[340px] text-slate-500 gap-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <Warehouse className="h-24 w-24 text-slate-200" />
          <div className="text-center space-y-2 max-w-sm">
            <h3 className="text-xl font-bold text-slate-600">
              Genera etiquetas Éxito
            </h3>
            <p className="text-sm text-slate-400">
              Carga el Excel de pedidos para generar las etiquetas en formato
              ZPL listas para imprimir.
            </p>
          </div>
        </div>
      )}

      {/* Tabla principal - mismo diseño que InboundResultsTable */}
      {labels.length > 0 && (
        <div
          className={cn(
            "w-full rounded-xl border shadow-sm bg-white transition-all duration-300 overflow-hidden",
            isFullscreen &&
              "fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm",
          )}
        >
          <div
            className={cn(
              "w-full h-full transition-all duration-300",
              isFullscreen ? "m-4 w-[calc(100%-2rem)] h-[calc(100%-2rem)]" : "",
            )}
          >
            <div className="w-full h-full rounded-xl border shadow-sm bg-white flex flex-col overflow-hidden">
              {/* Header */}
              <div className="border-b bg-gradient-to-r from-slate-50 via-white to-slate-50/50 p-4 flex-shrink-0">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-xl">
                        <Tag className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                          Etiquetas Éxito
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5"
                          >
                            ZPL
                          </Badge>
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>{sortedData.length} etiquetas</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300" />
                          <span>{visibleHeaders.length} columnas visibles</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Toggle tabla/tarjetas */}
                      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg mr-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-7 w-7 p-0",
                            viewMode === "table" && "bg-white shadow-sm",
                          )}
                          onClick={() => setViewMode("table")}
                        >
                          <LayoutGrid className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-7 w-7 p-0",
                            viewMode === "cards" && "bg-white shadow-sm",
                          )}
                          onClick={() => setViewMode("cards")}
                        >
                          <List className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Búsqueda */}
                      <div className="relative w-56">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <Input
                          placeholder="Buscar etiqueta..."
                          className="h-8 pl-7 pr-7 text-xs bg-white/50 backdrop-blur-sm border-slate-200 focus:bg-white"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-8 w-8 p-0"
                            onClick={() => setSearchTerm("")}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>

                      {/* Columnas */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5"
                          >
                            <Columns className="h-3.5 w-3.5" />
                            <span className="text-xs hidden sm:inline">
                              Columnas
                            </span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuLabel className="text-xs font-medium">
                            Columnas visibles
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <ScrollArea className="h-64">
                            {HEADERS.map((h) => (
                              <DropdownMenuCheckboxItem
                                key={h.key}
                                checked={!hiddenColumns.has(h.key)}
                                onCheckedChange={() => toggleColumn(h.key)}
                                className="text-xs"
                              >
                                {h.label}
                              </DropdownMenuCheckboxItem>
                            ))}
                          </ScrollArea>
                          <DropdownMenuSeparator />
                          <div className="p-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full text-xs"
                              onClick={() => setHiddenColumns(new Set())}
                            >
                              <Eye className="h-3 w-3 mr-2" />
                              Mostrar todas
                            </Button>
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Selector de impresora */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 max-w-[180px]"
                          >
                            <Printer className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="text-xs hidden sm:inline truncate">
                              {selectedPrinter || "Impresora"}
                            </span>
                            {isLoadingPrinters && (
                              <RefreshCw className="h-3 w-3 animate-spin flex-shrink-0" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-72">
                          <DropdownMenuLabel className="text-xs flex items-center justify-between">
                            Impresoras disponibles
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={fetchPrinters}
                              disabled={isLoadingPrinters}
                            >
                              <RefreshCw
                                className={cn(
                                  "h-3 w-3",
                                  isLoadingPrinters && "animate-spin",
                                )}
                              />
                            </Button>
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {printers.length === 0 ? (
                            <div className="px-3 py-4 text-xs text-slate-500 text-center">
                              {isLoadingPrinters
                                ? "Cargando..."
                                : "No se encontraron impresoras"}
                            </div>
                          ) : (
                            <ScrollArea className="h-48">
                              {printers.map((p) => (
                                <DropdownMenuItem
                                  key={p}
                                  onClick={() => setSelectedPrinter(p)}
                                  className="text-xs gap-2"
                                >
                                  {selectedPrinter === p ? (
                                    <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                                  ) : (
                                    <div className="h-3.5 w-3.5 flex-shrink-0" />
                                  )}
                                  <span className="truncate">{p}</span>
                                </DropdownMenuItem>
                              ))}
                            </ScrollArea>
                          )}
                          {selectedPrinter && (
                            <>
                              <DropdownMenuSeparator />
                              <div className="p-2">
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="w-full h-8 text-xs bg-green-600 hover:bg-green-700 gap-2"
                                  onClick={() =>
                                    printLabels(
                                      generateExitoBatchZpl(sortedData),
                                      -1,
                                    )
                                  }
                                  disabled={isPrintingBatch}
                                >
                                  {isPrintingBatch ? (
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Printer className="h-3.5 w-3.5" />
                                  )}
                                  {isPrintingBatch
                                    ? "Imprimiendo..."
                                    : `Imprimir ${sortedData.length} etiquetas`}
                                </Button>
                              </div>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Exportar */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="default"
                            size="sm"
                            className="h-8 gap-1.5 bg-green-600 hover:bg-green-700"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span className="text-xs hidden sm:inline">
                              Exportar
                            </span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
                            onClick={() => exportData("zpl")}
                            className="text-xs gap-2"
                          >
                            <FileCode2 className="h-3.5 w-3.5 text-green-600" />
                            Descargar ZPL
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              sortedData.length > 0 &&
                              openPreview(sortedData[0])
                            }
                            className="text-xs gap-2"
                          >
                            <Eye className="h-3.5 w-3.5 text-emerald-600" />
                            Vista previa
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => exportData("csv")}
                            className="text-xs gap-2"
                          >
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                            CSV
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => exportData("json")}
                            className="text-xs gap-2"
                          >
                            <FileJson className="h-3.5 w-3.5" />
                            JSON
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Fullscreen */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-8 w-8 p-0 transition-all",
                          isFullscreen && "bg-primary/10 text-primary",
                        )}
                        onClick={() => setIsFullscreen(!isFullscreen)}
                      >
                        {isFullscreen ? (
                          <Minimize2 className="h-3.5 w-3.5" />
                        ) : (
                          <Maximize2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="outline"
                          className="gap-1.5 px-2 py-0.5 text-[10px]"
                        >
                          <Tag className="h-3 w-3 text-green-500" />
                          {stats.total} etiquetas
                        </Badge>
                        <Badge
                          variant="outline"
                          className="gap-1.5 px-2 py-0.5 text-[10px]"
                        >
                          <Sparkles className="h-3 w-3 text-blue-500" />
                          {stats.uniqueBarcodes} códigos únicos
                        </Badge>
                        <Badge
                          variant="outline"
                          className="gap-1.5 px-2 py-0.5 text-[10px]"
                        >
                          <Warehouse className="h-3 w-3 text-amber-500" />
                          {stats.uniqueTiendas} tiendas
                        </Badge>
                      </div>
                      <span className="font-medium text-slate-600">
                        {sortedData.length} / {labels.length}
                      </span>
                    </div>
                    <Progress
                      value={
                        labels.length > 0
                          ? (sortedData.length / labels.length) * 100
                          : 0
                      }
                      className="h-1.5"
                    />
                  </div>

                  {/* Filtros activos */}
                  {activeFiltersCount > 0 && (
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="gap-1.5 px-2 py-0.5"
                      >
                        <Filter className="h-3 w-3" />
                        <span className="text-xs">
                          {activeFiltersCount} filtro
                          {activeFiltersCount !== 1 ? "s" : ""} activo
                          {activeFiltersCount !== 1 ? "s" : ""}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                          onClick={clearFilters}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                      {sortConfig && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          Orden:{" "}
                          {HEADERS.find((h) => h.key === sortConfig.key)?.label}{" "}
                          ({sortConfig.direction === "asc" ? "↑" : "↓"})
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Contenido */}
              {viewMode === "table" ? (
                <ScrollArea
                  className={cn(
                    "w-full relative flex-1",
                    isFullscreen ? "min-h-0" : "h-[450px]",
                  )}
                >
                  <div className="min-w-full inline-block align-middle">
                    <Table className="w-full">
                      <TableHeader className="bg-gradient-to-r from-slate-50 to-white sticky top-0 z-20 shadow-sm">
                        <TableRow>
                          <TableHead className="w-10 px-2 bg-inherit">
                            <span className="sr-only">Expandir</span>
                          </TableHead>
                          {visibleHeaders.map((h) => (
                            <TableHead
                              key={h.key}
                              className={cn(
                                "text-[11px] font-semibold text-slate-700 uppercase py-3 px-4 border-b cursor-pointer group hover:bg-slate-100/80 transition-colors bg-inherit whitespace-nowrap",
                                sortConfig?.key === h.key && "text-primary",
                              )}
                              onClick={() => handleSort(h.key)}
                            >
                              <div className="flex items-center gap-1.5">
                                <span>{h.label}</span>
                                {sortConfig?.key === h.key ? (
                                  sortConfig.direction === "asc" ? (
                                    <ChevronUp className="h-3 w-3 flex-shrink-0" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3 flex-shrink-0" />
                                  )
                                ) : (
                                  <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-40 flex-shrink-0 transition-opacity" />
                                )}
                              </div>
                            </TableHead>
                          ))}
                          <TableHead className="w-20 px-2 text-center bg-inherit">
                            <span className="sr-only">Acciones</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedData.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={visibleHeaders.length + 2}
                              className="text-center py-16 text-slate-500"
                            >
                              <div className="flex flex-col items-center gap-3">
                                <AlertCircle className="h-10 w-10 text-slate-300" />
                                <p className="text-sm font-medium">
                                  No se encontraron resultados
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={clearFilters}
                                  className="text-xs"
                                >
                                  Limpiar filtros
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          sortedData.map((row, i) => (
                            <React.Fragment key={i}>
                              <TableRow
                                className={cn(
                                  "hover:bg-slate-50/80 transition-colors group",
                                  expandedRows.has(i) && "bg-slate-50/50",
                                )}
                              >
                                <TableCell className="w-10 px-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => toggleRow(i)}
                                  >
                                    {expandedRows.has(i) ? (
                                      <ChevronUp className="h-3.5 w-3.5" />
                                    ) : (
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </TableCell>
                                {visibleHeaders.map((h) => (
                                  <TableCell
                                    key={h.key}
                                    className="text-xs py-3 px-4 border-b text-slate-600 truncate max-w-[200px]"
                                    title={String(row[h.key] ?? "")}
                                  >
                                    {row[h.key] !== undefined &&
                                    row[h.key] !== "" ? (
                                      String(row[h.key])
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
                                  </TableCell>
                                ))}
                                <TableCell className="w-20 px-2 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                          onClick={() =>
                                            copyRowToClipboard(row, i)
                                          }
                                        >
                                          {copiedRow === i ? (
                                            <Check className="h-3.5 w-3.5 text-green-500" />
                                          ) : (
                                            <Copy className="h-3.5 w-3.5" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs">Copiar fila</p>
                                      </TooltipContent>
                                    </Tooltip>
                                    {selectedPrinter && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                            disabled={printingRows.has(i)}
                                            onClick={() =>
                                              printLabels(
                                                generateExitoLabelZpl(row),
                                                i,
                                              )
                                            }
                                          >
                                            {printingRows.has(i) ? (
                                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                              <Printer className="h-3.5 w-3.5" />
                                            )}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="text-xs">
                                            Imprimir etiqueta
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                              {expandedRows.has(i) && (
                                <TableRow className="bg-slate-50/30">
                                  <TableCell
                                    colSpan={visibleHeaders.length + 2}
                                    className="p-0 border-b"
                                  >
                                    <div className="p-4 bg-gradient-to-br from-slate-50/50 to-white">
                                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {HEADERS.map((h) => (
                                          <div
                                            key={h.key}
                                            className="space-y-1.5"
                                          >
                                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                              {h.label}
                                              {hiddenColumns.has(h.key) && (
                                                <EyeOff className="h-3 w-3 text-slate-300" />
                                              )}
                                            </p>
                                            <div className="text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm">
                                              {row[h.key] !== undefined &&
                                              row[h.key] !== "" ? (
                                                String(row[h.key])
                                              ) : (
                                                <span className="text-slate-300 italic">
                                                  Sin valor
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              ) : (
                <ScrollArea
                  className={cn(
                    "w-full flex-1",
                    isFullscreen ? "min-h-0" : "h-[450px]",
                  )}
                >
                  {renderCardView()}
                </ScrollArea>
              )}

              {/* Footer */}
              <div className="bg-gradient-to-r from-slate-50 via-white to-slate-50/50 p-3 border-t flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className="gap-1.5 px-2 py-0.5 text-[10px]"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      {sortedData.length} etiquetas
                    </Badge>
                    {sortedData.length < labels.length && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Filter className="h-3 w-3" />
                        Filtrado:{" "}
                        {((sortedData.length / labels.length) * 100).toFixed(0)}
                        %
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="default"
                      className="bg-green-50 text-green-700 hover:bg-green-50 border-green-200 gap-1.5 text-[10px]"
                    >
                      <Check className="h-3 w-3" />
                      ZPL generado
                    </Badge>
                    <Badge variant="outline" className="text-[10px] gap-1.5">
                      <Sparkles className="h-3 w-3" />
                      {visibleHeaders.length} columnas activas
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal vista previa etiqueta */}
      <Dialog
        open={!!previewLabel}
        onOpenChange={(open) => !open && closePreview()}
      >
        <DialogContent
          className="max-w-[480px] p-6"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Eye className="h-4 w-4 text-green-600" />
              Vista previa de etiqueta
              {previewLabel && (
                <span className="text-xs font-normal text-slate-500 ml-2">
                  {previewLabel.tienda} — Caja {previewLabel.numeroCaja}/
                  {previewLabel.totalCajas}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {previewLabel && (
            <div className="flex flex-col items-center gap-4">
              <LabelPreview label={previewLabel} />
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs gap-1.5"
                  disabled={sortedData.indexOf(previewLabel) <= 0}
                  onClick={() => {
                    const i = sortedData.indexOf(previewLabel);
                    if (i > 0) setPreviewLabel(sortedData[i - 1]);
                  }}
                >
                  ← Anterior
                </Button>
                <span className="text-xs text-slate-400 flex items-center px-2">
                  {sortedData.indexOf(previewLabel) + 1} / {sortedData.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs gap-1.5"
                  disabled={
                    sortedData.indexOf(previewLabel) >= sortedData.length - 1
                  }
                  onClick={() => {
                    const i = sortedData.indexOf(previewLabel);
                    if (i < sortedData.length - 1)
                      setPreviewLabel(sortedData[i + 1]);
                  }}
                >
                  Siguiente →
                </Button>
              </div>
              {selectedPrinter && (
                <Button
                  className="w-full text-xs bg-green-600 hover:bg-green-700 gap-2"
                  size="sm"
                  disabled={printingRows.has(sortedData.indexOf(previewLabel))}
                  onClick={() => {
                    const i = sortedData.indexOf(previewLabel);
                    printLabels(generateExitoLabelZpl(previewLabel), i);
                  }}
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir esta etiqueta
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
