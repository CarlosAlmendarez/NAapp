import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { obtenerEstadisticas, obtenerEstadisticasPorMunicipio } from "@/lib/stats";
import { StatsCards } from "@/components/dashboard/stats-cards";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function EstadisticasPage() {
  const usuario = await requireUser();
  if (usuario.rol !== "ADMIN_GENERAL") {
    redirect("/dashboard");
  }

  const [stats, porMunicipio] = await Promise.all([
    obtenerEstadisticas(usuario),
    obtenerEstadisticasPorMunicipio(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Estadísticas globales</h1>
        <p className="text-sm text-muted-foreground">Avance de captura en todo el estado.</p>
      </div>

      <StatsCards stats={stats} />

      <Card>
        <CardHeader>
          <CardTitle>Avance por municipio</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {porMunicipio.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Aún no hay casillas registradas.
            </p>
          ) : (
            <>
              {/* Celular: lista compacta (la tabla de 4 columnas deja la
                  columna de avance fuera de la pantalla sin aviso). */}
              <div className="divide-y divide-border sm:hidden" data-testid="estadisticas-lista-movil">
                {porMunicipio.map((m) => (
                  <div key={m.municipio} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {m.municipio}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {m.completas}/{m.totalCasillas} casillas
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${m.porcentajeAvance}%` }}
                        />
                      </div>
                      <span className="w-9 shrink-0 text-right text-xs text-muted-foreground">
                        {m.porcentajeAvance}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden sm:block" data-testid="estadisticas-tabla-escritorio">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Municipio</TableHead>
                      <TableHead>Casillas</TableHead>
                      <TableHead>Completas</TableHead>
                      <TableHead>Avance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {porMunicipio.map((m) => (
                      <TableRow key={m.municipio}>
                        <TableCell className="font-medium">{m.municipio}</TableCell>
                        <TableCell>{m.totalCasillas}</TableCell>
                        <TableCell>{m.completas}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${m.porcentajeAvance}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {m.porcentajeAvance}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
