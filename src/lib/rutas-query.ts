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

export type CasillaBusquedaRuta = {
  id: string;
  distritoLocal: string;
  municipio: string;
  seccion: number;
  tipoCasilla: string;
  coloniaLocalidad: string;
  ubicacion: string;
  tieneEnlace: boolean;
};

const LIMITE_BUSQUEDA_RUTA = 8;

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

/**
 * Busca casillas dentro del alcance del usuario para encadenarlas a una
 * ruta en captura (ver RutaForm) — por distrito local, municipio, sección
 * o el nombre del inmueble/colonia. A propósito NO excluye las que ya
 * tienen enlace capturado: se puede volver a agregar una casilla ya
 * capturada a una ruta nueva para sobrescribir su enlace (ej. el mismo
 * operador cubre varias casillas contiguas), por eso se marca con
 * `tieneEnlace` en vez de ocultarla.
 */
export async function buscarCasillasParaRuta(
  usuario: UsuarioAutenticado,
  texto: string
): Promise<CasillaBusquedaRuta[]> {
  const termino = texto.trim();
  if (termino === "") return [];

  const and: Prisma.CasillaWhereInput[] = [filtroCasillasPorRol(usuario)];
  const num = Number(termino);
  and.push({
    OR: [
      { distritoLocal: { contains: termino, mode: "insensitive" } },
      { municipio: { contains: termino, mode: "insensitive" } },
      { ubicacion: { contains: termino, mode: "insensitive" } },
      { coloniaLocalidad: { contains: termino, mode: "insensitive" } },
      ...(Number.isFinite(num) ? [{ seccion: num }] : []),
    ],
  });

  const casillas = await prisma.casilla.findMany({
    where: { AND: and },
    orderBy: [{ municipio: "asc" }, { seccion: "asc" }, { tipoCasilla: "asc" }],
    take: LIMITE_BUSQUEDA_RUTA,
    include: { enlace: { select: { id: true } } },
  });

  return casillas.map((c) => ({
    id: c.id,
    distritoLocal: c.distritoLocal,
    municipio: c.municipio,
    seccion: c.seccion,
    tipoCasilla: c.tipoCasilla,
    coloniaLocalidad: c.coloniaLocalidad,
    ubicacion: c.ubicacion,
    tieneEnlace: c.enlace !== null,
  }));
}
