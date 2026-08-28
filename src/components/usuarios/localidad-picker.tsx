"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LocalidadPicker({
  municipios,
  seleccionados,
  onChange,
}: {
  municipios: string[];
  seleccionados: string[];
  onChange: (nuevos: string[]) => void;
}) {
  const [filtro, setFiltro] = useState("");

  const visibles = municipios.filter((m) => m.toLowerCase().includes(filtro.toLowerCase()));

  function toggle(municipio: string) {
    if (seleccionados.includes(municipio)) {
      onChange(seleccionados.filter((m) => m !== municipio));
    } else {
      onChange([...seleccionados, municipio]);
    }
  }

  return (
    <div className="space-y-2">
      <Input
        placeholder="Buscar municipio…"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
      />
      <div className="max-h-56 overflow-y-auto rounded-md border border-border p-2">
        {visibles.length === 0 && (
          <p className="p-2 text-sm text-muted-foreground">Sin resultados.</p>
        )}
        {visibles.map((municipio) => (
          <label
            key={municipio}
            className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-secondary"
          >
            <Checkbox
              checked={seleccionados.includes(municipio)}
              onCheckedChange={() => toggle(municipio)}
            />
            {municipio}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {seleccionados.length} municipio(s) seleccionado(s).
      </p>
    </div>
  );
}

export function LocalidadPickerConLabel(props: Parameters<typeof LocalidadPicker>[0]) {
  return (
    <div className="space-y-1.5">
      <Label>Localidades / municipios asignados</Label>
      <LocalidadPicker {...props} />
    </div>
  );
}
