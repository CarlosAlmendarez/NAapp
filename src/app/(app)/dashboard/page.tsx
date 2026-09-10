import Link from "next/link";
import { requireUser, puedeAdministrarCasillas } from "@/lib/auth-helpers";
import { requireCasaActiva } from "@/lib/casa-server";
import { CASA_LABEL } from "@/lib/casa";
import { obtenerEstadisticas, obtenerEstadisticasRuta } from "@/lib/stats";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RutaStatsCards } from "@/components/dashboard/ruta-stats-cards";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ROL_LABELS } from "@/lib/roles";
import { etiquetasLocalidades } from "@/lib/localidad";

export const metadata = { title: "Inicio" };

export default async function DashboardPage() {
  const usuario = await requireUser();
  const casa = await requireCasaActiva();

  // El RG solo ve avance de Rutas (nunca captura RC). Los demás ven el
  // avance de RC; el Admin general ve ADEMÁS el avance de Rutas (RG).
  const esRG = usuario.rol === "REPRESENTANTE_GENERAL";
  const esAdminGeneral = usuario.rol === "ADMIN_GENERAL";

  const stats = esRG ? null : await obtenerEstadisticas(usuario, casa);
  const statsRuta = esRG || esAdminGeneral ? await obtenerEstadisticasRuta(usuario) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Hola, {usuario.nombre}</h1>
        <p className="text-sm text-muted-foreground">
          {ROL_LABELS[usuario.rol]} · {CASA_LABEL[casa]}
          {(usuario.rol === "CAPTURADOR" || usuario.rol === "REPRESENTANTE_GENERAL") &&
            usuario.localidades.length > 0 && (
              <> · Localidades asignadas: {etiquetasLocalidades(usuario.localidades)}</>
            )}
        </p>
      </div>

      {(usuario.rol === "CAPTURADOR" || usuario.rol === "REPRESENTANTE_GENERAL") &&
        usuario.localidades.length === 0 && (
          <Card className="border-warning/40 bg-warning/5">
            <CardContent className="p-4 text-sm text-warning">
              Aún no tienes ninguna localidad/distrito asignado. Contacta al Administrador
              general para que te asigne acceso antes de poder capturar
              {usuario.rol === "CAPTURADOR" ? " casillas." : " rutas."}
            </CardContent>
          </Card>
        )}

      {esRG ? (
        <RutaStatsCards stats={statsRuta!} />
      ) : (
        <>
          {/* Para el Admin general, el resumen de RG / Rutas va primero. */}
          {esAdminGeneral && statsRuta && (
            <RutaStatsCards stats={statsRuta} variante="global" />
          )}
          <StatsCards stats={stats!} />
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Acciones rápidas</CardTitle>
          <CardDescription>Continúa con la captura.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/casillas">Ver casillas</Link>
          </Button>
          {puedeAdministrarCasillas(usuario) && (
            <Button asChild variant="secondary">
              <Link href="/casillas/nueva">Agregar casilla</Link>
            </Button>
          )}
          {(usuario.rol === "ADMIN_GENERAL" || usuario.rol === "REPRESENTANTE_GENERAL") && (
            <Button asChild variant="secondary">
              <Link href="/rutas">Ir a Rutas</Link>
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
