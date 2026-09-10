"use client";

import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Boundary de error para el área protegida — se muestra con el encabezado
 * y la navegación de la app intactos, a diferencia de src/app/error.tsx.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
        <h1 className="text-base font-semibold text-foreground">Algo salió mal</h1>
        <p className="text-sm text-muted-foreground">
          No se pudo cargar esta pantalla. Puede ser una interrupción momentánea de la
          conexión con el servidor.
        </p>
        <Button type="button" onClick={reset}>
          Reintentar
        </Button>
        {error.digest && (
          <p className="text-[11px] text-muted-foreground">Referencia: {error.digest}</p>
        )}
      </CardContent>
    </Card>
  );
}
