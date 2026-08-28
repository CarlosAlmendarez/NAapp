"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { eliminarAsistente } from "@/actions/asistentes";

export function EliminarAsistenteButton({
  casillaId,
  asistenteId,
}: {
  casillaId: string;
  asistenteId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={isPending}
      aria-label="Eliminar asistente"
      onClick={() => {
        if (!confirm("¿Eliminar a este asistente electoral de la casilla?")) return;
        startTransition(async () => {
          await eliminarAsistente(casillaId, asistenteId);
          router.refresh();
        });
      }}
    >
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  );
}
