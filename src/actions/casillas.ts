"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserOrThrow, requireRole, requireLocalidadAccess } from "@/lib/auth-helpers";
import { casillaSchema } from "@/lib/validations/casilla";
import { registrarAuditoria } from "@/lib/audit";
import { ejecutarAccion, AccionError, type ActionResult } from "@/lib/action-result";

/**
 * Crear casillas: solo Admin general y Admin de casillas. Ni el
 * Capturador ni el Representante General (RG) pueden crear la casilla en
 * sí — el Capturador solo captura RC dentro de su localidad, y el RG solo
 * recorre el módulo de Rutas capturando el enlace de cada casilla (ver
 * actions/representantes.ts y actions/enlaces.ts respectivamente).
 *
 * Editar y eliminar casillas están deshabilitados a propósito (para
 * ninguna cuenta, incluida Admin general) para proteger el catálogo
 * oficial contra ediciones o borrados accidentales — ver
 * `actualizarCasilla` y `eliminarCasilla` abajo.
 */
export async function crearCasilla(formData: unknown): Promise<ActionResult<{ id: string }>> {
  return ejecutarAccion(async () => {
    const usuario = await requireUserOrThrow();
    requireRole(usuario, ["ADMIN_GENERAL", "ADMIN_CASILLAS"]);

    const datos = casillaSchema.parse(formData);

    const existente = await prisma.casilla.findUnique({
      where: { seccion_tipoCasilla: { seccion: datos.seccion, tipoCasilla: datos.tipoCasilla } },
    });
    if (existente) {
      throw new AccionError(`Ya existe una casilla con sección ${datos.seccion} y tipo ${datos.tipoCasilla}.`);
    }

    const casilla = await prisma.casilla.create({
      data: { ...datos, createdById: usuario.id, updatedById: usuario.id },
    });

    await registrarAuditoria({
      usuarioId: usuario.id,
      accion: "CREAR",
      entidad: "Casilla",
      entidadId: casilla.id,
      datosDespues: casilla,
    });

    revalidatePath("/casillas");
    return { id: casilla.id };
  });
}

/**
 * Deshabilitada a propósito: editar el catálogo de casillas está apagado
 * para nadie (incluida Admin general) pueda modificar los registros
 * oficiales por error. No hay ruta ni botón en la UI que llegue aquí; este
 * guardado extra es la protección real en servidor.
 */
export async function actualizarCasilla(
  _id: string,
  _formData: unknown
): Promise<ActionResult<{ id: string }>> {
  return ejecutarAccion(async () => {
    await requireUserOrThrow();
    throw new AccionError("Editar casillas está deshabilitado para proteger el catálogo oficial.");
  });
}

/**
 * Deshabilitada a propósito: eliminar casillas está apagado para nadie
 * (incluida Admin general), para evitar que se borren registros del
 * catálogo oficial. No hay ruta ni botón en la UI que llegue aquí; este
 * guardado extra es la protección real en servidor.
 */
export async function eliminarCasilla(_id: string): Promise<ActionResult<{ id: string }>> {
  return ejecutarAccion(async () => {
    await requireUserOrThrow();
    throw new AccionError("Eliminar casillas está deshabilitado para proteger el catálogo oficial.");
  });
}

/**
 * Verifica acceso de un capturador a una casilla puntual antes de dejarlo
 * capturar RC/asistentes. Se reutiliza en las Server Actions de
 * representantes y asistentes.
 */
export async function obtenerCasillaConAccesoOrThrow(casillaId: string) {
  const usuario = await requireUserOrThrow();
  const casilla = await prisma.casilla.findUnique({ where: { id: casillaId } });
  if (!casilla) throw new AccionError("La casilla no existe.");
  requireLocalidadAccess(usuario, casilla);
  return { usuario, casilla };
}
