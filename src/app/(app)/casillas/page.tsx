import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth-helpers";
import { listarCasillas, municipiosDisponibles } from "@/lib/casillas-query";
import { CasillasFiltro } from "@/components/casillas/casillas-filtro";
import { CasillaCard } from "@/components/casillas/casilla-card";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function CasillasPage({
  searchParams,
}: {
  searchParams: Promise<{ municipio?: string; busqueda?: string; page?: string }>;
}) {
  const usuario = await requireUser();
  const params = await searchParams;

  const puedeCrear = usuario.rol === "ADMIN_GENERAL" || usuario.rol === "ADMIN_CASILLAS";

  const [{ casillas, total, page, totalPages }, municipios] = await Promise.all([
    listarCasillas(usuario, {
      municipio: params.municipio,
      busqueda: params.busqueda,
      page: params.page ? Number(params.page) : 1,
    }),
    municipiosDisponibles(usuario),
  ]);

  function buildHref(nuevaPagina: number) {
    const sp = new URLSearchParams();
    if (params.municipio) sp.set("municipio", params.municipio);
    if (params.busqueda) sp.set("busqueda", params.busqueda);
    sp.set("page", String(nuevaPagina));
    return `/casillas?${sp.toString()}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Casillas</h1>
          <p className="text-sm text-muted-foreground">{total} casilla(s) en tu alcance.</p>
        </div>
        {puedeCrear && (
          <Button asChild>
            <Link href="/casillas/nueva">
              <Plus className="h-4 w-4" />
              Nueva casilla
            </Link>
          </Button>
        )}
      </div>

      <CasillasFiltro municipios={municipios} />

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
