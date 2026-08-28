"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { eliminarCasilla } from "@/actions/casillas";

export function EliminarCasillaButton({ casillaId }: { casillaId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (
          !confirm(
            "¿Eliminar esta casilla? También se eliminarán sus representantes y asistentes capturados. Esta acción no se puede deshacer."
          )
        )
          return;
        startTransition(async () => {
          const resultado = await eliminarCasilla(casillaId);
          if (resultado.success) {
            router.push("/casillas");
            router.refresh();
          } else {
            alert(resultado.error);
          }
        });
      }}
    >
      <Trash2 className="h-4 w-4 text-destructive" />
      {isPending ? "Eliminando…" : "Eliminar"}
    </Button>
  );
}
