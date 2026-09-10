"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Search } from "lucide-react";

export function CasillasFiltro({
  municipios,
  distritos,
}: {
  municipios: string[];
  /** Solo se pasa (y se muestra) para roles sin restricción geográfica — ver el comentario en distritosDisponibles. */
  distritos?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [busqueda, setBusqueda] = useState(searchParams.get("busqueda") ?? "");

  function actualizar(params: Record<string, string | undefined>) {
    const nuevos = new URLSearchParams(searchParams.toString());
    for (const [clave, valor] of Object.entries(params)) {
      if (valor) nuevos.set(clave, valor);
      else nuevos.delete(clave);
    }
    nuevos.delete("page");
    startTransition(() => router.push(`${pathname}?${nuevos.toString()}`));
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap" aria-busy={isPending}>
      {isPending && (
        <span
          role="status"
          className="flex items-center gap-1.5 self-center text-xs text-muted-foreground sm:order-last"
        >
          <Spinner className="h-3.5 w-3.5" />
          Actualizando…
        </span>
      )}
      <form
        className="flex min-w-[220px] flex-1 gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          actualizar({ busqueda });
        }}
      >
        <Input
          placeholder="Buscar por sección, colonia o ubicación…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <Button type="submit" variant="outline" size="icon" aria-label="Buscar">
          <Search className="h-4 w-4" />
        </Button>
      </form>

      {municipios.length > 1 && (
        <Select
          value={searchParams.get("municipio") ?? "__todos__"}
          onValueChange={(valor) =>
            actualizar({ municipio: valor === "__todos__" ? undefined : valor })
          }
        >
          {/* aria-label fijo: sin él, el nombre accesible del combobox
              cambia según la opción seleccionada (ej. "Todos los
              municipios"), en vez de mantenerse estable como "Municipio". */}
          <SelectTrigger className="sm:w-56" aria-label="Municipio">
            <SelectValue placeholder="Municipio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__todos__">Todos los municipios</SelectItem>
            {municipios.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {distritos && distritos.length > 1 && (
        <Select
          value={searchParams.get("distrito") ?? "__todos__"}
          onValueChange={(valor) =>
            actualizar({ distrito: valor === "__todos__" ? undefined : valor })
          }
        >
          <SelectTrigger className="sm:w-56" aria-label="Distrito local">
            <SelectValue placeholder="Distrito local" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__todos__">Todos los distritos</SelectItem>
            {distritos.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
