import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { requireUser, tieneAccesoALocalidad, puedeUsarModuloRutas } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
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
  const { id } = await params;

  const casilla = await prisma.casilla.findUnique({
    where: { id },
    include: {
      representantes: { orderBy: { tipo: "asc" } },
      enlace: true,
    },
  });

  if (!casilla) notFound();

  // Un capturador (o RG) sin acceso a este municipio/distrito no debe ni
  // enterarse de que la casilla existe.
  if (!tieneAccesoALocalidad(usuario, casilla)) {
    notFound();
  }

  // El Representante General no captura RC — solo ve la sección de
  // Enlace de casilla (módulo Rutas), nunca la de RC.
  const puedeVerRc = usuario.rol !== "REPRESENTANTE_GENERAL";
  const puedeVerEnlace = puedeUsarModuloRutas(usuario);
  const propietario = casilla.representantes.find((r) => r.tipo === "PROPIETARIO");
  const suplente = casilla.representantes.find((r) => r.tipo === "SUPLENTE");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Distrito local {casilla.distritoLocal}</CardTitle>
            <p className="mt-1 text-sm font-normal text-muted-foreground">
              Sección {casilla.seccion}
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
          <h2 className="text-lg font-semibold text-foreground">Representantes de Casilla</h2>
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
        </div>
      )}

      {puedeVerEnlace && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Enlace de casilla (Ruta)</h2>
          <EnlaceResumen casillaId={casilla.id} enlace={casilla.enlace} />
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
          <Link href={`/rutas/${casillaId}`}>{enlace ? "Editar" : "Capturar"}</Link>
        </Button>
      </CardContent>
    </Card>
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
