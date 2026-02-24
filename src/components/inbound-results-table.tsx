"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  FileText,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Filter,
  X,
  Settings2,
  Eye,
  EyeOff,
  Sparkles,
  LayoutGrid,
  List,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface InboundResultsTableProps {
  data: any[];
  onExport?: (format: "csv" | "json" | "excel") => void;
  title?: string;
}

type ViewMode = "table" | "cards";

export function InboundResultsTable({
  data,
  onExport,
  title = "Resultados de Transformación",
}: InboundResultsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [copiedRow, setCopiedRow] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>(
    {},
  );

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  // Calcular anchos de columna basados en el contenido
  useEffect(() => {
    if (data.length > 0 && viewMode === "table") {
      const headers = Object.keys(data[0]);
      const widths: Record<string, number> = {};

      headers.forEach((header) => {
        // Calcular ancho basado en el header y los primeros 20 registros
        const maxLength = Math.max(
          header.length,
          ...data.slice(0, 20).map((row) => String(row[header] || "").length),
        );
        // Ancho mínimo de 100px, máximo de 300px, basado en caracteres (aprox 8px por caracter)
        widths[header] = Math.min(Math.max(maxLength * 8, 100), 300);
      });

      setColumnWidths(widths);
    }
  }, [data, viewMode]);

  if (!data || data.length === 0) {
    return (
      <div className="w-full rounded-xl border shadow-sm bg-white p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-full p-4 mb-4">
            <FileText className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            No hay datos disponibles
          </h3>
          <p className="text-sm text-slate-500 max-w-md">
            Los resultados de la transformación aparecerán aquí una vez que se
            complete el proceso.
          </p>
        </div>
      </div>
    );
  }

  const headers = Object.keys(data[0]);

  // Filtrar datos por búsqueda y filtros de columna
  const filteredData = useMemo(() => {
    return data.filter((row) => {
      const matchesSearch =
        searchTerm === "" ||
        Object.values(row).some((val) =>
          String(val).toLowerCase().includes(searchTerm.toLowerCase()),
        );

      const matchesColumnFilters = Object.entries(columnFilters).every(
        ([key, filterValue]) => {
          if (!filterValue) return true;
          const rowValue = String(row[key] || "").toLowerCase();
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
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (aVal === bVal) return 0;

      const comparison = aVal < bVal ? -1 : 1;
      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [filteredData, sortConfig]);

  const visibleHeaders = headers.filter((h) => !hiddenColumns.has(h));

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

  const toggleColumn = (column: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(column)) {
        next.delete(column);
      } else {
        next.add(column);
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

  const exportData = (format: "csv" | "json" | "excel") => {
    if (format === "csv") {
      const csvContent = [
        visibleHeaders.join(","),
        ...sortedData.map((row) =>
          visibleHeaders.map((h) => `"${row[h] || ""}"`).join(","),
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    } else if (format === "json") {
      const jsonContent = JSON.stringify(sortedData, null, 2);
      const blob = new Blob([jsonContent], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    }

    onExport?.(format);
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

  // Vista de tarjetas para móvil/compacta
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
                Registro #{index + 1}
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

            {visibleHeaders.slice(0, 4).map((header) => (
              <div key={header} className="space-y-1">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                  {header}
                </p>
                <p className="text-xs text-slate-700 break-words line-clamp-2">
                  {row[header] !== undefined &&
                  row[header] !== null &&
                  row[header] !== "" ? (
                    String(row[header])
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
                {visibleHeaders.slice(4).map((header) => (
                  <div key={header} className="space-y-1">
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                      {header}
                    </p>
                    <p className="text-xs text-slate-700 break-words">
                      {row[header] !== undefined &&
                      row[header] !== null &&
                      row[header] !== "" ? (
                        String(row[header])
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
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
      {/* Contenedor principal con fullscreen corregido */}
      <div
        ref={tableContainerRef}
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
            {/* Header modernizado */}
            <div className="border-b bg-gradient-to-r from-slate-50 via-white to-slate-50/50 p-4 flex-shrink-0">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        {title}
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5"
                        >
                          Beta
                        </Badge>
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{sortedData.length} registros</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span>{visibleHeaders.length} columnas visibles</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Switch de vista */}
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

                    {/* Búsqueda compacta */}
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

                    {/* Dropdowns compactos */}
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
                        <ScrollArea className="h-72">
                          {headers.map((header) => (
                            <DropdownMenuCheckboxItem
                              key={header}
                              checked={!hiddenColumns.has(header)}
                              onCheckedChange={() => toggleColumn(header)}
                              className="text-xs"
                            >
                              <span className="truncate">{header}</span>
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

                    {/* Botón de fullscreen con estilo mejorado */}
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

                {/* Filtros rápidos */}
                {activeFiltersCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="gap-1.5 px-2 py-0.5">
                      <Filter className="h-3 w-3" />
                      <span className="text-xs">
                        {activeFiltersCount} filtros activos
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
                        Orden: {sortConfig.key} ({sortConfig.direction})
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Contenido principal con scroll corregido */}
            {viewMode === "table" ? (
              <ScrollArea
                className={cn(
                  "w-full relative flex-1",
                  isFullscreen ? "min-h-0" : "h-[450px]",
                )}
              >
                <div className="min-w-full inline-block align-middle">
                  <Table className="w-full table-fixed">
                    <TableHeader className="bg-gradient-to-r from-slate-50 to-white sticky top-0 z-20 shadow-sm">
                      <TableRow>
                        <TableHead className="w-10 px-2 bg-inherit">
                          <span className="sr-only">Expandir</span>
                        </TableHead>
                        {visibleHeaders.map((h) => (
                          <TableHead
                            key={h}
                            style={{ width: columnWidths[h] || 150 }}
                            className={cn(
                              "text-[11px] font-semibold text-slate-700 uppercase py-3 px-4 border-b cursor-pointer group hover:bg-slate-100/80 transition-colors bg-inherit",
                              sortConfig?.key === h && "text-primary",
                            )}
                            onClick={() => handleSort(h)}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="truncate">{h}</span>
                              {sortConfig?.key === h ? (
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
                                  key={h}
                                  className="text-xs py-3 px-4 border-b text-slate-600 truncate"
                                  title={String(row[h] || "")}
                                >
                                  {row[h] !== undefined &&
                                  row[h] !== null &&
                                  row[h] !== "" ? (
                                    String(row[h])
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </TableCell>
                              ))}
                              <TableCell className="w-20 px-2 text-center">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => copyRowToClipboard(row, i)}
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
                                      {Object.entries(row).map(
                                        ([key, value]) => (
                                          <div
                                            key={key}
                                            className="space-y-1.5"
                                          >
                                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                              {key}
                                              {!visibleHeaders.includes(
                                                key,
                                              ) && (
                                                <EyeOff className="h-3 w-3 text-slate-300" />
                                              )}
                                            </p>
                                            <div className="text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm">
                                              {value !== undefined &&
                                              value !== null &&
                                              value !== "" ? (
                                                String(value)
                                              ) : (
                                                <span className="text-slate-300 italic">
                                                  Sin valor
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        ),
                                      )}
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

            {/* Footer mejorado */}
            <div className="bg-gradient-to-r from-slate-50 via-white to-slate-50/50 p-3 border-t flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className="gap-1.5 px-2 py-0.5 text-[10px]"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    {sortedData.length} registros
                  </Badge>
                  {sortedData.length < data.length && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Filter className="h-3 w-3" />
                      Filtrado:{" "}
                      {((sortedData.length / data.length) * 100).toFixed(0)}%
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="default"
                    className="bg-green-50 text-green-700 hover:bg-green-50 border-green-200 gap-1.5 text-[10px]"
                  >
                    <Check className="h-3 w-3" />
                    Datos validados
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
    </TooltipProvider>
  );
}
