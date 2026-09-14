import "server-only";
import { Prisma, type Casa } from "@prisma/client";
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

type PersonaNombre = {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
};

/**
 * Contexto que se muestra a quien captura una ruta (RG): quién es el RC
 * de esa casilla en la casa activa. El suplente solo se incluye si la
 * casilla NO tiene RG asignado en esa casa. NUNCA lleva clave de elector.
 */
export type RcResumenCasilla = {
  propietario: PersonaNombre | null;
  suplente: PersonaNombre | null;
  rgNombre: string | null;
};

export type CasillaBusquedaRuta = {
  id: string;
  distritoLocal: string;
  municipio: string;
  seccion: number;
  tipoCasilla: string;
  coloniaLocalidad: string;
  ubicacion: string;
  rc: RcResumenCasilla;
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

function soloNombre(p: PersonaNombre): PersonaNombre {
  return {
    nombre: p.nombre,
    apellidoPaterno: p.apellidoPaterno,
    apellidoMaterno: p.apellidoMaterno,
  };
}

/**
 * Para un conjunto de casillas, arma el resumen de RC (propietario /
 * suplente) y del RG de cada una en la casa dada. El suplente se omite
 * cuando la casilla tiene RG (regla de captura: el suplente solo se usa
 * si no hay RG). Se consulta en bloque para no hacer N+1 desde la UI.
 */
export async function obtenerResumenRcDeCasillas(
  casillas: { id: string; distritoLocal: string }[],
  casa: Casa
): Promise<Map<string, RcResumenCasilla>> {
  const resultado = new Map<string, RcResumenCasilla>();
  if (casillas.length === 0) return resultado;

  const casillaIds = casillas.map((c) => c.id);
  const distritos = Array.from(new Set(casillas.map((c) => c.distritoLocal)));

  const [representantes, rgs] = await Promise.all([
    prisma.representanteCasilla.findMany({
      where: { casillaId: { in: casillaIds }, casa },
      select: {
        casillaId: true,
        tipo: true,
        nombre: true,
        apellidoPaterno: true,
        apellidoMaterno: true,
      },
    }),
    // El RG es del distrito, sin importar la casa (ver rg-query.ts):
    // si el distrito ya tiene RG en cualquiera de las dos casas, la regla
    // de "sin suplente" y el aviso informativo aplican igual.
    prisma.usuario.findMany({
      where: {
        rol: "REPRESENTANTE_GENERAL",
        activo: true,
        localidades: { some: { tipo: "DISTRITO_LOCAL", valor: { in: distritos } } },
      },
      select: {
        nombre: true,
        localidades: { where: { tipo: "DISTRITO_LOCAL" }, select: { valor: true } },
      },
    }),
  ]);

  const rgPorDistrito = new Map<string, string>();
  for (const rg of rgs) {
    for (const l of rg.localidades) {
      if (distritos.includes(l.valor)) rgPorDistrito.set(l.valor, rg.nombre);
    }
  }

  for (const casilla of casillas) {
    const propios = representantes.filter((r) => r.casillaId === casilla.id);
    const rgNombre = rgPorDistrito.get(casilla.distritoLocal) ?? null;
    const propietario = propios.find((r) => r.tipo === "PROPIETARIO");
    const suplente = propios.find((r) => r.tipo === "SUPLENTE");
    resultado.set(casilla.id, {
      propietario: propietario ? soloNombre(propietario) : null,
      // El suplente solo se muestra si la casilla no tiene RG en esta casa.
      suplente: !rgNombre && suplente ? soloNombre(suplente) : null,
      rgNombre,
    });
  }

  return resultado;
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
 * general de casillas. El módulo de Rutas NO se acota por casa: el
 * enlace/RG es único por casilla y compartido entre Casa 26 y Casa 52.
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
 * o el nombre del inmueble/colonia. EXCLUYE las casillas que ya tienen
 * enlace capturado: el enlace/RG es único por casilla y no se recaptura
 * (para corregirlo se usa "Editar ruta"). Cada resultado incluye el
 * resumen de RC/RG de esa casilla en la casa activa (contexto para el RG;
 * el RC sí es por casa).
 */
export async function buscarCasillasParaRuta(
  usuario: UsuarioAutenticado,
  casa: Casa,
  texto: string
): Promise<CasillaBusquedaRuta[]> {
  const termino = texto.trim();
  if (termino === "") return [];

  const and: Prisma.CasillaWhereInput[] = [
    filtroCasillasPorRol(usuario),
    // Solo casillas SIN enlace: no se puede tener dos ni recapturar.
    { enlace: { is: null } },
  ];
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
  });

  const resumenRc = await obtenerResumenRcDeCasillas(
    casillas.map((c) => ({ id: c.id, distritoLocal: c.distritoLocal })),
    casa
  );

  return casillas.map((c) => ({
    id: c.id,
    distritoLocal: c.distritoLocal,
    municipio: c.municipio,
    seccion: c.seccion,
    tipoCasilla: c.tipoCasilla,
    coloniaLocalidad: c.coloniaLocalidad,
    ubicacion: c.ubicacion,
    rc: resumenRc.get(c.id) ?? { propietario: null, suplente: null, rgNombre: null },
  }));
}
