"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearAsistente, actualizarAsistente } from "@/actions/asistentes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { FieldError } from "@/components/ui/field-error";

type AsistenteExistente = {
  id: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  correoElectronico: string | null;
  telefono: string | null;
};

export function AsistenteForm({
  casillaId,
  existente,
}: {
  casillaId: string;
  existente?: AsistenteExistente;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function onSubmit(formData: FormData) {
    setError(null);
    setFieldErrors({});

    const datos = {
      nombre: formData.get("nombre"),
      apellidoPaterno: formData.get("apellidoPaterno"),
      apellidoMaterno: formData.get("apellidoMaterno"),
      claveElector: formData.get("claveElector"),
      correoElectronico: formData.get("correoElectronico"),
      telefono: formData.get("telefono"),
    };

    startTransition(async () => {
      const resultado = existente
        ? await actualizarAsistente(casillaId, existente.id, datos)
        : await crearAsistente(casillaId, datos);

      if (!resultado.success) {
        setError(resultado.error);
        setFieldErrors(resultado.fieldErrors ?? {});
        return;
      }
      router.push(`/casillas/${casillaId}`);
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      {error && <Alert variant="destructive">{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="nombre">Nombre(s)</Label>
          <Input id="nombre" name="nombre" defaultValue={existente?.nombre} required />
          <FieldError messages={fieldErrors.nombre} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="apellidoPaterno">Apellido paterno</Label>
          <Input
            id="apellidoPaterno"
            name="apellidoPaterno"
            defaultValue={existente?.apellidoPaterno}
            required
          />
          <FieldError messages={fieldErrors.apellidoPaterno} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="apellidoMaterno">Apellido materno</Label>
          <Input
            id="apellidoMaterno"
            name="apellidoMaterno"
            defaultValue={existente?.apellidoMaterno ?? ""}
          />
          <FieldError messages={fieldErrors.apellidoMaterno} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="claveElector">Clave de elector (opcional)</Label>
          <Input id="claveElector" name="claveElector" maxLength={18} />
          {existente && (
            <p className="text-xs text-muted-foreground">
              Por seguridad, vuelve a capturarla si necesitas actualizarla.
            </p>
          )}
          <FieldError messages={fieldErrors.claveElector} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="correoElectronico">Correo electrónico (opcional)</Label>
          <Input
            id="correoElectronico"
            name="correoElectronico"
            type="email"
            defaultValue={existente?.correoElectronico ?? ""}
          />
          <FieldError messages={fieldErrors.correoElectronico} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="telefono">Teléfono (opcional)</Label>
          <Input
            id="telefono"
            name="telefono"
            inputMode="numeric"
            defaultValue={existente?.telefono ?? ""}
          />
          <FieldError messages={fieldErrors.telefono} />
        </div>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Guardando…" : existente ? "Guardar cambios" : "Agregar asistente"}
      </Button>
    </form>
  );
}
