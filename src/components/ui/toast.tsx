"use client";

import * as React from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Variante = "exito" | "error" | "info";
type Toast = { id: number; mensaje: string; variante: Variante };

type ToastCtx = { toast: (mensaje: string, variante?: Variante) => void };

const Ctx = React.createContext<ToastCtx | null>(null);

/**
 * Notificaciones efímeras ("toast"). El provider vive en el layout del
 * área protegida para que un toast sobreviva a la navegación que dispara
 * el propio formulario (ej. "Guardado" y acto seguido router.push).
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const toast = React.useCallback((mensaje: string, variante: Variante = "exito") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, mensaje, variante }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const quitar = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end"
        role="region"
        aria-label="Notificaciones"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-lg border p-3 text-sm shadow-lg",
              t.variante === "exito" && "border-success/30 bg-success/10 text-success",
              t.variante === "error" && "border-destructive/30 bg-destructive/10 text-destructive",
              t.variante === "info" && "border-border bg-card text-foreground"
            )}
          >
            {t.variante === "exito" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            {t.variante === "error" && <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            {t.variante === "info" && <Info className="mt-0.5 h-4 w-4 shrink-0" />}
            <span className="min-w-0 flex-1">{t.mensaje}</span>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => quitar(t.id)}
              className="shrink-0 opacity-70 hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = React.useContext(Ctx);
  // Sin provider (ej. fuera del área protegida) el toast es un no-op para
  // no romper componentes reutilizados.
  return ctx ?? { toast: () => {} };
}
