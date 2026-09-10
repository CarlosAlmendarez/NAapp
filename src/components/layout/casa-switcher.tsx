"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { Casa } from "@prisma/client";
import { seleccionarCasa } from "@/actions/casa";
import { CASAS, CASA_LABEL, CASA_ESTILO } from "@/lib/casa";
import { cn } from "@/lib/utils";

/**
 * Selector de casa activa en el encabezado. Es también un distintivo
 * visual permanente: la casa activa queda resaltada con el color de su
 * tema (26 azul, 52 ámbar).
 */
export function CasaSwitcher({ casaActiva }: { casaActiva: Casa }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function cambiar(casa: Casa) {
    if (casa === casaActiva || isPending) return;
    startTransition(async () => {
      const resultado = await seleccionarCasa(casa);
      if (resultado.success) router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label="Casa en la que estás capturando"
      aria-busy={isPending}
      className="flex items-center rounded-md border border-border bg-card p-0.5"
    >
      {isPending && (
        <Loader2 className="mx-1 h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden />
      )}
      {CASAS.map((casa) => {
        const activa = casa === casaActiva;
        return (
          <button
            key={casa}
            type="button"
            onClick={() => cambiar(casa)}
            disabled={isPending}
            aria-pressed={activa}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-60",
              activa
                ? CASA_ESTILO[casa].chip
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {CASA_LABEL[casa]}
          </button>
        );
      })}
    </div>
  );
}
