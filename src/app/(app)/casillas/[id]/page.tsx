import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, UserCheck } from "lucide-react";
import { requireUser, tieneAccesoALocalidad } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { requireCasaActiva } from "@/lib/casa-server";
import { CASA_LABEL } from "@/lib/casa";
import { obtenerRgDeCasilla } from "@/lib/rg-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { nombreCompleto, formatFecha } from "@/lib/utils";
import { formatTipoCasilla, varianteTipoCasilla } from "@/lib/tipo-casilla";

export default async function CasillaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await requireUser();
  const casa = await requireCasaActiva();
  const { id } = await params;

  const casilla = await prisma.casilla.findUnique({
    where: { id },
    include: {
      representantes: { where: { casa }, orderBy: { tipo: "asc" } },
      // El enlace de Rutas es único por casilla (no por casa).
      enlace: true,
    },
  });

  if (!casilla) notFound();

  // Un capturador (o RG) sin acceso a este municipio/distrito no debe ni
  // enterarse de que la casilla existe.
  if (!tieneAccesoALocalidad(usuario, casilla)) {
    notFound();
  }

  const enlace = casilla.enlace;
  // Cambio 2: a quien captura RC se le muestra quién es el RG de esta
  // casilla — sin importar la casa (un RG lo es del distrito, no de una
  // casa en particular). El RC suplente solo se ofrece si NO hay RG.
  const rg = await obtenerRgDeCasilla(casilla.distritoLocal);

  // El Representante General no captura RC, y tampoco ve aquí la sección
  // de Enlace: siempre debe capturar/editar enlaces desde el módulo de
  // Rutas (/rutas), nunca desde el atajo del detalle de una casilla — así
  // no tiene más que un solo camino para hacerlo. Admin general sí ve
  // ambas secciones (puede usar Rutas y también administrar el catálogo).
  const puedeVerRc = usuario.rol !== "REPRESENTANTE_GENERAL";
  const puedeVerEnlace = usuario.rol === "ADMIN_GENERAL";
  const propietario = casilla.representantes.find((r) => r.tipo === "PROPIETARIO");
  const suplente = casilla.representantes.find((r) => r.tipo === "SUPLENTE");
  // El suplente solo se muestra/captura si la casilla no tiene RG en esta
  // casa (aunque si ya hubiera un suplente capturado, se sigue mostrando).
  const mostrarSuplente = !rg || Boolean(suplente);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Distrito local {casilla.distritoLocal}</CardTitle>
            <p className="mt-1 text-sm font-normal text-muted-foreground">
              Sección {casilla.seccion} · datos de {CASA_LABEL[casa]}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 whitespace-nowrap text-sm font-normal text-muted-foreground">
              Tipo de Casilla:
              <Badge variant={varianteTipoCasilla(casilla.tipoCasilla)}>
                {formatTipoCasilla(casilla.tipoCasilla)}
              </Badge>
            </div>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {casilla.municipio} · {casilla.coloniaLocalidad}
            </p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
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

      {puedeVerRc && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            Representantes de Casilla — {CASA_LABEL[casa]}
          </h2>

          <Card>
            <CardContent className="flex items-start gap-3 p-4">
              <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 text-sm">
                <p className="font-medium text-foreground">
                  Representante General (RG) de esta casilla
                </p>
                {rg ? (
                  <p className="text-muted-foreground">
                    {rg.nombre} · Tel: {rg.telefono ?? "—"}
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    Sin RG asignado. Puedes capturar RC igualmente.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <RepresentanteResumen
            casillaId={casilla.id}
            tipo="PROPIETARIO"
            etiqueta="RC Propietario"
            casaLabel={CASA_LABEL[casa]}
            representante={propietario}
          />
          {mostrarSuplente ? (
            <RepresentanteResumen
              casillaId={casilla.id}
              tipo="SUPLENTE"
              etiqueta="RC Suplente"
              casaLabel={CASA_LABEL[casa]}
              representante={suplente}
            />
          ) : (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                El RC suplente no se captura: esta casilla ya tiene Representante General.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {puedeVerEnlace && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Enlace de casilla (Ruta)</h2>
          <EnlaceResumen casillaId={casilla.id} enlace={enlace} />
        </div>
      )}
    </div>
  );
}

function EnlaceResumen({
  casillaId,
  enlace,
}: {
  casillaId: string;
  enlace?: {
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno: string | null;
    telefono: string;
    correoElectronico: string | null;
    capturadoEn: Date;
    rutaId: string;
  } | null;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-foreground">Enlace</p>
            <Badge variant={enlace ? "success" : "outline"}>
              {enlace ? "Capturado" : "Pendiente"}
            </Badge>
          </div>
          {enlace ? (
            <>
              <p className="truncate text-sm text-foreground">{nombreCompleto(enlace)}</p>
              <p className="truncate text-xs text-muted-foreground">Tel: {enlace.telefono}</p>
              <p className="text-xs text-muted-foreground">
                Capturado el {formatFecha(enlace.capturadoEn)}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Sin capturar</p>
          )}
        </div>
        <Button asChild variant={enlace ? "outline" : "default"} size="sm">
          <Link href={enlace ? `/rutas/editar/${enlace.rutaId}` : `/rutas/${casillaId}`}>
            {enlace ? "Editar ruta" : "Capturar"}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function RepresentanteResumen({
  casillaId,
  tipo,
  etiqueta,
  casaLabel,
  representante,
}: {
  casillaId: string;
  tipo: "PROPIETARIO" | "SUPLENTE";
  etiqueta: string;
  casaLabel: string;
  representante?: {
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno: string | null;
    propone: string;
    telefonoPropone: string | null;
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
                Propone: {representante.propone} ({casaLabel}) · Tel. de quien propone:{" "}
                {representante.telefonoPropone ?? "—"}
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
