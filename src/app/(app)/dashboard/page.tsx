import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { obtenerEstadisticas } from "@/lib/stats";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ROL_LABELS } from "@/lib/roles";

export default async function DashboardPage() {
  const usuario = await requireUser();
  const stats = await obtenerEstadisticas(usuario);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Hola, {usuario.nombre}</h1>
        <p className="text-sm text-muted-foreground">
          {ROL_LABELS[usuario.rol]}
          {usuario.rol === "CAPTURADOR" && usuario.localidades.length > 0 && (
            <> · Localidades asignadas: {usuario.localidades.join(", ")}</>
          )}
        </p>
      </div>

      {usuario.rol === "CAPTURADOR" && usuario.localidades.length === 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4 text-sm text-warning">
            Aún no tienes ninguna localidad/municipio asignado. Contacta al Administrador
            general para que te asigne acceso antes de poder capturar casillas.
          </CardContent>
        </Card>
      )}

      <StatsCards stats={stats} />

      <Card>
        <CardHeader>
          <CardTitle>Acciones rápidas</CardTitle>
          <CardDescription>Continúa con la captura de casillas.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/casillas">Ver casillas</Link>
          </Button>
          {(usuario.rol === "ADMIN_GENERAL" || usuario.rol === "ADMIN_CASILLAS") && (
            <Button asChild variant="secondary">
              <Link href="/casillas/nueva">Agregar casilla</Link>
            </Button>
          )}
          {usuario.rol === "ADMIN_GENERAL" && (
            <Button asChild variant="secondary">
              <Link href="/usuarios">Administrar usuarios</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
