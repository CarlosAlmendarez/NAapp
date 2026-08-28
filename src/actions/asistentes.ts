"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obtenerCasillaConAccesoOrThrow } from "@/actions/casillas";
import { requireRole } from "@/lib/auth-helpers";
import { asistenteSchema } from "@/lib/validations/persona";
import { encryptField } from "@/lib/crypto";
import { registrarAuditoria } from "@/lib/audit";
import { ejecutarAccion, AccionError, type ActionResult } from "@/lib/action-result";

// El Representante General (RG) queda excluido a propósito de estas tres
// acciones: solo administra el catálogo de casillas, nunca captura
// asistentes electorales (igual que con los RC, ver actions/representantes.ts).

export async function crearAsistente(
  casillaId: string,
  formData: unknown
): Promise<ActionResult<{ id: string }>> {
  return ejecutarAccion(async () => {
    const { usuario, casilla } = await obtenerCasillaConAccesoOrThrow(casillaId);
    requireRole(usuario, ["ADMIN_GENERAL", "ADMIN_CASILLAS", "CAPTURADOR"]);
    const datos = asistenteSchema.parse(formData);

    const asistente = await prisma.asistenteElectoral.create({
      data: {
        casillaId: casilla.id,
        nombre: datos.nombre,
        apellidoPaterno: datos.apellidoPaterno,
        apellidoMaterno: datos.apellidoMaterno,
        claveElectorCifrada: datos.claveElector ? encryptField(datos.claveElector) : null,
        correoElectronico: datos.correoElectronico,
        telefono: datos.telefono,
        capturadoPorId: usuario.id,
        updatedById: usuario.id,
      },
    });

    await registrarAuditoria({
      usuarioId: usuario.id,
      accion: "CREAR",
      entidad: "AsistenteElectoral",
      entidadId: asistente.id,
      datosDespues: { ...asistente, claveElectorCifrada: "[cifrado]" },
    });

    revalidatePath(`/casillas/${casilla.id}`);
    return { id: asistente.id };
  });
}

export async function actualizarAsistente(
  casillaId: string,
  asistenteId: string,
  formData: unknown
): Promise<ActionResult<{ id: string }>> {
  return ejecutarAccion(async () => {
    const { usuario, casilla } = await obtenerCasillaConAccesoOrThrow(casillaId);
    requireRole(usuario, ["ADMIN_GENERAL", "ADMIN_CASILLAS", "CAPTURADOR"]);
    const datos = asistenteSchema.parse(formData);

    const anterior = await prisma.asistenteElectoral.findUnique({ where: { id: asistenteId } });
    if (!anterior || anterior.casillaId !== casilla.id) {
      throw new AccionError("El asistente electoral no existe en esta casilla.");
    }

    const asistente = await prisma.asistenteElectoral.update({
      where: { id: asistenteId },
      data: {
        nombre: datos.nombre,
        apellidoPaterno: datos.apellidoPaterno,
        apellidoMaterno: datos.apellidoMaterno,
        claveElectorCifrada: datos.claveElector ? encryptField(datos.claveElector) : null,
        correoElectronico: datos.correoElectronico,
        telefono: datos.telefono,
        updatedById: usuario.id,
      },
    });

    await registrarAuditoria({
      usuarioId: usuario.id,
      accion: "ACTUALIZAR",
      entidad: "AsistenteElectoral",
      entidadId: asistente.id,
      datosAntes: { ...anterior, claveElectorCifrada: "[cifrado]" },
      datosDespues: { ...asistente, claveElectorCifrada: "[cifrado]" },
    });

    revalidatePath(`/casillas/${casilla.id}`);
    return { id: asistente.id };
  });
}

export async function eliminarAsistente(
  casillaId: string,
  asistenteId: string
): Promise<ActionResult<{ id: string }>> {
  return ejecutarAccion(async () => {
    const { usuario, casilla } = await obtenerCasillaConAccesoOrThrow(casillaId);
    requireRole(usuario, ["ADMIN_GENERAL", "ADMIN_CASILLAS", "CAPTURADOR"]);

    const actual = await prisma.asistenteElectoral.findUnique({ where: { id: asistenteId } });
    if (!actual || actual.casillaId !== casilla.id) {
      throw new AccionError("El asistente electoral no existe en esta casilla.");
    }

    await prisma.asistenteElectoral.delete({ where: { id: asistenteId } });

    await registrarAuditoria({
      usuarioId: usuario.id,
      accion: "ELIMINAR",
      entidad: "AsistenteElectoral",
      entidadId: asistenteId,
      datosAntes: { ...actual, claveElectorCifrada: "[cifrado]" },
    });

    revalidatePath(`/casillas/${casilla.id}`);
    return { id: asistenteId };
  });
}
