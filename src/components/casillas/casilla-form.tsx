"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearCasilla, actualizarCasilla } from "@/actions/casillas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { FieldError } from "@/components/ui/field-error";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

type CasillaExistente = {
  id: string;
  distritoLocal: string;
  municipio: string;
  seccion: number;
  tipoCasilla: string;
  domicilio: string;
  coloniaLocalidad: string;
  codigoPostal: string | null;
  ubicacion: string;
};

export function CasillaForm({
  municipios,
  casilla,
}: {
  municipios: string[];
  casilla?: CasillaExistente;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [municipio, setMunicipio] = useState(casilla?.municipio ?? "");

  function onSubmit(formData: FormData) {
    setError(null);
    setFieldErrors({});

    const datos = {
      distritoLocal: formData.get("distritoLocal"),
      municipio,
      seccion: formData.get("seccion"),
      tipoCasilla: formData.get("tipoCasilla"),
      domicilio: formData.get("domicilio"),
      coloniaLocalidad: formData.get("coloniaLocalidad"),
      codigoPostal: formData.get("codigoPostal"),
      ubicacion: formData.get("ubicacion"),
    };

    startTransition(async () => {
      const resultado = casilla
        ? await actualizarCasilla(casilla.id, datos)
        : await crearCasilla(datos);

      if (!resultado.success) {
        setError(resultado.error);
        setFieldErrors(resultado.fieldErrors ?? {});
        return;
      }

      router.push(`/casillas/${resultado.data.id}`);
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      {error && <Alert variant="destructive">{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="distritoLocal">Distrito local</Label>
          <Input
            id="distritoLocal"
            name="distritoLocal"
            defaultValue={casilla?.distritoLocal}
            placeholder="2. SALINAS"
            required
          />
          <FieldError messages={fieldErrors.distritoLocal} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="municipio">Municipio</Label>
          <Select value={municipio} onValueChange={setMunicipio}>
            <SelectTrigger id="municipio">
              <SelectValue placeholder="Selecciona un municipio" />
            </SelectTrigger>
            <SelectContent>
              {municipios.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError messages={fieldErrors.municipio} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="seccion">Sección</Label>
          <Input
            id="seccion"
            name="seccion"
            type="number"
            inputMode="numeric"
            defaultValue={casilla?.seccion}
            required
          />
          <FieldError messages={fieldErrors.seccion} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tipoCasilla">Tipo de casilla</Label>
          <Input
            id="tipoCasilla"
            name="tipoCasilla"
            defaultValue={casilla?.tipoCasilla}
            placeholder="B, C01, S01, E01…"
            required
          />
          <FieldError messages={fieldErrors.tipoCasilla} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="codigoPostal">Código postal (opcional)</Label>
          <Input
            id="codigoPostal"
            name="codigoPostal"
            defaultValue={casilla?.codigoPostal ?? ""}
            inputMode="numeric"
            maxLength={5}
          />
          <FieldError messages={fieldErrors.codigoPostal} />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="coloniaLocalidad">Colonia / localidad</Label>
          <Input
            id="coloniaLocalidad"
            name="coloniaLocalidad"
            defaultValue={casilla?.coloniaLocalidad}
            required
          />
          <FieldError messages={fieldErrors.coloniaLocalidad} />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="domicilio">Domicilio</Label>
          <Input
            id="domicilio"
            name="domicilio"
            defaultValue={casilla?.domicilio}
            required
          />
          <FieldError messages={fieldErrors.domicilio} />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="ubicacion">Ubicación (nombre del inmueble)</Label>
          <Input
            id="ubicacion"
            name="ubicacion"
            defaultValue={casilla?.ubicacion}
            required
          />
          <FieldError messages={fieldErrors.ubicacion} />
        </div>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Guardando…" : casilla ? "Guardar cambios" : "Crear casilla"}
      </Button>
    </form>
  );
}
