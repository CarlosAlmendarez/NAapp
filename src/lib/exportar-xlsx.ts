import "server-only";
import * as XLSX from "xlsx";
import { Prisma, type Casa } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CASA_NUMERO } from "@/lib/casa";
import { decryptField } from "@/lib/crypto";
import { rgConCorreoPorDistritoYCasa } from "@/lib/rg-query";

/**
 * Recrea el formato exacto del padrón oficial ("SECCIONES Y CASILLAS
 * 2024.xlsx", hoja "sabana.") — dos filas de encabezado (una con
 * "PROPIETARIO"/"SUPLENTE" como super-encabezado fusionado, otra con los
 * nombres de columna) seguidas de una fila por casilla. Ver
 * scripts/importar-secciones-casillas.ts, que originalmente parseó ese
 * mismo layout para sembrar la base de datos — este exportador es su
 * inverso.
 *
 * La "Clave de Elector" se descifra al exportar (AES-256-GCM, ver
 * src/lib/crypto.ts) — igual que ya se hace en los PDFs de impresión — para
 * que el archivo quede completo para quien tiene permiso de exportarlo.
 */
const NOMBRE_HOJA = "sabana.";

function safeDecrypt(cifrado: string | null | undefined): string {
  if (!cifrado) return "";
  try {
    return decryptField(cifrado);
  } catch {
    return "";
  }
}

// Los datos de RC/enlace son por casa (26 / 52): cada exportación trae los
// de UNA casa (la activa) y agrega "CASA" como última columna para dejarlo
// explícito. El orden del resto de columnas se conserva igual que el
// padrón oficial (por eso "CASA" va al final y no al frente). Cada bloque
// de representante (propietario/suplente) trae también el teléfono de
// quien lo propone, junto a "Propone" — igual que en la captura.
const ENCABEZADO_COLUMNAS_BASE = [
  "DISTRITO FEDERAL",
  "DISTRITO LOCAL",
  "MUNICIPIO",
  "SECCIÓN",
  "TIPO CASILLA",
  "MUNICIPIO",
  "DOMICILIO",
  "COLONIA/LOCALIDAD",
  "CÓDIGO POSTAL",
  "UBICACIÓN",
  "Nombre",
  "Apellido Paterno",
  "Apellido Materno",
  "Clave de Elector",
  "Correo Electrónico",
  "Teléfono",
  "Propone",
  "Teléfono de quien propone",
  "Nombre",
  "Apellido Paterno",
  "Apellido Materno",
  "Clave de Elector",
  "Correo Electrónico",
  "Teléfono",
  "Propone",
  "Teléfono de quien propone",
] as const;

// Columna de inicio de cada bloque dentro de ENCABEZADO_COLUMNAS_BASE
// (10 columnas de casilla, luego 8 de propietario, luego 8 de suplente).
const COL_PROPIETARIO = 10;
const COL_SUPLENTE = 18;
const FIN_BASE = ENCABEZADO_COLUMNAS_BASE.length; // 26

// Exportación 1 — "Casillas": además del RC, muestra el RG (Representante
// General) de la casa activa, tal cual aparece en la vista normal de una
// casilla — "Sin RG asignado" cuando no tiene.
const ENCABEZADO_COLUMNAS = [
  ...ENCABEZADO_COLUMNAS_BASE,
  "RG - Nombre",
  "RG - Correo",
  "CASA",
] as const;
const COL_RG = FIN_BASE;

type RepresentanteParaExportar = {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  claveElectorCifrada: string;
  correoElectronico: string | null;
  telefono: string | null;
  propone: string;
  telefonoPropone: string | null;
} | null;

function filaRepresentante(r: RepresentanteParaExportar): (string | number)[] {
  return [
    r?.nombre ?? "",
    r?.apellidoPaterno ?? "",
    r?.apellidoMaterno ?? "",
    safeDecrypt(r?.claveElectorCifrada),
    r?.correoElectronico ?? "",
    r?.telefono ?? "",
    r?.propone ?? "",
    r?.telefonoPropone ?? "",
  ];
}

type CasillaParaExportar = {
  distritoFederal: string | null;
  distritoLocal: string;
  municipio: string;
  seccion: number;
  tipoCasilla: string;
  domicilio: string;
  coloniaLocalidad: string;
  codigoPostal: string | null;
  ubicacion: string;
};

function filaCasillaBase(c: CasillaParaExportar): (string | number)[] {
  return [
    c.distritoFederal ?? "",
    c.distritoLocal,
    c.municipio,
    c.seccion,
    c.tipoCasilla,
    c.municipio, // Columna MUNICIPIO duplicada — así viene en el padrón oficial.
    c.domicilio,
    c.coloniaLocalidad,
    c.codigoPostal ?? "",
    c.ubicacion,
  ];
}

/** Arma el libro y lo serializa a un Buffer .xlsx listo para descargar. */
function construirLibro(
  filaSuperEncabezado: (string | number)[],
  filaEncabezado: readonly (string | number)[],
  filasDeDatos: (string | number)[][],
  fusiones: XLSX.Range[]
): Buffer {
  const hoja = XLSX.utils.aoa_to_sheet([filaSuperEncabezado, [...filaEncabezado], ...filasDeDatos]);
  hoja["!merges"] = fusiones;
  hoja["!cols"] = filaEncabezado.map(() => ({ wch: 16 }));

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, NOMBRE_HOJA);
  return XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/**
 * Exportación 1 — "Casillas": el catálogo (completo para Admin general;
 * acotado al alcance de quien exporta si se pasa `filtro` — ver
 * `filtroCasillasPorRol`) en el mismo formato que el padrón oficial, con
 * el RC propietario/suplente y el RG ya capturados en la app rellenando
 * esas columnas.
 */
export async function construirLibroCasillas(
  casa: Casa,
  filtro: Prisma.CasillaWhereInput = {}
): Promise<Buffer> {
  const casillas = await prisma.casilla.findMany({
    where: filtro,
    orderBy: [{ municipio: "asc" }, { seccion: "asc" }, { tipoCasilla: "asc" }],
    include: { representantes: { where: { casa } } },
  });

  const distritos = Array.from(new Set(casillas.map((c) => c.distritoLocal)));
  const rgs = await rgConCorreoPorDistritoYCasa(distritos);

  const numeroCasa = CASA_NUMERO[casa];
  const filas = casillas.map((c) => {
    const propietario = c.representantes.find((r) => r.tipo === "PROPIETARIO") ?? null;
    const suplente = c.representantes.find((r) => r.tipo === "SUPLENTE") ?? null;
    const rg = rgs.get(c.distritoLocal)?.[casa] ?? null;
    return [
      ...filaCasillaBase(c),
      ...filaRepresentante(propietario),
      ...filaRepresentante(suplente),
      rg?.nombre ?? "Sin RG asignado",
      rg?.correo ?? "",
      numeroCasa,
    ];
  });

  const superEncabezado = new Array(ENCABEZADO_COLUMNAS.length).fill("");
  superEncabezado[COL_PROPIETARIO] = "PROPIETARIO";
  superEncabezado[COL_SUPLENTE] = "SUPLENTE";
  superEncabezado[COL_RG] = "REPRESENTANTE GENERAL (RG)";

  return construirLibro(superEncabezado, ENCABEZADO_COLUMNAS, filas, [
    { s: { r: 0, c: COL_PROPIETARIO }, e: { r: 0, c: COL_SUPLENTE - 1 } },
    { s: { r: 0, c: COL_SUPLENTE }, e: { r: 0, c: FIN_BASE - 1 } },
    { s: { r: 0, c: COL_RG }, e: { r: 0, c: COL_RG + 1 } },
  ]);
}

const ENCABEZADO_COLUMNAS_RUTA = [
  ...ENCABEZADO_COLUMNAS_BASE,
  "RUTA #",
  "ORDEN EN RUTA",
  "Nombre",
  "Apellido Paterno",
  "Apellido Materno",
  "Correo Electrónico",
  "Teléfono",
  "Capturado el",
  "CASA",
] as const;
const COL_RUTA = FIN_BASE;

/**
 * Exportación 2 — "Rutas": el mismo catálogo (completo para Admin general;
 * acotado al alcance de quien exporta si se pasa `filtro` — ver
 * `filtroCasillasPorRol`, así el RG solo obtiene su(s) propio(s)
 * distrito(s)), pero con columnas extra al final identificando a qué ruta
 * (y en qué posición dentro de ella) pertenece cada casilla capturada — y
 * las filas reordenadas para que las casillas de una misma ruta queden
 * pegadas unas con otras (en vez del orden municipio/sección de siempre),
 * así se distinguen las rutas de un vistazo. Las casillas sin enlace
 * capturado quedan al final, con esas columnas en blanco, en el orden
 * normal del catálogo.
 */
export async function construirLibroRutas(
  casa: Casa,
  filtro: Prisma.CasillaWhereInput = {}
): Promise<Buffer> {
  // El RC es por casa (se filtra); el enlace de Rutas es único por casilla
  // (no por casa).
  const casillas = await prisma.casilla.findMany({
    where: filtro,
    orderBy: [{ municipio: "asc" }, { seccion: "asc" }, { tipoCasilla: "asc" }],
    include: { representantes: { where: { casa } }, enlace: true },
  });
  const numeroCasa = CASA_NUMERO[casa];

  const capturadas = casillas.filter((c) => c.enlace !== null);
  const pendientes = casillas.filter((c) => c.enlace === null);

  // Se numeran las rutas en el orden real en que se capturaron (la
  // primera casilla guardada de cada ruta marca su `capturadoEn`).
  const capturadoEnPorRuta = new Map<string, Date>();
  for (const c of capturadas) {
    const rutaId = c.enlace!.rutaId;
    const actual = capturadoEnPorRuta.get(rutaId);
    if (!actual || c.enlace!.capturadoEn < actual) {
      capturadoEnPorRuta.set(rutaId, c.enlace!.capturadoEn);
    }
  }
  const numeroPorRuta = new Map(
    Array.from(capturadoEnPorRuta.entries())
      .sort((a, b) => a[1].getTime() - b[1].getTime())
      .map(([rutaId], indice) => [rutaId, indice + 1])
  );

  capturadas.sort((a, b) => {
    const numA = numeroPorRuta.get(a.enlace!.rutaId)!;
    const numB = numeroPorRuta.get(b.enlace!.rutaId)!;
    return numA !== numB ? numA - numB : a.enlace!.ordenEnRuta - b.enlace!.ordenEnRuta;
  });

  const formateador = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  });

  const filasCapturadas = capturadas.map((c) => {
    const propietario = c.representantes.find((r) => r.tipo === "PROPIETARIO") ?? null;
    const suplente = c.representantes.find((r) => r.tipo === "SUPLENTE") ?? null;
    const enlace = c.enlace!;
    return [
      ...filaCasillaBase(c),
      ...filaRepresentante(propietario),
      ...filaRepresentante(suplente),
      numeroPorRuta.get(enlace.rutaId)!,
      enlace.ordenEnRuta + 1,
      enlace.nombre,
      enlace.apellidoPaterno,
      enlace.apellidoMaterno ?? "",
      enlace.correoElectronico ?? "",
      enlace.telefono,
      formateador.format(enlace.capturadoEn),
      numeroCasa,
    ];
  });

  const filasPendientes = pendientes.map((c) => {
    const propietario = c.representantes.find((r) => r.tipo === "PROPIETARIO") ?? null;
    const suplente = c.representantes.find((r) => r.tipo === "SUPLENTE") ?? null;
    return [
      ...filaCasillaBase(c),
      ...filaRepresentante(propietario),
      ...filaRepresentante(suplente),
      "", // RUTA #
      "", // ORDEN EN RUTA
      "", // Nombre
      "", // Apellido Paterno
      "", // Apellido Materno
      "", // Correo Electrónico
      "", // Teléfono
      "", // Capturado el
      numeroCasa,
    ];
  });

  const superEncabezado = new Array(ENCABEZADO_COLUMNAS_RUTA.length).fill("");
  superEncabezado[COL_PROPIETARIO] = "PROPIETARIO";
  superEncabezado[COL_SUPLENTE] = "SUPLENTE";
  superEncabezado[COL_RUTA] = "RUTA (MÓDULO RUTAS)";

  return construirLibro(
    superEncabezado,
    ENCABEZADO_COLUMNAS_RUTA,
    [...filasCapturadas, ...filasPendientes],
    [
      { s: { r: 0, c: COL_PROPIETARIO }, e: { r: 0, c: COL_SUPLENTE - 1 } },
      { s: { r: 0, c: COL_SUPLENTE }, e: { r: 0, c: FIN_BASE - 1 } },
      { s: { r: 0, c: COL_RUTA }, e: { r: 0, c: COL_RUTA + 7 } },
    ]
  );
}
