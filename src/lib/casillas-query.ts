import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { filtroCasillasPorRol, type UsuarioAutenticado } from "@/lib/auth-helpers";

const PAGE_SIZE = 20;

export type FiltrosCasillas = {
  municipio?: string;
  busqueda?: string;
  page?: number;
};

export async function listarCasillas(usuario: UsuarioAutenticado, filtros: FiltrosCasillas) {
  const page = Math.max(1, filtros.page ?? 1);

  const where: Prisma.CasillaWhereInput = { ...filtroCasillasPorRol(usuario) };

  // El municipio elegido en el filtro debe seguir respetando el alcance
  // del usuario: si es capturador, solo puede filtrar dentro de lo suyo.
  if (filtros.municipio) {
    if (usuario.rol === "CAPTURADOR" && !usuario.localidades.includes(filtros.municipio)) {
      where.municipio = "__ninguna__";
    } else {
      where.municipio = filtros.municipio;
    }
  }

  if (filtros.busqueda) {
    const num = Number(filtros.busqueda);
    where.OR = [
      { coloniaLocalidad: { contains: filtros.busqueda, mode: "insensitive" } },
      { ubicacion: { contains: filtros.busqueda, mode: "insensitive" } },
      { domicilio: { contains: filtros.busqueda, mode: "insensitive" } },
      ...(Number.isFinite(num) && filtros.busqueda.trim() !== "" ? [{ seccion: num }] : []),
    ];
  }

  const [total, casillas] = await Promise.all([
    prisma.casilla.count({ where }),
    prisma.casilla.findMany({
      where,
      orderBy: [{ municipio: "asc" }, { seccion: "asc" }, { tipoCasilla: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        representantes: { select: { tipo: true } },
        _count: { select: { asistentes: true } },
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

/** Municipios disponibles para el selector de filtro, según el alcance del usuario. */
export async function municipiosDisponibles(usuario: UsuarioAutenticado): Promise<string[]> {
  if (usuario.rol === "CAPTURADOR") {
    return [...usuario.localidades].sort((a, b) => a.localeCompare(b));
  }
  const municipios = await prisma.municipio.findMany({ orderBy: { nombre: "asc" } });
  return municipios.map((m) => m.nombre);
}
