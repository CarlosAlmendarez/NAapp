"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarRepresentante } from "@/actions/representantes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { FieldError } from "@/components/ui/field-error";

type RepresentanteExistente = {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  correoElectronico: string | null;
  telefono: string | null;
  propone: string;
};

export function RepresentanteForm({
  casillaId,
  tipo,
  existente,
}: {
  casillaId: string;
  tipo: "PROPIETARIO" | "SUPLENTE";
  existente?: RepresentanteExistente;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function onSubmit(formData: FormData) {
    setError(null);
    setFieldErrors({});

    const datos = {
      tipo,
      nombre: formData.get("nombre"),
      apellidoPaterno: formData.get("apellidoPaterno"),
      apellidoMaterno: formData.get("apellidoMaterno"),
      claveElector: formData.get("claveElector"),
      correoElectronico: formData.get("correoElectronico"),
      telefono: formData.get("telefono"),
      propone: formData.get("propone"),
    };

    startTransition(async () => {
      const resultado = await guardarRepresentante(casillaId, datos);
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
          <Label htmlFor="claveElector">Clave de elector</Label>
          <Input id="claveElector" name="claveElector" maxLength={18} required />
          {existente && (
            <p className="text-xs text-muted-foreground">
              Por seguridad, vuelve a capturarla para confirmarla.
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
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="propone">Propone (partido/coalición)</Label>
          <Input id="propone" name="propone" defaultValue={existente?.propone} required />
          <FieldError messages={fieldErrors.propone} />
        </div>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Guardando…" : "Guardar representante"}
      </Button>
    </form>
  );
}
