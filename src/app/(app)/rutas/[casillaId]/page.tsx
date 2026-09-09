import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser, tieneAccesoALocalidad, puedeUsarModuloRutas } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { requireCasaActiva } from "@/lib/casa-server";
import { CASA_LABEL } from "@/lib/casa";
import { obtenerResumenRcDeCasillas } from "@/lib/rutas-query";
import { RutaForm } from "@/components/casillas/ruta-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function CapturarRutaPage({
  params,
}: {
  params: Promise<{ casillaId: string }>;
}) {
  const usuario = await requireUser();
  const casa = await requireCasaActiva();
  const { casillaId } = await params;

  // Solo Admin general y Representante General usan el módulo de Rutas —
  // ni siquiera deben ver el formulario (la Server Action también lo
  // bloquea, pero no hay razón para dejarlos llegar hasta aquí).
  if (!puedeUsarModuloRutas(usuario)) notFound();

  const casilla = await prisma.casilla.findUnique({
    where: { id: casillaId },
    include: { enlaces: { where: { casa } } },
  });
  if (!casilla) notFound();
  if (!tieneAccesoALocalidad(usuario, casilla)) notFound();

  const enlace = casilla.enlaces[0] ?? null;
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
            Ruta — Sección {casilla.seccion} · Distrito local {casilla.distritoLocal} ·{" "}
            {CASA_LABEL[casa]}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RutaForm
            casaLabel={CASA_LABEL[casa]}
            paradaInicial={{
              id: casilla.id,
              distritoLocal: casilla.distritoLocal,
              municipio: casilla.municipio,
              seccion: casilla.seccion,
              tipoCasilla: casilla.tipoCasilla,
              coloniaLocalidad: casilla.coloniaLocalidad,
              ubicacion: casilla.ubicacion,
              tieneEnlace: enlace !== null,
              rc,
            }}
            personaExistente={
              enlace
                ? {
                    nombre: enlace.nombre,
                    apellidoPaterno: enlace.apellidoPaterno,
                    apellidoMaterno: enlace.apellidoMaterno,
                    telefono: enlace.telefono,
                    correoElectronico: enlace.correoElectronico,
                  }
                : undefined
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
