import Link from "next/link";
import { Plus, Download } from "lucide-react";
import { requireUser, puedeAdministrarCasillas, sinRestriccionGeografica } from "@/lib/auth-helpers";
import { listarCasillas, municipiosDisponibles, distritosDisponibles } from "@/lib/casillas-query";
import { requireCasaActiva } from "@/lib/casa-server";
import { CASA_LABEL } from "@/lib/casa";
import { CasillasFiltro } from "@/components/casillas/casillas-filtro";
import { ImprimirCasillasDialog } from "@/components/casillas/imprimir-casillas-dialog";
import { CasillaCard } from "@/components/casillas/casilla-card";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Casillas" };

export default async function CasillasPage({
  searchParams,
}: {
  searchParams: Promise<{
    municipio?: string;
    distrito?: string;
    busqueda?: string;
    page?: string;
  }>;
}) {
  const usuario = await requireUser();
  const casa = await requireCasaActiva();
  const params = await searchParams;

  const puedeCrear = puedeAdministrarCasillas(usuario);
  // El buscador por distrito local solo tiene sentido para roles sin
  // restricción geográfica (Admin general, Admin de casillas): un
  // Capturador o RG ya solo ve su(s) propio(s) distrito(s) asignado(s).
  const esAdmin = sinRestriccionGeografica(usuario);

  const [{ casillas, total, page, totalPages }, municipios, distritos] = await Promise.all([
    listarCasillas(usuario, casa, {
      municipio: params.municipio,
      distrito: params.distrito,
      busqueda: params.busqueda,
      page: params.page ? Number(params.page) : 1,
    }),
    municipiosDisponibles(usuario),
    esAdmin ? distritosDisponibles(usuario) : Promise.resolve(undefined),
  ]);

  function buildHref(nuevaPagina: number) {
    const sp = new URLSearchParams();
    if (params.municipio) sp.set("municipio", params.municipio);
    if (params.distrito) sp.set("distrito", params.distrito);
    if (params.busqueda) sp.set("busqueda", params.busqueda);
    sp.set("page", String(nuevaPagina));
    return `/casillas?${sp.toString()}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Casillas</h1>
          <p className="text-sm text-muted-foreground">
            {total} casilla(s) en tu alcance · datos de {CASA_LABEL[casa]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* PDF por municipio (o distrito, para admins) — Admin general,
              Admin de casillas y Capturador; el RG usa el PDF de Rutas. */}
          {usuario.rol !== "REPRESENTANTE_GENERAL" && (
            <ImprimirCasillasDialog municipios={municipios} distritos={distritos} />
          )}
          {/* Exportar a XLSX (padrón oficial + RC + RG ya capturados). El
              Admin general exporta el catálogo completo; el Capturador
              exporta solo lo que le corresponde (su alcance geográfico,
              nunca el catálogo completo) — ver el filtro aplicado en la
              propia Server Route. Ni Admin de casillas ni RG lo ven. La
              clave de elector nunca se incluye. */}
          {(usuario.rol === "ADMIN_GENERAL" || usuario.rol === "CAPTURADOR") && (
            <Button asChild variant="outline">
              <a href="/api/exportar/casillas">
                <Download className="h-4 w-4" />
                Exportar XLSX
              </a>
            </Button>
          )}
          {puedeCrear && (
            <Button asChild>
              <Link href="/casillas/nueva">
                <Plus className="h-4 w-4" />
                Nueva casilla
              </Link>
            </Button>
          )}
        </div>
      </div>

      <CasillasFiltro municipios={municipios} distritos={distritos} />

      {casillas.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No se encontraron casillas con esos filtros.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {casillas.map((casilla) => (
            <CasillaCard key={casilla.id} casilla={casilla} />
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} buildHref={buildHref} />
    </div>
  );
}
