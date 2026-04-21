"use client";

import React, { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Columns,
  Package,
  Search,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Download,
  FileJson,
  FileSpreadsheet,
  Filter,
  Clock,
  X,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Eye,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface InventoryAgeTableProps {
  data: any[];
  title?: string;
}

const headers = [
  { key: "sku", label: "SKU" },
  { key: "descripcion", label: "Descripción" },
  { key: "lpn", label: "LPN" },
  { key: "localizacion", label: "Ubicación" },
  { key: "lote", label: "Lote" },
  { key: "estado", label: "Estado" },
  { key: "fechaEntrada", label: "Fecha de Entrada" },
  { key: "diasEnInventario", label: "Días" },
  { key: "rangoEdad", label: "Rango" },
];

function getBucketVariant(bucket: string) {
  switch (bucket) {
    case "0-3 meses":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "3-6 meses":
      return "bg-cyan-100 text-cyan-700 border-cyan-200";
    case "6-12 meses":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "> 12 meses":
      return "bg-rose-100 text-rose-700 border-rose-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export function InventoryAgeTable({
  data,
  title = "Edad del Inventario",
}: InventoryAgeTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>({ key: "diasEnInventario", direction: "desc" });
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [bucketFilter, setBucketFilter] = useState<string>("all");
  const [copiedRow, setCopiedRow] = useState<number | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);

  const stats = useMemo(() => {
    const counts = {
      total: data.length,
      bucket0to3: data.filter((item) => item.rangoEdad === "0-3 meses").length,
      bucket3to6: data.filter((item) => item.rangoEdad === "3-6 meses").length,
      bucket6to12: data.filter((item) => item.rangoEdad === "6-12 meses").length,
      bucket12plus: data.filter((item) => item.rangoEdad === "> 12 meses").length,
      missingDate: data.filter((item) => item.rangoEdad === "Sin fecha de entrada").length,
    };

    const inventoryWithDate = data.filter(
      (item) => item.rangoEdad !== "Sin fecha de entrada",
    ).length;
    const freshInventory = counts.bucket0to3 + counts.bucket3to6;
    const healthPercentage =
      inventoryWithDate > 0 ? (freshInventory / inventoryWithDate) * 100 : 0;

    return {
      ...counts,
      inventoryWithDate,
      freshInventory,
      agedInventory: counts.bucket6to12 + counts.bucket12plus,
      healthPercentage,
    };
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchesSearch =
        searchTerm === "" ||
        Object.values(item).some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase()),
        );

      const matchesBucket =
        bucketFilter === "all" ? true : item.rangoEdad === bucketFilter;

      return matchesSearch && matchesBucket;
    });
  }, [data, searchTerm, bucketFilter]);

  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.key as keyof typeof a];
      const bVal = b[sortConfig.key as keyof typeof b];

      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      const comparison = String(aVal).localeCompare(String(bVal), "es", {
        sensitivity: "base",
      });
      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [filteredData, sortConfig]);

  const visibleHeaders = headers.filter((header) => !hiddenColumns.has(header.key));

  const activeFiltersCount =
    (searchTerm ? 1 : 0) +
    (bucketFilter !== "all" ? 1 : 0) +
    (sortConfig ? 1 : 0);

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

  const clearFilters = () => {
    setSearchTerm("");
    setBucketFilter("all");
    setSortConfig({ key: "diasEnInventario", direction: "desc" });
  };

  const copyRowToClipboard = async (row: any, index: number) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(row, null, 2));
      setCopiedRow(index);
      setTimeout(() => setCopiedRow(null), 2000);
    } catch (error) {
      console.error("Error al copiar:", error);
    }
  };

  const exportData = (format: "csv" | "json") => {
    if (format === "csv") {
      const csvContent = [
        visibleHeaders.map((header) => header.label).join(","),
        ...sortedData.map((row) =>
          visibleHeaders
            .map((header) => {
              const value = row[header.key as keyof typeof row];
              return `"${value ?? ""}"`;
            })
            .join(","),
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `edad_inventario_${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      return;
    }

    const jsonContent = JSON.stringify(sortedData, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `edad_inventario_${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!data.length) {
    return (
      <div className="w-full rounded-xl border bg-white p-12 text-center">
        <div className="mb-4 inline-flex rounded-full bg-slate-100 p-4">
          <Package className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">
          No hay inventario para analizar
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          Carga un archivo con fecha de entrada para calcular la edad del inventario.
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider>
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
            <div className="border-b bg-gradient-to-r from-slate-50 via-white to-slate-50/50 p-4 flex-shrink-0">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-orange-500/10 to-amber-500/5 rounded-xl">
                      <CalendarClock className="h-4 w-4 text-orange-500" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        {title}
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5"
                        >
                          Antiguedad
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
                    <div className="relative w-56">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Buscar..."
                        className="h-8 pl-7 pr-7 text-xs bg-white/50 backdrop-blur-sm border-slate-200 focus:bg-white"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
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
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5"
                        >
                          <Filter className="h-3.5 w-3.5" />
                          <span className="text-xs hidden sm:inline">
                            {bucketFilter === "all" ? "Rangos" : bucketFilter}
                          </span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuLabel className="text-xs font-medium">
                          Filtrar por edad
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {[
                          "all",
                          "0-3 meses",
                          "3-6 meses",
                          "6-12 meses",
                          "> 12 meses",
                          "Sin fecha de entrada",
                        ].map((bucket) => (
                          <DropdownMenuCheckboxItem
                            key={bucket}
                            checked={bucketFilter === bucket}
                            onCheckedChange={() => setBucketFilter(bucket)}
                            className="text-xs"
                          >
                            {bucket === "all" ? "Todos" : bucket}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

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

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className="gap-1.5 px-2 py-0.5 text-[10px]"
                      >
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        0-6 meses: {stats.freshInventory}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="gap-1.5 px-2 py-0.5 text-[10px]"
                      >
                        <AlertCircle className="h-3 w-3 text-amber-500" />
                        6+ meses: {stats.agedInventory}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="gap-1.5 px-2 py-0.5 text-[10px]"
                      >
                        <Clock className="h-3 w-3 text-slate-500" />
                        Sin fecha: {stats.missingDate}
                      </Badge>
                    </div>
                    <span className="text-xs font-medium">
                      {Math.round(stats.healthPercentage)}% dentro de 0-6 meses
                    </span>
                  </div>
                  <Progress
                    value={stats.healthPercentage}
                    className={cn(
                      "h-2",
                      stats.healthPercentage >= 70 ? "bg-green-500" : "bg-amber-500",
                    )}
                  />
                </div>

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
                        Orden: {headers.find((h) => h.key === sortConfig.key)?.label} (
                        {sortConfig.direction === "asc" ? "↑" : "↓"})
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

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
                          "text-[11px] font-bold text-slate-700 uppercase py-3 px-4 border-b whitespace-nowrap bg-inherit text-center cursor-pointer group hover:bg-slate-100/80 transition-colors",
                          sortConfig?.key === header.key && "text-primary",
                        )}
                        onClick={() => handleSort(header.key)}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span>{header.label}</span>
                          {sortConfig?.key === header.key ? (
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
                    sortedData.map((row, index) => (
                      <React.Fragment key={`${row.sku}-${row.lpn}-${index}`}>
                        <TableRow
                          className={cn(
                            "hover:bg-slate-50/80 transition-colors group",
                            expandedRows.has(index) && "bg-slate-50/50",
                            row.rangoEdad === "> 12 meses" &&
                              "bg-rose-50/40 hover:bg-rose-50/70",
                            row.rangoEdad === "6-12 meses" &&
                              "bg-amber-50/30 hover:bg-amber-50/60",
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
                            if (header.key === "rangoEdad") {
                              return (
                                <TableCell key={header.key} className="text-center">
                                  <div className="flex justify-center">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-[10px] px-2 py-0.5 gap-1",
                                        getBucketVariant(String(row.rangoEdad)),
                                      )}
                                    >
                                      <Clock className="h-2.5 w-2.5" />
                                      {row.rangoEdad}
                                    </Badge>
                                  </div>
                                </TableCell>
                              );
                            }

                            if (header.key === "diasEnInventario") {
                              return (
                                <TableCell
                                  key={header.key}
                                  className="text-center font-mono text-xs text-slate-600"
                                >
                                  {row.diasEnInventario ?? "S/D"}
                                </TableCell>
                              );
                            }

                            return (
                              <TableCell
                                key={header.key}
                                className="text-xs py-3 px-4 border-b text-slate-600 truncate max-w-[200px] text-center"
                                title={String(row[header.key as keyof typeof row] || "")}
                              >
                                {row[header.key as keyof typeof row] || "—"}
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
                                  onClick={() => copyRowToClipboard(row, index)}
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
                                      {row.sku || "—"}
                                    </div>
                                  </div>
                                  <div className="space-y-1.5 text-center">
                                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                      Descripción
                                    </p>
                                    <div className="text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm">
                                      {row.descripcion || "—"}
                                    </div>
                                  </div>
                                  <div className="space-y-1.5 text-center">
                                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                      LPN
                                    </p>
                                    <div className="text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm font-mono">
                                      {row.lpn || "—"}
                                    </div>
                                  </div>
                                  <div className="space-y-1.5 text-center">
                                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                      Ubicación
                                    </p>
                                    <div className="text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm">
                                      {row.localizacion || "—"}
                                    </div>
                                  </div>
                                  <div className="space-y-1.5 text-center">
                                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                      Lote
                                    </p>
                                    <div className="text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm">
                                      {row.lote || "—"}
                                    </div>
                                  </div>
                                  <div className="space-y-1.5 text-center">
                                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                      Estado
                                    </p>
                                    <div className="text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm">
                                      {row.estado || "—"}
                                    </div>
                                  </div>
                                  <div className="space-y-1.5 text-center">
                                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                      Fecha de Entrada
                                    </p>
                                    <div className="text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm font-mono">
                                      {row.fechaEntrada || "—"}
                                    </div>
                                  </div>
                                  <div className="space-y-1.5 text-center">
                                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                      Días en Inventario
                                    </p>
                                    <div className="text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm font-mono font-bold">
                                      {row.diasEnInventario ?? "S/D"}
                                    </div>
                                  </div>
                                  <div className="space-y-1.5 text-center lg:col-span-2">
                                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                      Rango de Edad
                                    </p>
                                    <div className="flex justify-center">
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "text-[10px] px-2 py-0.5 gap-1",
                                          getBucketVariant(String(row.rangoEdad)),
                                        )}
                                      >
                                        <Clock className="h-2.5 w-2.5" />
                                        {row.rangoEdad}
                                      </Badge>
                                    </div>
                                  </div>
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
            </ScrollArea>

            <div className="bg-gradient-to-r from-slate-50 via-white to-slate-50/50 p-3 border-t flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className="gap-1.5 px-2 py-0.5 text-[10px]"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
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
                      Orden: {headers.find((h) => h.key === sortConfig.key)?.label} (
                      {sortConfig.direction === "asc" ? "↑" : "↓"})
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="default"
                    className={cn(
                      "gap-1.5 text-[10px]",
                      stats.bucket12plus > 0
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-green-50 text-green-700 border-green-200",
                    )}
                  >
                    {stats.bucket12plus > 0 ? (
                      <AlertCircle className="h-3 w-3" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    {stats.bucket12plus} con más de 12 meses
                  </Badge>
                  <Badge variant="outline" className="text-[10px] gap-1.5">
                    <Sparkles className="h-3 w-3" />
                    {Math.round(stats.healthPercentage)}% dentro de 0-6 meses
                  </Badge>
                  <Badge variant="outline" className="text-[10px] gap-1.5">
                    <Package className="h-3 w-3" />
                    Con fecha: {stats.inventoryWithDate} | Sin fecha: {stats.missingDate}
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