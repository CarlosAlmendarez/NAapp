import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { obtenerCasaActiva } from "@/lib/casa-server";
import { ElegirCasaGate } from "@/components/layout/elegir-casa-gate";

/**
 * Puerta previa al área protegida: mientras no haya cookie `casa`, el
 * layout de `(app)` redirige aquí. Vive FUERA de `(app)` a propósito —
 * así el `redirect()` del layout corta antes de que se ejecute cualquier
 * página, que asumen que ya hay una casa activa.
 */
export default async function ElegirCasaPage() {
  const usuario = await requireUser();
  if (await obtenerCasaActiva()) {
    redirect("/dashboard");
  }
  return <ElegirCasaGate casaSugerida={usuario.casa} />;
}
