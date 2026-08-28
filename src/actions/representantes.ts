"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obtenerCasillaConAccesoOrThrow } from "@/actions/casillas";
import { requireRole } from "@/lib/auth-helpers";
import { representanteSchema } from "@/lib/validations/persona";
import { encryptField } from "@/lib/crypto";
import { registrarAuditoria } from "@/lib/audit";
import { ejecutarAccion, type ActionResult } from "@/lib/action-result";

/**
 * Crea o reemplaza el representante (propietario o suplente) de una
 * casilla. Disponible para Admin general, Admin de casillas y Capturador
 * — siempre que la casilla pertenezca a una localidad del capturador
 * (verificado en obtenerCasillaConAccesoOrThrow, nunca solo en la UI).
 * El Representante General (RG) queda excluido a propósito: solo
 * administra el catálogo de casillas, nunca captura RC.
 */
export async function guardarRepresentante(
  casillaId: string,
  formData: unknown
): Promise<ActionResult<{ id: string }>> {
  return ejecutarAccion(async () => {
    const { usuario, casilla } = await obtenerCasillaConAccesoOrThrow(casillaId);
    requireRole(usuario, ["ADMIN_GENERAL", "ADMIN_CASILLAS", "CAPTURADOR"]);
    const datos = representanteSchema.parse(formData);

    const anterior = await prisma.representanteCasilla.findUnique({
      where: { casillaId_tipo: { casillaId: casilla.id, tipo: datos.tipo } },
    });

    const claveElectorCifrada = encryptField(datos.claveElector);

    const representante = await prisma.representanteCasilla.upsert({
      where: { casillaId_tipo: { casillaId: casilla.id, tipo: datos.tipo } },
      create: {
        casillaId: casilla.id,
        tipo: datos.tipo,
        nombre: datos.nombre,
        apellidoPaterno: datos.apellidoPaterno,
        apellidoMaterno: datos.apellidoMaterno,
        claveElectorCifrada,
        correoElectronico: datos.correoElectronico,
        telefono: datos.telefono,
        propone: datos.propone,
        capturadoPorId: usuario.id,
        updatedById: usuario.id,
      },
      update: {
        nombre: datos.nombre,
        apellidoPaterno: datos.apellidoPaterno,
        apellidoMaterno: datos.apellidoMaterno,
        claveElectorCifrada,
        correoElectronico: datos.correoElectronico,
        telefono: datos.telefono,
        propone: datos.propone,
        updatedById: usuario.id,
      },
    });

    await registrarAuditoria({
      usuarioId: usuario.id,
      accion: anterior ? "ACTUALIZAR" : "CREAR",
      entidad: "RepresentanteCasilla",
      entidadId: representante.id,
      datosAntes: anterior ? { ...anterior, claveElectorCifrada: "[cifrado]" } : undefined,
      datosDespues: { ...representante, claveElectorCifrada: "[cifrado]" },
    });

    revalidatePath(`/casillas/${casilla.id}`);
    return { id: representante.id };
  });
}

export async function eliminarRepresentante(
  casillaId: string,
  representanteId: string
): Promise<ActionResult<{ id: string }>> {
  return ejecutarAccion(async () => {
    const { usuario, casilla } = await obtenerCasillaConAccesoOrThrow(casillaId);
    requireRole(usuario, ["ADMIN_GENERAL", "ADMIN_CASILLAS", "CAPTURADOR"]);

    const actual = await prisma.representanteCasilla.findUnique({
      where: { id: representanteId },
    });
    if (!actual || actual.casillaId !== casilla.id) {
      throw new Error("El representante no existe en esta casilla.");
    }

    await prisma.representanteCasilla.delete({ where: { id: representanteId } });

    await registrarAuditoria({
      usuarioId: usuario.id,
      accion: "ELIMINAR",
      entidad: "RepresentanteCasilla",
      entidadId: representanteId,
      datosAntes: { ...actual, claveElectorCifrada: "[cifrado]" },
    });

    revalidatePath(`/casillas/${casilla.id}`);
    return { id: representanteId };
  });
}
