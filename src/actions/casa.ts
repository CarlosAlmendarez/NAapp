"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type { Casa } from "@prisma/client";
import { requireUserOrThrow } from "@/lib/auth-helpers";
import { COOKIE_CASA, esCasa } from "@/lib/casa";
import { registrarAuditoria } from "@/lib/audit";
import { ejecutarAccion, AccionError, type ActionResult } from "@/lib/action-result";

const UN_ANIO_EN_SEGUNDOS = 60 * 60 * 24 * 365;

/**
 * Fija la casa activa del usuario (Casa 26 / Casa 52). Se guarda en la
 * cookie `casa` y a partir de ahí acota todo lo que el usuario captura o
 * consulta hasta que la cambie desde el selector del encabezado. No
 * cambia permisos: cualquier CAPTURADOR/RG puede trabajar en ambas casas.
 */
export async function seleccionarCasa(casa: Casa): Promise<ActionResult<{ casa: Casa }>> {
  return ejecutarAccion(async () => {
    const usuario = await requireUserOrThrow();
    if (!esCasa(casa)) {
      throw new AccionError("Casa inválida.");
    }

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_CASA, casa, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: UN_ANIO_EN_SEGUNDOS,
    });

    await registrarAuditoria({
      usuarioId: usuario.id,
      accion: "SELECCIONAR_CASA",
      entidad: "Casa",
      entidadId: casa,
    });

    // Todo el árbol protegido depende de la casa activa.
    revalidatePath("/", "layout");
    return { casa };
  });
}
