"use client";

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  TableCaption,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { InventoryCrossResult } from "@/ai/flows/schemas";

interface InventoryCrossTableProps {
  data: InventoryCrossResult;
}

export function InventoryCrossTable({ data }: InventoryCrossTableProps) {
  return (
    <div className="w-full overflow-hidden rounded-lg border shadow-sm">
      <Table>
        <TableCaption>
          Cruce de inventarios SAP vs WMS. Se resaltan discrepancias.
        </TableCaption>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>SKU</TableHead>
            <TableHead>Lote</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className="text-right">Stock SAP</TableHead>
            <TableHead className="text-right">Stock WMS</TableHead>
            <TableHead className="text-right">Diferencia</TableHead>
            <TableHead className="text-center">Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.results.map((item, index) => {
            const hasDiff = item.diferencia !== 0;
            return (
              <TableRow
                key={`${item.sku}-${index}`}
                className={cn(
                  hasDiff ? "bg-destructive/5" : "hover:bg-accent/5",
                )}
              >
                <TableCell className="font-bold">{item.sku}</TableCell>
                <TableCell>{item.lote}</TableCell>
                <TableCell className="max-w-xs truncate">
                  {item.descripcion}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {item.cantidadSap.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {item.cantidadWms.toLocaleString()}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-black font-mono",
                    item.diferencia > 0
                      ? "text-blue-600"
                      : item.diferencia < 0
                        ? "text-destructive"
                        : "",
                  )}
                >
                  {item.diferencia.toLocaleString()}
                </TableCell>
                <TableCell className="text-center">
                  <Badge
                    variant={hasDiff ? "destructive" : "outline"}
                    className={cn(
                      !hasDiff &&
                        "bg-green-100 text-green-800 border-green-200",
                    )}
                  >
                    {hasDiff ? "Discrepancia" : "OK"}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
