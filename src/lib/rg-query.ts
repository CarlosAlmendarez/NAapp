import "server-only";
import type { Casa } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type RgDeCasilla = {
  nombre: string;
  correo: string;
};

/**
 * Representante General "nominal" de una casilla en una casa dada: el
 * Usuario activo con rol REPRESENTANTE_GENERAL, esa `casa`, y el distrito
 * local de la casilla entre sus localidades asignadas
 * (`UsuarioLocalidad`). Hay a lo sumo uno — lo garantiza la validación de
 * unicidad "un RG por distrito local POR casa" en `actions/usuarios.ts`.
 *
 * Se usa para:
 *  - mostrar a quien captura RC quién es el RG de esa casilla (Cambio 2), y
 *  - decidir si se permite capturar RC suplente (solo si NO hay RG).
 */
export async function obtenerRgDeCasilla(
  distritoLocal: string,
  casa: Casa
): Promise<RgDeCasilla | null> {
  const rg = await prisma.usuario.findFirst({
    where: {
      rol: "REPRESENTANTE_GENERAL",
      activo: true,
      casa,
      localidades: { some: { tipo: "DISTRITO_LOCAL", valor: distritoLocal } },
    },
    select: { nombre: true, correo: true },
  });
  return rg;
}

/**
 * Nombre del RG (Representante General) por distrito local y por casa,
 * en bloque — para las vistas de impresión (rutas y casillas), que
 * necesitan el RG de muchas casillas a la vez sin hacer N+1.
 */
export async function rgPorDistritoYCasa(
  distritos: string[]
): Promise<Map<string, { C26: string | null; C52: string | null }>> {
  const mapa = new Map<string, { C26: string | null; C52: string | null }>();
  for (const d of distritos) mapa.set(d, { C26: null, C52: null });
  if (distritos.length === 0) return mapa;

  const rgs = await prisma.usuario.findMany({
    where: {
      rol: "REPRESENTANTE_GENERAL",
      activo: true,
      casa: { not: null },
      localidades: { some: { tipo: "DISTRITO_LOCAL", valor: { in: distritos } } },
    },
    select: {
      nombre: true,
      casa: true,
      localidades: { where: { tipo: "DISTRITO_LOCAL" }, select: { valor: true } },
    },
  });

  for (const rg of rgs) {
    for (const l of rg.localidades) {
      const entry = mapa.get(l.valor);
      if (entry && rg.casa) entry[rg.casa] = rg.nombre;
    }
  }
  return mapa;
}
