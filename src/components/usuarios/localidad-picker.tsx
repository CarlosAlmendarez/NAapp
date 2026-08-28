"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export type LocalidadAsignada = { tipo: "MUNICIPIO" | "DISTRITO_LOCAL"; valor: string };

function ListaSeleccionable({
  opciones,
  seleccionados,
  onToggle,
}: {
  opciones: string[];
  seleccionados: string[];
  onToggle: (valor: string) => void;
}) {
  const [filtro, setFiltro] = useState("");
  const visibles = opciones.filter((o) => o.toLowerCase().includes(filtro.toLowerCase()));

  return (
    <div className="space-y-2">
      <Input
        placeholder="Buscar…"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
      />
      <div className="max-h-56 overflow-y-auto rounded-md border border-border p-2">
        {visibles.length === 0 && (
          <p className="p-2 text-sm text-muted-foreground">Sin resultados.</p>
        )}
        {visibles.map((opcion) => (
          <label
            key={opcion}
            className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-secondary"
          >
            <Checkbox checked={seleccionados.includes(opcion)} onCheckedChange={() => onToggle(opcion)} />
            {opcion}
          </label>
        ))}
      </div>
    </div>
  );
}

/**
 * Selector combinado de municipios y distritos locales. Un municipio
 * grande puede estar repartido en varios distritos locales (ej. San Luis
 * Potosí capital o Soledad de Graciano Sánchez), así que se manejan como
 * dos dimensiones independientes en vez de anidar una dentro de la otra.
 */
export function LocalidadPicker({
  municipios,
  distritosLocales,
  seleccionados,
  onChange,
}: {
  municipios: string[];
  distritosLocales: string[];
  seleccionados: LocalidadAsignada[];
  onChange: (nuevos: LocalidadAsignada[]) => void;
}) {
  const municipiosSel = seleccionados.filter((l) => l.tipo === "MUNICIPIO").map((l) => l.valor);
  const distritosSel = seleccionados
    .filter((l) => l.tipo === "DISTRITO_LOCAL")
    .map((l) => l.valor);

  function toggleMunicipio(valor: string) {
    if (municipiosSel.includes(valor)) {
      onChange(seleccionados.filter((l) => !(l.tipo === "MUNICIPIO" && l.valor === valor)));
    } else {
      onChange([...seleccionados, { tipo: "MUNICIPIO", valor }]);
    }
  }

  function toggleDistrito(valor: string) {
    if (distritosSel.includes(valor)) {
      onChange(seleccionados.filter((l) => !(l.tipo === "DISTRITO_LOCAL" && l.valor === valor)));
    } else {
      onChange([...seleccionados, { tipo: "DISTRITO_LOCAL", valor }]);
    }
  }

  return (
    <div className="space-y-2">
      <Tabs defaultValue="municipio">
        <TabsList>
          <TabsTrigger value="municipio">
            Municipios {municipiosSel.length > 0 && <Badge className="ml-1.5">{municipiosSel.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="distrito">
            Distritos locales{" "}
            {distritosSel.length > 0 && <Badge className="ml-1.5">{distritosSel.length}</Badge>}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="municipio">
          <ListaSeleccionable
            opciones={municipios}
            seleccionados={municipiosSel}
            onToggle={toggleMunicipio}
          />
        </TabsContent>
        <TabsContent value="distrito">
          <ListaSeleccionable
            opciones={distritosLocales}
            seleccionados={distritosSel}
            onToggle={toggleDistrito}
          />
        </TabsContent>
      </Tabs>
      <p className="text-xs text-muted-foreground">
        {seleccionados.length} localidad(es) seleccionada(s) en total.
      </p>
    </div>
  );
}

export function LocalidadPickerConLabel(props: Parameters<typeof LocalidadPicker>[0]) {
  return (
    <div className="space-y-1.5">
      <Label>Municipios / distritos locales asignados</Label>
      <LocalidadPicker {...props} />
    </div>
  );
}
