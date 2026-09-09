import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser, tieneAccesoALocalidad, puedeUsarModuloRutas } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { requireCasaActiva } from "@/lib/casa-server";
import { CASA_LABEL } from "@/lib/casa";
import { obtenerResumenRcDeCasillas } from "@/lib/rutas-query";
import { RutaForm, type ParadaInicial } from "@/components/casillas/ruta-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Edición de una ruta COMPLETA: carga de golpe todas las casillas que
 * comparten `rutaId` (no de una en una) para que el RG vea y corrija su
 * ruta entera. El enlace es único por casilla, así que aquí siempre se
 * reutiliza el mismo `rutaId`.
 */
export default async function EditarRutaPage({
  params,
}: {
  params: Promise<{ rutaId: string }>;
}) {
  const usuario = await requireUser();
  if (!puedeUsarModuloRutas(usuario)) notFound();
  const casa = await requireCasaActiva();
  const { rutaId } = await params;

  const enlaces = await prisma.enlaceCasilla.findMany({
    where: { rutaId },
    orderBy: { ordenEnRuta: "asc" },
    include: { casilla: true },
  });
  if (enlaces.length === 0) notFound();

  // El RG solo edita rutas cuyas casillas caen en su(s) distrito(s).
  for (const e of enlaces) {
    if (!tieneAccesoALocalidad(usuario, e.casilla)) notFound();
  }

  const resumenRc = await obtenerResumenRcDeCasillas(
    enlaces.map((e) => ({ id: e.casillaId, distritoLocal: e.casilla.distritoLocal })),
    casa
  );

  const paradasIniciales: ParadaInicial[] = enlaces.map((e) => ({
    id: e.casillaId,
    distritoLocal: e.casilla.distritoLocal,
    municipio: e.casilla.municipio,
    seccion: e.casilla.seccion,
    tipoCasilla: e.casilla.tipoCasilla,
    coloniaLocalidad: e.casilla.coloniaLocalidad,
    ubicacion: e.casilla.ubicacion,
    rc: resumenRc.get(e.casillaId) ?? { propietario: null, suplente: null, rgNombre: null },
  }));

  const enlace = enlaces[0]!;

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
            Editar ruta — {paradasIniciales.length}{" "}
            {paradasIniciales.length === 1 ? "casilla" : "casillas"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RutaForm
            rutaId={rutaId}
            casaLabel={CASA_LABEL[casa]}
            paradasIniciales={paradasIniciales}
            personaExistente={{
              nombre: enlace.nombre,
              apellidoPaterno: enlace.apellidoPaterno,
              apellidoMaterno: enlace.apellidoMaterno,
              telefono: enlace.telefono,
              correoElectronico: enlace.correoElectronico,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
