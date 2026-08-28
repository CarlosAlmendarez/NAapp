import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { UsuarioForm } from "@/components/usuarios/usuario-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NuevoUsuarioPage() {
  const usuario = await requireUser();
  if (usuario.rol !== "ADMIN_GENERAL") redirect("/dashboard");

  const [municipios, distritos] = await Promise.all([
    prisma.municipio.findMany({ orderBy: { nombre: "asc" } }),
    prisma.distritoLocal.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>Nuevo usuario</CardTitle>
      </CardHeader>
      <CardContent>
        <UsuarioForm
          municipios={municipios.map((m) => m.nombre)}
          distritosLocales={distritos.map((d) => d.nombre)}
        />
      </CardContent>
    </Card>
  );
}
