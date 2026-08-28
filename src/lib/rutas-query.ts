import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { filtroCasillasPorRol, type UsuarioAutenticado } from "@/lib/auth-helpers";

export type CasillaParaRuta = {
  id: string;
  distritoLocal: string;
  municipio: string;
  seccion: number;
  tipoCasilla: string;
  coloniaLocalidad: string;
  enlace: {
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno: string | null;
    telefono: string;
    correoElectronico: string | null;
    capturadoEn: Date;
  } | null;
};

export type FiltrosRuta = {
  municipio?: string;
  busqueda?: string;
};

/**
 * Casillas del módulo de Rutas dentro del alcance del usuario (mismo
 * filtro geográfico que /casillas — para RG, su(s) distrito(s) local(es)
 * asignado(s); para Admin general, sin restricción), separadas en
 * "capturadas" (ordenadas por `capturadoEn` ascendente — el orden real en
 * que se recorrió la ruta, que no se mueve al editar) y "pendientes"
 * (ordenadas por sección, igual que el listado general de casillas).
 */
export async function listarCasillasParaRuta(
  usuario: UsuarioAutenticado,
  filtros: FiltrosRuta
): Promise<{
  capturadas: CasillaParaRuta[];
  pendientes: CasillaParaRuta[];
  total: number;
}> {
  const and: Prisma.CasillaWhereInput[] = [filtroCasillasPorRol(usuario)];

  if (filtros.municipio) {
    and.push({ municipio: filtros.municipio });
  }

  if (filtros.busqueda) {
    const num = Number(filtros.busqueda);
    and.push({
      OR: [
        { coloniaLocalidad: { contains: filtros.busqueda, mode: "insensitive" } },
        ...(Number.isFinite(num) && filtros.busqueda.trim() !== "" ? [{ seccion: num }] : []),
      ],
    });
  }

  const casillas = await prisma.casilla.findMany({
    where: { AND: and },
    orderBy: [{ municipio: "asc" }, { seccion: "asc" }, { tipoCasilla: "asc" }],
    include: { enlace: true },
  });

  const capturadas = casillas
    .filter((c): c is typeof c & { enlace: NonNullable<typeof c.enlace> } => c.enlace !== null)
    .sort((a, b) => a.enlace.capturadoEn.getTime() - b.enlace.capturadoEn.getTime());
  const pendientes = casillas.filter((c) => c.enlace === null);

  return {
    capturadas,
    pendientes,
    total: casillas.length,
  };
}
