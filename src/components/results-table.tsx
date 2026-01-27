import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { GenerateRestockSuggestionsOutput } from '@/ai/flows/schemas';

interface ResultsTableProps {
  results: GenerateRestockSuggestionsOutput;
  analysisMode: 'sales' | 'levels';
}

export function ResultsTable({ results, analysisMode }: ResultsTableProps) {
  const hasDestinationData = analysisMode === 'levels';

  return (
    <div className="w-full overflow-hidden rounded-lg border">
        <Table>
          <TableCaption>Sugerencias de surtido y estado de productos.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">SKU</TableHead>
              <TableHead>Descripción</TableHead>
              {hasDestinationData && <TableHead>Destino</TableHead>}
              <TableHead className="text-right">Cant. en Picking</TableHead>
              <TableHead className="text-right">Cant. a Surtir</TableHead>
              <TableHead>Acción / Ubicaciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((item, index) => (
              <TableRow key={`${item.sku}-${index}`}>
                <TableCell className="font-medium">{item.sku}</TableCell>
                <TableCell>{item.descripcion}</TableCell>
                {hasDestinationData && (
                    <TableCell>
                        {item.localizacionDestino && (
                            <Badge variant="secondary" className="h-auto flex-col items-start px-2 py-1">
                                <span className="font-semibold">{item.localizacionDestino}</span>
                                {item.lpnDestino && <span className="text-xs font-normal opacity-80">LPN: {item.lpnDestino}</span>}
                            </Badge>
                        )}
                    </TableCell>
                )}
                <TableCell className="text-right">{item.cantidadDisponible}</TableCell>
                <TableCell className={`text-right font-bold ${item.cantidadARestockear > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                  {item.cantidadARestockear}
                  </TableCell>
                <TableCell>
                  {item.cantidadARestockear > 0 ? (
                    <div className="flex flex-wrap items-center gap-1">
                      {item.ubicacionesSugeridas.length > 0 ? (
                          item.ubicacionesSugeridas.map((ubicacion, uIndex) => (
                          <Badge key={`${ubicacion.lpn || ubicacion.localizacion}-${uIndex}`} variant="secondary" className="h-auto flex-col items-start px-2 py-1">
                              <span className="font-semibold">{ubicacion.localizacion}</span>
                              {ubicacion.lpn && <span className="text-xs font-normal opacity-80">LPN: {ubicacion.lpn}</span>}
                              {(ubicacion.diasFPC !== null && ubicacion.diasFPC !== undefined) && (
                              <span className="text-xs font-normal opacity-80">FPC: {ubicacion.diasFPC}</span>
                              )}
                          </Badge>
                          ))
                      ) : (
                          <Badge variant="destructive">Sin Origen</Badge>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1">
                        <Badge variant="outline">OK</Badge>
                        {/* For OK items, show picking locations where stock is */}
                        {item.ubicacionesSugeridas.map((ubicacion, uIndex) => (
                            <Badge key={`${ubicacion.lpn || ubicacion.localizacion}-${uIndex}`} variant="secondary" className="h-auto flex-col items-start px-2 py-1">
                                <span className="font-semibold">{ubicacion.localizacion}</span>
                                {ubicacion.lpn && <span className="text-xs font-normal opacity-80">LPN: {ubicacion.lpn}</span>}
                            </Badge>
                        ))}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
    </div>
  );
}
