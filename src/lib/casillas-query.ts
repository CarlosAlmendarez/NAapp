import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  filtroCasillasPorRol,
  sinRestriccionGeografica,
  type UsuarioAutenticado,
} from "@/lib/auth-helpers";

const PAGE_SIZE = 20;

export type FiltrosCasillas = {
  municipio?: string;
  busqueda?: string;
  page?: number;
};

export async function listarCasillas(usuario: UsuarioAutenticado, filtros: FiltrosCasillas) {
  const page = Math.max(1, filtros.page ?? 1);

  // Se combinan como cláusulas AND independientes (no reasignar `where.OR`
  // directamente): el filtro de alcance por rol ya puede traer su propio
  // OR (municipio o distrito local asignado), y la búsqueda de texto trae
  // el suyo — pisar uno con el otro reabriría el acceso fuera de alcance.
  const and: Prisma.CasillaWhereInput[] = [filtroCasillasPorRol(usuario)];

  if (filtros.municipio) {
    and.push({ municipio: filtros.municipio });
  }

  if (filtros.busqueda) {
    const num = Number(filtros.busqueda);
    and.push({
      OR: [
        { coloniaLocalidad: { contains: filtros.busqueda, mode: "insensitive" } },
        { ubicacion: { contains: filtros.busqueda, mode: "insensitive" } },
        { domicilio: { contains: filtros.busqueda, mode: "insensitive" } },
        ...(Number.isFinite(num) && filtros.busqueda.trim() !== "" ? [{ seccion: num }] : []),
      ],
    });
  }

  const where: Prisma.CasillaWhereInput = { AND: and };

  const [total, casillas] = await Promise.all([
    prisma.casilla.count({ where }),
    prisma.casilla.findMany({
      where,
      orderBy: [{ municipio: "asc" }, { seccion: "asc" }, { tipoCasilla: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        representantes: { select: { tipo: true } },
      },
    }),
  ]);

  return {
    casillas,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/**
 * Municipios disponibles para el selector de filtro, según el alcance del
 * usuario. Para un rol restringido geográficamente (Capturador o
 * Representante General) se derivan consultando qué municipios realmente
 * tienen casillas dentro de su alcance (municipios asignados directamente
 * + municipios con casillas en sus distritos locales asignados) — así
 * funciona igual sin importar si se le asignó acceso por municipio, por
 * distrito, o ambos.
 */
export async function municipiosDisponibles(usuario: UsuarioAutenticado): Promise<string[]> {
  if (sinRestriccionGeografica(usuario)) {
    const municipios = await prisma.municipio.findMany({ orderBy: { nombre: "asc" } });
    return municipios.map((m) => m.nombre);
  }

  const filas = await prisma.casilla.findMany({
    where: filtroCasillasPorRol(usuario),
    select: { municipio: true },
    distinct: ["municipio"],
  });
  return filas.map((f) => f.municipio).sort((a, b) => a.localeCompare(b));
}
