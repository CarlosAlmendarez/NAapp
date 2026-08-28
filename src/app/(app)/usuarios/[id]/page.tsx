import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { UsuarioForm } from "@/components/usuarios/usuario-form";
import { ResetearPasswordForm } from "@/components/usuarios/resetear-password-form";
import { CerrarSesionesButton } from "@/components/usuarios/cerrar-sesiones-button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireUser();
  if (admin.rol !== "ADMIN_GENERAL") redirect("/dashboard");

  const { id } = await params;
  const [usuarioObjetivo, municipios] = await Promise.all([
    prisma.usuario.findUnique({ where: { id }, include: { localidades: true } }),
    prisma.municipio.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  if (!usuarioObjetivo) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Editar usuario</CardTitle>
        </CardHeader>
        <CardContent>
          <UsuarioForm
            municipios={municipios.map((m) => m.nombre)}
            usuario={{
              id: usuarioObjetivo.id,
              nombre: usuarioObjetivo.nombre,
              correo: usuarioObjetivo.correo,
              rol: usuarioObjetivo.rol,
              activo: usuarioObjetivo.activo,
              localidades: usuarioObjetivo.localidades.map((l) => l.municipio),
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Restablecer contraseña</CardTitle>
          <CardDescription>Define una nueva contraseña temporal para este usuario.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResetearPasswordForm usuarioId={usuarioObjetivo.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sesiones activas</CardTitle>
          <CardDescription>
            Fuerza el cierre de todas las sesiones activas de este usuario en todos sus
            dispositivos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CerrarSesionesButton usuarioId={usuarioObjetivo.id} />
        </CardContent>
      </Card>
    </div>
  );
}
