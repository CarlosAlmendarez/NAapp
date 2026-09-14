import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser, puedeUsarModuloRutas } from "@/lib/auth-helpers";
import { requireCasaActiva } from "@/lib/casa-server";
import { CASA_LABEL } from "@/lib/casa";
import { RutaForm } from "@/components/casillas/ruta-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Nueva ruta" };

export default async function NuevaRutaPage() {
  const usuario = await requireUser();
  if (!puedeUsarModuloRutas(usuario)) redirect("/dashboard");
  const casa = await requireCasaActiva();

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
          <CardTitle>Nueva ruta</CardTitle>
        </CardHeader>
        <CardContent>
          <RutaForm casaLabel={CASA_LABEL[casa]} />
        </CardContent>
      </Card>
    </div>
  );
}
