"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarRepresentante } from "@/actions/representantes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { FieldError } from "@/components/ui/field-error";
import { useToast } from "@/components/ui/toast";

type RepresentanteExistente = {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  claveElector: string;
  correoElectronico: string | null;
  telefono: string | null;
  propone: string;
  telefonoPropone: string | null;
};

// Campos del borrador local (nunca la clave de elector).
const CAMPOS_BORRADOR = [
  "nombre",
  "apellidoPaterno",
  "apellidoMaterno",
  "correoElectronico",
  "telefono",
  "propone",
  "telefonoPropone",
] as const;

export function RepresentanteForm({
  casillaId,
  tipo,
  casaLabel,
  existente,
  siguientePendienteId = null,
}: {
  casillaId: string;
  tipo: "PROPIETARIO" | "SUPLENTE";
  casaLabel: string;
  existente?: RepresentanteExistente;
  siguientePendienteId?: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const formRef = useRef<HTMLFormElement>(null);
  const claveBorrador = `borrador-rc:${casillaId}:${tipo}:${casaLabel}`;
  const [hayBorrador, setHayBorrador] = useState(false);

  // Al montar: si es alta (sin `existente`) y hay un borrador guardado,
  // ofrecer recuperarlo.
  useEffect(() => {
    if (existente) return;
    try {
      setHayBorrador(Boolean(window.localStorage.getItem(claveBorrador)));
    } catch {
      /* localStorage no disponible */
    }
  }, [existente, claveBorrador]);

  function guardarBorrador() {
    if (existente || !formRef.current) return;
    try {
      const fd = new FormData(formRef.current);
      const datos: Record<string, string> = {};
      for (const c of CAMPOS_BORRADOR) {
        const v = fd.get(c);
        if (typeof v === "string" && v) datos[c] = v;
      }
      if (Object.keys(datos).length > 0) {
        window.localStorage.setItem(claveBorrador, JSON.stringify(datos));
        setHayBorrador(true);
      }
    } catch {
      /* ignore */
    }
  }

  function limpiarBorrador() {
    try {
      window.localStorage.removeItem(claveBorrador);
    } catch {
      /* ignore */
    }
    setHayBorrador(false);
  }

  function recuperarBorrador() {
    try {
      const raw = window.localStorage.getItem(claveBorrador);
      if (!raw || !formRef.current) return;
      const datos = JSON.parse(raw) as Record<string, string>;
      for (const c of CAMPOS_BORRADOR) {
        const el = formRef.current.elements.namedItem(c) as HTMLInputElement | null;
        if (el && datos[c] != null) el.value = datos[c];
      }
    } catch {
      /* ignore */
    }
    setHayBorrador(false);
  }

  function enviar(destino: "detalle" | "suplente" | "siguiente") {
    setError(null);
    setFieldErrors({});
    if (!formRef.current) return;

    const fd = new FormData(formRef.current);
    const datos = {
      tipo,
      nombre: fd.get("nombre"),
      apellidoPaterno: fd.get("apellidoPaterno"),
      apellidoMaterno: fd.get("apellidoMaterno"),
      claveElector: fd.get("claveElector"),
      correoElectronico: fd.get("correoElectronico"),
      telefono: fd.get("telefono"),
      propone: fd.get("propone"),
      telefonoPropone: fd.get("telefonoPropone"),
    };

    startTransition(async () => {
      const resultado = await guardarRepresentante(casillaId, datos);
      if (!resultado.success) {
        setError(resultado.error);
        setFieldErrors(resultado.fieldErrors ?? {});
        return;
      }
      limpiarBorrador();
      toast(`RC ${tipo === "PROPIETARIO" ? "propietario" : "suplente"} guardado`);
      if (destino === "suplente") {
        router.push(`/casillas/${casillaId}/representante/suplente`);
      } else if (destino === "siguiente" && siguientePendienteId) {
        router.push(`/casillas/${siguientePendienteId}/representante/propietario`);
      } else {
        router.push(`/casillas/${casillaId}`);
      }
      router.refresh();
    });
  }

  const err = (campo: string) =>
    fieldErrors[campo]?.length
      ? { "aria-invalid": true as const, "aria-describedby": `err-${campo}` }
      : {};

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        enviar("detalle");
      }}
      onChange={guardarBorrador}
      className="space-y-4"
    >
      {error && <Alert variant="destructive">{error}</Alert>}

      {hayBorrador && !existente && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-sm text-warning">
          <span>Tienes un borrador sin guardar de esta captura.</span>
          <span className="flex gap-2">
            <button
              type="button"
              onClick={recuperarBorrador}
              className="font-medium underline underline-offset-2"
            >
              Recuperar
            </button>
            <button
              type="button"
              onClick={limpiarBorrador}
              className="opacity-80 underline underline-offset-2"
            >
              Descartar
            </button>
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="nombre">Nombre(s)</Label>
          <Input
            id="nombre"
            name="nombre"
            defaultValue={existente?.nombre}
            required
            uppercase
            {...err("nombre")}
          />
          <FieldError id="err-nombre" messages={fieldErrors.nombre} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="apellidoPaterno">Apellido paterno</Label>
          <Input
            id="apellidoPaterno"
            name="apellidoPaterno"
            defaultValue={existente?.apellidoPaterno}
            required
            uppercase
            {...err("apellidoPaterno")}
          />
          <FieldError id="err-apellidoPaterno" messages={fieldErrors.apellidoPaterno} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="apellidoMaterno">Apellido materno</Label>
          <Input
            id="apellidoMaterno"
            name="apellidoMaterno"
            defaultValue={existente?.apellidoMaterno ?? ""}
            uppercase
            {...err("apellidoMaterno")}
          />
          <FieldError id="err-apellidoMaterno" messages={fieldErrors.apellidoMaterno} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="claveElector">Clave de elector</Label>
          <Input
            id="claveElector"
            name="claveElector"
            maxLength={18}
            required
            uppercase
            defaultValue={existente?.claveElector ?? ""}
            {...err("claveElector")}
          />
          <FieldError id="err-claveElector" messages={fieldErrors.claveElector} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="correoElectronico">Correo electrónico</Label>
          <Input
            id="correoElectronico"
            name="correoElectronico"
            type="email"
            defaultValue={existente?.correoElectronico ?? ""}
            required
            {...err("correoElectronico")}
          />
          <FieldError id="err-correoElectronico" messages={fieldErrors.correoElectronico} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="telefono">Teléfono</Label>
          <Input
            id="telefono"
            name="telefono"
            telefonoMx
            required
            defaultValue={existente?.telefono ?? ""}
            {...err("telefono")}
          />
          <FieldError id="err-telefono" messages={fieldErrors.telefono} />
        </div>
        <div className="space-y-1.5">
          {/* min-h en sm+: la etiqueta de "Propone" se parte en dos líneas y
              sin esto el input de al lado (una sola línea) quedaba más
              arriba, disparejo. Reserva la misma altura en ambas etiquetas
              solo cuando están lado a lado (2 columnas); en móvil, donde se
              apilan en una sola columna, no hace falta. */}
          <Label htmlFor="propone" className="sm:flex sm:min-h-[2.25rem] sm:items-end">
            ¿Quién propone / recomienda? (partido/coalición) ({casaLabel})
          </Label>
          <Input
            id="propone"
            name="propone"
            defaultValue={existente?.propone}
            required
            uppercase
            {...err("propone")}
          />
          <FieldError id="err-propone" messages={fieldErrors.propone} />
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor="telefonoPropone"
            className="sm:flex sm:min-h-[2.25rem] sm:items-end"
          >
            Teléfono de quién propone
          </Label>
          <Input
            id="telefonoPropone"
            name="telefonoPropone"
            telefonoMx
            required
            defaultValue={existente?.telefonoPropone ?? ""}
            {...err("telefonoPropone")}
          />
          <FieldError id="err-telefonoPropone" messages={fieldErrors.telefonoPropone} />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando…" : "Guardar representante"}
        </Button>
        {tipo === "PROPIETARIO" && (
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={() => enviar("suplente")}
          >
            Guardar y capturar suplente
          </Button>
        )}
        {siguientePendienteId && (
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={() => enviar("siguiente")}
          >
            Guardar y siguiente pendiente
          </Button>
        )}
      </div>
    </form>
  );
}
