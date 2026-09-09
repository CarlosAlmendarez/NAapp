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
 * alcance del usuario y la casa activa — a diferencia de
 * `obtenerEstadisticas`, que cuenta RC propietario/suplente. El
 * Representante General nunca captura RC (ni siquiera lo ve), así que su
 * dashboard debe usar esta función y no la de arriba: mostrarle "0% de
 * avance" contando datos que nunca toca sería confuso y falso.
 */
export async function obtenerEstadisticasRuta(
  usuario: UsuarioAutenticado,
  casa: Casa
): Promise<EstadisticasRuta> {
  const filtro = filtroCasillasPorRol(usuario);

  const [totalCasillas, enlacesCapturados] = await Promise.all([
    prisma.casilla.count({ where: filtro }),
    prisma.enlaceCasilla.count({ where: { casa, casilla: filtro } }),
  ]);

  return {
    totalCasillas,
    enlacesCapturados,
    porcentajeAvance:
      totalCasillas === 0 ? 0 : Math.round((enlacesCapturados / totalCasillas) * 100),
  };
}

export type EstadisticaPorMunicipio = {
  municipio: string;
  totalCasillas: number;
  completas: number;
  porcentajeAvance: number;
};

/** Desglose por municipio (para la casa dada) — vista de Estadísticas (solo Admin general). */
export async function obtenerEstadisticasPorMunicipio(
  casa: Casa
): Promise<EstadisticaPorMunicipio[]> {
  const casillas = await prisma.casilla.findMany({
    select: {
      municipio: true,
      representantes: { select: { tipo: true }, where: { casa } },
    },
  });

  const acumulado = new Map<string, { total: number; completas: number }>();
  for (const casilla of casillas) {
    const entry = acumulado.get(casilla.municipio) ?? { total: 0, completas: 0 };
    entry.total += 1;
    const tiposCapturados = new Set(casilla.representantes.map((r) => r.tipo));
    if (tiposCapturados.has("PROPIETARIO") && tiposCapturados.has("SUPLENTE")) {
      entry.completas += 1;
    }
    acumulado.set(casilla.municipio, entry);
  }

  return Array.from(acumulado.entries())
    .map(([municipio, { total, completas }]) => ({
      municipio,
      totalCasillas: total,
      completas,
      porcentajeAvance: total === 0 ? 0 : Math.round((completas / total) * 100),
    }))
    .sort((a, b) => a.municipio.localeCompare(b.municipio));
}
