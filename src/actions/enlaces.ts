"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  requireUserOrThrow,
  requireRole,
  requireLocalidadAccess,
} from "@/lib/auth-helpers";
import { obtenerCasaActiva } from "@/lib/casa-server";
import { enlaceCasillaSchema } from "@/lib/validations/persona";
import {
  buscarCasillasParaRuta,
  type CasillaBusquedaRuta,
} from "@/lib/rutas-query";
import { encryptField } from "@/lib/crypto";
import { registrarAuditoria } from "@/lib/audit";
import { ejecutarAccion, AccionError, type ActionResult } from "@/lib/action-result";

const ROLES_MODULO_RUTAS = ["ADMIN_GENERAL", "REPRESENTANTE_GENERAL"] as const;

/**
 * Busca casillas dentro del alcance del usuario para agregarlas a una ruta
 * en captura (ver RutaForm) — usada por el buscador de "+ agregar casilla".
 */
export async function buscarCasillasRuta(
  texto: string
): Promise<ActionResult<CasillaBusquedaRuta[]>> {
  return ejecutarAccion(async () => {
    const usuario = await requireUserOrThrow();
    requireRole(usuario, [...ROLES_MODULO_RUTAS]);
    const casa = await obtenerCasaActiva();
    if (!casa) throw new AccionError("Elige una casa (26 o 52) antes de capturar.");
    return buscarCasillasParaRuta(usuario, casa, texto);
  });
}

/**
 * Guarda el enlace de UNA persona en varias casillas a la vez (módulo
 * Rutas): el Representante General (RG) captura los datos de contacto una
 * sola vez y los replica a cada casilla que va encadenando en su ruta
 * (ej. el mismo operador cubre varias casillas contiguas). Disponible
 * para Admin general y RG — siempre que cada casilla pertenezca a una
 * localidad asignada al RG (verificado abajo, nunca solo en la UI).
 *
 * A propósito sobrescribe el enlace de cualquier casilla que ya tuviera
 * uno capturado (por este mismo usuario o por otro): agregar una casilla
 * ya capturada a una ruta nueva reemplaza sus datos con los de la persona
 * que se está capturando ahora. No existe una acción de borrado a
 * propósito: una vez capturado un enlace se puede corregir su contenido,
 * pero no "deshacer" la parada de la ruta — igual que con el catálogo de
 * casillas, para proteger el registro contra manipulación.
 */
export async function guardarRutaEnlaces(
  formData: unknown,
  casillaIds: string[]
): Promise<ActionResult<{ guardadas: number }>> {
  return ejecutarAccion(async () => {
    const usuario = await requireUserOrThrow();
    requireRole(usuario, [...ROLES_MODULO_RUTAS]);

    const casa = await obtenerCasaActiva();
    if (!casa) throw new AccionError("Elige una casa (26 o 52) antes de capturar.");

    const idsUnicos = Array.from(new Set(casillaIds));
    if (idsUnicos.length === 0) {
      throw new AccionError("Agrega al menos una casilla a la ruta.");
    }

    const datos = enlaceCasillaSchema.parse(formData);

    const casillas = await prisma.casilla.findMany({
      where: { id: { in: idsUnicos } },
      include: { enlaces: { where: { casa } } },
    });
    if (casillas.length !== idsUnicos.length) {
      throw new AccionError("Alguna de las casillas seleccionadas ya no existe.");
    }
    for (const casilla of casillas) {
      requireLocalidadAccess(usuario, casilla);
    }

    const claveElectorCifrada = encryptField(datos.claveElector);

    // Todas las casillas guardadas en esta llamada forman UNA ruta — el
    // orden dentro de ella es el orden en que el RG las fue agregando en
    // el formulario (idsUnicos), no el orden en que Prisma las regrese.
    const rutaId = randomUUID();
    const ordenPorCasillaId = new Map(idsUnicos.map((id, indice) => [id, indice]));

    await prisma.$transaction(
      casillas.map((casilla) =>
        prisma.enlaceCasilla.upsert({
          where: { casillaId_casa: { casillaId: casilla.id, casa } },
          create: {
            casillaId: casilla.id,
            casa,
            nombre: datos.nombre,
            apellidoPaterno: datos.apellidoPaterno,
            apellidoMaterno: datos.apellidoMaterno,
            claveElectorCifrada,
            telefono: datos.telefono,
            correoElectronico: datos.correoElectronico,
            rutaId,
            ordenEnRuta: ordenPorCasillaId.get(casilla.id) ?? 0,
            capturadoPorId: usuario.id,
            updatedById: usuario.id,
          },
          update: {
            nombre: datos.nombre,
            apellidoPaterno: datos.apellidoPaterno,
            apellidoMaterno: datos.apellidoMaterno,
            claveElectorCifrada,
            telefono: datos.telefono,
            correoElectronico: datos.correoElectronico,
            rutaId,
            ordenEnRuta: ordenPorCasillaId.get(casilla.id) ?? 0,
            updatedById: usuario.id,
            // capturadoEn/capturadoPorId NUNCA se tocan en el update: fijan
            // el orden real de la ruta (cuándo se visitó esa casilla por
            // primera vez), que no debe moverse solo porque se corrigió o
            // reemplazó el enlace.
          },
        })
      )
    );

    for (const casilla of casillas) {
      const enlacePrevio = casilla.enlaces[0] ?? null;
      await registrarAuditoria({
        usuarioId: usuario.id,
        accion: enlacePrevio ? "ACTUALIZAR" : "CREAR",
        entidad: "EnlaceCasilla",
        entidadId: casilla.id,
        datosAntes: enlacePrevio
          ? { ...enlacePrevio, claveElectorCifrada: "[cifrado]" }
          : undefined,
        datosDespues: {
          casillaId: casilla.id,
          casa,
          nombre: datos.nombre,
          apellidoPaterno: datos.apellidoPaterno,
          claveElectorCifrada: "[cifrado]",
        },
      });
    }

    revalidatePath("/rutas");
    for (const casilla of casillas) {
      revalidatePath(`/casillas/${casilla.id}`);
    }

    return { guardadas: casillas.length };
  });
}
