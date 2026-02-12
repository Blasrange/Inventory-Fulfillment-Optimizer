import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  TableCaption,
} from "@/components/ui/table";
import { AlertTriangle, Info, PackageX, Package, Layers } from "lucide-react";
import type { MissingProductsOutput } from "@/ai/flows/schemas";

interface MissingStockTableProps {
  products: MissingProductsOutput[];
}

export function MissingStockTable({ products }: MissingStockTableProps) {
  // Separar productos por tipo de falta
  const sinInventario = products.filter(
    (p) => p.tipoFalta === "SIN_INVENTARIO" || !p.tipoFalta,
  );

  const sinReserva = products.filter((p) => p.tipoFalta === "SIN_RESERVA");

  const reservaInsuficiente = products.filter(
    (p) => p.tipoFalta === "RESERVA_INSUFICIENTE",
  );

  if (products.length === 0) {
    return null;
  }

  const formatNumber = (num?: number) => {
    return num !== undefined && num !== null
      ? num.toLocaleString("es-CL")
      : "0";
  };

  return (
    <div className="space-y-6">
      {/* Productos sin inventario */}
      {sinInventario.length > 0 && (
        <div className="w-full overflow-hidden rounded-lg border border-destructive/50">
          <Table>
            <TableCaption className="text-destructive">
              <div className="flex items-center justify-center gap-2 p-2">
                <PackageX className="h-4 w-4" />
                <span className="font-semibold">
                  Productos sin inventario disponible
                </span>
              </div>
            </TableCaption>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[120px]">SKU</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Cant. Vendida</TableHead>
                <TableHead className="text-right">Stock Picking</TableHead>
                <TableHead className="text-right">Stock Reserva</TableHead>
                <TableHead className="text-right text-destructive">
                  Cant. Faltante
                </TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sinInventario.map((item, index) => (
                <TableRow
                  key={`${item.sku}-${index}`}
                  className="bg-destructive/5 border-b-destructive/20 hover:bg-destructive/10"
                >
                  <TableCell className="font-medium">{item.sku}</TableCell>
                  <TableCell>{item.descripcion}</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(item.cantidadVendida)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-muted-foreground">0</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-muted-foreground">0</span>
                  </TableCell>
                  <TableCell className="text-right font-bold text-destructive">
                    {formatNumber(
                      item.cantidadFaltante || item.cantidadVendida,
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
                      Sin Inventario
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Productos sin stock en reserva */}
      {sinReserva.length > 0 && (
        <div className="w-full overflow-hidden rounded-lg border border-orange-500/50">
          <Table>
            <TableCaption className="text-orange-600">
              <div className="flex items-center justify-center gap-2 p-2">
                <Package className="h-4 w-4" />
                <span className="font-semibold">
                  Productos con stock en picking pero sin reserva disponible
                </span>
              </div>
            </TableCaption>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[120px]">SKU</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Cant. Vendida</TableHead>
                <TableHead className="text-right">Stock en Picking</TableHead>
                <TableHead className="text-right">Stock en Reserva</TableHead>
                <TableHead className="text-right text-orange-600">
                  Cant. Faltante
                </TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sinReserva.map((item, index) => (
                <TableRow
                  key={`${item.sku}-${index}`}
                  className="bg-orange-50/50 border-b-orange-200 hover:bg-orange-100/50"
                >
                  <TableCell className="font-medium">{item.sku}</TableCell>
                  <TableCell>{item.descripcion}</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(item.cantidadVendida)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatNumber(item.stockEnPicking)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-muted-foreground">0</span>
                  </TableCell>
                  <TableCell className="text-right font-bold text-orange-600">
                    {formatNumber(item.cantidadFaltante)}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                      Sin Stock Reserva
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Productos con reserva insuficiente */}
      {reservaInsuficiente.length > 0 && (
        <div className="w-full overflow-hidden rounded-lg border border-amber-500/50">
          <Table>
            <TableCaption className="text-amber-600">
              <div className="flex items-center justify-center gap-2 p-2">
                <Layers className="h-4 w-4" />
                <span className="font-semibold">
                  Productos con reserva insuficiente para completar la venta
                </span>
              </div>
            </TableCaption>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[120px]">SKU</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Cant. Vendida</TableHead>
                <TableHead className="text-right">Stock en Picking</TableHead>
                <TableHead className="text-right">Stock en Reserva</TableHead>
                <TableHead className="text-right">Cant. Cubierta</TableHead>
                <TableHead className="text-right text-amber-600">
                  Cant. Faltante
                </TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservaInsuficiente.map((item, index) => (
                <TableRow
                  key={`${item.sku}-${index}`}
                  className="bg-amber-50/50 border-b-amber-200 hover:bg-amber-100/50"
                >
                  <TableCell className="font-medium">{item.sku}</TableCell>
                  <TableCell>{item.descripcion}</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(item.cantidadVendida)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(item.stockEnPicking)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatNumber(item.stockEnReserva)}
                  </TableCell>
                  <TableCell className="text-right text-green-600 font-medium">
                    {formatNumber(item.cantidadCubierta)}
                  </TableCell>
                  <TableCell className="text-right font-bold text-amber-600">
                    {formatNumber(item.cantidadFaltante)}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                      Reserva Insuficiente
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
