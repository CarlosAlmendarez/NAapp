"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cambiarMiPassword } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { FieldError } from "@/components/ui/field-error";

export function CambiarPasswordForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [exito, setExito] = useState(false);

  function onSubmit(formData: FormData) {
    setError(null);
    setFieldErrors({});
    setExito(false);
    const datos = {
      passwordActual: formData.get("passwordActual"),
      passwordNueva: formData.get("passwordNueva"),
      confirmarPassword: formData.get("confirmarPassword"),
    };
    startTransition(async () => {
      const resultado = await cambiarMiPassword(datos);
      if (!resultado.success) {
        setError(resultado.error);
        setFieldErrors(resultado.fieldErrors ?? {});
        return;
      }
      setExito(true);
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      {error && <Alert variant="destructive">{error}</Alert>}
      {exito && (
        <Alert variant="success">
          Contraseña actualizada. Tus demás sesiones activas fueron cerradas.
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="passwordActual">Contraseña actual</Label>
        <Input id="passwordActual" name="passwordActual" type="password" required />
        <FieldError messages={fieldErrors.passwordActual} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="passwordNueva">Contraseña nueva</Label>
        <Input id="passwordNueva" name="passwordNueva" type="password" required />
        <p className="text-xs text-muted-foreground">
          Mínimo 10 caracteres, con mayúsculas, minúsculas y números.
        </p>
        <FieldError messages={fieldErrors.passwordNueva} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmarPassword">Confirmar contraseña nueva</Label>
        <Input id="confirmarPassword" name="confirmarPassword" type="password" required />
        <FieldError messages={fieldErrors.confirmarPassword} />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Guardando…" : "Cambiar contraseña"}
      </Button>
    </form>
  );
}
