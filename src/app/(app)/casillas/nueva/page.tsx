import { redirect } from "next/navigation";
import { requireUser, puedeAdministrarCasillas } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { CasillaForm } from "@/components/casillas/casilla-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NuevaCasillaPage() {
  const usuario = await requireUser();
  if (!puedeAdministrarCasillas(usuario)) {
    redirect("/casillas");
  }

  const municipios = await prisma.municipio.findMany({ orderBy: { nombre: "asc" } });

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Nueva casilla</CardTitle>
      </CardHeader>
      <CardContent>
        <CasillaForm municipios={municipios.map((m) => m.nombre)} />
      </CardContent>
    </Card>
  );
}
