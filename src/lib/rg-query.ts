import "server-only";
import { prisma } from "@/lib/prisma";

export type RgDeCasilla = {
  id: string;
  nombre: string;
  telefono: string | null;
};

/**
 * Representante General de un distrito local: el Usuario activo con rol
 * REPRESENTANTE_GENERAL que tiene ese distrito entre sus localidades
 * asignadas (`UsuarioLocalidad`). Independiente de la casa (26/52): en la
 * práctica un mismo RG atiende ambas casas de su distrito con la misma
 * cuenta, y aunque el esquema permite en teoría un RG distinto por casa
 * (`Usuario.casa`, ver actions/usuarios.ts), esta función lo trata como
 * UN solo RG "del distrito" — si hubiera dos (uno por casa), se prefiere
 * el de Casa 26.
 *
 * Se usa para:
 *  - mostrar a quien captura RC quién es el RG de esa casilla, y
 *  - decidir si se permite capturar RC suplente (solo si NO hay RG) —
 *    también sin importar la casa: si el distrito ya tiene RG en
 *    cualquiera de las dos, no se captura suplente en ninguna.
 */
export async function obtenerRgDeCasilla(distritoLocal: string): Promise<RgDeCasilla | null> {
  const candidatos = await prisma.usuario.findMany({
    where: {
      rol: "REPRESENTANTE_GENERAL",
      activo: true,
      localidades: { some: { tipo: "DISTRITO_LOCAL", valor: distritoLocal } },
    },
    select: { id: true, nombre: true, telefono: true, casa: true },
    orderBy: { casa: "asc" },
  });
  return candidatos[0] ?? null;
}

/**
 * RG por distrito local, con nombre y teléfono, en bloque — para el
 * listado y detalle de Casillas, las impresiones y la exportación XLSX: en
 * todas se muestra solo su nombre y su teléfono (nunca su correo). Se
 * mantiene el resultado desglosado por casa (`C26`/`C52`) porque la
 * exportación/impresión de Casillas sí distingue el bloque de RC de cada
 * casa y quiere poder etiquetar cuál RG corresponde a cuál — pero si el
 * distrito solo tiene RG registrado en una de las dos, se refleja también
 * en la otra (mismo RG "sin importar la casa de origen"): un dato
 * capturado del lado del RG debe verse siempre del lado del RC.
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
      id: true,
      nombre: true,
      telefono: true,
      casa: true,
      localidades: { where: { tipo: "DISTRITO_LOCAL" }, select: { valor: true } },
    },
  });

  for (const rg of rgs) {
    for (const l of rg.localidades) {
      const entry = mapa.get(l.valor);
      if (entry && rg.casa) entry[rg.casa] = { id: rg.id, nombre: rg.nombre, telefono: rg.telefono };
    }
  }
  // Un RG registrado en una sola casa también representa a la otra: no hay
  // (todavía) distritos con un RG distinto por casa en la práctica, así
  // que un dato capturado de un lado siempre se refleja del otro.
  for (const entry of mapa.values()) {
    if (!entry.C26 && entry.C52) entry.C26 = entry.C52;
    if (!entry.C52 && entry.C26) entry.C52 = entry.C26;
  }
  return mapa;
}

/**
 * Igual que `rgConTelefonoPorDistritoYCasa`, pero unificado en un solo
 * valor por distrito (sin desglose por casa) — para el módulo de Rutas,
 * donde el enlace/ruta no tiene noción de casa y por lo tanto tampoco debe
 * mostrarla al identificar al RG.
 */
export async function rgUnicoPorDistrito(
  distritos: string[]
): Promise<Map<string, RgDeCasilla | null>> {
  const detallado = await rgConTelefonoPorDistritoYCasa(distritos);
  const mapa = new Map<string, RgDeCasilla | null>();
  for (const [distrito, { C26, C52 }] of detallado) {
    mapa.set(distrito, C26 ?? C52 ?? null);
  }
  return mapa;
}
