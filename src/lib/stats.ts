import "server-only";
import type { Casa } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioAutenticado } from "@/lib/auth-helpers";
import { filtroCasillasPorRol } from "@/lib/auth-helpers";

export type Estadisticas = {
  totalCasillas: number;
  conPropietario: number;
  conSuplente: number;
  completas: number;
  totalAsistentes: number;
  porcentajeAvance: number;
};

/**
 * Estadísticas de avance de captura, respetando el alcance del usuario y
 * acotadas a la casa activa (26 / 52): los RC, suplentes y asistentes se
 * cuentan solo dentro de esa casa; el catálogo de casillas es común.
 */
export async function obtenerEstadisticas(
  usuario: UsuarioAutenticado,
  casa: Casa
): Promise<Estadisticas> {
  const filtro = filtroCasillasPorRol(usuario);

  const [totalCasillas, conPropietario, conSuplente, completas, totalAsistentes] =
    await Promise.all([
      prisma.casilla.count({ where: filtro }),
      prisma.representanteCasilla.count({
        where: { tipo: "PROPIETARIO", casa, casilla: filtro },
      }),
      prisma.representanteCasilla.count({
        where: { tipo: "SUPLENTE", casa, casilla: filtro },
      }),
      prisma.casilla.count({
        where: {
          ...filtro,
          AND: [
            { representantes: { some: { tipo: "PROPIETARIO", casa } } },
            { representantes: { some: { tipo: "SUPLENTE", casa } } },
          ],
        },
      }),
      prisma.asistenteElectoral.count({ where: { casa, casilla: filtro } }),
    ]);

  return {
    totalCasillas,
    conPropietario,
    conSuplente,
    completas,
    totalAsistentes,
    porcentajeAvance: totalCasillas === 0 ? 0 : Math.round((completas / totalCasillas) * 100),
  };
}

export type EstadisticasRuta = {
  totalCasillas: number;
  enlacesCapturados: number;
  porcentajeAvance: number;
};

/**
 * Estadísticas del módulo de Rutas (enlace por casilla), respetando el
 * alcance del usuario — a diferencia de `obtenerEstadisticas`, que cuenta
 * RC propietario/suplente. El Representante General nunca captura RC (ni
 * siquiera lo ve), así que su dashboard debe usar esta función y no la de
 * arriba: mostrarle "0% de avance" contando datos que nunca toca sería
 * confuso y falso. El enlace es único por casilla (no por casa), así que
 * esta cuenta no se acota por casa.
 */
export async function obtenerEstadisticasRuta(
  usuario: UsuarioAutenticado
): Promise<EstadisticasRuta> {
  const filtro = filtroCasillasPorRol(usuario);

  const [totalCasillas, enlacesCapturados] = await Promise.all([
    prisma.casilla.count({ where: filtro }),
    prisma.enlaceCasilla.count({ where: { casilla: filtro } }),
  ]);

  return {
    totalCasillas,
    enlacesCapturados,
    porcentajeAvance:
      totalCasillas === 0 ? 0 : Math.round((enlacesCapturados / totalCasillas) * 100),
  };
}

export type AgruparEstadistica = "municipio" | "distrito";

export type EstadisticaGrupo = {
  grupo: string;
  totalCasillas: number;
  conPropietario: number;
  conSuplente: number;
  rcCompletas: number;
  rcPorcentaje: number;
  enlaces: number;
  rgPorcentaje: number;
};

/**
 * Desglose por municipio o por distrito local (para la casa dada) — vista
 * de Estadísticas (solo Admin general). Incluye avance de RC (propietario
 * + suplente completos) y de RG (enlace de Rutas capturado, que NO es por
 * casa). El orden/filtro se aplican en la página.
 */
export async function obtenerEstadisticasPorGrupo(
  casa: Casa,
  agrupar: AgruparEstadistica
): Promise<EstadisticaGrupo[]> {
  const casillas = await prisma.casilla.findMany({
    select: {
      municipio: true,
      distritoLocal: true,
      representantes: { select: { tipo: true }, where: { casa } },
      enlace: { select: { id: true } },
    },
  });

  type Acc = {
    total: number;
    conPropietario: number;
    conSuplente: number;
    rcCompletas: number;
    enlaces: number;
  };
  const acumulado = new Map<string, Acc>();

  for (const casilla of casillas) {
    const clave = agrupar === "municipio" ? casilla.municipio : casilla.distritoLocal;
    const entry: Acc =
      acumulado.get(clave) ??
      { total: 0, conPropietario: 0, conSuplente: 0, rcCompletas: 0, enlaces: 0 };
    entry.total += 1;
    const tipos = new Set(casilla.representantes.map((r) => r.tipo));
    if (tipos.has("PROPIETARIO")) entry.conPropietario += 1;
    if (tipos.has("SUPLENTE")) entry.conSuplente += 1;
    if (tipos.has("PROPIETARIO") && tipos.has("SUPLENTE")) entry.rcCompletas += 1;
    if (casilla.enlace) entry.enlaces += 1;
    acumulado.set(clave, entry);
  }

  return Array.from(acumulado.entries()).map(([grupo, e]) => ({
    grupo,
    totalCasillas: e.total,
    conPropietario: e.conPropietario,
    conSuplente: e.conSuplente,
    rcCompletas: e.rcCompletas,
    rcPorcentaje: e.total === 0 ? 0 : Math.round((e.rcCompletas / e.total) * 100),
    enlaces: e.enlaces,
    rgPorcentaje: e.total === 0 ? 0 : Math.round((e.enlaces / e.total) * 100),
  }));
}
