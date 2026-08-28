import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obtenerUsuarioValidoOrNull } from "@/lib/auth-helpers";
import { LoginForm } from "@/app/login/login-form";
import { Logo } from "@/components/layout/logo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = {
  title: "Iniciar sesión — Nueva Alianza SLP",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  // Debe ser la versión validada contra la BD (activo + sessionVersion),
  // no `auth()` a secas — ver el comentario en obtenerUsuarioValidoOrNull.
  const usuario = await obtenerUsuarioValidoOrNull();
  if (usuario) {
    redirect("/dashboard");
  }

  const { motivo } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 py-10">
      <Logo size={96} />

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Iniciar sesión</CardTitle>
          <CardDescription>
            Acceso exclusivo para el equipo de captura electoral. Si no tienes una
            cuenta, contacta al Administrador general.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {motivo === "sesiones_cerradas" && (
            <Alert variant="success">Se cerraron todas tus sesiones activas.</Alert>
          )}
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
