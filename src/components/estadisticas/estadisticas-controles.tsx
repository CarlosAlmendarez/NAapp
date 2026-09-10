"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, ArrowDown, ArrowUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

const ORDEN_OPCIONES = [
  { value: "nombre", label: "Nombre" },
  { value: "rc", label: "Avance RC" },
  { value: "rg", label: "Avance RG" },
  { value: "casillas", label: "Nº de casillas" },
] as const;

/**
 * Controles de la vista de Estadísticas: agrupar por municipio o distrito
 * local, ordenar por nombre / avance RC / avance RG / nº de casillas, en
 * ascendente o descendente, y un buscador por nombre del grupo. Todo va
 * en la URL (?agrupar=&orden=&dir=&buscar=) — la página es de servidor.
 */
export function EstadisticasControles({
  agrupar,
  orden,
  dir,
  buscar,
}: {
  agrupar: "municipio" | "distrito";
  orden: string;
  dir: "asc" | "desc";
  buscar: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [texto, setTexto] = useState(buscar);

  function actualizar(cambios: Record<string, string | undefined>) {
    const nuevos = new URLSearchParams(searchParams.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) nuevos.set(clave, valor);
      else nuevos.delete(clave);
    }
    startTransition(() => router.push(`${pathname}?${nuevos.toString()}`));
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="space-y-1.5">
        <Label className="text-xs">Agrupar por</Label>
        <div className="flex rounded-md border border-border p-0.5">
          {(["municipio", "distrito"] as const).map((valor) => (
            <button
              key={valor}
              type="button"
              onClick={() => actualizar({ agrupar: valor === "municipio" ? undefined : valor })}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                agrupar === valor
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {valor === "municipio" ? "Municipio" : "Distrito local"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Ordenar por</Label>
        <div className="flex items-center gap-2">
          <Select
            value={orden}
            onValueChange={(v) => actualizar({ orden: v === "nombre" ? undefined : v })}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDEN_OPCIONES.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={dir === "asc" ? "Cambiar a descendente" : "Cambiar a ascendente"}
            onClick={() => actualizar({ dir: dir === "asc" ? "desc" : undefined })}
          >
            {dir === "asc" ? (
              <ArrowUp className="h-4 w-4" />
            ) : (
              <ArrowDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <form
        className="flex flex-1 items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          actualizar({ buscar: texto.trim() || undefined });
        }}
      >
        <div className="min-w-[180px] flex-1 space-y-1.5">
          <Label className="text-xs" htmlFor="buscar-grupo">
            Buscar {agrupar === "municipio" ? "municipio" : "distrito"}
          </Label>
          <Input
            id="buscar-grupo"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={agrupar === "municipio" ? "Ej. SOLEDAD" : "Ej. 12. CARDENAS"}
            autoComplete="off"
          />
        </div>
        <Button type="submit" variant="outline" size="icon" aria-label="Buscar">
          <Search className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
