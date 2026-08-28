"use client";

import { useTransition } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cerrarSesionesDeUsuario } from "@/actions/usuarios";

export function CerrarSesionesButton({ usuarioId }: { usuarioId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm("¿Cerrar todas las sesiones activas de este usuario?")) return;
        startTransition(async () => {
          await cerrarSesionesDeUsuario(usuarioId);
        });
      }}
    >
      <ShieldAlert className="h-4 w-4" />
      {isPending ? "Cerrando…" : "Cerrar sus sesiones"}
    </Button>
  );
}
