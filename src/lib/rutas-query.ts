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
};

/**
 * Una ruta capturada: todas las casillas guardadas juntas en una misma
 * llamada a guardarRutaEnlaces (mismo `rutaId`) comparten los datos de UNA
 * persona (el enlace) — por eso el nombre/teléfono/etc. vive una sola vez
 * a nivel de la ruta, y no repetido por casilla como antes.
 */
export type RutaCapturada = {
  rutaId: string;
  capturadoEn: Date;
  enlace: {
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno: string | null;
    telefono: string;
    correoElectronico: string | null;
  };
  /** En el orden en que se agregaron al formulario (ver `ordenEnRuta`). */
  casillas: CasillaParaRuta[];
};

export type FiltrosRuta = {
  municipio?: string;
  distrito?: string;
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

function casillaBase(c: {
  id: string;
  distritoLocal: string;
  municipio: string;
  seccion: number;
  tipoCasilla: string;
  coloniaLocalidad: string;
}): CasillaParaRuta {
  return {
    id: c.id,
    distritoLocal: c.distritoLocal,
    municipio: c.municipio,
    seccion: c.seccion,
    tipoCasilla: c.tipoCasilla,
    coloniaLocalidad: c.coloniaLocalidad,
  };
}

/**
 * Casillas del módulo de Rutas dentro del alcance del usuario (mismo
 * filtro geográfico que /casillas — para RG, su(s) distrito(s) local(es)
 * asignado(s); para Admin general, sin restricción). Las capturadas se
 * agrupan por `rutaId` — cada grupo es una ruta distinta, tal como se
 * guardó desde RutaForm — y esos grupos se ordenan por `capturadoEn`
 * ascendente (el orden real en que se recorrió cada ruta, que no se mueve
 * al editar); dentro de cada ruta, las casillas van en `ordenEnRuta`. Las
 * "pendientes" van aparte, ordenadas por sección, igual que el listado
 * general de casillas.
 */
export async function listarCasillasParaRuta(
  usuario: UsuarioAutenticado,
  filtros: FiltrosRuta
): Promise<{
  rutas: RutaCapturada[];
  pendientes: CasillaParaRuta[];
  totalCapturadas: number;
  total: number;
}> {
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
        ...(Number.isFinite(num) && filtros.busqueda.trim() !== "" ? [{ seccion: num }] : []),
      ],
    });
  }

  const casillas = await prisma.casilla.findMany({
    where: { AND: and },
    orderBy: [{ municipio: "asc" }, { seccion: "asc" }, { tipoCasilla: "asc" }],
    include: { enlace: true },
  });

  const pendientes = casillas.filter((c) => c.enlace === null).map(casillaBase);

  const capturadas = casillas.filter(
    (c): c is typeof c & { enlace: NonNullable<typeof c.enlace> } => c.enlace !== null
  );

  const gruposPorRuta = new Map<string, typeof capturadas>();
  for (const casilla of capturadas) {
    const grupo = gruposPorRuta.get(casilla.enlace.rutaId);
    if (grupo) grupo.push(casilla);
    else gruposPorRuta.set(casilla.enlace.rutaId, [casilla]);
  }

  const rutas: RutaCapturada[] = Array.from(gruposPorRuta.values())
    .map((grupo) => {
      const { nombre, apellidoPaterno, apellidoMaterno, telefono, correoElectronico, capturadoEn, rutaId } =
        grupo[0]!.enlace;
      return {
        rutaId,
        capturadoEn,
        enlace: { nombre, apellidoPaterno, apellidoMaterno, telefono, correoElectronico },
        casillas: grupo
          .slice()
          .sort((a, b) => a.enlace.ordenEnRuta - b.enlace.ordenEnRuta)
          .map((c) => casillaBase(c)),
      };
    })
    .sort((a, b) => a.capturadoEn.getTime() - b.capturadoEn.getTime());

  return {
    rutas,
    pendientes,
    totalCapturadas: capturadas.length,
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
