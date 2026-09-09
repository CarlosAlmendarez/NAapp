import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser, tieneAccesoALocalidad, puedeUsarModuloRutas } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { requireCasaActiva } from "@/lib/casa-server";
import { CASA_LABEL } from "@/lib/casa";
import { obtenerResumenRcDeCasillas } from "@/lib/rutas-query";
import { RutaForm } from "@/components/casillas/ruta-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Inicia una ruta NUEVA a partir de UNA casilla (desde "Pendientes" o el
 * atajo del detalle de la casilla). Si esa casilla ya tiene enlace, se
 * redirige a la edición de su ruta completa: no se recaptura.
 */
export default async function CapturarRutaPage({
  params,
}: {
  params: Promise<{ casillaId: string }>;
}) {
  const usuario = await requireUser();
  const casa = await requireCasaActiva();
  const { casillaId } = await params;

  // Solo Admin general y Representante General usan el módulo de Rutas.
  if (!puedeUsarModuloRutas(usuario)) notFound();

  const casilla = await prisma.casilla.findUnique({
    where: { id: casillaId },
    include: { enlace: true },
  });
  if (!casilla) notFound();
  if (!tieneAccesoALocalidad(usuario, casilla)) notFound();

  // Ya tiene enlace: no se recaptura, se edita la ruta completa.
  if (casilla.enlace) {
    redirect(`/rutas/editar/${casilla.enlace.rutaId}`);
  }

  const resumenRc = await obtenerResumenRcDeCasillas(
    [{ id: casilla.id, distritoLocal: casilla.distritoLocal }],
    casa
  );
  const rc = resumenRc.get(casilla.id) ?? { propietario: null, suplente: null, rgNombre: null };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/rutas"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a Rutas
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>
            Nueva ruta — Sección {casilla.seccion} · Distrito local {casilla.distritoLocal}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RutaForm
            casaLabel={CASA_LABEL[casa]}
            paradasIniciales={[
              {
                id: casilla.id,
                distritoLocal: casilla.distritoLocal,
                municipio: casilla.municipio,
                seccion: casilla.seccion,
                tipoCasilla: casilla.tipoCasilla,
                coloniaLocalidad: casilla.coloniaLocalidad,
                ubicacion: casilla.ubicacion,
                rc,
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
