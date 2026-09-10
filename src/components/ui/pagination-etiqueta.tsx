"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";

/**
 * Etiqueta de un enlace de paginación que muestra un spinner mientras esa
 * navegación está en curso. Debe renderizarse como hijo de un `<Link>`
 * (requisito de `useLinkStatus`).
 */
export function PaginacionEtiqueta({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <span className="inline-flex items-center gap-1.5">
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {children}
    </span>
  );
}
