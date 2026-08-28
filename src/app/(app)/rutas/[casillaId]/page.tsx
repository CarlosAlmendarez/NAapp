import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser, tieneAccesoALocalidad, puedeUsarModuloRutas } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { EnlaceForm } from "@/components/casillas/enlace-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function CapturarEnlacePage({
  params,
}: {
  params: Promise<{ casillaId: string }>;
}) {
  const usuario = await requireUser();
  const { casillaId } = await params;

  // Solo Admin general y Representante General usan el módulo de Rutas —
  // ni siquiera deben ver el formulario (la Server Action también lo
  // bloquea, pero no hay razón para dejarlos llegar hasta aquí).
  if (!puedeUsarModuloRutas(usuario)) notFound();

  const casilla = await prisma.casilla.findUnique({
    where: { id: casillaId },
    include: { enlace: true },
  });
  if (!casilla) notFound();
  if (!tieneAccesoALocalidad(usuario, casilla)) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/rutas"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a Rutas
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>
            Enlace de casilla — Sección {casilla.seccion} · Distrito local{" "}
            {casilla.distritoLocal}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EnlaceForm
            casillaId={casilla.id}
            siguienteHref="/rutas"
            existente={
              casilla.enlace
                ? {
                    nombre: casilla.enlace.nombre,
                    apellidoPaterno: casilla.enlace.apellidoPaterno,
                    apellidoMaterno: casilla.enlace.apellidoMaterno,
                    telefono: casilla.enlace.telefono,
                    correoElectronico: casilla.enlace.correoElectronico,
                  }
                : undefined
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
