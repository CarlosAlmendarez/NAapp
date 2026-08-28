"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { autenticar } from "@/actions/login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

function BotonEntrar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" size="lg" disabled={pending}>
      {pending ? "Entrando…" : "Entrar"}
    </Button>
  );
}

export function LoginForm() {
  const [error, formAction] = useActionState(autenticar, undefined);

  return (
    <form action={formAction} className="space-y-4">
      {error && <Alert variant="destructive">{error}</Alert>}

      <div className="space-y-1.5">
        <Label htmlFor="correo">Correo institucional</Label>
        <Input
          id="correo"
          name="correo"
          type="email"
          autoComplete="username"
          required
          placeholder="nombre@nuevaalianzaslp.mx"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <BotonEntrar />
    </form>
  );
}
