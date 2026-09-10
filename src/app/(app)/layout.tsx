import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { obtenerCasaActiva } from "@/lib/casa-server";
import { CASA_LABEL, CASA_ESTILO } from "@/lib/casa";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Nav } from "@/components/layout/nav";
import { ToastProvider } from "@/components/ui/toast";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Punto de entrada de toda el área protegida: si la sesión no es válida
  // (sin sesión, cuenta desactivada, o sesión revocada), redirige a /login.
  const usuario = await requireUser();

  // Antes de mostrar cualquier módulo hay que saber en qué casa (26 / 52)
  // se está capturando — todo lo que se captura o consulta se acota a ella.
  // Se redirige (no se renderiza el gate aquí) para que el `redirect` corte
  // antes de que Next ejecute la página hija.
  const casaActiva = await obtenerCasaActiva();
  if (!casaActiva) {
    redirect("/elegir-casa");
  }

  return (
    <ToastProvider>
      <div
        data-casa={casaActiva}
        className={cn("flex min-h-screen flex-col", CASA_ESTILO[casaActiva].banda)}
      >
        <Header usuario={usuario} casaActiva={casaActiva} />
        <Nav rol={usuario.rol} />
        <div
          className={cn(
            "flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-semibold",
            CASA_ESTILO[casaActiva].chip
          )}
        >
          <span
            className={cn("h-2 w-2 rounded-full", CASA_ESTILO[casaActiva].punto)}
            aria-hidden
          />
          Estás capturando en {CASA_LABEL[casaActiva]}
        </div>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      </div>
    </ToastProvider>
  );
}
