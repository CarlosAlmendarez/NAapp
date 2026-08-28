import { notFound } from "next/navigation";
import { requireUser, tieneAccesoALocalidad } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { RepresentanteForm } from "@/components/casillas/representante-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function RepresentantePage({
  params,
}: {
  params: Promise<{ id: string; tipo: string }>;
}) {
  const usuario = await requireUser();
  const { id, tipo: tipoParam } = await params;

  const tipoUpper = tipoParam.toUpperCase();
  if (tipoUpper !== "PROPIETARIO" && tipoUpper !== "SUPLENTE") notFound();
  const tipo = tipoUpper as "PROPIETARIO" | "SUPLENTE";

  // El Representante General no captura RC — ni siquiera debe ver el
  // formulario (la Server Action también lo bloquea, pero no hay razón
  // para dejarlo llegar hasta aquí).
  if (usuario.rol === "REPRESENTANTE_GENERAL") notFound();

  const casilla = await prisma.casilla.findUnique({ where: { id } });
  if (!casilla) notFound();
  if (!tieneAccesoALocalidad(usuario, casilla)) {
    notFound();
  }

  const existente = await prisma.representanteCasilla.findUnique({
    where: { casillaId_tipo: { casillaId: id, tipo } },
  });

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>
          RC {tipo === "PROPIETARIO" ? "propietario" : "suplente"} — Sección {casilla.seccion}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RepresentanteForm
          casillaId={id}
          tipo={tipo}
          existente={
            existente
              ? {
                  nombre: existente.nombre,
                  apellidoPaterno: existente.apellidoPaterno,
                  apellidoMaterno: existente.apellidoMaterno,
                  correoElectronico: existente.correoElectronico,
                  telefono: existente.telefono,
                  propone: existente.propone,
                }
              : undefined
          }
        />
      </CardContent>
    </Card>
  );
}
