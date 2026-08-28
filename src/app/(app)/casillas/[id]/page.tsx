import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus, MapPin } from "lucide-react";
import { requireUser, tieneAccesoALocalidad } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EliminarAsistenteButton } from "@/components/casillas/eliminar-asistente-button";
import { EliminarCasillaButton } from "@/components/casillas/eliminar-casilla-button";
import { nombreCompleto, formatFecha } from "@/lib/utils";
import { formatTipoCasilla } from "@/lib/tipo-casilla";

export default async function CasillaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await requireUser();
  const { id } = await params;

  const casilla = await prisma.casilla.findUnique({
    where: { id },
    include: {
      representantes: { orderBy: { tipo: "asc" } },
      asistentes: { orderBy: { capturadoEn: "asc" } },
    },
  });

  if (!casilla) notFound();

  // Un capturador sin acceso a este municipio/distrito no debe ni
  // enterarse de que la casilla existe.
  if (!tieneAccesoALocalidad(usuario, casilla)) {
    notFound();
  }

  const puedeEditarCasilla = usuario.rol === "ADMIN_GENERAL" || usuario.rol === "ADMIN_CASILLAS";
  const propietario = casilla.representantes.find((r) => r.tipo === "PROPIETARIO");
  const suplente = casilla.representantes.find((r) => r.tipo === "SUPLENTE");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Distrito local {casilla.distritoLocal}
            </p>
            <CardTitle className="mt-0.5 flex flex-wrap items-center gap-2">
              Sección {casilla.seccion}
              <Badge variant="accent">{formatTipoCasilla(casilla.tipoCasilla)}</Badge>
            </CardTitle>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {casilla.municipio} · {casilla.coloniaLocalidad}
            </p>
          </div>
          {puedeEditarCasilla && (
            <div className="flex shrink-0 gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/casillas/${casilla.id}/editar`}>
                  <Pencil className="h-4 w-4" />
                  Editar
                </Link>
              </Button>
              <EliminarCasillaButton casillaId={casilla.id} />
            </div>
          )}
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p className="sm:col-span-2">
            <span className="text-muted-foreground">Distrito federal: </span>
            {casilla.distritoFederal}
          </p>
          <p className="sm:col-span-2">
            <span className="text-muted-foreground">Domicilio: </span>
            {casilla.domicilio}
          </p>
          <p className="sm:col-span-2">
            <span className="text-muted-foreground">Ubicación: </span>
            {casilla.ubicacion}
          </p>
          {casilla.codigoPostal && (
            <p>
              <span className="text-muted-foreground">C.P.: </span>
              {casilla.codigoPostal}
            </p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="representantes">
        <TabsList>
          <TabsTrigger value="representantes">Representantes</TabsTrigger>
          <TabsTrigger value="asistentes">Asistentes electorales</TabsTrigger>
        </TabsList>

        <TabsContent value="representantes" className="space-y-3">
          <RepresentanteResumen
            casillaId={casilla.id}
            tipo="PROPIETARIO"
            etiqueta="RC Propietario"
            representante={propietario}
          />
          <RepresentanteResumen
            casillaId={casilla.id}
            tipo="SUPLENTE"
            etiqueta="RC Suplente"
            representante={suplente}
          />
        </TabsContent>

        <TabsContent value="asistentes" className="space-y-3">
          <div className="flex justify-end">
            <Button asChild size="sm">
              <Link href={`/casillas/${casilla.id}/asistentes/nuevo`}>
                <Plus className="h-4 w-4" />
                Agregar asistente
              </Link>
            </Button>
          </div>

          {casilla.asistentes.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Aún no hay asistentes electorales capturados para esta casilla.
              </CardContent>
            </Card>
          ) : (
            casilla.asistentes.map((asistente) => (
              <Card key={asistente.id}>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {nombreCompleto(asistente)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[asistente.correoElectronico, asistente.telefono]
                        .filter(Boolean)
                        .join(" · ") || "Sin contacto registrado"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Capturado el {formatFecha(asistente.capturadoEn)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button asChild variant="ghost" size="icon" aria-label="Editar asistente">
                      <Link href={`/casillas/${casilla.id}/asistentes/${asistente.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <EliminarAsistenteButton casillaId={casilla.id} asistenteId={asistente.id} />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RepresentanteResumen({
  casillaId,
  tipo,
  etiqueta,
  representante,
}: {
  casillaId: string;
  tipo: "PROPIETARIO" | "SUPLENTE";
  etiqueta: string;
  representante?: {
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno: string | null;
    propone: string;
    correoElectronico: string | null;
    telefono: string | null;
    capturadoEn: Date;
  };
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-foreground">{etiqueta}</p>
            <Badge variant={representante ? "success" : "outline"}>
              {representante ? "Capturado" : "Pendiente"}
            </Badge>
          </div>
          {representante ? (
            <>
              <p className="truncate text-sm text-foreground">{nombreCompleto(representante)}</p>
              <p className="truncate text-xs text-muted-foreground">
                Propone: {representante.propone}
              </p>
              <p className="text-xs text-muted-foreground">
                Capturado el {formatFecha(representante.capturadoEn)}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Sin capturar</p>
          )}
        </div>
        <Button asChild variant={representante ? "outline" : "default"} size="sm">
          <Link href={`/casillas/${casillaId}/representante/${tipo.toLowerCase()}`}>
            {representante ? "Editar" : "Capturar"}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
