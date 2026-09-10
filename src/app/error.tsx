"use client";

import { useEffect } from "react";

export default function Error({
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
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-lg font-semibold text-foreground">Algo salió mal</h1>
      <p className="text-sm text-muted-foreground">
        Ocurrió un error al cargar esta pantalla. Puede ser una interrupción momentánea de
        la conexión.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
        >
          Reintentar
        </button>
        <a
          href="/dashboard"
          className="rounded-md border border-input bg-card px-4 py-2 text-sm font-medium hover:bg-secondary"
        >
          Ir al inicio
        </a>
      </div>
      {error.digest && (
        <p className="text-[11px] text-muted-foreground">Referencia: {error.digest}</p>
      )}
    </div>
  );
}
