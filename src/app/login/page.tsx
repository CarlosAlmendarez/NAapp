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
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10"
      style={{
        // Gradiente sutil con los mismos teales de marca — un resplandor
        // suave arriba (detrás del logo) que se disuelve en el blanco de
        // siempre a la altura de la tarjeta, para no perder el fondo plano
        // que ya tenía el resto de la app (ver la nota de "sobria, sin
        // gradientes" en globals.css: esta es la única excepción a
        // propósito, acotada a esta pantalla).
        // Tamaño fijo en px (no % del contenedor) para que el resplandor
        // quede acotado detrás del logo sin importar qué tan ancha sea la
        // pantalla — con % se estiraba de borde a borde en escritorio y
        // dejaba de leerse como un brillo puntual.
        background:
          "radial-gradient(circle 340px at 50% 90px, color-mix(in srgb, var(--accent) 16%, transparent), transparent 75%)",
      }}
    >
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

      <blockquote className="max-w-sm text-center">
        <div className="mx-auto mb-3 h-px w-12 bg-gradient-to-r from-transparent via-accent to-transparent" />
        <p className="font-display text-balance text-base italic leading-relaxed tracking-wide text-primary/80">
          &ldquo;Una estructura sólida, una estrategia coordinada y un objetivo común: harán de
          Nueva Alianza una fuerza competitiva en 2027&rdquo;
        </p>
      </blockquote>
    </div>
  );
}
