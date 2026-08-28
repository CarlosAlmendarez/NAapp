import { notFound, redirect } from "next/navigation";
import { requireUser, puedeAdministrarCasillas } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { CasillaForm } from "@/components/casillas/casilla-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function EditarCasillaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await requireUser();
  if (!puedeAdministrarCasillas(usuario)) {
    redirect("/casillas");
  }

  const { id } = await params;
  const [casilla, municipios] = await Promise.all([
    prisma.casilla.findUnique({ where: { id } }),
    prisma.municipio.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  if (!casilla) notFound();

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Editar casilla — Sección {casilla.seccion}</CardTitle>
      </CardHeader>
      <CardContent>
        <CasillaForm municipios={municipios.map((m) => m.nombre)} casilla={casilla} />
      </CardContent>
    </Card>
  );
}
