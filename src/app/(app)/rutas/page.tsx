import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, puedeUsarModuloRutas } from "@/lib/auth-helpers";
import { listarCasillasParaRuta, type CasillaParaRuta } from "@/lib/rutas-query";
import { municipiosDisponibles } from "@/lib/casillas-query";
import { CasillasFiltro } from "@/components/casillas/casillas-filtro";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { nombreCompleto, formatFecha } from "@/lib/utils";
import { formatTipoCasilla, varianteTipoCasilla } from "@/lib/tipo-casilla";

export default async function RutasPage({
  searchParams,
}: {
  searchParams: Promise<{ municipio?: string; busqueda?: string }>;
}) {
  const usuario = await requireUser();
  if (!puedeUsarModuloRutas(usuario)) redirect("/dashboard");

  const params = await searchParams;

  const [{ capturadas, pendientes, total }, municipios] = await Promise.all([
    listarCasillasParaRuta(usuario, params),
    municipiosDisponibles(usuario),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Rutas</h1>
        <p className="text-sm text-muted-foreground">
          {total > 0
            ? `${capturadas.length} de ${total} casilla(s) con enlace capturado en tu alcance.`
            : "No hay casillas en tu alcance."}
        </p>
      </div>

      {total > 0 && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.round((capturadas.length / total) * 100)}%` }}
          />
        </div>
      )}

      <CasillasFiltro municipios={municipios} />

      {total === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No se encontraron casillas con esos filtros.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {capturadas.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Capturadas, en orden de tu recorrido
              </h2>
              <div className="space-y-2">
                {capturadas.map((casilla, indice) => (
                  <FilaRuta
                    key={casilla.id}
                    casilla={casilla}
                    orden={indice + 1}
                  />
                ))}
              </div>
            </div>
          )}

          {pendientes.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">Pendientes</h2>
              <div className="space-y-2">
                {pendientes.map((casilla) => (
                  <FilaRuta key={casilla.id} casilla={casilla} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FilaRuta({ casilla, orden }: { casilla: CasillaParaRuta; orden?: number }) {
  const capturada = casilla.enlace !== null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {orden !== undefined && (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {orden}
              </span>
            )}
            <p className="font-medium text-foreground">Sección {casilla.seccion}</p>
            <Badge variant={varianteTipoCasilla(casilla.tipoCasilla)}>
              {formatTipoCasilla(casilla.tipoCasilla)}
            </Badge>
            <Badge variant={capturada ? "success" : "outline"}>
              {capturada ? "Capturado" : "Pendiente"}
            </Badge>
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {casilla.municipio} · {casilla.coloniaLocalidad}
          </p>
          {casilla.enlace && (
            <>
              <p className="truncate text-sm text-foreground">
                {nombreCompleto(casilla.enlace)} · Tel: {casilla.enlace.telefono}
              </p>
              <p className="text-xs text-muted-foreground">
                Capturado el {formatFecha(casilla.enlace.capturadoEn)}
              </p>
            </>
          )}
        </div>
        <Button asChild variant={capturada ? "outline" : "default"} size="sm" className="shrink-0">
          <Link href={`/rutas/${casilla.id}`}>{capturada ? "Editar" : "Capturar"}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
