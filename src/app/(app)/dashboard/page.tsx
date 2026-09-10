import Link from "next/link";
import { requireUser, puedeAdministrarCasillas } from "@/lib/auth-helpers";
import { requireCasaActiva } from "@/lib/casa-server";
import { CASA_LABEL } from "@/lib/casa";
import { obtenerEstadisticas, obtenerEstadisticasRuta } from "@/lib/stats";
import { casillasPendientesDeRc } from "@/lib/casillas-query";
import { formatNumero } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
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

  // Llamada a la acción para el capturador: cuántas casillas le faltan y
  // cuál es la siguiente.
  const pendientesRc =
    usuario.rol === "CAPTURADOR" ? await casillasPendientesDeRc(usuario, casa) : null;

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

      {pendientesRc && pendientesRc.total > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-foreground">
              Te faltan <strong>{formatNumero(pendientesRc.total)}</strong> casilla(s) por
              capturar en tu alcance ({CASA_LABEL[casa]}).
            </p>
            {pendientesRc.siguienteId && (
              <Button asChild size="sm">
                <Link
                  href={`/casillas/${pendientesRc.siguienteId}/representante/propietario`}
                >
                  Capturar la siguiente
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
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
