import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { requireCasaActiva } from "@/lib/casa-server";
import { CASA_LABEL } from "@/lib/casa";
import {
  obtenerEstadisticas,
  obtenerEstadisticasRuta,
  obtenerEstadisticasPorGrupo,
  type AgruparEstadistica,
  type EstadisticaGrupo,
} from "@/lib/stats";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RutaStatsCards } from "@/components/dashboard/ruta-stats-cards";
import { EstadisticasControles } from "@/components/estadisticas/estadisticas-controles";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Estadísticas" };

const ORDENES = new Set(["nombre", "rc", "rg", "casillas"]);

function Barra({ porcentaje }: { porcentaje: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-xs text-muted-foreground">{porcentaje}%</span>
    </div>
  );
}

export default async function EstadisticasPage({
  searchParams,
}: {
  searchParams: Promise<{ agrupar?: string; orden?: string; dir?: string; buscar?: string }>;
}) {
  const usuario = await requireUser();
  if (usuario.rol !== "ADMIN_GENERAL") {
    redirect("/dashboard");
  }
  const casa = await requireCasaActiva();
  const sp = await searchParams;

  const agrupar: AgruparEstadistica = sp.agrupar === "distrito" ? "distrito" : "municipio";
  const orden = sp.orden && ORDENES.has(sp.orden) ? sp.orden : "nombre";
  const dir: "asc" | "desc" = sp.dir === "desc" ? "desc" : "asc";
  const buscar = (sp.buscar ?? "").trim();

  const [stats, statsRuta, porGrupo] = await Promise.all([
    obtenerEstadisticas(usuario, casa),
    obtenerEstadisticasRuta(usuario),
    obtenerEstadisticasPorGrupo(casa, agrupar),
  ]);

  const filtradas = buscar
    ? porGrupo.filter((g) => g.grupo.toLowerCase().includes(buscar.toLowerCase()))
    : porGrupo;

  const ordenadas = [...filtradas].sort((a, b) => {
    let cmp: number;
    switch (orden) {
      case "rc":
        cmp = a.rcPorcentaje - b.rcPorcentaje;
        break;
      case "rg":
        cmp = a.rgPorcentaje - b.rgPorcentaje;
        break;
      case "casillas":
        cmp = a.totalCasillas - b.totalCasillas;
        break;
      default:
        cmp = a.grupo.localeCompare(b.grupo);
    }
    if (cmp === 0) cmp = a.grupo.localeCompare(b.grupo);
    return dir === "asc" ? cmp : -cmp;
  });

  const etiquetaGrupo = agrupar === "municipio" ? "Municipio" : "Distrito local";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Estadísticas globales</h1>
        <p className="text-sm text-muted-foreground">
          Avance de captura en todo el estado · {CASA_LABEL[casa]}.
        </p>
      </div>

      {/* Paneles de resumen: RC (propietario + suplente) y RG (enlaces de Rutas). */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Resumen — RC</h2>
        <StatsCards stats={stats} />
      </div>
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Resumen — RG / Rutas</h2>
        <RutaStatsCards stats={statsRuta} variante="global" />
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Detalle por grupo</h2>
        <EstadisticasControles agrupar={agrupar} orden={orden} dir={dir} buscar={buscar} />

        <Card>
          <CardHeader>
            <CardTitle>
              Avance por {agrupar === "municipio" ? "municipio" : "distrito local"}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({ordenadas.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            {ordenadas.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {porGrupo.length === 0
                  ? "Aún no hay casillas registradas."
                  : "Ningún grupo coincide con la búsqueda."}
              </p>
            ) : (
              <>
                {/* Celular: lista compacta. */}
                <div
                  className="divide-y divide-border sm:hidden"
                  data-testid="estadisticas-lista-movil"
                >
                  {ordenadas.map((g) => (
                    <FilaMovil key={g.grupo} g={g} />
                  ))}
                </div>

                {/* Escritorio: tabla con desglose de RC y RG. */}
                <div
                  className="hidden overflow-x-auto sm:block"
                  data-testid="estadisticas-tabla-escritorio"
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{etiquetaGrupo}</TableHead>
                        <TableHead className="text-right">Casillas</TableHead>
                        <TableHead className="text-right">Propiet.</TableHead>
                        <TableHead className="text-right">Suplent.</TableHead>
                        <TableHead className="text-right">RC compl.</TableHead>
                        <TableHead>% RC</TableHead>
                        <TableHead className="text-right">Enlaces RG</TableHead>
                        <TableHead>% RG</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ordenadas.map((g) => (
                        <TableRow key={g.grupo}>
                          <TableCell className="font-medium">{g.grupo}</TableCell>
                          <TableCell className="text-right">{g.totalCasillas}</TableCell>
                          <TableCell className="text-right">{g.conPropietario}</TableCell>
                          <TableCell className="text-right">{g.conSuplente}</TableCell>
                          <TableCell className="text-right">{g.rcCompletas}</TableCell>
                          <TableCell>
                            <Barra porcentaje={g.rcPorcentaje} />
                          </TableCell>
                          <TableCell className="text-right">{g.enlaces}</TableCell>
                          <TableCell>
                            <Barra porcentaje={g.rgPorcentaje} />
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
    </div>
  );
}

function FilaMovil({ g }: { g: EstadisticaGrupo }) {
  return (
    <div className="space-y-1.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium text-foreground">{g.grupo}</p>
        <span className="shrink-0 text-xs text-muted-foreground">{g.totalCasillas} casillas</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          RC {g.rcCompletas}/{g.totalCasillas}
        </span>
        <Barra porcentaje={g.rcPorcentaje} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          RG {g.enlaces}/{g.totalCasillas}
        </span>
        <Barra porcentaje={g.rgPorcentaje} />
      </div>
    </div>
  );
}
