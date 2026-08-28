"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Search } from "lucide-react";

export function CasillasFiltro({ municipios }: { municipios: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
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
    <div className="flex flex-col gap-3 sm:flex-row">
      <form
        className="flex flex-1 gap-2"
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
          <SelectTrigger className="sm:w-56">
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
    </div>
  );
}
