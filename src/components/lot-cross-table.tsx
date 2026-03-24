"use client";

import React, { useMemo, useState } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LotCrossResult } from "@/ai/flows/schemas";

interface LotCrossTableProps {
  data: LotCrossResult;
  title?: string;
}

export function LotCrossTable({
  data,
  title = "Cruce de Lotes SAP vs WMS",
}: LotCrossTableProps) {
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

  if (!data.results || data.results.length === 0) {
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
            No se encontraron resultados para el cruce de lotes.
          </p>
        </div>
      </div>
    );
  }

  const headers = [
    { key: "sku", label: "SKU" },
    { key: "descripcion", label: "Descripción" },
    { key: "lotesSap", label: "Lotes SAP" },
    { key: "lotesWms", label: "Lotes WMS" },
    { key: "lotesSoloSap", label: "Solo SAP" },
    { key: "lotesSoloWms", label: "Solo WMS" },
    { key: "cantidadSap", label: "Cant. SAP" },
    { key: "cantidadWms", label: "Cant. WMS" },
    { key: "estado", label: "Estado" },
  ];

  const filteredData = useMemo(() => {
    return data.results.filter((item) => {
      const matchesSearch =
        searchTerm === "" ||
        Object.values(item).some((val) =>
          String(val).toLowerCase().includes(searchTerm.toLowerCase()),
        );

      const matchesColumnFilters = Object.entries(columnFilters).every(
        ([key, filterValue]) => {
          if (!filterValue) return true;
          const itemKey = key as keyof typeof item;
          const rawValue = item[itemKey];
          const rowValue = Array.isArray(rawValue)
            ? rawValue.join(", ").toLowerCase()
            : String(rawValue || "").toLowerCase();
          return rowValue.includes(filterValue.toLowerCase());
        },
      );

      return matchesSearch && matchesColumnFilters;
    });
  }, [data.results, searchTerm, columnFilters]);

  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;

    return [...filteredData].sort((a, b) => {
      const key = sortConfig.key as keyof typeof a;
      const aVal = a[key];
      const bVal = b[key];

      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;

      if (typeof aVal === "number" && typeof bVal === "number") {
        const comparison = aVal - bVal;
        return sortConfig.direction === "asc" ? comparison : -comparison;
      }

      const aStr = Array.isArray(aVal)
        ? aVal.join(", ").toLowerCase()
        : String(aVal).toLowerCase();
      const bStr = Array.isArray(bVal)
        ? bVal.join(", ").toLowerCase()
        : String(bVal).toLowerCase();

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
              const formatted = Array.isArray(value)
                ? value.join(" | ")
                : String(value || "");
              return `"${formatted}"`;
            })
            .join(","),
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cruce_lotes_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === "json") {
      const jsonContent = JSON.stringify(sortedData, null, 2);
      const blob = new Blob([jsonContent], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cruce_lotes_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
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

  const stats = useMemo(() => {
    const total = data.results.length;
    const discrepancias = data.results.filter(
      (item) => item.estado === "DIFERENTE",
    ).length;
    const ok = total - discrepancias;
    const porcentaje = total > 0 ? (ok / total) * 100 : 0;

    const totalSap = data.results.reduce(
      (sum, item) => sum + item.cantidadSap,
      0,
    );
    const totalWms = data.results.reduce(
      (sum, item) => sum + item.cantidadWms,
      0,
    );

    const lotesSoloSap = data.results.reduce(
      (sum, item) => sum + item.lotesSoloSap.length,
      0,
    );
    const lotesSoloWms = data.results.reduce(
      (sum, item) => sum + item.lotesSoloWms.length,
      0,
    );

    return {
      total,
      discrepancias,
      ok,
      porcentaje,
      totalSap,
      totalWms,
      lotesSoloSap,
      lotesSoloWms,
    };
  }, [data.results]);

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
                    <div className="p-2.5 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl">
                      <Package className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        {title}
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5"
                        >
                          Lotes
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
                        OK: {stats.ok}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="gap-1.5 px-2 py-0.5 text-[10px]"
                      >
                        <AlertCircle className="h-3 w-3 text-destructive" />
                        Discrepancias: {stats.discrepancias}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="gap-1.5 px-2 py-0.5 text-[10px]"
                      >
                        <Package className="h-3 w-3 text-slate-500" />
                        Solo SAP: {stats.lotesSoloSap} | Solo WMS:{" "}
                        {stats.lotesSoloWms}
                      </Badge>
                    </div>
                    <span className="text-xs font-medium">
                      {Math.round(stats.porcentaje)}% conciliado
                    </span>
                  </div>
                  <Progress
                    value={stats.porcentaje}
                    className={cn(
                      "h-2",
                      stats.porcentaje === 100 ? "bg-green-500" : "bg-primary",
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
                        Orden:{" "}
                        {headers.find((h) => h.key === sortConfig.key)?.label} (
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
                    {visibleHeaders.map((header) => {
                      const isSortable = [
                        "sku",
                        "descripcion",
                        "lotesSap",
                        "lotesWms",
                        "lotesSoloSap",
                        "lotesSoloWms",
                        "cantidadSap",
                        "cantidadWms",
                        "estado",
                      ].includes(header.key);

                      return (
                        <TableHead
                          key={header.key}
                          className={cn(
                            "text-[11px] font-bold text-slate-700 uppercase py-3 px-4 border-b whitespace-nowrap bg-inherit text-center",
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
                      const hasDiff = item.estado === "DIFERENTE";

                      return (
                        <React.Fragment key={`${item.sku}-${index}`}>
                          <TableRow
                            className={cn(
                              "hover:bg-slate-50/80 transition-colors group",
                              expandedRows.has(index) && "bg-slate-50/50",
                              hasDiff &&
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
                                          hasDiff ? "destructive" : "outline"
                                        }
                                        className={cn(
                                          "text-[10px] px-2 py-0.5 gap-1",
                                          !hasDiff &&
                                            "bg-green-100 text-green-700 border-green-200",
                                        )}
                                      >
                                        {hasDiff ? (
                                          <>
                                            <AlertCircle className="h-2.5 w-2.5" />
                                            Discrepancia
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

                              if (
                                header.key === "cantidadSap" ||
                                header.key === "cantidadWms"
                              ) {
                                return (
                                  <TableCell
                                    key={header.key}
                                    className="text-center font-mono text-xs text-slate-600"
                                  >
                                    {item[
                                      header.key as
                                        | "cantidadSap"
                                        | "cantidadWms"
                                    ].toLocaleString()}
                                  </TableCell>
                                );
                              }

                              const rawValue =
                                item[header.key as keyof typeof item];
                              const formattedValue = Array.isArray(rawValue)
                                ? rawValue.join(", ")
                                : String(rawValue || "");

                              return (
                                <TableCell
                                  key={header.key}
                                  className="text-xs py-3 px-4 border-b text-slate-600 truncate max-w-[220px] text-center"
                                  title={formattedValue}
                                >
                                  {formattedValue || "—"}
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
                                        Estado
                                      </p>
                                      <div className="text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm font-semibold">
                                        {item.estado}
                                      </div>
                                    </div>
                                    <div className="space-y-1.5 text-center">
                                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                        Descripción
                                      </p>
                                      <div className="text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm">
                                        {item.descripcion || "—"}
                                      </div>
                                    </div>
                                    <div className="space-y-1.5 text-center">
                                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                        Cant. SAP
                                      </p>
                                      <div className="text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm font-mono">
                                        {item.cantidadSap.toLocaleString()}
                                      </div>
                                    </div>
                                    <div className="space-y-1.5 text-center">
                                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                        Cant. WMS
                                      </p>
                                      <div className="text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm font-mono">
                                        {item.cantidadWms.toLocaleString()}
                                      </div>
                                    </div>
                                    <div className="space-y-1.5 text-center lg:col-span-2">
                                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                        Solo SAP
                                      </p>
                                      <div className="text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm">
                                        {item.lotesSoloSap.join(", ") || "—"}
                                      </div>
                                    </div>
                                    <div className="space-y-1.5 text-center lg:col-span-2">
                                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                        Solo WMS
                                      </p>
                                      <div className="text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm">
                                        {item.lotesSoloWms.join(", ") || "—"}
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

            <div className="bg-gradient-to-r from-slate-50 via-white to-slate-50/50 p-3 border-t flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className="gap-1.5 px-2 py-0.5 text-[10px]"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    Mostrando {sortedData.length} de {data.results.length}{" "}
                    registros
                  </Badge>
                  {sortedData.length < data.results.length && (
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
                      stats.discrepancias === 0
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-amber-50 text-amber-700 border-amber-200",
                    )}
                  >
                    {stats.discrepancias === 0 ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <AlertCircle className="h-3 w-3" />
                    )}
                    {stats.discrepancias}{" "}
                    {stats.discrepancias === 1
                      ? "discrepancia"
                      : "discrepancias"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] gap-1.5">
                    <Sparkles className="h-3 w-3" />
                    {Math.round(stats.porcentaje)}% conciliado
                  </Badge>
                  <Badge variant="outline" className="text-[10px] gap-1.5">
                    <Package className="h-3 w-3" />
                    SAP: {stats.totalSap.toLocaleString()} | WMS:{" "}
                    {stats.totalWms.toLocaleString()}
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
