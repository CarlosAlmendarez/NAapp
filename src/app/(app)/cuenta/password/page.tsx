import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CambiarPasswordForm } from "@/components/cuenta/cambiar-password-form";

// El cambio de contraseña "de autoservicio" es exclusivo del Administrador
// general. Los demás roles no pueden rotar su propia contraseña desde la
// app — si la necesitan cambiar, el Administrador general se las
// restablece desde "Usuarios → [usuario] → Restablecer contraseña".
export default async function CambiarPasswordPage() {
  const usuario = await requireUser();
  if (usuario.rol !== "ADMIN_GENERAL") {
    redirect("/dashboard");
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Cambiar contraseña</CardTitle>
        <CardDescription>
          Al cambiar tu contraseña se cerrarán tus demás sesiones activas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CambiarPasswordForm />
      </CardContent>
    </Card>
  );
}
