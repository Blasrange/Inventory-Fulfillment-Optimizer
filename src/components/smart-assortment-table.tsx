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
  Truck,
  MapPin,
  Package,
  TrendingUp,
  AlertTriangle,
  Database,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Interfaz para ubicación sugerida
interface UbicacionSugerida {
  desde: string;
  lpnOrigen: string;
  hacia: string;
  cantidad: number;
  lote: string;
  fechaVencimiento: string;
  esFEFO: boolean;
  localizacion?: string;
  lpnDestino: string;
}

// Interfaz para sugerencia de surtido
interface SurtidoSuggestion {
  sku: string;
  descripcion: string;
  cantidadVendida: number;
  cantidadVendidaOriginal?: number;
  cantidadDisponiblePicking: number;
  cantidadEnReserva: number;
  cantidadARestockear: number;
  cantidadFaltante: number;
  ubicacionesSugeridas: UbicacionSugerida[];
  ubicacionDestino?: string;
  alerta?: string;
  tieneStockSuficiente: boolean;
  tieneReservaPendiente: boolean;
  prioridadAlta: boolean;
  existeEnMaestra: boolean;
  ubicacionMaestra?: string;
}

interface SurtidoInteligenteViewProps {
  suggestions: any[]; // Aceptamos any para manejar ambos formatos
  isLoading?: boolean;
  onRefresh?: () => void;
  title?: string;
}

// Función para transformar los datos del backend al formato del frontend
function transformBackendToFrontend(backendData: any[]): SurtidoSuggestion[] {
  if (!backendData || backendData.length === 0) {
    return [];
  }

  // Si ya tiene la estructura del frontend, devolver directamente
  if (backendData[0] && backendData[0].hasOwnProperty('cantidadDisponiblePicking')) {
    return backendData as SurtidoSuggestion[];
  }

  // Transformar desde el formato del backend
  return backendData.map((suggestion: any) => {
    // Transformar ubicaciones sugeridas
    const ubicacionesTransformadas = (suggestion.ubicacionesSugeridas || []).map((ubic: any) => ({
      desde: ubic.localizacion || ubic.desde || "",
      lpnOrigen: ubic.lpn || ubic.lpnOrigen || "",
      hacia: suggestion.localizacionDestino || "",
      cantidad: ubic.cantidad || 0,
      lote: ubic.lote || "",
      fechaVencimiento: ubic.fechaVencimiento || "",
      esFEFO: true,
      lpnDestino: suggestion.lpnDestino || "",
      localizacion: ubic.localizacion || "",
    }));

    const cantidadVendida = suggestion.cantidadVendida || 0;
    const cantidadDisponiblePicking = suggestion.cantidadDisponible || 0;
    const cantidadARestockear = suggestion.cantidadARestockear || 0;
    const cantidadFaltante = suggestion.cantidadFaltante || 0;
    
    const cantidadEnReserva = suggestion.cantidadEnReserva || ubicacionesTransformadas.reduce(
      (sum: any, u: { cantidad: any; }) => sum + u.cantidad,
      0
    );
    
    const tieneStockSuficiente = suggestion.tieneStockSuficiente !== undefined 
      ? suggestion.tieneStockSuficiente 
      : (cantidadFaltante === 0 && cantidadARestockear === 0);
    
    const tieneReservaPendiente = cantidadARestockear > 0;
    const prioridadAlta = suggestion.prioridadAlta || (cantidadVendida > 100);
    const existeEnMaestra = suggestion.existeEnMaestra || !!suggestion.localizacionDestino;

    return {
      sku: suggestion.sku || "",
      descripcion: suggestion.descripcion || "",
      cantidadVendida: cantidadVendida,
      cantidadVendidaOriginal: suggestion.cantidadVendidaOriginal || cantidadVendida,
      cantidadDisponiblePicking: cantidadDisponiblePicking,
      cantidadEnReserva: cantidadEnReserva,
      cantidadARestockear: cantidadARestockear,
      cantidadFaltante: cantidadFaltante,
      ubicacionesSugeridas: ubicacionesTransformadas,
      ubicacionDestino: suggestion.localizacionDestino || "",
      alerta: cantidadFaltante > 0 ? `Faltante: ${cantidadFaltante} unidades` : 
               cantidadARestockear > 0 ? `Surtir ${cantidadARestockear} unidades` : undefined,
      tieneStockSuficiente: tieneStockSuficiente,
      tieneReservaPendiente: tieneReservaPendiente,
      prioridadAlta: prioridadAlta,
      existeEnMaestra: existeEnMaestra,
      ubicacionMaestra: suggestion.localizacionDestino || "",
    };
  });
}

export function SurtidoInteligenteView({
  suggestions: rawSuggestions,
  isLoading = false,
  onRefresh,
  title = "Módulo Inteligente de Surtido",
}: SurtidoInteligenteViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipo, setFilterTipo] = useState<
    "todos" | "surtir" | "suficiente" | "faltante" | "maestra"
  >("todos");
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [copiedRow, setCopiedRow] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);

  // Transformar los datos al formato esperado por el frontend
  const suggestions = useMemo(() => {
    if (!rawSuggestions || rawSuggestions.length === 0) {
      return [];
    }
    
    // Si rawSuggestions es un objeto con propiedad suggestions (respuesta completa del backend)
    if (rawSuggestions && (rawSuggestions as any).suggestions) {
      return transformBackendToFrontend((rawSuggestions as any).suggestions);
    }
    
    // Si es un array directo
    return transformBackendToFrontend(rawSuggestions);
  }, [rawSuggestions]);

  // Debug
  // console.log("🔍 SurtidoInteligenteView - Suggestions transformadas:", suggestions.length);
  // if (suggestions.length > 0) {
  //   console.log("📋 Primera sugerencia:", suggestions[0]);
  // }

  if (isLoading) {
    return (
      <div className="w-full rounded-xl border shadow-sm bg-white p-12">
        <div className="flex flex-col items-center justify-center gap-4">
          <Sparkles className="h-12 w-12 animate-pulse text-primary" />
          <p className="text-slate-500">
            Analizando ventas, stock y aplicando FEFO...
          </p>
        </div>
      </div>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="w-full rounded-xl border shadow-sm bg-white p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-full p-4 mb-4">
            <Package className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            No hay sugerencias de surtido
          </h3>
          <p className="text-sm text-slate-500 max-w-md">
            No se encontraron resultados para el análisis de surtido inteligente.
            Verifica que hayas cargado datos de ventas, stock y maestra de
            materiales.
          </p>
        </div>
      </div>
    );
  }

  // Definir headers
  const headers = [
    { key: "sku", label: "SKU" },
    { key: "descripcion", label: "Descripción" },
    { key: "cantidadVendida", label: "Vendido", align: "center" },
    { key: "cantidadDisponiblePicking", label: "Picking", align: "center" },
    { key: "cantidadEnReserva", label: "Reserva", align: "center" },
    { key: "cantidadARestockear", label: "A Surtir", align: "center" },
    { key: "cantidadFaltante", label: "Faltante", align: "center" },
    { key: "ubicacionDestino", label: "Destino", align: "center" },
    { key: "estado", label: "Estado", align: "center" },
    { key: "maestra", label: "Maestra", align: "center" },
  ];

  // Filtrar datos
  const filteredData = useMemo(() => {
    let filtered = suggestions;

    // Búsqueda por texto
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((s) => {
        const mainFields = [s.sku, s.descripcion, s.ubicacionDestino];
        const ubicaciones = s.ubicacionesSugeridas
          .map((u) => [u.desde, u.hacia, u.lpnOrigen, u.lote])
          .flat();
        return [...mainFields, ...ubicaciones].some(
          (v) => v?.toLowerCase().includes(term),
        );
      });
    }

    // Filtro por tipo
    if (filterTipo !== "todos") {
      filtered = filtered.filter((s) => {
        if (filterTipo === "surtir") return s.cantidadARestockear > 0;
        if (filterTipo === "suficiente") return s.tieneStockSuficiente;
        if (filterTipo === "faltante") return s.cantidadFaltante > 0;
        if (filterTipo === "maestra") return s.existeEnMaestra;
        return true;
      });
    }

    return filtered;
  }, [suggestions, searchTerm, filterTipo]);

  // Ordenar datos
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;

    return [...filteredData].sort((a, b) => {
      let aVal, bVal;

      if (sortConfig.key === "estado") {
        aVal = a.tieneStockSuficiente ? "OK" : a.cantidadFaltante > 0 ? "Faltante" : "Surtir";
        bVal = b.tieneStockSuficiente ? "OK" : b.cantidadFaltante > 0 ? "Faltante" : "Surtir";
      } else if (sortConfig.key === "maestra") {
        aVal = a.existeEnMaestra ? "Sí" : "No";
        bVal = b.existeEnMaestra ? "Sí" : "No";
      } else {
        aVal = a[sortConfig.key as keyof SurtidoSuggestion];
        bVal = b[sortConfig.key as keyof SurtidoSuggestion];
      }

      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;

      if (typeof aVal === "number" && typeof bVal === "number") {
        const comparison = aVal - bVal;
        return sortConfig.direction === "asc" ? comparison : -comparison;
      }

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
    const totalSKUs = suggestions.length;
    const conStockSuficiente = suggestions.filter((s) => s.tieneStockSuficiente).length;
    const conFaltante = suggestions.filter((s) => s.cantidadFaltante > 0).length;
    const conPendienteSurtir = suggestions.filter((s) => s.cantidadARestockear > 0).length;
    const enMaestra = suggestions.filter((s) => s.existeEnMaestra).length;
    const altaRotacion = suggestions.filter((s) => s.prioridadAlta).length;
    const totalUnidadesASurtir = suggestions.reduce(
      (sum, s) => sum + s.cantidadARestockear,
      0,
    );
    const totalFaltante = suggestions.reduce(
      (sum, s) => sum + s.cantidadFaltante,
      0,
    );
    const totalReserva = suggestions.reduce(
      (sum, s) => sum + s.cantidadEnReserva,
      0,
    );

    return {
      totalSKUs,
      conStockSuficiente,
      conFaltante,
      conPendienteSurtir,
      enMaestra,
      altaRotacion,
      totalUnidadesASurtir,
      totalFaltante,
      totalReserva,
      porcentajeCobertura:
        totalSKUs > 0 ? Math.round((conStockSuficiente / totalSKUs) * 100) : 0,
    };
  }, [suggestions]);

  const clearFilters = () => {
    setSearchTerm("");
    setFilterTipo("todos");
    setSortConfig(null);
  };

  const activeFiltersCount = (searchTerm ? 1 : 0) + (filterTipo !== "todos" ? 1 : 0) + (sortConfig ? 1 : 0);

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

  const copyRowToClipboard = async (row: SurtidoSuggestion, index: number) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(row, null, 2));
      setCopiedRow(index);
      setTimeout(() => setCopiedRow(null), 2000);
    } catch (err) {
      console.error("Error al copiar:", err);
    }
  };

  const exportData = (format: "csv" | "json") => {
    const dataToExport = filteredData;

    if (format === "csv") {
      const headersMap = {
        sku: "SKU",
        descripcion: "Descripción",
        cantidadVendida: "Cantidad Vendida",
        cantidadDisponiblePicking: "Stock Picking",
        cantidadEnReserva: "Stock Reserva",
        cantidadARestockear: "Cantidad a Surtir",
        cantidadFaltante: "Cantidad Faltante",
        ubicacionDestino: "Destino",
        tieneStockSuficiente: "Stock Suficiente",
        prioridadAlta: "Alta Rotación",
        existeEnMaestra: "En Maestra",
      };

      const csvContent = [
        Object.values(headersMap).join(","),
        ...dataToExport.map((row) => {
          const values = [
            row.sku,
            `"${row.descripcion}"`,
            row.cantidadVendida,
            row.cantidadDisponiblePicking,
            row.cantidadEnReserva,
            row.cantidadARestockear,
            row.cantidadFaltante,
            row.ubicacionDestino || "",
            row.tieneStockSuficiente ? "Sí" : "No",
            row.prioridadAlta ? "Sí" : "No",
            row.existeEnMaestra ? "Sí" : "No",
          ];
          return values.join(",");
        }),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `surtido_inteligente_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    } else if (format === "json") {
      const jsonContent = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonContent], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `surtido_inteligente_${new Date().toISOString().slice(0, 10)}.json`;
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

  const getStatusBadge = (suggestion: SurtidoSuggestion) => {
    if (suggestion.tieneStockSuficiente) {
      return {
        label: "Stock suficiente",
        className: "bg-green-100 text-green-700 border-green-200",
        icon: <CheckCircle2 className="h-3 w-3 mr-1" />,
      };
    }
    if (suggestion.cantidadFaltante > 0) {
      return {
        label: `Faltante: ${suggestion.cantidadFaltante}`,
        className: "bg-red-100 text-red-700 border-red-200",
        icon: <AlertTriangle className="h-3 w-3 mr-1" />,
      };
    }
    if (suggestion.cantidadARestockear > 0) {
      return {
        label: `Surtir: ${suggestion.cantidadARestockear}`,
        className: "bg-amber-100 text-amber-700 border-amber-200",
        icon: <Truck className="h-3 w-3 mr-1" />,
      };
    }
    return {
      label: "OK",
      className: "bg-slate-100 text-slate-700",
      icon: null,
    };
  };

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
            {/* Header */}
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
                        <Badge variant="secondary" className="text-[10px] px-1.5">
                          FEFO + Alta Rotación
                        </Badge>
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{stats.totalSKUs} SKUs</span>
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

                    {/* Menú de columnas */}
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

                    {/* Exportar */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="default" size="sm" className="h-8 gap-1.5">
                          <Download className="h-3.5 w-3.5" />
                          <span className="text-xs hidden sm:inline">Exportar</span>
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

                    {/* Refresh */}
                    {onRefresh && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={onRefresh}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                      </Button>
                    )}

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

                {/* Stats y filtros */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="gap-1.5 px-2 py-0.5 text-[10px] cursor-pointer"
                        onClick={() => setFilterTipo("suficiente")}
                      >
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        OK: {stats.conStockSuficiente}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="gap-1.5 px-2 py-0.5 text-[10px] cursor-pointer"
                        onClick={() => setFilterTipo("surtir")}
                      >
                        <Truck className="h-3 w-3 text-amber-500" />
                        Surtir: {stats.conPendienteSurtir}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="gap-1.5 px-2 py-0.5 text-[10px] cursor-pointer"
                        onClick={() => setFilterTipo("faltante")}
                      >
                        <AlertTriangle className="h-3 w-3 text-red-500" />
                        Faltante: {stats.conFaltante}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="gap-1.5 px-2 py-0.5 text-[10px] cursor-pointer"
                        onClick={() => setFilterTipo("maestra")}
                      >
                        <Database className="h-3 w-3 text-purple-500" />
                        Maestra: {stats.enMaestra}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="gap-1.5 px-2 py-0.5 text-[10px]"
                      >
                        <TrendingUp className="h-3 w-3 text-blue-500" />
                        Alta Rotación: {stats.altaRotacion}
                      </Badge>
                    </div>
                    <span className="text-xs font-medium">
                      {stats.porcentajeCobertura}% cobertura •{" "}
                      {stats.totalUnidadesASurtir} unidades a surtir
                    </span>
                  </div>

                  <Progress
                    value={(stats.conStockSuficiente / stats.totalSKUs) * 100}
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
                    {filterTipo !== "todos" && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        Tipo: {filterTipo === "surtir" ? "A Surtir" : filterTipo === "suficiente" ? "Stock Suficiente" : filterTipo === "faltante" ? "Con Faltante" : "En Maestra"}
                      </Badge>
                    )}
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
                        "cantidadVendida",
                        "cantidadDisponiblePicking",
                        "cantidadEnReserva",
                        "cantidadARestockear",
                        "cantidadFaltante",
                      ].includes(header.key);

                      return (
                        <TableHead
                          key={header.key}
                          className={cn(
                            "text-[11px] font-bold text-slate-700 uppercase py-3 px-4 border-b whitespace-nowrap bg-inherit",
                            header.align === "center" && "text-center",
                            sortConfig?.key === header.key &&
                              isSortable &&
                              "text-primary",
                            isSortable &&
                              "cursor-pointer group hover:bg-slate-100/80 transition-colors",
                          )}
                          onClick={() => isSortable && handleSort(header.key)}
                        >
                          <div
                            className={cn(
                              "flex items-center gap-1.5",
                              header.align === "center" && "justify-center",
                            )}
                          >
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
                    sortedData.map((item, idx) => {
                      const status = getStatusBadge(item);
                      const hasMovements =
                        item.ubicacionesSugeridas &&
                        item.ubicacionesSugeridas.length > 0;
                      const isExpanded = expandedRows.has(idx);

                      return (
                        <React.Fragment key={`${item.sku}-${idx}`}>
                          <TableRow
                            className={cn(
                              "hover:bg-slate-50/80 transition-colors group",
                              isExpanded && "bg-slate-50/50",
                              item.prioridadAlta && "bg-blue-50/20",
                              item.cantidadFaltante > 0 && "bg-red-50/20",
                              item.cantidadARestockear > 0 && !item.cantidadFaltante && "bg-amber-50/20",
                            )}
                          >
                            <TableCell className="w-10 px-2 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => toggleRow(idx)}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </TableCell>

                            {/* SKU */}
                            {!hiddenColumns.has("sku") && (
                              <TableCell className="font-mono font-semibold text-xs text-center">
                                {item.sku}
                              </TableCell>
                            )}

                            {/* Descripción */}
                            {!hiddenColumns.has("descripcion") && (
                              <TableCell
                                className="text-xs max-w-[200px] truncate text-center"
                                title={item.descripcion}
                              >
                                {item.descripcion || "-"}
                              </TableCell>
                            )}

                            {/* Cantidad Vendida */}
                            {!hiddenColumns.has("cantidadVendida") && (
                              <TableCell className="text-center text-xs">
                                {item.cantidadVendida}
                                {item.prioridadAlta && item.cantidadVendidaOriginal && (
                                  <span className="text-[10px] text-blue-500 ml-1">
                                    (+{item.cantidadVendida - item.cantidadVendidaOriginal})
                                  </span>
                                )}
                              </TableCell>
                            )}

                            {/* Stock Picking */}
                            {!hiddenColumns.has("cantidadDisponiblePicking") && (
                              <TableCell className="text-center text-xs">
                                {item.cantidadDisponiblePicking}
                              </TableCell>
                            )}

                            {/* Stock Reserva */}
                            {!hiddenColumns.has("cantidadEnReserva") && (
                              <TableCell className="text-center text-xs text-purple-600">
                                {item.cantidadEnReserva || 0}
                              </TableCell>
                            )}

                            {/* A Surtir */}
                            {!hiddenColumns.has("cantidadARestockear") && (
                              <TableCell
                                className={cn(
                                  "text-center text-xs font-bold",
                                  item.cantidadARestockear > 0
                                    ? "text-amber-600"
                                    : "text-slate-400",
                                )}
                              >
                                {item.cantidadARestockear || 0}
                              </TableCell>
                            )}

                            {/* Faltante */}
                            {!hiddenColumns.has("cantidadFaltante") && (
                              <TableCell className="text-center">
                                {item.cantidadFaltante > 0 ? (
                                  <span className="text-red-600 font-bold text-xs">
                                    {item.cantidadFaltante}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </TableCell>
                            )}

                            {/* Destino */}
                            {!hiddenColumns.has("ubicacionDestino") && (
                              <TableCell className="text-center">
                                {item.ubicacionDestino && (
                                  <div className="flex items-center justify-center gap-1">
                                    <MapPin className="h-3 w-3 text-slate-400" />
                                    <span className="text-xs font-mono">
                                      {item.ubicacionDestino}
                                    </span>
                                  </div>
                                )}
                              </TableCell>
                            )}

                            {/* Estado */}
                            {!hiddenColumns.has("estado") && (
                              <TableCell className="text-center">
                                <Badge
                                  className={cn(
                                    "flex items-center justify-center gap-1 text-[10px] px-2 py-0.5",
                                    status.className,
                                  )}
                                >
                                  {status.icon}
                                  {status.label}
                                </Badge>
                              </TableCell>
                            )}

                            {/* Maestra */}
                            {!hiddenColumns.has("maestra") && (
                              <TableCell className="text-center">
                                {item.existeEnMaestra ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge
                                        variant="outline"
                                        className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] gap-1"
                                      >
                                        <Database className="h-3 w-3" />
                                        En maestra
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">
                                        Ubicación en maestra:{" "}
                                        {item.ubicacionMaestra || "N/A"}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <span className="text-slate-300 text-xs">-</span>
                                )}
                              </TableCell>
                            )}

                            <TableCell className="w-20 px-2 text-center">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => copyRowToClipboard(item, idx)}
                                  >
                                    {copiedRow === idx ? (
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

                          {/* Detalle expandido - Aquí se muestra la vista de detalle */}
                          {isExpanded && (
                            <TableRow className={cn(
                              hasMovements ? "bg-blue-50/30" : "bg-slate-50/30"
                            )}>
                              <TableCell colSpan={visibleHeaders.length + 2} className="p-0 border-b">
                                <div className={cn(
                                  "p-4",
                                  hasMovements ? "bg-gradient-to-br from-blue-50/50 to-white" : ""
                                )}>
                                  {hasMovements ? (
                                    <>
                                      <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                                        <Truck className="h-4 w-4" />
                                        Movimientos sugeridos para {item.sku}
                                      </h4>
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                          <thead className="bg-blue-100">
                                            <tr>
                                              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase">Desde</th>
                                              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase">LPN Origen</th>
                                              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase">Hacia</th>
                                              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase">LPN Destino</th>
                                              <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase">Cantidad</th>
                                              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase">Lote</th>
                                              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase">Vencimiento</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {item.ubicacionesSugeridas.map((movement, movIdx) => (
                                              <tr key={movIdx} className="border-b last:border-0 hover:bg-blue-50/50">
                                                <td className="px-3 py-2 font-mono text-xs">{movement.desde || "-"}</td>
                                                <td className="px-3 py-2 font-mono text-xs">{movement.lpnOrigen || "-"}</td>
                                                <td className="px-3 py-2 font-mono text-xs">{movement.hacia || "-"}</td>
                                                <td className="px-3 py-2 font-mono text-xs">{movement.lpnDestino || "-"}</td>
                                                <td className="px-3 py-2 text-center font-semibold text-xs">{movement.cantidad}</td>
                                                <td className="px-3 py-2 font-mono text-xs">{movement.lote || "-"}</td>
                                                <td className="px-3 py-2 text-xs">{movement.fechaVencimiento || "-"}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="text-center py-8 text-slate-500">
                                      <Package className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                                      <p className="text-sm font-medium">No hay movimientos sugeridos</p>
                                      <p className="text-xs mt-1">
                                        {item.tieneStockSuficiente 
                                          ? "El stock actual es suficiente para cubrir la demanda" 
                                          : item.cantidadFaltante > 0 
                                            ? "No hay suficiente stock en reserva para cubrir la demanda" 
                                            : "No se requieren movimientos de reabastecimiento"}
                                      </p>
                                    </div>
                                  )}
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
                  <Badge variant="outline" className="gap-1.5 px-2 py-0.5 text-[10px]">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    Mostrando {sortedData.length} de {filteredData.length} registros
                  </Badge>
                  {sortedData.length < filteredData.length && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Filter className="h-3 w-3" />
                      Filtrado
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] gap-1.5">
                    <Layers className="h-3 w-3" />
                    {stats.totalReserva.toLocaleString()} unds en reserva
                  </Badge>
                  <Badge variant="outline" className="text-[10px] gap-1.5">
                    <Sparkles className="h-3 w-3" />
                    Total faltante: {stats.totalFaltante.toLocaleString()} unds
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