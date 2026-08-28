import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-primary", className)} aria-hidden />;
}

/**
 * Pantalla de carga a nivel de página completa. Se usa en los archivos
 * `loading.tsx` de cada ruta — Next.js los muestra automáticamente (vía
 * Suspense) mientras el Server Component de esa página resuelve sus datos,
 * así que aparece solo durante la navegación entre páginas, no en cada
 * re-render.
 */
export function PageLoading({ label = "Cargando…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[40vh] w-full flex-col items-center justify-center gap-3 text-muted-foreground"
    >
      <Spinner className="h-8 w-8" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
