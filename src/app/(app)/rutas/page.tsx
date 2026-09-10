import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { redirect } from "next/navigation";
import { requireUser, puedeUsarModuloRutas, sinRestriccionGeografica } from "@/lib/auth-helpers";
import { listarCasillasParaRuta, type CasillaParaRuta, type RutaCapturada } from "@/lib/rutas-query";
import { municipiosDisponibles, distritosDisponibles } from "@/lib/casillas-query";
import { CasillasFiltro } from "@/components/casillas/casillas-filtro";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { nombreCompleto, formatFecha } from "@/lib/utils";
import { formatTipoCasilla, varianteTipoCasilla } from "@/lib/tipo-casilla";

export const metadata = { title: "Rutas" };

export default async function RutasPage({
  searchParams,
}: {
  searchParams: Promise<{ municipio?: string; distrito?: string; busqueda?: string }>;
}) {
  const usuario = await requireUser();
  if (!puedeUsarModuloRutas(usuario)) redirect("/dashboard");

  const params = await searchParams;
  // El buscador por distrito local solo tiene sentido para roles sin
  // restricción geográfica (Admin general): un RG ya solo ve su(s)
  // propio(s) distrito(s) asignado(s).
  const esAdmin = sinRestriccionGeografica(usuario);

  const [{ rutas, pendientes, totalCapturadas, total }, municipios, distritos] = await Promise.all([
    listarCasillasParaRuta(usuario, params),
    municipiosDisponibles(usuario),
    esAdmin ? distritosDisponibles(usuario) : Promise.resolve(undefined),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Rutas</h1>
          <p className="text-sm text-muted-foreground">
            {total > 0
              ? `${totalCapturadas} de ${total} casilla(s) con enlace capturado en tu alcance, en ${rutas.length} ruta(s).`
              : "No hay casillas en tu alcance."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* PDF de rutas: Admin general y RG. Incluye la información
              completa de casillas y el RC de ambas casas. El Admin obtiene
              todas las rutas de su alcance; el RG solo la suya. Para una
              sola ruta, ver el botón "Imprimir" de cada tarjeta. */}
          <Button asChild variant="outline">
            <a href="/imprimir/rutas" target="_blank" rel="noopener">
              <Printer className="h-4 w-4" />
              Imprimir PDF
            </a>
          </Button>
          {/* XLSX: solo Admin general (la clave de elector nunca se incluye). */}
          {usuario.rol === "ADMIN_GENERAL" && (
            <Button asChild variant="outline">
              <a href="/api/exportar/rutas">
                <Download className="h-4 w-4" />
                Exportar XLSX
              </a>
            </Button>
          )}
          <Button asChild>
            <Link href="/rutas/nueva">Nueva ruta</Link>
          </Button>
        </div>
      </div>

      {total > 0 && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.round((totalCapturadas / total) * 100)}%` }}
          />
        </div>
      )}

      <CasillasFiltro municipios={municipios} distritos={distritos} />

      {total === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No se encontraron casillas con esos filtros.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {rutas.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Rutas capturadas, en orden de tu recorrido
              </h2>
              <div className="space-y-3">
                {rutas.map((ruta) => (
                  <TarjetaRuta key={ruta.rutaId} ruta={ruta} />
                ))}
              </div>
            </div>
          )}

          {pendientes.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">Pendientes</h2>
              <div className="space-y-2">
                {pendientes.map((casilla) => (
                  <FilaCasillaPendiente key={casilla.id} casilla={casilla} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Cada ruta guardada junta desde RutaForm se muestra como su propia
 * tarjeta — distinta de las demás — con los datos del enlace UNA sola vez
 * arriba y la lista de casillas que le corresponden abajo, en el orden en
 * que se agregaron. "Editar ruta" abre el formulario con TODAS las
 * casillas de la ruta cargadas (no de una en una).
 */
function TarjetaRuta({ ruta }: { ruta: RutaCapturada }) {
  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="space-y-1.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            Ruta de {nombreCompleto(ruta.enlace)}
            <Badge variant="secondary">
              {ruta.casillas.length} {ruta.casillas.length === 1 ? "casilla" : "casillas"}
            </Badge>
          </CardTitle>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`/imprimir/rutas?ruta=${ruta.rutaId}`} target="_blank" rel="noopener">
                <Printer className="h-4 w-4" />
                Imprimir
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/rutas/editar/${ruta.rutaId}`}>Editar ruta</Link>
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Capturada el {formatFecha(ruta.capturadoEn)} · Tel: {ruta.enlace.telefono}
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {ruta.casillas.map((casilla, indice) => (
          <div
            key={casilla.id}
            className="flex items-center gap-2 rounded-lg border border-border bg-card p-3"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {indice + 1}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-foreground">Sección {casilla.seccion}</p>
                <Badge variant={varianteTipoCasilla(casilla.tipoCasilla)}>
                  {formatTipoCasilla(casilla.tipoCasilla)}
                </Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {casilla.municipio} · {casilla.coloniaLocalidad}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function FilaCasillaPendiente({ casilla }: { casilla: CasillaParaRuta }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">Sección {casilla.seccion}</p>
            <Badge variant={varianteTipoCasilla(casilla.tipoCasilla)}>
              {formatTipoCasilla(casilla.tipoCasilla)}
            </Badge>
            <Badge variant="outline">Pendiente</Badge>
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {casilla.municipio} · {casilla.coloniaLocalidad}
          </p>
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link href={`/rutas/${casilla.id}`}>Capturar</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
