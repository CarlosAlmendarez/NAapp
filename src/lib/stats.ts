import "server-only";
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

/** Estadísticas de avance de captura, respetando el alcance del usuario. */
export async function obtenerEstadisticas(usuario: UsuarioAutenticado): Promise<Estadisticas> {
  const filtro = filtroCasillasPorRol(usuario);

  const [totalCasillas, conPropietario, conSuplente, completas, totalAsistentes] =
    await Promise.all([
      prisma.casilla.count({ where: filtro }),
      prisma.representanteCasilla.count({
        where: { tipo: "PROPIETARIO", casilla: filtro },
      }),
      prisma.representanteCasilla.count({
        where: { tipo: "SUPLENTE", casilla: filtro },
      }),
      prisma.casilla.count({
        where: {
          ...filtro,
          AND: [
            { representantes: { some: { tipo: "PROPIETARIO" } } },
            { representantes: { some: { tipo: "SUPLENTE" } } },
          ],
        },
      }),
      prisma.asistenteElectoral.count({ where: { casilla: filtro } }),
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

export type EstadisticaPorMunicipio = {
  municipio: string;
  totalCasillas: number;
  completas: number;
  porcentajeAvance: number;
};

/** Desglose por municipio — usado en la vista de Estadísticas (solo Admin general). */
export async function obtenerEstadisticasPorMunicipio(): Promise<EstadisticaPorMunicipio[]> {
  const casillas = await prisma.casilla.findMany({
    select: {
      municipio: true,
      representantes: { select: { tipo: true } },
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
