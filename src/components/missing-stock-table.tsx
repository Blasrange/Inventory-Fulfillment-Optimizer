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
  AlertTriangle,
  Info,
  PackageX,
  Package,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MissingProductsOutput } from "@/ai/flows/schemas";

interface MissingStockTableProps {
  products: MissingProductsOutput[];
  title?: string;
}

export function MissingStockTable({
  products,
  title = "Análisis de Productos Faltantes",
}: MissingStockTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [copiedRow, setCopiedRow] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "todos" | "sin-inventario" | "sin-reserva" | "insuficiente"
  >("todos");
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);

  // Separar productos por tipo de falta
  const sinInventario = products.filter(
    (p) => p.tipoFalta === "SIN_INVENTARIO" || !p.tipoFalta,
  );

  const sinReserva = products.filter((p) => p.tipoFalta === "SIN_RESERVA");

  const reservaInsuficiente = products.filter(
    (p) => p.tipoFalta === "RESERVA_INSUFICIENTE",
  );

  if (products.length === 0) {
    return (
      <div className="w-full rounded-xl border shadow-sm bg-white p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-full p-4 mb-4">
            <Package className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            No hay productos faltantes
          </h3>
          <p className="text-sm text-slate-500 max-w-md">
            Todos los productos tienen inventario suficiente para cubrir las
            ventas.
          </p>
        </div>
      </div>
    );
  }

  const formatNumber = (num?: number) => {
    return num !== undefined && num !== null
      ? num.toLocaleString("es-CL")
      : "0";
  };

  // Definir headers según el tipo
  const getHeadersForTab = () => {
    const baseHeaders = [
      { key: "sku", label: "SKU" },
      { key: "descripcion", label: "Descripción" },
      { key: "cantidadVendida", label: "Cant. Vendida" },
    ];

    if (activeTab === "insuficiente") {
      return [
        ...baseHeaders,
        { key: "stockEnPicking", label: "Stock Picking" },
        { key: "stockEnReserva", label: "Stock Reserva" },
        { key: "cantidadCubierta", label: "Cant. Cubierta" },
        { key: "cantidadFaltante", label: "Cant. Faltante" },
        { key: "estado", label: "Estado" },
      ];
    } else if (activeTab === "sin-reserva") {
      return [
        ...baseHeaders,
        { key: "stockEnPicking", label: "Stock Picking" },
        { key: "stockEnReserva", label: "Stock Reserva" },
        { key: "cantidadFaltante", label: "Cant. Faltante" },
        { key: "estado", label: "Estado" },
      ];
    } else {
      return [
        ...baseHeaders,
        { key: "cantidadFaltante", label: "Cant. Faltante" },
        { key: "estado", label: "Estado" },
      ];
    }
  };

  const headers = getHeadersForTab();

  // Filtrar datos según la pestaña activa y búsqueda
  const getBaseData = () => {
    switch (activeTab) {
      case "sin-inventario":
        return sinInventario;
      case "sin-reserva":
        return sinReserva;
      case "insuficiente":
        return reservaInsuficiente;
      default:
        return products;
    }
  };

  const baseData = getBaseData();

  // Filtrar por búsqueda
  const filteredData = useMemo(() => {
    if (!searchTerm) return baseData;

    return baseData.filter((item) => {
      return Object.values(item).some((val) => {
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(searchTerm.toLowerCase());
      });
    });
  }, [baseData, searchTerm]);

  // Ordenar datos
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;

    return [...filteredData].sort((a, b) => {
      let aVal, bVal;

      // Manejar casos especiales
      if (sortConfig.key === "estado") {
        aVal = a.tipoFalta || "SIN_INVENTARIO";
        bVal = b.tipoFalta || "SIN_INVENTARIO";
      } else {
        aVal = a[sortConfig.key as keyof MissingProductsOutput];
        bVal = b[sortConfig.key as keyof MissingProductsOutput];
      }

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

  // Estadísticas
  const stats = useMemo(() => {
    const totalSinInventario = sinInventario.reduce(
      (sum, item) => sum + (item.cantidadFaltante || item.cantidadVendida || 0),
      0,
    );
    const totalSinReserva = sinReserva.reduce(
      (sum, item) => sum + (item.cantidadFaltante || 0),
      0,
    );
    const totalInsuficiente = reservaInsuficiente.reduce(
      (sum, item) => sum + (item.cantidadFaltante || 0),
      0,
    );
    const totalGeneral =
      totalSinInventario + totalSinReserva + totalInsuficiente;

    return {
      totalSinInventario,
      totalSinReserva,
      totalInsuficiente,
      totalGeneral,
      countSinInventario: sinInventario.length,
      countSinReserva: sinReserva.length,
      countInsuficiente: reservaInsuficiente.length,
      totalProductos: products.length,
    };
  }, [sinInventario, sinReserva, reservaInsuficiente, products]);

  const clearFilters = () => {
    setSearchTerm("");
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
    const dataToExport =
      activeTab === "todos"
        ? products
        : activeTab === "sin-inventario"
          ? sinInventario
          : activeTab === "sin-reserva"
            ? sinReserva
            : reservaInsuficiente;

    if (format === "csv") {
      const headersMap = {
        sku: "SKU",
        descripcion: "Descripción",
        cantidadVendida: "Cantidad Vendida",
        stockEnPicking: "Stock Picking",
        stockEnReserva: "Stock Reserva",
        cantidadCubierta: "Cantidad Cubierta",
        cantidadFaltante: "Cantidad Faltante",
        tipoFalta: "Tipo de Falta",
      };

      const csvContent = [
        Object.values(headersMap).join(","),
        ...dataToExport.map((row) => {
          const values = [
            row.sku,
            `"${row.descripcion}"`,
            row.cantidadVendida || "",
            row.stockEnPicking || "",
            row.stockEnReserva || "",
            row.cantidadCubierta || "",
            row.cantidadFaltante || row.cantidadVendida || "",
            row.tipoFalta || "SIN_INVENTARIO",
          ];
          return values.join(",");
        }),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `faltantes_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    } else if (format === "json") {
      const jsonContent = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonContent], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `faltantes_${new Date().toISOString().slice(0, 10)}.json`;
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

  // Renderizar celda de estado según el tipo
  const renderEstadoBadge = (item: MissingProductsOutput) => {
    if (item.tipoFalta === "SIN_INVENTARIO" || !item.tipoFalta) {
      return (
        <Badge variant="destructive" className="gap-1.5">
          <PackageX className="h-3 w-3" />
          Sin Inventario
        </Badge>
      );
    } else if (item.tipoFalta === "SIN_RESERVA") {
      return (
        <Badge
          variant="outline"
          className="bg-orange-100 text-orange-700 border-orange-200 gap-1.5"
        >
          <Package className="h-3 w-3" />
          Sin Stock Reserva
        </Badge>
      );
    } else {
      return (
        <Badge
          variant="outline"
          className="bg-amber-100 text-amber-700 border-amber-200 gap-1.5"
        >
          <Layers className="h-3 w-3" />
          Reserva Insuficiente
        </Badge>
      );
    }
  };

  // Renderizar color de fila según el tipo
  const getRowClassName = (item: MissingProductsOutput) => {
    if (item.tipoFalta === "SIN_INVENTARIO" || !item.tipoFalta) {
      return "bg-destructive/5 hover:bg-destructive/10";
    } else if (item.tipoFalta === "SIN_RESERVA") {
      return "bg-orange-50/50 hover:bg-orange-100/50";
    } else {
      return "bg-amber-50/50 hover:bg-amber-100/50";
    }
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
                    <div className="p-2.5 bg-gradient-to-br from-destructive/10 to-destructive/5 rounded-xl">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        {title}
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5"
                        >
                          Críticos
                        </Badge>
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{stats.totalProductos} productos</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span>{visibleHeaders.length} columnas</span>
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

                {/* Tabs de navegación */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 border-b border-slate-200">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-none border-b-2 transition-all",
                        activeTab === "todos"
                          ? "border-primary text-primary"
                          : "border-transparent text-slate-500 hover:text-slate-700",
                      )}
                      onClick={() => setActiveTab("todos")}
                    >
                      Todos ({stats.totalProductos})
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-none border-b-2 transition-all",
                        activeTab === "sin-inventario"
                          ? "border-destructive text-destructive"
                          : "border-transparent text-slate-500 hover:text-slate-700",
                      )}
                      onClick={() => setActiveTab("sin-inventario")}
                    >
                      <PackageX className="h-3 w-3 mr-1" />
                      Sin Inventario ({stats.countSinInventario})
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-none border-b-2 transition-all",
                        activeTab === "sin-reserva"
                          ? "border-orange-500 text-orange-600"
                          : "border-transparent text-slate-500 hover:text-slate-700",
                      )}
                      onClick={() => setActiveTab("sin-reserva")}
                    >
                      <Package className="h-3 w-3 mr-1" />
                      Sin Reserva ({stats.countSinReserva})
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-none border-b-2 transition-all",
                        activeTab === "insuficiente"
                          ? "border-amber-500 text-amber-600"
                          : "border-transparent text-slate-500 hover:text-slate-700",
                      )}
                      onClick={() => setActiveTab("insuficiente")}
                    >
                      <Layers className="h-3 w-3 mr-1" />
                      Reserva Insuficiente ({stats.countInsuficiente})
                    </Button>
                  </div>

                  {/* Totales rápidos */}
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="destructive"
                      className="gap-1.5 text-[10px]"
                    >
                      <PackageX className="h-3 w-3" />
                      {stats.totalSinInventario.toLocaleString()} unds
                    </Badge>
                    <Badge
                      variant="outline"
                      className="bg-orange-100 text-orange-700 border-orange-200 gap-1.5 text-[10px]"
                    >
                      <Package className="h-3 w-3" />
                      {stats.totalSinReserva.toLocaleString()} unds
                    </Badge>
                    <Badge
                      variant="outline"
                      className="bg-amber-100 text-amber-700 border-amber-200 gap-1.5 text-[10px]"
                    >
                      <Layers className="h-3 w-3" />
                      {stats.totalInsuficiente.toLocaleString()} unds
                    </Badge>
                  </div>
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
                        "stockEnPicking",
                        "stockEnReserva",
                        "cantidadCubierta",
                        "cantidadFaltante",
                        "estado",
                      ].includes(header.key);

                      return (
                        <TableHead
                          key={header.key}
                          className={cn(
                            "text-[11px] font-bold text-slate-700 uppercase py-3 px-4 border-b whitespace-nowrap bg-inherit text-center",
                            (header.key === "cantidadFaltante" ||
                              header.key === "cantidadVendida" ||
                              header.key === "stockEnPicking" ||
                              header.key === "stockEnReserva" ||
                              header.key === "cantidadCubierta") &&
                              "text-center",
                            header.key === "cantidadFaltante" &&
                              activeTab === "sin-inventario" &&
                              "text-destructive",
                            header.key === "cantidadFaltante" &&
                              activeTab === "sin-reserva" &&
                              "text-orange-600",
                            header.key === "cantidadFaltante" &&
                              activeTab === "insuficiente" &&
                              "text-amber-600",
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
                      const originalIndex = products.findIndex(
                        (p) => p.sku === item.sku,
                      );

                      return (
                        <React.Fragment key={`${item.sku}-${index}`}>
                          <TableRow
                            className={cn(
                              "hover:bg-slate-50/80 transition-colors group",
                              expandedRows.has(originalIndex) &&
                                "bg-slate-50/50",
                              getRowClassName(item),
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

                              // Cantidad Vendida
                              if (header.key === "cantidadVendida") {
                                return (
                                  <TableCell
                                    key={header.key}
                                    className="text-center text-xs"
                                  >
                                    {formatNumber(item.cantidadVendida)}
                                  </TableCell>
                                );
                              }

                              // Stock en Picking
                              if (header.key === "stockEnPicking") {
                                return (
                                  <TableCell
                                    key={header.key}
                                    className="text-center text-xs"
                                  >
                                    {item.stockEnPicking ? (
                                      formatNumber(item.stockEnPicking)
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
                                  </TableCell>
                                );
                              }

                              // Stock en Reserva
                              if (header.key === "stockEnReserva") {
                                return (
                                  <TableCell
                                    key={header.key}
                                    className="text-center text-xs"
                                  >
                                    {item.stockEnReserva ? (
                                      formatNumber(item.stockEnReserva)
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
                                  </TableCell>
                                );
                              }

                              // Cantidad Cubierta
                              if (header.key === "cantidadCubierta") {
                                return (
                                  <TableCell
                                    key={header.key}
                                    className="text-center text-xs text-green-600 font-medium"
                                  >
                                    {item.cantidadCubierta ? (
                                      formatNumber(item.cantidadCubierta)
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
                                  </TableCell>
                                );
                              }

                              // Cantidad Faltante
                              if (header.key === "cantidadFaltante") {
                                const faltante =
                                  item.cantidadFaltante ||
                                  item.cantidadVendida ||
                                  0;
                                const colorClass =
                                  item.tipoFalta === "SIN_INVENTARIO" ||
                                  !item.tipoFalta
                                    ? "text-destructive"
                                    : item.tipoFalta === "SIN_RESERVA"
                                      ? "text-orange-600"
                                      : "text-amber-600";

                                return (
                                  <TableCell
                                    key={header.key}
                                    className={cn(
                                      "text-center text-xs font-bold",
                                      colorClass,
                                    )}
                                  >
                                    {formatNumber(faltante)}
                                  </TableCell>
                                );
                              }

                              // Estado
                              if (header.key === "estado") {
                                return (
                                  <TableCell
                                    key={header.key}
                                    className="text-center"
                                  >
                                    <div className="flex justify-center">
                                      {renderEstadoBadge(item)}
                                    </div>
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
                                    <div className="space-y-1.5 text-center">
                                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                        Cantidad Vendida
                                      </p>
                                      <div className="text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm">
                                        {formatNumber(item.cantidadVendida)}
                                      </div>
                                    </div>
                                    {item.stockEnPicking !== undefined && (
                                      <div className="space-y-1.5 text-center">
                                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                          Stock en Picking
                                        </p>
                                        <div className="text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm">
                                          {formatNumber(
                                            item.stockEnPicking,
                                          ) || (
                                            <span className="text-slate-300">
                                              0
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    {item.stockEnReserva !== undefined && (
                                      <div className="space-y-1.5 text-center">
                                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                          Stock en Reserva
                                        </p>
                                        <div className="text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm">
                                          {formatNumber(
                                            item.stockEnReserva,
                                          ) || (
                                            <span className="text-slate-300">
                                              0
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    {item.cantidadCubierta !== undefined && (
                                      <div className="space-y-1.5 text-center">
                                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                          Cantidad Cubierta
                                        </p>
                                        <div className="text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm text-green-600 font-medium">
                                          {formatNumber(
                                            item.cantidadCubierta,
                                          ) || (
                                            <span className="text-slate-300">
                                              0
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    <div className="space-y-1.5 text-center">
                                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                        Cantidad Faltante
                                      </p>
                                      <div
                                        className={cn(
                                          "text-xs bg-white p-2.5 rounded-lg border break-all shadow-sm font-bold",
                                          item.tipoFalta === "SIN_INVENTARIO" ||
                                            !item.tipoFalta
                                            ? "text-destructive"
                                            : item.tipoFalta === "SIN_RESERVA"
                                              ? "text-orange-600"
                                              : "text-amber-600",
                                        )}
                                      >
                                        {formatNumber(
                                          item.cantidadFaltante ||
                                            item.cantidadVendida,
                                        )}
                                      </div>
                                    </div>
                                    <div className="space-y-1.5 text-center">
                                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                        Tipo de Falta
                                      </p>
                                      <div className="flex justify-center">
                                        {renderEstadoBadge(item)}
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
                    Mostrando {sortedData.length} de{" "}
                    {activeTab === "todos"
                      ? products.length
                      : activeTab === "sin-inventario"
                        ? sinInventario.length
                        : activeTab === "sin-reserva"
                          ? sinReserva.length
                          : reservaInsuficiente.length}{" "}
                    registros
                  </Badge>
                  {sortedData.length <
                    (activeTab === "todos"
                      ? products.length
                      : activeTab === "sin-inventario"
                        ? sinInventario.length
                        : activeTab === "sin-reserva"
                          ? sinReserva.length
                          : reservaInsuficiente.length) && (
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
                  <Badge variant="destructive" className="gap-1.5 text-[10px]">
                    <PackageX className="h-3 w-3" />
                    {stats.totalSinInventario.toLocaleString()} unds
                  </Badge>
                  <Badge
                    variant="outline"
                    className="bg-orange-100 text-orange-700 border-orange-200 gap-1.5 text-[10px]"
                  >
                    <Package className="h-3 w-3" />
                    {stats.totalSinReserva.toLocaleString()} unds
                  </Badge>
                  <Badge
                    variant="outline"
                    className="bg-amber-100 text-amber-700 border-amber-200 gap-1.5 text-[10px]"
                  >
                    <Layers className="h-3 w-3" />
                    {stats.totalInsuficiente.toLocaleString()} unds
                  </Badge>
                  <Badge variant="outline" className="text-[10px] gap-1.5">
                    <Sparkles className="h-3 w-3" />
                    Total: {stats.totalGeneral.toLocaleString()} unds
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
