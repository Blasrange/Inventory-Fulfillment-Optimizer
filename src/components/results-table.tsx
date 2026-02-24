"use client";

import React from "react";
import { useState, useMemo } from "react";
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
  FileText,
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
  EyeOff,
  ArrowUp,
  ArrowDown,
  Package,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GenerateRestockSuggestionsOutput } from "@/ai/flows/schemas";

interface ResultsTableProps {
  results: GenerateRestockSuggestionsOutput;
  analysisMode: "sales" | "levels";
  title?: string;
}

export function ResultsTable({
  results,
  analysisMode,
  title = "Sugerencias de Surtido",
}: ResultsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [copiedRow, setCopiedRow] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>(
    {},
  );
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);

  const hasDestinationData = analysisMode === "levels";
  const isSalesAnalysis = analysisMode === "sales";

  if (!results || results.length === 0) {
    return (
      <div className="w-full rounded-xl border shadow-sm bg-white p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-full p-4 mb-4">
            <Package className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            No hay sugerencias disponibles
          </h3>
          <p className="text-sm text-slate-500 max-w-md">
            No se encontraron resultados para el análisis de surtido.
          </p>
        </div>
      </div>
    );
  }

  // Definir headers según el modo
  const headers = [
    { key: "sku", label: "SKU" },
    { key: "descripcion", label: "Descripción" },
    ...(hasDestinationData ? [{ key: "destino", label: "Destino" }] : []),
    ...(isSalesAnalysis
      ? [{ key: "cantidadVendida", label: "Cant. Vendida" }]
      : []),
    { key: "cantidadDisponible", label: "Cant. en Picking" },
    { key: "cantidadARestockear", label: "Cant. a Surtir" },
    { key: "accion", label: "Acción / Ubicaciones" },
  ];

  // Filtrar datos por búsqueda
  const filteredData = useMemo(() => {
    if (!searchTerm) return results;

    return results.filter((item) => {
      return (
        Object.values(item).some((val) => {
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(searchTerm.toLowerCase());
        }) ||
        item.ubicacionesSugeridas.some(
          (u) =>
            u.localizacion.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.lpn && u.lpn.toLowerCase().includes(searchTerm.toLowerCase())),
        )
      );
    });
  }, [results, searchTerm]);

  // Ordenar datos
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;

    return [...filteredData].sort((a, b) => {
      let aVal, bVal;

      // Manejar casos especiales
      if (sortConfig.key === "destino") {
        aVal = a.localizacionDestino || "";
        bVal = b.localizacionDestino || "";
      } else {
        aVal = a[sortConfig.key as keyof typeof a];
        bVal = b[sortConfig.key as keyof typeof b];
      }

      // Manejar valores nulos/undefined
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;

      if (aVal === bVal) return 0;

      const comparison = aVal < bVal ? -1 : 1;
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

  // Estadísticas
  const stats = useMemo(() => {
    const total = results.length;
    const conSurtido = results.filter(
      (item) => item.cantidadARestockear > 0,
    ).length;
    const sinSurtido = total - conSurtido;
    const totalCantidadSurtir = results.reduce(
      (sum, item) => sum + item.cantidadARestockear,
      0,
    );
    const promedioVentas = isSalesAnalysis
      ? results.reduce((sum, item) => sum + (item.cantidadVendida || 0), 0) /
        total
      : 0;

    return {
      total,
      conSurtido,
      sinSurtido,
      totalCantidadSurtir,
      promedioVentas: Math.round(promedioVentas * 10) / 10,
    };
  }, [results, isSalesAnalysis]);

  const clearFilters = () => {
    setSearchTerm("");
    setColumnFilters({});
    setSortConfig(null);
  };

  const activeFiltersCount = (searchTerm ? 1 : 0) + (sortConfig ? 1 : 0);

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
      const headersMap = {
        sku: "SKU",
        descripcion: "Descripción",
        cantidadVendida: "Cantidad Vendida",
        cantidadDisponible: "Cantidad en Picking",
        cantidadARestockear: "Cantidad a Surtir",
        localizacionDestino: "Destino",
        lpnDestino: "LPN Destino",
      };

      const csvContent = [
        Object.values(headersMap).join(","),
        ...results.map((row) => {
          const values = [
            row.sku,
            `"${row.descripcion}"`,
            row.cantidadVendida || "",
            row.cantidadDisponible,
            row.cantidadARestockear,
            row.localizacionDestino || "",
            row.lpnDestino || "",
          ];
          return values.join(",");
        }),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `surtido_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    } else if (format === "json") {
      const jsonContent = JSON.stringify(results, null, 2);
      const blob = new Blob([jsonContent], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `surtido_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
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
                    <div className="p-2.5 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl">
                      <Target className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        {title}
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5"
                        >
                          {analysisMode === "sales" ? "Ventas" : "Niveles"}
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

                {/* Barra de progreso */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className="gap-1.5 px-2 py-0.5 text-[10px]"
                      >
                        <Package className="h-3 w-3 text-primary" />A surtir:{" "}
                        {stats.conSurtido}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="gap-1.5 px-2 py-0.5 text-[10px]"
                      >
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        OK: {stats.sinSurtido}
                      </Badge>
                      {isSalesAnalysis && (
                        <Badge
                          variant="outline"
                          className="gap-1.5 px-2 py-0.5 text-[10px]"
                        >
                          <Target className="h-3 w-3 text-blue-500" />
                          Prom. ventas: {stats.promedioVentas}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs font-medium">
                      {Math.round((stats.conSurtido / stats.total) * 100)}% •
                      Total a surtir: {stats.totalCantidadSurtir} unidades
                    </span>
                  </div>

                  {/* Barra de progreso */}
                  <Progress
                    value={(stats.conSurtido / stats.total) * 100}
                    className="h-2"
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
                      // Determinar si la columna es ordenable
                      const isSortable = [
                        "sku",
                        "descripcion",
                        "cantidadVendida",
                        "cantidadDisponible",
                        "cantidadARestockear",
                        "destino",
                      ].includes(header.key);

                      return (
                        <TableHead
                          key={header.key}
                          className={cn(
                            "text-[11px] font-bold text-slate-700 uppercase py-3 px-4 border-b whitespace-nowrap bg-inherit text-center",
                            (header.key === "cantidadVendida" ||
                              header.key === "cantidadDisponible" ||
                              header.key === "cantidadARestockear") &&
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
                      const originalIndex = results.findIndex(
                        (r) => r.sku === item.sku,
                      );
                      const necesitaSurtir = item.cantidadARestockear > 0;

                      return (
                        <React.Fragment key={`${item.sku}-${index}`}>
                          <TableRow
                            className={cn(
                              "hover:bg-slate-50/80 transition-colors group",
                              expandedRows.has(originalIndex) &&
                                "bg-slate-50/50",
                              necesitaSurtir &&
                                "bg-amber-50/30 hover:bg-amber-50/50",
                            )}
                          >
                            <TableCell className="w-10 px-2 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => toggleRow(originalIndex)}
                              >
                                {expandedRows.has(originalIndex) ? (
                                  <ChevronUp className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </TableCell>

                            {visibleHeaders.map((header) => {
                              // SKU
                              if (header.key === "sku") {
                                return (
                                  <TableCell
                                    key={header.key}
                                    className="font-medium text-xs text-center"
                                  >
                                    {item.sku}
                                  </TableCell>
                                );
                              }

                              // Descripción
                              if (header.key === "descripcion") {
                                return (
                                  <TableCell
                                    key={header.key}
                                    className="text-xs max-w-[200px] truncate text-center"
                                    title={item.descripcion}
                                  >
                                    {item.descripcion}
                                  </TableCell>
                                );
                              }

                              // Destino (solo en modo levels)
                              if (
                                header.key === "destino" &&
                                hasDestinationData
                              ) {
                                return (
                                  <TableCell
                                    key={header.key}
                                    className="text-center"
                                  >
                                    {item.localizacionDestino && (
                                      <Badge
                                        variant="secondary"
                                        className="h-auto flex-col items-center px-2 py-1 text-[10px]"
                                      >
                                        <span className="font-semibold">
                                          {item.localizacionDestino}
                                        </span>
                                        {item.lpnDestino && (
                                          <span className="text-[8px] font-normal opacity-80">
                                            LPN: {item.lpnDestino}
                                          </span>
                                        )}
                                      </Badge>
                                    )}
                                  </TableCell>
                                );
                              }

                              // Cantidad Vendida (solo en modo sales)
                              if (
                                header.key === "cantidadVendida" &&
                                isSalesAnalysis
                              ) {
                                return (
                                  <TableCell
                                    key={header.key}
                                    className="text-center text-xs"
                                  >
                                    {item.cantidadVendida}
                                  </TableCell>
                                );
                              }

                              // Cantidad en Picking
                              if (header.key === "cantidadDisponible") {
                                return (
                                  <TableCell
                                    key={header.key}
                                    className="text-center text-xs"
                                  >
                                    {item.cantidadDisponible}
                                  </TableCell>
                                );
                              }

                              // Cantidad a Surtir
                              if (header.key === "cantidadARestockear") {
                                return (
                                  <TableCell
                                    key={header.key}
                                    className={cn(
                                      "text-center text-xs font-bold",
                                      item.cantidadARestockear > 0
                                        ? "text-primary"
                                        : "text-muted-foreground",
                                    )}
                                  >
                                    {item.cantidadARestockear}
                                  </TableCell>
                                );
                              }

                              // Acción / Ubicaciones
                              if (header.key === "accion") {
                                return (
                                  <TableCell
                                    key={header.key}
                                    className="text-center"
                                  >
                                    {item.cantidadARestockear > 0 ? (
                                      <div className="flex flex-wrap items-center justify-center gap-1">
                                        {item.ubicacionesSugeridas.length >
                                        0 ? (
                                          item.ubicacionesSugeridas.map(
                                            (ubicacion, uIndex) => (
                                              <Badge
                                                key={`${ubicacion.lpn || ubicacion.localizacion}-${uIndex}`}
                                                variant="secondary"
                                                className="h-auto flex-col items-center px-2 py-1 text-[10px]"
                                              >
                                                <span className="font-semibold">
                                                  {ubicacion.localizacion}
                                                </span>
                                                {ubicacion.lpn && (
                                                  <span className="text-[8px] font-normal opacity-80">
                                                    LPN: {ubicacion.lpn}
                                                  </span>
                                                )}
                                                {ubicacion.diasFPC !== null &&
                                                  ubicacion.diasFPC !==
                                                    undefined && (
                                                    <span className="text-[8px] font-normal opacity-80">
                                                      FPC: {ubicacion.diasFPC}
                                                    </span>
                                                  )}
                                              </Badge>
                                            ),
                                          )
                                        ) : (
                                          <Badge
                                            variant="destructive"
                                            className="text-[10px]"
                                          >
                                            Sin Origen
                                          </Badge>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="flex flex-wrap items-center justify-center gap-1">
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] bg-green-50 text-green-700 border-green-200"
                                        >
                                          OK
                                        </Badge>
                                        {item.ubicacionesSugeridas.map(
                                          (ubicacion, uIndex) => (
                                            <Badge
                                              key={`${ubicacion.lpn || ubicacion.localizacion}-${uIndex}`}
                                              variant="secondary"
                                              className="h-auto flex-col items-center px-2 py-1 text-[10px]"
                                            >
                                              <span className="font-semibold">
                                                {ubicacion.localizacion}
                                              </span>
                                              {ubicacion.lpn && (
                                                <span className="text-[8px] font-normal opacity-80">
                                                  LPN: {ubicacion.lpn}
                                                </span>
                                              )}
                                            </Badge>
                                          ),
                                        )}
                                      </div>
                                    )}
                                  </TableCell>
                                );
                              }

                              return null;
                            })}

                            <TableCell className="w-20 px-2 text-center">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() =>
                                      copyRowToClipboard(item, originalIndex)
                                    }
                                  >
                                    {copiedRow === originalIndex ? (
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

                          {expandedRows.has(originalIndex) && (
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
                                    {hasDestinationData &&
                                      item.localizacionDestino && (
                                        <div className="space-y-1.5 text-center">
                                          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                            Destino
                                          </p>
                                          <div className="text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm">
                                            {item.localizacionDestino}
                                            {item.lpnDestino &&
                                              ` (LPN: ${item.lpnDestino})`}
                                          </div>
                                        </div>
                                      )}
                                    {isSalesAnalysis && (
                                      <div className="space-y-1.5 text-center">
                                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                          Cantidad Vendida
                                        </p>
                                        <div className="text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm">
                                          {item.cantidadVendida}
                                        </div>
                                      </div>
                                    )}
                                    <div className="space-y-1.5 text-center">
                                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                        Cantidad en Picking
                                      </p>
                                      <div className="text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm">
                                        {item.cantidadDisponible}
                                      </div>
                                    </div>
                                    <div className="space-y-1.5 text-center">
                                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                        Cantidad a Surtir
                                      </p>
                                      <div
                                        className={cn(
                                          "text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm font-bold",
                                          item.cantidadARestockear > 0 &&
                                            "text-primary",
                                        )}
                                      >
                                        {item.cantidadARestockear}
                                      </div>
                                    </div>
                                    <div className="space-y-1.5 col-span-2 text-center">
                                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                        Ubicaciones Sugeridas
                                      </p>
                                      <div className="flex flex-wrap justify-center gap-2">
                                        {item.ubicacionesSugeridas.length >
                                        0 ? (
                                          item.ubicacionesSugeridas.map(
                                            (ubicacion, uIndex) => (
                                              <div
                                                key={uIndex}
                                                className="text-xs bg-white p-2 rounded-lg border shadow-sm"
                                              >
                                                <span className="font-semibold">
                                                  {ubicacion.localizacion}
                                                </span>
                                                {ubicacion.lpn && (
                                                  <span className="block text-[10px] text-slate-500">
                                                    LPN: {ubicacion.lpn}
                                                  </span>
                                                )}
                                                {ubicacion.diasFPC !== null &&
                                                  ubicacion.diasFPC !==
                                                    undefined && (
                                                    <span className="block text-[10px] text-slate-500">
                                                      FPC: {ubicacion.diasFPC}
                                                    </span>
                                                  )}
                                              </div>
                                            ),
                                          )
                                        ) : (
                                          <span className="text-xs text-slate-400 italic">
                                            Sin ubicaciones sugeridas
                                          </span>
                                        )}
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
                    Mostrando {sortedData.length} de {results.length} registros
                  </Badge>
                  {sortedData.length < results.length && (
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
                      stats.conSurtido === 0
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-amber-50 text-amber-700 border-amber-200",
                    )}
                  >
                    {stats.conSurtido === 0 ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <AlertCircle className="h-3 w-3" />
                    )}
                    {stats.conSurtido}{" "}
                    {stats.conSurtido === 1 ? "producto" : "productos"} por
                    surtir
                  </Badge>
                  <Badge variant="outline" className="text-[10px] gap-1.5">
                    <Sparkles className="h-3 w-3" />
                    {stats.totalCantidadSurtir} unidades
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
