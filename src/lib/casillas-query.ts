import "server-only";
import { Prisma, type Casa } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  filtroCasillasPorRol,
  sinRestriccionGeografica,
  type UsuarioAutenticado,
} from "@/lib/auth-helpers";
import { rgConTelefonoPorDistritoYCasa } from "@/lib/rg-query";

const PAGE_SIZE = 20;

export type FiltrosCasillas = {
  municipio?: string;
  distrito?: string;
  busqueda?: string;
  page?: number;
};

export async function listarCasillas(
  usuario: UsuarioAutenticado,
  casa: Casa,
  filtros: FiltrosCasillas
) {
  const page = Math.max(1, filtros.page ?? 1);

  // Se combinan como cláusulas AND independientes (no reasignar `where.OR`
  // directamente): el filtro de alcance por rol ya puede traer su propio
  // OR (municipio o distrito local asignado), y la búsqueda de texto trae
  // el suyo — pisar uno con el otro reabriría el acceso fuera de alcance.
  const and: Prisma.CasillaWhereInput[] = [filtroCasillasPorRol(usuario)];

  if (filtros.municipio) {
    and.push({ municipio: filtros.municipio });
  }

  if (filtros.distrito) {
    and.push({ distritoLocal: filtros.distrito });
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

  const [total, casillasSinRg] = await Promise.all([
    prisma.casilla.count({ where }),
    prisma.casilla.findMany({
      where,
      orderBy: [{ municipio: "asc" }, { seccion: "asc" }, { tipoCasilla: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        // Los badges "capturado" reflejan solo la casa activa.
        representantes: { select: { tipo: true }, where: { casa } },
      },
    }),
  ]);

  // RG (Representante General) de esta casa, para mostrar en la tarjeta de
  // cada casilla — igual que en su detalle: solo nombre y teléfono.
  const distritos = Array.from(new Set(casillasSinRg.map((c) => c.distritoLocal)));
  const rgs = await rgConTelefonoPorDistritoYCasa(distritos);
  const casillas = casillasSinRg.map((c) => ({
    ...c,
    rg: rgs.get(c.distritoLocal)?.[casa] ?? null,
  }));

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

/**
 * Distritos locales disponibles para el selector de filtro — mismo criterio
 * que `municipiosDisponibles`, pero pensado para roles sin restricción
 * geográfica (Admin general, Admin de casillas): un Capturador o RG ya solo
 * ve su(s) propio(s) distrito(s) asignado(s), así que este filtro no les
 * aporta nada y las páginas que lo usan solo lo muestran a los admins.
 */
export async function distritosDisponibles(usuario: UsuarioAutenticado): Promise<string[]> {
  if (sinRestriccionGeografica(usuario)) {
    const distritos = await prisma.distritoLocal.findMany({ orderBy: { nombre: "asc" } });
    return distritos.map((d) => d.nombre);
  }

  const filas = await prisma.casilla.findMany({
    where: filtroCasillasPorRol(usuario),
    select: { distritoLocal: true },
    distinct: ["distritoLocal"],
  });
  return filas.map((f) => f.distritoLocal).sort((a, b) => a.localeCompare(b));
}

/**
 * Casillas de la casa `casa` (en el alcance del usuario) que aún no
 * tienen RC propietario capturado — pendientes de captura. Devuelve el
 * total y, opcionalmente, la primera después de `despuesDeId` en el orden
 * de captura (municipio → sección → tipo) para encadenar la captura sin
 * volver al listado ("Guardar y siguiente").
 */
export async function casillasPendientesDeRc(
  usuario: UsuarioAutenticado,
  casa: Casa,
  despuesDeId?: string
): Promise<{ total: number; siguienteId: string | null }> {
  const sinPropietario: Prisma.CasillaWhereInput = {
    AND: [
      filtroCasillasPorRol(usuario),
      { representantes: { none: { tipo: "PROPIETARIO", casa } } },
    ],
  };

  const total = await prisma.casilla.count({ where: sinPropietario });

  let refer: { municipio: string; seccion: number; tipoCasilla: string } | null = null;
  if (despuesDeId) {
    refer = await prisma.casilla.findUnique({
      where: { id: despuesDeId },
      select: { municipio: true, seccion: true, tipoCasilla: true },
    });
  }

  const orderBy: Prisma.CasillaOrderByWithRelationInput[] = [
    { municipio: "asc" },
    { seccion: "asc" },
    { tipoCasilla: "asc" },
  ];

  const where: Prisma.CasillaWhereInput = refer
    ? {
        AND: [
          sinPropietario,
          {
            OR: [
              { municipio: { gt: refer.municipio } },
              { municipio: refer.municipio, seccion: { gt: refer.seccion } },
              {
                municipio: refer.municipio,
                seccion: refer.seccion,
                tipoCasilla: { gt: refer.tipoCasilla },
              },
            ],
          },
        ],
      }
    : sinPropietario;

  const siguiente = await prisma.casilla.findFirst({ where, orderBy, select: { id: true } });
  return { total, siguienteId: siguiente?.id ?? null };
}
