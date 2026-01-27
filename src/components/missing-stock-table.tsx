import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
import { AlertTriangle } from 'lucide-react';
import type { MissingProductsOutput } from '@/ai/flows/schemas';

interface MissingStockTableProps {
  products: MissingProductsOutput;
}

export function MissingStockTable({ products }: MissingStockTableProps) {
  return (
    <div className="w-full overflow-hidden rounded-lg border border-destructive/50">
        <Table>
          <TableCaption className="text-destructive">
            <div className="flex items-center justify-center gap-2 p-2">
                <AlertTriangle className="h-4 w-4" />
                <span>Productos facturados sin inventario disponible para reportar.</span>
            </div>
          </TableCaption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[120px]">SKU</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Cant. Vendida (Sin Stock)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((item, index) => (
              <TableRow key={`${item.sku}-${index}`} className="bg-destructive/5 border-b-destructive/20 hover:bg-destructive/10">
                <TableCell className="font-medium">{item.sku}</TableCell>
                <TableCell>{item.descripcion}</TableCell>
                <TableCell className="text-right font-bold text-destructive">{item.cantidadVendida}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
    </div>
  );
}
