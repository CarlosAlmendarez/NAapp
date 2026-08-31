import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EstadisticasRuta } from "@/lib/stats";

/**
 * Tarjetas de avance para el módulo de Rutas (RG) — a propósito distintas
 * de StatsCards: esas cuentan RC propietario/suplente, que el RG nunca
 * captura ni ve.
 */
export function RutaStatsCards({ stats }: { stats: EstadisticasRuta }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium text-muted-foreground">
            Avance de tu ruta (enlaces capturados)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between">
            <span className="text-4xl font-bold text-primary">{stats.porcentajeAvance}%</span>
            <span className="text-sm text-muted-foreground">
              {stats.enlacesCapturados} de {stats.totalCasillas} casillas con enlace
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${stats.porcentajeAvance}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold text-foreground">{stats.totalCasillas}</p>
            <p className="text-xs text-muted-foreground">Casillas en tu alcance</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold text-foreground">{stats.enlacesCapturados}</p>
            <p className="text-xs text-muted-foreground">Enlaces capturados</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
