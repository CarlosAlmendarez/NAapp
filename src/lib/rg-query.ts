import "server-only";
import type { Casa } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type RgDeCasilla = {
  nombre: string;
  telefono: string | null;
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
    select: { nombre: true, telefono: true },
  });
  return rg;
}

/**
 * RG (Representante General) por distrito local y por casa, con nombre y
 * teléfono, en bloque — para el listado y el detalle de Casillas, las
 * impresiones y la exportación XLSX: en todas se muestra solo su nombre y
 * su teléfono (nunca su correo, que ahí no le sirve a quien está en campo).
 */
export async function rgConTelefonoPorDistritoYCasa(
  distritos: string[]
): Promise<Map<string, { C26: RgDeCasilla | null; C52: RgDeCasilla | null }>> {
  const mapa = new Map<string, { C26: RgDeCasilla | null; C52: RgDeCasilla | null }>();
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
      telefono: true,
      casa: true,
      localidades: { where: { tipo: "DISTRITO_LOCAL" }, select: { valor: true } },
    },
  });

  for (const rg of rgs) {
    for (const l of rg.localidades) {
      const entry = mapa.get(l.valor);
      if (entry && rg.casa) entry[rg.casa] = { nombre: rg.nombre, telefono: rg.telefono };
    }
  }
  return mapa;
}
