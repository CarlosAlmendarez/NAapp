"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Casa } from "@prisma/client";
import { seleccionarCasa } from "@/actions/casa";
import { CASAS, CASA_LABEL, CASA_ESTILO } from "@/lib/casa";
import { LogoConTexto } from "@/components/layout/logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

/**
 * Puerta previa a toda el área protegida: hasta que el usuario elige una
 * casa (26 o 52), no se muestra ningún módulo. `casaSugerida` prellena la
 * casa del RG (su `Usuario.casa`), pero la decisión sigue siendo suya.
 */
export function ElegirCasaGate({ casaSugerida }: { casaSugerida: Casa | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function elegir(casa: Casa) {
    setError(null);
    startTransition(async () => {
      const resultado = await seleccionarCasa(casa);
      if (!resultado.success) {
        setError(resultado.error);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <LogoConTexto />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>¿En qué casa vas a capturar?</CardTitle>
          <p className="text-sm text-muted-foreground">
            Los datos de RC, rutas y asistentes son distintos para cada casa. Puedes
            cambiarla en cualquier momento desde el encabezado.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && <Alert variant="destructive">{error}</Alert>}
          <div className="grid grid-cols-2 gap-3">
            {CASAS.map((casa) => (
              <button
                key={casa}
                type="button"
                disabled={isPending}
                onClick={() => elegir(casa)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border-2 p-6 text-center transition-colors disabled:opacity-60",
                  casa === casaSugerida
                    ? "border-primary"
                    : "border-border hover:border-primary/50"
                )}
              >
                <span
                  className={cn("h-3 w-3 rounded-full", CASA_ESTILO[casa].punto)}
                  aria-hidden
                />
                <span className="text-lg font-semibold text-foreground">
                  {CASA_LABEL[casa]}
                </span>
                {casa === casaSugerida && (
                  <span className="text-xs text-muted-foreground">Tu casa asignada</span>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
