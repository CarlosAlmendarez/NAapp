"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Minus } from "lucide-react";
import {
  buscarCasillasRuta,
  guardarRutaEnlaces,
  quitarCasillaDeRuta,
} from "@/actions/enlaces";
import type { CasillaBusquedaRuta, RcResumenCasilla } from "@/lib/rutas-query";
import { nombreCompleto } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { FieldError } from "@/components/ui/field-error";
import { useToast } from "@/components/ui/toast";
import { formatTipoCasilla, varianteTipoCasilla } from "@/lib/tipo-casilla";

export type ParadaInicial = CasillaBusquedaRuta;

type PersonaExistente = {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  claveElector: string;
  telefono: string;
  correoElectronico: string | null;
};

/**
 * Captura del módulo de Rutas: UNA sola persona (el enlace) cuyos datos se
 * replican a cada casilla de la ruta. `paradasIniciales` arranca la lista
 * ya poblada: una sola casilla al entrar desde /rutas/[casillaId] (ruta
 * nueva), o TODAS las de la ruta al entrar desde /rutas/editar/[rutaId].
 * Con `rutaId` se está editando una ruta existente: sus casillas ya
 * guardadas no se pueden quitar (solo corregir) y se pueden agregar más
 * casillas libres.
 */
export function RutaForm({
  casaLabel,
  rutaId,
  paradasIniciales,
  personaExistente,
}: {
  casaLabel: string;
  rutaId?: string;
  paradasIniciales?: ParadaInicial[];
  personaExistente?: PersonaExistente;
}) {
  const esEdicion = Boolean(rutaId);
  const idsFijos = new Set((paradasIniciales ?? []).map((p) => p.id));
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [nombre, setNombre] = useState(personaExistente?.nombre ?? "");
  const [apellidoPaterno, setApellidoPaterno] = useState(personaExistente?.apellidoPaterno ?? "");
  const [apellidoMaterno, setApellidoMaterno] = useState(personaExistente?.apellidoMaterno ?? "");
  const [claveElector, setClaveElector] = useState(personaExistente?.claveElector ?? "");
  const [telefono, setTelefono] = useState(personaExistente?.telefono ?? "");
  const [correoElectronico, setCorreoElectronico] = useState(
    personaExistente?.correoElectronico ?? ""
  );

  const [paradas, setParadas] = useState<ParadaInicial[]>(paradasIniciales ?? []);

  // Borrador local de los datos del enlace para una ruta NUEVA (no la
  // clave de elector). Evita perder lo tecleado si se cae la señal.
  const claveBorrador = "borrador-ruta:nueva";
  const [hayBorrador, setHayBorrador] = useState(false);
  useEffect(() => {
    if (esEdicion || personaExistente) return;
    try {
      setHayBorrador(Boolean(window.localStorage.getItem(claveBorrador)));
    } catch {
      /* ignore */
    }
  }, [esEdicion, personaExistente]);
  useEffect(() => {
    if (esEdicion || personaExistente) return;
    const datos = { nombre, apellidoPaterno, apellidoMaterno, telefono, correoElectronico };
    try {
      if (Object.values(datos).some(Boolean)) {
        window.localStorage.setItem(claveBorrador, JSON.stringify(datos));
      }
    } catch {
      /* ignore */
    }
  }, [esEdicion, personaExistente, nombre, apellidoPaterno, apellidoMaterno, telefono, correoElectronico]);
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
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.nombre) setNombre(d.nombre);
      if (d.apellidoPaterno) setApellidoPaterno(d.apellidoPaterno);
      if (d.apellidoMaterno) setApellidoMaterno(d.apellidoMaterno);
      if (d.telefono) setTelefono(d.telefono);
      if (d.correoElectronico) setCorreoElectronico(d.correoElectronico);
    } catch {
      /* ignore */
    }
    setHayBorrador(false);
  }

  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<ParadaInicial[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    const termino = busqueda.trim();
    if (termino === "") {
      setResultados([]);
      setBuscando(false);
      return;
    }

    let cancelado = false;
    setBuscando(true);
    const idTimeout = setTimeout(async () => {
      const resultado = await buscarCasillasRuta(termino);
      if (cancelado) return;
      setBuscando(false);
      setResultados(resultado.success ? resultado.data : []);
    }, 300);

    return () => {
      cancelado = true;
      clearTimeout(idTimeout);
    };
  }, [busqueda]);

  function agregarCasilla(casilla: ParadaInicial) {
    setParadas((actuales) =>
      actuales.some((p) => p.id === casilla.id) ? actuales : [...actuales, casilla]
    );
    setBusqueda("");
    setResultados([]);
  }

  function quitarCasilla(id: string) {
    setParadas((actuales) => actuales.filter((p) => p.id !== id));
  }

  // Quita una parada YA guardada de la ruta (borra su enlace en el
  // servidor). Si era la última, la ruta desaparece y se vuelve a /rutas.
  function quitarParadaGuardada(id: string, seccion: number) {
    if (
      !window.confirm(
        `¿Quitar la casilla de la sección ${seccion} de esta ruta? Su enlace se borrará.`
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const resultado = await quitarCasillaDeRuta(id);
      if (!resultado.success) {
        setError(resultado.error);
        return;
      }
      toast("Casilla quitada de la ruta");
      // Si la ruta se quedó sin casillas en la BD, ya no existe.
      if (resultado.data.quedanEnRuta === 0) {
        router.push("/rutas");
      } else {
        setParadas((actuales) => actuales.filter((p) => p.id !== id));
      }
      router.refresh();
    });
  }

  function guardar() {
    setError(null);
    setFieldErrors({});

    if (paradas.length === 0) {
      setError("Agrega al menos una casilla a la ruta.");
      return;
    }

    const datos = {
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      claveElector,
      telefono,
      correoElectronico,
    };

    startTransition(async () => {
      const resultado = await guardarRutaEnlaces(
        datos,
        paradas.map((p) => p.id),
        rutaId
      );
      if (!resultado.success) {
        setError(resultado.error);
        setFieldErrors(resultado.fieldErrors ?? {});
        return;
      }
      limpiarBorrador();
      toast(esEdicion ? "Ruta actualizada" : "Ruta guardada");
      router.push("/rutas");
      router.refresh();
    });
  }

  const idsEnRuta = new Set(paradas.map((p) => p.id));

  return (
    <div className="space-y-6">
      {error && <Alert variant="destructive">{error}</Alert>}

      {hayBorrador && !esEdicion && !personaExistente && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-sm text-warning">
          <span>Tienes un borrador sin guardar de los datos del enlace.</span>
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

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Datos del enlace</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre(s)</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              uppercase
            />
            <FieldError messages={fieldErrors.nombre} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="apellidoPaterno">Apellido paterno</Label>
            <Input
              id="apellidoPaterno"
              value={apellidoPaterno}
              onChange={(e) => setApellidoPaterno(e.target.value)}
              required
              uppercase
            />
            <FieldError messages={fieldErrors.apellidoPaterno} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="apellidoMaterno">Apellido materno</Label>
            <Input
              id="apellidoMaterno"
              value={apellidoMaterno}
              onChange={(e) => setApellidoMaterno(e.target.value)}
              uppercase
            />
            <FieldError messages={fieldErrors.apellidoMaterno} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="claveElector">Clave de elector (INE)</Label>
            <Input
              id="claveElector"
              value={claveElector}
              onChange={(e) => setClaveElector(e.target.value)}
              maxLength={18}
              required
              uppercase
            />
            <FieldError messages={fieldErrors.claveElector} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telefono">Teléfono</Label>
            <Input
              id="telefono"
              telefonoMx
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              required
            />
            <FieldError messages={fieldErrors.telefono} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="correoElectronico">Correo electrónico</Label>
            <Input
              id="correoElectronico"
              type="email"
              value={correoElectronico}
              onChange={(e) => setCorreoElectronico(e.target.value)}
              required
            />
            <FieldError messages={fieldErrors.correoElectronico} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Casillas de esta ruta{paradas.length > 0 && ` (${paradas.length})`}
        </h2>

        {esEdicion && (
          <p className="text-xs text-muted-foreground">
            Estás editando una ruta ya guardada. Puedes corregir los datos del enlace,
            agregar más casillas o quitar una de la ruta con el botón −.
          </p>
        )}

        {paradas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Busca una casilla abajo y agrégala para empezar tu ruta.
          </p>
        ) : (
          <ol className="space-y-2">
            {paradas.map((parada, indice) => {
              // "guardada" = ya existe en la ruta en la BD: al quitarla se
              // borra su enlace (acción en servidor). Las paradas nuevas
              // aún sin guardar solo se quitan de la lista local.
              const guardada = esEdicion && idsFijos.has(parada.id);
              return (
                <li
                  key={parada.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {indice + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">Sección {parada.seccion}</p>
                        <Badge variant={varianteTipoCasilla(parada.tipoCasilla)}>
                          {formatTipoCasilla(parada.tipoCasilla)}
                        </Badge>
                        {guardada && <Badge variant="secondary">En la ruta</Badge>}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {parada.municipio} · {parada.distritoLocal} · {parada.coloniaLocalidad}
                      </p>
                      <RcContexto rc={parada.rc} casaLabel={casaLabel} />
                    </div>
                  </div>
                  {guardada ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Quitar de la ruta la casilla de la sección ${parada.seccion}`}
                      title="Quitar de la ruta"
                      disabled={isPending}
                      onClick={() => quitarParadaGuardada(parada.id, parada.seccion)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      aria-label={`Quitar casilla sección ${parada.seccion}`}
                      onClick={() => quitarCasilla(parada.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        <div className="space-y-2">
          <Label htmlFor="buscar-casilla">
            Agregar casilla (por distrito, sección/nombre o municipio)
          </Label>
          <Input
            id="buscar-casilla"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Ej. 2. SALINAS, SALINAS, o número de sección…"
            autoComplete="off"
          />
          {busqueda.trim() !== "" && (
            <div className="rounded-lg border border-border bg-card">
              {buscando ? (
                <p className="p-3 text-sm text-muted-foreground">Buscando…</p>
              ) : resultados.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">Sin resultados.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {resultados.map((resultado) => {
                    const yaAgregada = idsEnRuta.has(resultado.id);
                    return (
                      <li
                        key={resultado.id}
                        className="flex items-center justify-between gap-3 p-3"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-foreground">
                              Sección {resultado.seccion}
                            </p>
                            <Badge variant={varianteTipoCasilla(resultado.tipoCasilla)}>
                              {formatTipoCasilla(resultado.tipoCasilla)}
                            </Badge>
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {resultado.municipio} · {resultado.distritoLocal} ·{" "}
                            {resultado.coloniaLocalidad}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label={`Agregar casilla sección ${resultado.seccion}`}
                          disabled={yaAgregada}
                          onClick={() => agregarCasilla(resultado)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <Button type="button" onClick={guardar} disabled={isPending || paradas.length === 0}>
        {isPending
          ? "Guardando…"
          : esEdicion
            ? "Guardar cambios de la ruta"
            : "Guardar ruta"}
      </Button>
    </div>
  );
}

/**
 * Contexto para el RG que captura la ruta: quién es el RC (propietario y
 * suplente, ambos si están capturados) de esa casilla en la casa activa —
 * un dato aparte e independiente del RG. Nunca muestra clave de elector.
 */
function RcContexto({ rc, casaLabel }: { rc: RcResumenCasilla; casaLabel: string }) {
  const sinNada = !rc.propietario && !rc.suplente;
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">RC ({casaLabel}): </span>
      {sinNada ? (
        <>Sin representante de casilla capturado</>
      ) : (
        <>
          {rc.propietario ? `Propietario: ${nombreCompleto(rc.propietario)}` : "Sin propietario"}
          {rc.suplente && ` · Suplente: ${nombreCompleto(rc.suplente)}`}
        </>
      )}
    </p>
  );
}
