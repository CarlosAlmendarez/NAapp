"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Casa, Rol } from "@prisma/client";
import { crearUsuario, actualizarUsuario } from "@/actions/usuarios";
import { CASAS, CASA_LABEL } from "@/lib/casa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { FieldError } from "@/components/ui/field-error";
import { useToast } from "@/components/ui/toast";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { LocalidadPickerConLabel, type LocalidadAsignada } from "@/components/usuarios/localidad-picker";
import { ROL_OPTIONS } from "@/lib/roles";

type UsuarioExistente = {
  id: string;
  nombre: string;
  correo: string;
  telefono: string | null;
  rol: Rol;
  activo: boolean;
  casa: Casa | null;
  localidades: LocalidadAsignada[];
};

export function UsuarioForm({
  municipios,
  distritosLocales,
  usuario,
}: {
  municipios: string[];
  distritosLocales: string[];
  usuario?: UsuarioExistente;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [rol, setRol] = useState<Rol>(usuario?.rol ?? "CAPTURADOR");
  const [activo, setActivo] = useState(usuario?.activo ?? true);
  const [casa, setCasa] = useState<Casa | "">(usuario?.casa ?? "");
  const [localidades, setLocalidades] = useState<LocalidadAsignada[]>(usuario?.localidades ?? []);

  function onSubmit(formData: FormData) {
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const casaEnviada = rol === "REPRESENTANTE_GENERAL" ? casa || null : null;
      const resultado = usuario
        ? await actualizarUsuario({
            id: usuario.id,
            nombre: formData.get("nombre"),
            correo: formData.get("correo"),
            telefono: formData.get("telefono"),
            rol,
            activo,
            casa: casaEnviada,
            localidades,
          })
        : await crearUsuario({
            nombre: formData.get("nombre"),
            correo: formData.get("correo"),
            telefono: formData.get("telefono"),
            password: formData.get("password"),
            rol,
            casa: casaEnviada,
            localidades,
          });

      if (!resultado.success) {
        setError(resultado.error);
        setFieldErrors(resultado.fieldErrors ?? {});
        return;
      }
      toast(usuario ? "Usuario actualizado" : "Usuario creado");
      router.push("/usuarios");
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      {error && <Alert variant="destructive">{error}</Alert>}

      <div className="space-y-1.5">
        <Label htmlFor="nombre">Nombre completo</Label>
        <Input id="nombre" name="nombre" defaultValue={usuario?.nombre} required uppercase />
        <FieldError messages={fieldErrors.nombre} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="correo">Correo</Label>
        <Input id="correo" name="correo" type="email" defaultValue={usuario?.correo} required />
        <FieldError messages={fieldErrors.correo} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="telefono">
          Teléfono{rol === "REPRESENTANTE_GENERAL" ? "" : " (opcional)"}
        </Label>
        <Input
          id="telefono"
          name="telefono"
          telefonoMx
          required={rol === "REPRESENTANTE_GENERAL"}
          defaultValue={usuario?.telefono ?? ""}
        />
        {rol === "REPRESENTANTE_GENERAL" && (
          <p className="text-xs text-muted-foreground">
            Es lo único que se muestra de contacto junto a su nombre en casillas,
            impresiones y exportaciones — nunca su correo.
          </p>
        )}
        <FieldError messages={fieldErrors.telefono} />
      </div>

      {!usuario && (
        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña temporal</Label>
          <Input id="password" name="password" type="password" required />
          <p className="text-xs text-muted-foreground">
            Mínimo 10 caracteres, con mayúsculas, minúsculas y números. Compártela por un
            canal seguro; el usuario podrá cambiarla al iniciar sesión.
          </p>
          <FieldError messages={fieldErrors.password} />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="rol">Rol</Label>
        <Select value={rol} onValueChange={(v) => setRol(v as Rol)}>
          <SelectTrigger id="rol">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROL_OPTIONS.map((opcion) => (
              <SelectItem key={opcion.value} value={opcion.value}>
                {opcion.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError messages={fieldErrors.rol} />
      </div>

      {rol === "REPRESENTANTE_GENERAL" && (
        <div className="space-y-1.5">
          <Label htmlFor="casa">Casa del RG</Label>
          <Select value={casa} onValueChange={(v) => setCasa(v as Casa)}>
            <SelectTrigger id="casa">
              <SelectValue placeholder="Elige la casa (26 o 52)" />
            </SelectTrigger>
            <SelectContent>
              {CASAS.map((c) => (
                <SelectItem key={c} value={c}>
                  {CASA_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Cada distrito local puede tener un RG por casa. Este RG solo será el
            responsable “nominal” de las casillas de su distrito en esta casa.
          </p>
          <FieldError messages={fieldErrors.casa} />
        </div>
      )}

      {(rol === "CAPTURADOR" || rol === "REPRESENTANTE_GENERAL") && (
        <LocalidadPickerConLabel
          municipios={municipios}
          distritosLocales={distritosLocales}
          seleccionados={localidades}
          onChange={setLocalidades}
        />
      )}
      <FieldError messages={fieldErrors.localidades} />

      {usuario && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={activo} onCheckedChange={(v) => setActivo(Boolean(v))} />
          Cuenta activa (desmarcar desactiva la cuenta y cierra sus sesiones de inmediato)
        </label>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Guardando…" : usuario ? "Guardar cambios" : "Crear usuario"}
      </Button>
    </form>
  );
}
