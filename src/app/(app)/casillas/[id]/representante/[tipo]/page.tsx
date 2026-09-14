import { notFound } from "next/navigation";
import { requireUser, tieneAccesoALocalidad } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { requireCasaActiva } from "@/lib/casa-server";
import { CASA_LABEL } from "@/lib/casa";
import { casillasPendientesDeRc } from "@/lib/casillas-query";
import { decryptField } from "@/lib/crypto";
import { nombreCompleto } from "@/lib/utils";
import { RepresentanteForm } from "@/components/casillas/representante-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function RepresentantePage({
  params,
}: {
  params: Promise<{ id: string; tipo: string }>;
}) {
  const usuario = await requireUser();
  const casa = await requireCasaActiva();
  const { id, tipo: tipoParam } = await params;

  const tipoUpper = tipoParam.toUpperCase();
  if (tipoUpper !== "PROPIETARIO" && tipoUpper !== "SUPLENTE") notFound();
  const tipo = tipoUpper as "PROPIETARIO" | "SUPLENTE";

  // El Representante General no captura RC — ni siquiera debe ver el
  // formulario (la Server Action también lo bloquea, pero no hay razón
  // para dejarlo llegar hasta aquí).
  if (usuario.rol === "REPRESENTANTE_GENERAL") notFound();

  const casilla = await prisma.casilla.findUnique({
    where: { id },
    include: { enlace: true },
  });
  if (!casilla) notFound();
  if (!tieneAccesoALocalidad(usuario, casilla)) {
    notFound();
  }

  // El "RG" es el enlace/ruta ya capturado para esta casilla (nombre
  // completo + teléfono) — un dato aparte e independiente del RC, que se
  // captura siempre sin importar si ya hay RG o no.
  const rg = casilla.enlace
    ? { nombre: nombreCompleto(casilla.enlace), telefono: casilla.enlace.telefono }
    : null;

  const existente = await prisma.representanteCasilla.findUnique({
    where: { casillaId_tipo_casa: { casillaId: id, tipo, casa } },
  });

  // La clave de elector se muestra descifrada en la edición (es sensible
  // pero debe verse para poder corregir sin perderla).
  let claveElectorExistente = "";
  if (existente) {
    try {
      claveElectorExistente = decryptField(existente.claveElectorCifrada);
    } catch {
      claveElectorExistente = "";
    }
  }

  // Para encadenar la captura sin volver al listado.
  const { siguienteId } = await casillasPendientesDeRc(usuario, casa, id);

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>
          RC {tipo === "PROPIETARIO" ? "propietario" : "suplente"} — Sección {casilla.seccion} ·{" "}
          {CASA_LABEL[casa]}
        </CardTitle>
        {rg && (
          <p className="text-sm text-muted-foreground">
            RG de esta casilla: {rg.nombre} · Tel: {rg.telefono}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <RepresentanteForm
          casillaId={id}
          tipo={tipo}
          casaLabel={CASA_LABEL[casa]}
          siguientePendienteId={siguienteId}
          existente={
            existente
              ? {
                  nombre: existente.nombre,
                  apellidoPaterno: existente.apellidoPaterno,
                  apellidoMaterno: existente.apellidoMaterno,
                  claveElector: claveElectorExistente,
                  correoElectronico: existente.correoElectronico,
                  telefono: existente.telefono,
                  propone: existente.propone,
                  telefonoPropone: existente.telefonoPropone,
                }
              : undefined
          }
        />
      </CardContent>
    </Card>
  );
}
