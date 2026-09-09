"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { buscarCasillasRuta, guardarRutaEnlaces } from "@/actions/enlaces";
import type { CasillaBusquedaRuta, RcResumenCasilla } from "@/lib/rutas-query";
import { nombreCompleto } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { FieldError } from "@/components/ui/field-error";
import { formatTipoCasilla, varianteTipoCasilla } from "@/lib/tipo-casilla";

export type ParadaInicial = CasillaBusquedaRuta;

type PersonaExistente = {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  telefono: string;
  correoElectronico: string | null;
};

/**
 * Captura del módulo de Rutas: UNA sola persona (el enlace) cuyos datos se
 * van replicando hacia abajo a cada casilla que el RG agrega a su ruta con
 * el buscador de abajo — en vez de un formulario por casilla, se guardan
 * todas juntas al final con "Guardar ruta". Si `paradaInicial` viene dada
 * (al entrar desde /rutas/[casillaId]) esa casilla arranca ya en la lista,
 * para poder editarla sola o seguir encadenando más desde ahí.
 */
export function RutaForm({
  casaLabel,
  paradaInicial,
  personaExistente,
}: {
  casaLabel: string;
  paradaInicial?: ParadaInicial;
  personaExistente?: PersonaExistente;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [nombre, setNombre] = useState(personaExistente?.nombre ?? "");
  const [apellidoPaterno, setApellidoPaterno] = useState(personaExistente?.apellidoPaterno ?? "");
  const [apellidoMaterno, setApellidoMaterno] = useState(personaExistente?.apellidoMaterno ?? "");
  const [claveElector, setClaveElector] = useState("");
  const [telefono, setTelefono] = useState(personaExistente?.telefono ?? "");
  const [correoElectronico, setCorreoElectronico] = useState(
    personaExistente?.correoElectronico ?? ""
  );

  const [paradas, setParadas] = useState<ParadaInicial[]>(
    paradaInicial ? [paradaInicial] : []
  );

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
        paradas.map((p) => p.id)
      );
      if (!resultado.success) {
        setError(resultado.error);
        setFieldErrors(resultado.fieldErrors ?? {});
        return;
      }
      router.push("/rutas");
      router.refresh();
    });
  }

  const idsEnRuta = new Set(paradas.map((p) => p.id));

  return (
    <div className="space-y-6">
      {error && <Alert variant="destructive">{error}</Alert>}

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
            {personaExistente && (
              <p className="text-xs text-muted-foreground">
                Por seguridad, vuelve a capturarla para confirmarla.
              </p>
            )}
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
            <Label htmlFor="correoElectronico">Correo electrónico (opcional)</Label>
            <Input
              id="correoElectronico"
              type="email"
              value={correoElectronico}
              onChange={(e) => setCorreoElectronico(e.target.value)}
            />
            <FieldError messages={fieldErrors.correoElectronico} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Casillas de esta ruta{paradas.length > 0 && ` (${paradas.length})`}
        </h2>

        {paradas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Busca una casilla abajo y agrégala para empezar tu ruta.
          </p>
        ) : (
          <ol className="space-y-2">
            {paradas.map((parada, indice) => (
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
                      {parada.tieneEnlace && <Badge variant="success">Ya capturada</Badge>}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {parada.municipio} · {parada.distritoLocal} · {parada.coloniaLocalidad}
                    </p>
                    <RcContexto rc={parada.rc} casaLabel={casaLabel} />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Quitar casilla sección ${parada.seccion}`}
                  onClick={() => quitarCasilla(parada.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
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
                            {resultado.tieneEnlace && (
                              <Badge variant="success">Ya capturada</Badge>
                            )}
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
        {isPending ? "Guardando…" : "Guardar ruta"}
      </Button>
    </div>
  );
}

/**
 * Contexto para el RG que captura la ruta: quién es el RC de esa casilla
 * en la casa activa. El suplente solo llega aquí si la casilla no tiene
 * RG (lo resuelve rutas-query). Nunca muestra clave de elector.
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
      {rc.rgNombre && ` · RG: ${rc.rgNombre}`}
    </p>
  );
}
