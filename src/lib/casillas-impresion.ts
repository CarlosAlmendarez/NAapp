import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { filtroCasillasPorRol, type UsuarioAutenticado } from "@/lib/auth-helpers";
import { decryptField } from "@/lib/crypto";
import { rgConTelefonoPorDistritoYCasa, type RgDeCasilla } from "@/lib/rg-query";
import type { PersonaImpresion, RcImpresion } from "@/lib/rutas-impresion";

/**
 * Datos para la vista de impresión / PDF de Casillas (ver
 * src/app/imprimir/casillas). Trae la información COMPLETA de cada casilla
 * (hasta el domicilio), el RC propietario/suplente de AMBAS casas (26 y
 * 52) y el RG asignado a su distrito en cada casa. Lo no capturado sale en
 * blanco. La impresión SIEMPRE se acota por municipio o por distrito local
 * (son demasiadas casillas para imprimirlas todas juntas).
 */

export type CasillaImpresionCatalogo = {
  id: string;
  distritoFederal: string | null;
  distritoLocal: string;
  municipio: string;
  seccion: number;
  tipoCasilla: string;
  domicilio: string;
  coloniaLocalidad: string;
  codigoPostal: string | null;
  ubicacion: string;
  rg: { C26: RgDeCasilla | null; C52: RgDeCasilla | null };
  rc: { C26: RcImpresion; C52: RcImpresion };
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

export async function listarCasillasParaImpresion(
  usuario: UsuarioAutenticado,
  filtros: { municipio?: string; distrito?: string }
): Promise<CasillaImpresionCatalogo[]> {
  const and: Prisma.CasillaWhereInput[] = [filtroCasillasPorRol(usuario)];
  if (filtros.municipio) and.push({ municipio: filtros.municipio });
  if (filtros.distrito) and.push({ distritoLocal: filtros.distrito });

  const casillas = await prisma.casilla.findMany({
    where: { AND: and },
    orderBy: [{ distritoLocal: "asc" }, { seccion: "asc" }, { tipoCasilla: "asc" }],
    include: { representantes: true },
  });

  const distritos = Array.from(new Set(casillas.map((c) => c.distritoLocal)));
  const rgs = await rgConTelefonoPorDistritoYCasa(distritos);

  return casillas.map((c) => ({
    id: c.id,
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
  }));
}
