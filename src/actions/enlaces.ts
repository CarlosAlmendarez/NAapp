"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obtenerCasillaConAccesoOrThrow } from "@/actions/casillas";
import { requireRole } from "@/lib/auth-helpers";
import { enlaceCasillaSchema } from "@/lib/validations/persona";
import { encryptField } from "@/lib/crypto";
import { registrarAuditoria } from "@/lib/audit";
import { ejecutarAccion, type ActionResult } from "@/lib/action-result";

/**
 * Crea o edita el enlace de una casilla (módulo Rutas). Disponible para
 * Admin general y Representante General (RG) — siempre que la casilla
 * pertenezca a una localidad asignada al RG (verificado en
 * obtenerCasillaConAccesoOrThrow, nunca solo en la UI). No existe una
 * acción de borrado a propósito: una vez capturado un enlace se puede
 * corregir su contenido, pero no "deshacer" la parada de la ruta — igual
 * que con el catálogo de casillas, para proteger el registro contra
 * manipulación.
 */
export async function guardarEnlace(
  casillaId: string,
  formData: unknown
): Promise<ActionResult<{ id: string }>> {
  return ejecutarAccion(async () => {
    const { usuario, casilla } = await obtenerCasillaConAccesoOrThrow(casillaId);
    requireRole(usuario, ["ADMIN_GENERAL", "REPRESENTANTE_GENERAL"]);
    const datos = enlaceCasillaSchema.parse(formData);

    const anterior = await prisma.enlaceCasilla.findUnique({
      where: { casillaId: casilla.id },
    });

    const claveElectorCifrada = encryptField(datos.claveElector);

    const enlace = await prisma.enlaceCasilla.upsert({
      where: { casillaId: casilla.id },
      create: {
        casillaId: casilla.id,
        nombre: datos.nombre,
        apellidoPaterno: datos.apellidoPaterno,
        apellidoMaterno: datos.apellidoMaterno,
        claveElectorCifrada,
        telefono: datos.telefono,
        correoElectronico: datos.correoElectronico,
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
        updatedById: usuario.id,
        // capturadoEn/capturadoPorId NUNCA se tocan en el update: fijan el
        // orden real de la ruta (cuándo se visitó esa casilla por primera
        // vez), que no debe moverse solo porque se corrigió un dato.
      },
    });

    await registrarAuditoria({
      usuarioId: usuario.id,
      accion: anterior ? "ACTUALIZAR" : "CREAR",
      entidad: "EnlaceCasilla",
      entidadId: enlace.id,
      datosAntes: anterior ? { ...anterior, claveElectorCifrada: "[cifrado]" } : undefined,
      datosDespues: { ...enlace, claveElectorCifrada: "[cifrado]" },
    });

    revalidatePath("/rutas");
    revalidatePath(`/casillas/${casilla.id}`);
    return { id: enlace.id };
  });
}
