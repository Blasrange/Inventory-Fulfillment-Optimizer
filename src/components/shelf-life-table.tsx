"use client";

import React, { useState, useMemo } from "react";
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
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Eye,
  Package,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ShelfLifeTableProps {
  data: any[];
  title?: string;
}

export function ShelfLifeTable({
  data,
  title = "Análisis de Vida Útil",
}: ShelfLifeTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [copiedRow, setCopiedRow] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>(
    {},
  );

  if (!data || data.length === 0) {
    return (
      <div className="w-full rounded-xl border shadow-sm bg-white p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-full p-4 mb-4">
            <Package className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            No hay datos disponibles
          </h3>
          <p className="text-sm text-slate-500 max-w-md">
            No se encontraron resultados para el análisis de vida útil.
          </p>
        </div>
      </div>
    );
  }

  // Definir headers
  const headers = [
    { key: "sku", label: "SKU" },
    { key: "descripcion", label: "Descripción" },
    { key: "lpn", label: "LPN" },
    { key: "localizacion", label: "Ubicación" },
    { key: "diasFPC", label: "Días Actuales (FPC)" },
    { key: "diasMinimosMaestra", label: "Vida Útil Límite" },
    { key: "estado", label: "Estado" },
  ];

  // Filtrar datos por búsqueda y filtros
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      // Búsqueda global
      const matchesSearch =
        searchTerm === "" ||
        Object.values(item).some((val) =>
          String(val).toLowerCase().includes(searchTerm.toLowerCase()),
        );

      // Filtros por columna
      const matchesColumnFilters = Object.entries(columnFilters).every(
        ([key, filterValue]) => {
          if (!filterValue) return true;
          const itemKey = key as keyof typeof item;
          const rowValue = String(item[itemKey] || "").toLowerCase();
          return rowValue.includes(filterValue.toLowerCase());
        },
      );

      return matchesSearch && matchesColumnFilters;
    });
  }, [data, searchTerm, columnFilters]);

  // Ordenar datos
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;

    return [...filteredData].sort((a, b) => {
      const key = sortConfig.key as keyof typeof a;
      let aVal = a[key];
      let bVal = b[key];

      // Manejar valores nulos/undefined
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;

      // Comparación numérica para valores que son números
      if (typeof aVal === "number" && typeof bVal === "number") {
        const comparison = aVal - bVal;
        return sortConfig.direction === "asc" ? comparison : -comparison;
      }

      // Comparación de strings
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();

      if (aStr === bStr) return 0;

      const comparison = aStr < bStr ? -1 : 1;
      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [filteredData, sortConfig]);

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

  const toggleRow = (index: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const copyRowToClipboard = async (row: any, index: number) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(row, null, 2));
      setCopiedRow(index);
      setTimeout(() => setCopiedRow(null), 2000);
    } catch (err) {
      console.error("Error al copiar:", err);
    }
  };

  const exportData = (format: "csv" | "json") => {
    if (format === "csv") {
      const csvContent = [
        visibleHeaders.map((h) => h.label).join(","),
        ...sortedData.map((row) =>
          visibleHeaders
            .map((h) => {
              const value = row[h.key as keyof typeof row];
              return `"${value || ""}"`;
            })
            .join(","),
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vida_util_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    } else if (format === "json") {
      const jsonContent = JSON.stringify(sortedData, null, 2);
      const blob = new Blob([jsonContent], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vida_util_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setColumnFilters({});
    setSortConfig(null);
  };

  const activeFiltersCount =
    Object.keys(columnFilters).length +
    (searchTerm ? 1 : 0) +
    (sortConfig ? 1 : 0);

  // Estadísticas
  const stats = useMemo(() => {
    const total = data.length;
    const excedidos = data.filter((item) => !item.cumple).length;
    const validos = total - excedidos;
    const porcentaje = total > 0 ? (validos / total) * 100 : 0;

    const promedioDiasFPC =
      total > 0
        ? data.reduce((sum, item) => sum + (item.diasFPC || 0), 0) / total
        : 0;

    return {
      total,
      excedidos,
      validos,
      porcentaje,
      promedioDiasFPC,
    };
  }, [data]);

  return (
    <TooltipProvider>
      {/* Contenedor principal con fullscreen */}
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
            {/* Header mejorado */}
            <div className="border-b bg-gradient-to-r from-slate-50 via-white to-slate-50/50 p-4 flex-shrink-0">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-xl">
                      <Clock className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        {title}
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5"
                        >
                          Vida Útil
                        </Badge>
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{stats.total} registros</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span>{visibleHeaders.length} columnas visibles</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Búsqueda */}
                    <div className="relative w-56">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Buscar..."
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

                    {/* Menú de columnas */}
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

                    {/* Menú de exportación */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="default"
                          size="sm"
                          className="h-8 gap-1.5"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span className="text-xs hidden sm:inline">
                            Exportar
                          </span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
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

                {/* Barra de progreso y estadísticas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className="gap-1.5 px-2 py-0.5 text-[10px]"
                      >
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        Válidos: {stats.validos}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="gap-1.5 px-2 py-0.5 text-[10px]"
                      >
                        <AlertCircle className="h-3 w-3 text-destructive" />
                        Excedidos: {stats.excedidos}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="gap-1.5 px-2 py-0.5 text-[10px]"
                      >
                        <Clock className="h-3 w-3 text-blue-500" />
                        Promedio: {Math.round(stats.promedioDiasFPC)} días
                      </Badge>
                    </div>
                    <span className="text-xs font-medium">
                      {Math.round(stats.porcentaje)}% válido
                    </span>
                  </div>
                  <Progress
                    value={stats.porcentaje}
                    className={cn(
                      "h-2",
                      stats.porcentaje === 100 ? "bg-green-500" : "bg-blue-500",
                    )}
                  />
                </div>

                {/* Filtros activos */}
                {activeFiltersCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="gap-1.5 px-2 py-0.5">
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
                        {headers.find((h) => h.key === sortConfig.key)?.label} (
                        {sortConfig.direction === "asc" ? "↑" : "↓"})
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
                    {visibleHeaders.map((header) => {
                      const isSortable = [
                        "sku",
                        "descripcion",
                        "lpn",
                        "localizacion",
                        "diasFPC",
                        "diasMinimosMaestra",
                        "estado",
                      ].includes(header.key);

                      return (
                        <TableHead
                          key={header.key}
                          className={cn(
                            "text-[11px] font-bold text-slate-700 uppercase py-3 px-4 border-b whitespace-nowrap bg-inherit text-center",
                            (header.key === "diasFPC" ||
                              header.key === "diasMinimosMaestra") &&
                              "text-center",
                            sortConfig?.key === header.key &&
                              isSortable &&
                              "text-primary",
                            isSortable &&
                              "cursor-pointer group hover:bg-slate-100/80 transition-colors",
                          )}
                          onClick={() => isSortable && handleSort(header.key)}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <span>{header.label}</span>
                            {isSortable && (
                              <>
                                {sortConfig?.key === header.key ? (
                                  sortConfig.direction === "asc" ? (
                                    <ChevronUp className="h-3 w-3 flex-shrink-0" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3 flex-shrink-0" />
                                  )
                                ) : (
                                  <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-40 flex-shrink-0 transition-opacity" />
                                )}
                              </>
                            )}
                          </div>
                        </TableHead>
                      );
                    })}
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
                    sortedData.map((item, index) => {
                      const isExcedido = !item.cumple;

                      return (
                        <React.Fragment key={index}>
                          <TableRow
                            className={cn(
                              "hover:bg-slate-50/80 transition-colors group",
                              expandedRows.has(index) && "bg-slate-50/50",
                              isExcedido &&
                                "bg-destructive/5 hover:bg-destructive/10",
                            )}
                          >
                            <TableCell className="w-10 px-2 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => toggleRow(index)}
                              >
                                {expandedRows.has(index) ? (
                                  <ChevronUp className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </TableCell>

                            {visibleHeaders.map((header) => {
                              if (header.key === "estado") {
                                return (
                                  <TableCell
                                    key={header.key}
                                    className="text-center"
                                  >
                                    <div className="flex justify-center">
                                      <Badge
                                        variant={
                                          isExcedido ? "destructive" : "outline"
                                        }
                                        className={cn(
                                          "text-[10px] px-2 py-0.5 gap-1",
                                          !isExcedido &&
                                            "bg-green-100 text-green-700 border-green-200",
                                        )}
                                      >
                                        {isExcedido ? (
                                          <>
                                            <AlertCircle className="h-2.5 w-2.5" />
                                            EXCEDIDO
                                          </>
                                        ) : (
                                          <>
                                            <CheckCircle2 className="h-2.5 w-2.5" />
                                            OK
                                          </>
                                        )}
                                      </Badge>
                                    </div>
                                  </TableCell>
                                );
                              }

                              if (header.key === "lpn") {
                                return (
                                  <TableCell
                                    key={header.key}
                                    className="text-xs py-3 px-4 border-b text-slate-700 font-bold truncate max-w-[150px] text-center"
                                    title={String(item[header.key] || "")}
                                  >
                                    {item[header.key] || "—"}
                                  </TableCell>
                                );
                              }

                              if (header.key === "localizacion") {
                                return (
                                  <TableCell
                                    key={header.key}
                                    className="text-xs py-3 px-4 border-b text-slate-500 truncate max-w-[120px] text-center"
                                    title={String(item[header.key] || "")}
                                  >
                                    {item[header.key] || "—"}
                                  </TableCell>
                                );
                              }

                              if (header.key === "diasFPC") {
                                return (
                                  <TableCell
                                    key={header.key}
                                    className={cn(
                                      "text-xs font-bold text-center py-3 px-4 border-b",
                                      isExcedido
                                        ? "text-destructive"
                                        : "text-emerald-600",
                                    )}
                                  >
                                    {item[header.key]} días
                                  </TableCell>
                                );
                              }

                              if (header.key === "diasMinimosMaestra") {
                                return (
                                  <TableCell
                                    key={header.key}
                                    className="text-xs font-bold text-slate-400 text-center py-3 px-4 border-b"
                                  >
                                    {item[header.key]} días
                                  </TableCell>
                                );
                              }

                              return (
                                <TableCell
                                  key={header.key}
                                  className="text-xs py-3 px-4 border-b text-slate-600 truncate max-w-[200px] text-center"
                                  title={String(item[header.key] || "")}
                                >
                                  {item[header.key] || "—"}
                                </TableCell>
                              );
                            })}

                            <TableCell className="w-20 px-2 text-center">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() =>
                                      copyRowToClipboard(item, index)
                                    }
                                  >
                                    {copiedRow === index ? (
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
                            </TableCell>
                          </TableRow>

                          {expandedRows.has(index) && (
                            <TableRow className="bg-slate-50/30">
                              <TableCell
                                colSpan={visibleHeaders.length + 2}
                                className="p-0 border-b"
                              >
                                <div className="p-4 bg-gradient-to-br from-slate-50/50 to-white">
                                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    <div className="space-y-1.5 text-center">
                                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                        SKU
                                      </p>
                                      <div className="text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm font-bold">
                                        {item.sku}
                                      </div>
                                    </div>
                                    <div className="space-y-1.5 text-center">
                                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                        Descripción
                                      </p>
                                      <div className="text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm">
                                        {item.descripcion}
                                      </div>
                                    </div>
                                    <div className="space-y-1.5 text-center">
                                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                        LPN
                                      </p>
                                      <div className="text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm font-bold">
                                        {item.lpn || "—"}
                                      </div>
                                    </div>
                                    <div className="space-y-1.5 text-center">
                                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                        Ubicación
                                      </p>
                                      <div className="text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm">
                                        {item.localizacion || "—"}
                                      </div>
                                    </div>
                                    <div className="space-y-1.5 text-center">
                                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                        Días Actuales (FPC)
                                      </p>
                                      <div
                                        className={cn(
                                          "text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm font-mono font-bold",
                                          isExcedido
                                            ? "text-destructive"
                                            : "text-emerald-600",
                                        )}
                                      >
                                        {item.diasFPC} días
                                      </div>
                                    </div>
                                    <div className="space-y-1.5 text-center">
                                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                        Vida Útil Límite
                                      </p>
                                      <div className="text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm font-mono text-slate-400">
                                        {item.diasMinimosMaestra} días
                                      </div>
                                    </div>
                                    <div className="space-y-1.5 text-center">
                                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                        Estado
                                      </p>
                                      <div className="flex justify-center">
                                        <Badge
                                          variant={
                                            isExcedido
                                              ? "destructive"
                                              : "outline"
                                          }
                                          className={cn(
                                            "text-[10px] gap-1",
                                            !isExcedido &&
                                              "bg-green-100 text-green-700 border-green-200",
                                          )}
                                        >
                                          {isExcedido ? (
                                            <>
                                              <AlertCircle className="h-2.5 w-2.5" />
                                              EXCEDIDO
                                            </>
                                          ) : (
                                            <>
                                              <CheckCircle2 className="h-2.5 w-2.5" />
                                              OK
                                            </>
                                          )}
                                        </Badge>
                                      </div>
                                    </div>
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className="gap-1.5 px-2 py-0.5 text-[10px]"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    Mostrando {sortedData.length} de {data.length} registros
                  </Badge>
                  {sortedData.length < data.length && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Filter className="h-3 w-3" />
                      Filtrado
                    </Badge>
                  )}
                  {sortConfig && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <ArrowUpDown className="h-3 w-3" />
                      Orden:{" "}
                      {headers.find((h) => h.key === sortConfig.key)?.label} (
                      {sortConfig.direction === "asc" ? "↑" : "↓"})
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="default"
                    className={cn(
                      "gap-1.5 text-[10px]",
                      stats.excedidos === 0
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-amber-50 text-amber-700 border-amber-200",
                    )}
                  >
                    {stats.excedidos === 0 ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <AlertCircle className="h-3 w-3" />
                    )}
                    {stats.excedidos}{" "}
                    {stats.excedidos === 1 ? "excedido" : "excedidos"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] gap-1.5">
                    <Sparkles className="h-3 w-3" />
                    {Math.round(stats.porcentaje)}% válido
                  </Badge>
                  <Badge variant="outline" className="text-[10px] gap-1.5">
                    <Clock className="h-3 w-3" />
                    Promedio: {Math.round(stats.promedioDiasFPC)} días
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
