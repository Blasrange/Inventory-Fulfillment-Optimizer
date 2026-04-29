"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
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
  Package,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Truck,
  Warehouse,
  Sparkles,
  Eye,
  Layers,
  RefreshCw,
  List,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface ExportacionResultado {
  codigo: string;
  referencia: string;
  localizacionActual: string | null;
  estado: "OK" | "MOVIMIENTO AL PASILLO SUGERIDO";
  localizacionSugerida: string | null;
  sugerencia?: string;
  lpn?: string | null;
}

// Interfaz para SKU agrupado
interface SkuAgrupado {
  codigo: string;
  referencia: string;
  totalRegistros: number;
  okCount: number;
  movimientoCount: number;
  registros: ExportacionResultado[];
  tieneStockSuficiente: boolean;
  tieneMovimientos: boolean;
  esMixto: boolean;
}

interface ExportacionesTableProps {
  resultados: ExportacionResultado[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onExport?: () => void;
  isExporting?: boolean;
  title?: string;
}

export function ExportacionesTable({
  resultados,
  isLoading = false,
  onRefresh,
  onExport,
  isExporting = false,
  title = "Exportación de Inventario - Pasillo P10",
}: ExportacionesTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"todos" | "movimientos">("movimientos");
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [copiedRow, setCopiedRow] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);

  const headers = [
    { key: "codigo", label: "Código", sortable: true, width: 120 },
    { key: "referencia", label: "Referencia", sortable: true, width: 200 },
    { key: "totalRegistros", label: "Total", align: "center", sortable: true, width: 60 },
    { key: "estado", label: "Estado", sortable: true, width: 200 },
    { key: "okCount", label: "OK", align: "center", sortable: true, width: 60 },
    { key: "movimientoCount", label: "Movimientos", align: "center", sortable: true, width: 90 },
  ];

  // Agrupar por código
  const datosAgrupados = useMemo(() => {
    const mapa = new Map<string, SkuAgrupado>();
    
    for (const r of resultados) {
      if (!mapa.has(r.codigo)) {
        mapa.set(r.codigo, {
          codigo: r.codigo,
          referencia: r.referencia,
          totalRegistros: 0,
          okCount: 0,
          movimientoCount: 0,
          registros: [],
          tieneStockSuficiente: true,
          tieneMovimientos: false,
          esMixto: false,
        });
      }
      
      const sku = mapa.get(r.codigo)!;
      sku.registros.push(r);
      sku.totalRegistros++;
      
      if (r.estado === 'OK') {
        sku.okCount++;
      } else {
        sku.movimientoCount++;
      }
    }
    
    // Calcular flags adicionales
    for (const sku of mapa.values()) {
      sku.tieneStockSuficiente = sku.movimientoCount === 0;
      sku.tieneMovimientos = sku.movimientoCount > 0;
      sku.esMixto = sku.okCount > 0 && sku.movimientoCount > 0;
    }
    
    return Array.from(mapa.values());
  }, [resultados]);

  // Filtrar datos
  const datosFiltrados = useMemo(() => {
    let filtered = datosAgrupados;

    if (viewMode === "movimientos") {
      filtered = filtered.filter((s) => s.tieneMovimientos);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((s) =>
        [s.codigo, s.referencia].some((v) => v?.toLowerCase().includes(term))
      );
    }

    return filtered;
  }, [datosAgrupados, searchTerm, viewMode]);

  // Ordenar datos
  const sortedData = useMemo(() => {
    if (!sortConfig) return datosFiltrados;

    return [...datosFiltrados].sort((a, b) => {
      let aVal = a[sortConfig.key as keyof SkuAgrupado];
      let bVal = b[sortConfig.key as keyof SkuAgrupado];

      if (sortConfig.key === "estado") {
        const getEstado = (s: SkuAgrupado) => {
          if (s.tieneStockSuficiente) return "OK";
          if (s.esMixto) return "Mixto";
          return "Pendiente";
        };
        aVal = getEstado(a);
        bVal = getEstado(b);
      }

      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (aStr === bStr) return 0;
      const comparison = aStr < bStr ? -1 : 1;
      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [datosFiltrados, sortConfig]);

  const visibleHeaders = headers.filter((h) => !hiddenColumns.has(h.key));

  const handleSort = (key: string) => {
    setSortConfig((current) => {
      if (!current || current.key !== key) {
        return { key, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { key, direction: "desc" };
      }
      return null;
    });
  };

  // Estadísticas
  const stats = useMemo(() => {
    const totalSKUs = datosAgrupados.length;
    const skusCompletamenteOK = datosAgrupados.filter((s) => !s.tieneMovimientos).length;
    const skusMixtos = datosAgrupados.filter((s) => s.esMixto).length;
    const skusPendientes = datosAgrupados.filter((s) => s.tieneMovimientos && !s.esMixto).length;
    const totalRegistros = resultados.length;
    const totalOK = resultados.filter((r) => r.estado === "OK").length;
    const totalMovimientos = resultados.filter((r) => r.estado === "MOVIMIENTO AL PASILLO SUGERIDO").length;

    return {
      totalSKUs,
      skusCompletamenteOK,
      skusMixtos,
      skusPendientes,
      totalRegistros,
      totalOK,
      totalMovimientos,
      porcentajeOK: totalRegistros > 0 ? Math.round((totalOK / totalRegistros) * 100) : 0,
    };
  }, [datosAgrupados, resultados]);

  const clearFilters = () => {
    setSearchTerm("");
    setSortConfig(null);
  };

  const activeFiltersCount = (searchTerm ? 1 : 0) + (sortConfig ? 1 : 0);

  const toggleRow = (codigo: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(codigo)) {
        next.delete(codigo);
      } else {
        next.add(codigo);
      }
      return next;
    });
  };

  const copyRowToClipboard = async (row: SkuAgrupado, codigo: string) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(row, null, 2));
      setCopiedRow(codigo);
      setTimeout(() => setCopiedRow(null), 2000);
    } catch (err) {
      console.error("Error al copiar:", err);
    }
  };

  const exportData = (format: "csv" | "json") => {
    const dataToExport = sortedData.map((s) => ({
      codigo: s.codigo,
      referencia: s.referencia,
      totalRegistros: s.totalRegistros,
      okCount: s.okCount,
      movimientoCount: s.movimientoCount,
      estado: s.tieneStockSuficiente ? "OK" : s.esMixto ? "Mixto" : "Pendiente",
    }));

    if (format === "csv") {
      const headersMap = {
        codigo: "Código",
        referencia: "Referencia",
        totalRegistros: "Total Registros",
        okCount: "OK",
        movimientoCount: "Movimientos",
        estado: "Estado",
      };

      const csvContent = [
        Object.values(headersMap).join(","),
        ...dataToExport.map((row) => {
          const values = [
            row.codigo,
            `"${row.referencia || ""}"`,
            row.totalRegistros,
            row.okCount,
            row.movimientoCount,
            row.estado,
          ];
          return values.join(",");
        }),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `exportacion_inventario_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === "json") {
      const jsonContent = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonContent], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `exportacion_inventario_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const toggleColumn = (columnKey: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnKey)) {
        next.delete(columnKey);
      } else {
        next.add(columnKey);
      }
      return next;
    });
  };

  const getStatusBadge = (sku: SkuAgrupado) => {
    if (sku.tieneStockSuficiente) {
      return {
        label: "Completamente OK",
        className: "bg-green-100 text-green-700 border-green-200",
        icon: <CheckCircle2 className="h-3 w-3 mr-1" />,
      };
    }
    if (sku.esMixto) {
      return {
        label: `Mixto (${sku.okCount}/${sku.totalRegistros} OK)`,
        className: "bg-orange-100 text-orange-700 border-orange-200",
        icon: <AlertCircle className="h-3 w-3 mr-1" />,
      };
    }
    return {
      label: `Pendiente (${sku.movimientoCount} movimientos)`,
      className: "bg-amber-100 text-amber-700 border-amber-200",
      icon: <Truck className="h-3 w-3 mr-1" />,
    };
  };

  useEffect(() => {
    if (!isFullscreen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };

    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  if (isLoading) {
    return (
      <div className="w-full rounded-xl border shadow-sm bg-white p-12">
        <div className="flex flex-col items-center justify-center gap-4">
          <RefreshCw className="h-12 w-12 animate-spin text-primary" />
          <p className="text-slate-500">Procesando datos de exportación...</p>
        </div>
      </div>
    );
  }

  if (!resultados || resultados.length === 0) {
    return (
      <div className="w-full rounded-xl border shadow-sm bg-white p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-full p-4 mb-4">
            <Package className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            No hay resultados de exportación
          </h3>
          <p className="text-sm text-slate-500 max-w-md">
            No se encontraron productos en inventario que coincidan con la maestra de exportación.
          </p>
        </div>
      </div>
    );
  }

  if (viewMode === "movimientos" && stats.skusPendientes === 0 && stats.skusMixtos === 0 && stats.totalSKUs > 0) {
    return (
      <div className="w-full rounded-xl border shadow-sm bg-white p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="bg-gradient-to-br from-green-100 to-green-200 rounded-full p-4 mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-green-800 mb-2">
            ¡Todo está en orden! 🎉
          </h3>
          <p className="text-sm text-green-600 max-w-md">
            Todos los {stats.totalSKUs} SKUs están correctamente ubicados en el pasillo P10.
          </p>
          <Button variant="outline" size="sm" onClick={() => setViewMode("todos")} className="mt-4">
            Ver todos los productos
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div
        className={cn(
          "w-full rounded-xl border shadow-sm bg-white transition-all duration-300 overflow-hidden",
          isFullscreen && "fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
        )}
      >
        <div
          className={cn(
            "w-full h-full transition-all duration-300",
            isFullscreen ? "m-4 w-[calc(100%-2rem)] h-[calc(100%-2rem)]" : ""
          )}
        >
          <div className="w-full h-full rounded-xl border shadow-sm bg-white flex flex-col overflow-hidden">
            {/* Header */}
            <div className="border-b bg-gradient-to-r from-slate-50 via-white to-slate-50/50 p-4 flex-shrink-0">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl">
                      <Warehouse className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        {title}
                        <Badge variant="secondary" className="text-[10px] px-1.5">
                          Agrupado por SKU
                        </Badge>
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{stats.totalSKUs} SKUs</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span>{stats.totalRegistros} ubicaciones</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span>{visibleHeaders.length} columnas</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div className="relative w-56">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Buscar SKU..."
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

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 gap-1.5">
                          <Columns className="h-3.5 w-3.5" />
                          <span className="text-xs hidden sm:inline">Columnas</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel className="text-xs font-medium">
                          Columnas visibles
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <ScrollArea className="h-64">
                          {headers.map((header) => (
                            <DropdownMenuCheckboxItem
                              key={header.key}
                              checked={!hiddenColumns.has(header.key)}
                              onCheckedChange={() => toggleColumn(header.key)}
                              className="text-xs"
                            >
                              {header.label}
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

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="default" size="sm" className="h-8 gap-1.5">
                          <Download className="h-3.5 w-3.5" />
                          <span className="text-xs hidden sm:inline">Exportar</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => exportData("csv")} className="text-xs gap-2">
                          <FileSpreadsheet className="h-3.5 w-3.5" />
                          CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportData("json")} className="text-xs gap-2">
                          <FileJson className="h-3.5 w-3.5" />
                          JSON
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {onExport && (
                      <Button
                        variant="default"
                        size="sm"
                        className="h-8 gap-1.5 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                        onClick={onExport}
                        disabled={isExporting}
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        <span className="text-xs hidden sm:inline">
                          {isExporting ? "Exportando..." : "Excel"}
                        </span>
                      </Button>
                    )}

                    {onRefresh && (
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onRefresh}>
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn("h-8 w-8 p-0 transition-all", isFullscreen && "bg-primary/10 text-primary")}
                      onClick={() => setIsFullscreen(!isFullscreen)}
                    >
                      {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "todos" | "movimientos")}>
                  <TabsList className="grid w-full max-w-[400px] grid-cols-2">
                    <TabsTrigger value="movimientos" className="gap-2">
                      <Truck className="h-3.5 w-3.5" />
                      Por mover ({stats.skusPendientes + stats.skusMixtos} SKUs)
                    </TabsTrigger>
                    <TabsTrigger value="todos" className="gap-2">
                      <Package className="h-3.5 w-3.5" />
                      Todos ({stats.totalSKUs} SKUs)
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="gap-1.5 px-2 py-0.5 text-[10px]">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        SKUs 100% OK: {stats.skusCompletamenteOK}
                      </Badge>
                      {stats.skusMixtos > 0 && (
                        <Badge variant="outline" className="gap-1.5 px-2 py-0.5 text-[10px] bg-orange-50">
                          <AlertCircle className="h-3 w-3 text-orange-500" />
                          SKUs mixtos: {stats.skusMixtos}
                        </Badge>
                      )}
                      {stats.skusPendientes > 0 && (
                        <Badge variant="outline" className="gap-1.5 px-2 py-0.5 text-[10px] bg-amber-50">
                          <Truck className="h-3 w-3 text-amber-500" />
                          SKUs pendientes: {stats.skusPendientes}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs font-medium">
                      {stats.porcentajeOK}% de ubicaciones correctas
                    </span>
                  </div>
                  <Progress value={stats.porcentajeOK} className="h-2" />
                </div>

                {activeFiltersCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="gap-1.5 px-2 py-0.5">
                      <Filter className="h-3 w-3" />
                      <span className="text-xs">
                        {activeFiltersCount} filtro{activeFiltersCount !== 1 ? "s" : ""} activo
                      </span>
                      <Button variant="ghost" size="sm" className="h-4 w-4 p-0 ml-1 hover:bg-transparent" onClick={clearFilters}>
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                    {sortConfig && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        Orden: {headers.find((h) => h.key === sortConfig.key)?.label} ({sortConfig.direction === "asc" ? "↑" : "↓"})
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Tabla */}
            <ScrollArea className="flex-1 min-h-0">
              <Table>
                <TableHeader className="bg-gradient-to-r from-slate-50 to-white sticky top-0 z-20 shadow-sm">
                  <TableRow>
                    <TableHead className="w-10 px-2 bg-inherit">
                      <span className="sr-only">Expandir</span>
                    </TableHead>
                    {visibleHeaders.map((header) => (
                      <TableHead
                        key={header.key}
                        className={cn(
                          "text-[11px] font-bold text-slate-700 uppercase py-3 px-4 border-b whitespace-nowrap bg-inherit",
                          header.align === "center" && "text-center",
                          sortConfig?.key === header.key && header.sortable && "text-primary",
                          header.sortable && "cursor-pointer group hover:bg-slate-100/80 transition-colors"
                        )}
                        onClick={() => header.sortable && handleSort(header.key)}
                      >
                        <div className={cn("flex items-center gap-1.5", header.align === "center" && "justify-center")}>
                          <span>{header.label}</span>
                          {header.sortable && (
                            <>
                              {sortConfig?.key === header.key ? (
                                sortConfig.direction === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity" />
                              )}
                            </>
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
                      <TableCell colSpan={visibleHeaders.length + 2} className="text-center py-16 text-slate-500">
                        <div className="flex flex-col items-center gap-3">
                          <AlertCircle className="h-10 w-10 text-slate-300" />
                          <p className="text-sm font-medium">No se encontraron resultados</p>
                          <Button variant="outline" size="sm" onClick={clearFilters} className="text-xs">
                            Limpiar filtros
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedData.map((sku) => {
                      const status = getStatusBadge(sku);
                      const isExpanded = expandedRows.has(sku.codigo);
                      const tieneDetalles = sku.registros.length > 0;

                      return (
                        <React.Fragment key={sku.codigo}>
                          <TableRow
                            className={cn(
                              "hover:bg-slate-50/80 transition-colors group",
                              isExpanded && "bg-slate-50/50",
                              sku.esMixto && "bg-orange-50/20",
                              !sku.tieneStockSuficiente && !sku.esMixto && "bg-amber-50/20"
                            )}
                          >
                            <TableCell className="w-10 px-2 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => toggleRow(sku.codigo)}
                                disabled={!tieneDetalles}
                              >
                                {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              </Button>
                            </TableCell>

                            {!hiddenColumns.has("codigo") && (
                              <TableCell className="font-mono font-semibold text-xs text-center">{sku.codigo}</TableCell>
                            )}

                            {!hiddenColumns.has("referencia") && (
                              <TableCell className="text-xs max-w-[200px] truncate text-center" title={sku.referencia}>
                                {sku.referencia || "-"}
                              </TableCell>
                            )}

                            {!hiddenColumns.has("totalRegistros") && (
                              <TableCell className="text-center text-xs font-medium">{sku.totalRegistros}</TableCell>
                            )}

                            {!hiddenColumns.has("estado") && (
                              <TableCell className="text-center">
                                <Badge className={cn("flex items-center justify-center gap-1 text-[10px] px-2 py-0.5", status.className)}>
                                  {status.icon}
                                  {status.label}
                                </Badge>
                              </TableCell>
                            )}

                            {!hiddenColumns.has("okCount") && (
                              <TableCell className="text-center text-xs text-green-600 font-medium">{sku.okCount}</TableCell>
                            )}

                            {!hiddenColumns.has("movimientoCount") && (
                              <TableCell className="text-center text-xs text-amber-600 font-medium">{sku.movimientoCount}</TableCell>
                            )}

                            <TableCell className="w-20 px-2 text-center">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => copyRowToClipboard(sku, sku.codigo)}
                                  >
                                    {copiedRow === sku.codigo ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Copiar SKU</p>
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                          </TableRow>

                          {/* Detalle expandido - todas las ubicaciones del SKU */}
                          {isExpanded && tieneDetalles && (
                            <TableRow className="bg-blue-50/30">
                              <TableCell colSpan={visibleHeaders.length + 2} className="p-0 border-b">
                                <div className="p-4 bg-gradient-to-br from-blue-50/50 to-white">
                                  <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                                    <List className="h-4 w-4" />
                                    Ubicaciones para {sku.codigo} - {sku.referencia}
                                  </h4>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead className="bg-blue-100">
                                        <tr>
                                          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase">Ubicación</th>
                                          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase">LPN</th>
                                          <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase">Estado</th>
                                          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase">Pasillo Sugerido</th>
                                          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase">Sugerencia</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {sku.registros.map((registro, idx) => (
                                          <tr key={idx} className="border-b last:border-0 hover:bg-blue-50/50">
                                            <td className="px-3 py-2 font-mono text-xs">{registro.localizacionActual || "-"}</td>
                                            <td className="px-3 py-2 font-mono text-xs">{registro.lpn || "-"}</td>
                                            <td className="px-3 py-2 text-center">
                                              <Badge className={cn(
                                                "text-[9px] px-1.5 py-0.5",
                                                registro.estado === "OK" 
                                                  ? "bg-green-100 text-green-700" 
                                                  : "bg-amber-100 text-amber-700"
                                              )}>
                                                {registro.estado === "OK" ? "✅ OK" : "🚚 Mover"}
                                              </Badge>
                                            </td>
                                            <td className="px-3 py-2 font-mono text-xs">{registro.localizacionSugerida || "-"}</td>
                                            <td className="px-3 py-2 text-xs text-slate-600">{registro.sugerencia || "-"}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                  <div className="mt-3 pt-2 border-t border-blue-200 flex items-center gap-2 text-xs text-blue-600">
                                    <AlertCircle className="h-3 w-3" />
                                    <span>
                                      Total: {sku.totalRegistros} ubicaciones | 
                                      ✅ OK: {sku.okCount} | 
                                      🚚 Movimientos: {sku.movimientoCount}
                                    </span>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollArea>

            {/* Footer */}
            <div className="bg-gradient-to-r from-slate-50 via-white to-slate-50/50 p-3 border-t flex-shrink-0">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="gap-1.5 px-2 py-0.5 text-[10px]">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    Mostrando {sortedData.length} de {datosFiltrados.length} SKUs
                  </Badge>
                  {sortedData.length < datosFiltrados.length && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Filter className="h-3 w-3" />
                      Filtrado
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] gap-1.5">
                    <Layers className="h-3 w-3" />
                    {stats.totalRegistros} ubicaciones totales
                  </Badge>
                  <Badge variant="outline" className="text-[10px] gap-1.5">
                    <Package className="h-3 w-3" />
                    {stats.totalSKUs} SKUs únicos
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}