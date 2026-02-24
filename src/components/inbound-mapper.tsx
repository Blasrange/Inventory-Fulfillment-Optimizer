"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Table as TableIcon,
  Settings2,
  Box,
  FileText,
  Truck,
  CheckCircle2,
  AlertCircle,
  Hash,
  Keyboard,
  Search,
  Eye,
  EyeOff,
  Columns,
  ArrowRightLeft,
  Sparkles,
  X,
  ChevronDown,
  ChevronUp,
  Filter,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  LayoutGrid,
  List,
  Download,
  FileJson,
  FileSpreadsheet,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface InboundMapperProps {
  headers: string[];
  rows: any[];
  onMappingChange: (
    mapping: Record<string, string>,
    fixedValues: Record<string, string>,
  ) => void;
}

// Configuración de campos mejorada con descripciones y colores
const FIELD_GROUPS = [
  {
    title: "Información de la Orden",
    icon: <FileText className="h-5 w-5 text-blue-500" />,
    color: "blue",
    description: "Datos principales de la orden de entrada",
    fields: [
      {
        key: "N_ORDER",
        label: "Número de Orden",
        description: "Identificador único de la orden",
        required: true,
        dynamic: false,
        placeholder: "Ej: ORD-2024-001",
      },
      {
        key: "PROVIDER_UID",
        label: "ID Proveedor",
        description: "Código del proveedor",
        required: true,
        dynamic: true,
        placeholder: "Ej: Nit: 9005222651",
      },
      {
        key: "ORDER_DATE",
        label: "Fecha Orden",
        description: "Fecha de creación de la orden",
        required: true,
        dynamic: true,
        placeholder: "DD/MM/YYYY",
      },
      {
        key: "INBOUNDTYPE_CODE",
        label: "Tipo Entrada",
        description: "Tipo de operación",
        required: true,
        dynamic: true,
        placeholder: "Ej: Código: 101",
      },
      {
        key: "PURCHASE_ORDER",
        label: "Orden de Compra",
        description: "OC del cliente",
        required: false,
        dynamic: false,
        placeholder: "Ej: PO-12345",
      },
      {
        key: "INVOICE",
        label: "Factura",
        description: "Número de factura",
        required: false,
        dynamic: false,
        placeholder: "Ej: F001-123",
      },
      {
        key: "ORDER2",
        label: "Orden Secundaria",
        description: "Referencia adicional",
        required: false,
        dynamic: false,
        placeholder: "Ej: REF-002",
      },
      {
        key: "SERVICE_DATE",
        label: "Fecha Servicio",
        description: "Fecha de prestación del servicio",
        required: false,
        dynamic: true,
        placeholder: "DD/MM/YYYY",
      },
    ],
  },
  {
    title: "Detalles del Producto",
    icon: <Box className="h-5 w-5 text-orange-500" />,
    color: "orange",
    description: "Información de los productos recibidos",
    fields: [
      {
        key: "SKU",
        label: "SKU / Código",
        description: "Código único del producto",
        required: true,
        dynamic: false,
        placeholder: "Ej: PROD-001",
      },
      {
        key: "QTY",
        label: "Cantidad",
        description: "Unidades recibidas",
        required: true,
        dynamic: false,
        placeholder: "Ej: 10",
      },
      {
        key: "UOM_CODE",
        label: "Unidad Medida",
        description: "Unidad de medida (UN, KG, LT)",
        required: true,
        dynamic: true,
        placeholder: "Ej: UNI, CJ, LT",
      },
      {
        key: "ESTADO_CALIDAD",
        label: "Estado Calidad",
        description: "Condición del producto",
        required: true,
        dynamic: true,
        placeholder: "Ej: Código: L, DSP,AV",
      },
      {
        key: "LOTE",
        label: "Lote",
        description: "Número de lote",
        required: false,
        dynamic: false,
        placeholder: "Ej: LOTE-2024-01",
      },
      {
        key: "FECHA_DE_VENCIMIENTO",
        label: "Vencimiento",
        description: "Fecha de expiración",
        required: false,
        dynamic: false,
        placeholder: "DD/MM/YYYY",
      },
      {
        key: "FECHA_DE_FABRICACION",
        label: "Fabricación",
        description: "Fecha de fabricación",
        required: false,
        dynamic: false,
        placeholder: "DD/MM/YYYY",
      },
      {
        key: "SERIAL",
        label: "Serial",
        description: "Número de serie",
        required: false,
        dynamic: false,
        placeholder: "Ej: SN-001",
      },
    ],
  },
  {
    title: "Logística y Otros",
    icon: <Truck className="h-5 w-5 text-green-500" />,
    color: "green",
    description: "Información logística adicional",
    fields: [
      {
        key: "IBL_LPN_CODE",
        label: "Código LPN",
        description: "Código de unidad logística",
        required: false,
        dynamic: false,
        placeholder: "Ej: LPN-001",
      },
      {
        key: "IBL_WEIGHT",
        label: "Peso Total",
        description: "Peso en kilogramos",
        required: false,
        dynamic: false,
        placeholder: "Ej: 25.5",
      },
      {
        key: "REFERENCE",
        label: "Referencia",
        description: "Referencia interna",
        required: false,
        dynamic: false,
        placeholder: "Ej: REF-INT-001",
      },
      {
        key: "PRICE",
        label: "Precio",
        description: "Precio unitario",
        required: false,
        dynamic: false,
        placeholder: "Ej: 99.99",
      },
      {
        key: "TAXES",
        label: "Impuestos",
        description: "Porcentaje de impuestos",
        required: false,
        dynamic: false,
        placeholder: "Ej: 19",
      },
    ],
  },
];

// Constantes para campos de fecha
const DATE_FIELDS = [
  "ORDER_DATE",
  "SERVICE_DATE",
  "FECHA_DE_VENCIMIENTO",
  "FECHA_DE_FABRICACION",
];

export function InboundMapper({
  headers,
  rows,
  onMappingChange,
}: InboundMapperProps) {
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fixedValues, setFixedValues] = useState<Record<string, string>>({});
  const [modes, setModes] = useState<Record<string, "mapping" | "fixed">>(
    () => {
      const initial: Record<string, "mapping" | "fixed"> = {};
      FIELD_GROUPS.forEach((g) =>
        g.fields.forEach((f) => {
          initial[f.key] = "mapping";
        }),
      );
      return initial;
    },
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      FIELD_GROUPS.forEach((_, index) => {
        initial[index] = true;
      });
      return initial;
    },
  );
  const [showPreview, setShowPreview] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>(
    {},
  );
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  // Función para formatear fecha automáticamente mientras se escribe
  const formatDateInput = (value: string): string => {
    // Eliminar cualquier carácter que no sea número
    let numbers = value.replace(/\D/g, "");

    // Limitar a 8 dígitos (DDMMYYYY)
    numbers = numbers.slice(0, 8);

    // Aplicar formato DD/MM/YYYY
    if (numbers.length <= 2) {
      return numbers;
    } else if (numbers.length <= 4) {
      return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
    } else {
      return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
    }
  };

  // Función para validar si una fecha es válida
  const isValidDate = (dateStr: string): boolean => {
    if (!dateStr) return true; // Vacío es válido (no requerido)

    const parts = dateStr.split("/");
    if (parts.length !== 3) return false;

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Los meses en JS son 0-11
    const year = parseInt(parts[2], 10);

    const date = new Date(year, month, day);

    return (
      date.getDate() === day &&
      date.getMonth() === month &&
      date.getFullYear() === year &&
      year >= 1900 &&
      year <= 2100
    ); // Rango razonable de años
  };

  // Función para manejar el cambio en campos de fecha
  const handleDateInputChange = (
    fieldKey: string,
    value: string,
    onChange: (key: string, val: string) => void,
  ) => {
    const formattedValue = formatDateInput(value);
    onChange(fieldKey, formattedValue);
  };

  // Función para formatear fechas en la vista previa
  const formatDateForDisplay = (value: any, header: string): string => {
    if (!value) return "";

    // Si es un campo de fecha y tiene formato numérico, intentar formatearlo
    const isDateColumn = DATE_FIELDS.some(
      (field) =>
        mapping[field] === header ||
        field.toLowerCase().includes(header.toLowerCase()),
    );

    if (isDateColumn && typeof value === "string") {
      // Si es YYYYMMDD
      if (/^\d{8}$/.test(value)) {
        return `${value.slice(6, 8)}/${value.slice(4, 6)}/${value.slice(0, 4)}`;
      }
      // Si es DDMMYYYY sin separadores
      if (/^\d{8}$/.test(value)) {
        return `${value.slice(0, 2)}/${value.slice(2, 4)}/${value.slice(4, 8)}`;
      }
      // Si es DDMMYY
      if (/^\d{6}$/.test(value)) {
        const day = value.slice(0, 2);
        const month = value.slice(2, 4);
        const year = value.slice(4, 6);
        return `${day}/${month}/20${year}`;
      }
    }

    return String(value);
  };

  // Calcular anchos de columna basados en el contenido
  useEffect(() => {
    if (rows.length > 0 && viewMode === "table") {
      const visibleHeadersList = headers.filter((h) => !hiddenColumns.has(h));
      const widths: Record<string, number> = {};

      visibleHeadersList.forEach((header) => {
        const maxLength = Math.max(
          header.length,
          ...rows
            .slice(0, 20)
            .map(
              (row) =>
                String(formatDateForDisplay(row[header], header) || "").length,
            ),
        );
        widths[header] = Math.min(Math.max(maxLength * 8, 100), 300);
      });

      setColumnWidths(widths);
    }
  }, [rows, headers, hiddenColumns, viewMode, mapping]);

  // Filtrar headers para búsqueda
  const filteredHeaders = useMemo(() => {
    if (!searchTerm) return headers.filter((h) => !hiddenColumns.has(h));
    return headers.filter(
      (h) =>
        !hiddenColumns.has(h) &&
        h.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [headers, searchTerm, hiddenColumns]);

  // Filtrar datos por búsqueda
  const filteredData = useMemo(() => {
    return rows.filter((row) => {
      const matchesSearch =
        searchTerm === "" ||
        Object.values(row).some((val) =>
          String(val).toLowerCase().includes(searchTerm.toLowerCase()),
        );
      return matchesSearch;
    });
  }, [rows, searchTerm]);

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

  const updateMapping = useCallback(
    (newMapping: Record<string, string>, newFixed: Record<string, string>) => {
      onMappingChange(newMapping, newFixed);
    },
    [onMappingChange],
  );

  const handleMappingChange = useCallback(
    (targetKey: string, sourceHeader: string) => {
      setMapping((prev) => {
        const newMapping = { ...prev, [targetKey]: sourceHeader };
        setFixedValues((prevFixed) => {
          const newFixed = { ...prevFixed };
          delete newFixed[targetKey];
          updateMapping(newMapping, newFixed);
          return newFixed;
        });
        return newMapping;
      });
    },
    [updateMapping],
  );

  const handleFixedValueChange = useCallback(
    (targetKey: string, val: string) => {
      setFixedValues((prev) => {
        const newFixed = { ...prev, [targetKey]: val };
        setMapping((prevMapping) => {
          const newMapping = { ...prevMapping };
          delete newMapping[targetKey];
          updateMapping(newMapping, newFixed);
          return newMapping;
        });
        return newFixed;
      });
    },
    [updateMapping],
  );

  const toggleMode = useCallback((key: string, mode: "mapping" | "fixed") => {
    setModes((prev) => ({ ...prev, [key]: mode }));
  }, []);

  const toggleGroup = useCallback((groupIndex: number) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupIndex]: !prev[groupIndex],
    }));
  }, []);

  const clearField = useCallback((key: string) => {
    setMapping((prev) => {
      const newMapping = { ...prev };
      delete newMapping[key];
      return newMapping;
    });
    setFixedValues((prev) => {
      const newFixed = { ...prev };
      delete newFixed[key];
      return newFixed;
    });
  }, []);

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

  const isCompleted = useCallback(
    (field: any) => {
      if (modes[field.key] === "fixed") return !!fixedValues[field.key];
      return !!mapping[field.key];
    },
    [modes, fixedValues, mapping],
  );

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedValue(id);
      setTimeout(() => setCopiedValue(null), 2000);
    } catch (err) {
      console.error("Error al copiar:", err);
    }
  };

  // Estadísticas de progreso
  const stats = useMemo(() => {
    const allFields = FIELD_GROUPS.flatMap((g) => g.fields);
    const requiredFields = allFields.filter((f) => f.required);
    const completedRequired = requiredFields.filter((f) =>
      isCompleted(f),
    ).length;
    const totalRequired = requiredFields.length;
    const completedOptional = allFields.filter(
      (f) => !f.required && isCompleted(f),
    ).length;
    const totalOptional = allFields.filter((f) => !f.required).length;

    return {
      completedRequired,
      totalRequired,
      completedOptional,
      totalOptional,
      progress:
        totalRequired > 0 ? (completedRequired / totalRequired) * 100 : 0,
      isComplete: completedRequired >= totalRequired,
    };
  }, [isCompleted]);

  // Sugerir mapeo automático basado en nombres similares
  const suggestMapping = useCallback(() => {
    const suggestions: Record<string, string> = {};

    FIELD_GROUPS.flatMap((g) => g.fields).forEach((field) => {
      const fieldWords = field.label.toLowerCase().split(/\s+/);
      const matchingHeader = headers.find((header) => {
        const headerLower = header.toLowerCase();
        return fieldWords.some(
          (word) => word.length > 2 && headerLower.includes(word),
        );
      });

      if (matchingHeader && !mapping[field.key]) {
        suggestions[field.key] = matchingHeader;
      }
    });

    if (Object.keys(suggestions).length > 0) {
      setMapping((prev) => {
        const newMapping = { ...prev, ...suggestions };
        updateMapping(newMapping, fixedValues);
        return newMapping;
      });
    }
  }, [headers, mapping, fixedValues, updateMapping]);

  // Vista de tarjetas para previsualización
  const renderCardPreview = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {sortedData.slice(0, 5).map((row, rowIndex) => (
        <div
          key={rowIndex}
          className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group"
        >
          <div className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <Badge variant="outline" className="text-[10px]">
                Registro #{rowIndex + 1}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() =>
                  copyToClipboard(
                    JSON.stringify(row, null, 2),
                    `row-${rowIndex}`,
                  )
                }
              >
                {copiedValue === `row-${rowIndex}` ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>

            {filteredHeaders.slice(0, 4).map((header) => (
              <div key={header} className="space-y-1">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  {header}
                  {Object.values(mapping).includes(header) && (
                    <ArrowRightLeft className="h-2.5 w-2.5 text-blue-500" />
                  )}
                </p>
                <p className="text-xs text-slate-700 break-words line-clamp-2">
                  {formatDateForDisplay(row[header], header) || (
                    <span className="text-slate-300">—</span>
                  )}
                </p>
              </div>
            ))}

            {filteredHeaders.length > 4 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs mt-2 text-slate-500"
              >
                Ver {filteredHeaders.length - 4} más
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const exportData = (format: "csv" | "json") => {
    if (format === "csv") {
      const csvContent = [
        filteredHeaders.join(","),
        ...sortedData
          .slice(0, 100)
          .map((row) =>
            filteredHeaders
              .map((h) => `"${formatDateForDisplay(row[h], h) || ""}"`)
              .join(","),
          ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `preview_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    } else if (format === "json") {
      const jsonContent = JSON.stringify(sortedData.slice(0, 100), null, 2);
      const blob = new Blob([jsonContent], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `preview_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setHiddenColumns(new Set());
    setSortConfig(null);
  };

  const activeFiltersCount = (searchTerm ? 1 : 0) + (sortConfig ? 1 : 0);

  return (
    <TooltipProvider>
      {/* Contenedor principal con fullscreen corregido */}
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
            {/* Header modernizado */}
            <div className="border-b bg-gradient-to-r from-slate-50 via-white to-slate-50/50 p-4 flex-shrink-0">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl">
                      <Settings2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        Configuración de Entrada
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{headers.length} columnas</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span>{rows.length} registros</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Botón de sugerencias */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={suggestMapping}
                          className="h-8 gap-1.5"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span className="text-xs hidden sm:inline">
                            Sugerir
                          </span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          Intentar mapear automáticamente columnas similares
                        </p>
                      </TooltipContent>
                    </Tooltip>

                    {/* Dropdown de columnas */}
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

                    {/* Dropdown de exportación */}
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

                    {/* Badge de progreso */}
                    <Badge
                      variant={stats.isComplete ? "default" : "secondary"}
                      className={cn(
                        "gap-1.5 px-3 py-1.5 h-8",
                        stats.isComplete
                          ? "bg-green-100 text-green-700 border-green-200"
                          : "bg-amber-100 text-amber-700 border-amber-200",
                      )}
                    >
                      {stats.isComplete ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5" />
                      )}
                      <span className="text-xs font-medium">
                        {stats.completedRequired}/{stats.totalRequired}
                      </span>
                    </Badge>

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
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      Progreso general
                    </span>
                    <span className="font-medium">
                      {Math.round(stats.progress)}%
                    </span>
                  </div>
                  <Progress value={stats.progress} className="h-2" />
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
                        Orden: {sortConfig.key} (
                        {sortConfig.direction === "asc" ? "↑" : "↓"})
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Grid de campos - Con altura fija y scroll independiente */}
            <div className="flex-1 min-h-0 p-4">
              <ScrollArea className="h-full">
                <div className="grid gap-6 lg:grid-cols-3">
                  {FIELD_GROUPS.map((group, gIdx) => {
                    const groupCompleted = group.fields.filter((f) =>
                      isCompleted(f),
                    ).length;
                    const groupTotal = group.fields.length;

                    return (
                      <div
                        key={gIdx}
                        className={cn(
                          "rounded-xl border bg-white shadow-sm transition-all duration-200 overflow-hidden",
                          expandedGroups[gIdx] ? "shadow-md" : "shadow-sm",
                        )}
                      >
                        {/* Header del grupo */}
                        <div
                          className="border-b bg-gradient-to-r from-slate-50 to-white p-4 cursor-pointer hover:bg-slate-50/80 transition-colors"
                          onClick={() => toggleGroup(gIdx)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-white rounded-lg shadow-sm">
                                {group.icon}
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                  {group.title}
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5"
                                  >
                                    {groupCompleted}/{groupTotal}
                                  </Badge>
                                </h4>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {group.description}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                            >
                              {expandedGroups[gIdx] ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Contenido del grupo */}
                        {expandedGroups[gIdx] && (
                          <div className="p-4 space-y-4">
                            {group.fields.map((field) => (
                              <div key={field.key} className="space-y-2">
                                <div className="flex items-start justify-between">
                                  <div className="space-y-0.5">
                                    <Label className="text-xs font-medium flex items-center gap-1.5">
                                      {field.label}
                                      {field.required && (
                                        <span className="text-red-500 text-[10px]">
                                          *
                                        </span>
                                      )}
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <AlertCircle className="h-3 w-3 text-slate-400" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="text-xs">
                                            {field.description}
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </Label>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {isCompleted(field) && (
                                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                    )}
                                    {(mapping[field.key] ||
                                      fixedValues[field.key]) && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 w-5 p-0 hover:bg-red-50"
                                        onClick={() => clearField(field.key)}
                                      >
                                        <X className="h-3 w-3 text-slate-400 hover:text-red-500" />
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                {field.dynamic ? (
                                  <div className="space-y-2">
                                    <Tabs
                                      value={modes[field.key]}
                                      onValueChange={(v: any) =>
                                        toggleMode(field.key, v)
                                      }
                                      className="w-full"
                                    >
                                      <TabsList className="grid grid-cols-2 h-7 p-0.5 bg-slate-100">
                                        <TabsTrigger
                                          value="mapping"
                                          className="text-[10px] py-0 gap-1 data-[state=active]:bg-white"
                                        >
                                          <Hash className="h-3 w-3" /> Columna
                                        </TabsTrigger>
                                        <TabsTrigger
                                          value="fixed"
                                          className="text-[10px] py-0 gap-1 data-[state=active]:bg-white"
                                        >
                                          <Keyboard className="h-3 w-3" /> Valor
                                          Fijo
                                        </TabsTrigger>
                                      </TabsList>
                                    </Tabs>

                                    {modes[field.key] === "mapping" ? (
                                      <Select
                                        value={mapping[field.key] || ""}
                                        onValueChange={(val) =>
                                          handleMappingChange(field.key, val)
                                        }
                                      >
                                        <SelectTrigger
                                          className={cn(
                                            "h-8 text-xs",
                                            mapping[field.key]
                                              ? "border-blue-200 bg-blue-50/30"
                                              : "",
                                          )}
                                        >
                                          <SelectValue placeholder="Seleccionar columna..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {headers.map((h) => (
                                            <SelectItem
                                              key={h}
                                              value={h}
                                              className="text-xs"
                                            >
                                              {h}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : DATE_FIELDS.includes(field.key) ? (
                                      <div className="space-y-1">
                                        <Input
                                          placeholder={
                                            field.placeholder || "DD/MM/YYYY"
                                          }
                                          className={cn(
                                            "h-8 text-xs font-mono",
                                            fixedValues[field.key] &&
                                              !isValidDate(
                                                fixedValues[field.key],
                                              ) &&
                                              fixedValues[field.key].length ===
                                                10 &&
                                              "border-red-200 bg-red-50/30",
                                          )}
                                          value={fixedValues[field.key] || ""}
                                          onChange={(e) =>
                                            handleDateInputChange(
                                              field.key,
                                              e.target.value,
                                              handleFixedValueChange,
                                            )
                                          }
                                          maxLength={10}
                                        />
                                        {fixedValues[field.key] &&
                                          fixedValues[field.key].length ===
                                            10 && (
                                            <div className="flex items-center gap-1">
                                              {isValidDate(
                                                fixedValues[field.key],
                                              ) ? (
                                                <span className="text-[8px] text-green-600 flex items-center gap-0.5">
                                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                                  Fecha válida
                                                </span>
                                              ) : (
                                                <span className="text-[8px] text-red-600 flex items-center gap-0.5">
                                                  <AlertCircle className="h-2.5 w-2.5" />
                                                  Fecha inválida (use
                                                  DD/MM/AAAA)
                                                </span>
                                              )}
                                            </div>
                                          )}
                                      </div>
                                    ) : (
                                      <Input
                                        placeholder={
                                          field.placeholder ||
                                          "Ingresar valor..."
                                        }
                                        className="h-8 text-xs"
                                        value={fixedValues[field.key] || ""}
                                        onChange={(e) =>
                                          handleFixedValueChange(
                                            field.key,
                                            e.target.value,
                                          )
                                        }
                                      />
                                    )}
                                  </div>
                                ) : (
                                  <Select
                                    value={mapping[field.key] || ""}
                                    onValueChange={(val) =>
                                      handleMappingChange(field.key, val)
                                    }
                                  >
                                    <SelectTrigger
                                      className={cn(
                                        "h-8 text-xs",
                                        mapping[field.key]
                                          ? "border-blue-200 bg-blue-50/30"
                                          : "",
                                      )}
                                    >
                                      <SelectValue placeholder="Mapear columna..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {headers.map((h) => (
                                        <SelectItem
                                          key={h}
                                          value={h}
                                          className="text-xs"
                                        >
                                          {h}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}

                                {/* Mini vista previa del valor seleccionado */}
                                {(mapping[field.key] ||
                                  fixedValues[field.key]) &&
                                  rows.length > 0 && (
                                    <div className="text-[10px] text-slate-500 bg-slate-50 px-2 py-1 rounded flex items-center gap-1">
                                      <Eye className="h-3 w-3" />
                                      {mapping[field.key] ? (
                                        <span className="truncate">
                                          Ej:{" "}
                                          {formatDateForDisplay(
                                            rows[0]?.[mapping[field.key]],
                                            mapping[field.key],
                                          ) || "valor vacío"}
                                        </span>
                                      ) : (
                                        <span>{fixedValues[field.key]}</span>
                                      )}
                                    </div>
                                  )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Vista previa del archivo - Siempre visible al final */}
            <div className="border-t flex-shrink-0">
              <div className="bg-gradient-to-r from-slate-100 to-white px-4 py-2 flex items-center justify-between border-b">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 p-1 bg-slate-200 rounded-lg">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-6 w-6 p-0",
                        viewMode === "table" && "bg-white shadow-sm",
                      )}
                      onClick={() => setViewMode("table")}
                    >
                      <LayoutGrid className="h-3.5 w-3.5 text-slate-700" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-6 w-6 p-0",
                        viewMode === "cards" && "bg-white shadow-sm",
                      )}
                      onClick={() => setViewMode("cards")}
                    >
                      <List className="h-3.5 w-3.5 text-slate-700" />
                    </Button>
                  </div>
                  <span className="text-xs font-medium text-slate-700">
                    Vista Previa del Archivo
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {sortedData.length} registros
                  </Badge>
                  {sortConfig && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <ArrowUpDown className="h-3 w-3" />
                      Ordenado por {sortConfig.key}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Buscador de columnas */}
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      placeholder="Buscar columna..."
                      className="h-7 w-48 text-xs bg-white border-slate-200 pl-7"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-7 w-7 p-0"
                        onClick={() => setSearchTerm("")}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-slate-600 hover:bg-slate-100"
                    onClick={() => setShowPreview(!showPreview)}
                  >
                    {showPreview ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              {showPreview && (
                <div className="bg-white">
                  {viewMode === "table" ? (
                    <ScrollArea className="h-[200px] w-full">
                      <Table>
                        <TableHeader className="bg-slate-50 sticky top-0 z-20 shadow-sm">
                          <TableRow>
                            {filteredHeaders.map((h) => (
                              <TableHead
                                key={h}
                                style={{ width: columnWidths[h] || 150 }}
                                className={cn(
                                  "text-[10px] font-bold text-slate-700 uppercase py-3 cursor-pointer group hover:bg-slate-100/80 transition-colors",
                                  sortConfig?.key === h && "text-primary",
                                )}
                                onClick={() => handleSort(h)}
                              >
                                <div className="flex items-center gap-1">
                                  {h}
                                  {sortConfig?.key === h ? (
                                    sortConfig.direction === "asc" ? (
                                      <ChevronUp className="h-3 w-3 flex-shrink-0" />
                                    ) : (
                                      <ChevronDown className="h-3 w-3 flex-shrink-0" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-40 flex-shrink-0 transition-opacity" />
                                  )}
                                  {Object.values(mapping).includes(h) && (
                                    <ArrowRightLeft className="h-2.5 w-2.5 text-blue-500 flex-shrink-0" />
                                  )}
                                </div>
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedData.slice(0, 5).map((row, i) => (
                            <TableRow
                              key={i}
                              className="hover:bg-slate-50/80 transition-colors group"
                            >
                              {filteredHeaders.map((h) => (
                                <TableCell
                                  key={h}
                                  className="text-[11px] py-2 truncate max-w-[150px] text-slate-600"
                                  title={formatDateForDisplay(row[h], h)}
                                >
                                  {formatDateForDisplay(row[h], h) || (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  ) : (
                    <ScrollArea className="h-[200px] w-full">
                      {renderCardPreview()}
                    </ScrollArea>
                  )}
                </div>
              )}
            </div>

            {/* Footer mejorado */}
            <div className="bg-gradient-to-r from-slate-50 via-white to-slate-50/50 p-3 border-t flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className="gap-1.5 px-2 py-0.5 text-[10px]"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    {headers.length} columnas disponibles
                  </Badge>
                  {filteredHeaders.length < headers.length && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Filter className="h-3 w-3" />
                      {filteredHeaders.length} visibles
                    </Badge>
                  )}
                  {sortConfig && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <ArrowUpDown className="h-3 w-3" />
                      {sortConfig.key} (
                      {sortConfig.direction === "asc" ? "↑" : "↓"})
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="default"
                    className={cn(
                      "gap-1.5 text-[10px]",
                      stats.isComplete
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-amber-50 text-amber-700 border-amber-200",
                    )}
                  >
                    {stats.isComplete ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <AlertCircle className="h-3 w-3" />
                    )}
                    {stats.completedRequired}/{stats.totalRequired} obligatorios
                  </Badge>
                  <Badge variant="outline" className="text-[10px] gap-1.5">
                    <Sparkles className="h-3 w-3" />
                    {Object.keys(mapping).length +
                      Object.keys(fixedValues).length}{" "}
                    campos configurados
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
