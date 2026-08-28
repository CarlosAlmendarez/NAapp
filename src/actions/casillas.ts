"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserOrThrow, requireRole, requireLocalidadAccess } from "@/lib/auth-helpers";
import { casillaSchema } from "@/lib/validations/casilla";
import { registrarAuditoria } from "@/lib/audit";
import { ejecutarAccion, type ActionResult } from "@/lib/action-result";

/**
 * Crear/editar casillas: solo Admin general y Admin de casillas
 * (ver tabla de permisos). El capturador nunca puede crear ni editar
 * la casilla en sí, solo capturar RC/asistentes dentro de su localidad.
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
      throw new Error(`Ya existe una casilla con sección ${datos.seccion} y tipo ${datos.tipoCasilla}.`);
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

export async function actualizarCasilla(
  id: string,
  formData: unknown
): Promise<ActionResult<{ id: string }>> {
  return ejecutarAccion(async () => {
    const usuario = await requireUserOrThrow();
    requireRole(usuario, ["ADMIN_GENERAL", "ADMIN_CASILLAS"]);

    const datos = casillaSchema.parse(formData);

    const actual = await prisma.casilla.findUnique({ where: { id } });
    if (!actual) throw new Error("La casilla no existe.");

    if (datos.seccion !== actual.seccion || datos.tipoCasilla !== actual.tipoCasilla) {
      const duplicada = await prisma.casilla.findFirst({
        where: {
          seccion: datos.seccion,
          tipoCasilla: datos.tipoCasilla,
          NOT: { id },
        },
      });
      if (duplicada) {
        throw new Error(`Ya existe otra casilla con sección ${datos.seccion} y tipo ${datos.tipoCasilla}.`);
      }
    }

    const casilla = await prisma.casilla.update({
      where: { id },
      data: { ...datos, updatedById: usuario.id },
    });

    await registrarAuditoria({
      usuarioId: usuario.id,
      accion: "ACTUALIZAR",
      entidad: "Casilla",
      entidadId: casilla.id,
      datosAntes: actual,
      datosDespues: casilla,
    });

    revalidatePath("/casillas");
    revalidatePath(`/casillas/${id}`);
    return { id: casilla.id };
  });
}

export async function eliminarCasilla(id: string): Promise<ActionResult<{ id: string }>> {
  return ejecutarAccion(async () => {
    const usuario = await requireUserOrThrow();
    requireRole(usuario, ["ADMIN_GENERAL", "ADMIN_CASILLAS"]);

    const actual = await prisma.casilla.findUnique({ where: { id } });
    if (!actual) throw new Error("La casilla no existe.");

    await prisma.casilla.delete({ where: { id } });

    await registrarAuditoria({
      usuarioId: usuario.id,
      accion: "ELIMINAR",
      entidad: "Casilla",
      entidadId: id,
      datosAntes: actual,
    });

    revalidatePath("/casillas");
    return { id };
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
  if (!casilla) throw new Error("La casilla no existe.");
  requireLocalidadAccess(usuario, casilla);
  return { usuario, casilla };
}
