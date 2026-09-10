"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obtenerCasillaConAccesoOrThrow } from "@/actions/casillas";
import { requireRole } from "@/lib/auth-helpers";
import { obtenerCasaActiva } from "@/lib/casa-server";
import { CASA_LABEL } from "@/lib/casa";
import { obtenerRgDeCasilla } from "@/lib/rg-query";
import { representanteSchema } from "@/lib/validations/persona";
import { encryptField } from "@/lib/crypto";
import { registrarAuditoria } from "@/lib/audit";
import { ejecutarAccion, AccionError, type ActionResult } from "@/lib/action-result";

/**
 * Crea o reemplaza el representante (propietario o suplente) de una
 * casilla EN LA CASA ACTIVA (26 / 52 — ver src/lib/casa.ts). Disponible
 * para Admin general, Admin de casillas y Capturador — siempre que la
 * casilla pertenezca a una localidad del capturador (verificado en
 * obtenerCasillaConAccesoOrThrow, nunca solo en la UI). El Representante
 * General (RG) queda excluido a propósito: solo administra el catálogo de
 * casillas, nunca captura RC.
 *
 * El RC suplente solo puede capturarse si la casilla NO tiene un RG
 * asignado en esa casa (ver Cambio 2 / obtenerRgDeCasilla).
 */
export async function guardarRepresentante(
  casillaId: string,
  formData: unknown
): Promise<ActionResult<{ id: string }>> {
  return ejecutarAccion(async () => {
    const { usuario, casilla } = await obtenerCasillaConAccesoOrThrow(casillaId);
    requireRole(usuario, ["ADMIN_GENERAL", "ADMIN_CASILLAS", "CAPTURADOR"]);

    const casa = await obtenerCasaActiva();
    if (!casa) throw new AccionError("Elige una casa (26 o 52) antes de capturar.");

    const datos = representanteSchema.parse(formData);

    const anterior = await prisma.representanteCasilla.findUnique({
      where: { casillaId_tipo_casa: { casillaId: casilla.id, tipo: datos.tipo, casa } },
    });

    // El RC suplente solo se captura si la casilla NO tiene RG en esta
    // casa. Si ya había un suplente capturado (p. ej. el RG se asignó
    // después), se permite corregirlo pero no crear uno nuevo.
    if (datos.tipo === "SUPLENTE" && !anterior) {
      const rg = await obtenerRgDeCasilla(casilla.distritoLocal, casa);
      if (rg) {
        throw new AccionError(
          `Esta casilla ya tiene Representante General en ${CASA_LABEL[casa]} (${rg.nombre}); ` +
            "el RC suplente solo se captura cuando no hay RG."
        );
      }
    }

    // Alta: la clave de elector es obligatoria. Edición: si viene vacía
    // (no se retecleó), se CONSERVA la ya guardada — nunca se borra.
    if (!datos.claveElector && !anterior) {
      throw new AccionError("La clave de elector es obligatoria.");
    }
    const claveElectorCifrada = datos.claveElector
      ? encryptField(datos.claveElector)
      : anterior!.claveElectorCifrada;

    const representante = await prisma.representanteCasilla.upsert({
      where: { casillaId_tipo_casa: { casillaId: casilla.id, tipo: datos.tipo, casa } },
      create: {
        casillaId: casilla.id,
        tipo: datos.tipo,
        casa,
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

    const casa = await obtenerCasaActiva();
    if (!casa) throw new AccionError("Elige una casa (26 o 52) antes de capturar.");

    const actual = await prisma.representanteCasilla.findUnique({
      where: { id: representanteId },
    });
    if (!actual || actual.casillaId !== casilla.id || actual.casa !== casa) {
      throw new AccionError("El representante no existe en esta casilla y casa.");
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
