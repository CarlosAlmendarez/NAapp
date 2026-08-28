"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserOrThrow, invalidarSesionesDe } from "@/lib/auth-helpers";
import { cambiarPasswordSchema } from "@/lib/validations/auth";
import { registrarAuditoria } from "@/lib/audit";
import { ejecutarAccion, type ActionResult } from "@/lib/action-result";
import { signOut } from "@/auth";

const BCRYPT_ROUNDS = 12;

/** Cambio de contraseña por el propio usuario (requiere la contraseña actual). */
export async function cambiarMiPassword(formData: unknown): Promise<ActionResult<undefined>> {
  return ejecutarAccion(async () => {
    const usuario = await requireUserOrThrow();
    const datos = cambiarPasswordSchema.parse(formData);

    const registro = await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    const actualValida = await bcrypt.compare(datos.passwordActual, registro.passwordHash);
    if (!actualValida) {
      throw new Error("La contraseña actual es incorrecta.");
    }

    const passwordHash = await bcrypt.hash(datos.passwordNueva, BCRYPT_ROUNDS);

    // Cambiar la contraseña también revoca las demás sesiones activas.
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });

    await registrarAuditoria({
      usuarioId: usuario.id,
      accion: "CAMBIAR_PASSWORD",
      entidad: "Usuario",
      entidadId: usuario.id,
    });

    return undefined;
  });
}

/** Cierre de sesión normal (solo el dispositivo actual). */
export async function cerrarSesion(): Promise<never> {
  const usuario = await requireUserOrThrow();
  await registrarAuditoria({
    usuarioId: usuario.id,
    accion: "LOGOUT",
    entidad: "Usuario",
    entidadId: usuario.id,
  });
  await signOut({ redirect: false });
  redirect("/login");
}

/**
 * "Cerrar sesión en todos los dispositivos": invalida también la sesión
 * actual (es lo esperado), así que termina cerrando sesión y mandando al
 * usuario de vuelta al login.
 */
export async function cerrarTodasMisSesiones(): Promise<never> {
  const usuario = await requireUserOrThrow();
  await invalidarSesionesDe(usuario.id);
  await registrarAuditoria({
    usuarioId: usuario.id,
    accion: "CERRAR_TODAS_MIS_SESIONES",
    entidad: "Usuario",
    entidadId: usuario.id,
  });
  await signOut({ redirect: false });
  redirect("/login?motivo=sesiones_cerradas");
}
