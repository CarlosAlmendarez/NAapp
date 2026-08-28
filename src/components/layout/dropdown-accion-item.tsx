"use client";

import { useTransition } from "react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Ítem de menú que ejecuta una Server Action al seleccionarse.
 *
 * No usar un <form action={...}> nativo dentro de un DropdownMenuItem: al
 * seleccionar el ítem, Radix cierra (desmonta) el menú de inmediato, y eso
 * desconecta el <form> del documento a media a mitad del envío — el
 * navegador cancela la petición con "Form submission canceled because the
 * form is not connected" y la acción nunca llega a correr. Aquí se llama
 * la Server Action directamente (no depende de que el nodo del formulario
 * siga en el DOM).
 */
export function DropdownAccionItem({
  accion,
  children,
  className,
}: {
  accion: () => Promise<unknown>;
  children: React.ReactNode;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <DropdownMenuItem
      disabled={isPending}
      className={cn("cursor-pointer", className)}
      onSelect={() => {
        startTransition(async () => {
          await accion();
        });
      }}
    >
      {children}
    </DropdownMenuItem>
  );
}
