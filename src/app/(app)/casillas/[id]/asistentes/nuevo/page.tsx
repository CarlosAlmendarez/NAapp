import { notFound } from "next/navigation";
import { requireUser, tieneAccesoALocalidad } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { AsistenteForm } from "@/components/casillas/asistente-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NuevoAsistentePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await requireUser();
  const { id } = await params;

  // El Representante General no captura asistentes electorales.
  if (usuario.rol === "REPRESENTANTE_GENERAL") notFound();

  const casilla = await prisma.casilla.findUnique({ where: { id } });
  if (!casilla) notFound();
  if (!tieneAccesoALocalidad(usuario, casilla)) {
    notFound();
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Nuevo asistente electoral — Sección {casilla.seccion}</CardTitle>
      </CardHeader>
      <CardContent>
        <AsistenteForm casillaId={id} />
      </CardContent>
    </Card>
  );
}
