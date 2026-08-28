import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Estadisticas } from "@/lib/stats";

export function StatsCards({ stats }: { stats: Estadisticas }) {
  const items = [
    { label: "Casillas en tu alcance", value: stats.totalCasillas },
    { label: "Con propietario capturado", value: stats.conPropietario },
    { label: "Con suplente capturado", value: stats.conSuplente },
    { label: "Asistentes electorales", value: stats.totalAsistentes },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium text-muted-foreground">
            Avance de captura (RC propietario + suplente)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between">
            <span className="text-4xl font-bold text-primary">{stats.porcentajeAvance}%</span>
            <span className="text-sm text-muted-foreground">
              {stats.completas} de {stats.totalCasillas} casillas completas
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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {items.map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <p className="text-2xl font-semibold text-foreground">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
