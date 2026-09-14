import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { filtroCasillasPorRol, type UsuarioAutenticado } from "@/lib/auth-helpers";
import { decryptField } from "@/lib/crypto";
import { rgConTelefonoPorDistritoYCasa, type RgDeCasilla } from "@/lib/rg-query";

/**
 * Datos para la vista de impresión / PDF de Rutas (ver
 * src/app/imprimir/rutas). Agrupa igual que el listado principal
 * (`listarCasillasParaRuta`) — por `rutaId`, ordenado por `capturadoEn` —
 * pero trae la información COMPLETA de cada casilla, el RG asignado a su
 * distrito y el RC propietario/suplente de AMBAS casas (26 y 52). La clave
 * de elector se descifra a propósito: este documento la incluye.
 *
 * Alcance: un RG solo ve sus rutas (mismo `filtroCasillasPorRol` que el
 * resto del módulo); un Admin ve todas, o una sola si se pasa `rutaId`.
 */

export type PersonaImpresion = {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  claveElector: string;
  telefono: string | null;
  correoElectronico: string | null;
};

export type RcImpresion = {
  propietario: (PersonaImpresion & { propone: string; telefonoPropone: string | null }) | null;
  suplente: (PersonaImpresion & { propone: string; telefonoPropone: string | null }) | null;
};

export type CasillaImpresion = {
  id: string;
  orden: number;
  distritoFederal: string | null;
  distritoLocal: string;
  municipio: string;
  seccion: number;
  tipoCasilla: string;
  domicilio: string;
  coloniaLocalidad: string;
  codigoPostal: string | null;
  ubicacion: string;
  /** RG (Representante General) asignado al distrito de la casilla, por casa. */
  rg: { C26: RgDeCasilla | null; C52: RgDeCasilla | null };
  rc: { C26: RcImpresion; C52: RcImpresion };
};

export type RutaImpresion = {
  rutaId: string;
  capturadoEn: Date;
  enlace: PersonaImpresion;
  casillas: CasillaImpresion[];
};

function safeDecrypt(cifrado: string | null | undefined): string {
  if (!cifrado) return "";
  try {
    return decryptField(cifrado);
  } catch {
    return "";
  }
}

type RepRow = {
  casa: "C26" | "C52";
  tipo: "PROPIETARIO" | "SUPLENTE";
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  claveElectorCifrada: string;
  telefono: string | null;
  correoElectronico: string | null;
  propone: string;
  telefonoPropone: string | null;
};

function personaDeRep(
  r: RepRow
): PersonaImpresion & { propone: string; telefonoPropone: string | null } {
  return {
    nombre: r.nombre,
    apellidoPaterno: r.apellidoPaterno,
    apellidoMaterno: r.apellidoMaterno,
    claveElector: safeDecrypt(r.claveElectorCifrada),
    telefono: r.telefono,
    correoElectronico: r.correoElectronico,
    propone: r.propone,
    telefonoPropone: r.telefonoPropone,
  };
}

function rcDeCasa(reps: RepRow[], casa: "C26" | "C52"): RcImpresion {
  const propietario = reps.find((r) => r.casa === casa && r.tipo === "PROPIETARIO");
  const suplente = reps.find((r) => r.casa === casa && r.tipo === "SUPLENTE");
  return {
    propietario: propietario ? personaDeRep(propietario) : null,
    suplente: suplente ? personaDeRep(suplente) : null,
  };
}

export async function listarRutasParaImpresion(
  usuario: UsuarioAutenticado,
  rutaId?: string
): Promise<RutaImpresion[]> {
  const and: Prisma.CasillaWhereInput[] = [
    filtroCasillasPorRol(usuario),
    { enlace: rutaId ? { rutaId } : { isNot: null } },
  ];

  const casillas = await prisma.casilla.findMany({
    where: { AND: and },
    orderBy: [{ municipio: "asc" }, { seccion: "asc" }, { tipoCasilla: "asc" }],
    include: { enlace: true, representantes: true },
  });

  const rgs = await rgConTelefonoPorDistritoYCasa(
    Array.from(new Set(casillas.map((c) => c.distritoLocal)))
  );

  const grupos = new Map<string, typeof casillas>();
  for (const c of casillas) {
    if (!c.enlace) continue;
    const g = grupos.get(c.enlace.rutaId);
    if (g) g.push(c);
    else grupos.set(c.enlace.rutaId, [c]);
  }

  return Array.from(grupos.values())
    .map((grupo) => {
      const e = grupo[0]!.enlace!;
      const ordenadas = grupo
        .slice()
        .sort((a, b) => a.enlace!.ordenEnRuta - b.enlace!.ordenEnRuta);
      return {
        rutaId: e.rutaId,
        capturadoEn: e.capturadoEn,
        enlace: {
          nombre: e.nombre,
          apellidoPaterno: e.apellidoPaterno,
          apellidoMaterno: e.apellidoMaterno,
          claveElector: safeDecrypt(e.claveElectorCifrada),
          telefono: e.telefono,
          correoElectronico: e.correoElectronico,
        },
        casillas: ordenadas.map((c, i) => ({
          id: c.id,
          orden: i + 1,
          distritoFederal: c.distritoFederal,
          distritoLocal: c.distritoLocal,
          municipio: c.municipio,
          seccion: c.seccion,
          tipoCasilla: c.tipoCasilla,
          domicilio: c.domicilio,
          coloniaLocalidad: c.coloniaLocalidad,
          codigoPostal: c.codigoPostal,
          ubicacion: c.ubicacion,
          rg: rgs.get(c.distritoLocal) ?? { C26: null, C52: null },
          rc: {
            C26: rcDeCasa(c.representantes as RepRow[], "C26"),
            C52: rcDeCasa(c.representantes as RepRow[], "C52"),
          },
        })),
      };
    })
    .sort((a, b) => a.capturadoEn.getTime() - b.capturadoEn.getTime());
}
