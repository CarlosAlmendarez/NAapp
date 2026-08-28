"use client";

import { useState, useTransition } from "react";
import { resetearPasswordUsuario } from "@/actions/usuarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { FieldError } from "@/components/ui/field-error";

export function ResetearPasswordForm({ usuarioId }: { usuarioId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [exito, setExito] = useState(false);

  function onSubmit(formData: FormData) {
    setError(null);
    setFieldErrors({});
    setExito(false);
    startTransition(async () => {
      const resultado = await resetearPasswordUsuario({
        id: usuarioId,
        passwordNueva: formData.get("passwordNueva"),
      });
      if (!resultado.success) {
        setError(resultado.error);
        setFieldErrors(resultado.fieldErrors ?? {});
        return;
      }
      setExito(true);
    });
  }

  return (
    <form action={onSubmit} className="space-y-3">
      {error && <Alert variant="destructive">{error}</Alert>}
      {exito && (
        <Alert variant="success">
          Contraseña restablecida. Comunícala al usuario por un canal seguro.
        </Alert>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="passwordNueva">Nueva contraseña temporal</Label>
        <Input id="passwordNueva" name="passwordNueva" type="password" required />
        <FieldError messages={fieldErrors.passwordNueva} />
      </div>
      <Button type="submit" variant="secondary" disabled={isPending}>
        {isPending ? "Restableciendo…" : "Restablecer contraseña"}
      </Button>
    </form>
  );
}
